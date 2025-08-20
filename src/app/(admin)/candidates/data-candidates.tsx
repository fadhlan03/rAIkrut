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
  Sparkles,
  Filter,
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
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { Candidate } from "@/types/database"; // EducationEntry and WorkExperienceEntry are not directly used here anymore
import { SheetCandidate } from "./sheet-candidate"; // Import the new sheet component
import { TableSkeleton } from "@/components/ui/table-skeleton";

// Helper function to calculate age
const calculateAge = (birthdateString?: string): number | undefined => {
  if (!birthdateString) return undefined;
  try {
    const birthDate = new Date(birthdateString);
    // Check if birthDate is a valid date
    if (isNaN(birthDate.getTime())) return undefined;

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age >= 0 ? age : undefined; // Return undefined for future dates or invalid calculations
  } catch (e) {
    // Catch any other error during date parsing or calculation
    return undefined;
  }
};

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

// Updated columns definition - openResumeViewer signature will change effectively
// but the function passed will be the new simple one.
export const columns = (openResumeInNewTab: (candidateId: string, candidateName: string) => void): ColumnDef<Candidate>[] => [
  {
    accessorKey: "full_name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
    cell: ({ row }) => (
      <span className="font-medium max-w-[150px] truncate block">{row.original.full_name}</span>
    ),
    enableSorting: true,
  },
  {
    accessorKey: "age",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Age" />
    ),
    cell: ({ row }) => {
      const age = calculateAge(row.original.birthdate);
      return <span className="text-sm">{age !== undefined ? age : '-'}</span>;
    },
    enableSorting: true,
    sortingFn: (rowA, rowB, columnId) => {
      const ageA = calculateAge(rowA.original.birthdate);
      const ageB = calculateAge(rowB.original.birthdate);
      if (ageA === undefined && ageB === undefined) return 0;
      if (ageA === undefined) return 1;
      if (ageB === undefined) return -1;
      return ageA - ageB;
    },
  },
  {
    id: "latest_education_level",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Latest Edu Level" className="hidden md:table-cell" />
    ),
    accessorFn: (row) => row.education?.[0]?.level,
    cell: ({ getValue }) => (
      <span className="text-sm max-w-[120px] truncate block text-muted-foreground hidden md:table-cell">{getValue() as string || '-'}</span>
    ),
    enableSorting: true,
  },
  {
    id: "latest_education_institution",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Latest Edu Institution" className="hidden lg:table-cell" />
    ),
    accessorFn: (row) => row.education?.[0]?.institution,
    cell: ({ getValue }) => (
      <span className="text-sm max-w-[150px] truncate block text-muted-foreground hidden lg:table-cell">{getValue() as string || '-'}</span>
    ),
    enableSorting: true,
  },
  {
    id: "latest_company_name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Latest Company" />
    ),
    accessorFn: (row) => row.work_experience?.[0]?.company,
    cell: ({ getValue }) => (
      <span className="text-sm max-w-[150px] truncate block text-muted-foreground">{getValue() as string || '-'}</span>
    ),
    enableSorting: true,
  },
  {
    id: "latest_work_position",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Latest Position" className="hidden sm:table-cell" />
    ),
    accessorFn: (row) => row.work_experience?.[0]?.position,
    cell: ({ getValue }) => (
      <span className="text-sm max-w-[150px] truncate block text-muted-foreground hidden sm:table-cell">{getValue() as string || '-'}</span>
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
              e.stopPropagation();
              openResumeInNewTab(row.original.id, row.original.full_name);
            }}
            aria-label={`View resume for ${row.original.full_name}`}
            className="p-1 h-auto"
          >
            <FileText className="size-5 text-primary hover:text-primary/80" />
          </Button>
        );
      }
      return null;
    },
    enableSorting: true,
  },
  {
    accessorKey: "job_applications_count",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Apps" className="hidden sm:table-cell" />
    ),
    cell: ({ row }) => (
      <span className="text-sm text-center w-12 hidden sm:table-cell">{row.original.job_applications_count !== undefined ? row.original.job_applications_count : '-'}</span>
    ),
    enableSorting: true,
  },
];

// Define Props interface
interface DataTableCandidatesProps {
  data: Candidate[];
  loading: boolean;
  error: string | null;
  selectedCandidateId: string | null;
  onCandidateIdChange: (candidateId: string | null) => void;
}

export function DataTableCandidates({ data, loading, error, selectedCandidateId, onCandidateIdChange }: DataTableCandidatesProps) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10, // Default page size
  });

  // Semantic search states
  const [searchMode, setSearchMode] = React.useState<'regular' | 'semantic'>('regular');
  const [semanticQuery, setSemanticQuery] = React.useState("");
  const [semanticResults, setSemanticResults] = React.useState<Candidate[]>([]);
  const [semanticLoading, setSemanticLoading] = React.useState(false);
  const [semanticError, setSemanticError] = React.useState<string | null>(null);
  const [searchParams, setSearchParams] = React.useState<any>(null);

  const [isSheetOpen, setIsSheetOpen] = React.useState(false);
  const [selectedCandidate, setSelectedCandidate] = React.useState<Candidate | null>(null);
  const [isLoadingSheet, setIsLoadingSheet] = React.useState(false);

  // Debounced semantic search
  const [debouncedSemanticQuery, setDebouncedSemanticQuery] = React.useState("");

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSemanticQuery(semanticQuery);
    }, 500);

    return () => clearTimeout(timer);
  }, [semanticQuery]);

  // Effect to handle URL parameter changes
  React.useEffect(() => {
    if (selectedCandidateId && data.length > 0) {
      const candidateForId = data.find(candidate => candidate.id === selectedCandidateId);
      if (candidateForId) {
        setSelectedCandidate(candidateForId);
        setIsSheetOpen(true);
      }
    } else if (!selectedCandidateId) {
      setIsSheetOpen(false);
      setSelectedCandidate(null);
    }
  }, [selectedCandidateId, data]);

  // Perform semantic search when debounced query changes
  React.useEffect(() => {
    if (searchMode === 'semantic' && debouncedSemanticQuery.trim()) {
      performSemanticSearch(debouncedSemanticQuery);
    } else if (searchMode === 'semantic' && !debouncedSemanticQuery.trim()) {
      setSemanticResults([]);
      setSearchParams(null);
    }
  }, [debouncedSemanticQuery, searchMode]);

  const performSemanticSearch = async (query: string) => {
    setSemanticLoading(true);
    setSemanticError(null);

    // Create an AbortController to handle timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

    try {
      const response = await fetch('/api/candidates/semantic-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
        signal: controller.signal
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to perform semantic search');
      }

      setSemanticResults(result.candidates || []);
      setSearchParams(result.searchParams || null);
    } catch (error) {
      console.error('Semantic search error:', error);

      // Handle timeout specifically
      if (error instanceof Error && error.name === 'AbortError') {
        setSemanticError('Search timed out. Please try a simpler query with fewer keywords.');
      } else {
        setSemanticError(error instanceof Error ? error.message : 'Failed to perform semantic search. Please try again with a simpler query.');
      }

      setSemanticResults([]);
    } finally {
      clearTimeout(timeoutId);
      setSemanticLoading(false);
    }
  };

  const handleRowClick = async (candidateRow: Row<Candidate>) => {
    const candidateId = candidateRow.original.id;
    setIsLoadingSheet(true);
    setSelectedCandidate(null); // Clear previous selection if any, or use current row.original as placeholder
    setIsSheetOpen(true);
    onCandidateIdChange(candidateId); // Update URL parameter
    try {
      const response = await fetch(`/api/candidates/${candidateId}`);
      if (!response.ok) {
        // Handle error, maybe show a toast
        console.error("Failed to fetch candidate details");
        setIsSheetOpen(false); // Close sheet on error or handle differently
        onCandidateIdChange(null); // Clear URL parameter on error
        return;
      }
      const detailedCandidate: Candidate = await response.json();
      setSelectedCandidate(detailedCandidate);
    } catch (err) {
      console.error("Error fetching candidate details:", err);
      setIsSheetOpen(false); // Close sheet on error
      onCandidateIdChange(null); // Clear URL parameter on error
    } finally {
      setIsLoadingSheet(false);
    }
  };

  // Renamed and simplified function
  const openResumeInNewTab = async (candidateId: string, candidateName: string) => {
    // We can add a simple loading indicator to the button if needed,
    // but for opening a new tab, often it's quick enough not to require complex state.
    // For simplicity, this version won't manage a loading state for the FileText icon itself.
    try {
      console.log(`Fetching resume URL for ${candidateName} (ID: ${candidateId}) to open in new tab...`);
      const response = await fetch(`/api/candidates/${candidateId}/resume`);

      if (!response.ok) {
        const contentType = response.headers.get("content-type");
        let errorMsg = `Failed to fetch resume URL (status: ${response.status})`;
        if (contentType && contentType.includes("application/json")) {
          const errorData = await response.json();
          errorMsg = errorData.error || response.statusText || errorMsg;
          console.error("Failed to fetch resume URL (JSON error):", errorMsg);
        } else {
          const errorText = await response.text();
          console.error("Failed to fetch resume URL (Non-JSON response):", errorText);
          errorMsg = `Failed to fetch resume URL. Server returned non-JSON error.`;
        }
        // Notify user, e.g., via a toast message. For now, just console error.
        alert(`Could not load resume: ${errorMsg}`); // Simple alert for now
        return;
      }

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data: { fileUrl: string } = await response.json();
        if (!data.fileUrl) {
          console.error("Failed to fetch resume URL: fileUrl is missing in the response", data);
          alert("Could not load resume: File URL was not provided by the server.");
          return;
        }
        console.log("Opening URL:", data.fileUrl);
        window.open(data.fileUrl, '_blank', 'noopener,noreferrer');
      } else {
        const responseText = await response.text();
        console.error("Received non-JSON response for resume URL:", responseText);
        alert("Could not load resume: Server did not provide a valid URL.");
        return;
      }

    } catch (err) {
      console.error("Error fetching resume URL to open in new tab:", err);
      alert("An unexpected error occurred while trying to load the resume.");
    }
    // No setIsLoadingResume(false) as that state is removed.
  };

  // Memoize the data to include derived fields for filtering/sorting if not done by API
  // Use semantic results when in semantic mode, otherwise use regular data
  const processedData = React.useMemo(() => {
    const sourceData = searchMode === 'semantic' ? semanticResults : data;
    return sourceData.map(candidate => ({
      ...candidate,
      // Ensure derived fields used by accessorKey or sorting are present if needed
      // For accessorFn columns, this isn't strictly necessary for display but might be for global filter
      age: calculateAge(candidate.birthdate), // for potential global filter use
      latest_education_level: candidate.education?.[0]?.level,
      latest_education_institution: candidate.education?.[0]?.institution,
      latest_company_name: candidate.work_experience?.[0]?.company,
      latest_work_position: candidate.work_experience?.[0]?.position,
    }));
  }, [data, semanticResults, searchMode]);

  const tableColumns = React.useMemo(() => columns(openResumeInNewTab), []);

  const table = useReactTable({
    data: processedData, // Use processedData for table instance
    columns: tableColumns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      pagination,
    },
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
      const query = filterValue.toLowerCase();
      // Access original data for filtering if processedData doesn't match `Candidate` type for `row.original`
      // Or, ensure processedData structure is consistent
      const candidate = row.original as Candidate & { age?: number; latest_education_level?: string; latest_education_institution?: string; latest_company_name?: string; latest_work_position?: string };

      const fullName = String(candidate.full_name ?? '').toLowerCase();
      // Include derived fields in global search
      const eduLevel = String(candidate.education?.[0]?.level ?? '').toLowerCase();
      const eduInstitution = String(candidate.education?.[0]?.institution ?? '').toLowerCase();
      const company = String(candidate.work_experience?.[0]?.company ?? '').toLowerCase();
      const position = String(candidate.work_experience?.[0]?.position ?? '').toLowerCase();

      return fullName.includes(query) ||
        eduLevel.includes(query) ||
        eduInstitution.includes(query) ||
        company.includes(query) ||
        position.includes(query);
    },
  });

  // if (loading && !data.length) {
  //   return (
  //     <div className="flex flex-col gap-4 h-64 w-full items-center justify-center p-4">
  //       <LoaderCircle className="h-16 w-16 animate-spin text-primary" />
  //       <span className="ml-2 text-muted-foreground">Loading Candidates...</span>
  //     </div>
  //   );
  // }

  if (error) {
    return <div className="text-destructive p-4 text-center">Error: {error}</div>;
  }

  return (
    <>
      <div className="flex w-full flex-col justify-start gap-4">

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Candidates</h2>
            <p className="text-muted-foreground">
              Manage and view candidates who have applied for jobs.
            </p>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col gap-4 px-1">

          {/* Search Section */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            {/* Filters Section (can be added later if needed) */}
            <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap py-1">
              {/* Placeholder for faceted filters */}
            </div>

            {/* Search Input with Semantic Toggle */}
            <div className="flex flex-col w-full sm:ml-auto sm:w-auto sm:flex-1 md:grow-0">
              <div className="flex items-center gap-2">
                {/* Semantic Search Toggle */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1">
                        <Switch
                          checked={searchMode === 'semantic'}
                          onCheckedChange={(checked: boolean) => setSearchMode(checked ? 'semantic' : 'regular')}
                        />
                        <Sparkles className={`size-4 ${searchMode === 'semantic' ? 'text-primary' : 'text-muted-foreground'}`} />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{searchMode === 'semantic' ? 'Semantic Search Active' : 'Activate Semantic Search'}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                
                {/* Search Input */}
                <div className="relative w-full">
                  <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                  {searchMode === 'regular' ? (
                  <Input
                    placeholder="Search candidates..."
                    value={globalFilter ?? ""}
                    onChange={(event) => setGlobalFilter(event.target.value)}
                    className="h-8 w-full rounded-lg bg-background pl-8 md:w-[200px] lg:w-[300px]"
                  />
                ) : (
                  <div className="relative">
                    <div className="w-full">
                      <Input
                        placeholder="Try: 'React developers with 3+ years experience' or 'Java engineers'"
                        value={semanticQuery}
                        onChange={(event) => setSemanticQuery(event.target.value)}
                        className="h-8 w-full rounded-lg bg-background pl-8 md:w-[200px] lg:w-[300px]"
                      />
                      {semanticLoading && (
                        <LoaderCircle className="absolute right-2.5 top-2.5 size-4 animate-spin text-muted-foreground" />
                      )}
                      {semanticError && (
                        <div className="absolute mt-1 text-xs text-destructive">{semanticError}</div>
                      )}
                    </div>
                  </div>
                )}
                </div>
              </div>
              
              {/* Help text - moved outside the input container */}
              {searchMode === 'semantic' && (
                <div className="mt-1 text-xs text-muted-foreground">
                  Keep queries simple and specific; e.g., 1-2 skills, 1 experience level.
                </div>
              )}
            </div>
          </div>

          {/* Semantic Search Info */}
          {/* {searchMode === 'semantic' && searchParams && (
            <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded-lg">
              <div className="font-medium mb-1">Search interpreted as:</div>
              <div className="space-y-1">
                {searchParams.skills && searchParams.skills.length > 0 && (
                  <div><strong>Skills:</strong> {searchParams.skills.join(', ')}</div>
                )}
                {searchParams.experience_years && (
                  <div><strong>Experience:</strong> {searchParams.experience_years}+ years</div>
                )}
                {searchParams.education_level && (
                  <div><strong>Education:</strong> {searchParams.education_level}</div>
                )}
                {searchParams.position_keywords && searchParams.position_keywords.length > 0 && (
                  <div><strong>Positions:</strong> {searchParams.position_keywords.join(', ')}</div>
                )}
                {searchParams.company_keywords && searchParams.company_keywords.length > 0 && (
                  <div><strong>Companies:</strong> {searchParams.company_keywords.join(', ')}</div>
                )}
              </div>
            </div>
          )} */}

          {/* Semantic Search Error */}
          {semanticError && (
            <div className="text-sm text-destructive bg-destructive/10 p-2 rounded-lg">
              {semanticError}
            </div>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-lg border">
          <Table className="w-full min-w-[600px]">
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
              {(loading || (searchMode === 'semantic' && semanticLoading)) ? (
                <TableSkeleton
                  columns={tableColumns.length}
                  rows={pagination.pageSize}
                />
              ) : table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    onClick={() => handleRowClick(row)}
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
                    colSpan={tableColumns.length} // Use dynamic column length
                    className="h-24 text-center"
                  >
                    {loading || (searchMode === 'semantic' && semanticLoading)
                      ? "Loading..."
                      : searchMode === 'semantic' && semanticQuery.trim()
                        ? "No candidates found for your search."
                        : searchMode === 'semantic'
                          ? "Enter a search query to find candidates."
                          : "No candidates found."
                    }
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex flex-col items-center gap-4 p-2 sm:flex-row sm:justify-between sm:gap-8">
          <div className="flex w-full flex-wrap items-center justify-center gap-x-6 gap-y-2 sm:w-auto sm:justify-start">
            <div className="text-sm text-muted-foreground">
              {table.getFilteredRowModel().rows.length} row(s).
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="rows-per-page-candidates" className="whitespace-nowrap text-sm font-medium">
                Rows per page
              </Label>
              <Select
                value={`${table.getState().pagination.pageSize}`}
                onValueChange={(value: string) => {
                  table.setPageSize(Number(value));
                }}
              >
                <SelectTrigger className="w-20" id="rows-per-page-candidates">
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
      <SheetCandidate
        candidate={selectedCandidate}
        isOpen={isSheetOpen}
        onOpenChange={(open) => {
          setIsSheetOpen(open);
          if (!open) {
            onCandidateIdChange(null);
          }
        }}
        isLoading={isLoadingSheet}
      />
    </>
  );
}