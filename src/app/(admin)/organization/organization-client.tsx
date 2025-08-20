'use client';


import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, Minus, Building2, Users, Edit, Trash2, GripVertical, BarChart2, RotateCcw } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import OrgChart from 'react-orgchart';
import 'react-orgchart/index.css';
import { toast } from 'sonner';
import {
  createDepartment,
  updateDepartment,
  deleteDepartment,
  addJobToDepartment,
  removeJobFromDepartment,
  reorderJobsInDepartment,
  getDepartments,
  getJobVacancies,
  Department
} from '@/app/actions';
import { JobVacancy } from '@/types/database';

// Extended interface for JobVacancy with UI state properties

import { SheetJobDetails } from './sheet-job-details';
import { SheetBenchmarkStructures } from './sheet-benchmark-structures';
import { DialogJobSelector } from './dialog-job-selector';
import { SheetInternalMatcher } from './sheet-internal-matcher';
import { UnassignedJobsSection, JobVacancyWithUIState } from './unassigned-jobs-section';

// Re-export JobVacancyWithUIState for use in other components
export type { JobVacancyWithUIState };


interface OrganizationClientProps {
  initialDepartments: Department[];
  initialJobVacancies: JobVacancy[];
  searchTerm?: string;
  searchField?: 'all' | 'title' | 'jobFamily' | 'description';
  onDataUpdate?: (departments: Department[], jobVacancies: JobVacancy[]) => void;
}

interface DepartmentFormData {
  name: string;
  description: string;
  email: string;
  upperDept?: string;
}

export function OrganizationClient({ initialDepartments, initialJobVacancies, searchTerm = '', searchField = 'all', onDataUpdate }: OrganizationClientProps) {
  const [departments, setDepartments] = useState<Department[]>(initialDepartments);
  const [jobVacancies, setJobVacancies] = useState<JobVacancy[]>(initialJobVacancies);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [formData, setFormData] = useState<DepartmentFormData>({ name: '', description: '', email: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [editingJobPosition, setEditingJobPosition] = useState<string | null>(null);
  const [tempPosition, setTempPosition] = useState<string>('');
  const [selectedJob, setSelectedJob] = useState<JobVacancyWithUIState | null>(null);
  const [isJobSheetOpen, setIsJobSheetOpen] = useState(false);
  const [isFabOpen, setIsFabOpen] = useState(false);
  const [isJobSelectorOpen, setIsJobSelectorOpen] = useState(false);
  const [isBenchmarkSheetOpen, setIsBenchmarkSheetOpen] = useState(false);
  const [isInternalMatcherOpen, setIsInternalMatcherOpen] = useState(false);
  const fabRef = useRef<HTMLDivElement>(null);

  // Zoom and Pan state
  const [scale, setScale] = useState(1);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const orgChartContainerRef = useRef<HTMLDivElement>(null);

  // Click outside handler for FAB menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (fabRef.current && !fabRef.current.contains(event.target as Node) && isFabOpen) {
        setIsFabOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isFabOpen]);

  // Refresh data functions
  const refreshDepartments = async () => {
    try {
      const newDepartments = await getDepartments();
      setDepartments(newDepartments);
      if (onDataUpdate) {
        onDataUpdate(newDepartments, jobVacancies);
      }
      return newDepartments;
    } catch (error) {
      console.error('Failed to refresh departments:', error);
      toast.error('Failed to refresh organization data');
      return departments;
    }
  };

  const refreshJobVacancies = async () => {
    try {
      const newJobVacancies = await getJobVacancies();
      setJobVacancies(newJobVacancies);
      if (onDataUpdate) {
        onDataUpdate(departments, newJobVacancies);
      }
      return newJobVacancies;
    } catch (error) {
      console.error('Failed to refresh job vacancies:', error);
      toast.error('Failed to refresh job data');
      return jobVacancies;
    }
  };

  const refreshData = async () => {
    try {
      const [newDepartments, newJobVacancies] = await Promise.all([
        getDepartments(),
        getJobVacancies()
      ]);
      setDepartments(newDepartments);
      setJobVacancies(newJobVacancies);
      if (onDataUpdate) {
        onDataUpdate(newDepartments, newJobVacancies);
      }
      return { departments: newDepartments, jobVacancies: newJobVacancies };
    } catch (error) {
      console.error('Failed to refresh data:', error);
      toast.error('Failed to refresh data');
      return { departments, jobVacancies };
    }
  };

  // Get unassigned jobs (excluding archived jobs) - still needed for department job assignment
  const unassignedJobs = jobVacancies.filter(job => !job.deptId && job.status !== 'archived');

  // Get jobs for a specific department, sorted by position (excluding archived jobs)
  const getDepartmentJobs = (departmentId: string) => {
    return jobVacancies
      .filter(job => job.deptId === departmentId && job.status !== 'archived')
      .sort((a, b) => (a.deptPosition || 999) - (b.deptPosition || 999));
  };

  // Filter departments based on search
  const filteredDepartments = departments.filter(dept =>
    dept.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (dept.description && dept.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Get root departments (no upper department)
  const rootDepartments = filteredDepartments.filter(dept => !dept.upper_dept);

  // Get child departments
  const getChildDepartments = (parentId: string) => {
    return filteredDepartments.filter(dept => dept.upper_dept === parentId);
  };

  // Get all descendant departments (recursive)
  const getAllDescendants = (departmentId: string): string[] => {
    const descendants: string[] = [];
    const children = departments.filter(dept => dept.upper_dept === departmentId);
    
    for (const child of children) {
      descendants.push(child.id);
      descendants.push(...getAllDescendants(child.id));
    }
    
    return descendants;
  };

  // Get departments that can be safely set as upper department (excluding self and descendants)
  const getValidUpperDepartments = (departmentId: string) => {
    const descendants = getAllDescendants(departmentId);
    return departments.filter(dept => 
      dept.id !== departmentId && // Can't set self as upper
      !descendants.includes(dept.id) // Can't set any descendant as upper
    );
  };

  const handleCreateDepartment = async () => {
    if (!formData.name.trim()) {
      toast.error('Department name is required');
      return;
    }

    setIsLoading(true);
    try {
      const result = await createDepartment({
        name: formData.name,
        description: formData.description || undefined,
        email: formData.email || undefined,
        upper_dept: formData.upperDept || undefined
      });

      if (result.success) {
        toast.success(result.message);
        setIsCreateDialogOpen(false);
        setFormData({ name: '', description: '', email: '' });
        // Refresh data locally
        await refreshDepartments();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Failed to create department');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditDepartment = async () => {
    if (!editingDepartment || !formData.name.trim()) {
      toast.error('Department name is required');
      return;
    }

    setIsLoading(true);
    try {
      const result = await updateDepartment({
        id: editingDepartment.id,
        name: formData.name,
        description: formData.description || undefined,
        email: formData.email || undefined,
        upper_dept: formData.upperDept || undefined
      });

      if (result.success) {
        toast.success(result.message);
        setIsEditDialogOpen(false);
        setEditingDepartment(null);
        setFormData({ name: '', description: '', email: '' });
        // Refresh data locally
        await refreshDepartments();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Failed to update department');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteDepartment = async (departmentId: string) => {
    setIsLoading(true);
    try {
      const result = await deleteDepartment(departmentId);

      if (result.success) {
        toast.success(result.message);
        // Refresh data locally
        await refreshDepartments();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Failed to delete department');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddJobToDepartment = async (departmentId: string, jobId: string) => {
    // Find the highest position in the department
    const deptJobs = getDepartmentJobs(departmentId);
    const nextPosition = deptJobs.length > 0 ? Math.max(...deptJobs.map(j => j.deptPosition || 0)) + 1 : 1;

    setIsLoading(true);
    try {
      const result = await addJobToDepartment(departmentId, jobId, nextPosition.toString());

      if (result.success) {
        toast.success(result.message);
        // Update local state
        setJobVacancies(prev => prev.map(job =>
          job.id === jobId
            ? { ...job, deptId: departmentId, deptPosition: nextPosition }
            : job
        ));
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Failed to add job to department');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveJobFromDepartment = async (jobId: string) => {
    setIsLoading(true);
    try {
      const result = await removeJobFromDepartment(jobId);

      if (result.success) {
        toast.success(result.message);
        // Update local state
        setJobVacancies(prev => prev.map(job =>
          job.id === jobId
            ? { ...job, deptId: undefined, deptPosition: undefined }
            : job
        ));
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Failed to remove job from department');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateJobPosition = async (jobId: string, newPosition: number) => {
    try {
      const result = await reorderJobsInDepartment([{ jobId, position: newPosition }]);
      if (result.success) {
        toast.success('Position updated successfully');
        // Update local state
        setJobVacancies(prev => prev.map(job =>
          job.id === jobId
            ? { ...job, deptPosition: newPosition }
            : job
        ));
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error('Error updating job position:', error);
      toast.error('Failed to update position');
    }
  };

  const handlePositionDoubleClick = (jobId: string, currentPosition: number) => {
    setEditingJobPosition(jobId);
    setTempPosition(currentPosition.toString());
  };

  const handlePositionSave = async (jobId: string) => {
    const newPosition = parseInt(tempPosition);
    if (isNaN(newPosition) || newPosition < 1) {
      toast.error('Position must be a positive number');
      return;
    }

    await handleUpdateJobPosition(jobId, newPosition);
    setEditingJobPosition(null);
    setTempPosition('');
  };

  const handlePositionCancel = () => {
    setEditingJobPosition(null);
    setTempPosition('');
  };

  const handleJobClick = (job: JobVacancyWithUIState) => {
    setSelectedJob(job);
    setIsJobSheetOpen(true);
  };

  const handleJobVacanciesUpdate = (updatedJobs: JobVacancy[]) => {
    setJobVacancies(updatedJobs);
    if (onDataUpdate) {
      onDataUpdate(departments, updatedJobs);
    }
  };

  // Zoom and Pan handlers
  const handleWheel = useCallback((e: React.WheelEvent) => {
    // Prevent default scroll behavior but don't zoom
    // This prevents the page from scrolling when mouse is over the org chart
    // but removes the unintentional zoom behavior
    e.preventDefault();
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) { // Left mouse button
      setIsDragging(true);
      setLastMousePos({ x: e.clientX, y: e.clientY });
      e.preventDefault();
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      const deltaX = e.clientX - lastMousePos.x;
      const deltaY = e.clientY - lastMousePos.y;
      setTranslateX(prev => prev + deltaX);
      setTranslateY(prev => prev + deltaY);
      setLastMousePos({ x: e.clientX, y: e.clientY });
    }
  }, [isDragging, lastMousePos]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      setIsDragging(true);
      setLastMousePos({ x: touch.clientX, y: touch.clientY });
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDragging) {
      const touch = e.touches[0];
      const deltaX = touch.clientX - lastMousePos.x;
      const deltaY = touch.clientY - lastMousePos.y;
      setTranslateX(prev => prev + deltaX);
      setTranslateY(prev => prev + deltaY);
      setLastMousePos({ x: touch.clientX, y: touch.clientY });
      e.preventDefault();
    }
  }, [isDragging, lastMousePos]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  const resetZoomPan = useCallback(() => {
    setScale(1);
    setTranslateX(0);
    setTranslateY(0);
  }, []);

  // Handle click outside to close FAB menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (fabRef.current && !fabRef.current.contains(event.target as Node)) {
        setIsFabOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Global mouse event listeners for drag functionality
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const deltaX = e.clientX - lastMousePos.x;
        const deltaY = e.clientY - lastMousePos.y;
        setTranslateX(prev => prev + deltaX);
        setTranslateY(prev => prev + deltaY);
        setLastMousePos({ x: e.clientX, y: e.clientY });
      }
    };

    const handleGlobalMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDragging, lastMousePos]);

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const { source, destination, draggableId } = result;

    // Only handle reordering within the same department
    if (source.droppableId !== destination.droppableId) return;
    if (source.index === destination.index) return;

    const departmentId = source.droppableId;
    const departmentJobs = getDepartmentJobs(departmentId);

    // Create a new array with reordered jobs
    const reorderedJobs = Array.from(departmentJobs);
    const [movedJob] = reorderedJobs.splice(source.index, 1);
    reorderedJobs.splice(destination.index, 0, movedJob);

    // Create job updates with new positions
    const jobUpdates = reorderedJobs.map((job, index) => ({
      jobId: job.id,
      position: index + 1
    }));

    try {
      const result = await reorderJobsInDepartment(jobUpdates);
      if (result.success) {
        toast.success(result.message);
        // Update local state with new positions
        setJobVacancies(prev => prev.map(job => {
          const update = jobUpdates.find(u => u.jobId === job.id);
          return update ? { ...job, deptPosition: update.position } : job;
        }));
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error("Error reordering jobs:", error);
      toast.error("Failed to reorder jobs");
    }
  };

  const openEditDialog = (department: Department) => {
    setEditingDepartment(department);
    setFormData({
      name: department.name,
      description: department.description || '',
      email: department.email || '',
      upperDept: department.upper_dept || undefined
    });
    setIsEditDialogOpen(true);
  };

  // Transform departments into org chart tree structure
  const buildOrgChartTree = (departments: Department[]): any => {
    const rootDepts = departments.filter(dept => !dept.upper_dept);

    const buildNode = (department: Department, visited: Set<string> = new Set()): any => {
      // Prevent infinite recursion by checking if we've already visited this department
      if (visited.has(department.id)) {
        console.warn(`Circular dependency detected for department: ${department.name} (ID: ${department.id})`);
        return {
          id: department.id,
          name: `${department.name} (Circular Reference)`,
          description: department.description,
          email: department.email,
          jobCount: getDepartmentJobs(department.id).length,
          hasCircularDependency: true
        };
      }

      // Add current department to visited set
      const newVisited = new Set(visited);
      newVisited.add(department.id);

      const children = departments.filter(dept => dept.upper_dept === department.id);
      const node: any = {
        id: department.id,
        name: department.name,
        description: department.description,
        email: department.email,
        jobCount: getDepartmentJobs(department.id).length
      };

      if (children.length > 0) {
        node.children = children.map(child => buildNode(child, newVisited));
      }

      return node;
    };

    try {
      if (rootDepts.length === 1) {
        return buildNode(rootDepts[0]);
      } else if (rootDepts.length > 1) {
        return {
          name: "Organization",
          children: rootDepts.map(dept => buildNode(dept))
        };
      }

      return null;
    } catch (error) {
      console.error('Error building organization chart tree:', error);
      return {
        name: "Organization (Error)",
        description: "There was an error building the organization structure. Please check for circular dependencies.",
        hasError: true
      };
    }
  };

  // Custom node component for react-orgchart
  const OrgChartNode = ({ node }: { node: any }) => {
    const departmentJobs = node.id ? getDepartmentJobs(node.id) : [];

    // Root organization node
    if (!node.id) {
      return (
        <div className={`rounded-lg p-3 shadow-md font-semibold text-center min-w-[200px] mx-4 ${
          node.hasError ? 'bg-destructive text-destructive-foreground' : 'bg-primary text-primary-foreground'
        }`}>
          {node.name}
          {node.hasError && (
            <div className="text-xs mt-1 opacity-90">
              {node.description}
            </div>
          )}
        </div>
      );
    }

    return (
      <div className={`bg-card rounded-lg p-4 shadow-md hover:shadow-lg transition-shadow mx-2 ${
        node.hasCircularDependency ? 'border-2 border-destructive' : 'border-2 border-primary'
      }`} style={{ pointerEvents: 'auto' }}>
        <div className="relative mb-2">
          <div className="flex items-center justify-center gap-2">
            <Building2 className={`h-4 w-4 ${node.hasCircularDependency ? 'text-destructive' : 'text-primary'}`} />
            <h3 className={`font-semibold text-sm ${node.hasCircularDependency ? 'text-destructive' : 'text-card-foreground'}`}>
              {node.name}
            </h3>
          </div>
          {node.hasCircularDependency && (
            <div className="text-xs text-destructive mt-1 text-center">
              ⚠️ Circular Dependency
            </div>
          )}
        </div>

        {node.description && (
          <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{node.description}</p>
        )}

        <div className="flex items-center justify-center">
          {node.email && (
            <span className="text-xs text-muted-foreground truncate max-w-[100px]">{node.email}</span>
          )}
        </div>

        {/* Jobs in this department */}
        {departmentJobs.length > 0 && (
          <div className="pt-2 border-t border-border">
            <div className="space-y-1">
              {departmentJobs.map((job) => {
                const searchLower = searchTerm.toLowerCase();
                let isHighlighted = false;
                
                if (searchTerm) {
                  switch (searchField) {
                    case 'title':
                      isHighlighted = job.title.toLowerCase().includes(searchLower);
                      break;
                    case 'jobFamily':
                      isHighlighted = job.jobFamily ? job.jobFamily.toLowerCase().includes(searchLower) : false;
                      break;
                    case 'description':
                      isHighlighted = job.description ? job.description.toLowerCase().includes(searchLower) : false;
                      break;
                    case 'all':
                    default:
                      isHighlighted = Boolean(
                        job.title.toLowerCase().includes(searchLower) ||
                        (job.jobFamily && job.jobFamily.toLowerCase().includes(searchLower)) ||
                        (job.description && job.description.toLowerCase().includes(searchLower))
                      );
                      break;
                  }
                }
                return (
                  <div
                    key={job.id}
                    className={`flex items-center justify-between text-xs cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5 transition-colors ${
                      isHighlighted ? 'border border-primary' : ''
                    }`}
                    data-interactive="true"
                    style={{ pointerEvents: 'auto' }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('Job clicked:', job.title);
                      handleJobClick(job);
                    }}
                  >
                    <span className="truncate flex-1 mr-1">{job.title}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Add job to department and Edit button */}
        <div className="mt-2 flex items-center gap-2">
          {unassignedJobs.length > 0 && (
            <div className="flex-1">
              <Select onValueChange={(jobId) => handleAddJobToDepartment(node.id, jobId)}>
                <SelectTrigger className="h-6 text-xs">
                  <SelectValue placeholder="Add Role" />
                </SelectTrigger>
                <SelectContent>
                  {unassignedJobs.map((job: JobVacancy) => (
                    <SelectItem key={job.id} value={job.id} className="text-xs">
                      {job.title} ({job.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            style={{ pointerEvents: 'auto' }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('Edit button clicked for node:', node.id);
              const department = departments.find(d => d.id === node.id);
              if (department) {
                console.log('Opening edit dialog for:', department.name);
                openEditDialog(department);
              }
            }}
            className="h-6 w-6 p-0 shrink-0"
          >
            <Edit className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  };

  // Get the org chart tree data
  const orgChartData = buildOrgChartTree(departments);

  const renderDepartmentCard = (department: Department, level: number = 0) => {
    const childDepartments = getChildDepartments(department.id);
    const departmentJobs = getDepartmentJobs(department.id);

    return (
      <div key={department.id} className="relative">
        {/* Connection line for hierarchy */}
        {level > 0 && (
          <div className="absolute -left-6 top-6 w-6 h-px bg-border"></div>
        )}
        {level > 0 && (
          <div className="absolute -left-6 -top-2 w-px h-8 bg-border"></div>
        )}

        <div className={`${level > 0 ? 'ml-12' : ''} mb-6`}>
          <Card className="border-l-4 border-l-primary shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle className="text-lg">{department.name}</CardTitle>
                    {department.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {department.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {departmentJobs.length} jobs
                  </Badge>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(department)}
                      className="h-8 w-8 p-0"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="z-[300] mx-2">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Department</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{department.name}"? This action cannot be undone.
                            All jobs in this department will be unassigned.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteDepartment(department.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-0">
              {/* Jobs in this department */}
              {departmentJobs.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Positions ({departmentJobs.length})
                  </h4>
                  <Droppable droppableId={department.id}>
                    {(provided) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className="space-y-2"
                      >
                        {departmentJobs.map((job, index) => (
                          <Draggable key={job.id} draggableId={job.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={`flex items-center justify-between bg-muted/50 rounded-md ${snapshot.isDragging ? 'shadow-lg' : ''
                                  }`}
                              >
                                <div className="flex items-center gap-2">
                                  <div {...provided.dragHandleProps}>
                                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                                  </div>
                                  {editingJobPosition === job.id ? (
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-primary">#</span>
                                      <input
                                        type="number"
                                        value={tempPosition}
                                        onChange={(e) => setTempPosition(e.target.value)}
                                        onBlur={() => handlePositionSave(job.id)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            handlePositionSave(job.id);
                                          } else if (e.key === 'Escape') {
                                            handlePositionCancel();
                                          }
                                        }}
                                        className="w-12 h-6 text-xs bg-primary/10 text-primary px-1 rounded border-0 focus:ring-1 focus:ring-primary"
                                        autoFocus
                                        min="1"
                                      />
                                    </div>
                                  ) : (
                                    <span
                                      className="text-xs bg-primary/10 text-primary px-2 py-1 rounded cursor-pointer hover:bg-primary/20 transition-colors"
                                      onDoubleClick={() => handlePositionDoubleClick(job.id, job.deptPosition || index + 1)}
                                      title="Double-click to edit position"
                                    >
                                      #{job.deptPosition || index + 1}
                                    </span>
                                  )}
                                  <span
                                    className="text-sm font-medium cursor-pointer hover:text-primary transition-colors"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleJobClick(job);
                                    }}
                                  >{job.title}</span>
                                  <Badge variant={job.status === 'published' ? 'default' : 'secondary'} className="text-xs">
                                    {job.status}
                                  </Badge>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveJobFromDepartment(job.id)}
                                  disabled={isLoading}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              )}

              {/* Add job to department */}
              {unassignedJobs.length > 0 && (
                <div className="mb-4">
                  <Select onValueChange={(jobId) => handleAddJobToDepartment(department.id, jobId)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Add job to department" />
                    </SelectTrigger>
                    <SelectContent>
                      {unassignedJobs.map((job: JobVacancy) => (
                        <SelectItem key={job.id} value={job.id}>
                          {job.title} ({job.status})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Render child departments */}
          {childDepartments.length > 0 && (
            <div className="mt-4 relative">
              {childDepartments.map((childDept, index) => (
                <div key={childDept.id} className="relative">
                  {/* Vertical line connecting to children */}
                  {index === 0 && (
                    <div className="absolute -left-6 top-0 w-px h-4 bg-border"></div>
                  )}
                  {renderDepartmentCard(childDept, level + 1)}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="space-y-6">

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="z-[200]">
            <DialogHeader>
              <DialogTitle>Edit Department</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-name" className="mb-2">Department Name</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter department name"
                />
              </div>
              <div>
                <Label htmlFor="edit-description" className="mb-2">Description</Label>
                <Textarea
                  id="edit-description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter department description"
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="edit-email" className="mb-2">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="Enter department email"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-upperDept" className='mb-2'>Upper Department</Label>
                  <Select
                    value={formData.upperDept || 'none'}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, upperDept: value === 'none' ? undefined : value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select upper department (optional)" />
                    </SelectTrigger>
                    <SelectContent className="z-[250]">
                      <SelectItem value="none">No upper department</SelectItem>
                      {editingDepartment && getValidUpperDepartments(editingDepartment.id)
                        .map((dept) => (
                          <SelectItem key={dept.id} value={dept.id}>
                            {dept.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                {/* <div>
                  <Label htmlFor="edit-lowerDept" className='mb-2'>Lower Departments</Label>
                  <Select
                    value="none"
                    onValueChange={(value) => console.log('Lower dept selected:', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Manage lower departments" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No lower departments</SelectItem>
                      {departments
                        .filter(dept => dept.upper_dept === editingDepartment?.id)
                        .map((dept) => (
                          <SelectItem key={dept.id} value={dept.id}>
                            {dept.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div> */}
              </div>
              <div className="flex justify-between">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      disabled={isLoading}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="z-[300]">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Department</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete "{editingDepartment?.name}"? This action cannot be undone.
                        All jobs in this department will be unassigned.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => {
                          if (editingDepartment) {
                            handleDeleteDepartment(editingDepartment.id);
                            setIsEditDialogOpen(false);
                          }
                        }}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsEditDialogOpen(false)}
                    disabled={isLoading}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleEditDepartment} disabled={isLoading}>
                    {isLoading ? 'Updating...' : 'Update'}
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Organization Structure - Full Width */}
        <div className="mb-8">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Organization Structure
                </CardTitle>
                <div className="relative flex justify-end" ref={fabRef}>
                  {/* Main FAB button */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        className={`rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 group z-60 ${isFabOpen ? 'rotate-45 scale-110 shadow-lg' : ''}`}
                        size="icon"
                        onClick={() => setIsFabOpen(!isFabOpen)}
                        style={{ pointerEvents: 'auto' }}
                      >
                        <Plus className="h-5 w-5 transition-transform duration-200" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Actions</p>
                    </TooltipContent>
                  </Tooltip>

                  {/* Backdrop overlay when FAB is open - removed to prevent blocking other interactions */}

                  {/* Floating action buttons */}
                  <div className="absolute top-full right-0 mt-2 space-y-2 z-60 flex flex-col items-end" style={{ pointerEvents: 'auto' }}>
                    {/* Create Department Button */}
                    <div className={`transition-all duration-200 w-full ${isFabOpen ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}`}>
                      <Button
                        className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 flex items-center gap-2 ml-auto"
                        onClick={() => {
                          setIsCreateDialogOpen(true);
                          setIsFabOpen(false);
                        }}
                      >
                        <span className="ml-2">Create Department</span>
                        <Building2 className="h-4 w-4 mr-2" />
                      </Button>
                    </div>

                    {/* Internal Matcher Button */}
                    <div className={`transition-all duration-200 w-full ${isFabOpen ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}`}>
                      <Button
                        className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 flex items-center gap-2 ml-auto"
                        onClick={() => {
                          setIsInternalMatcherOpen(true);
                          setIsFabOpen(false);
                        }}
                      >
                        <span className="ml-2">Internal Matcher</span>
                        <Users className="h-4 w-4 mr-2" />
                      </Button>
                    </div>

                    {/* Benchmark Structures Button */}
                     <div className={`transition-all duration-200 w-full ${isFabOpen ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}`}>
                       <Button
                         className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 flex items-center gap-2 ml-auto"
                         onClick={() => {
                           setIsBenchmarkSheetOpen(true);
                           setIsFabOpen(false);
                         }}
                       >
                         <span className="ml-2">Benchmark Structures</span>
                         <BarChart2 className="h-4 w-4 mr-2" />
                       </Button>
                     </div>
                  </div>
                </div>
                <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                  <DialogContent className="z-[200]">
                    <DialogHeader>
                      <DialogTitle>Create New Department</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="name" className='mb-2'>Department Name</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="Enter department name"
                        />
                      </div>
                      <div>
                        <Label htmlFor="description" className='mb-2'>Description</Label>
                        <Textarea
                          id="description"
                          value={formData.description}
                          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                          placeholder="Enter department description"
                          rows={3}
                        />
                      </div>
                      <div>
                        <Label htmlFor="email" className='mb-2'>Email</Label>
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                          placeholder="Enter department email"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="upperDept" className='mb-2'>Upper Department</Label>
                          <Select
                            value={formData.upperDept || 'none'}
                            onValueChange={(value) => setFormData(prev => ({ ...prev, upperDept: value === 'none' ? undefined : value }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select upper department (optional)" />
                            </SelectTrigger>
                            <SelectContent className="z-[250]">
                              <SelectItem value="none">No upper department</SelectItem>
                              {departments.map((dept) => (
                                <SelectItem key={dept.id} value={dept.id}>
                                  {dept.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {/* <div>
                        <Label htmlFor="lowerDept" className='mb-2'>Lower Departments</Label>
                        <Select
                          value="none"
                          onValueChange={(value) => console.log('Lower dept selected:', value)}
                          disabled
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Available after creation" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No lower departments</SelectItem>
                          </SelectContent>
                        </Select>
                      </div> */}
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          onClick={() => setIsCreateDialogOpen(false)}
                          disabled={isLoading}
                        >
                          Cancel
                        </Button>
                        <Button onClick={handleCreateDepartment} disabled={isLoading}>
                          {isLoading ? 'Creating...' : 'Create Department'}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="relative w-full h-[600px] overflow-hidden border rounded-lg">
                {orgChartData ? (
                  <>
                    {/* Zoom Controls */}
                    <div className="absolute bottom-4 right-4 z-60 flex flex-col gap-2" style={{ pointerEvents: 'auto' }}>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setScale(prev => Math.min(3, prev + 0.2))}
                        className="w-8 h-8 p-0"
                        title="Zoom in"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setScale(prev => Math.max(0.1, prev - 0.2))}
                        className="w-8 h-8 p-0"
                        title="Zoom out"
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={resetZoomPan}
                        className="w-8 h-8 p-0"
                        title="Reset zoom and pan"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    {/* Zoomable and Pannable Container */}
                    <div
                      ref={orgChartContainerRef}
                      className="w-full h-full cursor-grab active:cursor-grabbing"
                      onWheel={handleWheel}
                      onMouseDown={(e) => {
                        // Only handle mouse down if it's not on an interactive element
                        const target = e.target as HTMLElement;
                        if (target.closest('button') || target.closest('[data-interactive]')) {
                          return;
                        }
                        handleMouseDown(e);
                      }}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUp}
                      onTouchStart={handleTouchStart}
                      onTouchMove={handleTouchMove}
                      onTouchEnd={handleTouchEnd}
                      style={{
                        transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
                        transformOrigin: 'center center',
                        transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                        zIndex: 5
                      }}
                    >
                      <div className="min-w-full flex justify-center items-start pt-8">
                        <OrgChart tree={orgChartData} NodeComponent={OrgChartNode} />
                      </div>
                    </div>
                    
                    {/* Instructions */}
                    {/* <div className="absolute bottom-4 left-4 text-xs text-muted-foreground bg-background/80 p-2 rounded">
                      Scroll to zoom • Drag to pan
                    </div> */}
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full text-center text-muted-foreground">
                    <div>
                      <Building2 className="h-16 w-16 mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-medium">No departments found</p>
                      <p className="text-sm">Create your first department to get started</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Unassigned Jobs Section - Bottom */}
        <UnassignedJobsSection
          jobVacancies={jobVacancies}
          onJobClick={handleJobClick}
          onJobVacanciesUpdate={handleJobVacanciesUpdate}
          searchTerm={searchTerm}
          searchField={searchField}
        />
      </div>

      {/* Job Details Sheet */}
      <SheetJobDetails
        job={selectedJob}
        isOpen={isJobSheetOpen}
        onOpenChange={setIsJobSheetOpen}
      />

      {/* Job Selector Dialog for Internal Matcher */}
      <DialogJobSelector
        isOpen={isJobSelectorOpen}
        onOpenChange={(open) => {
          setIsJobSelectorOpen(open);

          // Hide for bugs on UI popup

          // // If dialog is closed without selecting a job, ensure we don't have a lingering state
          // if (!open && !isJobSheetOpen) {
          //   setSelectedJob(null);
          // }
          
          // Hide for bugs on UI popup
        }}
        jobs={jobVacancies.filter(job => job.status !== 'archived')}
        onJobSelect={(job) => {
          // Create a new object that extends JobVacancy with our UI state property
          const jobWithUIState: JobVacancyWithUIState = {
            ...job,
            _internalMatcherTab: true
          };
          setSelectedJob(jobWithUIState);
          setIsJobSheetOpen(true);
        }}
      />

      {/* Benchmark Structures Sheet */}
      <SheetBenchmarkStructures
        isOpen={isBenchmarkSheetOpen}
        onOpenChange={setIsBenchmarkSheetOpen}
        currentStructure={orgChartData}
      />

      {/* Internal Matcher Sheet */}
       <SheetInternalMatcher
         isOpen={isInternalMatcherOpen}
         onOpenChange={setIsInternalMatcherOpen}
       />
    </DragDropContext>
  );
}