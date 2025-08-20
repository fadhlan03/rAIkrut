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
  Plus,
  Edit,
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

import { User } from "@/types/database";
import { SheetUser } from "./sheet-user";
import { format } from 'date-fns';
import { TableSkeleton } from "@/components/ui/table-skeleton";

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

export const columns = (openEditSheet: (user: User) => void): ColumnDef<User>[] => [
  {
    accessorKey: "full_name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Full Name" />
    ),
    cell: ({ row }) => (
      <span className="font-medium max-w-[200px] truncate block">{row.original.full_name}</span>
    ),
    enableSorting: true,
  },
  {
    accessorKey: "email",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Email" />
    ),
    cell: ({ row }) => (
      <span className="text-sm max-w-[250px] truncate block">{row.original.email}</span>
    ),
    enableSorting: true,
  },
  {
    accessorKey: "type",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Type" />
    ),
    cell: ({ row }) => (
      <Badge variant={row.original.type === 'admin' ? 'default' : 'secondary'}>
        {row.original.type}
      </Badge>
    ),
    enableSorting: true,
  },
  {
    accessorKey: "created_at",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Created" />
    ),
    cell: ({ row }) => {
      const date = row.original.created_at ? format(new Date(row.original.created_at), 'dd MMM yyyy') : '-';
      return <span className="text-sm text-muted-foreground">{date}</span>;
    },
    enableSorting: true,
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => (
      <Button
        variant="ghost"
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          openEditSheet(row.original);
        }}
        className="h-8 w-8 p-0"
      >
        <Edit className="size-4" />
      </Button>
    ),
    enableSorting: false,
  },
];

interface DataTableUsersProps {
  data: User[];
  loading: boolean;
  error: string | null;
  selectedUserId: string | null;
  onUserIdChange: (userId: string | null) => void;
  onUserUpdated: () => void;
}

export function DataTableUsers({ data, loading, error, selectedUserId, onUserIdChange, onUserUpdated }: DataTableUsersProps) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  });

  const [isSheetOpen, setIsSheetOpen] = React.useState(false);
  const [selectedUser, setSelectedUser] = React.useState<User | null>(null);
  const [isEditMode, setIsEditMode] = React.useState(false);

  // Effect to handle URL parameter changes
  React.useEffect(() => {
    if (selectedUserId === 'new') {
      // Handle adding a new user
      setSelectedUser(null);
      setIsEditMode(false);
      setIsSheetOpen(true);
    } else if (selectedUserId && data.length > 0) {
      // Handle editing an existing user
      const userForId = data.find(user => user.id === selectedUserId);
      if (userForId) {
        setSelectedUser(userForId);
        setIsEditMode(true);
        setIsSheetOpen(true);
      }
    } else if (!selectedUserId) {
      setIsSheetOpen(false);
      setSelectedUser(null);
    }
  }, [selectedUserId, data]);

  const handleAddUser = () => {
    setSelectedUser(null);
    setIsEditMode(false);
    setIsSheetOpen(true);
    onUserIdChange('new'); // Use 'new' to indicate adding a new user
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setIsEditMode(true);
    setIsSheetOpen(true);
    onUserIdChange(user.id); // Update URL parameter
  };

  const handleRowClick = (userRow: Row<User>) => {
    handleEditUser(userRow.original);
  };

  const handleSheetClose = () => {
    setIsSheetOpen(false);
    setSelectedUser(null);
    setIsEditMode(false);
    onUserIdChange(null); // Clear URL parameter
  };

  const tableColumns = React.useMemo(() => columns(handleEditUser), []);

  const table = useReactTable({
    data,
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
      const user = row.original;

      const fullName = String(user.full_name ?? '').toLowerCase();
      const email = String(user.email ?? '').toLowerCase();
      const type = String(user.type ?? '').toLowerCase();

      return fullName.includes(query) ||
             email.includes(query) ||
             type.includes(query);
    },
  });

  // if (loading && !data.length) {
  //   return (
  //     <div className="flex flex-col gap-4 h-64 w-full items-center justify-center p-4">
  //       <LoaderCircle className="h-16 w-16 animate-spin text-primary" />
  //       <span className="ml-2 text-muted-foreground">Loading Users...</span>
  //     </div>
  //   );
  // }

  if (error) {
    return <div className="text-destructive p-4 text-center">Error: {error}</div>;
  }

  return (
    <>
      <div className="flex w-full flex-col justify-start gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Manage Users</h2>
            <p className="text-muted-foreground">
              Add and manage user accounts
            </p>
          </div>
          <Button onClick={handleAddUser}>
            <Plus className="mr-2 size-4" />
            Add User
          </Button>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col gap-2 px-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap py-1">
            {/* Placeholder for faceted filters */}
          </div>
          <div className="relative w-full sm:ml-auto sm:w-auto sm:flex-1 md:grow-0">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
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
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableSkeleton
                  columns={tableColumns.length}
                  rows={pagination.pageSize}
                />
              ) : table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.original.id}
                    data-state={row.getIsSelected() && "selected"}
                    onClick={() => handleRowClick(row)}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="">
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
                    {loading ? "Loading..." : "No users found."}
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
              <Label htmlFor="rows-per-page-users" className="whitespace-nowrap text-sm font-medium">
                Rows per page
              </Label>
              <Select
                value={`${table.getState().pagination.pageSize}`}
                onValueChange={(value: string) => {
                  table.setPageSize(Number(value));
                }}
              >
                <SelectTrigger className="w-20" id="rows-per-page-users">
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
      <SheetUser
        user={selectedUser}
        isOpen={isSheetOpen}
        onOpenChange={(open) => {
          if (!open) {
            handleSheetClose();
          }
        }}
        isEditMode={isEditMode}
        onUserUpdated={() => {
          onUserUpdated();
          handleSheetClose(); // Close sheet and clear URL parameter after successful operation
        }}
      />
    </>
  );
} 