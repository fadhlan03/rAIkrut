"use client";

import * as React from "react";
import {
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
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InterviewDetailsSheet } from "./sheet-interview-details";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { toast } from "sonner";

// Interview data interface
export interface InterviewData {
  applicationId: string;
  jobTitle: string;
  candidateName: string;
  candidateEmail: string;
  applicationStatus: string;
  applicationDate: string;
  callId: string;
  callTimestamp: string;
  callResult: string;
  callNotes: string | null; // Notes from calls table for Verification Phrase
  conversationId: string | null; // ElevenLabs conversation ID
  reportId: string | null;
  reportAnswers: any;
  averageScore: number | null;
  individualScores: {
    clarity: { score: number; rationale: string | null };
    relevance: { score: number; rationale: string | null };
    depth: { score: number; rationale: string | null };
    communication_style: { score: number; rationale: string | null };
    cultural_fit: { score: number; rationale: string | null };
    attention_to_detail: { score: number; rationale: string | null };
    language_proficiency: { score: number; rationale: string | null };
    star_method: { score: number; rationale: string | null };
  } | null;
  hasReport: boolean;
  // Recording data
  recordingId: string | null;
  recordingTranscript: any;
  recordingUri: string | null;
  recordingDuration: number | null;
  // Verification data
  verificationId: string | null;
  verificationStatus: string | null;
  deepfakeScore: number | null;
  faceVerificationScore: number | null;
  voiceVerificationScore: number | null;
  verificationMetadata: any;
  verifiedAt: string | null;
  hasVerification: boolean;
}

// Column header with sorting
function DataTableColumnHeader({ column, title }: { column: any; title: string }) {
  if (!column.getCanSort()) {
    return <div className="text-left">{title}</div>;
  }

  return (
    <div className={cn("flex items-center space-x-2")}>
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3 h-8 data-[state=open]:bg-accent"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        <span>{title}</span>
        {column.getIsSorted() === "desc" ? (
          <ArrowDown className="ml-2 h-4 w-4" />
        ) : column.getIsSorted() === "asc" ? (
          <ArrowUp className="ml-2 h-4 w-4" />
        ) : (
          <ArrowUpDown className="ml-2 h-4 w-4" />
        )}
      </Button>
    </div>
  );
}

export const columns: ColumnDef<InterviewData>[] = [
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
        onClick={(e) => e.stopPropagation()} // Prevent row click when checkbox is clicked
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "jobTitle",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Job Title" />
    ),
    cell: ({ row }) => (
      <div className="min-w-[250px] max-w-[350px]">
        <div className="font-medium text-foreground truncate">{row.original.jobTitle}</div>
      </div>
    ),
    enableSorting: true,
  },
  {
    accessorKey: "candidateEmail",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Applicant Email" />
    ),
    cell: ({ row }) => (
      <div className="min-w-[200px] max-w-[280px]">
        <div className="text-sm text-foreground truncate">{row.original.candidateEmail}</div>
      </div>
    ),
    enableSorting: true,
  },
  {
    accessorKey: "averageScore",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Average Score" />
    ),
    cell: ({ row }) => {
      const score = row.original.averageScore;
      if (score === null) {
        return <span className="text-muted-foreground">No Report</span>;
      }

      const getScoreColor = (score: number) => {
        if (score >= 4) return "bg-green-100 text-green-800";
        if (score >= 3) return "bg-yellow-100 text-yellow-800";
        return "bg-red-100 text-red-800";
      };

      return (
        <div className="min-w-[120px]">
          <Badge variant="outline" className={cn("font-mono", getScoreColor(score))}>
            {score.toFixed(1)}/5
          </Badge>
        </div>
      );
    },
    enableSorting: true,
    filterFn: (row, columnId, filterValue) => {
      const score = row.getValue(columnId) as number | null;
      if (score === null) return false;
      return score >= parseFloat(filterValue);
    },
  },

  {
    accessorKey: "applicationStatus",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => {
      const status = row.original.applicationStatus;
      const getStatusColor = (status: string) => {
        switch (status.toLowerCase()) {
          case 'hired': return "bg-green-100 text-green-800";
          case 'interviewing': return "bg-blue-100 text-blue-800";
          case 'shortlisted': return "bg-purple-100 text-purple-800";
          case 'offered': return "bg-emerald-100 text-emerald-800";
          case 'rejected': return "bg-red-100 text-red-800";
          case 'pending': return "bg-gray-100 text-gray-800";
          case 'auto-assessed': return "bg-yellow-100 text-yellow-800";
          case 'on hold': return "bg-orange-100 text-orange-800";
          case 'withdrawn': return "bg-pink-100 text-pink-800";
          default: return "bg-gray-100 text-gray-800";
        }
      };

      return (
        <div className="min-w-[130px]">
          <Badge variant="outline" className={getStatusColor(status)}>
            {status}
          </Badge>
        </div>
      );
    },
    enableSorting: true,
  },
  {
    accessorKey: "callTimestamp",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Interview Date" />
    ),
    cell: ({ row }) => {
      const date = new Date(row.original.callTimestamp);
      return (
        <div className="text-sm min-w-[120px]">
          {date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </div>
      );
    },
    enableSorting: true,
  },
  {
    accessorKey: "recordingDuration",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Duration" />
    ),
    cell: ({ row }) => {
      const duration = row.original.recordingDuration;
      if (duration === null) {
        return <span className="text-muted-foreground">No Recording</span>;
      }

      const minutes = Math.floor(duration / 60);
      const seconds = duration % 60;
      const formattedDuration = `${minutes}:${seconds.toString().padStart(2, '0')}`;

      const getDurationColor = (duration: number) => {
        const minutes = Math.floor(duration / 60);
        if (minutes >= 15) return "bg-green-100 text-green-800";
        if (minutes >= 5) return "bg-yellow-100 text-yellow-800";
        return "bg-red-100 text-red-800";
      };

      return (
        <div className="min-w-[100px]">
          <Badge variant="outline" className={cn("font-mono", getDurationColor(duration))}>
            {formattedDuration}
          </Badge>
        </div>
      );
    },
    enableSorting: true,
  },

];

interface DataTableInterviewProps {
  data: InterviewData[];
  loading: boolean;
  error: string | null;
  selectedCallId: string | null;
  onCallIdChange: (callId: string | null) => void;
  onRefresh: () => void; // New prop for refreshing parent data
}

export function DataTableInterview({ data, loading, error, selectedCallId, onCallIdChange, onRefresh }: DataTableInterviewProps) {
  const [sorting, setSorting] = React.useState<SortingState>([
    {
      id: "callTimestamp",
      desc: true,
    },
  ]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  });
  const [rowSelection, setRowSelection] = React.useState({});

  // Filter states
  const [jobTitleFilter, setJobTitleFilter] = React.useState<string>("all");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [minScoreFilter, setMinScoreFilter] = React.useState<string>("all");

  // State for the detail sheet
  const [isDetailSheetOpen, setIsDetailSheetOpen] = React.useState(false);
  const [selectedInterview, setSelectedInterview] = React.useState<InterviewData | null>(null);
  const [refreshTrigger, setRefreshTrigger] = React.useState(0); // New state to trigger refresh

  // Function to trigger data refresh
  const handleDataRefresh = React.useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
    onRefresh(); // Call the parent's refresh function
  }, [onRefresh]);

  // Effect to handle URL parameter changes
  React.useEffect(() => {
    if (selectedCallId && data.length > 0) {
      const interviewForCallId = data.find(interview => interview.callId === selectedCallId);
      if (interviewForCallId) {
        setSelectedInterview(interviewForCallId);
        setIsDetailSheetOpen(true);
      }
    } else if (!selectedCallId) {
      setIsDetailSheetOpen(false);
      setSelectedInterview(null);
    }
  }, [selectedCallId, data, refreshTrigger]); // Add refreshTrigger to dependencies

  // Get unique values for filters
  const uniqueJobTitles = React.useMemo(() => {
    const titles = data.map(item => item.jobTitle).filter(Boolean);
    return Array.from(new Set(titles)).sort();
  }, [data]);

  const uniqueStatuses = React.useMemo(() => {
    const statuses = data.map(item => item.applicationStatus).filter(Boolean);
    return Array.from(new Set(statuses)).sort();
  }, [data]);

  // Update column filters when individual filters change
  React.useEffect(() => {
    const filters: ColumnFiltersState = [];

    if (jobTitleFilter && jobTitleFilter !== "all") {
      filters.push({ id: "jobTitle", value: jobTitleFilter });
    }

    if (statusFilter && statusFilter !== "all") {
      filters.push({ id: "applicationStatus", value: statusFilter });
    }

    if (minScoreFilter && minScoreFilter !== "all") {
      filters.push({ id: "averageScore", value: minScoreFilter });
    }

    setColumnFilters(filters);
  }, [jobTitleFilter, statusFilter, minScoreFilter]);

  const handleRowClick = (row: Row<InterviewData>) => {
    setSelectedInterview(row.original);
    setIsDetailSheetOpen(true);
    onCallIdChange(row.original.callId);
  };

  const clearAllFilters = () => {
    setJobTitleFilter("all");
    setStatusFilter("all");
    setMinScoreFilter("all");
    setGlobalFilter("");
  };

  const handleBulkStatusUpdate = async (newStatus: InterviewData["applicationStatus"]) => {
    const selectedRows = table.getFilteredSelectedRowModel().rows;
    const selectedCallIds = selectedRows.map(row => row.original.callId);

    if (selectedCallIds.length === 0) {
      toast.info("No interviews selected.");
      return;
    }

    toast.promise(async () => {
      const response = await fetch('/api/interviews/bulk-update-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          callIds: selectedCallIds,
          status: newStatus,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update statuses');
      }

      // Clear selection after successful update
      table.toggleAllRowsSelected(false);
      handleDataRefresh(); // Refresh data to reflect changes
      return response.json();
    }, {
      loading: 'Updating interview statuses...',
      success: (data: { updatedCount: number }) => `Successfully updated ${data.updatedCount} interviews to ${newStatus}.`,
      error: (err: Error) => `Error updating statuses: ${err.message}`,
    });
  };

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    onPaginationChange: setPagination,
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      pagination,
      rowSelection,
    },
  });

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <h2 className="text-lg font-semibold text-foreground mb-2">Error Loading Interview Data</h2>
        <p className="text-muted-foreground text-center">{error}</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex w-full flex-col justify-start gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Interview</h2>
            <p className="text-muted-foreground">
              View and manage interview data, including call history, reports, and verification results.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between px-1">
          {/* Filters on the left */}
          <div className="flex items-center space-x-3">

            {/* Job Title Filter */}
            <div className="flex items-center space-x-2">
              <Label htmlFor="job-filter" className="text-sm font-medium whitespace-nowrap">Job Title:</Label>
              <Select value={jobTitleFilter} onValueChange={setJobTitleFilter}>
                <SelectTrigger id="job-filter" className="h-8 w-[180px]">
                  <SelectValue placeholder="All jobs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All jobs</SelectItem>
                  {uniqueJobTitles.map((title) => (
                    <SelectItem key={title} value={title}>
                      {title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center space-x-2">
              <Label htmlFor="status-filter" className="text-sm font-medium whitespace-nowrap">Status:</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="status-filter" className="h-8 w-[130px]">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {uniqueStatuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Score Filter */}
            <div className="flex items-center space-x-2">
              <Label htmlFor="score-filter" className="text-sm font-medium whitespace-nowrap">Min Score:</Label>
              <Select value={minScoreFilter} onValueChange={setMinScoreFilter}>
                <SelectTrigger id="score-filter" className="h-8 w-[100px]">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any</SelectItem>
                  <SelectItem value="1">1+</SelectItem>
                  <SelectItem value="2">2+</SelectItem>
                  <SelectItem value="3">3+</SelectItem>
                  <SelectItem value="4">4+</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Clear Filters Button - only show when filters are active */}
            {(jobTitleFilter !== "all" || statusFilter !== "all" || minScoreFilter !== "all" || globalFilter !== "") && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearAllFilters}
                className="h-8 px-3 text-sm"
              >
                <X className="h-4 w-4 mr-1" />
                Reset
              </Button>
            )}

            {table.getFilteredSelectedRowModel().rows.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-3 text-sm"
                  >
                    Set Status
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem
                    onClick={() => handleBulkStatusUpdate("Pending")}
                  >
                    Pending
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleBulkStatusUpdate("Reviewed")}
                  >
                    Reviewed
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleBulkStatusUpdate("Rejected")}
                  >
                    Rejected
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Search on the right */}
          <div className="flex items-center space-x-2">
            <Label htmlFor="search" className="sr-only">Search</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Search interviews..."
                value={globalFilter ?? ""}
                onChange={(event) => setGlobalFilter(String(event.target.value))}
                className="h-8 w-full rounded-lg bg-background pl-8 md:w-[200px] lg:w-[300px]"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <Table className="w-full">
            <TableHeader className="bg-muted">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableSkeleton
                  columns={columns.length}
                  rows={pagination.pageSize}
                />
              ) : table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleRowClick(row)}
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
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <p className="text-muted-foreground">No interview data found.</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Applications with calls history will appear here.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between space-x-2 py-4">
          <div className="flex-1 text-sm text-muted-foreground">
            {table.getFilteredSelectedRowModel().rows.length} of{" "}
            {table.getFilteredRowModel().rows.length} row(s) selected.
          </div>
          <div className="flex items-center space-x-6 lg:space-x-8">
            <div className="flex items-center space-x-2">
              <p className="text-sm font-medium">Rows per page</p>
              <Select
                value={`${table.getState().pagination.pageSize}`}
                onValueChange={(value) => {
                  table.setPageSize(Number(value));
                }}
              >
                <SelectTrigger className="h-8 w-[70px]">
                  <SelectValue placeholder={table.getState().pagination.pageSize} />
                </SelectTrigger>
                <SelectContent side="top">
                  {[10, 20, 30, 40, 50].map((pageSize) => (
                    <SelectItem key={pageSize} value={`${pageSize}`}>
                      {pageSize}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex w-[100px] items-center justify-center text-sm font-medium">
              Page {table.getState().pagination.pageIndex + 1} of{" "}
              {table.getPageCount()}
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 lg:flex"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Go to first page</span>
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Go to previous page</span>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Go to next page</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 lg:flex"
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Go to last page</span>
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <InterviewDetailsSheet
        isOpen={isDetailSheetOpen}
        onOpenChange={(open) => {
          setIsDetailSheetOpen(open);
          if (!open) {
            onCallIdChange(null);
          }
        }}
        interviewData={selectedInterview}
        onDataUpdate={handleDataRefresh} // Pass the new prop
      />
    </>
  );
}