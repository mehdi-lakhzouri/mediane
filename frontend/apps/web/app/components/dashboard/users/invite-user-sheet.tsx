"use client";

import { useState, type FormEvent } from "react";
import {
  LoaderCircle,
  Mail,
  ShieldCheck,
  UserRound,
  UserRoundPlus,
} from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/ui/select";
import { createUser, type AdminUser } from "../../../../lib/api/admin-users";
import { ApiError } from "../../../../lib/api/client";
import type { Role } from "../../../../lib/api/auth";
import { useToast } from "../toast-provider";

interface InviteUserSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (user: AdminUser) => void;
}

export function InviteUserSheet({
  open,
  onOpenChange,
  onCreated,
}: InviteUserSheetProps) {
  const toast = useToast();
  const [role, setRole] = useState<Role>("DRIVER");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close(next: boolean) {
    if (submitting) return;
    if (!next) setError(null);
    onOpenChange(next);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const form = event.currentTarget;
    const data = new FormData(form);

    setSubmitting(true);
    setError(null);
    try {
      const created = await createUser({
        email: String(data.get("email") ?? "").trim(),
        firstName: String(data.get("firstName") ?? "").trim(),
        lastName: String(data.get("lastName") ?? "").trim(),
        role,
      });
      form.reset();
      setRole("DRIVER");
      onCreated(created);
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Could not create the account. Please try again.";
      setError(message);
      toast.error("Invitation could not be sent.", message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent
        overlayClassName="bg-[#18213b]/40 backdrop-blur-[5px] backdrop-saturate-75"
        closeClassName="top-6 right-6 size-10 bg-[#f1f4f9] text-[#1d2b4f] hover:bg-[#e8edf5]"
        className="max-h-[calc(100dvh-2rem)] max-w-[586px] overflow-y-auto rounded-[16px] border-[#dce3ee] shadow-[0_24px_70px_rgba(16,24,40,.24)]"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <form onSubmit={handleSubmit}>
          <DialogHeader className="flex-row items-start gap-5 px-7 pt-8 pb-5 text-left">
            <span className="grid size-16 shrink-0 place-items-center rounded-[14px] bg-[#eaf0ff] text-[#2947e8]">
              <UserRoundPlus className="size-8" strokeWidth={1.8} />
            </span>
            <div className="min-w-0 pt-1">
              <DialogTitle className="text-[28px] leading-8 tracking-[-0.035em]">
                Invite a user
              </DialogTitle>
              <DialogDescription className="mt-1.5 max-w-[426px] text-[14px] leading-[21px]">
                They receive an email with a single-use link and a temporary
                password, and must choose their own password on first sign-in.
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="flex flex-col gap-5 px-7 pt-1 pb-[34px]">
            <div className="cg-form-reveal cg-form-delay-1 flex flex-col gap-2">
              <Label htmlFor="invite-email">Email address</Label>
              <div className="relative">
                <Mail
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-4 z-10 size-[18px] -translate-y-1/2 text-[#7787a4]"
                  strokeWidth={1.8}
                />
                <Input
                  id="invite-email"
                  name="email"
                  type="email"
                  required
                  maxLength={254}
                  autoComplete="off"
                  placeholder="driver@company.com"
                  disabled={submitting}
                  className="h-12 rounded-[9px] pr-4 pl-11 text-[16px] focus-visible:ring-[3px]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="cg-form-reveal cg-form-delay-2 flex flex-col gap-2">
                <Label htmlFor="invite-first">First name</Label>
                <div className="relative">
                  <UserRound
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1/2 left-3.5 z-10 size-[17px] -translate-y-1/2 text-[#7787a4]"
                    strokeWidth={1.8}
                  />
                  <Input
                    id="invite-first"
                    name="firstName"
                    required
                    maxLength={100}
                    placeholder="e.g. Amara"
                    disabled={submitting}
                    className="h-11 rounded-[9px] pr-3 pl-10"
                  />
                </div>
              </div>
              <div className="cg-form-reveal cg-form-delay-3 flex flex-col gap-2">
                <Label htmlFor="invite-last">Last name</Label>
                <div className="relative">
                  <UserRound
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1/2 left-3.5 z-10 size-[17px] -translate-y-1/2 text-[#7787a4]"
                    strokeWidth={1.8}
                  />
                  <Input
                    id="invite-last"
                    name="lastName"
                    required
                    maxLength={100}
                    placeholder="e.g. Okafor"
                    disabled={submitting}
                    className="h-11 rounded-[9px] pr-3 pl-10"
                  />
                </div>
              </div>
            </div>

            <div className="cg-form-reveal cg-form-delay-4 flex flex-col gap-2">
              <Label htmlFor="invite-role">Role</Label>
              <div className="relative">
                <ShieldCheck
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-3.5 z-10 size-[17px] -translate-y-1/2 text-[#7787a4]"
                  strokeWidth={1.8}
                />
                <Select
                  value={role}
                  onValueChange={(value) => setRole(value as Role)}
                  disabled={submitting}
                >
                  <SelectTrigger
                    id="invite-role"
                    className="h-11 w-full rounded-[9px] pr-4 pl-10 text-[15px]"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DRIVER">Driver</SelectItem>
                    <SelectItem value="ADMIN">Administrator</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-[12px] text-muted-foreground">
                Administrators can manage every account, including this one.
              </p>
            </div>

            <p className="cg-form-reveal cg-form-delay-5 flex items-start gap-4 rounded-[10px] border border-[#cfdaed] bg-[#f7f9fd] px-5 py-5 text-[14px] leading-[21px] text-[#526180]">
              <Mail
                className="mt-0.5 size-6 shrink-0 text-[#2947e8]"
                strokeWidth={1.8}
              />
              The temporary password is generated here and shown only in that
              email. Nobody, including you, can read it afterwards.
            </p>

            {error && (
              <p
                role="alert"
                className="rounded-lg border border-danger/25 bg-danger-surface px-3 py-2 text-[13px] text-danger-strong"
              >
                {error}
              </p>
            )}
          </div>

          <DialogFooter className="border-t border-border px-7 py-5">
            <Button
              type="button"
              variant="outline"
              onClick={() => close(false)}
              disabled={submitting}
              className="h-11 rounded-[9px] px-6 text-[15px]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="h-11 rounded-[9px] px-6 text-[15px] shadow-[0_5px_14px_rgba(48,71,217,.2)]"
            >
              {submitting && <LoaderCircle className="animate-spin" />}
              {submitting ? "Sending" : "Send invitation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
