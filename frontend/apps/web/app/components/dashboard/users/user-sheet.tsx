"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  CalendarDays,
  ChevronDown,
  Clock3,
  Database,
  FileText,
  KeyRound,
  LoaderCircle,
  Mail,
  MoreVertical,
  Pencil,
  RotateCcw,
  Send,
  ShieldBan,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { Badge } from "@repo/ui/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@repo/ui/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components/ui/tooltip";
import {
  getInvitationStatus,
  getUser,
  updateUser,
  type AdminUser,
  type InvitationStatus,
} from "../../../../lib/api/admin-users";
import { ApiError } from "../../../../lib/api/client";
import { useToast } from "../toast-provider";
import { formatDateTime, fullName, initials } from "./format";
import { AccountStateBadge, RoleBadge } from "./user-badges";

export type UserDrawerAction =
  | "suspend"
  | "reactivate"
  | "resend"
  | "revoke"
  | "delete"
  | "restore"
  | "hard-delete";

interface UserSheetProps {
  user: AdminUser | null;
  open: boolean;
  isSelf: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (user: AdminUser) => void;
  onAction: (action: UserDrawerAction, user: AdminUser) => void;
}

export function UserSheet({
  user,
  open,
  isSelf,
  onOpenChange,
  onSaved,
  onAction,
}: UserSheetProps) {
  const toast = useToast();
  const [details, setDetails] = useState<AdminUser | null>(null);
  const [invitation, setInvitation] = useState<InvitationStatus | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setDetails(user);
    setFirstName(user.firstName);
    setLastName(user.lastName);
    setEditing(false);
    setError(null);
    setInvitation(null);
  }, [user]);

  useEffect(() => {
    if (!open || !user) return;
    let active = true;
    setLoadingDetails(true);

    getUser(user.id)
      .then((fresh) => {
        if (!active) return;
        setDetails(fresh);
        setFirstName(fresh.firstName);
        setLastName(fresh.lastName);
      })
      .catch(() => {
        if (active) setDetails(user);
      })
      .finally(() => {
        if (active) setLoadingDetails(false);
      });

    getInvitationStatus(user.id)
      .then((status) => {
        if (active) setInvitation(status);
      })
      .catch(() => {
        if (active) setInvitation(null);
      });

    return () => {
      active = false;
    };
  }, [open, user]);

  if (!user) return null;
  const current = details ?? user;
  const deleted = current.deletedAt !== null;
  const dirty =
    firstName.trim() !== current.firstName ||
    lastName.trim() !== current.lastName;

  async function handleSave() {
    if (!dirty || saving) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateUser(current.id, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });
      setDetails(updated);
      onSaved(updated);
      setEditing(false);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Could not save. Please try again.";
      setError(message);
      toast.error("User update failed.", message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <TooltipProvider delayDuration={180}>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          overlayClassName="bg-[#101828]/28 backdrop-blur-[8px] backdrop-saturate-75"
          closeClassName="top-6 right-6 z-20 text-[#39507f] opacity-100 hover:bg-[#eef3ff] [&_svg]:size-5"
          className="cg-user-drawer w-full bg-white shadow-[-18px_0_60px_rgba(16,24,40,.18)] sm:max-w-[614px]"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <SheetHeader className="sticky top-0 z-10 gap-1 border-0 bg-white/95 px-7 pt-7 pb-5 pr-16 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <SheetTitle className="text-[26px] leading-8 tracking-[-0.035em]">
                User details
              </SheetTitle>
              {loadingDetails && (
                <LoaderCircle className="size-4 animate-spin text-muted-foreground" />
              )}
            </div>
            <p className="text-[14px] leading-5 text-[#536489]">
              View and manage user information, role, and access permissions.
            </p>
          </SheetHeader>

          <SheetBody className="px-7 pt-0 pb-5">
            <section className="overflow-hidden rounded-[12px] border border-[#d7e1f2] bg-[#f8faff] shadow-[0_1px_2px_rgba(16,24,40,.02)]">
              <div className="flex items-center gap-7 px-5 py-5">
                <span className="grid size-[100px] shrink-0 place-items-center rounded-full bg-[#e7edff] text-[28px] font-bold text-[#2441d5]">
                  {initials(current)}
                </span>
                <div className="min-w-0 text-left">
                  <h2 className="text-[27px] font-bold tracking-[-0.035em] text-foreground">
                    {fullName(current)}
                  </h2>
                  <p className="mt-1 truncate text-[14px] text-[#536489]">
                    {current.email}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <RoleBadge role={current.role} />
                    <AccountStateBadge state={current.accountState} />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 px-5 pb-4">
                <Button asChild className="col-span-2 h-11 rounded-[9px]">
                  <a href={`mailto:${current.email}`}>
                    <Mail />
                    Send message
                  </a>
                </Button>
                <Button
                  variant="outline"
                  className="h-11 rounded-[9px] border-[#d8e1ee] bg-white"
                  onClick={() => setEditing((value) => !value)}
                >
                  <Pencil />
                  Edit user
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="h-11 rounded-[9px] border-[#d8e1ee] bg-white"
                    >
                      <MoreVertical />
                      More actions
                      <ChevronDown className="ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[250px]">
                    {!deleted && current.status === "INVITED" && (
                      <DropdownMenuItem
                        onSelect={() => onAction("resend", current)}
                      >
                        <Send /> Resend invitation
                      </DropdownMenuItem>
                    )}
                    {invitation?.status === "PENDING" && (
                      <DropdownMenuItem
                        onSelect={() => onAction("revoke", current)}
                      >
                        <Mail /> Revoke invitation
                      </DropdownMenuItem>
                    )}
                    {!deleted && current.status !== "SUSPENDED" && !isSelf && (
                      <DropdownMenuItem
                        onSelect={() => onAction("suspend", current)}
                      >
                        <ShieldBan /> Suspend account
                      </DropdownMenuItem>
                    )}
                    {!deleted && current.status === "SUSPENDED" && (
                      <DropdownMenuItem
                        onSelect={() => onAction("reactivate", current)}
                      >
                        <ShieldCheck /> Reactivate account
                      </DropdownMenuItem>
                    )}
                    {deleted && (
                      <DropdownMenuItem
                        onSelect={() => onAction("restore", current)}
                      >
                        <RotateCcw /> Restore account
                      </DropdownMenuItem>
                    )}
                    {!isSelf && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() =>
                            onAction(
                              deleted ? "hard-delete" : "delete",
                              current,
                            )
                          }
                        >
                          <Trash2 />
                          {deleted ? "Delete permanently" : "Delete account"}
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </section>

            {editing && (
              <section className="mt-5 rounded-2xl border border-[#dfe6f2] bg-white p-5">
                <h3 className="text-[14px] font-semibold text-foreground">
                  Edit identity
                </h3>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <InfoFieldLabel
                      htmlFor="drawer-firstName"
                      label="First name"
                      description="The given name displayed throughout the administration console."
                    />
                    <Input
                      id="drawer-firstName"
                      value={firstName}
                      maxLength={100}
                      disabled={saving}
                      onChange={(event) => setFirstName(event.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <InfoFieldLabel
                      htmlFor="drawer-lastName"
                      label="Last name"
                      description="The family name used to identify this account."
                    />
                    <Input
                      id="drawer-lastName"
                      value={lastName}
                      maxLength={100}
                      disabled={saving}
                      onChange={(event) => setLastName(event.target.value)}
                    />
                  </div>
                </div>
                {error && (
                  <p
                    className="mt-3 text-[12px] text-danger-strong"
                    role="alert"
                  >
                    {error}
                  </p>
                )}
                <div className="mt-4 flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditing(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    disabled={!dirty || saving}
                    onClick={handleSave}
                  >
                    {saving && <LoaderCircle className="animate-spin" />}
                    Save changes
                  </Button>
                </div>
              </section>
            )}

            <DetailSection icon={UserRound} title="Account information">
              <DetailRow
                icon={UserRound}
                label="Full name"
                description="The account holder’s full display name."
                value={fullName(current)}
              />
              <DetailRow
                icon={Mail}
                label="Email address"
                description="The verified address used for invitations and sign-in."
                value={current.email}
              />
              <DetailRow
                icon={ShieldCheck}
                label="Role"
                description="Determines the permissions granted to this account."
                value={<RoleBadge role={current.role} />}
              />
              <DetailRow
                icon={Database}
                label="Account state"
                description="The effective access and onboarding state calculated by the backend."
                value={<AccountStateBadge state={current.accountState} />}
              />
              <DetailRow
                icon={KeyRound}
                label="Two-step verification"
                description="An authenticator app is required at every sign-in."
                value={
                  <Badge
                    variant={current.mfaEnabled ? "success" : "outline"}
                    className="h-7 px-2.5"
                  >
                    {current.mfaEnabled ? "On" : "Off"}
                  </Badge>
                }
              />
              <DetailRow
                icon={CalendarDays}
                label="User since"
                description="The date and time when the account was created."
                value={formatDateTime(current.createdAt)}
              />
              <DetailRow
                icon={Clock3}
                label="Last sign-in"
                description="The most recent successful authentication recorded for this account."
                value={formatDateTime(current.lastLoginAt)}
              />
            </DetailSection>

            <DetailSection icon={FileText} title="Additional details">
              <DetailRow
                icon={Mail}
                label="Invited by"
                description="The administrator who originally invited this user."
                value={invitation?.invitedBy ?? "Not available"}
              />
              <DetailRow
                icon={Clock3}
                label="Invitation status"
                description="The current lifecycle state of the latest invitation."
                value={
                  invitation ? (
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-success-surface px-2 py-1 text-[11px] font-semibold text-success-strong">
                      <span className="size-1.5 rounded-full bg-success" />
                      {sentenceCase(invitation.status)}
                    </span>
                  ) : (
                    "Not available"
                  )
                }
              />
              <DetailRow
                icon={CalendarDays}
                label="Created at"
                description="When the latest invitation was created."
                value={
                  invitation
                    ? formatDateTime(invitation.createdAt)
                    : "Not available"
                }
              />
            </DetailSection>
          </SheetBody>
        </SheetContent>
      </Sheet>
    </TooltipProvider>
  );
}

function sentenceCase(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

function InfoMarker({
  label,
  description,
}: {
  label: string;
  description: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`About ${label}`}
          className="grid size-4 shrink-0 place-items-center rounded-full border border-[#aab7ca] bg-white text-[10px] font-bold leading-none text-[#526180] transition hover:border-primary hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
        >
          i
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="left"
        className="max-w-[260px] text-[12px] leading-5"
      >
        {description}
      </TooltipContent>
    </Tooltip>
  );
}

function InfoFieldLabel({
  htmlFor,
  label,
  description,
}: {
  htmlFor: string;
  label: string;
  description: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <InfoMarker label={label} description={description} />
      <Label htmlFor={htmlFor}>{label}</Label>
    </div>
  );
}

function DetailSection({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof UserRound;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-4 overflow-hidden rounded-[12px] border border-[#d7e1f2] bg-white px-5 pt-4 pb-0">
      <h3 className="flex items-center gap-2.5 text-[17px] font-bold tracking-[-0.02em] text-foreground">
        <Icon className="size-5 text-[#2947e8]" strokeWidth={1.9} />
        {title}
      </h3>
      <dl className="mt-3 divide-y divide-[#dce4f0] border-t border-[#dce4f0]">
        {children}
      </dl>
    </section>
  );
}

function DetailRow({
  icon: Icon,
  label,
  description,
  value,
}: {
  icon: typeof UserRound;
  label: string;
  description: string;
  value: ReactNode;
}) {
  return (
    <div
      className="grid min-h-10 grid-cols-[minmax(130px,.9fr)_minmax(0,1.1fr)] items-center gap-4 sm:grid-cols-[230px_minmax(0,1fr)]"
      title={description}
    >
      <dt className="flex items-center gap-3 text-[14px] text-[#607096]">
        <Icon
          className="size-[19px] shrink-0 text-[#2947e8]"
          strokeWidth={1.9}
        />
        {label}
      </dt>
      <dd className="min-w-0 break-words text-[14px] font-medium text-[#172554]">
        {value}
      </dd>
    </div>
  );
}
