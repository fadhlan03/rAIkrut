'use client';

import * as React from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search } from "lucide-react";
import { JobVacancy } from "@/types/database";

interface DialogJobSelectorProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  jobs: JobVacancy[];
  onJobSelect: (job: JobVacancy) => void;
}

export function DialogJobSelector({ isOpen, onOpenChange, jobs, onJobSelect }: DialogJobSelectorProps) {
  const [searchQuery, setSearchQuery] = React.useState('');
  
  // Filter jobs based on search query
  const filteredJobs = jobs.filter(job =>
    job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (job.description && job.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Internal Matcher - Select a Job</DialogTitle>
          <DialogDescription>
            Choose a job to analyze with the Internal Matcher tool. This will help you find similar jobs in your organization.
          </DialogDescription>
        </DialogHeader>
        
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search jobs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        {/* Job List */}
        <ScrollArea className="h-[300px] pr-4">
          {filteredJobs.length > 0 ? (
            <div className="space-y-2">
              {filteredJobs.map((job) => (
                <div 
                  key={job.id} 
                  className="p-3 border rounded-lg hover:bg-muted cursor-pointer transition-colors"
                  onClick={() => {
                    onJobSelect(job);
                    onOpenChange(false);
                  }}
                >
                  <h4 className="font-medium text-sm">{job.title}</h4>
                  {job.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                      {job.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>No jobs found matching your search.</p>
            </div>
          )}
        </ScrollArea>
        
        <DialogFooter className="sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}