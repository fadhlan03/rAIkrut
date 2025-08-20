export interface ProbabilityOfClosing {
  overall_score: number;
  sub_scores: {
    clarity_of_pitch: number;
    handling_objections: number;
    engagement: number;
    qualifying_questions: number;
    call_objective: number;
    closing_attempt: number;
  };
  explanation: string;
}

export interface ProductRecommendation {
  product: string;
  reason: string;
  pitch_suggestion: string;
}

export interface Improvement {
  issue: string;
  suggestion: string;
}

export interface Feedback {
  strengths: string[];
  improvements: Improvement[];
  actionable_tips: string[];
}

export interface Analytics {
  talk_to_listen_ratio: string;
  sentiment: string;
  key_moments: string[];
}

export interface TranscriptSegment {
  speaker: 'User' | 'AI';
  text: string;
  timestamp: number;
}

export interface CallReportData {
  probability_of_closing: ProbabilityOfClosing;
  product_recommendations: ProductRecommendation[];
  feedback: Feedback;
  analytics: Analytics;
  probability_subscore_data?: { skill: string; score: number }[] | null;
  follow_up_date?: string | null;
} 