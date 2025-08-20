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
import { useRouter } from 'next/navigation'; // Import useRouter
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
  MoreHorizontal,
} from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

import { JobVacancy } from "@/types/database"; // Keep this import if JobVacancy type is used in columns or props
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { updateJobStatus } from "@/app/actions";

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
    id: "select",
    header: ({ table }) => (
      <div onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      </div>
    ),
    cell: ({ row }) => (
      <div onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "title",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Title" />
    ),
    cell: ({ row }) => (
      <span className="font-medium max-w-[150px] lg:max-w-[200px] truncate block">{row.original.title}</span>
    ),
    enableSorting: true,
  },
  {
    accessorKey: "job_desc",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Job Description" className="hidden md:table-cell" />
    ),
    cell: ({ row }) => (
      <span className="text-sm max-w-[150px] lg:max-w-[200px] truncate block text-muted-foreground hidden md:table-cell">
        {/* Display first item if job_desc is an array, or placeholder */}
        {Array.isArray(row.original.job_desc) && row.original.job_desc.length > 0
          ? row.original.job_desc[0]
          : (typeof row.original.job_desc === 'string' ? row.original.job_desc : 'N/A')}
      </span>
    ),
    enableSorting: false,
  },
  {
    accessorKey: "requirements",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Requirements" className="hidden lg:table-cell" />
    ),
    cell: ({ row }) => (
      <span className="text-sm max-w-[120px] lg:max-w-[150px] truncate block text-muted-foreground hidden lg:table-cell">
        {/* Display first item if requirements is an array, or placeholder */}
        {Array.isArray(row.original.requirements) && row.original.requirements.length > 0
          ? row.original.requirements[0]
          : (typeof row.original.requirements === 'string' ? row.original.requirements : 'N/A')}
      </span>
    ),
    enableSorting: false,
  },
  {
    accessorKey: "created_at",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Date Posted" className="hidden md:table-cell" />
    ),
    cell: ({ row }) => {
      const date = new Date(row.original.created_at);
      const day = date.getDate().toString().padStart(2, '0');
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const month = monthNames[date.getMonth()];
      const year = date.getFullYear();
      return <span className="text-sm hidden md:table-cell">{`${day} ${month} ${year}`}</span>;
    },
    enableSorting: true,
  },
  // New Column for Applicants Count
  {
    accessorKey: "applicants_count",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Applicants" className="hidden sm:table-cell" />
    ),
    cell: ({ row }) => {
      const count = row.original.applicants_count;
      return (
        <span className="text-sm text-muted-foreground hidden sm:table-cell">
          {typeof count === 'number' ? count : 'N/A'}
        </span>
      );
    },
    enableSorting: true,
  },
  // Status Column with Chips
  {
    accessorKey: "status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => {
      const status = row.original.status;
      const getStatusVariant = (status: string) => {
        switch (status.toLowerCase()) {
          case 'published':
            return 'default';
          case 'draft':
            return 'secondary';
          case 'archived':
            return 'outline';
          default:
            return 'secondary';
        }
      };

      return (
        <Badge variant={getStatusVariant(status)} className="capitalize">
          {status}
        </Badge>
      );
    },
    enableSorting: true,
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const job = row.original;

      return (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => navigator.clipboard.writeText(job.id)}
              >
                Copy job ID
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>View details</DropdownMenuItem>
              <DropdownMenuItem>Edit job</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    },
  },
];

// Updated Props: Removed loading, error, and onRowClick
interface DataTableJobsProps {
  data: JobVacancy[];
}

export function DataTableJobs({ data }: DataTableJobsProps) {
  const router = useRouter(); // Use router for navigation
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = React.useState("")
  const [rowSelection, setRowSelection] = React.useState({})
  const [titleFilter, setTitleFilter] = React.useState<string>("");
  const [statusFilter, setStatusFilter] = React.useState<string>("active");
  const [dateRange, setDateRange] = React.useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({ from: undefined, to: undefined });
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10, // Default page size for jobs
  })
  const [isUpdating, setIsUpdating] = React.useState(false)

  // Process data with filters
  const processedData = React.useMemo(() => {
    let filteredData = [...data];

    // Apply title filter
    if (titleFilter) {
      const titleQuery = titleFilter.toLowerCase();
      filteredData = filteredData.filter(job =>
        job.title.toLowerCase().includes(titleQuery)
      );
    }

    // Apply status filter
    if (statusFilter === "active") {
      // Exclude archived jobs when 'active' is selected
      filteredData = filteredData.filter(job =>
        job.status.toLowerCase() !== "archived"
      );
    } else if (statusFilter !== "all") {
      // Filter for specific status
      filteredData = filteredData.filter(job =>
        job.status.toLowerCase() === statusFilter.toLowerCase()
      );
    }

    // Apply date range filter
    if (dateRange.from || dateRange.to) {
      filteredData = filteredData.filter(job => {
        const jobDate = new Date(job.created_at);

        // Check if job date is after the 'from' date (if specified)
        const isAfterFrom = dateRange.from
          ? jobDate >= new Date(new Date(dateRange.from).setHours(0, 0, 0, 0))
          : true;

        // Check if job date is before the 'to' date (if specified)
        const isBeforeTo = dateRange.to
          ? jobDate <= new Date(new Date(dateRange.to).setHours(23, 59, 59, 999))
          : true;

        return isAfterFrom && isBeforeTo;
      });
    }

    return filteredData;
  }, [data, titleFilter, statusFilter, dateRange]);

  const table = useReactTable({
    data: processedData,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      rowSelection,
      pagination,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(), // For potential faceted filters
    getFacetedUniqueValues: getFacetedUniqueValues(), // For potential faceted filters
    globalFilterFn: (row, columnId, filterValue) => {
      const title = String(row.original.title ?? '').toLowerCase();
      // Adjust jobDesc and requirements to check if array for search
      const jobDesc = Array.isArray(row.original.job_desc)
        ? row.original.job_desc.join(' ').toLowerCase()
        : String(row.original.job_desc ?? '').toLowerCase();
      const requirements = Array.isArray(row.original.requirements)
        ? row.original.requirements.join(' ').toLowerCase()
        : String(row.original.requirements ?? '').toLowerCase();
      const query = filterValue.toLowerCase();
      return title.includes(query) || jobDesc.includes(query) || requirements.includes(query);
    },
  })

  // Handle click for navigation internally
  const handleJobRowClick = (job: JobVacancy) => {
    router.push(`/jobs/${job.id}`);
  };

  // Handle bulk status update
  const handleBulkStatusUpdate = async (newStatus: string) => {
    const selectedRows = table.getFilteredSelectedRowModel().rows;
    const selectedJobIds = selectedRows.map(row => row.original.id);

    if (selectedJobIds.length === 0) {
      toast.error("No jobs selected");
      return;
    }

    setIsUpdating(true);

    try {
      const results = await Promise.allSettled(
        selectedJobIds.map(id => updateJobStatus({ jobId: id, status: newStatus as 'draft' | 'published' | 'archived' }))
      );

      const successful = results.filter(result =>
        result.status === 'fulfilled' && result.value.success
      ).length;
      const failed = results.filter(result =>
        result.status === 'rejected' || (result.status === 'fulfilled' && !result.value.success)
      ).length;

      if (successful > 0) {
        toast.success(`Successfully updated ${successful} job(s) to ${newStatus}`);
      }

      if (failed > 0) {
        toast.error(`Failed to update ${failed} job(s)`);
      }

      // Clear selection after update
      setRowSelection({});

      // Refresh the data without full page reload
      router.refresh();

    } catch (error) {
      toast.error("Failed to update job status");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="flex w-full flex-col justify-start gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Jobs</h2>
          <p className="text-muted-foreground">
            Manage and view job vacancies available in the system.
          </p>
        </div>
      </div>



      {/* Toolbar */}
      <div className="flex flex-col gap-2 px-1 sm:flex-row sm:items-center sm:justify-between">
        {/* Filters Section */}
        <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap py-1">
          {/* Title Filter */}
          <div className="flex items-center gap-2">
            <Input
              id="title-filter"
              placeholder="Filter by title..."
              value={titleFilter}
              onChange={(e) => setTitleFilter(e.target.value)}
              className="h-8 w-[150px] lg:w-[200px]"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[130px]" id="status-filter">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date Range Filter */}
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="date-range"
                  variant="outline"
                  className="h-8 w-[150px] justify-start text-left font-normal"
                >
                  {dateRange.from ? (
                    dateRange.to ? (
                      <>
                        {dateRange.from.toLocaleDateString()} - {dateRange.to.toLocaleDateString()}
                      </>
                    ) : (
                      dateRange.from.toLocaleDateString()
                    )
                  ) : (
                    <span className="text-muted-foreground">Select date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={{
                    from: dateRange.from,
                    to: dateRange.to,
                  }}
                  onSelect={(range) => {
                    setDateRange(range ? { from: range.from, to: range.to ?? undefined } : { from: undefined, to: undefined });
                  }}
                  numberOfMonths={2}
                />
                <div className="flex items-center justify-between p-3 border-t">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDateRange({ from: undefined, to: undefined })}
                  >
                    Clear
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      // Close the popover
                      const button = document.getElementById('date-range');
                      if (button) button.click();
                    }}
                  >
                    Apply
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Bulk Actions */}
          {Object.keys(rowSelection).length > 0 && (
            <>
              <span className="text-sm text-muted-foreground">
                {Object.keys(rowSelection).length} selected
              </span>
              <Select onValueChange={handleBulkStatusUpdate} disabled={isUpdating}>
                <SelectTrigger className="h-8 w-[140px]">
                  <SelectValue placeholder={isUpdating ? "Updating..." : "Bulk update"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRowSelection({})}
                disabled={isUpdating}
                className="h-8"
              >
                Clear
              </Button>
            </>
          )}

          {/* Reset Filters Button */}
          {(titleFilter || statusFilter !== "active" || dateRange.from || dateRange.to) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setTitleFilter("");
                setStatusFilter("active");
                setDateRange({ from: undefined, to: undefined });
              }}
              className="h-8 flex-shrink-0 px-2 lg:px-3"
            >
              Reset
            </Button>
          )}
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
                  )
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
                  onClick={() => handleJobRowClick(row.original)} // Call internal handler
                  className={"cursor-pointer hover:bg-muted/50 transition-colors"} // Always apply hover if clickable
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
            {table.getFilteredRowModel().rows.length} row(s). {Object.keys(rowSelection).length} selected.
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
  )
}