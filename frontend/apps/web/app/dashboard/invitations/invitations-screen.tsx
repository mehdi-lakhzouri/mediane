"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ColumnDef,
  PaginationState,
  RowSelectionState,
  SortingState,
} from "@tanstack/react-table";
import { motion } from "framer-motion";
import {
  Ban,
  Eye,
  MailPlus,
  MoreVertical,
  RefreshCcw,
  Search,
  Send,
} from "lucide-react";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { Input } from "@repo/ui/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { DataTable } from "../../components/data-table/data-table";
import {
  ConfirmDialog,
  type ConfirmRequest,
} from "../../components/dashboard/confirm-dialog";
import {
  InvitationSheet,
  type InvitationAction,
} from "../../components/dashboard/invitations/invitation-sheet";
import { InvitationStats } from "../../components/dashboard/invitations/invitation-stats";
import { InvitationStatusBadge } from "../../components/dashboard/invitations/invitation-status-badge";
import {
  ctaMotion,
  headerMotion,
  rowMotion,
  sectionMotion,
  stagger,
} from "../../components/dashboard/motion";
import { useToast } from "../../components/dashboard/toast-provider";
import { InviteUserSheet } from "../../components/dashboard/users/invite-user-sheet";
import {
  formatDateTime,
  fullName,
  initials,
} from "../../components/dashboard/users/format";
import { RoleBadge } from "../../components/dashboard/users/user-badges";
import {
  getAdminInvitationStats,
  listAdminInvitations,
  type AdminInvitation,
  type AdminInvitationStats,
  type AdminInvitationStatus,
  type InvitationSortField,
} from "../../../lib/api/admin-invitations";
import {
  resendInvitation,
  revokeInvitation,
} from "../../../lib/api/admin-users";
import type { Role } from "../../../lib/api/auth";
import { ApiError } from "../../../lib/api/client";

type StatusFilter = AdminInvitationStatus | "ALL";
type RoleFilter = Role | "ALL";

const SORT_FIELDS: readonly InvitationSortField[] = [
  "createdAt",
  "expiresAt",
  "status",
  "email",
];

function toSortField(id: string | undefined): InvitationSortField {
  return SORT_FIELDS.find((field) => field === id) ?? "createdAt";
}

function canResend(invitation: AdminInvitation): boolean {
  return (
    invitation.userStatus === "INVITED" && invitation.userDeletedAt === null
  );
}

function uniqueByUser(invitations: AdminInvitation[]): AdminInvitation[] {
  return Array.from(
    new Map(invitations.map((invitation) => [invitation.userId, invitation])).values(),
  );
}

export function InvitationsScreen() {
  const toast = useToast();
  const [rows, setRows] = useState<AdminInvitation[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [stats, setStats] = useState<AdminInvitationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("ALL");
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 5,
  });
  const [sorting, setSorting] = useState<SortingState>([
    { id: "createdAt", desc: true },
  ]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [selected, setSelected] = useState<AdminInvitation | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPagination((previous) => ({ ...previous, pageIndex: 0 }));
      setRowSelection({});
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const sort = sorting[0];
  const sortBy = toSortField(sort?.id);
  const sortDir = sort?.desc === false ? "asc" : "desc";

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    try {
      const page = await listAdminInvitations({
        page: pagination.pageIndex + 1,
        pageSize: pagination.pageSize,
        search: search || undefined,
        status: statusFilter === "ALL" ? undefined : statusFilter,
        role: roleFilter === "ALL" ? undefined : roleFilter,
        sortBy,
        sortDir,
      });
      if (id !== requestId.current) return;
      setRows(page.items);
      setTotalItems(page.totalItems);
      setLoadError(null);
    } catch (error) {
      if (id !== requestId.current) return;
      setRows([]);
      setTotalItems(0);
      setLoadError(
        error instanceof ApiError
          ? error.message
          : "Could not load invitations. Please try again.",
      );
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [pagination.pageIndex, pagination.pageSize, roleFilter, search, sortBy, sortDir, statusFilter]);

  const loadStats = useCallback(async () => {
    try {
      setStats(await getAdminInvitationStats());
    } catch {
      // Keep the history table usable when aggregate metrics are unavailable.
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const refreshWorkspace = useCallback(() => {
    void load();
    void loadStats();
  }, [load, loadStats]);

  const runSingle = useCallback(
    async (action: InvitationAction, invitation: AdminInvitation) => {
      setBusy(true);
      try {
        if (action === "resend") {
          await resendInvitation(invitation.userId);
          toast.success(
            "New invitation issued.",
            "Email delivery was requested and the previous credentials are no longer valid.",
          );
        } else {
          await revokeInvitation(invitation.userId);
          toast.success(
            "Invitation revoked.",
            "The recipient can no longer use that link.",
          );
        }
        setSelected(null);
      } catch (error) {
        toast.error(
          "The invitation could not be updated.",
          error instanceof ApiError ? error.message : "Please try again.",
        );
      } finally {
        setBusy(false);
        await Promise.all([load(), loadStats()]);
      }
    },
    [load, loadStats, toast],
  );

  const askAction = useCallback(
    (action: InvitationAction, invitation: AdminInvitation) => {
      const name = fullName(invitation);
      setConfirm({
        title:
          action === "resend"
            ? `Send a new invitation to ${name}?`
            : `Revoke ${name}'s invitation?`,
        description:
          action === "resend"
            ? "This creates a new single-use link and temporary password. Credentials from every previous invitation stop working."
            : "The current invitation link stops working immediately. You can send a fresh invitation later while the account is still awaiting activation.",
        actionLabel: action === "resend" ? "Send new invitation" : "Revoke",
        destructive: action === "revoke",
        run: () => runSingle(action, invitation),
      });
    },
    [runSingle],
  );

  const selectedRows = useMemo(
    () => rows.filter((row) => rowSelection[row.invitationId]),
    [rowSelection, rows],
  );
  const resendable = useMemo(
    () => uniqueByUser(selectedRows.filter(canResend)),
    [selectedRows],
  );
  const revocable = useMemo(
    () => uniqueByUser(selectedRows.filter((row) => row.status === "PENDING")),
    [selectedRows],
  );

  const runBulk = useCallback(
    async (action: InvitationAction, invitations: AdminInvitation[]) => {
      setBusy(true);
      const results = await Promise.allSettled(
        invitations.map((invitation) =>
          action === "resend"
            ? resendInvitation(invitation.userId)
            : revokeInvitation(invitation.userId),
        ),
      );
      const failed = results.filter((result) => result.status === "rejected");
      const succeeded = results.length - failed.length;
      if (failed.length === 0) {
        toast.success(
          action === "resend"
            ? `${succeeded} invitation${succeeded === 1 ? "" : "s"} issued again.`
            : `${succeeded} invitation${succeeded === 1 ? "" : "s"} revoked.`,
        );
      } else {
        const reason = failed[0]?.reason;
        toast.error(
          `${succeeded} of ${results.length} invitations updated.`,
          reason instanceof ApiError ? reason.message : "Some actions failed.",
        );
      }
      setRowSelection({});
      setBusy(false);
      await Promise.all([load(), loadStats()]);
    },
    [load, loadStats, toast],
  );

  const askBulk = useCallback(
    (action: InvitationAction, invitations: AdminInvitation[]) => {
      setConfirm({
        title:
          action === "resend"
            ? `Send ${invitations.length} new invitations?`
            : `Revoke ${invitations.length} invitations?`,
        description:
          action === "resend"
            ? "Each recipient gets a new link and temporary password. Every older credential stops working."
            : "The selected active links stop working immediately.",
        actionLabel: action === "resend" ? "Send invitations" : "Revoke",
        destructive: action === "revoke",
        run: () => runBulk(action, invitations),
      });
    },
    [runBulk],
  );

  const columns = useMemo<ColumnDef<AdminInvitation>[]>(
    () => [
      {
        id: "select",
        size: 40,
        enableSorting: false,
        header: ({ table }) => (
          <Checkbox
            aria-label="Select all invitations on this page"
            checked={
              table.getIsAllPageRowsSelected()
                ? true
                : table.getIsSomePageRowsSelected()
                  ? "indeterminate"
                  : false
            }
            onCheckedChange={(value) =>
              table.toggleAllPageRowsSelected(value === true)
            }
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            aria-label={`Select invitation for ${row.original.email}`}
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(value === true)}
          />
        ),
      },
      {
        id: "email",
        size: 310,
        header: "Recipient",
        enableSorting: true,
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#e9efff] text-[11px] font-bold text-[#2744c7]">
              {initials(row.original)}
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold text-foreground">
                {fullName(row.original)}
              </p>
              <p className="truncate text-[12px] text-muted-foreground">
                {row.original.email}
              </p>
            </div>
          </div>
        ),
      },
      {
        id: "role",
        size: 105,
        header: "Role",
        enableSorting: false,
        cell: ({ row }) => <RoleBadge role={row.original.role} />,
      },
      {
        id: "status",
        size: 135,
        header: "Status",
        enableSorting: true,
        cell: ({ row }) => (
          <InvitationStatusBadge status={row.original.status} />
        ),
      },
      {
        id: "invitedBy",
        size: 165,
        header: "Invited by",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-foreground">
            {row.original.invitedBy
              ? fullName(row.original.invitedBy)
              : "System"}
          </span>
        ),
      },
      {
        id: "createdAt",
        size: 170,
        header: "Issued",
        enableSorting: true,
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground tabular-nums">
            {formatDateTime(row.original.createdAt)}
          </span>
        ),
      },
      {
        id: "expiresAt",
        size: 180,
        header: "Expiry",
        enableSorting: true,
        cell: ({ row }) => (
          <div>
            <p className="whitespace-nowrap text-muted-foreground tabular-nums">
              {formatDateTime(row.original.expiresAt)}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {expiryLabel(row.original)}
            </p>
          </div>
        ),
      },
      {
        id: "actions",
        size: 56,
        enableSorting: false,
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Actions for ${row.original.email}`}
                disabled={busy}
              >
                <MoreVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[210px]">
              <DropdownMenuItem onSelect={() => setSelected(row.original)}>
                <Eye /> View details
              </DropdownMenuItem>
              {canResend(row.original) ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => askAction("resend", row.original)}
                  >
                    <Send /> Resend invitation
                  </DropdownMenuItem>
                </>
              ) : null}
              {row.original.status === "PENDING" ? (
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => askAction("revoke", row.original)}
                >
                  <Ban /> Revoke invitation
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [askAction, busy],
  );

  return (
    <motion.div
      variants={stagger(0.1)}
      initial="hidden"
      animate="show"
      className="flex flex-col gap-6"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <motion.div variants={headerMotion.invitations.title}>
          <h1 className="text-[32px] font-bold leading-tight tracking-[-0.035em] text-foreground">
            Invitations
          </h1>
          <p className="mt-1 text-[14px] text-muted-foreground">
            Track account activation, replace expired links and control pending
            access.
          </p>
        </motion.div>
        <motion.div
          variants={headerMotion.invitations.actions}
          className="flex gap-2"
        >
          <Button
            type="button"
            size="lg"
            variant="outline"
            disabled={loading}
            onClick={refreshWorkspace}
            className="h-[46px] rounded-[9px] bg-white px-4"
          >
            <RefreshCcw className={loading ? "animate-spin" : undefined} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <motion.div {...ctaMotion} className="inline-flex">
            <Button
              type="button"
              size="lg"
              onClick={() => setInviteOpen(true)}
              className="h-[46px] rounded-[9px] px-6 shadow-[0_5px_14px_rgba(48,71,217,.18)]"
            >
              <MailPlus /> New invitation
            </Button>
          </motion.div>
        </motion.div>
      </div>

      <InvitationStats stats={stats} />

      <motion.div variants={sectionMotion}>
        <DataTable
          rowVariants={rowMotion.dispatch}
          columns={columns}
          data={rows}
          rowCount={totalItems}
          getRowId={(row) => row.invitationId}
          pagination={pagination}
          onPaginationChange={setPagination}
          sorting={sorting}
          onSortingChange={setSorting}
          rowSelection={rowSelection}
          onRowSelectionChange={setRowSelection}
          loading={loading}
          activeRowId={selected?.invitationId}
          onRowClick={setSelected}
          toolbar={
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative min-w-[260px] flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Search recipient name or email..."
                  aria-label="Search invitations"
                  className="h-11 rounded-[9px] bg-white pl-11"
                />
              </div>
              <Select
                value={statusFilter}
                onValueChange={(value) => {
                  setStatusFilter(value as StatusFilter);
                  setPagination((previous) => ({ ...previous, pageIndex: 0 }));
                  setRowSelection({});
                }}
              >
                <SelectTrigger
                  aria-label="Filter by invitation status"
                  className="h-11 w-[175px] rounded-[9px]"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All statuses</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="ACCEPTED">Accepted</SelectItem>
                  <SelectItem value="EXPIRED">Expired</SelectItem>
                  <SelectItem value="REVOKED">Revoked</SelectItem>
                  <SelectItem value="SUPERSEDED">Superseded</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={roleFilter}
                onValueChange={(value) => {
                  setRoleFilter(value as RoleFilter);
                  setPagination((previous) => ({ ...previous, pageIndex: 0 }));
                  setRowSelection({});
                }}
              >
                <SelectTrigger
                  aria-label="Filter by recipient role"
                  className="h-11 w-[160px] rounded-[9px]"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All roles</SelectItem>
                  <SelectItem value="DRIVER">Drivers</SelectItem>
                  <SelectItem value="ADMIN">Admins</SelectItem>
                </SelectContent>
              </Select>
            </div>
          }
          bulkBar={
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-secondary/60 px-3 py-1.5">
              <Badge variant="default">{selectedRows.length}</Badge>
              <span className="text-[13px] font-medium text-foreground">
                selected
              </span>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy || resendable.length === 0}
                  onClick={() => askBulk("resend", resendable)}
                >
                  <Send /> Resend ({resendable.length})
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy || revocable.length === 0}
                  onClick={() => askBulk("revoke", revocable)}
                  className="text-danger hover:text-danger"
                >
                  <Ban /> Revoke ({revocable.length})
                </Button>
              </div>
            </div>
          }
          emptyState={
            <div className="grid h-52 place-items-center px-6 text-center">
              <div>
                <span className="mx-auto grid size-11 place-items-center rounded-xl bg-secondary">
                  <MailPlus className="size-5 text-primary" />
                </span>
                <p className="mt-3 text-[14px] font-semibold text-foreground">
                  {loadError ??
                    (search || statusFilter !== "ALL" || roleFilter !== "ALL"
                      ? "No invitation matches these filters"
                      : "No invitations yet")}
                </p>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  {loadError
                    ? "Check that the API is reachable, then refresh the workspace."
                    : "Create an invitation to start onboarding a driver or administrator."}
                </p>
              </div>
            </div>
          }
        />
      </motion.div>

      <InviteUserSheet
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onCreated={(user) => {
          toast.success(
            `Invitation created for ${user.email}.`,
            "Email delivery was requested. The account stays pending until the recipient accepts.",
          );
          refreshWorkspace();
        }}
      />

      <InvitationSheet
        invitation={selected}
        open={selected !== null}
        busy={busy}
        onOpenChange={(open) => !open && setSelected(null)}
        onAction={askAction}
      />

      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </motion.div>
  );
}

function expiryLabel(invitation: AdminInvitation): string {
  if (invitation.status === "ACCEPTED") return "Accepted";
  if (invitation.status === "REVOKED") return "Revoked";
  if (invitation.status === "SUPERSEDED") return "Replaced";
  if (invitation.status === "EXPIRED") return "Link expired";

  const milliseconds = new Date(invitation.expiresAt).getTime() - Date.now();
  const hours = Math.max(1, Math.ceil(milliseconds / 3_600_000));
  if (hours < 24) return `${hours}h remaining`;
  const days = Math.ceil(hours / 24);
  return `${days}d remaining`;
}
