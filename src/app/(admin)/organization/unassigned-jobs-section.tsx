'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Users, ChevronLeft, ChevronRight } from 'lucide-react';
import { JobVacancy } from '@/types/database';
import { getDepartments, getJobFamilies, bulkUpdateJobs, Department } from '@/app/actions';
import { toast } from 'sonner';

export interface JobVacancyWithUIState extends JobVacancy {
  _internalMatcherTab?: boolean;
}

interface UnassignedJobsSectionProps {
  jobVacancies: JobVacancy[];
  onJobClick: (job: JobVacancyWithUIState) => void;
  onJobVacanciesUpdate?: (updatedJobs: JobVacancy[]) => void;
  searchTerm?: string;
  searchField?: 'all' | 'title' | 'jobFamily' | 'description';
}

const PAGE_SIZE_OPTIONS = [12, 24, 48, 96] as const;
type PageSize = typeof PAGE_SIZE_OPTIONS[number];

export function UnassignedJobsSection({ jobVacancies, onJobClick, onJobVacanciesUpdate, searchTerm = '', searchField = 'all' }: UnassignedJobsSectionProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(24);
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());
  const [departments, setDepartments] = useState<Department[]>([]);
  const [jobFamilies, setJobFamilies] = useState<string[]>([]);
  const [isLoadingDepartments, setIsLoadingDepartments] = useState(true);
  const [isLoadingJobFamilies, setIsLoadingJobFamilies] = useState(true);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [isJobFamilySelectOpen, setIsJobFamilySelectOpen] = useState(false);
  const [pendingCustomJobFamily, setPendingCustomJobFamily] = useState<string | null>(null);

  // Fetch departments and job families on component mount
  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const depts = await getDepartments();
        setDepartments(depts);
      } catch (error) {
        console.error('Failed to fetch departments:', error);
      } finally {
        setIsLoadingDepartments(false);
      }
    };
    
    const fetchJobFamilies = async () => {
      try {
        const families = await getJobFamilies();
        setJobFamilies(families);
      } catch (error) {
        console.error('Failed to fetch job families:', error);
      } finally {
        setIsLoadingJobFamilies(false);
      }
    };
    
    fetchDepartments();
    fetchJobFamilies();
  }, []);

  // Helper functions for job selection
  const handleJobSelect = (jobId: string, checked: boolean) => {
    setSelectedJobs(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(jobId);
      } else {
        newSet.delete(jobId);
      }
      return newSet;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedJobs(new Set(paginatedJobs.map(job => job.id)));
    } else {
      setSelectedJobs(new Set());
    }
  };

  // Bulk update functions
  const handleBulkUpdateDepartment = async (deptId: string) => {
    if (selectedJobs.size === 0) return;
    
    setIsBulkUpdating(true);
    try {
      const result = await bulkUpdateJobs({
        jobIds: Array.from(selectedJobs),
        deptId: deptId === '__none__' ? undefined : deptId
      });
      
      if (result.success) {
        toast.success(result.message);
        setSelectedJobs(new Set());
        // Update job vacancies locally instead of full page reload
        if (onJobVacanciesUpdate) {
          const updatedJobs = jobVacancies.map(job => {
            if (selectedJobs.has(job.id)) {
              return { ...job, deptId: deptId === '__none__' ? undefined : deptId };
            }
            return job;
          });
          onJobVacanciesUpdate(updatedJobs);
        }
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Failed to update job departments');
    } finally {
      setIsBulkUpdating(false);
    }
  };

  // Handle setting custom job family value after jobFamilies is updated
  useEffect(() => {
    if (pendingCustomJobFamily && jobFamilies.includes(pendingCustomJobFamily)) {
      handleBulkUpdateJobFamily(pendingCustomJobFamily);
      setPendingCustomJobFamily(null);
      setIsJobFamilySelectOpen(false);
    }
  }, [jobFamilies, pendingCustomJobFamily]);

  const handleBulkUpdateJobFamily = async (jobFamily: string) => {
    if (selectedJobs.size === 0) return;
    
    setIsBulkUpdating(true);
    try {
      const result = await bulkUpdateJobs({
        jobIds: Array.from(selectedJobs),
        jobFamily: jobFamily === '__none__' ? undefined : jobFamily
      });
      
      if (result.success) {
        toast.success(result.message);
        setSelectedJobs(new Set());
        // Update job vacancies locally instead of full page reload
        if (onJobVacanciesUpdate) {
          const updatedJobs = jobVacancies.map(job => {
            if (selectedJobs.has(job.id)) {
              return { ...job, jobFamily: jobFamily === '__none__' ? undefined : jobFamily };
            }
            return job;
          });
          onJobVacanciesUpdate(updatedJobs);
        }
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Failed to update job families');
    } finally {
      setIsBulkUpdating(false);
    }
  };

  // Get unassigned jobs (excluding archived jobs)
  const allUnassignedJobs = useMemo(() => {
    return jobVacancies.filter(job => !job.deptId && job.status !== 'archived');
  }, [jobVacancies]);

  // Filter jobs based on search term and selected field
  const filteredJobs = useMemo(() => {
    if (!searchTerm) return allUnassignedJobs;
    const searchLower = searchTerm.toLowerCase();
    return allUnassignedJobs.filter(job => {
      switch (searchField) {
        case 'title':
          return job.title.toLowerCase().includes(searchLower);
        case 'jobFamily':
          return job.jobFamily ? job.jobFamily.toLowerCase().includes(searchLower) : false;
        case 'description':
          return job.description ? job.description.toLowerCase().includes(searchLower) : false;
        case 'all':
        default:
          return (
            job.title.toLowerCase().includes(searchLower) ||
            (job.jobFamily && job.jobFamily.toLowerCase().includes(searchLower)) ||
            (job.description && job.description.toLowerCase().includes(searchLower))
          );
      }
    });
  }, [allUnassignedJobs, searchTerm, searchField]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredJobs.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedJobs = filteredJobs.slice(startIndex, endIndex);

  // Reset to first page when search changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, pageSize]);

  const handleJobClick = (job: JobVacancy) => {
    onJobClick(job as JobVacancyWithUIState);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Scroll to top of section when page changes
    document.getElementById('unassigned-jobs-section')?.scrollIntoView({ 
      behavior: 'smooth', 
      block: 'start' 
    });
  };

  const handlePageSizeChange = (newPageSize: string) => {
    setPageSize(Number(newPageSize) as PageSize);
    setCurrentPage(1);
  };

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  return (
    <div id="unassigned-jobs-section">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Unassigned Jobs ({allUnassignedJobs.length})
              {filteredJobs.length !== allUnassignedJobs.length && (
                <span className="text-sm font-normal text-muted-foreground">
                  ({filteredJobs.length} filtered)
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Bulk Actions */}
              {selectedJobs.size > 0 && (
                <>
                  <div className="flex items-center gap-2 mr-4">
                    <Checkbox
                      checked={selectedJobs.size === paginatedJobs.length && paginatedJobs.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                    <span className="text-sm text-muted-foreground">
                      {selectedJobs.size} selected
                    </span>
                  </div>
                  
                  <Select onValueChange={handleBulkUpdateDepartment} disabled={isBulkUpdating}>
                    <SelectTrigger className="w-40 h-8">
                      <SelectValue placeholder="Set Department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No Department</SelectItem>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Select onValueChange={handleBulkUpdateJobFamily} disabled={isBulkUpdating} open={isJobFamilySelectOpen} onOpenChange={setIsJobFamilySelectOpen}>
                    <SelectTrigger className="w-40 h-8">
                      <SelectValue placeholder="Set Job Family" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No Job Family</SelectItem>
                      {jobFamilies.map((family) => (
                        <SelectItem key={family} value={family}>
                          {family}
                        </SelectItem>
                      ))}
                      <div className="p-2 border-t">
                        <Input
                          placeholder="Type custom job family..."
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const customValue = e.currentTarget.value.trim();
                              if (customValue) {
                                e.currentTarget.value = '';
                                
                                if (jobFamilies.includes(customValue)) {
                                  // Value already exists, use it directly
                                  handleBulkUpdateJobFamily(customValue);
                                  setIsJobFamilySelectOpen(false);
                                } else {
                                  // Add to jobFamilies list and set pending value
                                  setJobFamilies(prev => [...prev, customValue].sort());
                                  setPendingCustomJobFamily(customValue);
                                }
                              }
                            }
                          }}
                          className="text-sm"
                        />
                        <p className="text-xs text-muted-foreground mt-1">Press Enter to add custom job family</p>
                      </div>
                    </SelectContent>
                  </Select>
                </>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredJobs.length > 0 ? (
            <>
              {/* Jobs Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
                {paginatedJobs.map((job) => (
                  <div 
                    key={job.id} 
                    className="p-4 border rounded-lg hover:shadow-md transition-shadow cursor-pointer relative"
                    onClick={() => handleJobClick(job)}
                  >
                    <div className="absolute top-2 right-2">
                      <Checkbox
                        checked={selectedJobs.has(job.id)}
                        onCheckedChange={(checked) => handleJobSelect(job.id, checked as boolean)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div className="space-y-2 pr-8">
                      <h4 className="font-medium text-sm">{job.title}</h4>
                      <p className="text-xs text-muted-foreground line-clamp-3">
                        {job.description}
                      </p>
                      <Badge variant={job.jobFamily ? 'default' : 'secondary'} className="text-xs">
                        {job.jobFamily}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Showing {startIndex + 1}-{Math.min(endIndex, filteredJobs.length)} of {filteredJobs.length} jobs
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    
                    <div className="flex items-center gap-1">
                      {getPageNumbers().map((page, index) => (
                        <React.Fragment key={index}>
                          {page === '...' ? (
                            <span className="px-2 py-1 text-sm text-muted-foreground">...</span>
                          ) : (
                            <Button
                              variant={currentPage === page ? 'default' : 'outline'}
                              size="sm"
                              className="w-8 h-8 p-0"
                              onClick={() => handlePageChange(page as number)}
                            >
                              {page}
                            </Button>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              {searchTerm ? (
                <>
                  <p className="text-lg font-medium">No jobs found</p>
                  <p className="text-sm">Try adjusting your search terms or clear the search to see all jobs.</p>
                </>
              ) : (
                <>
                  <p className="text-lg font-medium">All jobs are assigned</p>
                  <p className="text-sm">Great! Every position has been assigned to a department.</p>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}