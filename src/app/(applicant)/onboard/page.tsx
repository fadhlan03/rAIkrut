'use client';

import React, { useState, useContext, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  HandHeart, 
  Building2, 
  Users, 
  FileText, 
  PenTool, 
  PartyPopper,
  MessageSquare,
  ChevronLeft,
  LoaderCircle,
  Calendar,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';
import { toast } from 'sonner';
import { DashboardContext } from '@/contexts/DashboardContext';
import { useAuth } from '@/contexts/AuthContext';
import { getCookie } from 'cookies-next';
import WelcomingScreen from '@/components/onboarding/WelcomingScreen';
import CompanyProfile from '@/components/onboarding/CompanyProfile';
import OrganizationStructure from '@/components/onboarding/OrganizationStructure';
import OnboardingForm from '@/components/onboarding/OnboardingForm';
import SigningDocs from '@/components/onboarding/SigningDocs';
import FinishScreen from '@/components/onboarding/FinishScreen';
import AIAssistantPanel from '@/components/onboarding/AIAssistantPanel';
import { getAvailableOnboardingContent, getOnboardingContent, getOrCreateOnboardingCompletion, completeOnboardingStep, updateOnboardingProgress } from '@/app/actions';

interface OnboardingContentItem {
  id: string;
  jobId: string;
  jobTitle: string;
  jobDescription: string;
  jobStatus: string;
  welcomeContent: any;
  createdAt: string;
  updatedAt: string;
}

interface OnboardingData {
  welcomeContent: any;
  companyContent: any;
  teamMembers: any[];
  formFields: any[];
  documents: any[];
  finishContent?: any;
}

interface OnboardingCompletion {
  id: string;
  candidateId: string;
  onboardingContentId: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'abandoned';
  completedSteps: string[];
  formResponses: any;
  currentStep: string;
  startedAt: string;
  completedAt?: string;
}

export default function ApplicantOnboardingPage() {
  const [activeTab, setActiveTab] = useState('0');
  const [completedTabs, setCompletedTabs] = useState<Set<string>>(new Set());
  const [isAIPanelVisible, setIsAIPanelVisible] = useState(true);
  const [selectedOnboardingId, setSelectedOnboardingId] = useState<string | null>(null);
  const [onboardingData, setOnboardingData] = useState<OnboardingData | null>(null);
  const [availableContent, setAvailableContent] = useState<OnboardingContentItem[]>([]);
  const [loadingContent, setLoadingContent] = useState(true);
  const [loadingOnboarding, setLoadingOnboarding] = useState(false);
  const [onboardingCompletion, setOnboardingCompletion] = useState<OnboardingCompletion | null>(null);
  const [savingProgress, setSavingProgress] = useState(false);
  
  // Authentication and user application state
  const [userApplications, setUserApplications] = useState<any[]>([]);
  const [loadingUserApplications, setLoadingUserApplications] = useState(true);
  const [filteredOnboardingContent, setFilteredOnboardingContent] = useState<OnboardingContentItem[]>([]);
  
  // Temporary hardcoded candidate ID - in production this should come from authentication
  const candidateId = "temp-candidate-id-12345"; // TODO: Replace with actual authenticated candidate ID
  
  const dashboardContext = useContext(DashboardContext);
  const { isAuthenticated } = useAuth();

  const tabs = [
    { id: '0', label: 'Welcome', icon: HandHeart, component: WelcomingScreen, step: 'welcome' },
    { id: '1', label: 'Company', icon: Building2, component: CompanyProfile, step: 'company' },
    { id: '2', label: 'Organization', icon: Users, component: OrganizationStructure, step: 'organization' },
    { id: '3', label: 'Information', icon: FileText, component: OnboardingForm, step: 'form' },
    { id: '4', label: 'Documents', icon: PenTool, component: SigningDocs, step: 'documents' },
    { id: '5', label: 'Complete', icon: PartyPopper, component: FinishScreen, step: 'finish' }
  ];

  // Load available onboarding content on component mount
  useEffect(() => {
    const loadAvailableContent = async () => {
      try {
        const result = await getAvailableOnboardingContent();
        if (result.success && result.data) {
          setAvailableContent(result.data);
        } else {
          toast.error('Failed to load available onboarding content');
        }
      } catch (error) {
        console.error('Error loading available content:', error);
        toast.error('Failed to load available onboarding content');
      } finally {
        setLoadingContent(false);
      }
    };

    loadAvailableContent();
  }, []);

  // Initialize or load existing onboarding completion when content is selected
  const initializeOnboardingCompletion = async (onboardingContentId: string) => {
    try {
      const result = await getOrCreateOnboardingCompletion(candidateId, onboardingContentId);
      if (result.success && result.data) {
        const completion = result.data;
        setOnboardingCompletion(completion);
        
        // Restore previous progress
        const newCompletedTabs = new Set<string>();
        completion.completedSteps.forEach((step: string) => {
          const tabIndex = tabs.findIndex(tab => tab.step === step);
          if (tabIndex !== -1) {
            newCompletedTabs.add(tabIndex.toString());
          }
        });
        setCompletedTabs(newCompletedTabs);
        
        // Set active tab based on current step
        const currentTabIndex = tabs.findIndex(tab => tab.step === completion.currentStep);
        if (currentTabIndex !== -1) {
          setActiveTab(currentTabIndex.toString());
        }
        
        return completion;
      } else {
        toast.error('Failed to initialize onboarding progress');
        return null;
      }
    } catch (error) {
      console.error('Error initializing onboarding completion:', error);
      toast.error('Failed to initialize onboarding progress');
      return null;
    }
  };

  // Handle onboarding content selection
  const handleContentSelection = async (contentItem: OnboardingContentItem) => {
    setLoadingOnboarding(true);
    try {
      const result = await getOnboardingContent(contentItem.jobId);
      if (result.success && result.data) {
        setOnboardingData(result.data);
        setSelectedOnboardingId(contentItem.id);
        
        // Initialize onboarding completion tracking
        await initializeOnboardingCompletion(contentItem.id);
        
        toast.success(`Starting onboarding for ${contentItem.jobTitle}`);
      } else {
        toast.error('Failed to load onboarding content');
      }
    } catch (error) {
      console.error('Error loading onboarding content:', error);
      toast.error('Failed to load onboarding content');
    } finally {
      setLoadingOnboarding(false);
    }
  };

  // Save progress to database
  const saveProgress = async (stepName: string, formData?: any) => {
    if (!onboardingCompletion) return;
    
    setSavingProgress(true);
    try {
      const result = await completeOnboardingStep(onboardingCompletion.id, stepName, formData);
      if (result.success) {
        // Update local completion state
        const updatedCompletion = { ...onboardingCompletion };
        if (!updatedCompletion.completedSteps.includes(stepName)) {
          updatedCompletion.completedSteps.push(stepName);
        }
        if (formData) {
          updatedCompletion.formResponses = { ...updatedCompletion.formResponses, ...formData };
        }
        
        // Determine next step
        const stepOrder = ['welcome', 'company', 'organization', 'form', 'documents', 'finish'];
        const currentIndex = stepOrder.indexOf(stepName);
        const nextStep = currentIndex < stepOrder.length - 1 ? stepOrder[currentIndex + 1] : 'finish';
        updatedCompletion.currentStep = nextStep;
        
        // Check if all steps are completed
        const allStepsCompleted = stepOrder.every(s => updatedCompletion.completedSteps.includes(s));
        if (allStepsCompleted) {
          updatedCompletion.status = 'completed';
          updatedCompletion.completedAt = new Date().toISOString();
        }
        
        setOnboardingCompletion(updatedCompletion);
        
        // Show success message for form data saves
        if (formData) {
          toast.success('Your information has been saved!');
        }
      } else {
        toast.error(result.message || 'Failed to save progress');
      }
    } catch (error) {
      console.error('Error saving progress:', error);
      toast.error('Failed to save progress');
    } finally {
      setSavingProgress(false);
    }
  };

  const handleTabComplete = async (tabId: string) => {
    const newCompletedTabs = new Set(completedTabs);
    newCompletedTabs.add(tabId);
    setCompletedTabs(newCompletedTabs);

    // Save progress to database
    const tab = tabs.find(t => t.id === tabId);
    if (tab) {
      await saveProgress(tab.step);
    }

    // Automatically move to next tab if not the last one
    const currentIndex = parseInt(tabId);
    if (currentIndex < tabs.length - 1) {
      setActiveTab((currentIndex + 1).toString());
    }
  };

  // Handle form data completion specifically for the Information tab
  const handleFormComplete = async (tabId: string, formData: any) => {
    const newCompletedTabs = new Set(completedTabs);
    newCompletedTabs.add(tabId);
    setCompletedTabs(newCompletedTabs);

    // Save progress with form data to database
    const tab = tabs.find(t => t.id === tabId);
    if (tab) {
      await saveProgress(tab.step, formData);
    }

    // Automatically move to next tab if not the last one
    const currentIndex = parseInt(tabId);
    if (currentIndex < tabs.length - 1) {
      setActiveTab((currentIndex + 1).toString());
    }
  };

  const isTabEnabled = (tabId: string) => {
    const tabIndex = parseInt(tabId);
    if (tabIndex === 0) return true; // First tab is always enabled
    
    // Check if previous tab is completed
    const previousTabId = (tabIndex - 1).toString();
    return completedTabs.has(previousTabId);
  };

  const getTabStatus = (tabId: string) => {
    if (completedTabs.has(tabId)) return 'completed';
    if (tabId === activeTab) return 'active';
    if (isTabEnabled(tabId)) return 'enabled';
    return 'disabled';
  };

  // Memoize the show AI assistant callback
  const handleShowAIAssistant = useCallback(() => {
    setIsAIPanelVisible(true);
  }, []);

  // Memoize the header action object
  const showAIAction = useMemo(() => ({
    id: 'show-ai-assistant',
    label: 'Show AI Assistant',
    icon: <MessageSquare className="h-4 w-4" />,
    onClick: handleShowAIAssistant,
    variant: 'outline' as const,
    size: 'sm' as const,
  }), [handleShowAIAssistant]);

  // Register/unregister the AI toggle button in the header when panel visibility changes
  useEffect(() => {
    if (!dashboardContext) return;

    if (!isAIPanelVisible) {
      // Register the show AI assistant button when panel is hidden
      dashboardContext.registerHeaderActions([showAIAction]);
    } else {
      // Clear the action when panel is visible
      dashboardContext.registerHeaderActions(null);
    }

    // Cleanup when component unmounts
    return () => {
      dashboardContext.registerHeaderActions(null);
    };
  }, [isAIPanelVisible, showAIAction]);

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

  // Fetch user's applications with their statuses
  const fetchUserApplications = async (userEmail: string) => {
    try {
      setLoadingUserApplications(true);
      const response = await fetch(`/api/applications/user?email=${encodeURIComponent(userEmail)}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch applications: ${response.statusText}`);
      }
      const applications = await response.json();
      setUserApplications(applications);
      return applications;
    } catch (error) {
      console.error('Error fetching user applications:', error);
      toast.error("Failed to load your applications.");
      setUserApplications([]);
      return [];
    } finally {
      setLoadingUserApplications(false);
    }
  };

  // Filter onboarding content based on user's application status
  const filterOnboardingContent = (content: OnboardingContentItem[], applications: any[]) => {
    // Get job IDs where user has "Onboard" status
    const onboardJobIds = applications
      .filter(app => app.status === 'Onboard')
      .map(app => app.job.id);
    
    // Filter content to only show jobs where user has "Onboard" status
    return content.filter(item => onboardJobIds.includes(item.jobId));
  };

  // Load user applications and filter content on authentication
  useEffect(() => {
    const loadUserDataAndFilter = async () => {
      if (!isAuthenticated) {
        toast.error("Please log in to access onboarding.");
        setFilteredOnboardingContent([]);
        return;
      }

      const userEmail = getUserEmailFromToken();
      if (!userEmail) {
        toast.error("Unable to get your email. Please log in again.");
        setFilteredOnboardingContent([]);
        return;
      }

      // Fetch user applications
      const applications = await fetchUserApplications(userEmail);
      
      // Filter available content based on "Onboard" status
      const filtered = filterOnboardingContent(availableContent, applications);
      setFilteredOnboardingContent(filtered);
    };

    // Only run when both authentication is resolved and content is loaded
    if (!loadingContent && availableContent.length >= 0) {
      loadUserDataAndFilter();
    }
  }, [isAuthenticated, availableContent, loadingContent]);

  // Show onboarding content selection screen
  if (!selectedOnboardingId || !onboardingData) {
    return (
      <div className="flex bg-background" style={{ height: 'calc(100vh - 3rem)' }}>
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-auto">
            <div className="max-w-4xl mx-auto px-4 py-8">
              <div className="text-center space-y-4 mb-8">
                <h1 className="text-4xl font-bold text-foreground">Welcome to Your Onboarding Journey</h1>
                <p className="text-xl text-muted-foreground">Select the position you're joining us for to begin your personalized onboarding experience</p>
              </div>

              {loadingContent || loadingUserApplications ? (
                <div className="flex items-center justify-center py-12">
                  <LoaderCircle className="h-8 w-8 animate-spin" />
                  <span className="ml-3 text-lg">
                    {loadingContent ? 'Loading available onboarding content...' : 'Checking your access permissions...'}
                  </span>
                </div>
              ) : !isAuthenticated ? (
                <Card className="p-8 text-center">
                  <CardContent>
                    <ShieldAlert className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground text-lg mb-2">Access Denied</p>
                    <p className="text-sm text-muted-foreground">Please log in to access onboarding content.</p>
                  </CardContent>
                </Card>
              ) : filteredOnboardingContent.length === 0 ? (
                <Card className="p-8 text-center">
                  <CardContent>
                    <ShieldAlert className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground text-lg mb-2">No Onboarding Available</p>
                    <p className="text-sm text-muted-foreground mb-4">
                      You currently don't have access to any onboarding materials.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-6">
                  {filteredOnboardingContent.map((content) => (
                    <Card 
                      key={content.id} 
                      className="cursor-pointer transition-all border hover:border-primary/50 hover:shadow-md"
                    >
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-2xl text-foreground">{content.jobTitle}</CardTitle>
                            <p className="text-muted-foreground mt-2 line-clamp-2">{content.jobDescription}</p>
                          </div>
                          <Badge variant="default" className="ml-4">
                            Ready for Onboarding
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              <span>Updated {new Date(content.updatedAt).toLocaleDateString()}</span>
                            </div>
                            {content.welcomeContent?.roleTitle && (
                              <div>
                                <span className="font-medium">Role:</span> {content.welcomeContent.roleTitle}
                              </div>
                            )}
                            {content.welcomeContent?.department && (
                              <div>
                                <span className="font-medium">Department:</span> {content.welcomeContent.department}
                              </div>
                            )}
                          </div>
                          <Button 
                            onClick={() => handleContentSelection(content)}
                            disabled={loadingOnboarding}
                            className="flex items-center gap-2"
                          >
                            {loadingOnboarding ? (
                              <LoaderCircle className="h-4 w-4 animate-spin" />
                            ) : (
                              <ArrowRight className="h-4 w-4" />
                            )}
                            Start Onboarding
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* AI Assistant Panel */}
        {isAIPanelVisible && (
          <div className="w-96 bg-card border-l border-border flex flex-col" style={{ height: 'calc(100vh - 3rem)' }}>
            <AIAssistantPanel 
              className="h-full" 
              onToggleVisibility={() => setIsAIPanelVisible(false)}
              onboardingData={onboardingData}
            />
          </div>
        )}
      </div>
    );
  }

  // Show onboarding tabs once content is selected
  return (
    <div className="flex bg-background" style={{ height: 'calc(100vh - 3rem)' }}>
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-4 pb-4 pt-2 w-full">
            {/* Back button and progress indicator */}
            <div className="mb-4 flex items-center justify-between">
              
              {/* Progress indicator */}
              {onboardingCompletion && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Progress: {onboardingCompletion.completedSteps.length}/{tabs.length} steps</span>
                  {savingProgress && (
                    <div className="flex items-center gap-1">
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      <span>Saving...</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="sticky top-0 z-10 grid w-full grid-cols-6 bg-card border border-border rounded-lg p-1 h-auto gap-1">
                {tabs.map((tab) => {
                  const status = getTabStatus(tab.id);
                  const Icon = tab.icon;
                  
                  return (
                    <TabsTrigger
                      key={tab.id}
                      value={tab.id}
                      disabled={status === 'disabled'}
                      className={`
                        flex items-center gap-2 px-2 py-2 rounded text-sm font-medium transition-all h-auto
                        data-[state=active]:bg-accent data-[state=active]:text-accent-foreground
                        ${status === 'completed' 
                          ? 'bg-primary/10 text-primary data-[state=active]:bg-primary/10 data-[state=active]:text-primary' 
                          : status === 'disabled'
                            ? 'text-muted-foreground cursor-not-allowed opacity-50'
                            : 'hover:bg-accent/50 text-foreground'
                        }
                      `}
                    >
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      <span className="hidden md:block truncate">{tab.label}</span>
                      {status === 'completed' && <span className="text-primary text-xs">✓</span>}
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              <div className="mt-6">
                {tabs.map((tab) => {
                  const Component = tab.component;
                  return (
                    <TabsContent key={tab.id} value={tab.id} className="mt-0">
                      <Card className="bg-card shadow rounded-lg">
                        <CardContent className="p-0">
                          <Component
                            onComplete={(tab.id === '3' 
                              ? (formData: any) => handleFormComplete(tab.id, formData)
                              : () => handleTabComplete(tab.id)
                            ) as any}
                            isCompleted={completedTabs.has(tab.id)}
                            data={onboardingData}
                            formData={onboardingCompletion?.formResponses}
                          />
                        </CardContent>
                      </Card>
                    </TabsContent>
                  );
                })}
              </div>
            </Tabs>
          </div>
        </div>
      </div>

      {/* AI Assistant Panel */}
      {isAIPanelVisible && (
        <div className="w-96 bg-card border-l border-border flex flex-col" style={{ height: 'calc(100vh - 3rem)' }}>
          <AIAssistantPanel 
            className="h-full" 
            onToggleVisibility={() => setIsAIPanelVisible(false)}
            onboardingData={onboardingData}
          />
        </div>
      )}
    </div>
  );
}
