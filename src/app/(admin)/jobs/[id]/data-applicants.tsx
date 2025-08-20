"use client";

import * as React from "react";
import {
  Column,
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  Row,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  LoaderCircle,
  FileText,
  InfoIcon,
  Check,
  X,
  Users,
  CalendarIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { Candidate, ApplicationStatus, ScoringResult } from "@/types/database";
import { ScoringDetailsSheet } from "./sheet-scoring-details";
import { toast } from "sonner";



// Reusable component for sorting buttons in table headers
interface DataTableColumnHeaderProps<
  TData,
  TValue
> extends React.HTMLAttributes<HTMLDivElement> {
  column: Column<TData, TValue>;
  title: string;
}

function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) {
    return <div className={cn(className)}>{title}</div>;
  }

  return (
    <div className={cn("flex items-center space-x-2", className)}>
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3 h-8 data-[state=open]:bg-accent"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        <span>{title}</span>
        {column.getIsSorted() === "desc" ? (
          <ArrowDown className="ml-2 size-4" />
        ) : column.getIsSorted() === "asc" ? (
          <ArrowUp className="ml-2 size-4" />
        ) : (
          <ArrowUpDown className="ml-2 size-4" />
        )}
      </Button>
    </div>
  );
}

// Extended Candidate type for this table, including application-specific fields
interface ApplicantData extends Candidate {
  application_status_for_this_job?: ApplicationStatus;
  application_date_for_this_job?: string;
  application_id: string;
  decision?: string;
  overall_score?: number;
  referralName?: string;
  referralEmail?: string;
  referralPosition?: string;
  referralDept?: string;
}

export const columns = (
  openResumeInNewTab: (candidateId: string, candidateName: string) => void
): ColumnDef<ApplicantData>[] => [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
        className="translate-y-[2px]"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
        className="translate-y-[2px]"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    id: "rank",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Rank" />
    ),
    cell: ({ row, table }) => {
      const sortedData = table.getSortedRowModel().rows;
      const rank = sortedData.findIndex(r => r.id === row.id) + 1;
      return (
        <span className="text-sm font-medium">{rank}</span>
      );
    },
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "full_name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
    cell: ({ row }) => (
      <span className="font-medium max-w-[200px] truncate block">{row.original.full_name}</span>
    ),
    enableSorting: true,
  },
  {
    accessorKey: "application_status_for_this_job",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="App. Status" />
    ),
    cell: ({ row }) => (
      <span className="text-sm max-w-[150px] truncate block text-muted-foreground">
        {row.original.application_status_for_this_job || '-'}
      </span>
    ),
    enableSorting: true,
  },
  {
    accessorKey: "application_date_for_this_job",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Applied On" />
    ),
    cell: ({ row }) => {
      const dateStr = row.original.application_date_for_this_job;
      if (!dateStr) return <span className="text-sm text-muted-foreground">-</span>;
      const date = new Date(dateStr);
      const day = date.getDate().toString().padStart(2, '0');
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const month = monthNames[date.getMonth()];
      const year = date.getFullYear();
      return <span className="text-sm">{`${day} ${month} ${year}`}</span>;
    },
    enableSorting: true,
  },
  {
    accessorKey: "referralName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Referral" />
    ),
    cell: ({ row }) => {
      const hasReferral = !!(row.original.referralName && row.original.referralName.trim());
      return (
        <div className="flex justify-center">
          {hasReferral ? (
            <Check className="h-4 w-4 text-green-600" />
          ) : (
            <X className="h-4 w-4 text-gray-400" />
          )}
        </div>
      );
    },
    enableSorting: true,
    sortingFn: (rowA, rowB, columnId) => {
      const hasReferralA = !!(rowA.original.referralName && rowA.original.referralName.trim());
      const hasReferralB = !!(rowB.original.referralName && rowB.original.referralName.trim());
      if (hasReferralA === hasReferralB) return 0;
      return hasReferralA ? -1 : 1; // Referrals first when sorting ascending
    },
  },
  {
    accessorKey: "overall_score",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Score" />
    ),
    cell: ({ row }) => {
      const score = row.original.overall_score;
      return (
        <Badge variant="info" className="text-xs">
          {typeof score === 'number' ? `${Math.round((score / 5) * 100)}%` : '-'}
        </Badge>
      );
    },
    enableSorting: true,
  },
  {
    id: "latest_education_level",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Latest Edu Level" />
    ),
    accessorFn: (row) => row.education?.[0]?.level,
    cell: ({ getValue }) => (
      <span className="text-sm max-w-[150px] truncate block text-muted-foreground">{getValue() as string || '-'}</span>
    ),
    enableSorting: true,
  },
  {
    accessorKey: "has_resume",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Resume" />
    ),
    cell: ({ row }) => {
      if (row.original.has_resume) {
        return (
          <Button
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation(); // Prevent row click if button is clicked
              openResumeInNewTab(row.original.id, row.original.full_name);
            }}
            aria-label={`View resume for ${row.original.full_name}`}
            className="p-1 h-auto"
          >
            <FileText className="size-5 text-primary hover:text-primary/80" />
          </Button>
        );
      }
      return <span className="text-sm text-muted-foreground">-</span>;
    },
    enableSorting: true,
  },
  {
    accessorKey: "job_applications_count", // Total applications by this candidate
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Total Apps" />
    ),
    cell: ({ row }) => (
      <span className="text-sm">{row.original.job_applications_count !== undefined ? row.original.job_applications_count : '-'}</span>
    ),
    enableSorting: true,
  },

  {
    accessorKey: "decision",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Assessment" />
    ),
    cell: ({ row }) => (
      <span className="text-sm max-w-[120px] truncate block text-muted-foreground">
        {row.original.decision || '-'}
      </span>
    ),
    enableSorting: true,
  },
];

// Define Props interface
interface DataTableApplicantsProps {
  data: ApplicantData[];
  loading: boolean;
  error: string | null;
  jobTitle?: string;
  selectedApplicationId: string | null;
  onApplicationIdChange: (applicationId: string | null) => void;
  onDataRefresh?: () => void;
}

export function DataTableApplicants({ data, loading, error, jobTitle, selectedApplicationId, onApplicationIdChange, onDataRefresh }: DataTableApplicantsProps) {
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "overall_score", desc: true }]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [referralFilter, setReferralFilter] = React.useState<string>("all");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [scoreFilter, setScoreFilter] = React.useState<string>("all");
  const [decisionFilter, setDecisionFilter] = React.useState<string>("all");
  const [dateRange, setDateRange] = React.useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({ from: undefined, to: undefined });
  const [rowSelection, setRowSelection] = React.useState({});
  const [bulkStatus, setBulkStatus] = React.useState<ApplicationStatus | "">("");
  const [isUpdatingBulk, setIsUpdatingBulk] = React.useState(false);
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  });

  // State for the combined sheet
  const [isCombinedSheetOpen, setIsCombinedSheetOpen] = React.useState(false);
  const [selectedApplicantForSheet, setSelectedApplicantForSheet] = React.useState<ApplicantData | null>(null);
  const [scoringDetailsForSheet, setScoringDetailsForSheet] = React.useState<ScoringResult | null>(null);
  const [detailedCandidateForSheet, setDetailedCandidateForSheet] = React.useState<Candidate | null>(null);
  const [isLoadingCombinedSheet, setIsLoadingCombinedSheet] = React.useState(false);

  const openResumeInNewTab = async (candidateId: string, candidateName: string) => {
    try {
      console.log(`Fetching resume URL for ${candidateName} (ID: ${candidateId})`);
      const response = await fetch(`/api/candidates/${candidateId}/resume`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        alert(`Could not load resume: ${errorData.error || response.statusText}`);
        return;
      }
      const data: { fileUrl: string } = await response.json();
      if (!data.fileUrl) {
        alert("Could not load resume: File URL was not provided.");
        return;
      }
      window.open(data.fileUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error("Error fetching resume URL:", err);
      alert("An unexpected error occurred while trying to load the resume.");
    }
  };

  // New handleRowClick to fetch both candidate and scoring details for the combined sheet
  const handleRowClick = async (applicantRow: Row<ApplicantData>) => {
    const applicant = applicantRow.original;
    if (!applicant.application_id) {
      console.error("Application ID is missing for the applicant.");
      alert("Cannot load applicant details: Application ID not found.");
      return;
    }
    if (!applicant.id) {
      console.error("Candidate ID is missing for the applicant.");
      alert("Cannot load applicant details: Candidate ID not found.");
      return;
    }

    setSelectedApplicantForSheet(applicant);
    setIsLoadingCombinedSheet(true);
    setScoringDetailsForSheet(null);
    setDetailedCandidateForSheet(null);
    setIsCombinedSheetOpen(true);
    onApplicationIdChange(applicant.application_id); // Update URL parameter

    try {
      const scoringPromise = fetch(`/api/applications/${applicant.application_id}/scoring`).then(res => {
        if (!res.ok) {
          return res.json().catch(() => ({ message: "Failed to parse scoring error" })).then(errData => {
            throw new Error(`Scoring details: ${errData.error || errData.message || res.statusText}`);
          });
        }
        return res.json();
      });

      const candidatePromise = fetch(`/api/candidates/${applicant.id}`).then(res => {
        if (!res.ok) {
          return res.json().catch(() => ({ message: "Failed to parse candidate error" })).then(errData => {
            throw new Error(`Candidate details: ${errData.error || errData.message || res.statusText}`);
          });
        }
        return res.json();
      });

      const [scoringData, candidateData] = await Promise.all([scoringPromise, candidatePromise]);

      setScoringDetailsForSheet(scoringData as ScoringResult);
      setDetailedCandidateForSheet(candidateData as Candidate);

    } catch (err) {
      console.error("Error fetching details for sheet:", err);
      const message = err instanceof Error ? err.message : "An unexpected error occurred.";
      alert(`Could not load all details: ${message}`);
      setIsCombinedSheetOpen(false); // Close sheet on error
      onApplicationIdChange(null); // Clear URL parameter on error
    } finally {
      setIsLoadingCombinedSheet(false);
    }
  };

  // Effect to handle URL parameter changes
  React.useEffect(() => {
    if (selectedApplicationId && data.length > 0) {
      const applicantForId = data.find(applicant => applicant.application_id === selectedApplicationId);
      if (applicantForId) {
        handleRowClick({ original: applicantForId } as Row<ApplicantData>);
      }
    } else if (!selectedApplicationId) {
      setIsCombinedSheetOpen(false);
      setSelectedApplicantForSheet(null);
    }
  }, [selectedApplicationId, data]);

  // Bulk status update function
  const handleBulkStatusUpdate = async (statusToUpdate?: ApplicationStatus) => {
    const selectedRows = table.getFilteredSelectedRowModel().rows;
    if (selectedRows.length === 0) {
      toast.error("Please select at least one application to update");
      return;
    }
    
    const targetStatus = statusToUpdate || bulkStatus;
    if (!targetStatus) {
      toast.error("Please select a status to update to");
      return;
    }

    setIsUpdatingBulk(true);
    const applicationIds = selectedRows.map(row => row.original.application_id);
    
    try {
      // Update each application status
      const updatePromises = applicationIds.map(applicationId =>
        fetch(`/api/applications/${applicationId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: targetStatus }),
        })
      );

      const results = await Promise.allSettled(updatePromises);
      
      // Check for any failures
      const failures = results.filter(result => result.status === 'rejected');
      const successes = results.filter(result => result.status === 'fulfilled');

      if (failures.length === 0) {
        toast.success(`Successfully updated ${successes.length} application(s)`);
        // Clear selection after successful update
        setRowSelection({});
        setBulkStatus("");
        // Refresh the data from parent component
        if (onDataRefresh) {
          onDataRefresh();
        }
      } else {
        toast.error(`${successes.length} succeeded, ${failures.length} failed to update`);
      }
    } catch (error) {
      console.error('Bulk update error:', error);
      toast.error('An error occurred during bulk update');
    } finally {
      setIsUpdatingBulk(false);
    }
  };

  const processedData = React.useMemo(() => {
    let filteredData = [...data];

    // Apply referral filter
    if (referralFilter === "with-referral") {
      filteredData = filteredData.filter(applicant =>
        !!(applicant.referralName && applicant.referralName.trim())
      );
    } else if (referralFilter === "without-referral") {
      filteredData = filteredData.filter(applicant =>
        !(applicant.referralName && applicant.referralName.trim())
      );
    }

    // Apply status filter
    if (statusFilter !== "all") {
      filteredData = filteredData.filter(applicant =>
        applicant.application_status_for_this_job === statusFilter
      );
    }

    // Apply score filter (percentage ranges)
    if (scoreFilter !== "all") {
      filteredData = filteredData.filter(applicant => {
        if (applicant.overall_score === undefined || applicant.overall_score === null) {
          return false;
        }
        const percentage = Math.round((applicant.overall_score / 5) * 100);
        
        switch (scoreFilter) {
          case "90+":
            return percentage >= 90;
          case "80+":
            return percentage >= 80;
          case "70+":
            return percentage >= 70;
          case "60+":
            return percentage >= 60;
          case "50+":
            return percentage >= 50;
          case "<50":
            return percentage < 50;
          default:
            return true;
        }
      });
    }

    // Apply decision filter
    if (decisionFilter !== "all") {
      if (decisionFilter === "no-decision") {
        filteredData = filteredData.filter(applicant =>
          !applicant.decision || applicant.decision.trim() === ""
        );
      } else {
        filteredData = filteredData.filter(applicant =>
          applicant.decision === decisionFilter
        );
      }
    }

    // Apply date range filter
    if (dateRange.from || dateRange.to) {
      filteredData = filteredData.filter(applicant => {
        if (!applicant.application_date_for_this_job) return false;
        
        const applicationDate = new Date(applicant.application_date_for_this_job);

        // Check if application date is after the 'from' date (if specified)
        const isAfterFrom = dateRange.from
          ? applicationDate >= new Date(new Date(dateRange.from).setHours(0, 0, 0, 0))
          : true;

        // Check if application date is before the 'to' date (if specified)
        const isBeforeTo = dateRange.to
          ? applicationDate <= new Date(new Date(dateRange.to).setHours(23, 59, 59, 999))
          : true;

        return isAfterFrom && isBeforeTo;
      });
    }

    return filteredData;
  }, [data, referralFilter, statusFilter, scoreFilter, decisionFilter, dateRange]);

  const tableColumns = React.useMemo(() => columns(openResumeInNewTab), [openResumeInNewTab]);

  const table = useReactTable({
    data: processedData,
    columns: tableColumns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      pagination,
      rowSelection,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    globalFilterFn: (row, columnId, filterValue) => {
      // If empty query, return all rows
      if (!filterValue.trim()) return true;
      
      const applicant = row.original as ApplicantData;
      
      // Helper function to check if a field contains a term
      const fieldContains = (field: string | undefined, term: string): boolean => {
        return String(field ?? '').toLowerCase().includes(term.toLowerCase());
      };
      
      // Helper function to check if any searchable field contains the term
      const anyFieldContains = (term: string): boolean => {
        return (
          fieldContains(applicant.full_name, term) ||
          fieldContains(applicant.education?.[0]?.level, term) ||
          fieldContains(applicant.application_status_for_this_job, term) ||
          fieldContains(applicant.decision, term) ||
          fieldContains(applicant.referralName, term) ||
          fieldContains(applicant.referralEmail, term) ||
          fieldContains(applicant.referralPosition, term) ||
          fieldContains(applicant.referralDept, term)
        );
      };
      
      // Skip processing for very short queries that are likely incomplete
      if (filterValue.length < 3) {
        return false;
      }
      
      // Check if the query is a boolean search
      if (filterValue.includes(' AND ') || filterValue.includes(' OR ') || filterValue.includes(' NOT ') || 
          (filterValue.includes('"') && filterValue.split('"').length > 2)) {
        
        // Preserve parentheses for proper boolean evaluation
        let processedQuery = filterValue;
        
        // Replace parentheses with special markers to preserve them during processing
        const parenthesesMap: Record<string, string> = {};
        let parenthesesCounter = 0;
        
        // Extract and preserve parenthetical expressions
        while (processedQuery.includes('(') && processedQuery.includes(')')) {
          const openIndex = processedQuery.lastIndexOf('(');
          const closeIndex = processedQuery.indexOf(')', openIndex);
          
          if (openIndex === -1 || closeIndex === -1) break;
          
          const parenthetical = processedQuery.substring(openIndex, closeIndex + 1);
          const marker = `__PAREN_${parenthesesCounter}__`;
          parenthesesMap[marker] = parenthetical;
          
          processedQuery = processedQuery.substring(0, openIndex) + 
                          marker + 
                          processedQuery.substring(closeIndex + 1);
          
          parenthesesCounter++;
        }
        
        // Process NOT operators
        const notTerms = processedQuery.match(/NOT\s+"([^"]+)"/g) || [];
        const notResults: Record<string, boolean> = {};
        
        notTerms.forEach((notTerm: string, index: number) => {
          const term = notTerm.match(/NOT\s+"([^"]+)"/)?.[ 1 ];
          if (term) {
            const marker = `__NOT_${index}__`;
            notResults[marker] = !anyFieldContains(term);
            processedQuery = processedQuery.replace(notTerm, marker);
          }
        });
        
        // Process quoted terms
        const quotedTerms = processedQuery.match(/"([^"]+)"/g) || [];
        const quotedResults: Record<string, boolean> = {};
        
        quotedTerms.forEach((quotedTerm: string, index: number) => {
          const term = quotedTerm.match(/"([^"]+)"/)?.[ 1 ];
          if (term) {
            const marker = `__TERM_${index}__`;
            quotedResults[marker] = anyFieldContains(term);
            processedQuery = processedQuery.replace(quotedTerm, marker);
          }
        });
        
        // Process AND/OR operators
        processedQuery = processedQuery
          .replace(/ AND /g, ' && ')
          .replace(/ OR /g, ' || ');
        
        // Clean up any remaining terms that weren't in quotes
        const remainingTerms = processedQuery.match(/[^\s&|()_]+/g) || [];
        remainingTerms.forEach((term: string) => {
          if (!['true', 'false', '&&', '||'].includes(term) && 
              !term.startsWith('__NOT_') && 
              !term.startsWith('__TERM_') && 
              !term.startsWith('__PAREN_')) {
            processedQuery = processedQuery.replace(new RegExp(`\\b${term}\\b`, 'g'), anyFieldContains(term).toString());
          }
        });
        
        // Replace NOT and term placeholders with their results
        Object.entries(notResults).forEach(([marker, result]: [string, boolean]) => {
          processedQuery = processedQuery.replace(new RegExp(marker, 'g'), result.toString());
        });
        
        Object.entries(quotedResults).forEach(([marker, result]: [string, boolean]) => {
          processedQuery = processedQuery.replace(new RegExp(marker, 'g'), result.toString());
        });
        
        Object.entries(quotedResults).forEach(([marker, result]) => {
          processedQuery = processedQuery.replace(new RegExp(marker, 'g'), result.toString());
        });
        
        // Process parenthetical expressions recursively
        let allParenthesesProcessed = false;
        while (!allParenthesesProcessed) {
          const parenMarkers = Object.keys(parenthesesMap);
          allParenthesesProcessed = true;
          
          for (const marker of parenMarkers) {
            if (processedQuery.includes(marker)) {
              allParenthesesProcessed = false;
              
              // Get the original parenthetical expression
              let parenExpr = parenthesesMap[marker];
              
              // Remove the outer parentheses
              parenExpr = parenExpr.substring(1, parenExpr.length - 1);
              
              // Recursively evaluate the expression inside parentheses
              try {
                // Replace any remaining markers in the parenthetical expression
                Object.entries(notResults).forEach(([m, result]) => {
                  parenExpr = parenExpr.replace(new RegExp(m, 'g'), result.toString());
                });
                
                Object.entries(quotedResults).forEach(([m, result]) => {
                  parenExpr = parenExpr.replace(new RegExp(m, 'g'), result.toString());
                });
                
                // Validate and sanitize parenthetical expression before evaluation
                const isValidParenExpr = (expr: string): boolean => {
                  // Check for balanced operators
                  const operators = (expr.match(/&&|\|\|/g) || []).length;
                  const operands = (expr.match(/true|false/g) || []).length;
                  
                  // Basic validation: operands should be at least operators + 1
                  if (operands < operators + 1) return false;
                  
                  // Check for incomplete expressions
                  if (expr.endsWith('&&') || expr.endsWith('||')) return false;
                  if (expr.startsWith('&&') || expr.startsWith('||')) return false;
                  
                  // Check for any unexpected characters that could cause syntax errors
                  if (/[^\s\w&|()_true\\false]/.test(expr.replace(/\|\|/g, ''))) return false;
                  
                  return true;
                };
                
                // Sanitize the expression
                const sanitizeExpression = (expr: string): string => {
                  // Remove invalid characters
                  let sanitized = expr.replace(/[^\s\w&|()_truefalse]/g, '');
                  
                  // Fix common syntax issues that could cause evaluation errors
                  sanitized = sanitized
                    // Remove spaces between operators
                    .replace(/\s+&&\s+/g, ' && ')
                    .replace(/\s+\|\|\s+/g, ' || ')
                    // Ensure no trailing/leading operators
                    .replace(/^\s*&&\s*/g, '')
                    .replace(/^\s*\|\|\s*/g, '')
                    .replace(/\s*&&\s*$/g, '')
                    .replace(/\s*\|\|\s*$/g, '')
                    // Fix doubled operators
                    .replace(/&&\s*&&/g, '&&')
                    .replace(/\|\|\s*\|\|/g, '||')
                    .replace(/&&\s*\|\|/g, '&&')
                    .replace(/\|\|\s*&&/g, '||');
                    
                  return sanitized;
                };
                
                // Apply sanitization
                parenExpr = sanitizeExpression(parenExpr);
                
                if (isValidParenExpr(parenExpr)) {
                  // Use a safer evaluation approach instead of new Function
                  const evaluateExpression = (expr: string): boolean => {
                    // Replace all boolean literals and operators with their JavaScript equivalents
                    const normalizedExpr = expr
                      .replace(/\btrue\b/g, '1')
                      .replace(/\bfalse\b/g, '0')
                      .replace(/&&/g, '*')
                      .replace(/\|\|/g, '+');
                    
                    // Use a simple mathematical evaluation which is safer than new Function
                    try {
                      // Add additional safeguards for edge cases
                      if (!normalizedExpr.trim() || 
                          normalizedExpr.includes('**') || 
                          normalizedExpr.includes('//')) {
                        return false;
                      }
                      
                      // Wrap in try-catch to handle any remaining evaluation errors
                      try {
                        // Convert result back to boolean (any non-zero value is true)
                        const result = eval(normalizedExpr);
                        return typeof result === 'number' ? Boolean(result) : false;
                      } catch {
                        return false;
                      }
                    } catch {
                      return false;
                    }
                  };
                  
                  const parenResult = evaluateExpression(parenExpr);
                  processedQuery = processedQuery.replace(marker, parenResult.toString());
                } else {
                  // For invalid expressions during typing, replace with false without error
                  processedQuery = processedQuery.replace(marker, 'false');
                }
              } catch (e) {
                console.error('Error evaluating parenthetical expression:', e);
                processedQuery = processedQuery.replace(marker, 'false');
              }
            }
          }
        }
        
        // Validate and sanitize the processed query before evaluation
        const isValidExpression = (expr: string): boolean => {
          // Check for balanced operators
          const operators = (expr.match(/&&|\|\|/g) || []).length;
          const operands = (expr.match(/true|false/g) || []).length;
          
          // Basic validation: operands should be at least operators + 1
          if (operands < operators + 1) return false;
          
          // Check for incomplete expressions
          if (expr.endsWith('&&') || expr.endsWith('||')) return false;
          if (expr.startsWith('&&') || expr.startsWith('||')) return false;
          
          // Check for invalid syntax patterns
          if (expr.includes('&&&&') || expr.includes('||||') || 
              expr.includes('&&||') || expr.includes('||&&')) return false;
          
          // Check for any unexpected characters that could cause syntax errors
          if (/[^\s\w&|()_true\\false]/.test(expr.replace(/\|\|/g, ''))) return false;
              
          return true;
        };
        
        // Sanitize the query to ensure it only contains valid boolean expression characters
        const sanitizeExpression = (expr: string): string => {
          // Remove invalid characters
          let sanitized = expr.replace(/[^\s\w&|()_truefalse]/g, '');
          
          // Fix common syntax issues that could cause evaluation errors
          sanitized = sanitized
            // Remove spaces between operators
            .replace(/\s+&&\s+/g, ' && ')
            .replace(/\s+\|\|\s+/g, ' || ')
            // Ensure no trailing/leading operators
            .replace(/^\s*&&\s*/g, '')
            .replace(/^\s*\|\|\s*/g, '')
            .replace(/\s*&&\s*$/g, '')
            .replace(/\s*\|\|\s*$/g, '')
            // Fix doubled operators
            .replace(/&&\s*&&/g, '&&')
            .replace(/\|\|\s*\|\|/g, '||')
            .replace(/&&\s*\|\|/g, '&&')
            .replace(/\|\|\s*&&/g, '||');
            
          return sanitized;
        };
        
        // Apply sanitization
        processedQuery = sanitizeExpression(processedQuery);
        
        try {
          // Only evaluate if the expression appears valid
          if (isValidExpression(processedQuery)) {
            // Use a safer evaluation approach instead of new Function
            const evaluateExpression = (expr: string): boolean => {
              // Replace all boolean literals and operators with their JavaScript equivalents
              const normalizedExpr = expr
                .replace(/\btrue\b/g, '1')
                .replace(/\bfalse\b/g, '0')
                .replace(/&&/g, '*')
                .replace(/\|\|/g, '+');
              
              // Use a simple mathematical evaluation which is safer than new Function
              try {
                // Add additional safeguards for edge cases
                if (!normalizedExpr.trim() || 
                    normalizedExpr.includes('**') || 
                    normalizedExpr.includes('//')) {
                  return false;
                }
                
                // Wrap in try-catch to handle any remaining evaluation errors
                try {
                  // Convert result back to boolean (any non-zero value is true)
                  const result = eval(normalizedExpr);
                  return typeof result === 'number' ? Boolean(result) : false;
                } catch {
                  return false;
                }
              } catch {
                return false;
              }
            };
            
            return evaluateExpression(processedQuery);
          } else {
            // For invalid expressions during typing, return false without error
            return false;
          }
        } catch (e) {
          console.error('Error evaluating boolean search:', e);
          return false;
        }
      } else {
        // Standard search (no boolean operators)
        const query = filterValue.toLowerCase();
        return anyFieldContains(query);
      }
    },
  });

  if (loading && !data.length) {
    return (
      <div className="flex flex-col gap-4 h-64 w-full items-center justify-center p-4">
        <LoaderCircle className="h-16 w-16 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading Applicants...</span>
      </div>
    );
  }

  if (error) {
    return <div className="text-destructive p-4 text-center">Error: {error}</div>;
  }

  return (
    <>
      <div className="flex w-full flex-col justify-start gap-4">
        <div className="flex flex-col gap-2 px-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap py-1">
            <div className="flex items-center gap-2">
              <Select value={referralFilter} onValueChange={setReferralFilter}>
                <SelectTrigger className="w-[140px]" id="referral-filter">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Referral</SelectItem>
                  <SelectItem value="with-referral">With Referral</SelectItem>
                  <SelectItem value="without-referral">Without Referral</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[130px]" id="status-filter">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Reviewed">Reviewed</SelectItem>
                  <SelectItem value="Interviewing">Interviewing</SelectItem>
                  <SelectItem value="Shortlisted">Shortlisted</SelectItem>
                  <SelectItem value="Offered">Offered</SelectItem>
                  <SelectItem value="Hired">Hired</SelectItem>
                  <SelectItem value="Onboard">Onboard</SelectItem>
                  <SelectItem value="Rejected">Rejected</SelectItem>
                  <SelectItem value="Withdrawn">Withdrawn</SelectItem>
                  <SelectItem value="On Hold">On Hold</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Select value={scoreFilter} onValueChange={setScoreFilter}>
                <SelectTrigger className="w-[120px]" id="score-filter">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Scores</SelectItem>
                  <SelectItem value="90+">90%+</SelectItem>
                  <SelectItem value="80+">80%+</SelectItem>
                  <SelectItem value="70+">70%+</SelectItem>
                  <SelectItem value="60+">60%+</SelectItem>
                  <SelectItem value="50+">50%+</SelectItem>
                  <SelectItem value="<50">&lt;50%</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Select value={decisionFilter} onValueChange={setDecisionFilter}>
                <SelectTrigger className="w-[120px]" id="decision-filter">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Results</SelectItem>
                  <SelectItem value="no-decision">No Decision</SelectItem>
                  <SelectItem value="Accept">Accept</SelectItem>
                  <SelectItem value="Reject">Reject</SelectItem>
                  <SelectItem value="Consider">Consider</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-[200px] justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange.from ? (
                      dateRange.to ? (
                        <>
                          {dateRange.from.toLocaleDateString()} -{" "}
                          {dateRange.to.toLocaleDateString()}
                        </>
                      ) : (
                        dateRange.from.toLocaleDateString()
                      )
                    ) : (
                      <span>Pick a date range</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange.from}
                    selected={dateRange}
                    onSelect={(range) => {
                      setDateRange({
                        from: range?.from,
                        to: range?.to,
                      });
                    }}
                    numberOfMonths={2}
                  />
                  <div className="flex justify-between p-3 border-t">
                     <Button
                       variant="outline"
                       size="sm"
                       onClick={() => setDateRange({ from: undefined, to: undefined })}
                     >
                       Clear
                     </Button>
                   </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Bulk Status Update Section */}
            {table.getFilteredSelectedRowModel().rows.length > 0 && (
              <div className="flex items-center gap-2 border-l pl-4 ml-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="bulk-status" className="whitespace-nowrap text-sm font-medium">
                  Update {table.getFilteredSelectedRowModel().rows.length} selected:
                </Label>
                <Select value={bulkStatus} onValueChange={async (value: ApplicationStatus | "") => {
                  if (value && !isUpdatingBulk) {
                    setBulkStatus(value);
                    await handleBulkStatusUpdate(value as ApplicationStatus);
                  }
                }}>
                  <SelectTrigger className="w-[130px]" id="bulk-status" disabled={isUpdatingBulk}>
                    <SelectValue placeholder={isUpdatingBulk ? "Updating..." : "Select status"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Auto-Assessed">Auto-Assessed</SelectItem>
                    <SelectItem value="Reviewed">Reviewed</SelectItem>
                    <SelectItem value="Interviewing">Interviewing</SelectItem>
                    <SelectItem value="Shortlisted">Shortlisted</SelectItem>
                    <SelectItem value="Offered">Offered</SelectItem>
                    <SelectItem value="Hired">Hired</SelectItem>
                    <SelectItem value="Onboard">Onboard</SelectItem>
                    <SelectItem value="Rejected">Rejected</SelectItem>
                    <SelectItem value="Withdrawn">Withdrawn</SelectItem>
                    <SelectItem value="On Hold">On Hold</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="relative w-full sm:ml-auto sm:w-auto sm:flex-1 md:grow-0">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <div className="group relative">
              <Input
                placeholder="Search applicants..."
                value={globalFilter ?? ""}
                onChange={(event) =>
                  setGlobalFilter(event.target.value)
                }
                className="h-8 w-full rounded-lg bg-background pl-8 md:w-[160px] lg:w-[250px]"
                title="Supports boolean search: AND, OR, NOT, and quotes"
                aria-label="Search with boolean operators (AND, OR, NOT)"
              />
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                <InfoIcon className="h-4 w-4 text-muted-foreground cursor-help" />
              </div>
              <div className="absolute left-0 top-full z-10 mt-1 hidden w-72 rounded-md bg-popover p-2 text-xs text-popover-foreground shadow-md group-hover:block">
                <p className="font-medium">Boolean Search Examples:</p>
                <ul className="mt-1 list-disc pl-4 text-muted-foreground">
                  <li>"John" AND "Developer"</li>
                  <li>"Bachelor" OR "Master"</li>
                  <li>"Senior" NOT "Junior"</li>
                  <li>"React" AND ("TypeScript" OR "JavaScript")</li>
                  <li>("Frontend" OR "Backend") NOT "Intern"</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <Table className="w-full">
            <TableHeader className="bg-muted">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead key={header.id} colSpan={header.colSpan}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.original.id} 
                    data-state={row.getIsSelected() && "selected"}
                    onClick={(e) => {
                      // Only handle row click if not clicking on checkbox
                      const target = e.target as HTMLElement;
                      if (!target.closest('[role="checkbox"]') && !target.closest('button')) {
                        handleRowClick(row);
                      }
                    }}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={tableColumns.length} 
                    className="h-24 text-center"
                  >
                    {loading ? "Loading..." : "No applicants found for this job."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-col items-center gap-4 p-2 sm:flex-row sm:justify-between sm:gap-8">
          <div className="flex w-full flex-wrap items-center justify-center gap-x-6 gap-y-2 sm:w-auto sm:justify-start">
            <div className="text-sm text-muted-foreground">
              {table.getFilteredSelectedRowModel().rows.length} of{" "}
              {table.getFilteredRowModel().rows.length} row(s) selected.
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="rows-per-page-applicants" className="whitespace-nowrap text-sm font-medium">
                Rows per page
              </Label>
              <Select
                value={`${table.getState().pagination.pageSize}`}
                onValueChange={(value: string) => {
                  table.setPageSize(Number(value));
                }}
              >
                <SelectTrigger className="w-20" id="rows-per-page-applicants">
                  <SelectValue
                    placeholder={table.getState().pagination.pageSize}
                  />
                </SelectTrigger>
                <SelectContent side="top">
                  {[10, 20, 30, 50].map((pageSize) => (
                    <SelectItem key={pageSize} value={`${pageSize}`}>
                      {pageSize}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex w-full flex-wrap items-center justify-center gap-x-6 gap-y-2 sm:w-auto sm:justify-end">
            <div className="flex w-fit items-center justify-center text-sm font-medium">
              Page {table.getState().pagination.pageIndex + 1} of{" "}
              {table.getPageCount()}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="flex h-8 w-8 p-0 sm:flex"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Go to first page</span>
                <ChevronsLeft />
              </Button>
              <Button
                variant="outline"
                className="size-8"
                size="icon"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Go to previous page</span>
                <ChevronLeft />
              </Button>
              <Button
                variant="outline"
                className="size-8"
                size="icon"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Go to next page</span>
                <ChevronRight />
              </Button>
              <Button
                variant="outline"
                className="flex size-8 sm:flex"
                size="icon"
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Go to last page</span>
                <ChevronsRight />
              </Button>
            </div>
          </div>
        </div>
      </div>
      <ScoringDetailsSheet
        isOpen={isCombinedSheetOpen}
        onOpenChange={(open) => {
          setIsCombinedSheetOpen(open);
          if (!open) {
            onApplicationIdChange(null);
          }
        }}
        scoringData={scoringDetailsForSheet}
        candidateData={detailedCandidateForSheet}
        isLoading={isLoadingCombinedSheet}
        applicantName={selectedApplicantForSheet?.full_name}
        referralName={selectedApplicantForSheet?.referralName}
        referralEmail={selectedApplicantForSheet?.referralEmail}
        referralPosition={selectedApplicantForSheet?.referralPosition}
        referralDept={selectedApplicantForSheet?.referralDept}
        applicationId={selectedApplicantForSheet?.application_id}
        jobTitle={jobTitle}
        onReferralUpdate={(newReferralName, newReferralEmail, newReferralPosition, newReferralDept) => {
          // Update the local state
          if (selectedApplicantForSheet) {
            setSelectedApplicantForSheet({
              ...selectedApplicantForSheet,
              referralName: newReferralName,
              referralEmail: newReferralEmail,
              referralPosition: newReferralPosition,
              referralDept: newReferralDept,
            });
          }
          // Refresh the data to reflect changes in the table
          if (onDataRefresh) {
            onDataRefresh();
          }
        }}
      />
    </>
  );
}