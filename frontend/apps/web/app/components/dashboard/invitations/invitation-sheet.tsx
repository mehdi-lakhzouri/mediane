"use client";

import {
  CalendarClock,
  Check,
  Clock3,
  Copy,
  KeyRound,
  Mail,
  RotateCcw,
  Send,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@repo/ui/components/ui/sheet";
import type { AdminInvitation } from "../../../../lib/api/admin-invitations";
import { useToast } from "../toast-provider";
import { formatDateTime, fullName, initials } from "../users/format";
import { RoleBadge } from "../users/user-badges";
import { InvitationStatusBadge } from "./invitation-status-badge";

export type InvitationAction = "resend" | "revoke";

export function InvitationSheet({
  invitation,
  open,
  busy,
  onOpenChange,
  onAction,
}: {
  invitation: AdminInvitation | null;
  open: boolean;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onAction: (action: InvitationAction, invitation: AdminInvitation) => void;
}) {
  const toast = useToast();
  if (!invitation) return null;

  const canResend =
    invitation.userStatus === "INVITED" && invitation.userDeletedAt === null;
  const canRevoke = invitation.status === "PENDING";
  const inviter = invitation.invitedBy
    ? fullName(invitation.invitedBy)
    : "System administrator";

  async function copyIdentifier() {
    try {
      await navigator.clipboard.writeText(invitation!.invitationId);
      toast.success("Invitation ID copied.");
    } catch {
      toast.error("Could not copy the invitation ID.");
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        overlayClassName="bg-[#101828]/28 backdrop-blur-[8px] backdrop-saturate-75"
        closeClassName="top-6 right-6 z-20 text-[#39507f] opacity-100 hover:bg-[#eef3ff] [&_svg]:size-5"
        className="w-full bg-white shadow-[-18px_0_60px_rgba(16,24,40,.18)] sm:max-w-[614px]"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <SheetHeader className="sticky top-0 z-10 gap-1 border-0 bg-white/95 px-7 pt-7 pb-5 pr-16 backdrop-blur-xl">
          <SheetTitle className="text-[26px] leading-8 tracking-[-0.035em]">
            Invitation details
          </SheetTitle>
          <p className="text-[14px] leading-5 text-[#536489]">
            Review the recipient, invitation lifecycle and available actions.
          </p>
        </SheetHeader>

        <SheetBody className="px-7 pt-0 pb-7">
          <section className="rounded-[12px] border border-[#d7e1f2] bg-[#f8faff] px-5 py-5">
            <div className="flex items-center gap-5">
              <span className="grid size-[72px] shrink-0 place-items-center rounded-full bg-[#e7edff] text-[18px] font-bold text-[#2441d5]">
                {initials(invitation)}
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-[24px] font-bold tracking-[-0.03em] text-foreground">
                  {fullName(invitation)}
                </h2>
                <p className="mt-1 truncate text-[13px] text-[#536489]">
                  {invitation.email}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <RoleBadge role={invitation.role} />
                  <InvitationStatusBadge status={invitation.status} />
                  {invitation.userDeletedAt ? (
                    <Badge variant="outline">Account deleted</Badge>
                  ) : null}
                </div>
              </div>
            </div>
          </section>

          <section className="mt-6 grid grid-cols-2 gap-3">
            <InfoCard
              icon={Send}
              label="Issued"
              value={formatDateTime(invitation.createdAt)}
            />
            <InfoCard
              icon={CalendarClock}
              label={invitation.status === "EXPIRED" ? "Expired" : "Expires"}
              value={formatDateTime(invitation.expiresAt)}
            />
            <InfoCard icon={UserRound} label="Invited by" value={inviter} />
            <InfoCard
              icon={
                invitation.status === "ACCEPTED"
                  ? Check
                  : invitation.status === "PENDING"
                    ? Clock3
                    : RotateCcw
              }
              label="Lifecycle"
              value={lifecycleText(invitation)}
            />
          </section>

          <section className="mt-7">
            <h3 className="text-[16px] font-semibold text-foreground">
              Invitation timeline
            </h3>
            <div className="relative mt-4 space-y-5 pl-8 before:absolute before:top-2 before:bottom-2 before:left-[9px] before:w-px before:bg-[#dbe4f2]">
              <TimelineItem
                title="Invitation issued"
                detail={`Created by ${inviter}`}
                date={formatDateTime(invitation.createdAt)}
                active
              />
              <TimelineItem
                title={lifecycleText(invitation)}
                detail={lifecycleDetail(invitation)}
                date={lifecycleDate(invitation)}
                active={invitation.status !== "PENDING"}
              />
            </div>
          </section>

          <section className="mt-7 rounded-[12px] border border-[#d7e1f2] bg-[#f8faff] px-4 py-4">
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#e7edff] text-primary">
                <KeyRound className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-foreground">
                  Secure single-use invitation
                </p>
                <p className="mt-1 text-[12px] leading-5 text-muted-foreground">
                  The invitation token and temporary password are never exposed
                  in the dashboard. Resending rotates both credentials.
                </p>
                <button
                  type="button"
                  onClick={() => void copyIdentifier()}
                  className="mt-2 inline-flex items-center gap-1.5 font-mono text-[11px] text-primary hover:underline"
                >
                  <Copy className="size-3" />
                  {invitation.invitationId}
                </button>
              </div>
            </div>
          </section>

          <div className="mt-7 grid gap-2 sm:grid-cols-2">
            <Button asChild variant="outline" className="h-11 rounded-[9px]">
              <a href={`mailto:${invitation.email}`}>
                <Mail /> Email recipient
              </a>
            </Button>
            {canResend ? (
              <Button
                type="button"
                disabled={busy}
                onClick={() => onAction("resend", invitation)}
                className="h-11 rounded-[9px]"
              >
                <Send /> Resend invitation
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                disabled
                className="h-11 rounded-[9px]"
              >
                <ShieldCheck /> Account activated
              </Button>
            )}
            {canRevoke ? (
              <Button
                type="button"
                variant="destructive"
                disabled={busy}
                onClick={() => onAction("revoke", invitation)}
                className="h-11 rounded-[9px] sm:col-span-2"
              >
                Revoke active invitation
              </Button>
            ) : null}
          </div>
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}

function InfoCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Send;
  label: string;
  value: string;
}) {
  return (
    <article className="min-w-0 rounded-[10px] border border-[#e1e8f4] px-3.5 py-3">
      <p className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
        <Icon className="size-3.5 text-primary" /> {label}
      </p>
      <p className="mt-1.5 truncate text-[12px] font-semibold text-foreground">
        {value}
      </p>
    </article>
  );
}

function TimelineItem({
  title,
  detail,
  date,
  active,
}: {
  title: string;
  detail: string;
  date: string;
  active: boolean;
}) {
  return (
    <div className="relative">
      <span
        className={`absolute top-1 -left-8 size-[19px] rounded-full border-[5px] border-white ${active ? "bg-primary" : "bg-[#cbd5e5]"}`}
      />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[13px] font-semibold text-foreground">{title}</p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">{detail}</p>
        </div>
        <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
          {date}
        </span>
      </div>
    </div>
  );
}

function lifecycleText(invitation: AdminInvitation): string {
  switch (invitation.status) {
    case "ACCEPTED":
      return "Invitation accepted";
    case "EXPIRED":
      return "Invitation expired";
    case "REVOKED":
      return "Invitation revoked";
    case "SUPERSEDED":
      return "Replaced by a newer invitation";
    default:
      return "Awaiting acceptance";
  }
}

function lifecycleDetail(invitation: AdminInvitation): string {
  switch (invitation.status) {
    case "ACCEPTED":
      return "The email address was verified and the account activated.";
    case "EXPIRED":
      return "The link can no longer be used. Send a new invitation.";
    case "REVOKED":
      return "An administrator disabled this invitation link.";
    case "SUPERSEDED":
      return "A newer link and temporary password replaced this attempt.";
    default:
      return "The single-use link remains valid until its expiry time.";
  }
}

function lifecycleDate(invitation: AdminInvitation): string {
  if (invitation.acceptedAt) return formatDateTime(invitation.acceptedAt);
  if (invitation.revokedAt) return formatDateTime(invitation.revokedAt);
  if (invitation.status === "EXPIRED")
    return formatDateTime(invitation.expiresAt);
  return invitation.status === "PENDING" ? "Current" : "Historical";
}
