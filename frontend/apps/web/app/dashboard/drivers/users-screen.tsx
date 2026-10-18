"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import type {
  ColumnDef,
  PaginationState,
  RowSelectionState,
  SortingState,
} from "@tanstack/react-table";
import {
  KeyRound,
  MoreVertical,
  Pencil,
  RotateCcw,
  Search,
  Send,
  ShieldBan,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
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
  AccountStateBadge,
  RoleBadge,
} from "../../components/dashboard/users/user-badges";
import { fullName, initials } from "../../components/dashboard/users/format";
import { InviteUserSheet } from "../../components/dashboard/users/invite-user-sheet";
import { UserSheet } from "../../components/dashboard/users/user-sheet";
import type { UserDrawerAction } from "../../components/dashboard/users/user-sheet";
import {
  UserStats,
  type UserStatsValue,
} from "../../components/dashboard/users/user-stats";
import {
  ctaMotion,
  headerMotion,
  rowMotion,
  sectionMotion,
  stagger,
} from "../../components/dashboard/motion";
import { useToast } from "../../components/dashboard/toast-provider";
import {
  ConfirmDialog,
  type ConfirmRequest,
} from "../../components/dashboard/confirm-dialog";
import {
  hardDeleteUser,
  listUsers,
  reactivateUser,
  resendInvitation,
  resetUserMfa,
  revokeInvitation,
  restoreUser,
  softDeleteUser,
  suspendUser,
  type AdminUser,
  type UserSortField,
  type UserStatus,
} from "../../../lib/api/admin-users";
import { getCurrentUser, type Role } from "../../../lib/api/auth";
import { ApiError } from "../../../lib/api/client";
import { useErrorText } from "../../../lib/i18n/api-errors";
import { useFormatters, useMessages } from "../../../lib/i18n/locale-provider";
import {
  usersMessages,
  type BulkKind,
  type UsersMessages,
} from "./users-screen.messages";

type RoleFilter = Role | "ALL";
type StatusFilter = UserStatus | "ALL";
type DeletionFilter = "ACTIVE" | "DELETED" | "ALL";

const SORT_FIELDS: readonly UserSortField[] = [
  "createdAt",
  "email",
  "lastName",
  "status",
  "lastLoginAt",
];

/** Column ids double as API sort fields; anything unknown falls back. */
function toSortField(id: string | undefined): UserSortField {
  return SORT_FIELDS.find((field) => field === id) ?? "createdAt";
}

export function UsersScreen() {
  const t = useMessages(usersMessages);
  const format = useFormatters();
  const errorText = useErrorText();
  const toast = useToast();
  const [rows, setRows] = useState<AdminUser[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  // The failure, not its text: the message follows a language switch.
  const [loadError, setLoadError] = useState<{ error: unknown } | null>(null);
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState<UserStatsValue>({
    total: 0,
    active: 0,
    invited: 0,
    suspended: 0,
    admins: 0,
  });

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [deletionFilter, setDeletionFilter] =
    useState<DeletionFilter>("ACTIVE");

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 5,
  });
  const [sorting, setSorting] = useState<SortingState>([
    { id: "createdAt", desc: true },
  ]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const [selfId, setSelfId] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);

  // Debounce typing so each keystroke does not hit the API.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    getCurrentUser()
      .then((me) => setSelfId(me.userId))
      .catch(() => setSelfId(null));
  }, []);

  const sort = sorting[0];
  const sortBy = toSortField(sort?.id);
  const sortDir = sort?.desc === false ? "asc" : "desc";

  // Guards against an older, slower response overwriting a newer one.
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    try {
      const page = await listUsers({
        page: pagination.pageIndex + 1,
        pageSize: pagination.pageSize,
        search: search || undefined,
        role: roleFilter === "ALL" ? undefined : roleFilter,
        status: statusFilter === "ALL" ? undefined : statusFilter,
        includeDeleted: deletionFilter === "ALL",
        onlyDeleted: deletionFilter === "DELETED",
        sortBy,
        sortDir,
      });
      if (id !== requestId.current) return;
      setRows(page.items);
      setTotalItems(page.totalItems);
      setLoadError(null);
    } catch (err) {
      if (id !== requestId.current) return;
      setLoadError({ error: err });
      setRows([]);
      setTotalItems(0);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [
    pagination.pageIndex,
    pagination.pageSize,
    search,
    roleFilter,
    statusFilter,
    deletionFilter,
    sortBy,
    sortDir,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadStats = useCallback(async () => {
    try {
      const [all, active, invited, suspended, admins] = await Promise.all([
        listUsers({ page: 1, pageSize: 1 }),
        listUsers({ page: 1, pageSize: 1, status: "ACTIVE" }),
        listUsers({ page: 1, pageSize: 1, status: "INVITED" }),
        listUsers({ page: 1, pageSize: 1, status: "SUSPENDED" }),
        listUsers({ page: 1, pageSize: 1, role: "ADMIN" }),
      ]);
      setStats({
        total: all.totalItems,
        active: active.totalItems,
        invited: invited.totalItems,
        suspended: suspended.totalItems,
        admins: admins.totalItems,
      });
    } catch {
      // The table remains the primary data surface; keep its error handling.
    }
  }, []);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const selectedIds = useMemo(
    () => Object.keys(rowSelection).filter((id) => rowSelection[id]),
    [rowSelection],
  );
  const selectedRows = useMemo(
    () => rows.filter((row) => selectedIds.includes(row.id)),
    [rows, selectedIds],
  );

  /** Runs one action over many rows and reports how it went, in one message. */
  const runBulk = useCallback(
    async (
      kind: BulkKind,
      ids: string[],
      action: (id: string) => Promise<unknown>,
    ) => {
      setBusy(true);
      const results = await Promise.allSettled(ids.map(action));
      const failed = results.filter((r) => r.status === "rejected").length;
      const ok = results.length - failed;
      const firstError = results.find((r) => r.status === "rejected") as
        PromiseRejectedResult | undefined;
      const reason = firstError?.reason;

      if (failed === 0) {
        toast.success(t.bulk.done[kind](ok), t.bulk.refreshed);
      } else {
        toast.error(
          t.bulk.partial[kind](ok, results.length),
          reason instanceof ApiError
            ? errorText.message(reason)
            : t.bulk.someFailed,
        );
      }
      setRowSelection({});
      setBusy(false);
      await load();
      await loadStats();
    },
    [errorText, load, loadStats, t, toast],
  );

  const runSingle = useCallback(
    async (
      label: string,
      action: () => Promise<unknown>,
      detail: string = t.done.default,
    ) => {
      setBusy(true);
      try {
        await action();
        toast.success(label, detail);
      } catch (err) {
        toast.error(
          t.done.failed,
          err instanceof ApiError ? errorText.message(err) : t.done.retry,
        );
      } finally {
        setBusy(false);
        await load();
        await loadStats();
      }
    },
    [errorText, load, loadStats, t, toast],
  );

  const columns = useMemo<ColumnDef<AdminUser>[]>(
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
            aria-label={t.columns.select(fullName(row.original))}
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(value === true)}
          />
        ),
      },
      {
        id: "lastName",
        size: 310,
        header: t.columns.user,
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
        size: 125,
        header: t.columns.state,
        enableSorting: true,
        cell: ({ row }) => (
          <AccountStateBadge state={row.original.accountState} />
        ),
      },
      {
        id: "lastLoginAt",
        size: 150,
        header: t.columns.lastLogin,
        enableSorting: true,
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground tabular-nums">
            {format.dateTime(row.original.lastLoginAt)}
          </span>
        ),
      },
      {
        id: "createdAt",
        size: 150,
        header: t.columns.created,
        enableSorting: true,
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground tabular-nums">
            {format.dateTime(row.original.createdAt)}
          </span>
        ),
      },
      {
        id: "actions",
        size: 56,
        enableSorting: false,
        header: () => <span className="sr-only">{t.columns.actions}</span>,
        cell: ({ row }) => (
          <RowActions
            t={t}
            user={row.original}
            isSelf={row.original.id === selfId}
            disabled={busy}
            onEdit={() => setEditing(row.original)}
            onAction={runSingle}
            onConfirm={setConfirm}
          />
        ),
      },
    ],
    [selfId, busy, runSingle, t, format],
  );

  const allSelectedDeleted =
    selectedRows.length > 0 &&
    selectedRows.every((row) => row.deletedAt !== null);
  const allSelectedActive =
    selectedRows.length > 0 &&
    selectedRows.every((row) => row.deletedAt === null);

  const handleDrawerAction = useCallback(
    (action: UserDrawerAction, user: AdminUser) => {
      if (action === "resend") {
        void runSingle(t.done.resent, () => resendInvitation(user.id));
        return;
      }
      if (action === "revoke") {
        void runSingle(t.done.revoked, () => revokeInvitation(user.id));
        return;
      }
      if (action === "suspend") {
        void runSingle(t.done.suspended, () => suspendUser(user.id));
        return;
      }
      if (action === "reactivate") {
        void runSingle(t.done.reactivated, () => reactivateUser(user.id));
        return;
      }
      if (action === "restore") {
        void runSingle(t.done.restored, () => restoreUser(user.id));
        return;
      }

      setConfirm({
        title:
          action === "hard-delete"
            ? t.confirm.hardTitle
            : t.confirm.deleteTitle(fullName(user)),
        description:
          action === "hard-delete"
            ? t.confirm.hardDescription
            : t.confirm.deleteDescription,
        actionLabel:
          action === "hard-delete"
            ? t.confirm.hardAction
            : t.confirm.deleteAction,
        destructive: true,
        confirmText: action === "hard-delete" ? user.email : undefined,
        run: () =>
          action === "hard-delete"
            ? runSingle(t.done.hardDeleted, () =>
                hardDeleteUser(user.id, user.email),
              )
            : runSingle(
                t.done.softDeleted,
                () => softDeleteUser(user.id),
                t.done.softDeletedHint,
              ),
      });
    },
    [runSingle, t],
  );

  return (
    <motion.div
      variants={stagger(0.08)}
      initial="hidden"
      animate="show"
      className="flex flex-col gap-6"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <motion.div variants={headerMotion.drivers.title}>
          <h1 className="text-[32px] font-bold leading-tight tracking-[-0.035em] text-foreground">
            {t.title}
          </h1>
          <p className="mt-1 text-[14px] text-muted-foreground">{t.subtitle}</p>
        </motion.div>
        <motion.div
          variants={headerMotion.drivers.actions}
          className="inline-flex"
        >
          <motion.div {...ctaMotion} className="inline-flex">
            <Button
              size="lg"
              onClick={() => setInviteOpen(true)}
              className="h-[46px] rounded-[9px] px-6 shadow-[0_5px_14px_rgba(48,71,217,.18)]"
            >
              <UserPlus />
              {t.invite}
            </Button>
          </motion.div>
        </motion.div>
      </div>

      <UserStats stats={stats} />

      <motion.div variants={sectionMotion}>
        <DataTable
          rowVariants={rowMotion.sweep}
          columns={columns}
          data={rows}
          rowCount={totalItems}
          getRowId={(row) => row.id}
          pagination={pagination}
          onPaginationChange={setPagination}
          sorting={sorting}
          onSortingChange={setSorting}
          rowSelection={rowSelection}
          onRowSelectionChange={setRowSelection}
          loading={loading}
          activeRowId={editing?.id}
          onRowClick={setEditing}
          toolbar={
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative min-w-[240px] flex-1">
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
                value={roleFilter}
                onValueChange={(value) => {
                  setRoleFilter(value as RoleFilter);
                  setPagination((prev) => ({ ...prev, pageIndex: 0 }));
                }}
              >
                <SelectTrigger
                  aria-label={t.filters.role}
                  className="h-11 w-[165px] rounded-[9px]"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t.filters.allRoles}</SelectItem>
                  <SelectItem value="DRIVER">{t.filters.drivers}</SelectItem>
                  <SelectItem value="ADMIN">{t.filters.admins}</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={statusFilter}
                onValueChange={(value) => {
                  setStatusFilter(value as StatusFilter);
                  setPagination((prev) => ({ ...prev, pageIndex: 0 }));
                }}
              >
                <SelectTrigger
                  aria-label={t.filters.status}
                  className="h-11 w-[170px] rounded-[9px]"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t.filters.anyStatus}</SelectItem>
                  <SelectItem value="INVITED">{t.filters.invited}</SelectItem>
                  <SelectItem value="ACTIVE">{t.filters.active}</SelectItem>
                  <SelectItem value="SUSPENDED">
                    {t.filters.suspended}
                  </SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={deletionFilter}
                onValueChange={(value) => {
                  setDeletionFilter(value as DeletionFilter);
                  setRowSelection({});
                  setPagination((prev) => ({ ...prev, pageIndex: 0 }));
                }}
              >
                <SelectTrigger
                  aria-label={t.filters.deletion}
                  className="h-11 w-[190px] rounded-[9px]"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">
                    {t.filters.activeAccounts}
                  </SelectItem>
                  <SelectItem value="DELETED">
                    {t.filters.deletedAccounts}
                  </SelectItem>
                  <SelectItem value="ALL">{t.filters.allAccounts}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          }
          bulkBar={
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-secondary/60 px-3 py-1.5">
              <Badge variant="default">{selectedIds.length}</Badge>
              <span className="text-[13px] font-medium text-foreground">
                {t.bulk.selected(selectedIds.length)}
              </span>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                {allSelectedActive && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        void runBulk("suspended", selectedIds, suspendUser)
                      }
                    >
                      <ShieldBan />
                      {t.bulk.suspend}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        void runBulk("reactivated", selectedIds, reactivateUser)
                      }
                    >
                      <ShieldCheck />
                      {t.bulk.reactivate}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={busy}
                      onClick={() =>
                        setConfirm({
                          title: t.bulk.deleteTitle(selectedIds.length),
                          description: t.bulk.deleteDescription,
                          actionLabel: t.bulk.softDelete,
                          destructive: true,
                          run: () =>
                            runBulk("deleted", selectedIds, softDeleteUser),
                        })
                      }
                    >
                      <Trash2 />
                      {t.bulk.softDelete}
                    </Button>
                  </>
                )}
                {allSelectedDeleted && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      void runBulk("restored", selectedIds, restoreUser)
                    }
                  >
                    <RotateCcw />
                    {t.bulk.restore}
                  </Button>
                )}
                {allSelectedDeleted && selectedRows.length === 1 && (
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={busy}
                    onClick={() => {
                      const user = selectedRows[0];
                      if (!user) return;
                      setConfirm({
                        title: t.confirm.hardTitleNamed(fullName(user)),
                        description: t.confirm.hardDescriptionShort,
                        actionLabel: t.confirm.hardAction,
                        destructive: true,
                        confirmText: user.email,
                        run: () =>
                          runSingle(t.done.hardDeleted, () =>
                            hardDeleteUser(user.id, user.email),
                          ),
                      });
                    }}
                  >
                    <Trash2 />
                    {t.bulk.deletePermanently}
                  </Button>
                )}
                {!allSelectedActive && !allSelectedDeleted && (
                  <span className="text-[12px] text-muted-foreground">
                    {t.bulk.mixed}
                  </span>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setRowSelection({})}
                >
                  {t.bulk.clear}
                </Button>
              </div>
            </div>
          }
          emptyState={
            <div className="grid h-52 place-items-center px-6 text-center">
              <div>
                <span className="mx-auto grid size-11 place-items-center rounded-xl bg-secondary">
                  <Users className="size-5 text-primary" />
                </span>
                <p className="mt-3 text-[14px] font-semibold text-foreground">
                  {loadError
                    ? loadError.error instanceof ApiError
                      ? errorText.message(loadError.error)
                      : t.loadFailed
                    : t.empty}
                </p>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  {loadError ? t.errorHint : t.emptyHint}
                </p>
              </div>
            </div>
          }
        />
      </motion.div>

      <UserSheet
        user={editing}
        open={editing !== null}
        isSelf={editing?.id === selfId}
        onOpenChange={(open) => !open && setEditing(null)}
        onSaved={(user) => {
          setEditing(user);
          toast.success(t.done.updated, t.done.updatedDetail(fullName(user)));
          void load();
        }}
        onAction={handleDrawerAction}
      />

      <InviteUserSheet
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onCreated={(user) => {
          toast.success(t.done.invited, t.done.invitedDetail(user.email));
          void load();
        }}
      />

      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </motion.div>
  );
}

function RowActions({
  t,
  user,
  isSelf,
  disabled,
  onEdit,
  onAction,
  onConfirm,
}: {
  t: UsersMessages;
  user: AdminUser;
  isSelf: boolean;
  disabled: boolean;
  onEdit: () => void;
  onAction: (
    label: string,
    action: () => Promise<unknown>,
    detail?: string,
  ) => Promise<void>;
  onConfirm: (request: ConfirmRequest) => void;
}) {
  const deleted = user.deletedAt !== null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t.row.actionsFor(fullName(user))}
        disabled={disabled}
        onClick={(event) => event.stopPropagation()}
        className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none data-[state=open]:bg-accent"
      >
        <MoreVertical className="size-4" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[208px]">
        <DropdownMenuLabel className="text-[12px] font-semibold text-muted-foreground">
          {fullName(user)}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={onEdit}>
            <Pencil />
            {t.row.edit}
          </DropdownMenuItem>

          {!deleted && user.status === "INVITED" && (
            <DropdownMenuItem
              onSelect={() =>
                void onAction(t.done.resent, () => resendInvitation(user.id))
              }
            >
              <Send />
              {t.row.resend}
            </DropdownMenuItem>
          )}

          {!deleted && user.status !== "SUSPENDED" && !isSelf && (
            <DropdownMenuItem
              onSelect={() =>
                void onAction(t.done.suspended, () => suspendUser(user.id))
              }
            >
              <ShieldBan />
              {t.row.suspend}
            </DropdownMenuItem>
          )}

          {!deleted && user.status === "SUSPENDED" && (
            <DropdownMenuItem
              onSelect={() =>
                void onAction(t.done.reactivated, () => reactivateUser(user.id))
              }
            >
              <ShieldCheck />
              {t.row.reactivate}
            </DropdownMenuItem>
          )}

          {deleted && (
            <DropdownMenuItem
              onSelect={() =>
                void onAction(t.done.restored, () => restoreUser(user.id))
              }
            >
              <RotateCcw />
              {t.row.restore}
            </DropdownMenuItem>
          )}

          {!deleted && user.mfaEnabled && !isSelf && (
            <DropdownMenuItem
              onSelect={() =>
                onConfirm({
                  title: t.confirm.mfaTitle,
                  description: t.confirm.mfaDescription(fullName(user)),
                  actionLabel: t.confirm.mfaAction,
                  destructive: true,
                  run: () =>
                    onAction(t.done.mfaReset, () => resetUserMfa(user.id)),
                })
              }
            >
              <KeyRound />
              {t.row.resetMfa}
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>

        {!isSelf && (
          <>
            <DropdownMenuSeparator />
            {!deleted ? (
              <DropdownMenuItem
                variant="destructive"
                onSelect={() =>
                  onConfirm({
                    title: t.confirm.softTitle(fullName(user)),
                    description: t.confirm.softDescription,
                    actionLabel: t.confirm.softAction,
                    destructive: true,
                    run: () =>
                      onAction(
                        t.done.softDeleted,
                        () => softDeleteUser(user.id),
                        t.done.softDeletedHint,
                      ),
                  })
                }
              >
                <Trash2 />
                {t.row.softDelete}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                variant="destructive"
                onSelect={() =>
                  onConfirm({
                    title: t.confirm.hardTitle,
                    description: t.confirm.hardDescription,
                    actionLabel: t.confirm.hardAction,
                    destructive: true,
                    confirmText: user.email,
                    run: () =>
                      onAction(t.done.hardDeleted, () =>
                        hardDeleteUser(user.id, user.email),
                      ),
                  })
                }
              >
                <Trash2 />
                {t.row.deletePermanently}
              </DropdownMenuItem>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
