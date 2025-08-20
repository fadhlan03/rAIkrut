import { NextResponse } from 'next/server';
import { db } from '@/lib/db-client';
import { 
  jobApplications, 
  jobVacancies, 
  candidates, 
  calls, 
  reports,
  recordings,
  candidateVerifications 
} from '@/db/schema';
import { eq, isNotNull, or } from 'drizzle-orm';

// Generate random verification data for prototype
function generateRandomVerificationData(candidateId: string) {
  const statuses = ['verified', 'processing', 'pending', 'rejected'] as const;
  const status = statuses[Math.floor(Math.random() * statuses.length)];
  
  // Generate scores based on status
  let deepfakeScore = Math.random();
  let faceScore = Math.random();
  let voiceScore = Math.random();
  
  // Adjust scores based on status for realistic data
  if (status === 'verified') {
    deepfakeScore = 0.8 + Math.random() * 0.2; // 0.8-1.0 for verified
    faceScore = 0.8 + Math.random() * 0.2;
    voiceScore = 0.8 + Math.random() * 0.2;
  } else if (status === 'rejected') {
    deepfakeScore = Math.random() * 0.5; // 0.0-0.5 for rejected
    faceScore = Math.random() * 0.6;
    voiceScore = Math.random() * 0.6;
  }
  
  const verificationMetadata = {
    face: {
      details: status === 'verified' 
        ? `Face verification passed with high confidence score: ${(faceScore * 100).toFixed(1)}%`
        : status === 'rejected'
        ? `Face verification failed. Low match confidence: ${(faceScore * 100).toFixed(1)}%`
        : `Face verification in progress...`,
      confidence: faceScore,
      landmarks_detected: Math.random() > 0.3,
      image_quality: Math.random() > 0.2 ? 'good' : 'poor'
    },
    voice: {
      details: status === 'verified'
        ? `Voice verification successful. Speaker recognition confidence: ${(voiceScore * 100).toFixed(1)}%`
        : status === 'rejected' 
        ? `Voice verification failed. Speaker mismatch detected: ${(voiceScore * 100).toFixed(1)}%`
        : `Voice verification processing...`,
      confidence: voiceScore,
      voice_quality: Math.random() > 0.3 ? 'clear' : 'noisy',
      duration_seconds: Math.floor(Math.random() * 10) + 5
    },
    video: {
      details: status === 'verified'
        ? `Video analysis complete. Deepfake detection score: ${(deepfakeScore * 100).toFixed(1)}% (authentic)`
        : status === 'rejected'
        ? `Video analysis detected potential manipulation. Deepfake score: ${((1 - deepfakeScore) * 100).toFixed(1)}% (suspicious)`
        : `Video analysis in progress...`,
      deepfake_probability: 1 - deepfakeScore,
      frame_quality: Math.random() > 0.2 ? 'high' : 'medium',
      frames_analyzed: Math.floor(Math.random() * 50) + 20
    }
  };

  return {
    candidateId,
    verificationStatus: status,
    deepfakeScore: (Math.round(deepfakeScore * 100) / 100).toString(),
    faceVerificationScore: (Math.round(faceScore * 100) / 100).toString(),
    voiceVerificationScore: (Math.round(voiceScore * 100) / 100).toString(),
    verificationMetadata,
    verifiedAt: status === 'verified' ? new Date().toISOString() : null,
    originalVideoUrl: `https://storage.example.com/verification/${candidateId}/original-video.mp4`,
    originalPhotoUrl: `https://storage.example.com/verification/${candidateId}/original-photo.jpg`,
    originalAudioUrl: `https://storage.example.com/verification/${candidateId}/original-audio.wav`,
    testVideoUrl: `https://storage.example.com/verification/${candidateId}/test-video.mp4`,
    testPhotoUrl: `https://storage.example.com/verification/${candidateId}/test-photo.jpg`,
    testAudioUrl: `https://storage.example.com/verification/${candidateId}/test-audio.wav`,
    originalMediaUploadedAt: new Date(Date.now() - Math.random() * 86400000 * 7).toISOString(), // Random date within last week
    testMediaUploadedAt: new Date(Date.now() - Math.random() * 86400000 * 3).toISOString(), // Random date within last 3 days
  };
}

export async function GET() {
  try {
    // Fetch applications that have calls history with their related data
    const interviewData = await db
      .select({
        // Application data
        applicationId: jobApplications.id,
        applicationStatus: jobApplications.status,
        applicationDate: jobApplications.createdAt,
        // Job data
        jobId: jobVacancies.id,
        jobTitle: jobVacancies.title,
        // Candidate data
        candidateId: candidates.id,
        candidateName: candidates.fullName,
        candidateEmail: candidates.email,
        // Call data
        callId: calls.id,
        callTimestamp: calls.timestamp,
        callResult: calls.result,
        callNotes: calls.notes, // Add notes field from calls table
        conversationId: calls.conversationId, // ElevenLabs conversation ID
        // Report data
        reportId: reports.id,
        reportAnswers: reports.answers,
        reportClarity: reports.clarity,
        reportRelevance: reports.relevance,
        reportDepth: reports.depth,
        reportCommStyle: reports.commStyle,
        reportCulturalFit: reports.culturalFit,
        reportAttentionToDetail: reports.attentionToDetail,
        reportLanguageProficiency: reports.languageProficiency,
        reportStarMethod: reports.starMethod, // Add STAR method field
        // Recording data
        recordingId: recordings.id,
        recordingTranscript: recordings.transcript,
        recordingUri: recordings.uri,
        recordingDuration: recordings.duration,
        // Verification data
        verificationId: candidateVerifications.id,
        verificationStatus: candidateVerifications.verificationStatus,
        deepfakeScore: candidateVerifications.deepfakeScore,
        faceVerificationScore: candidateVerifications.faceVerificationScore,
        voiceVerificationScore: candidateVerifications.voiceVerificationScore,
        verificationMetadata: candidateVerifications.verificationMetadata,
        verifiedAt: candidateVerifications.verifiedAt,
      })
      .from(jobApplications)
      .innerJoin(jobVacancies, eq(jobApplications.jobId, jobVacancies.id))
      .innerJoin(candidates, eq(jobApplications.candidateId, candidates.id))
      .innerJoin(calls, eq(calls.applicationId, jobApplications.id))
      .leftJoin(reports, eq(calls.reportId, reports.id))
      .leftJoin(recordings, eq(calls.recordingId, recordings.id))
      .leftJoin(candidateVerifications, eq(candidates.id, candidateVerifications.candidateId))
      .where(or(isNotNull(reports.id), isNotNull(calls.conversationId)))
      .orderBy(calls.timestamp);

    // Generate verification data for candidates that don't have it
    const candidatesNeedingVerification = interviewData
      .filter(row => !row.verificationId)
      .map(row => row.candidateId);

    const uniqueCandidatesNeedingVerification = [...new Set(candidatesNeedingVerification)];

    // Generate and insert verification data for candidates that need it
    const newVerifications = new Map();
    for (const candidateId of uniqueCandidatesNeedingVerification) {
      const verificationData = generateRandomVerificationData(candidateId);
      
      try {
        const [insertedVerification] = await db
          .insert(candidateVerifications)
          .values(verificationData)
          .returning({
            id: candidateVerifications.id,
            candidateId: candidateVerifications.candidateId,
            verificationStatus: candidateVerifications.verificationStatus,
            deepfakeScore: candidateVerifications.deepfakeScore,
            faceVerificationScore: candidateVerifications.faceVerificationScore,
            voiceVerificationScore: candidateVerifications.voiceVerificationScore,
            verificationMetadata: candidateVerifications.verificationMetadata,
            verifiedAt: candidateVerifications.verifiedAt,
          });
        
        newVerifications.set(candidateId, insertedVerification);
      } catch (error) {
        console.error(`Failed to insert verification for candidate ${candidateId}:`, error);
      }
    }

    // Transform the data to include calculated average scores and verification data
    const formattedData = interviewData.map(row => {
      let averageScore = null;
      let individualScores = null;

      if (row.reportClarity && row.reportRelevance && row.reportDepth && 
          row.reportCommStyle && row.reportCulturalFit && row.reportAttentionToDetail && 
          row.reportLanguageProficiency) {
        
        // Extract scores from the report objects (starMethod is optional for backward compatibility)
        const baseScores = [
          row.reportClarity,
          row.reportRelevance,
          row.reportDepth,
          row.reportCommStyle,
          row.reportCulturalFit,
          row.reportAttentionToDetail,
          row.reportLanguageProficiency
        ].map(scoreObj => {
          if (typeof scoreObj === 'object' && scoreObj !== null && 'score' in scoreObj) {
            return Number(scoreObj.score);
          }
          return 0;
        });

        // Handle starMethod separately (might be null for older records)
        let starMethodScore = 0;
        if (row.reportStarMethod && typeof row.reportStarMethod === 'object' && 'score' in row.reportStarMethod) {
          starMethodScore = Number(row.reportStarMethod.score);
        }

        // Calculate average using only base scores if starMethod is missing, or include it if available
        const scoresForAverage = row.reportStarMethod ? [...baseScores, starMethodScore] : baseScores;
        averageScore = scoresForAverage.reduce((sum, score) => sum + score, 0) / scoresForAverage.length;

        // Individual scores with labels and rationale
        individualScores = {
          clarity: { 
            score: baseScores[0], 
            rationale: (row.reportClarity as any)?.rationale || null 
          },
          relevance: { 
            score: baseScores[1], 
            rationale: (row.reportRelevance as any)?.rationale || null 
          },
          depth: { 
            score: baseScores[2], 
            rationale: (row.reportDepth as any)?.rationale || null 
          },
          communication_style: { 
            score: baseScores[3], 
            rationale: (row.reportCommStyle as any)?.rationale || null 
          },
          cultural_fit: { 
            score: baseScores[4], 
            rationale: (row.reportCulturalFit as any)?.rationale || null 
          },
          attention_to_detail: { 
            score: baseScores[5], 
            rationale: (row.reportAttentionToDetail as any)?.rationale || null 
          },
          language_proficiency: { 
            score: baseScores[6], 
            rationale: (row.reportLanguageProficiency as any)?.rationale || null 
          },
          star_method: { 
            score: starMethodScore, 
            rationale: row.reportStarMethod ? ((row.reportStarMethod as any)?.rationale || null) : "Not evaluated (legacy record)"
          }
        };
      }

      // Use existing verification data or newly generated data
      const verification = row.verificationId ? {
        verificationId: row.verificationId,
        verificationStatus: row.verificationStatus,
        deepfakeScore: row.deepfakeScore ? Number(row.deepfakeScore) : null,
        faceVerificationScore: row.faceVerificationScore ? Number(row.faceVerificationScore) : null,
        voiceVerificationScore: row.voiceVerificationScore ? Number(row.voiceVerificationScore) : null,
        verificationMetadata: row.verificationMetadata,
        verifiedAt: row.verifiedAt,
        hasVerification: true
      } : newVerifications.has(row.candidateId) ? {
        verificationId: newVerifications.get(row.candidateId).id,
        verificationStatus: newVerifications.get(row.candidateId).verificationStatus,
        deepfakeScore: newVerifications.get(row.candidateId).deepfakeScore ? Number(newVerifications.get(row.candidateId).deepfakeScore) : null,
        faceVerificationScore: newVerifications.get(row.candidateId).faceVerificationScore ? Number(newVerifications.get(row.candidateId).faceVerificationScore) : null,
        voiceVerificationScore: newVerifications.get(row.candidateId).voiceVerificationScore ? Number(newVerifications.get(row.candidateId).voiceVerificationScore) : null,
        verificationMetadata: newVerifications.get(row.candidateId).verificationMetadata,
        verifiedAt: newVerifications.get(row.candidateId).verifiedAt,
        hasVerification: true
      } : {
        verificationId: null,
        verificationStatus: null,
        deepfakeScore: null,
        faceVerificationScore: null,
        voiceVerificationScore: null,
        verificationMetadata: null,
        verifiedAt: null,
        hasVerification: false
      };

      return {
        applicationId: row.applicationId,
        jobTitle: row.jobTitle,
        candidateName: row.candidateName,
        candidateEmail: row.candidateEmail,
        applicationStatus: row.applicationStatus,
        applicationDate: row.applicationDate,
        callId: row.callId,
        callTimestamp: row.callTimestamp,
        callResult: row.callResult,
        callNotes: row.callNotes, // Add callNotes to the returned data
        conversationId: row.conversationId, // Add conversationId to the returned data
        reportId: row.reportId,
        reportAnswers: row.reportAnswers,
        averageScore: averageScore ? Math.round(averageScore * 100) / 100 : null,
        individualScores,
        hasReport: !!row.reportId,
        // Recording data
        recordingId: row.recordingId,
        recordingTranscript: row.recordingTranscript,
        recordingUri: row.recordingUri,
        recordingDuration: row.recordingDuration,
        // Verification data (existing or newly generated)
        ...verification
      };
    });

    return NextResponse.json(formattedData);
  } catch (error) {
    console.error('Error fetching interview data:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 