"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  LoaderCircle,
  User,
  Briefcase,
  Calendar,
  Mail,
  Phone,
  GraduationCap,
  Building,
  ArrowLeft,
  AlertCircle,
  CheckCircle,
  X
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { getCookie } from "cookies-next";
import { MANDATORY_QUESTIONS } from "@/config/interview-questions";

interface JobApplicationData {
  applicationId: string;
  job: {
    id: string;
    title: string;
    description: string;
    job_desc: any;
    requirements: any;
  };
  candidate: {
    id: string;
    fullName: string;
    email: string;
    phone: string;
    birthdate: string;
    jobInterest: any;
    education: any;
    workExperience: any;
    orgExperience: any;
    summary: string;
  };
  resume: {
    id: string;
    fileName: string;
    fileUrl: string;
    parsedContent: any;
  };
  status: string;
  createdAt: string;
}

interface VerificationStatus {
  isComplete: boolean;
  hasVideo: boolean;
  hasPhoto: boolean;
  hasAudio: boolean;
  error?: string;
}

function calculateAge(birthDate: string | null): number | string {
  if (!birthDate) return 'N/A';
  const birth = new Date(birthDate);
  if (isNaN(birth.getTime())) return 'Invalid Date';

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age >= 0 ? age : 'Invalid Date';
}

function renderEducationData(education: any) {
  if (!education) return null;

  if (Array.isArray(education)) {
    if (education.length === 0) return null;
    return (
      <ul className="list-disc list-outside space-y-2 pl-5">
        {education.map((item, index) => (
          <li key={index} className="text-sm">
            {renderSingleEducation(item)}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="text-sm">
      {renderSingleEducation(education)}
    </div>
  );
}

function renderSingleEducation(edu: any) {
  if (typeof edu === 'string') return edu;
  if (typeof edu !== 'object') return String(edu);

  const level = edu.level || edu.degree || '';
  const major = edu.major || edu.field || '';
  const institution = edu.institution || edu.school || '';

  let result = '';
  if (level) result += level;
  if (major && level) result += ` in ${major}`;
  else if (major) result += major;
  if (institution) result += ` - ${institution}`;

  return result || JSON.stringify(edu);
}

function renderWorkExperienceData(workExp: any) {
  if (!workExp) return null;

  if (Array.isArray(workExp)) {
    if (workExp.length === 0) return null;
    return (
      <ul className="list-disc list-outside space-y-2 pl-5">
        {workExp.map((item, index) => (
          <li key={index} className="text-sm">
            {renderSingleWorkExperience(item)}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="text-sm">
      {renderSingleWorkExperience(workExp)}
    </div>
  );
}

function renderSingleWorkExperience(work: any) {
  if (typeof work === 'string') return work;
  if (typeof work !== 'object') return String(work);

  const position = work.position || work.title || work.role || '';
  const company = work.company || work.organization || '';
  const startDate = work.start_date || work.startDate || '';
  const endDate = work.end_date || work.endDate || '';

  let result = '';
  if (position) result += position;
  if (company && position) result += ` at ${company}`;
  else if (company) result += company;

  if (startDate || endDate) {
    result += ' (';
    if (startDate) result += startDate;
    if (startDate && endDate) result += ' - ';
    if (endDate) result += endDate;
    result += ')';
  }

  return result || JSON.stringify(work);
}

function renderOrganizationExperienceData(orgExp: any) {
  if (!orgExp) return null;

  if (Array.isArray(orgExp)) {
    if (orgExp.length === 0) return null;
    return (
      <ul className="list-disc list-outside space-y-2 pl-5">
        {orgExp.map((item, index) => (
          <li key={index} className="text-sm">
            {renderSingleOrganizationExperience(item)}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="text-sm">
      {renderSingleOrganizationExperience(orgExp)}
    </div>
  );
}

function renderSingleOrganizationExperience(org: any) {
  if (typeof org === 'string') return org;
  if (typeof org !== 'object') return String(org);

  const role = org.role || org.position || org.title || '';
  const organization = org.organization_name || org.organization || org.company || '';
  const startDate = org.start_date || org.startDate || '';
  const endDate = org.end_date || org.endDate || '';

  let result = '';
  if (role) result += role;
  if (organization && role) result += ` at ${organization}`;
  else if (organization) result += organization;

  if (startDate || endDate) {
    result += ' (';
    if (startDate) result += startDate;
    if (startDate && endDate) result += ' - ';
    if (endDate) result += endDate;
    result += ')';
  }

  return result || JSON.stringify(org);
}

function renderJsonData(data: any) {
  if (!data) return null;

  if (Array.isArray(data)) {
    if (data.length === 0) return null;
    return (
      <ul className="list-disc list-outside space-y-1 pl-5">
        {data.map((item, index) => (
          <li key={index} className="text-sm">
            {typeof item === 'object' ? JSON.stringify(item, null, 2) : String(item)}
          </li>
        ))}
      </ul>
    );
  }

  if (typeof data === 'object') {
    const entries = Object.entries(data);
    if (entries.length === 0) return null;
    return (
      <ul className="list-disc list-outside space-y-1 pl-5">
        {entries.map(([key, value]) => (
          <li key={key} className="text-sm">
            <span className="font-medium">{key}:</span>{' '}
            {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
          </li>
        ))}
      </ul>
    );
  }

  return <p className="text-sm">{String(data)}</p>;
}

function hasContent(data: any): boolean {
  if (!data) return false;
  if (Array.isArray(data)) return data.length > 0;
  if (typeof data === 'object') return Object.keys(data).length > 0;
  if (typeof data === 'string') return data.trim().length > 0;
  return true;
}

export default function PreInterviewStart() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [applicationData, setApplicationData] = useState<JobApplicationData | null>(null);
  const [userApplications, setUserApplications] = useState<JobApplicationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [selectedApplicationIndex, setSelectedApplicationIndex] = useState<number>(0);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>({
    isComplete: false,
    hasVideo: false,
    hasPhoto: false,
    hasAudio: false
  });
  const [checkingVerification, setCheckingVerification] = useState(true);

  // Helper function to decode JWT token and extract user email
  const getUserEmailFromToken = (): string | null => {
    try {
      const tokenValue = getCookie('access_token');
      const token = typeof tokenValue === 'string' ? tokenValue : null;

      if (!token) return null;

      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.email || null;
    } catch (error) {
      console.error('Error decoding token:', error);
      return null;
    }
  };

  // Check verification status
  const checkVerificationStatus = async () => {
    try {
      setCheckingVerification(true);
      const response = await fetch('/api/verification/latest');

      if (response.status === 404) {
        // No verification data found - user hasn't submitted any media
        setVerificationStatus({
          isComplete: false,
          hasVideo: false,
          hasPhoto: false,
          hasAudio: false,
          error: 'No verification media found'
        });
        return;
      }

      if (!response.ok) {
        throw new Error(`Failed to check verification status: ${response.statusText}`);
      }

      const verification = await response.json();

      const hasVideo = !!verification.originalVideoUrl;
      const hasPhoto = !!verification.originalPhotoUrl;
      const hasAudio = !!verification.originalAudioUrl;
      const isComplete = hasVideo && hasPhoto && hasAudio;

      setVerificationStatus({
        isComplete,
        hasVideo,
        hasPhoto,
        hasAudio
      });

      console.log('Verification status:', { isComplete, hasVideo, hasPhoto, hasAudio });

    } catch (error) {
      console.error('Error checking verification status:', error);
      setVerificationStatus({
        isComplete: false,
        hasVideo: false,
        hasPhoto: false,
        hasAudio: false,
        error: 'Failed to check verification status'
      });
    } finally {
      setCheckingVerification(false);
    }
  };

  // Fetch user's applications
  const fetchUserApplications = async (userEmail: string) => {
    try {
      const response = await fetch(`/api/applications/user?email=${encodeURIComponent(userEmail)}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch applications: ${response.statusText}`);
      }
      const applications = await response.json();

      // Debug info (remove in production)
      console.log('Fetched applications:', applications.length);
      applications.forEach((app: any, index: number) => {
        console.log(`App ${index + 1}:`, {
          id: app.applicationId,
          jobTitle: app.job.title,
          jobId: app.job.id
        });
      });

      if (applications.length === 0) {
        toast.error("No applications found. Please apply to a job first.");
        setUserApplications([]);
        setApplicationData(null);
        return;
      }

      setUserApplications(applications);
      setApplicationData(applications[0]); // Set first application as default
      setSelectedApplicationIndex(0);

    } catch (error) {
      console.error('Error fetching user applications:', error);
      toast.error("Failed to load your applications. Please try again.");
      setUserApplications([]);
      setApplicationData(null);
    }
  };

  useEffect(() => {
    const loadUserApplications = async () => {
      if (!isAuthenticated) {
        toast.error("Please log in to access pre-interview.");
        router.push('/login');
        return;
      }

      const userEmail = getUserEmailFromToken();
      if (!userEmail) {
        toast.error("Unable to get your email. Please log in again.");
        router.push('/login');
        return;
      }

      // Check verification status and load applications in parallel
      await Promise.all([
        checkVerificationStatus(),
        fetchUserApplications(userEmail)
      ]);

      setLoading(false);
    };

    loadUserApplications();
  }, [isAuthenticated, router]);

  const handleApplicationChange = (index: number) => {
    // Ensure index is within bounds
    const safeIndex = Math.max(0, Math.min(index, userApplications.length - 1));

    // Only update if index actually changed
    if (safeIndex !== selectedApplicationIndex) {
      setSelectedApplicationIndex(safeIndex);
      setApplicationData(userApplications[safeIndex]);

      // Debug info (remove in production)
      console.log(`Navigation: Moving to application ${safeIndex + 1}/${userApplications.length}`);
      console.log('Application ID:', userApplications[safeIndex]?.applicationId);
      console.log('Job Title:', userApplications[safeIndex]?.job?.title);
    }
  };

  const handleStartInterview = () => {
    if (!applicationData) return;

    setStarting(true);

    // Store application data in sessionStorage for the interview
    sessionStorage.setItem('applicationId', applicationData.applicationId);
    sessionStorage.setItem('candidateName', applicationData.candidate.fullName);
    sessionStorage.setItem('candidateEmail', applicationData.candidate.email);
    sessionStorage.setItem('candidatePhone', applicationData.candidate.phone || '');
    sessionStorage.setItem('candidateBirthdate', applicationData.candidate.birthdate || '');
    sessionStorage.setItem('candidateAge', calculateAge(applicationData.candidate.birthdate).toString());
    sessionStorage.setItem('candidateEducation', JSON.stringify(applicationData.candidate.education || {}));
    sessionStorage.setItem('candidateWorkExperience', JSON.stringify(applicationData.candidate.workExperience || {}));
    sessionStorage.setItem('candidateJobInterest', JSON.stringify(applicationData.candidate.jobInterest || {}));
    sessionStorage.setItem('candidateSummary', applicationData.candidate.summary || '');

    sessionStorage.setItem('jobTitle', applicationData.job.title);
    sessionStorage.setItem('jobDescription', applicationData.job.description);
    sessionStorage.setItem('jobRequirements', JSON.stringify(applicationData.job.requirements || {}));
    sessionStorage.setItem('jobDesc', JSON.stringify(applicationData.job.job_desc || {}));

    sessionStorage.setItem('resumeContent', JSON.stringify(applicationData.resume?.parsedContent || {}));

    // Generate system prompt for HR AI
    const systemPrompt = generateSystemPrompt(applicationData);
    sessionStorage.setItem('systemInstruction', systemPrompt);

    // Navigate to the interview page
    router.push(`/pre-interview/${applicationData.applicationId}`);
  };

  const generateSystemPrompt = (data: JobApplicationData): string => {
    const age = calculateAge(data.candidate.birthdate);

    // Generate the questions list with proper variable interpolation
    const questionsText = MANDATORY_QUESTIONS.map((question, index) => {
      // Replace template variable with actual job title
      const interpolatedQuestion = question.replace('${jobTitle}', data.job.title);
      return `${index + 1}. "${interpolatedQuestion}"`;
    }).join('\n');

    return `You are an experienced HR professional conducting a pre-interview call with a job applicant. Your role is to conduct a friendly, professional initial screening in Bahasa Indonesia.

IMPORTANT CONVERSATION GUIDELINES:
- Always greet the candidate warmly by their name: "${data.candidate.fullName}"
- Use natural conversation fillers like "Oh," "Hmm," "Okay," "Baik," "Nah," "Ya" to sound more human and natural
- Be proactive and welcoming in your approach
- Speak in a conversational, friendly tone while maintaining professionalism
- Use Bahasa Indonesia throughout the entire conversation

CANDIDATE INFORMATION:
- Name: ${data.candidate.fullName}
- Age: ${age}
- Email: ${data.candidate.email}
- Phone: ${data.candidate.phone || 'Not provided'}
- Summary: ${data.candidate.summary || 'No summary provided'}

JOB INFORMATION:
- Position: ${data.job.title}
- Job Description: ${data.job.description}
- Requirements: ${JSON.stringify(data.job.requirements, null, 2)}

MANDATORY QUESTIONS TO ASK (in this order):
Please ask these ${MANDATORY_QUESTIONS.length} questions during the interview:

${questionsText}

FOLLOW-UP QUESTIONING:
- After each mandatory question is answered, you MAY ask 1-3 follow-up questions to clarify or deepen the candidate's response
- Only ask follow-ups when the initial answer lacks detail, seems unclear, or requires clarification
- Keep follow-ups focused and relevant to the original question
- Example follow-ups: "Can you give me a specific example?"
- Move to the next mandatory question once you have sufficient information

INTERVIEW STRUCTURE:
1. Start with a warm welcome: "Halo ${data.candidate.fullName}! Selamat pagi/siang. Terima kasih sudah meluangkan waktu untuk wawancara pra-seleksi ini. Bagaimana kabar Anda hari ini?"
2. Briefly explain the interview format and duration (10-15 minutes)
3. Ask the ${MANDATORY_QUESTIONS.length} mandatory questions above, allowing natural conversation flow
4. Listen actively and ask follow-up questions when appropriate
5. Explain next steps in the recruitment process
6. Allow time for candidate's questions
7. End on a positive, encouraging note
8. After the first question, remind the candidate to use the Notes feature to type their answers for verification purposes

CONVERSATION STYLE:
- Use natural speech patterns: "Hmm, menarik sekali..." "Oh, begitu ya..." "Okay, baik..."
- Show genuine interest in their responses
- Be encouraging and supportive
- Make them feel comfortable and valued
- Keep responses conversational, not robotic

Remember: This is their first impression of the company, so make it positive and welcoming while gathering essential information about their suitability for the role.`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <LoaderCircle className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-lg text-muted-foreground">Loading application data...</p>
        </div>
      </div>
    );
  }

  if (!applicationData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-muted-foreground mb-4">No application data available</p>
          <Button onClick={() => fetchUserApplications(getUserEmailFromToken() || '')}>Try Again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto">
        {/* Back Button */}
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/apply')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Job Applications
          </Button>
        </div>

        <div className="text-center my-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Pre-Interview Call</h1>
          <p className="text-lg text-muted-foreground">Review Your Information before Starting the Interview</p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col items-center gap-4 mb-8">

          {/* Verification Status Alert */}
          {!checkingVerification && !verificationStatus.isComplete && (
            <div className="w-full max-w-2xl mb-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="font-medium text-amber-800 mb-2">Identity Verification Required</h3>
                    <p className="text-sm text-amber-700 mb-3">
                      You need to complete identity verification before starting the pre-interview. Please submit the following media:
                    </p>
                    <div className="space-y-1 mb-4">
                      <div className="flex items-center gap-2 text-sm">
                        {verificationStatus.hasVideo ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <X className="h-4 w-4 text-red-500" />
                        )}
                        <span className={verificationStatus.hasVideo ? "text-green-700" : "text-red-700"}>
                          Video recording
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        {verificationStatus.hasPhoto ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <X className="h-4 w-4 text-red-500" />
                        )}
                        <span className={verificationStatus.hasPhoto ? "text-green-700" : "text-red-700"}>
                          Photo capture
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        {verificationStatus.hasAudio ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <X className="h-4 w-4 text-red-500" />
                        )}
                        <span className={verificationStatus.hasAudio ? "text-green-700" : "text-red-700"}>
                          Audio recording
                        </span>
                      </div>
                    </div>
                    <Button
                      onClick={() => router.push('/verify')}
                      size="sm"
                      className="bg-amber-600 hover:bg-amber-700 text-white"
                    >
                      Complete Verification →
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {checkingVerification && (
            <div className="w-full max-w-2xl mb-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <LoaderCircle className="h-5 w-5 text-blue-600 animate-spin" />
                  <span className="text-blue-800">Checking verification status...</span>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-center items-center gap-4 w-full max-w-2xl">
            {userApplications.length > 1 ? (
              <Button
                onClick={() => handleApplicationChange(selectedApplicationIndex - 1)}
                disabled={starting || selectedApplicationIndex === 0}
                variant="outline"
                className="px-6"
              >
                ← Previous Application
              </Button>
            ) : (
              <div className="w-[200px]"></div>
            )}

            <Button
              onClick={handleStartInterview}
              disabled={starting || !verificationStatus.isComplete || checkingVerification}
              size="lg"
              className="px-8 whitespace-nowrap"
              title={!verificationStatus.isComplete ? "Complete identity verification first" : ""}
            >
              {starting ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin mr-2" />
                  Starting Interview...
                </>
              ) : (
                'Start Pre-Interview Call'
              )}
            </Button>

            {userApplications.length > 1 ? (
              <Button
                onClick={() => handleApplicationChange(selectedApplicationIndex + 1)}
                disabled={starting || selectedApplicationIndex === userApplications.length - 1}
                variant="outline"
                className="px-6"
              >
                Next Application →
              </Button>
            ) : (
              <div className="w-[200px]"></div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-4">
          {/* Candidate Information */}
          {loading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <div className="text-center">
                  <LoaderCircle className="h-8 w-8 animate-spin mx-auto mb-4" />
                  <p className="text-sm text-muted-foreground">Loading new application...</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Candidate Information
                </CardTitle>
                {/* <CardDescription>Details about the job applicant</CardDescription> */}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback>
                      {applicationData.candidate.fullName.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold text-lg">{applicationData.candidate.fullName}</h3>
                    <Badge variant="outline">{applicationData.status}</Badge>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{applicationData.candidate.email}</span>
                  </div>
                  {applicationData.candidate.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{applicationData.candidate.phone}</span>
                    </div>
                  )}
                  {applicationData.candidate.birthdate && (
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>Age: {calculateAge(applicationData.candidate.birthdate)}</span>
                    </div>
                  )}
                </div>

                {applicationData.candidate.summary && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="font-medium text-sm text-muted-foreground mb-1">Summary</h4>
                      <p className="text-sm">{applicationData.candidate.summary}</p>
                    </div>
                  </>
                )}

                {hasContent(applicationData.candidate.education) && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="font-medium text-sm text-muted-foreground mb-1 flex items-center gap-1">
                        <GraduationCap className="h-3 w-3" />
                        Education
                      </h4>
                      {renderEducationData(applicationData.candidate.education)}
                    </div>
                  </>
                )}

                {hasContent(applicationData.candidate.workExperience) && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="font-medium text-sm text-muted-foreground mb-1 flex items-center gap-1">
                        <Building className="h-3 w-3" />
                        Work Experience
                      </h4>
                      {renderWorkExperienceData(applicationData.candidate.workExperience)}
                    </div>
                  </>
                )}

                {hasContent(applicationData.candidate.orgExperience) && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="font-medium text-sm text-muted-foreground mb-1 flex items-center gap-1">
                        <Building className="h-3 w-3" />
                        Organization Experience
                      </h4>
                      {renderOrganizationExperienceData(applicationData.candidate.orgExperience)}
                    </div>
                  </>
                )}

                {hasContent(applicationData.candidate.jobInterest) && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="font-medium text-sm text-muted-foreground mb-1 flex items-center gap-1">
                        <Briefcase className="h-3 w-3" />
                        Job Interest
                      </h4>
                      {renderJsonData(applicationData.candidate.jobInterest)}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Job Information */}
          {loading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <div className="text-center">
                  <LoaderCircle className="h-8 w-8 animate-spin mx-auto mb-4" />
                  <p className="text-sm text-muted-foreground">Loading new application...</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5" />
                  Job Information
                </CardTitle>
                {/* <CardDescription>Position they're applying for</CardDescription> */}
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold text-lg">{applicationData.job.title}</h3>
                  <p className="text-sm text-muted-foreground">Job ID: {applicationData.job.id}</p>
                </div>

                <Separator />

                <div>
                  <h4 className="font-medium text-sm text-muted-foreground mb-1">Description</h4>
                  <p className="text-sm">{applicationData.job.description}</p>
                </div>

                {hasContent(applicationData.job.requirements) && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="font-medium text-sm text-muted-foreground mb-1">Requirements</h4>
                      {renderJsonData(applicationData.job.requirements)}
                    </div>
                  </>
                )}

                {applicationData.resume && applicationData.resume.fileName && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="font-medium text-sm text-muted-foreground mb-1">Resume</h4>
                      {applicationData.resume.fileUrl ? (
                        <a
                          href={applicationData.resume.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:text-primary/80 underline"
                        >
                          {applicationData.resume.fileName}
                        </a>
                      ) : (
                        <p className="text-sm">{applicationData.resume.fileName}</p>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}



        </div>

      </div>
    </div>
  );
} 