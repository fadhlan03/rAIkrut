import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  PartyPopper, 
  CheckCircle, 
  Mail, 
  Package, 
  Video, 
  BookOpen, 
  MessageSquare, 
  Settings, 
  Monitor, 
  Star, 
  ArrowRight 
} from 'lucide-react';

interface Contact {
  name: string;
  role: string;
  email: string;
}

interface Resource {
  name: string;
  description: string;
  url?: string;
}

interface NextStep {
  title: string;
  description: string;
  icon?: string;
}

interface FinishScreenProps {
  onComplete: () => void;
  isCompleted: boolean;
  data?: {
    finishContent?: {
      title?: string;
      subtitle?: string;
      nextSteps?: NextStep[];
      teamContacts?: Contact[];
      resources?: Resource[];
      companyMessage?: string;
      ceoName?: string;
      companyName?: string;
    };
    companyContent?: {
      companyName?: string;
    };
  };
}

const FinishScreen: React.FC<FinishScreenProps> = ({ onComplete, isCompleted, data }) => {
  // Use dynamic data if available, otherwise fall back to hardcoded data
  const finishData = data?.finishContent;
  const companyName = data?.companyContent?.companyName || finishData?.companyName || "TelcoTech Solutions";
  const title = finishData?.title || "Congratulations!";
  const subtitle = finishData?.subtitle || `You've successfully completed your onboarding at ${companyName}`;
  
  const nextSteps = finishData?.nextSteps || [
    { title: "Check Your Email", description: "You'll receive your login credentials and first-day schedule within 24 hours.", icon: "Mail" },
    { title: "Equipment Delivery", description: "Your laptop and equipment will be shipped to arrive 2 days before your start date.", icon: "Package" },
    { title: "First Day Setup", description: "Join the team video call at 9:00 AM on your first day for orientation.", icon: "Video" }
  ];

  const teamContacts = finishData?.teamContacts || [
    { name: "Alex Rodriguez", role: "Engineering Manager", email: "alex.rodriguez@telcotech.com" },
    { name: "Sarah Chen", role: "HR Business Partner", email: "sarah.chen@telcotech.com" },
    { name: "Jordan Davis", role: "Senior Software Engineer (Buddy)", email: "jordan.davis@telcotech.com" }
  ];

  const resources = finishData?.resources || [
    { name: "Employee Handbook", description: "Access via company portal" },
    { name: "Slack Workspace", description: "telcotech.slack.com" },
    { name: "Dev Environment", description: "Setup guide in your email" }
  ];

  const companyMessage = finishData?.companyMessage || `Every great journey begins with a single step. Welcome to ${companyName}, where your journey in telecommunications technology starts today. We can't wait to see the amazing things you'll accomplish with our team!`;
  const ceoName = finishData?.ceoName || "Maria Santos";

  const getIconComponent = (iconName?: string) => {
    switch (iconName) {
      case 'Mail': return Mail;
      case 'Package': return Package;
      case 'Video': return Video;
      case 'BookOpen': return BookOpen;
      case 'MessageSquare': return MessageSquare;
      case 'Settings': return Settings;
      default: return CheckCircle;
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center space-y-4">
        <div className="flex justify-center mb-4">
          <PartyPopper className="w-16 h-16 text-primary" />
        </div>
        <h1 className="text-4xl font-bold text-primary">{title}</h1>
        <p className="text-xl text-muted-foreground">{subtitle}</p>
      </div>

      <Card className="border-2 border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-2xl text-primary text-center flex items-center justify-center gap-2">
            Welcome to the Team!
            <Star className="h-6 w-6" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">What's Next?</h3>
              <div className="space-y-3">
                {nextSteps.map((step, index) => {
                  const IconComponent = getIconComponent(step.icon);
                  return (
                    <div key={index} className="flex items-start gap-3">
                      <span className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">
                        {index + 1}
                      </span>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <IconComponent className="h-4 w-4 text-primary" />
                          <p className="font-medium text-foreground">{step.title}</p>
                        </div>
                        <p className="text-sm text-muted-foreground">{step.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">Your Team Contacts</h3>
              <div className="space-y-3">
                {teamContacts.map((contact, index) => (
                  <div key={index} className="bg-card p-3 rounded-lg border border-border">
                    <p className="font-medium text-foreground">{contact.name}</p>
                    <p className="text-sm text-muted-foreground">{contact.role}</p>
                    <p className="text-sm text-primary">{contact.email}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Important Resources</h3>
            <div className="grid md:grid-cols-3 gap-4">
              {resources.map((resource, index) => {
                const IconComponent = getIconComponent(resource.name.includes('Handbook') ? 'BookOpen' : 
                                                     resource.name.includes('Slack') ? 'MessageSquare' : 'Settings');
                return (
                  <div key={index} className="bg-card p-4 rounded-lg border border-border text-center">
                    <IconComponent className="h-8 w-8 mx-auto mb-2 text-primary" />
                    <p className="font-medium text-foreground">{resource.name}</p>
                    <p className="text-sm text-muted-foreground mt-1">{resource.description}</p>
                    {resource.url && (
                      <a href={resource.url} className="text-xs text-primary hover:underline mt-1 block">
                        Access Resource
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-accent/30">
        <CardContent className="p-6">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Monitor className="h-5 w-5 text-primary" />
              <h4 className="font-semibold text-foreground">Did You Know?</h4>
            </div>
            <p className="text-muted-foreground">
              The average onboarding process at {companyName} takes 2-3 weeks. You're already ahead of the curve! 
              Our new hires typically feel fully integrated within their first month.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-accent/20">
        <CardContent className="p-6">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Star className="h-5 w-5 text-primary" />
              <h4 className="font-semibold text-foreground">We're Excited to Have You!</h4>
            </div>
            <p className="text-muted-foreground mb-4">
              "{companyMessage}"
            </p>
            <p className="text-muted-foreground text-sm italic">- {ceoName}, CEO, {companyName}</p>
          </div>
        </CardContent>
      </Card>

      <div className="text-center pt-6">
        {!isCompleted && (
          <Button 
            onClick={onComplete}
            className="px-8 py-3 text-lg"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Complete Onboarding
          </Button>
        )}
        {isCompleted && (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-2 text-primary font-semibold text-lg">
              <CheckCircle className="h-5 w-5" />
              Onboarding completed successfully!
            </div>
            <Button 
              onClick={() => window.location.href = '/apply'}
              variant="outline"
              className="px-6 py-2"
            >
              <ArrowRight className="h-4 w-4 mr-2" />
              Return to Dashboard
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FinishScreen; 