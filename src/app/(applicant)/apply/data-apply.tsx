// "use server"; // Removed from top of file

// Removed db, jobVacanciesTable, and JobVacancy imports as getJobVacancies is moved

// Define columns for the job vacancies table
// This will be similar to the columns in your DataProducts example
// We'll adapt it for JobVacancy properties.

// getJobVacancies function has been moved to actions.ts

// The React component for the table will go here.
// We will build this step-by-step, similar to DataProducts. 

"use client";

import * as React from "react"
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
} from "@tanstack/react-table"
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ListFilter, // Assuming you might want faceted filters later
  Search,
  LoaderCircle,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { JobVacancy } from "@/types/database"; // Keep this import if JobVacancy type is used in columns or props
import { SheetApply } from "./sheet-apply"; // Import the new sheet component
import { TableSkeleton } from "@/components/ui/table-skeleton";

// Reusable component for sorting buttons in table headers
interface DataTableColumnHeaderProps<
  TData,
  TValue
> extends React.HTMLAttributes<HTMLDivElement> {
  column: Column<TData, TValue>
  title: string
}

function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) {
    return <div className={cn(className)}>{title}</div>
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
  )
}

// Define columns for job vacancies data table
export const columns: ColumnDef<JobVacancy>[] = [
  {
    accessorKey: "title",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Title" />
    ),
    cell: ({ row }) => (
      <span className="font-medium max-w-[250px] truncate block">{row.original.title}</span>
    ),
    enableSorting: true,
  },
  {
    accessorKey: "job_desc",
    header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Job Description" />
    ),
    cell: ({ row }) => (
      <span className="text-sm max-w-[200px] truncate block text-muted-foreground">
        {row.original.job_desc || 'N/A'} 
      </span>
    ),
    enableSorting: false,
  },
  {
    accessorKey: "requirements",
    header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Requirements" />
    ),
    cell: ({ row }) => (
      <span className="text-sm max-w-[200px] truncate block text-muted-foreground">{row.original.requirements}</span>
    ),
    enableSorting: false,
  },
  {
    accessorKey: "created_at",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Date Posted" />
    ),
    cell: ({ row }) => {
      const date = new Date(row.original.created_at);
      const day = date.getDate().toString().padStart(2, '0');
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const month = monthNames[date.getMonth()];
      const year = date.getFullYear();
      return <span>{`${day} ${month} ${year}`}</span>;
    },
    enableSorting: true,
  },
  {
    id: "status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row, table }) => {
      const userApplications = (table.options.meta as any)?.userApplications || [];
      const hasApplied = userApplications.includes(row.original.id);
      
      return (
        <Badge variant={hasApplied ? "default" : "outline"}>
          {hasApplied ? "Applied" : "Open"}
        </Badge>
      );
    },
    enableSorting: false,
  },
  // Add more columns as needed, e.g., for status, actions, etc.
  // Example for an action button:
  // {
  //   id: "actions",
  //   cell: ({ row }) => (
  //     <Button variant="outline" size="sm" onClick={() => console.log("View job:", row.original.id)}>
  //       View Details
  //     </Button>
  //   ),
  // },
];

// Define Props interface
interface DataTableJobsProps {
  data: JobVacancy[];
  loading: boolean;
  error: string | null;
  userApplications?: string[]; // Array of job IDs that the user has applied to
  selectedJobId: string | null;
  onJobIdChange: (jobId: string | null) => void;
  // onRowClick?: (job: JobVacancy) => void; // Optional: if you want row click behavior. We will implement this internally.
}

export function DataTableJobs({ data, loading, error, userApplications = [], selectedJobId, onJobIdChange }: DataTableJobsProps) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10, // Default page size for jobs
  });
  const [selectedJob, setSelectedJob] = React.useState<JobVacancy | null>(null);
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);

  // Effect to handle URL parameter changes
  React.useEffect(() => {
    if (selectedJobId && data.length > 0) {
      const jobForId = data.find(job => job.id === selectedJobId);
      if (jobForId) {
        setSelectedJob(jobForId);
        setIsSheetOpen(true);
      }
    } else if (!selectedJobId) {
      setIsSheetOpen(false);
      setSelectedJob(null);
    }
  }, [selectedJobId, data]);

  const handleRowClick = (job: JobVacancy) => {
    setSelectedJob(job);
    setIsSheetOpen(true);
    onJobIdChange(job.id); // Update URL parameter
  };

  const table = useReactTable({
    data: data ?? [],
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      pagination,
    },
    meta: {
      userApplications, // Pass userApplications to table meta
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(), // For potential faceted filters
    getFacetedUniqueValues: getFacetedUniqueValues(), // For potential faceted filters
    globalFilterFn: (row, columnId, filterValue) => {
        const title = String(row.original.title ?? '').toLowerCase();
        const jobDesc = String(row.original.job_desc ?? '').toLowerCase();
        const requirements = String(row.original.requirements ?? '').toLowerCase();
        const query = filterValue.toLowerCase();
        return title.includes(query) || jobDesc.includes(query) || requirements.includes(query);
    },
  })

  // if (loading) {
  //   return (
  //     <div className="flex flex-col gap-4 h-full w-full items-center justify-center p-4">
  //       <LoaderCircle className="h-16 w-16 animate-spin text-primary" />
  //       <span className="ml-2 text-muted-foreground">Loading Job Vacancies...</span>
  //     </div>
  //   );
  // }

  if (error) {
    return <div className="text-destructive p-4">Error: {error}</div>;
  }

  return (
    <>
      <div className="flex w-full flex-col justify-start gap-4">

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Apply for Job</h2>
            <p className="text-muted-foreground">
              Select a job vacancy to apply. You can filter and search through the available jobs.
            </p>
          </div>
        </div>

        {/* Toolbar */} 
        <div className="flex flex-col gap-2 px-1 sm:flex-row sm:items-center sm:justify-between">
          {/* Filters Section (can be added later if needed, e.g., for status or location) */} 
          <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap py-1">
            {/* Example: Add faceted filter if you add a status column 
            {table.getColumn("status") && (
              <DataTableFacetedFilter
                column={table.getColumn("status")}
                title="Status"
                options={[{value: 'open', label: 'Open'}, {value: 'closed', label: 'Closed'}]_}
              />
            )}
            {table.getState().columnFilters.length > 0 && (
              <Button
                variant="ghost"
                onClick={() => table.resetColumnFilters()}
                className="h-8 flex-shrink-0 px-2 lg:px-3"
              >
                Reset
              </Button>
            )} 
            */}
          </div>
          {/* Search Section */} 
          <div className="relative w-full sm:ml-auto sm:w-auto sm:flex-1 md:grow-0">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Search jobs..."
              value={globalFilter ?? ""}
              onChange={(event) =>
                setGlobalFilter(event.target.value)
              }
              className="h-8 w-full rounded-lg bg-background pl-8 md:w-[200px] lg:w-[300px]"
            />
          </div>
        </div>

        {/* Table */} 
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
                    )
                  })}
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
                    key={row.original.id}
                    data-state={row.getIsSelected() && "selected"}
                    onClick={() => handleRowClick(row.original)}
                    className="cursor-pointer"
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
                    colSpan={columns.length} // Use dynamic column length
                    className="h-24 text-center"
                  >
                    No job vacancies found.
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
              <Label htmlFor="rows-per-page-jobs" className="whitespace-nowrap text-sm font-medium">
                Rows per page
              </Label>
              <Select
                value={`${table.getState().pagination.pageSize}`}
                onValueChange={(value: string) => {
                  table.setPageSize(Number(value))
                }}
              >
                <SelectTrigger className="w-20" id="rows-per-page-jobs">
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
      {selectedJob && (
        <SheetApply
          job={selectedJob}
          isOpen={isSheetOpen}
          onOpenChange={(open) => {
            setIsSheetOpen(open);
            if (!open) {
              onJobIdChange(null);
            }
          }}
          hasApplied={userApplications.includes(selectedJob.id)}
        />
      )}
    </>
  )
}