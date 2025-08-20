'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Plus, Trash2, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Department } from '@/app/actions';
import { JobVacancy } from '@/types/database';
import { cn } from '@/lib/utils';

interface DepartmentNodeData extends Record<string, unknown> {
  id: string;
  name: string;
  description: string;
  assignedJobs: string[];
  onUpdate: (id: string, data: Partial<DepartmentNodeData>) => void;
  onDelete: (id: string) => void;
  onAddChild: (parentId: string) => void;
  onAddParent: (childId: string) => void;
  availableJobs: JobVacancy[];
  isCreatingChild?: boolean;
  isCreatingParent?: boolean;
}

export function DepartmentNode(props: NodeProps) {
  const { data } = props;
  const typedData = data as DepartmentNodeData;
  const [name, setName] = useState(typedData.name);
  const [description, setDescription] = useState(typedData.description);
  const [assignedJobs, setAssignedJobs] = useState<string[]>(typedData.assignedJobs || []);
  const [isJobSearchOpen, setIsJobSearchOpen] = useState(false);
  const [jobSearchQuery, setJobSearchQuery] = useState('');
  const [isHoveringTopPlus, setIsHoveringTopPlus] = useState(false);
  const [isHoveringBottomPlus, setIsHoveringBottomPlus] = useState(false);
  
  const nameTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const descriptionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced name update
  useEffect(() => {
    if (nameTimeoutRef.current) {
      clearTimeout(nameTimeoutRef.current);
    }
    
    nameTimeoutRef.current = setTimeout(() => {
      if (name !== typedData.name) {
        typedData.onUpdate(typedData.id, { name });
      }
    }, 1000);

    return () => {
      if (nameTimeoutRef.current) {
        clearTimeout(nameTimeoutRef.current);
      }
    };
  }, [name, typedData]);

  // Debounced description update
  useEffect(() => {
    if (descriptionTimeoutRef.current) {
      clearTimeout(descriptionTimeoutRef.current);
    }
    
    descriptionTimeoutRef.current = setTimeout(() => {
      if (description !== typedData.description) {
        typedData.onUpdate(typedData.id, { description });
      }
    }, 1000);

    return () => {
      if (descriptionTimeoutRef.current) {
        clearTimeout(descriptionTimeoutRef.current);
      }
    };
  }, [description, typedData]);

  const handleNameChange = useCallback((value: string) => {
    setName(value);
  }, []);

  const handleDescriptionChange = useCallback((value: string) => {
    setDescription(value);
  }, []);

  const handleAddJob = useCallback((jobId: string) => {
    if (!assignedJobs.includes(jobId)) {
      const newAssignedJobs = [...assignedJobs, jobId];
      setAssignedJobs(newAssignedJobs);
      typedData.onUpdate(typedData.id, { assignedJobs: newAssignedJobs });
    }
    setIsJobSearchOpen(false);
    setJobSearchQuery('');
  }, [assignedJobs, typedData]);

  const handleRemoveJob = useCallback((jobId: string) => {
    const newAssignedJobs = assignedJobs.filter(id => id !== jobId);
    setAssignedJobs(newAssignedJobs);
    typedData.onUpdate(typedData.id, { assignedJobs: newAssignedJobs });
  }, [assignedJobs, typedData]);

  const filteredJobs = typedData.availableJobs.filter(job => 
    job.title.toLowerCase().includes(jobSearchQuery.toLowerCase()) &&
    !assignedJobs.includes(job.id)
  );

  const getJobTitle = (jobId: string) => {
    const job = typedData.availableJobs.find(j => j.id === jobId);
    return job?.title || 'Unknown Job';
  };

  return (
    <div className="relative">
      {/* Top Plus Button */}
      <button
        className={cn(
          "absolute -top-6 left-1/2 transform -translate-x-1/2 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center transition-opacity duration-200 hover:bg-primary/90 z-10",
          isHoveringTopPlus ? "opacity-100" : "opacity-50",
          typedData.isCreatingParent && "opacity-30 cursor-not-allowed"
        )}
        onMouseEnter={() => setIsHoveringTopPlus(true)}
        onMouseLeave={() => setIsHoveringTopPlus(false)}
        onClick={() => !typedData.isCreatingParent && typedData.onAddParent(typedData.id)}
        disabled={typedData.isCreatingParent}
        title={typedData.isCreatingParent ? "Creating parent department..." : "Add parent department"}
      >
        <Plus className="w-4 h-4" />
      </button>

      {/* Main Node */}
      <div className="bg-card border border-border rounded-lg p-4 shadow-md min-w-[280px] max-w-[320px]">
        <Handle
          type="target"
          position={Position.Top}
          className="w-3 h-3 !bg-primary"
        />
        
        {/* Header with delete button */}
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1">
            <Input
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Department name"
              className="font-semibold text-base border-none p-0 h-auto focus-visible:ring-0 bg-transparent"
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => typedData.onDelete(typedData.id)}
            className="text-destructive hover:text-destructive hover:bg-destructive/10 p-1 h-auto"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>

        {/* Description */}
        <div className="mb-4">
          <Textarea
            value={description}
            onChange={(e) => handleDescriptionChange(e.target.value)}
            placeholder="Department description"
            className="min-h-[60px] resize-none text-sm"
          />
        </div>

        {/* Assigned Jobs */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium">Assigned Jobs</label>
            <Popover open={isJobSearchOpen} onOpenChange={setIsJobSearchOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 px-2">
                  <Plus className="w-3 h-3 mr-1" />
                  Add Job
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="end">
                <div className="p-3 border-b">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search jobs..."
                      value={jobSearchQuery}
                      onChange={(e) => setJobSearchQuery(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {filteredJobs.length > 0 ? (
                    filteredJobs.map((job) => (
                      <button
                        key={job.id}
                        onClick={() => handleAddJob(job.id)}
                        className="w-full text-left px-3 py-2 hover:bg-muted text-sm border-b last:border-b-0"
                      >
                        <div className="font-medium">{job.title}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {job.description || 'No description available'}
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                      {jobSearchQuery ? 'No jobs found' : 'No available jobs'}
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>
          
          <div className="space-y-1 max-h-24 overflow-y-auto">
            {assignedJobs.length > 0 ? (
              assignedJobs.map((jobId) => (
                <div key={jobId} className="flex items-center justify-between bg-muted rounded px-2 py-1">
                  <span className="text-xs truncate flex-1">{getJobTitle(jobId)}</span>
                  <button
                    onClick={() => handleRemoveJob(jobId)}
                    className="ml-1 text-muted-foreground hover:text-destructive"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))
            ) : (
              <div className="text-xs text-muted-foreground text-center py-2">
                No jobs assigned
              </div>
            )}
          </div>
        </div>

        <Handle
          type="source"
          position={Position.Bottom}
          className="w-3 h-3 !bg-primary"
        />
      </div>

      {/* Bottom Plus Button */}
      <button
        className={cn(
          "absolute -bottom-6 left-1/2 transform -translate-x-1/2 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center transition-opacity duration-200 hover:bg-primary/90 z-10",
          isHoveringBottomPlus ? "opacity-100" : "opacity-50",
          typedData.isCreatingChild && "opacity-30 cursor-not-allowed"
        )}
        onMouseEnter={() => setIsHoveringBottomPlus(true)}
        onMouseLeave={() => setIsHoveringBottomPlus(false)}
        onClick={() => !typedData.isCreatingChild && typedData.onAddChild(typedData.id)}
        disabled={typedData.isCreatingChild}
        title={typedData.isCreatingChild ? "Creating child department..." : "Add child department"}
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
}