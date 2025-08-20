import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { 
  CheckCircle, 
  History, 
  Target, 
  Heart, 
  Code2, 
  Coffee,
  ArrowRight 
} from 'lucide-react';

interface CompanyProfileProps {
  onComplete: () => void;
  isCompleted: boolean;
  data?: {
    companyContent?: {
      companyName?: string;
      foundedYear?: number;
      description?: string;
      mission?: string;
      vision?: string;
      values?: Array<{ name: string; description: string }>;
      stats?: Array<{ label: string; value: string }>;
      techStack?: string[];
    };
  };
}

const CompanyProfile: React.FC<CompanyProfileProps> = ({ onComplete, isCompleted, data }) => {
  const [readProgress, setReadProgress] = useState(0);
  const [sectionsRead, setSectionsRead] = useState<Set<string>>(new Set());

  // Use dynamic data if available, otherwise fall back to hardcoded data
  const companyData = data?.companyContent;
  const companyName = companyData?.companyName || "TelcoTech Solutions";
  const foundedYear = companyData?.foundedYear || 2010;
  const description = companyData?.description || "Founded in 2010, TelcoTech Solutions started as a small startup with a vision to revolutionize telecommunications infrastructure. Today, we're a leading provider of network solutions, serving over 50 million customers across 15 countries. Our journey from a garage startup to an industry leader is a testament to our innovative spirit and commitment to excellence.";
  const mission = companyData?.mission || "To connect the world through innovative telecommunications technology. We believe that seamless connectivity is fundamental to human progress, and we're dedicated to building the infrastructure that powers tomorrow's digital society. Every line of code we write and every system we deploy brings us closer to a more connected world.";
  const vision = companyData?.vision;
  const values = companyData?.values || [
    { name: "Innovation First", description: "We embrace cutting-edge technology and foster creative problem-solving." },
    { name: "Customer Obsession", description: "Every decision we make puts our customers' needs at the center." },
    { name: "Team Collaboration", description: "We believe the best solutions come from diverse perspectives working together." },
    { name: "Continuous Learning", description: "We invest in our people's growth and encourage lifelong learning." }
  ];
  const stats = companyData?.stats || [];
  const techStack = companyData?.techStack || ['Go', 'Python', 'Kubernetes', 'PostgreSQL', 'React', 'Kafka', 'Redis', 'AWS'];

  const sections = [
    { id: 'history', title: 'Our History', icon: History },
    { id: 'mission', title: 'Our Mission', icon: Target },
    { id: 'values', title: 'Our Core Values', icon: Heart },
    { id: 'technology', title: 'Our Technology Stack', icon: Code2 },
    { id: 'culture', title: 'Our Culture', icon: Coffee }
  ];

  const handleSectionRead = (sectionId: string) => {
    if (!sectionsRead.has(sectionId)) {
      const newSectionsRead = new Set(sectionsRead);
      newSectionsRead.add(sectionId);
      setSectionsRead(newSectionsRead);
      setReadProgress((newSectionsRead.size / sections.length) * 100);
    }
  };

  const canComplete = readProgress === 100;

  const getSectionContent = (sectionId: string) => {
    switch (sectionId) {
      case 'history':
        return description;
      case 'mission':
        return mission;
      case 'values':
        return (
          <div className="grid md:grid-cols-2 gap-4">
            {values.map((value, index) => (
              <div key={index}>
                <h4 className="font-semibold text-foreground mb-2">{value.name}</h4>
                <p className="text-sm text-muted-foreground">{value.description}</p>
              </div>
            ))}
          </div>
        );
      case 'technology':
        return (
          <div className="space-y-3">
            <p className="text-muted-foreground">As a developer, you'll work with:</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {techStack.map((tech) => (
                <div key={tech} className="bg-accent text-accent-foreground px-3 py-1 rounded-full text-center text-sm font-medium">
                  {tech}
                </div>
              ))}
            </div>
          </div>
        );
      case 'culture':
        return (
          <>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We foster an inclusive environment where everyone can thrive. Our culture is built on trust, 
              transparency, and mutual respect. We offer flexible working arrangements, continuous learning 
              opportunities, and a comprehensive benefits package that supports work-life balance.
            </p>
            {stats.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                {stats.map((stat, index) => (
                  <div key={index} className="text-center">
                    <div className="text-2xl font-bold text-primary">{stat.value}</div>
                    <div className="text-sm text-muted-foreground">{stat.label}</div>
                  </div>
                ))}
              </div>
            )}
            <div className="bg-accent/50 border border-border p-4 rounded-lg">
              <h4 className="font-semibold text-foreground mb-2">What our employees say:</h4>
              <p className="text-muted-foreground italic">
                "{companyName} isn't just a workplace—it's a community where innovation meets purpose. 
                Every day brings new challenges and opportunities to make a real impact."
              </p>
              <p className="text-muted-foreground text-sm mt-2">- Sarah Chen, Senior Software Engineer</p>
            </div>
          </>
        );
      default:
        return "";
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-foreground">About {companyName}</h1>
        <p className="text-muted-foreground">Learn about our company, mission, and culture</p>
        <div className="max-w-md mx-auto">
          <Progress value={readProgress} className="h-2" />
          <p className="text-sm text-muted-foreground mt-1">Reading Progress: {Math.round(readProgress)}%</p>
        </div>
      </div>

      <div className="grid gap-6">
        {sections.map((section) => {
          const Icon = section.icon;
          const isRead = sectionsRead.has(section.id);
          
          return (
            <Card 
              key={section.id}
              className={`cursor-pointer transition-all border ${
                isRead 
                  ? 'border-primary/30 bg-primary/5' 
                  : 'border-border hover:border-primary/20 hover:bg-accent/30'
              }`}
              onClick={() => handleSectionRead(section.id)}
            >
              <CardHeader>
                <CardTitle className="text-xl text-foreground flex items-center gap-3">
                  <Icon className="h-5 w-5 text-primary" />
                  {section.title}
                  {isRead && <CheckCircle className="h-4 w-4 text-primary ml-auto" />}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-muted-foreground leading-relaxed">
                  {getSectionContent(section.id)}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="text-center pt-4">
        {!isCompleted && (
          <Button 
            onClick={onComplete}
            disabled={!canComplete}
            variant={canComplete ? "default" : "secondary"}
            className="px-8 py-3 text-lg"
          >
            {canComplete ? (
              <>
                <ArrowRight className="h-4 w-4 mr-2" />
                Continue to Organization Structure
              </>
            ) : (
              'Read all sections to continue'
            )}
          </Button>
        )}
        {isCompleted && (
          <div className="flex items-center justify-center gap-2 text-primary font-semibold">
            <CheckCircle className="h-4 w-4" />
            Company profile section completed!
          </div>
        )}
      </div>
    </div>
  );
};

export default CompanyProfile; 