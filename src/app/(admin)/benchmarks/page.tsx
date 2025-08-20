"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle, Circle, Building2, Target, Save, ArrowLeft, LoaderCircle, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { createJobFromBenchmark } from "@/app/actions";

const industries = [
  "Telecommunications",
  "Technology", 
  "Finance",
  "Healthcare",
  "Retail",
  "Manufacturing",
  "Education",
  "Government",
  "Custom" // Add option for custom input
];

const roles = [
  "Senior Software Engineer",
  "Product Manager",
  "Data Scientist",
  "DevOps Engineer",
  "UX Designer",
  "Business Analyst",
  "Project Manager",
  "Quality Assurance Engineer",
  "Custom" // Add option for custom input
];

interface BenchmarkCompany {
  company: string;
  logo: string;
  responsibilities: string[];
}

interface BenchmarkData {
  companies: BenchmarkCompany[];
}

export default function BenchmarksPage() {
  const [currentScreen, setCurrentScreen] = useState(1);
  const [formData, setFormData] = useState({
    roleName: "",
    industry: "",
    customRole: "",
    customIndustry: ""
  });
  const [selectedResponsibilities, setSelectedResponsibilities] = useState<string[]>([]);
  const [benchmarkData, setBenchmarkData] = useState<BenchmarkData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSearch = async () => {
    if (!getRoleNameValue() || !getIndustryValue()) {
      toast.error("Please select or enter both role and industry");
      return;
    }

    setIsLoading(true);
    // Clear any previously selected responsibilities when starting a new search
    setSelectedResponsibilities([]);
    
    try {
      const response = await fetch('/api/benchmarks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roleName: getRoleNameValue(),
          industry: getIndustryValue()
        }),
      });

      const result = await response.json();

      if (result.success) {
        setBenchmarkData(result.data);
        setCurrentScreen(2);
        toast.success("Benchmark data loaded successfully!");
      } else {
        toast.error(result.error || "Failed to load benchmark data");
      }
    } catch (error) {
      console.error("Error fetching benchmark data:", error);
      toast.error("Failed to fetch benchmark data. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const getRoleNameValue = () => {
    return formData.roleName === "Custom" ? formData.customRole : formData.roleName;
  };

  const getIndustryValue = () => {
    return formData.industry === "Custom" ? formData.customIndustry : formData.industry;
  };

  const toggleResponsibility = (responsibility: string) => {
    setSelectedResponsibilities(prev => 
      prev.includes(responsibility) 
        ? prev.filter(r => r !== responsibility)
        : [...prev, responsibility]
    );
  };

  const removeResponsibility = (responsibility: string) => {
    setSelectedResponsibilities(prev => prev.filter(r => r !== responsibility));
  };

  const handleSave = async () => {
    if (selectedResponsibilities.length === 0) {
      toast.error("Please select at least one responsibility");
      return;
    }

    setIsSaving(true);
    try {
      const result = await createJobFromBenchmark({
        title: getRoleNameValue(),
        selectedResponsibilities,
        industry: getIndustryValue()
      });

      if (result.success) {
        toast.success(result.message || "Job created successfully from benchmark data!");
        // Reset the form
        setSelectedResponsibilities([]);
        setBenchmarkData(null);
        setCurrentScreen(1);
        setFormData({
          roleName: "",
          industry: "",
          customRole: "",
          customIndustry: ""
        });
      } else {
        toast.error(result.message || "Failed to create job from benchmark data");
      }
    } catch (error) {
      console.error("Error saving job from benchmark:", error);
      toast.error("Failed to save job. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  if (currentScreen === 1) {
    return (
      <div className="bg-card shadow rounded-lg p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Role Benchmarking</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Compare role descriptions across top companies in your industry using real-time data
          </p>
        </div>
        
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="role" className="text-sm font-medium text-foreground">Role Name</Label>
              <Select onValueChange={(value) => setFormData(prev => ({ ...prev, roleName: value }))}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a role or choose Custom" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formData.roleName === "Custom" && (
                <div className="mt-2">
                  <Input
                    placeholder="Enter custom role name"
                    value={formData.customRole}
                    onChange={(e) => setFormData(prev => ({ ...prev, customRole: e.target.value }))}
                  />
                </div>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="industry" className="text-sm font-medium text-foreground">Industry</Label>
              <Select onValueChange={(value) => setFormData(prev => ({ ...prev, industry: value }))}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select an industry or choose Custom" />
                </SelectTrigger>
                <SelectContent>
                  {industries.map((industry) => (
                    <SelectItem key={industry} value={industry}>
                      {industry}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formData.industry === "Custom" && (
                <div className="mt-2">
                  <Input
                    placeholder="Enter custom industry"
                    value={formData.customIndustry}
                    onChange={(e) => setFormData(prev => ({ ...prev, customIndustry: e.target.value }))}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-start">
            <Button 
              onClick={handleSearch} 
              disabled={!getRoleNameValue() || !getIndustryValue() || isLoading}
            >
              {isLoading ? (
                <>
                  <LoaderCircle className="animate-spin mr-2 h-4 w-4" />
                  Searching...
                </>
              ) : (
                "Search Benchmarks"
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!benchmarkData) {
    return (
      <div className="bg-card shadow rounded-lg p-6">
        <div className="text-center">
          <p className="text-muted-foreground">No benchmark data available</p>
          <Button 
            onClick={() => {
              setCurrentScreen(1);
              setSelectedResponsibilities([]); // Clear selected items when going back
            }} 
            className="mt-4"
          >
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full">
      {/* Left Panel - Benchmark Results */}
      <div className="flex-1">
        <div className="bg-card shadow rounded-lg p-6 h-full">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => {
                    setCurrentScreen(1);
                    setSelectedResponsibilities([]); // Clear selected items when going back
                  }}
                  className="h-8 w-8 p-0"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <h1 className="text-2xl font-semibold tracking-tight">Benchmark Results</h1>
              </div>
              <p className="text-sm text-muted-foreground">
                {getRoleNameValue()} • {getIndustryValue()} Industry
              </p>
            </div>
          </div>

          <ScrollArea className="h-[calc(100vh-200px)]">
            <div className="space-y-6">
              {benchmarkData.companies.map((company, companyIndex) => (
                <Card key={companyIndex} className="border-border">
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-sm font-semibold">
                        {company.logo}
                      </div>
                      <div>
                        <CardTitle className="text-lg">{company.company}</CardTitle>
                        <CardDescription className="text-sm text-muted-foreground">{getRoleNameValue()}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      {company.responsibilities.map((responsibility, index) => (
                        <div
                          key={index}
                          className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors border border-transparent hover:border-border"
                          onClick={() => toggleResponsibility(responsibility)}
                        >
                          {selectedResponsibilities.includes(responsibility) ? (
                            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                          ) : (
                            <Circle className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                          )}
                          <span className="text-sm leading-relaxed">{responsibility}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Right Panel - Role Description Builder */}
      <div className="w-full lg:w-80">
        <div className="bg-card shadow rounded-lg p-6 h-full">
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold tracking-tight mb-4">Role Description Builder</h2>
              
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Industry:</span>
                  <Badge variant="secondary">{getIndustryValue()}</Badge>
                </div>
                
                <div className="flex items-center gap-2 text-sm">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Role:</span>
                  <Badge variant="secondary">{getRoleNameValue()}</Badge>
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="font-medium mb-3">Selected Responsibilities</h3>
              <div className="text-sm text-muted-foreground mb-3">
                {selectedResponsibilities.length} items selected
              </div>
              
              <ScrollArea className="h-96">
                <div className="space-y-2">
                  {selectedResponsibilities.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">
                      Select responsibilities from the companies to build your role description
                    </p>
                  ) : (
                    selectedResponsibilities.map((responsibility, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-2 p-3 bg-muted/30 rounded-lg border text-sm group hover:bg-muted/50 transition-colors"
                      >
                        <div className="h-1.5 w-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                        <span className="leading-relaxed flex-1">{responsibility}</span>
                        <button
                          onClick={() => removeResponsibility(responsibility)}
                          className="h-5 w-5 rounded-full hover:bg-destructive/10 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                          title="Remove responsibility"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>

            <Button 
              onClick={handleSave}
              disabled={selectedResponsibilities.length === 0 || isSaving}
              className="w-full"
            >
              {isSaving ? (
                <>
                  <LoaderCircle className="animate-spin mr-2 h-4 w-4" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save as Draft
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
