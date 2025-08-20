'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search } from 'lucide-react';
import { getDepartments, getJobVacancies, Department } from '@/app/actions';
import { JobVacancy } from '@/types/database';
import { OrganizationClient } from './organization-client';

export default function OrganizationPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [jobVacancies, setJobVacancies] = useState<JobVacancy[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchField, setSearchField] = useState<'all' | 'title' | 'jobFamily' | 'description'>('jobFamily');
  const [isLoading, setIsLoading] = useState(true);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Generate suggestions based on search field and term
  const suggestions = useMemo(() => {
    if (!searchTerm || (searchField !== 'title' && searchField !== 'jobFamily')) {
      return [];
    }

    const field = searchField === 'title' ? 'title' : 'jobFamily';
    const uniqueValues = new Set<string>();
    
    // Only include non-archived jobs (same filtering as organization client)
    jobVacancies
      .filter(job => job.status !== 'archived')
      .forEach(job => {
        const value = job[field];
        if (value && typeof value === 'string' && 
            value.toLowerCase().includes(searchTerm.toLowerCase())) {
          uniqueValues.add(value);
        }
      });

    return Array.from(uniqueValues)
      .sort((a, b) => {
        // Prioritize exact matches and those starting with the search term
        const aLower = a.toLowerCase();
        const bLower = b.toLowerCase();
        const termLower = searchTerm.toLowerCase();
        
        if (aLower === termLower) return -1;
        if (bLower === termLower) return 1;
        if (aLower.startsWith(termLower) && !bLower.startsWith(termLower)) return -1;
        if (bLower.startsWith(termLower) && !aLower.startsWith(termLower)) return 1;
        
        return a.localeCompare(b);
      })
      .slice(0, 8); // Limit to 8 suggestions
  }, [searchTerm, searchField, jobVacancies]);

  // Fetch departments and job vacancies data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [deptData, jobsData] = await Promise.all([
          getDepartments(),
          getJobVacancies()
        ]);
        setDepartments(deptData);
        setJobVacancies(jobsData);
      } catch (error) {
        console.error('Failed to load organization data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Handle data updates from OrganizationClient
  const handleDataUpdate = (newDepartments: Department[], newJobVacancies: JobVacancy[]) => {
    setDepartments(newDepartments);
    setJobVacancies(newJobVacancies);
  };

  // Handle click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node) &&
          searchInputRef.current && !searchInputRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
        setSelectedSuggestionIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle search input changes
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    setSelectedSuggestionIndex(-1);
    
    // Show suggestions for title and jobFamily fields when there's input
    if (value && (searchField === 'title' || searchField === 'jobFamily')) {
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  // Handle keyboard navigation in suggestions
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedSuggestionIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedSuggestionIndex(prev => 
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedSuggestionIndex >= 0) {
          selectSuggestion(suggestions[selectedSuggestionIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedSuggestionIndex(-1);
        break;
    }
  };

  // Handle suggestion selection
  const selectSuggestion = (suggestion: string) => {
    setSearchTerm(suggestion);
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
    searchInputRef.current?.blur();
  };

  // Handle search field change
  const handleSearchFieldChange = (value: 'all' | 'title' | 'jobFamily' | 'description') => {
    setSearchField(value);
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
    // Clear search term when switching to/from fields that don't support suggestions
    if (value === 'all' || value === 'description') {
      setSearchTerm('');
    }
  };

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-muted-foreground">Loading organization data...</div>
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Organization Structure</h1>
            <p className="text-muted-foreground">
              Manage your organization's hierarchical structure and assign jobs to departments.
            </p>
          </div>
          <div className="flex items-center gap-2 relative z-[80]" style={{ pointerEvents: 'auto' }}>
            <Select value={searchField} onValueChange={handleSearchFieldChange}>
              <SelectTrigger className="w-32 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[90]">
                <SelectItem value="all">All Fields</SelectItem>
                <SelectItem value="title">Job Title</SelectItem>
                <SelectItem value="jobFamily">Job Family</SelectItem>
                <SelectItem value="description">Description</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                placeholder={`Search ${searchField === 'all' ? 'jobs' : searchField === 'jobFamily' ? 'job family' : searchField}...`}
                value={searchTerm}
                onChange={handleSearchChange}
                onKeyDown={handleKeyDown}
                onFocus={() => {
                  if (searchTerm && (searchField === 'title' || searchField === 'jobFamily')) {
                    setShowSuggestions(true);
                  }
                }}
                className="pl-9 w-64 h-8"
                autoComplete="off"
              />
              
              {/* Suggestions dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div 
                  ref={suggestionsRef}
                  className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg z-[90] max-h-48 overflow-y-auto"
                >
                  {suggestions.map((suggestion, index) => (
                    <div
                      key={suggestion}
                      className={`px-3 py-2 cursor-pointer text-sm hover:bg-accent hover:text-accent-foreground ${
                        index === selectedSuggestionIndex ? 'bg-accent text-accent-foreground' : 'text-popover-foreground'
                      }`}
                      onClick={() => selectSuggestion(suggestion)}
                      onMouseEnter={() => setSelectedSuggestionIndex(index)}
                    >
                      {suggestion}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      <OrganizationClient 
        initialDepartments={departments} 
        initialJobVacancies={jobVacancies}
        searchTerm={searchTerm}
        searchField={searchField}
        onDataUpdate={handleDataUpdate}
      />
    </div>
  );
}