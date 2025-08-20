import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  CheckCircle, 
  Building2, 
  Users, 
  FileText, 
  PenTool, 
  Code, 
  Lightbulb, 
  Rocket 
} from 'lucide-react';

interface WelcomingScreenProps {
  onComplete: () => void;
  isCompleted: boolean;
  data?: {
    welcomeContent?: {
      title?: string;
      subtitle?: string;
      description?: string;
      roleTitle?: string;
      roleDescription?: string;
      manager?: string;
      department?: string;
      keyPoints?: string[];
    };
  };
}

const WelcomingScreen: React.FC<WelcomingScreenProps> = ({ onComplete, isCompleted, data }) => {
  // Use dynamic data if available, otherwise fall back to hardcoded data
  const welcomeData = data?.welcomeContent;
  const title = welcomeData?.title || "Welcome to TelcoTech Solutions!";
  const subtitle = welcomeData?.subtitle || "We're excited to have you join our team as a Senior Software Engineer";
  const description = welcomeData?.description || "Your Journey Starts Here";
  const roleTitle = welcomeData?.roleTitle || "Senior Software Engineer";
  const roleDescription = welcomeData?.roleDescription || "You'll be working on cutting-edge telecommunications software, developing scalable solutions for our network infrastructure.";
  const manager = welcomeData?.manager;
  const department = welcomeData?.department;
  const keyPoints = welcomeData?.keyPoints || [
    "Learn about our company culture and values",
    "Understand our organizational structure", 
    "Complete essential paperwork",
    "Sign important documents"
  ];

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-foreground">{title}</h1>
        <p className="text-xl text-muted-foreground">{subtitle}</p>
      </div>

      <Card className="border border-border">
        <CardHeader>
          <CardTitle className="text-2xl text-foreground">{description}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-foreground">What to Expect</h3>
              <ul className="space-y-2 text-muted-foreground">
                {keyPoints.map((point, index) => (
                  <li key={index} className="flex items-center gap-3">
                    {index === 0 && <Building2 className="h-4 w-4 text-primary" />}
                    {index === 1 && <Users className="h-4 w-4 text-primary" />}
                    {index === 2 && <FileText className="h-4 w-4 text-primary" />}
                    {index === 3 && <PenTool className="h-4 w-4 text-primary" />}
                    {index > 3 && <Code className="h-4 w-4 text-primary" />}
                    {point}
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-foreground">Your Role</h3>
              <div className="bg-accent/50 border border-border p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Code className="h-4 w-4 text-primary" />
                  <p className="font-medium text-foreground">{roleTitle}</p>
                </div>
                <p className="text-sm text-muted-foreground">{roleDescription}</p>
                {department && (
                  <div className="mt-2">
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium">Department:</span> {department}
                    </p>
                  </div>
                )}
                {manager && (
                  <div className="mt-1">
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium">Manager:</span> {manager}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-accent/30 border border-border rounded-lg p-4 mt-6">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="h-4 w-4 text-primary" />
              <h4 className="font-semibold text-foreground">Pro Tip</h4>
            </div>
            <p className="text-muted-foreground">
              Use the AI Assistant on the right panel to ask any questions during your onboarding process. 
              It's here to help you every step of the way!
            </p>
          </div>

          <div className="text-center pt-4">
            {!isCompleted && (
              <Button 
                onClick={onComplete}
                className="px-8 py-3 text-lg"
              >
                <Rocket className="h-4 w-4 mr-2" />
                Let's Get Started!
              </Button>
            )}
            {isCompleted && (
              <div className="flex items-center justify-center gap-2 text-primary font-semibold">
                <CheckCircle className="h-4 w-4" />
                Welcome section completed!
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WelcomingScreen; 