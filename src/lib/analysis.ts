import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, GenerationConfig, ResponseSchema, SchemaType } from "@google/generative-ai";
import { db } from '@/lib/db-client';
import { reports, calls, recordings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { CallReportData, TranscriptSegment } from '@/types';
import { MANDATORY_QUESTIONS } from '@/config/interview-questions';

// --- Constants ---
const MODEL_NAME = "gemini-2.0-flash"; // Updated model
const GEMINI_API_TIMEOUT_MS = 45000; // 45 seconds timeout for Gemini call

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

const generationConfig: GenerationConfig = {
  responseMimeType: "application/json",
  temperature: 0.7,
};

// --- Define the response schema for structured output ---
const scoreObject: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    score: { type: SchemaType.NUMBER, description: "Score from 1 (poor) to 5 (excellent).", nullable: false },
    rationale: { type: SchemaType.STRING, description: "Brief rationale for the score.", nullable: false }
  },
  required: ["score", "rationale"]
};

const analysisReportSchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    analysis_report: {
      type: SchemaType.OBJECT,
      description: "Structured assessment of the candidate pre-interview call",
      properties: {
        answers: {
          type: SchemaType.ARRAY,
          description: "Summaries of applicant's answers to each mandatory question with STAR method evaluation",
          items: {
            type: SchemaType.OBJECT,
            properties: {
              question: { type: SchemaType.STRING, nullable: false },
              answer: { type: SchemaType.STRING, nullable: false },
              star_evaluation: {
                type: SchemaType.OBJECT,
                description: "STAR method evaluation for this specific answer",
                properties: {
                  score: { type: SchemaType.NUMBER, description: "STAR method score from 1-5 for this answer", nullable: false },
                  rationale: { type: SchemaType.STRING, description: "Explanation of STAR method usage in this answer", nullable: false },
                  situation_present: { type: SchemaType.BOOLEAN, description: "Whether Situation is clearly described", nullable: false },
                  task_present: { type: SchemaType.BOOLEAN, description: "Whether Task is clearly described", nullable: false },
                  action_present: { type: SchemaType.BOOLEAN, description: "Whether Action is clearly described", nullable: false },
                  result_present: { type: SchemaType.BOOLEAN, description: "Whether Result is clearly described", nullable: false }
                },
                required: ["score", "rationale", "situation_present", "task_present", "action_present", "result_present"]
              }
            },
            required: ["question", "answer", "star_evaluation"]
          }
        },
        clarity: scoreObject,
        relevance: scoreObject,
        depth: scoreObject,
        comm_style: scoreObject,
        cultural_fit: scoreObject,
        attention_to_detail: scoreObject,
        language_proficiency: scoreObject,
        star_method: {
          type: SchemaType.OBJECT,
          description: "Overall STAR method evaluation across all experience-related answers",
          properties: {
            score: { type: SchemaType.NUMBER, description: "Overall STAR method score from 1-5", nullable: false },
            rationale: { type: SchemaType.STRING, description: "Overall assessment of STAR method usage throughout the interview", nullable: false }
          },
          required: ["score", "rationale"]
        }
      },
      required: [
        "answers",
        "clarity",
        "relevance",
        "depth",
        "comm_style",
        "cultural_fit",
        "attention_to_detail",
        "language_proficiency",
        "star_method"
      ]
    }
  },
  required: ["analysis_report"]
};
// --- End Schema Definition ---


// Custom Error for Timeout
export class AnalysisTimeoutError extends Error {
  constructor(message = `Analysis timed out after ${GEMINI_API_TIMEOUT_MS / 1000} seconds.`) {
    super(message);
    this.name = "AnalysisTimeoutError";
  }
}

// Helper to create a timeout promise
const timeout = (ms: number) => new Promise((_, reject) =>
  setTimeout(() => reject(new AnalysisTimeoutError()), ms)
);


/**
 * Performs analysis using Gemini API and saves the report to the database.
 * Includes timeout handling for the Gemini API call.
 * Checks for existing reports before proceeding.
 * Verifies user ownership of the call record (admin users can access any call).
 *
 * @param callId The ID of the call to analyze.
 * @param userId The ID of the authenticated user making the request.
 * @param userType The type of the authenticated user ('admin' or 'applicant').
 * @returns An object indicating success/failure, the report data/ID if successful, or an error message.
 */
export async function performAnalysisAndSaveReport(callId: string, userId: string, userType: string = 'applicant'): Promise<{ success: boolean; report?: CallReportData; error?: string; reportId?: string; message?: string }> {
  if (!process.env.GEMINI_API_KEY) {
    console.error(`[Analysis ${callId}] GEMINI_API_KEY not found in environment variables.`);
    return { success: false, error: "Gemini API key not configured" };
  }
  const apiKey = process.env.GEMINI_API_KEY;

  try {
    // 1. --- Fetch Transcript & Verify Ownership ---
    console.log(`[Analysis ${callId}] 📊 Starting Gemini analysis for user ${userId}...`);
    const callData = await db.select({
      recordingId: calls.recordingId,
      reportId: calls.reportId,
      ownerUserId: calls.userId
    }).from(calls).where(eq(calls.id, callId)).limit(1);

    if (callData.length === 0) return { success: false, error: `Call not found: ${callId}` };
    
    // Admin users can access any call, applicants can only access their own calls
    if (userType !== 'admin' && callData[0].ownerUserId !== userId) {
      return { success: false, error: 'Forbidden: You do not own this call record.' };
    }
    if (callData[0].reportId) {
      console.log(`[Analysis ${callId}] ✅ Report already exists (${callData[0].reportId}). Skipping.`);
      // Optionally fetch existing report here if needed
      return { success: true, message: "Analysis already completed.", reportId: callData[0].reportId };
    }
    if (!callData[0].recordingId) return { success: false, error: `Recording ID not found for call: ${callId}` };

    const recordingData = await db.select({ transcript: recordings.transcript })
      .from(recordings)
      .where(eq(recordings.id, callData[0].recordingId))
      .limit(1);

    if (recordingData.length === 0 || !recordingData[0].transcript) {
      return { success: false, error: `Transcript not found or empty for call: ${callId}` };
    }

    let transcript: TranscriptSegment[];
    try {
      const rawTranscript = recordingData[0].transcript;
      transcript = typeof rawTranscript === 'string' ? JSON.parse(rawTranscript) : rawTranscript as TranscriptSegment[];
      if (!Array.isArray(transcript) || transcript.length === 0) throw new Error("Parsed transcript invalid.");
      console.log(`[Analysis ${callId}] ✅ Successfully loaded transcript with ${transcript.length} segments for analysis.`);
    } catch (parseError) {
      console.error(`[Analysis ${callId}] Failed to parse stored transcript:`, parseError);
      return { success: false, error: "Failed to parse stored transcript data." };
    }
    // --- End Transcript Fetch ---

    // 2. --- Prepare Gemini Request ---
    console.log(`[Analysis ${callId}] 🤖 Preparing Gemini analysis with transcript...`);
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      safetySettings: safetySettings,
      generationConfig: { ...generationConfig, responseSchema: analysisReportSchema }
    });
    const formattedTranscript = transcript.map(segment => `${segment.speaker}: ${segment.text}`).join('\\n');
    const currentDate = new Date().toISOString().split('T')[0]; // Get current date in YYYY-MM-DD format

    // Generate the mandatory questions list for the analysis prompt
    const mandatoryQuestionsText = MANDATORY_QUESTIONS.map((question, index) => 
      `${index + 1}. "${question}"`
    ).join('\n');

    console.log(`[Analysis ${callId}] 📝 Formatted transcript: ${formattedTranscript.length} characters, ${transcript.length} speaker segments`);

    const prompt = `
          You are an expert pre-interview call analyst. You are reviewing this transcript from a pre-interview call between an HR professional and a job candidate.

          **IMPORTANT: This transcript was generated using high-quality speech-to-text conversion. The text accuracy should be very good, though some speaker diarization may be imperfect.**

          **Important Note on Transcript Source:**
          The transcript provided might come from one of two sources:
          1. A live call recording: In this case, speaker turns are typically labeled as "User" (the HR representative) and "AI" (the candidate).
          2. A manually uploaded recording: In this scenario, precise speaker diarization might be unavailable. Segments might all be attributed to a generic speaker (e.g., "AI", "SPEAKER_0", or similar).

          Please adapt your analysis based on the apparent structure of the transcript. If speaker labels are generic or missing, focus on the content of the conversation to infer roles and analyze the interaction to the best of your ability.

          The provided transcript may contain minor transcription errors from the speech-to-text process. Ignore minor transcription errors—focus on speaker intent.

          **Mandatory Questions Reference:**
          The HR professional was instructed to ask these mandatory questions during the interview:
          ${mandatoryQuestionsText}

          **STAR Method Evaluation Framework:**
          The STAR method is a structured approach to answering behavioral interview questions:
          - **Situation**: The context or background of the example
          - **Task**: The specific task or challenge that needed to be addressed
          - **Action**: The specific actions taken to address the task/challenge
          - **Result**: The outcome or results achieved from those actions

          For each answer, evaluate whether the candidate clearly described each component:
          - Situation: Did they set the scene? Provide context about when/where this happened?
          - Task: Did they explain what specifically needed to be done or what challenge they faced?
          - Action: Did they describe the specific steps they took? (Use "I" statements, not "we")
          - Result: Did they explain what happened as a result? Include measurable outcomes if possible.

          **Task: Analyze the Pre-Interview Call**
          1. **Question-Answer Analysis**: For the 'answers' field, provide a summary of the candidate's response to each mandatory question listed above. Find where each question was asked in the transcript and summarize the candidate's answer. If a question was not asked or the candidate did not provide a clear answer, note this in the summary. For each answer, also evaluate the STAR method usage:

             Format each as:
             - question: [the exact mandatory question text]
             - answer: [summary of candidate's response, or "Not answered" if applicable]
             - star_evaluation: {
                 score: [1-5 score for STAR method usage in this specific answer]
                 rationale: [explanation of STAR method usage quality]
                 situation_present: [true/false - was situation clearly described?]
                 task_present: [true/false - was task/challenge clearly described?]
                 action_present: [true/false - were specific actions clearly described?]
                 result_present: [true/false - were results/outcomes clearly described?]
               }

          2. **Overall Scoring**: Evaluate the candidate's performance using these 8 criteria, each scored 1-5:
             - clarity: How clear and articulate were the candidate's responses?
             - relevance: How relevant were the answers to the questions and the job role?
             - depth: How detailed and substantive were the responses?
             - comm_style: How effective was the candidate's communication style?
             - cultural_fit: How well does the candidate seem to fit the company culture?
             - attention_to_detail: Did the candidate show attention to detail in their responses?
             - language_proficiency: How proficient was the candidate in the language used (Bahasa Indonesia)?
             - star_method: Overall assessment of STAR method usage across all experience-related questions (score 1-5)

          **STAR Method Scoring Guidelines:**
          - Score 5: All four STAR components clearly present with specific, measurable details
          - Score 4: Three components clearly present, one component partially present
          - Score 3: Two-three components present, some details provided
          - Score 2: One-two components present, limited structure or details
          - Score 1: No clear STAR structure, vague or incomplete examples

          **Output Format Constraints:**
          You have access to the analysis_report JSON schema. All output must validate against it. Your response MUST strictly adhere to the JSON schema provided via the API configuration.
          Output ONLY the analysis_report JSON object—no extra text, explanations, or markdown.

          **Input Transcript:**
          ---
          ${formattedTranscript}
          ---
        `;

    // --- Call Gemini API ---
    console.log(`[Analysis ${callId}] 🚀 Sending transcript to Gemini ${MODEL_NAME} for analysis...`);
    let result: any;
    try {
      const geminiStart = Date.now();
      result = await Promise.race([
        model.generateContent(prompt),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Gemini analysis timed out')), GEMINI_API_TIMEOUT_MS))
      ]);
      const geminiEnd = Date.now();
      console.log(`[Analysis ${callId}] ✅ Gemini analysis completed in ${geminiEnd - geminiStart}ms.`);
    } catch (error) {
      console.error(`[Analysis ${callId}] ❌ Gemini API call failed:`, error);
      const message = error instanceof Error ? error.message : "Gemini analysis request failed";
      return { success: false, error: `Gemini analysis failed: ${message}` };
    }

    // 3. --- Parse Gemini Response ---
    let geminiOutput: any; // Use any for now, as we don't have a strict interface
    let analysisJsonText: string = ""; // Initialize with empty string
    try {
      const response = result.response; // result is now properly typed
      if (!response || !response.text) {
        const finishReason = response?.candidates?.[0]?.finishReason ?? 'Unknown';
        console.error(`[Analysis ${callId}] Gemini response blocked or invalid. Reason: ${finishReason}`);
        // Attempt to extract partial text if available for debugging
        const partialText = response?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (partialText) console.error(`[Analysis ${callId}] Partial Text: ${partialText.substring(0, 500)}...`);
        return { success: false, error: `Gemini response blocked or invalid. Reason: ${finishReason}` };
      }
      analysisJsonText = response.text(); // Now properly assigned

      // Clean the response: Trim whitespace and remove potential trailing markdown backticks
      let cleanedJsonText = analysisJsonText.trim();
      if (cleanedJsonText.endsWith('```')) {
        cleanedJsonText = cleanedJsonText.slice(0, -3).trim();
      }

      if (!cleanedJsonText.startsWith('{') || !cleanedJsonText.endsWith('}')) {
        console.error(`[Analysis ${callId}] Received invalid JSON format from Gemini (after cleaning):`, cleanedJsonText.substring(0, 1000)); // Log more context
        throw new Error("Received invalid JSON format from Gemini (doesn't start/end with braces even after cleaning).");
      }
      geminiOutput = JSON.parse(cleanedJsonText); // Parse the cleaned response object

      // Basic validation for required fields including STAR method
      if (!geminiOutput.analysis_report ||
          typeof geminiOutput.analysis_report.clarity?.score !== 'number' ||
          typeof geminiOutput.analysis_report.clarity?.rationale !== 'string' ||
          typeof geminiOutput.analysis_report.star_method?.score !== 'number') {
        console.error(`[Analysis ${callId}] Gemini response missing required fields (e.g., clarity, relevance, star_method):`, geminiOutput);
        throw new Error("Gemini response missing required fields or incorrect format.");
      }

      console.log(`[Analysis ${callId}] ✅ Successfully received and parsed Gemini analysis including STAR method evaluation.`);

    } catch (error: any) {
      // Catch timeout error specifically
      if (error instanceof AnalysisTimeoutError) {
        console.warn(`[Analysis ${callId}] Gemini call timed out.`);
        return { success: false, error: error.message }; // Propagate timeout error message
      }
      // Catch other Gemini/parsing errors
      console.error(`[Analysis ${callId}] Error during Gemini call or parsing:`, error);
      // Log the raw text if parsing failed and we have it
      if (error instanceof SyntaxError && analysisJsonText) {
        console.error(`[Analysis ${callId}] Failed to parse JSON. Raw text was: ${analysisJsonText.substring(0, 1000)}...`);
      }
      return { success: false, error: `Analysis generation/parsing failed: ${error.message}` };
    }
    // --- End Gemini Call ---

    // 4. --- Save Report to DB ---
    let reportId: string | null = null;
    const llmAnalysisReport = geminiOutput.analysis_report;

    try {
      const newReportId = uuidv4();

      const newReport = {
        id: newReportId,
        timestamp: new Date().toISOString(),
        answers: llmAnalysisReport.answers,
        clarity: llmAnalysisReport.clarity,
        relevance: llmAnalysisReport.relevance,
        depth: llmAnalysisReport.depth,
        commStyle: llmAnalysisReport.comm_style,
        culturalFit: llmAnalysisReport.cultural_fit,
        attentionToDetail: llmAnalysisReport.attention_to_detail,
        languageProficiency: llmAnalysisReport.language_proficiency,
        starMethod: llmAnalysisReport.star_method // Add STAR method field
      } as any; // Cast to any if TS schema typing differs

      await db.transaction(async (tx) => {
        await tx.insert(reports).values(newReport);
        await tx.update(calls).set({ reportId: newReportId }).where(eq(calls.id, callId));
      });

      reportId = newReportId;
      console.log(`[Analysis ${callId}] ✅ Successfully saved analysis report with STAR method evaluation to database.`);

      const analysisResult: CallReportData = {
        // @ts-ignore adapt CallReportData later
        ...llmAnalysisReport,
        id: newReportId,
        timestamp: newReport.timestamp
      } as any;

      return { success: true, report: analysisResult, reportId: reportId };

    } catch (dbError: any) {
      console.error(`[Analysis ${callId}] Failed DB transaction for saving report:`, dbError);
      return { success: false, error: `Failed to save analysis report: ${dbError.message}` };
    }
    // --- End Save Report ---

  } catch (error: any) {
    console.error(`[Analysis ${callId}] Unexpected error in performAnalysisAndSaveReport:`, error);
    return { success: false, error: `Unexpected analysis error: ${error.message}` };
  }
} 