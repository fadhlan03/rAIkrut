import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  CheckCircle, 
  User, 
  Briefcase, 
  Monitor, 
  Target, 
  ArrowLeft, 
  ArrowRight 
} from 'lucide-react';

interface FormField {
  id: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'date' | 'textarea' | 'select';
  placeholder?: string;
  required?: boolean;
  options?: string[];
  section?: string;
}

interface OnboardingFormProps {
  onComplete: (formData?: any) => void;
  isCompleted: boolean;
  data?: {
    formFields?: FormField[];
  };
  formData?: any; // Previously saved form data
}

interface FormData {
  personalInfo: { [key: string]: string };
  workPreferences: { [key: string]: string };
  technicalSetup: { [key: string]: string };
  goals: { [key: string]: string };
}

const OnboardingForm: React.FC<OnboardingFormProps> = ({ onComplete, isCompleted, data, formData: savedFormData }) => {
  const [currentSection, setCurrentSection] = useState(0);
  
  // Use dynamic form fields if available, otherwise fall back to hardcoded fields
  const dynamicFields = data?.formFields || [];
  
  // Default form structure if no dynamic fields are provided
  const defaultFormData: FormData = {
    personalInfo: {
      preferredName: '',
      emergencyContact: '',
      emergencyPhone: '',
      address: '',
      phoneNumber: ''
    },
    workPreferences: {
      workLocation: '',
      startDate: '',
      shirtSize: '',
      dietaryRestrictions: ''
    },
    technicalSetup: {
      laptopType: '',
      idePreference: '',
      githubUsername: '',
      slackHandle: ''
    },
    goals: {
      shortTermGoals: '',
      learningInterests: '',
      mentoringInterest: ''
    }
  };

  // Initialize form data with saved data if available
  const [formData, setFormData] = useState<FormData>(() => {
    if (savedFormData) {
      return {
        personalInfo: { ...defaultFormData.personalInfo, ...savedFormData.personalInfo },
        workPreferences: { ...defaultFormData.workPreferences, ...savedFormData.workPreferences },
        technicalSetup: { ...defaultFormData.technicalSetup, ...savedFormData.technicalSetup },
        goals: { ...defaultFormData.goals, ...savedFormData.goals }
      };
    }
    return defaultFormData;
  });

  const sections = [
    { id: 'personalInfo', title: 'Personal Information', icon: User },
    { id: 'workPreferences', title: 'Work Preferences', icon: Briefcase },
    { id: 'technicalSetup', title: 'Technical Setup', icon: Monitor },
    { id: 'goals', title: 'Goals & Interests', icon: Target }
  ];

  // Group dynamic fields by section
  const fieldsBySection = dynamicFields.reduce((acc, field) => {
    const section = field.section || 'personalInfo';
    if (!acc[section]) acc[section] = [];
    acc[section].push(field);
    return acc;
  }, {} as Record<string, FormField[]>);

  const updateFormData = (section: keyof FormData, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  const isSectionComplete = (sectionIndex: number) => {
    const sectionKey = sections[sectionIndex].id as keyof FormData;
    const sectionData = formData[sectionKey];
    
    // If using dynamic fields, check those
    if (fieldsBySection[sectionKey]?.length > 0) {
      const requiredFields = fieldsBySection[sectionKey].filter(f => f.required !== false);
      return requiredFields.every(field => sectionData[field.id]?.trim() !== '');
    }
    
    // Otherwise check default fields
    return Object.values(sectionData).every(value => value.trim() !== '');
  };

  const isFormComplete = () => {
    return sections.every((_, index) => isSectionComplete(index));
  };

  const renderDynamicField = (field: FormField, sectionKey: keyof FormData) => {
    const value = formData[sectionKey][field.id] || '';
    
    switch (field.type) {
      case 'textarea':
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id}>
              {field.label} {field.required !== false && '*'}
            </Label>
            <Textarea
              id={field.id}
              value={value}
              onChange={(e) => updateFormData(sectionKey, field.id, e.target.value)}
              placeholder={field.placeholder}
              rows={3}
            />
          </div>
        );
      case 'select':
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id}>
              {field.label} {field.required !== false && '*'}
            </Label>
            <Select onValueChange={(value) => updateFormData(sectionKey, field.id, value)}>
              <SelectTrigger>
                <SelectValue placeholder={field.placeholder || "Select option"} />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map((option) => (
                  <SelectItem key={option} value={option.toLowerCase().replace(/\s+/g, '-')}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      default:
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id}>
              {field.label} {field.required !== false && '*'}
            </Label>
            <Input
              id={field.id}
              type={field.type}
              value={value}
              onChange={(e) => updateFormData(sectionKey, field.id, e.target.value)}
              placeholder={field.placeholder}
            />
          </div>
        );
    }
  };

  const renderPersonalInfo = () => {
    const sectionFields = fieldsBySection['personalInfo'];
    
    if (sectionFields?.length > 0) {
      return (
        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {sectionFields.map(field => renderDynamicField(field, 'personalInfo'))}
          </div>
        </div>
      );
    }

    // Fallback to default fields
    return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="preferredName">Preferred Name *</Label>
          <Input
            id="preferredName"
            value={formData.personalInfo.preferredName}
            onChange={(e) => updateFormData('personalInfo', 'preferredName', e.target.value)}
            placeholder="What should we call you?"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phoneNumber">Phone Number *</Label>
          <Input
            id="phoneNumber"
            value={formData.personalInfo.phoneNumber}
            onChange={(e) => updateFormData('personalInfo', 'phoneNumber', e.target.value)}
            placeholder="+1 (555) 123-4567"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="address">Home Address *</Label>
        <Textarea
          id="address"
          value={formData.personalInfo.address}
          onChange={(e) => updateFormData('personalInfo', 'address', e.target.value)}
          placeholder="Full address for shipping equipment"
          rows={3}
        />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="emergencyContact">Emergency Contact Name *</Label>
          <Input
            id="emergencyContact"
            value={formData.personalInfo.emergencyContact}
            onChange={(e) => updateFormData('personalInfo', 'emergencyContact', e.target.value)}
            placeholder="Full name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="emergencyPhone">Emergency Contact Phone *</Label>
          <Input
            id="emergencyPhone"
            value={formData.personalInfo.emergencyPhone}
            onChange={(e) => updateFormData('personalInfo', 'emergencyPhone', e.target.value)}
            placeholder="+1 (555) 123-4567"
          />
        </div>
      </div>
    </div>
  );
  };

  const renderWorkPreferences = () => {
    const sectionFields = fieldsBySection['workPreferences'];
    
    if (sectionFields?.length > 0) {
      return (
        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {sectionFields.map(field => renderDynamicField(field, 'workPreferences'))}
          </div>
        </div>
      );
    }

    // Fallback to default fields
    return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="workLocation">Preferred Work Location *</Label>
          <Select onValueChange={(value) => updateFormData('workPreferences', 'workLocation', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="remote">Fully Remote</SelectItem>
              <SelectItem value="hybrid">Hybrid (2-3 days office)</SelectItem>
              <SelectItem value="office">Full-time Office</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="startDate">Preferred Start Date *</Label>
          <Input
            id="startDate"
            type="date"
            value={formData.workPreferences.startDate}
            onChange={(e) => updateFormData('workPreferences', 'startDate', e.target.value)}
          />
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="shirtSize">T-shirt Size *</Label>
          <Select onValueChange={(value) => updateFormData('workPreferences', 'shirtSize', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select size" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="xs">XS</SelectItem>
              <SelectItem value="s">S</SelectItem>
              <SelectItem value="m">M</SelectItem>
              <SelectItem value="l">L</SelectItem>
              <SelectItem value="xl">XL</SelectItem>
              <SelectItem value="xxl">XXL</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="dietaryRestrictions">Dietary Restrictions *</Label>
          <Input
            id="dietaryRestrictions"
            value={formData.workPreferences.dietaryRestrictions}
            onChange={(e) => updateFormData('workPreferences', 'dietaryRestrictions', e.target.value)}
            placeholder="None, or list any restrictions"
          />
        </div>
      </div>
    </div>
  );
  };

  const renderTechnicalSetup = () => {
    const sectionFields = fieldsBySection['technicalSetup'];
    
    if (sectionFields?.length > 0) {
      return (
        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            {sectionFields.map(field => renderDynamicField(field, 'technicalSetup'))}
          </div>
        </div>
      );
    }

    // Fallback to default fields
    return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="laptopType">Laptop Preference *</Label>
          <Select onValueChange={(value) => updateFormData('technicalSetup', 'laptopType', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select laptop" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="macbook-pro">MacBook Pro 16"</SelectItem>
              <SelectItem value="macbook-air">MacBook Air</SelectItem>
              <SelectItem value="thinkpad">ThinkPad X1 Carbon</SelectItem>
              <SelectItem value="dell-xps">Dell XPS 15</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="idePreference">IDE Preference *</Label>
          <Select onValueChange={(value) => updateFormData('technicalSetup', 'idePreference', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select IDE" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="vscode">VS Code</SelectItem>
              <SelectItem value="goland">GoLand</SelectItem>
              <SelectItem value="vim">Vim/Neovim</SelectItem>
              <SelectItem value="intellij">IntelliJ IDEA</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="githubUsername">GitHub Username *</Label>
          <Input
            id="githubUsername"
            value={formData.technicalSetup.githubUsername}
            onChange={(e) => updateFormData('technicalSetup', 'githubUsername', e.target.value)}
            placeholder="your-github-username"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="slackHandle">Preferred Slack Handle *</Label>
          <Input
            id="slackHandle"
            value={formData.technicalSetup.slackHandle}
            onChange={(e) => updateFormData('technicalSetup', 'slackHandle', e.target.value)}
            placeholder="@your-handle"
          />
        </div>
      </div>
    </div>
  );
  };

  const renderGoals = () => {
    const sectionFields = fieldsBySection['goals'];
    
    if (sectionFields?.length > 0) {
      return (
        <div className="space-y-4">
          {sectionFields.map(field => renderDynamicField(field, 'goals'))}
        </div>
      );
    }

    // Fallback to default fields
    return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="shortTermGoals">Short-term Goals (3-6 months) *</Label>
        <Textarea
          id="shortTermGoals"
          value={formData.goals.shortTermGoals}
          onChange={(e) => updateFormData('goals', 'shortTermGoals', e.target.value)}
          placeholder="What do you hope to achieve in your first few months?"
          rows={3}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="learningInterests">Learning Interests *</Label>
        <Textarea
          id="learningInterests"
          value={formData.goals.learningInterests}
          onChange={(e) => updateFormData('goals', 'learningInterests', e.target.value)}
          placeholder="Technologies, skills, or areas you'd like to learn more about"
          rows={3}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="mentoringInterest">Interest in Mentoring *</Label>
        <Select onValueChange={(value) => updateFormData('goals', 'mentoringInterest', value)}>
          <SelectTrigger>
            <SelectValue placeholder="Select interest level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mentor">I'd like to mentor others</SelectItem>
            <SelectItem value="mentee">I'd like to be mentored</SelectItem>
            <SelectItem value="both">Both mentor and be mentored</SelectItem>
            <SelectItem value="none">Not interested at this time</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
  };

  const renderCurrentSection = () => {
    switch (currentSection) {
      case 0: return renderPersonalInfo();
      case 1: return renderWorkPreferences();
      case 2: return renderTechnicalSetup();
      case 3: return renderGoals();
      default: return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-foreground">Onboarding Information</h1>
        <p className="text-muted-foreground">Help us prepare for your first day</p>
      </div>

      {/* Progress indicator */}
      <div className="flex justify-center space-x-4 mb-8">
        {sections.map((section, index) => {
          const Icon = section.icon;
          const isActive = index === currentSection;
          const isCompleted = isSectionComplete(index);
          
          return (
            <div
              key={section.id}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg cursor-pointer transition-all border ${
                isActive
                  ? 'bg-primary/10 text-primary border-primary/20'
                  : isCompleted
                    ? 'bg-primary/5 text-primary border-primary/10'
                    : 'bg-accent text-accent-foreground border-border hover:bg-accent/80'
              }`}
              onClick={() => setCurrentSection(index)}
            >
              <Icon className="h-4 w-4" />
              <span className="text-sm font-medium hidden md:block">{section.title}</span>
              {isCompleted && <CheckCircle className="h-4 w-4 text-primary" />}
            </div>
          );
        })}
      </div>

      <Card className="border border-border">
        <CardHeader>
          <CardTitle className="text-xl text-foreground flex items-center gap-2">
            {React.createElement(sections[currentSection].icon, { className: "h-5 w-5 text-primary" })}
            {sections[currentSection].title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {renderCurrentSection()}

          <div className="flex justify-between pt-6">
            <Button
              variant="outline"
              onClick={() => setCurrentSection(Math.max(0, currentSection - 1))}
              disabled={currentSection === 0}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>

            {currentSection < sections.length - 1 ? (
              <Button
                onClick={() => setCurrentSection(currentSection + 1)}
                disabled={!isSectionComplete(currentSection)}
              >
                <ArrowRight className="h-4 w-4 mr-2" />
                Next Section
              </Button>
            ) : (
              !isCompleted && (
                <Button
                  onClick={() => onComplete(formData)}
                  disabled={!isFormComplete()}
                  variant={isFormComplete() ? "default" : "secondary"}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Complete Form
                </Button>
              )
            )}
          </div>
        </CardContent>
      </Card>

      {isCompleted && (
        <div className="text-center flex items-center justify-center gap-2 text-primary font-semibold">
          <CheckCircle className="h-4 w-4" />
          Onboarding form completed successfully!
        </div>
      )}
    </div>
  );
};

export default OnboardingForm; 