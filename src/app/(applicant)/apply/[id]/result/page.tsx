'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDashboard } from '@/contexts/DashboardContext';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, ArrowLeft } from 'lucide-react';

const ApplicationResultPage: React.FC = () => {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { setSiteTitle } = useDashboard();
  const [jobTitle, setJobTitle] = useState<string>('this position');
    
    useEffect(() => {
    // Try to get job title from localStorage if available
        if (id) {
                const storedJobTitle = localStorage.getItem(`assessmentJobTitle-${id}`);
      if (storedJobTitle) {
                    setJobTitle(storedJobTitle);
        setSiteTitle(`Application Submitted - ${storedJobTitle}`);
        // Clean up localStorage
        localStorage.removeItem(`assessmentResult-${id}`);
        localStorage.removeItem(`assessmentJobTitle-${id}`);
      } else {
        setSiteTitle('Application Submitted');
      }
    }

    return () => {
      setSiteTitle(null);
    };
  }, [id, setSiteTitle]);

  const handleGoBack = () => {
    router.push('/apply');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-2xl">
        <CardContent className="p-12 text-center">
          <div className="flex justify-center mb-8">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
                    </div>
          
          <h1 className="text-4xl font-bold text-foreground mb-6">
            Thank You!
          </h1>
          
          <div className="space-y-4 mb-8">
            <p className="text-xl text-muted-foreground">
              Your application for <span className="font-semibold text-foreground">{jobTitle}</span> has been successfully submitted and recorded.
            </p>
            
            <p className="text-lg text-muted-foreground">
              Our recruitment team will review your application and get back to you if you're selected for the next stage. We appreciate your interest in joining our team!
            </p>
            
                                </div>
          
          <Button 
            onClick={handleGoBack}
            size="lg" 
            className="text-lg px-8 py-3"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Job Listings
          </Button>
                </CardContent>
            </Card>
    </div>
    );
};

export default ApplicationResultPage;
