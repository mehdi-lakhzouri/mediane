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
import {
  formatDateTime,
  fullName,
  initials,
} from "../../components/dashboard/users/format";
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
  const toast = useToast();
  const [rows, setRows] = useState<AdminUser[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
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
      setLoadError(
        err instanceof ApiError
          ? err.message
          : "Could not load users. Please try again.",
      );
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
      label: string,
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
        toast.success(
          `${label} ${ok} account${ok === 1 ? "" : "s"}.`,
          "The user list and statistics have been refreshed.",
        );
      } else {
        toast.error(
          `${label} ${ok} of ${results.length}.`,
          reason instanceof ApiError ? reason.message : "Some actions failed.",
        );
      }
      setRowSelection({});
      setBusy(false);
      await load();
      await loadStats();
    },
    [load, loadStats, toast],
  );

  const runSingle = useCallback(
    async (
      label: string,
      action: () => Promise<unknown>,
      detail = "The change is now reflected in the user list.",
    ) => {
      setBusy(true);
      try {
        await action();
        toast.success(label, detail);
      } catch (err) {
        toast.error(
          "The action could not be completed.",
          err instanceof ApiError ? err.message : "Please try again.",
        );
      } finally {
        setBusy(false);
        await load();
        await loadStats();
      }
    },
    [load, loadStats, toast],
  );

  const columns = useMemo<ColumnDef<AdminUser>[]>(
    () => [
      {
        id: "select",
        size: 40,
        enableSorting: false,
        header: ({ table }) => (
          <Checkbox
            aria-label="Select all rows on this page"
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
            aria-label={`Select ${fullName(row.original)}`}
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(value === true)}
          />
        ),
      },
      {
        id: "lastName",
        size: 310,
        header: "User",
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
        size: 125,
        header: "State",
        enableSorting: true,
        cell: ({ row }) => (
          <AccountStateBadge state={row.original.accountState} />
        ),
      },
      {
        id: "lastLoginAt",
        size: 150,
        header: "Last sign-in",
        enableSorting: true,
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground tabular-nums">
            {formatDateTime(row.original.lastLoginAt)}
          </span>
        ),
      },
      {
        id: "createdAt",
        size: 150,
        header: "Created",
        enableSorting: true,
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground tabular-nums">
            {formatDateTime(row.original.createdAt)}
          </span>
        ),
      },
      {
        id: "actions",
        size: 56,
        enableSorting: false,
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <RowActions
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
    [selfId, busy, runSingle],
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
        void runSingle("Invitation resent.", () => resendInvitation(user.id));
        return;
      }
      if (action === "revoke") {
        void runSingle("Invitation revoked.", () => revokeInvitation(user.id));
        return;
      }
      if (action === "suspend") {
        void runSingle("Account suspended.", () => suspendUser(user.id));
        return;
      }
      if (action === "reactivate") {
        void runSingle("Account reactivated.", () => reactivateUser(user.id));
        return;
      }
      if (action === "restore") {
        void runSingle("Account restored.", () => restoreUser(user.id));
        return;
      }

      setConfirm({
        title:
          action === "hard-delete"
            ? "Delete permanently?"
            : `Delete ${fullName(user)}?`,
        description:
          action === "hard-delete"
            ? "This permanently erases the profile, sessions, invitations, family links, health events, incidents, and notifications. A paired device is unlinked and the immutable audit trail is kept. Type the email address to confirm."
            : "They lose access immediately and all their sessions end. You can restore this account afterwards.",
        actionLabel: action === "hard-delete" ? "Delete permanently" : "Delete",
        destructive: true,
        confirmText: action === "hard-delete" ? user.email : undefined,
        run: () =>
          action === "hard-delete"
            ? runSingle("Account permanently deleted.", () =>
                hardDeleteUser(user.id, user.email),
              )
            : runSingle(
                "Account soft deleted.",
                () => softDeleteUser(user.id),
                "Open the Deleted accounts filter to restore it or delete it permanently.",
              ),
      });
    },
    [runSingle],
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
            Users
          </h1>
          <p className="mt-1 text-[14px] text-muted-foreground">
            Invite drivers and administrators, and manage their access.
          </p>
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
              Invite user
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
                  placeholder="Search name or email..."
                  aria-label="Search users"
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
                  aria-label="Filter by role"
                  className="h-11 w-[165px] rounded-[9px]"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All roles</SelectItem>
                  <SelectItem value="DRIVER">Drivers</SelectItem>
                  <SelectItem value="ADMIN">Admins</SelectItem>
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
                  aria-label="Filter by status"
                  className="h-11 w-[170px] rounded-[9px]"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Any status</SelectItem>
                  <SelectItem value="INVITED">Invited</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="SUSPENDED">Suspended</SelectItem>
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
                  aria-label="Deleted accounts"
                  className="h-11 w-[190px] rounded-[9px]"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active accounts</SelectItem>
                  <SelectItem value="DELETED">Deleted accounts</SelectItem>
                  <SelectItem value="ALL">All accounts</SelectItem>
                </SelectContent>
              </Select>
            </div>
          }
          bulkBar={
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-secondary/60 px-3 py-1.5">
              <Badge variant="default">{selectedIds.length}</Badge>
              <span className="text-[13px] font-medium text-foreground">
                selected
              </span>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                {allSelectedActive && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        void runBulk("Suspended", selectedIds, suspendUser)
                      }
                    >
                      <ShieldBan />
                      Suspend
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        void runBulk("Reactivated", selectedIds, reactivateUser)
                      }
                    >
                      <ShieldCheck />
                      Reactivate
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={busy}
                      onClick={() =>
                        setConfirm({
                          title: `Delete ${selectedIds.length} account${selectedIds.length === 1 ? "" : "s"}?`,
                          description:
                            "They lose access immediately and all their sessions end. You can restore them from the Deleted accounts filter.",
                          actionLabel: "Soft delete",
                          destructive: true,
                          run: () =>
                            runBulk("Deleted", selectedIds, softDeleteUser),
                        })
                      }
                    >
                      <Trash2 />
                      Soft delete
                    </Button>
                  </>
                )}
                {allSelectedDeleted && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      void runBulk("Restored", selectedIds, restoreUser)
                    }
                  >
                    <RotateCcw />
                    Restore
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
                        title: `Permanently delete ${fullName(user)}?`,
                        description:
                          "This permanently erases all user-owned information and cannot be undone. A paired device is unlinked; the immutable audit trail is retained. Type the email address to confirm.",
                        actionLabel: "Delete permanently",
                        destructive: true,
                        confirmText: user.email,
                        run: () =>
                          runSingle("Account permanently deleted.", () =>
                            hardDeleteUser(user.id, user.email),
                          ),
                      });
                    }}
                  >
                    <Trash2 />
                    Delete permanently
                  </Button>
                )}
                {!allSelectedActive && !allSelectedDeleted && (
                  <span className="text-[12px] text-muted-foreground">
                    Select only active or only deleted accounts.
                  </span>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setRowSelection({})}
                >
                  Clear
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
                  {loadError ?? "No users match these filters"}
                </p>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  {loadError
                    ? "Check that the API is reachable and try again."
                    : "Adjust the search or filters, or invite someone new."}
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
          toast.success(
            "User updated.",
            `${fullName(user)}’s identity information was saved.`,
          );
          void load();
        }}
        onAction={handleDrawerAction}
      />

      <InviteUserSheet
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onCreated={(user) => {
          toast.success(
            "Invitation sent.",
            `${user.email} can now activate the account from the invitation email.`,
          );
          void load();
        }}
      />

      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </motion.div>
  );
}

function RowActions({
  user,
  isSelf,
  disabled,
  onEdit,
  onAction,
  onConfirm,
}: {
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
        aria-label={`Actions for ${fullName(user)}`}
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
            View &amp; edit
          </DropdownMenuItem>

          {!deleted && user.status === "INVITED" && (
            <DropdownMenuItem
              onSelect={() =>
                void onAction("Invitation resent.", () =>
                  resendInvitation(user.id),
                )
              }
            >
              <Send />
              Resend invitation
            </DropdownMenuItem>
          )}

          {!deleted && user.status !== "SUSPENDED" && !isSelf && (
            <DropdownMenuItem
              onSelect={() =>
                void onAction("Account suspended.", () => suspendUser(user.id))
              }
            >
              <ShieldBan />
              Suspend
            </DropdownMenuItem>
          )}

          {!deleted && user.status === "SUSPENDED" && (
            <DropdownMenuItem
              onSelect={() =>
                void onAction("Account reactivated.", () =>
                  reactivateUser(user.id),
                )
              }
            >
              <ShieldCheck />
              Reactivate
            </DropdownMenuItem>
          )}

          {deleted && (
            <DropdownMenuItem
              onSelect={() =>
                void onAction("Account restored.", () => restoreUser(user.id))
              }
            >
              <RotateCcw />
              Restore
            </DropdownMenuItem>
          )}

          {!deleted && user.mfaEnabled && !isSelf && (
            <DropdownMenuItem
              onSelect={() =>
                onConfirm({
                  title: "Reset two-step verification?",
                  description: `Only when ${fullName(user)} has lost both their phone and their recovery codes. Their authenticator is removed and every session ends; they set up a new one at their next sign-in.`,
                  actionLabel: "Reset",
                  destructive: true,
                  run: () =>
                    onAction("Two-step verification reset.", () =>
                      resetUserMfa(user.id),
                    ),
                })
              }
            >
              <KeyRound />
              Reset 2-step verification
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
                    title: `Soft delete ${fullName(user)}?`,
                    description:
                      "They lose access immediately and all their sessions end. You can restore the account from the Deleted accounts filter, or permanently delete it there.",
                    actionLabel: "Soft delete",
                    destructive: true,
                    run: () =>
                      onAction(
                        "Account soft deleted.",
                        () => softDeleteUser(user.id),
                        "Open the Deleted accounts filter to restore it or delete it permanently.",
                      ),
                  })
                }
              >
                <Trash2 />
                Soft delete
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                variant="destructive"
                onSelect={() =>
                  onConfirm({
                    title: "Delete permanently?",
                    description:
                      "This permanently erases the profile, sessions, invitations, family links, health events, incidents, and notifications. A paired device is unlinked and the immutable audit trail is kept. Type the email address to confirm.",
                    actionLabel: "Delete permanently",
                    destructive: true,
                    confirmText: user.email,
                    run: () =>
                      onAction("Account permanently deleted.", () =>
                        hardDeleteUser(user.id, user.email),
                      ),
                  })
                }
              >
                <Trash2 />
                Delete permanently
              </DropdownMenuItem>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
