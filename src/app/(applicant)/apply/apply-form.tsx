'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Plus, X } from 'lucide-react';
import { EducationEntry, WorkExperienceEntry, OrgExperienceEntry } from '@/types/database';
import { ResumeAssessment, RequirementCheckItem } from '@/types/resume-assessment';

export function ApplyForm() {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log('Legacy manual form submitted');
  };
  return (
    <Card className="w-full">
      <CardHeader><CardTitle>Apply by Filling Form (Legacy)</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6" id="legacyManualApplyFormId">
          <div><Label htmlFor="legacyFullName">Full Name</Label><Input id="legacyFullName" name="fullName" type="text" placeholder="Enter your full name" required /></div>
          <div><Label htmlFor="legacyEmail">Email Address</Label><Input id="legacyEmail" name="email" type="email" placeholder="Enter your email address" required /></div>
          <div><Label htmlFor="legacyPhone">Phone Number (Optional)</Label><Input id="legacyPhone" name="phone" type="tel" placeholder="Enter your phone number" /></div>
          <div><Label htmlFor="legacyLinkedin">LinkedIn Profile URL (Optional)</Label><Input id="legacyLinkedin" name="linkedin" type="url" placeholder="https://linkedin.com/in/yourprofile" /></div>
          <div><Label htmlFor="legacyPortfolio">Portfolio/Website URL (Optional)</Label><Input id="legacyPortfolio" name="portfolio" type="url" placeholder="https://yourportfolio.com" /></div>
          <div><Label htmlFor="legacyCoverLetter">Cover Letter (Optional)</Label><Textarea id="legacyCoverLetter" name="coverLetter" placeholder="Tell us why you're a good fit for this role..." className="min-h-[150px]" /></div>
        </form>
      </CardContent>
      <CardFooter><Button type="submit" form="legacyManualApplyFormId">Submit Application (Legacy)</Button></CardFooter>
    </Card>
  );
}

interface ApplyFormWithIdProps {
  jobId: string;
  jobTitle: string;
  jobRequirements: string[];
  referralName: string;
  referralEmail: string;
  referralPosition: string;
  referralDept: string;
  onReferralChange: {
    setReferralName: (value: string) => void;
    setReferralEmail: (value: string) => void;
    setReferralPosition: (value: string) => void;
    setReferralDept: (value: string) => void;
  };
}

export function ApplyFormWithId({ 
  jobId, 
  jobTitle, 
  jobRequirements,
  referralName,
  referralEmail,
  referralPosition,
  referralDept,
  onReferralChange 
}: ApplyFormWithIdProps) {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [jobInterests, setJobInterests] = useState(['']);
  const [educationHistory, setEducationHistory] = useState<EducationEntry[]>([{ level: '', institution: '', major: '' }]);
  const [workExperienceHistory, setWorkExperienceHistory] = useState<WorkExperienceEntry[]>([{ company: '', position: '', start_date: '', end_date: '' }]);
  const [organizationExperienceHistory, setOrganizationExperienceHistory] = useState<OrgExperienceEntry[]>([{ organization_name: '', role: '', start_date: '', end_date: '' }]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatusMessage, setSubmitStatusMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatusMessage(null);
    setSubmitError(null);

    const candidateDetailsPayload = {
      fullName,
      email,
      birthdate: dateOfBirth,
      phone,
      jobInterest: jobInterests.filter(interest => interest.trim() !== ''),
      education: educationHistory.filter(edu => edu.institution.trim() !== '' || edu.level.trim() !== '' || edu.major.trim() !== ''),
      workExperience: workExperienceHistory.filter(work => work.company.trim() !== '' || work.position.trim() !== ''),
      orgExperience: organizationExperienceHistory.filter(org => org.organization_name.trim() !== '' || org.role.trim() !== ''),
    };

    console.log('Submitting candidate details (form):', candidateDetailsPayload);

    try {
      // Step 1: Save candidate details to DB
      const candidateResponse = await fetch('/api/candidates/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(candidateDetailsPayload),
      });
      const candidateResult = await candidateResponse.json();
      if (!candidateResponse.ok) {
        throw new Error(candidateResult.error || `Failed to save candidate data: ${candidateResponse.status}`);
      }
      console.log('Candidate data saved:', candidateResult);
      const candidateId = candidateResult.candidate?.id;
      const createdFullName = candidateResult.candidate?.fullName || fullName;
      const createdEmail = candidateResult.candidate?.email || email;

      if (!candidateId) {
        throw new Error('Candidate ID not found after saving data.');
      }

      // Step 2: Send form data for assessment using the unified /api/applications/review endpoint
      setSubmitStatusMessage('Candidate data saved. Now assessing information...');
      const reviewPayload = {
        candidateData: candidateDetailsPayload,
        jobId: jobId,
        jobTitle: jobTitle,
        jobDescription: undefined, // Or pass full job description from parent if available and desired
        jobRequirements: jobRequirements 
      };
      console.log('Calling /api/applications/review with form data and requirements:', reviewPayload);
      const assessmentResponse = await fetch('/api/applications/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reviewPayload),
      });

      const assessmentResultJson = await assessmentResponse.json();
      if (!assessmentResponse.ok) {
        let errorMsg = 'Form data assessment failed via /review.';
        if (assessmentResultJson.error) {
          errorMsg += ` Error: ${assessmentResultJson.error}`;
          if (assessmentResultJson.details) errorMsg += ` Details: ${assessmentResultJson.details}`;
        } else {
          errorMsg += ` Status: ${assessmentResponse.status}`;
        }
        throw new Error(errorMsg);
      }
      const assessmentResult: ResumeAssessment = assessmentResultJson;
      console.log('Form data assessment successful via /review:', assessmentResult);

      // Step 3: Submit application with assessment to DB
      setSubmitStatusMessage('Assessment complete. Saving application...');
      const applicationPayload = {
        jobId: jobId,
        candidateId: candidateId,
        applicantFullName: createdFullName,
        applicantEmail: createdEmail,
        applicantPhone: phone,
        referralName,
        referralEmail,
        referralPosition,
        referralDept,
        assessmentResult: assessmentResult, 
      };
      console.log('Calling /api/applications/submit with form assessment:', applicationPayload);
      const saveApplicationResponse = await fetch('/api/applications/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(applicationPayload),
      });
      const saveApplicationResult = await saveApplicationResponse.json();
      if (!saveApplicationResponse.ok) {
        throw new Error(saveApplicationResult.error || `Failed to save final application: ${saveApplicationResponse.status}`);
      }
      console.log('Application (from form) saved to DB successfully:', saveApplicationResult);

      // Step 4: Store result in localStorage and redirect
      setSubmitStatusMessage('Application submitted successfully! Redirecting...');
      localStorage.setItem(`assessmentResult-${jobId}`, JSON.stringify(assessmentResult));
      localStorage.setItem(`assessmentJobTitle-${jobId}`, jobTitle);
      
      router.push(`/apply/${jobId}/result`);

    } catch (error: any) {
      console.error('Full form submission process error:', error);
      setSubmitError(error.message || 'An unexpected error occurred during the submission process.');
      setSubmitStatusMessage(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const addJobInterest = () => setJobInterests([...jobInterests, '']);
  const removeJobInterest = (index: number) => setJobInterests(jobInterests.filter((_, i) => i !== index));
  const handleJobInterestChange = (index: number, value: string) => {
    const updatedInterests = [...jobInterests];
    updatedInterests[index] = value;
    setJobInterests(updatedInterests);
  };

  const addEducationEntry = () => setEducationHistory([...educationHistory, { level: '', institution: '', major: '' }]);
  const removeEducationEntry = (index: number) => { if (educationHistory.length > 1) setEducationHistory(educationHistory.filter((_, i) => i !== index)); };
  const handleEducationChange = (index: number, field: keyof EducationEntry, value: string) => {
    const updatedHistory = [...educationHistory];
    updatedHistory[index] = { ...updatedHistory[index], [field]: value };
    setEducationHistory(updatedHistory);
  };

  const addWorkExperienceEntry = () => setWorkExperienceHistory([...workExperienceHistory, { company: '', position: '', start_date: '', end_date: '' }]);
  const removeWorkExperienceEntry = (index: number) => { if (workExperienceHistory.length > 1) setWorkExperienceHistory(workExperienceHistory.filter((_, i) => i !== index)); };
  const handleWorkExperienceChange = (index: number, field: keyof WorkExperienceEntry, value: string) => {
    const updatedHistory = [...workExperienceHistory];
    updatedHistory[index] = { ...updatedHistory[index], [field]: value };
    setWorkExperienceHistory(updatedHistory);
  };

  const addOrganizationExperienceEntry = () => setOrganizationExperienceHistory([...organizationExperienceHistory, { organization_name: '', role: '', start_date: '', end_date: '' }]);
  const removeOrganizationExperienceEntry = (index: number) => { if (organizationExperienceHistory.length > 1) setOrganizationExperienceHistory(organizationExperienceHistory.filter((_, i) => i !== index)); };
  const handleOrganizationExperienceChange = (index: number, field: keyof OrgExperienceEntry, value: string) => {
    const updatedHistory = [...organizationExperienceHistory];
    updatedHistory[index] = { ...updatedHistory[index], [field]: value };
    setOrganizationExperienceHistory(updatedHistory);
  };

  return (
    <div className="w-full border-border/60">
      <form onSubmit={handleSubmit} id="manualApplyFormId" className="space-y-8 p-6">
        <section className="space-y-4">
          <h2 className="text-xl font-semibold border-b pb-2 mb-6">Personal Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            <div><Label htmlFor="fullName-form" className="text-sm font-medium text-muted-foreground">Full Name</Label><Input id="fullName-form" value={fullName} onChange={(e) => setFullName(e.target.value)} required className="mt-1" /></div>
            <div><Label htmlFor="dateOfBirth-form" className="text-sm font-medium text-muted-foreground">Date of Birth</Label><Input id="dateOfBirth-form" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} required className="mt-1" /></div>
            <div><Label htmlFor="email-form" className="text-sm font-medium text-muted-foreground">Email Address</Label><Input id="email-form" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1" /></div>
            <div><Label htmlFor="phone-form" className="text-sm font-medium text-muted-foreground">Phone Number</Label><Input id="phone-form" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1" /></div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold border-b pb-2">Job Interests</h2>
          <div className="space-y-2">
            {jobInterests.map((interest, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input id={`jobInterest-${index}`} value={interest} onChange={(e) => handleJobInterestChange(index, e.target.value)} className="mt-1 flex-grow" />
                <Button type="button" variant="outline" size="icon" className="mt-1" onClick={() => removeJobInterest(index)} disabled={jobInterests.length <= 1 && index === 0}><X className="w-4 h-4" /></Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="mt-1" onClick={addJobInterest}><Plus className="w-4 h-4 mr-1" /> Add</Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Add keywords or phrases describing your job interests.</p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold border-b pb-2">Education</h2>
          {educationHistory.map((edu, index) => (
            <div key={index} className="p-4 border rounded-md space-y-3 relative">
              {educationHistory.length > 1 && <Button type="button" variant="destructive" size="sm" className="absolute top-2 right-2 p-1 h-auto" onClick={() => removeEducationEntry(index)}><X className="w-3 h-3" /></Button>}
              <div><Label htmlFor={`educationLevel-${index}`}>Education Level</Label><Input id={`educationLevel-${index}`} value={edu.level} onChange={(e) => handleEducationChange(index, 'level', e.target.value)} className="mt-1" /></div>
              <div><Label htmlFor={`institution-${index}`}>Institution</Label><Input id={`institution-${index}`} value={edu.institution} onChange={(e) => handleEducationChange(index, 'institution', e.target.value)} className="mt-1" /></div>
              <div><Label htmlFor={`major-${index}`}>Major/Field of Study</Label><Input id={`major-${index}`} value={edu.major} onChange={(e) => handleEducationChange(index, 'major', e.target.value)} className="mt-1" /></div>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" className="mt-2" onClick={addEducationEntry}><Plus className="w-4 h-4 mr-1" /> Add</Button>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold border-b pb-2">Work Experience</h2>
          {workExperienceHistory.map((work, index) => (
            <div key={index} className="p-4 border rounded-md space-y-3 relative">
              {workExperienceHistory.length > 1 && <Button type="button" variant="destructive" size="sm" className="absolute top-2 right-2 p-1 h-auto" onClick={() => removeWorkExperienceEntry(index)}><X className="w-3 h-3" /></Button>}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 md:gap-y-0">
                <div><Label htmlFor={`company-${index}`}>Company</Label><Input id={`company-${index}`} value={work.company} onChange={(e) => handleWorkExperienceChange(index, 'company', e.target.value)} className="mt-1" /></div>
                <div><Label htmlFor={`position-${index}`}>Position</Label><Input id={`position-${index}`} value={work.position} onChange={(e) => handleWorkExperienceChange(index, 'position', e.target.value)} className="mt-1" /></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 md:gap-y-0">
                <div><Label htmlFor={`workPeriodFrom-${index}`}>Start Date</Label><Input id={`workPeriodFrom-${index}`} type="month" value={work.start_date} onChange={(e) => handleWorkExperienceChange(index, 'start_date', e.target.value)} className="mt-1" /></div>
                <div><Label htmlFor={`workPeriodTo-${index}`}>End Date <span className="text-xs font-thin">(or expected)</span></Label><Input id={`workPeriodTo-${index}`} type="month" value={work.end_date} onChange={(e) => handleWorkExperienceChange(index, 'end_date', e.target.value)} className="mt-1" /></div>
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" className="mt-2" onClick={addWorkExperienceEntry}><Plus className="w-4 h-4 mr-1" /> Add</Button>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold border-b pb-2">Organization Experience</h2>
          {organizationExperienceHistory.map((org, index) => (
            <div key={index} className="p-4 border rounded-md space-y-3 relative">
              {organizationExperienceHistory.length > 1 && <Button type="button" variant="destructive" size="sm" className="absolute top-2 right-2 p-1 h-auto" onClick={() => removeOrganizationExperienceEntry(index)}><X className="w-3 h-3" /></Button>}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 md:gap-y-0">
                <div><Label htmlFor={`orgName-${index}`}>Organization Name</Label><Input id={`orgName-${index}`} value={org.organization_name} onChange={(e) => handleOrganizationExperienceChange(index, 'organization_name', e.target.value)} className="mt-1" /></div>
                <div><Label htmlFor={`orgRole-${index}`}>Role</Label><Input id={`orgRole-${index}`} value={org.role} onChange={(e) => handleOrganizationExperienceChange(index, 'role', e.target.value)} className="mt-1" /></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 md:gap-y-0">
                <div><Label htmlFor={`orgPeriodFrom-${index}`}>Start Date</Label><Input id={`orgPeriodFrom-${index}`} type="month" value={org.start_date} onChange={(e) => handleOrganizationExperienceChange(index, 'start_date', e.target.value)} className="mt-1" /></div>
                <div><Label htmlFor={`orgPeriodTo-${index}`}>End Date <span className="text-xs font-thin">(or expected)</span></Label><Input id={`orgPeriodTo-${index}`} type="month" value={org.end_date} onChange={(e) => handleOrganizationExperienceChange(index, 'end_date', e.target.value)} className="mt-1" /></div>
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" className="mt-2" onClick={addOrganizationExperienceEntry}><Plus className="w-4 h-4 mr-1" /> Add</Button>
        </section>

        {/* Add Referral Section */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold border-b pb-2">Referral Information <span className="text-sm font-normal text-muted-foreground">(Optional)</span></h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            <div>
              <Label htmlFor="referralName" className="text-sm font-medium text-muted-foreground">Referral Name</Label>
              <Input 
                id="referralName" 
                value={referralName} 
                onChange={(e) => onReferralChange.setReferralName(e.target.value)} 
                className="mt-1" 
              />
            </div>
            <div>
              <Label htmlFor="referralEmail" className="text-sm font-medium text-muted-foreground">Referral Email</Label>
              <Input 
                id="referralEmail" 
                type="email" 
                value={referralEmail} 
                onChange={(e) => onReferralChange.setReferralEmail(e.target.value)} 
                className="mt-1" 
              />
            </div>
            <div>
              <Label htmlFor="referralPosition" className="text-sm font-medium text-muted-foreground">Role/Position</Label>
              <Input 
                id="referralPosition" 
                value={referralPosition} 
                onChange={(e) => onReferralChange.setReferralPosition(e.target.value)} 
                className="mt-1" 
              />
            </div>
            <div>
              <Label htmlFor="referralDept" className="text-sm font-medium text-muted-foreground">Department</Label>
              <Input 
                id="referralDept" 
                value={referralDept} 
                onChange={(e) => onReferralChange.setReferralDept(e.target.value)} 
                className="mt-1" 
              />
            </div>
          </div>
        </section>

        {submitError && (
          <div className="text-destructive text-sm">{submitError}</div>
        )}
        {submitStatusMessage && (
          <div className="text-muted-foreground text-sm">{submitStatusMessage}</div>
        )}

        <div className="border-t border-border/60 pt-6">
          <Button type="submit" form="manualApplyFormId" className="sm:w-auto w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Submit Application'}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default ApplyFormWithId;