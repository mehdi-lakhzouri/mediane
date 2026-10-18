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
import { fullName, initials } from "../../components/dashboard/users/format";
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
import { useErrorText } from "../../../lib/i18n/api-errors";
import { useFormatters, useMessages } from "../../../lib/i18n/locale-provider";
import { labelMessages } from "../../components/dashboard/labels";
import {
  invitationsMessages,
  type InvitationsMessages,
} from "../../components/dashboard/invitations/invitations.messages";

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
    new Map(
      invitations.map((invitation) => [invitation.userId, invitation]),
    ).values(),
  );
}

export function InvitationsScreen() {
  const t = useMessages(invitationsMessages);
  const labels = useMessages(labelMessages);
  const format = useFormatters();
  const errorText = useErrorText();
  const toast = useToast();
  const [rows, setRows] = useState<AdminInvitation[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [stats, setStats] = useState<AdminInvitationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  // The failure, not its text: the message follows a language switch.
  const [loadError, setLoadError] = useState<{ error: unknown } | null>(null);
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
      setLoadError({ error });
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [
    pagination.pageIndex,
    pagination.pageSize,
    roleFilter,
    search,
    sortBy,
    sortDir,
    statusFilter,
  ]);

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
          toast.success(t.single.resent, t.single.resentDetail);
        } else {
          await revokeInvitation(invitation.userId);
          toast.success(t.single.revoked, t.single.revokedDetail);
        }
        setSelected(null);
      } catch (error) {
        toast.error(
          t.single.failed,
          error instanceof ApiError ? errorText.message(error) : t.single.retry,
        );
      } finally {
        setBusy(false);
        await Promise.all([load(), loadStats()]);
      }
    },
    [errorText, load, loadStats, t, toast],
  );

  const askAction = useCallback(
    (action: InvitationAction, invitation: AdminInvitation) => {
      const name = fullName(invitation);
      setConfirm({
        title:
          action === "resend"
            ? t.single.resendTitle(name)
            : t.single.revokeTitle(name),
        description:
          action === "resend"
            ? t.single.resendDescription
            : t.single.revokeDescription,
        actionLabel:
          action === "resend" ? t.single.resendAction : t.single.revokeAction,
        destructive: action === "revoke",
        run: () => runSingle(action, invitation),
      });
    },
    [runSingle, t],
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
            ? t.bulk.resent(succeeded)
            : t.bulk.revoked(succeeded),
        );
      } else {
        const reason = failed[0]?.reason;
        toast.error(
          t.bulk.partial(succeeded, results.length),
          reason instanceof ApiError
            ? errorText.message(reason)
            : t.bulk.someFailed,
        );
      }
      setRowSelection({});
      setBusy(false);
      await Promise.all([load(), loadStats()]);
    },
    [errorText, load, loadStats, t, toast],
  );

  const askBulk = useCallback(
    (action: InvitationAction, invitations: AdminInvitation[]) => {
      setConfirm({
        title:
          action === "resend"
            ? t.bulk.resendTitle(invitations.length)
            : t.bulk.revokeTitle(invitations.length),
        description:
          action === "resend"
            ? t.bulk.resendDescription
            : t.bulk.revokeDescription,
        actionLabel:
          action === "resend" ? t.bulk.resendAction : t.bulk.revokeAction,
        destructive: action === "revoke",
        run: () => runBulk(action, invitations),
      });
    },
    [runBulk, t],
  );

  const columns = useMemo<ColumnDef<AdminInvitation>[]>(
    () => [
      {
        id: "select",
        size: 40,
        enableSorting: false,
        header: ({ table }) => (
          <Checkbox
            aria-label={t.columns.selectAll}
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
            aria-label={t.columns.select(row.original.email)}
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(value === true)}
          />
        ),
      },
      {
        id: "email",
        size: 310,
        header: t.columns.recipient,
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
        header: t.columns.role,
        enableSorting: false,
        cell: ({ row }) => <RoleBadge role={row.original.role} />,
      },
      {
        id: "status",
        size: 135,
        header: t.columns.status,
        enableSorting: true,
        cell: ({ row }) => (
          <InvitationStatusBadge status={row.original.status} />
        ),
      },
      {
        id: "invitedBy",
        size: 165,
        header: t.columns.invitedBy,
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-foreground">
            {row.original.invitedBy
              ? fullName(row.original.invitedBy)
              : t.system}
          </span>
        ),
      },
      {
        id: "createdAt",
        size: 170,
        header: t.columns.issued,
        enableSorting: true,
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground tabular-nums">
            {format.dateTime(row.original.createdAt)}
          </span>
        ),
      },
      {
        id: "expiresAt",
        size: 180,
        header: t.columns.expiry,
        enableSorting: true,
        cell: ({ row }) => (
          <div>
            <p className="whitespace-nowrap text-muted-foreground tabular-nums">
              {format.dateTime(row.original.expiresAt)}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {expiryLabel(row.original, t)}
            </p>
          </div>
        ),
      },
      {
        id: "actions",
        size: 56,
        enableSorting: false,
        header: () => <span className="sr-only">{t.columns.actions}</span>,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t.row.actionsFor(row.original.email)}
                disabled={busy}
              >
                <MoreVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[210px]">
              <DropdownMenuItem onSelect={() => setSelected(row.original)}>
                <Eye /> {t.row.view}
              </DropdownMenuItem>
              {canResend(row.original) ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => askAction("resend", row.original)}
                  >
                    <Send /> {t.row.resend}
                  </DropdownMenuItem>
                </>
              ) : null}
              {row.original.status === "PENDING" ? (
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => askAction("revoke", row.original)}
                >
                  <Ban /> {t.row.revoke}
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [askAction, busy, format, t],
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
            {t.title}
          </h1>
          <p className="mt-1 text-[14px] text-muted-foreground">{t.subtitle}</p>
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
            <span className="hidden sm:inline">{t.refresh}</span>
          </Button>
          <motion.div {...ctaMotion} className="inline-flex">
            <Button
              type="button"
              size="lg"
              onClick={() => setInviteOpen(true)}
              className="h-[46px] rounded-[9px] px-6 shadow-[0_5px_14px_rgba(48,71,217,.18)]"
            >
              <MailPlus /> {t.create}
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
                  placeholder={t.search}
                  aria-label={t.searchLabel}
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
                  aria-label={t.filters.status}
                  className="h-11 w-[175px] rounded-[9px]"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t.filters.allStatuses}</SelectItem>
                  {STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {labels.invitationStatus[status]}
                    </SelectItem>
                  ))}
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
                  aria-label={t.filters.role}
                  className="h-11 w-[160px] rounded-[9px]"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t.filters.allRoles}</SelectItem>
                  <SelectItem value="DRIVER">{t.filters.drivers}</SelectItem>
                  <SelectItem value="ADMIN">{t.filters.admins}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          }
          bulkBar={
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-secondary/60 px-3 py-1.5">
              <Badge variant="default">{selectedRows.length}</Badge>
              <span className="text-[13px] font-medium text-foreground">
                {t.bulk.selected(selectedRows.length)}
              </span>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy || resendable.length === 0}
                  onClick={() => askBulk("resend", resendable)}
                >
                  <Send /> {t.bulk.resend(resendable.length)}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy || revocable.length === 0}
                  onClick={() => askBulk("revoke", revocable)}
                  className="text-danger hover:text-danger"
                >
                  <Ban /> {t.bulk.revoke(revocable.length)}
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
                  {loadError
                    ? loadError.error instanceof ApiError
                      ? errorText.message(loadError.error)
                      : t.loadFailed
                    : search || statusFilter !== "ALL" || roleFilter !== "ALL"
                      ? t.noMatch
                      : t.none}
                </p>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  {loadError ? t.errorHint : t.emptyHint}
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
          toast.success(t.created(user.email), t.createdDetail);
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

const STATUSES: AdminInvitationStatus[] = [
  "PENDING",
  "ACCEPTED",
  "EXPIRED",
  "REVOKED",
  "SUPERSEDED",
];

function expiryLabel(
  invitation: AdminInvitation,
  t: InvitationsMessages,
): string {
  if (invitation.status === "ACCEPTED") return t.expiry.accepted;
  if (invitation.status === "REVOKED") return t.expiry.revoked;
  if (invitation.status === "SUPERSEDED") return t.expiry.replaced;
  if (invitation.status === "EXPIRED") return t.expiry.expired;

  const milliseconds = new Date(invitation.expiresAt).getTime() - Date.now();
  const hours = Math.max(1, Math.ceil(milliseconds / 3_600_000));
  if (hours < 24) return t.expiry.hours(hours);
  return t.expiry.days(Math.ceil(hours / 24));
}
