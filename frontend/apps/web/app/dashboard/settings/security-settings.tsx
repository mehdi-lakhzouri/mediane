"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  KeyRound,
  LifeBuoy,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { Badge } from "@repo/ui/components/ui/badge";
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
import { useToast } from "../../components/dashboard/toast-provider";
import { formatDate } from "../../components/dashboard/users/format";
import { changePassword } from "../../../lib/api/auth";
import { ApiError } from "../../../lib/api/client";
import {
  confirmTotpSetup,
  getMfaStatus,
  regenerateRecoveryCodes,
  startTotpSetup,
  type MfaStatus,
  type TotpSetup,
} from "../../../lib/api/mfa";

function messageFor(error: unknown): string {
  if (!(error instanceof ApiError))
    return "Something went wrong. Please try again.";
  switch (error.code) {
    case "MFA_CODE_INVALID":
      return "That code is not valid. Use the current code from your app, or an unused recovery code.";
    case "MFA_CODE_REQUIRED":
      return "Enter a code from your authenticator app.";
    case "INVALID_CURRENT_PASSWORD":
      return "Your current password is incorrect.";
    case "WEAK_PASSWORD":
      return error.details[0]?.message
        ? `The new password ${error.details[0].message}.`
        : "Choose a stronger password.";
    case "PASSWORD_UNCHANGED":
      return "The new password must be different from the current one.";
    case "MFA_SETUP_NOT_STARTED":
      return "The setup expired. Start again.";
    case "RATE_LIMITED":
      return "Too many attempts. Wait a few minutes, then try again.";
    default:
      return error.message;
  }
}

/** Your own account security: second factor, recovery codes, password. */
export function SecuritySettings() {
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [failed, setFailed] = useState(false);
  const [dialog, setDialog] = useState<"codes" | "replace" | "password" | null>(
    null,
  );

  const refresh = useCallback(async () => {
    try {
      setStatus(await getMfaStatus());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[32px] font-bold leading-tight tracking-[-0.035em] text-foreground">
          Settings
        </h1>
        <p className="mt-1 text-[14px] text-muted-foreground">
          Security of your administrator account.
        </p>
      </div>

      <section className="rounded-[14px] border border-border bg-card p-6 shadow-[0_1px_2px_rgba(16,24,40,.03)]">
        <div className="flex flex-wrap items-start gap-4">
          <span className="grid size-11 place-items-center rounded-xl bg-[#eef3ff] text-[#2441d5]">
            <ShieldCheck className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[17px] font-semibold text-foreground">
                Two-step verification
              </h2>
              {status && (
                <Badge variant={status.enabled ? "success" : "warning"}>
                  {status.enabled ? "On" : "Off"}
                </Badge>
              )}
              {status?.required && <Badge variant="outline">Required</Badge>}
            </div>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {status?.enabled
                ? `Every sign-in asks for a code from your authenticator app. Active since ${formatDate(status.enabledAt)}.`
                : "Every sign-in will ask for a code from an authenticator app."}
            </p>
            {failed && (
              <p className="mt-2 text-[13px] text-danger">
                Could not load your security status.
              </p>
            )}
          </div>
        </div>

        {status?.enabled && (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[12px] border border-border bg-secondary/40 p-4">
              <p className="flex items-center gap-2 text-[14px] font-medium text-foreground">
                <LifeBuoy className="size-4 text-primary" /> Recovery codes
              </p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                {status.recoveryCodesRemaining} of 10 left. Each one signs you
                in once if you lose your phone.
              </p>
              {status.recoveryCodesLow && (
                <p className="mt-2 flex items-center gap-1.5 text-[13px] font-medium text-warning-strong">
                  <AlertTriangle className="size-4" /> Running low: generate new
                  ones.
                </p>
              )}
              <Button
                variant="outline"
                size="sm"
                className="mt-3 rounded-[9px]"
                onClick={() => setDialog("codes")}
              >
                Generate new codes
              </Button>
            </div>
            <div className="rounded-[12px] border border-border bg-secondary/40 p-4">
              <p className="flex items-center gap-2 text-[14px] font-medium text-foreground">
                <Smartphone className="size-4 text-primary" /> Authenticator app
              </p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                New phone? Move CabinGuard to it. The current app keeps working
                until the new one is confirmed.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 rounded-[9px]"
                onClick={() => setDialog("replace")}
              >
                Replace authenticator
              </Button>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-[14px] border border-border bg-card p-6 shadow-[0_1px_2px_rgba(16,24,40,.03)]">
        <div className="flex flex-wrap items-center gap-4">
          <span className="grid size-11 place-items-center rounded-xl bg-[#eef3ff] text-[#2441d5]">
            <LockKeyhole className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[17px] font-semibold text-foreground">
              Password
            </h2>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Changing it signs you out everywhere else.
            </p>
          </div>
          <Button
            variant="outline"
            className="rounded-[9px]"
            onClick={() => setDialog("password")}
          >
            Change password
          </Button>
        </div>
      </section>

      <RegenerateCodesDialog
        open={dialog === "codes"}
        onClose={() => {
          setDialog(null);
          void refresh();
        }}
      />
      <ReplaceAuthenticatorDialog
        open={dialog === "replace"}
        onClose={() => {
          setDialog(null);
          void refresh();
        }}
      />
      <ChangePasswordDialog
        open={dialog === "password"}
        mfaEnabled={status?.enabled ?? false}
        onClose={() => setDialog(null)}
      />
    </div>
  );
}

// -------------------------------------------------------------- shared bits

function CodeField({
  id,
  label,
  value,
  onChange,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete="one-time-code"
        autoFocus
        maxLength={12}
        placeholder="123456"
        className="h-11 rounded-[9px] font-mono tracking-[0.12em]"
      />
      <p className="text-[12px] text-muted-foreground">{hint}</p>
    </div>
  );
}

function ErrorLine({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-[13px] font-medium text-danger">
      {message}
    </p>
  );
}

/** Shown once: copy, download, and an explicit "stored" check before closing. */
function RecoveryCodesPanel({
  codes,
  onDone,
}: {
  codes: string[];
  onDone: () => void;
}) {
  const [stored, setStored] = useState(false);
  const [copied, setCopied] = useState(false);
  const text = `CabinGuard recovery codes\nEach code works once. Keep them private.\n\n${codes.join("\n")}\n`;

  return (
    <>
      <ol className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-[12px] border border-border bg-secondary/40 px-5 py-4 font-mono text-[14px] font-semibold tracking-[0.08em] text-foreground">
        {codes.map((code) => (
          <li key={code} className="select-all">
            {code}
          </li>
        ))}
      </ol>
      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="outline"
          className="rounded-[9px]"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setCopied(true);
            } catch {
              // Clipboard blocked: codes stay selectable and downloadable.
            }
          }}
        >
          {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy all"}
        </Button>
        <Button
          variant="outline"
          className="rounded-[9px]"
          onClick={() => {
            const url = URL.createObjectURL(
              new Blob([text], { type: "text/plain" }),
            );
            const link = document.createElement("a");
            link.href = url;
            link.download = "cabinguard-recovery-codes.txt";
            link.click();
            URL.revokeObjectURL(url);
          }}
        >
          <Download /> Download .txt
        </Button>
      </div>
      <label className="flex items-center gap-2.5 text-[13px] text-foreground">
        <input
          type="checkbox"
          checked={stored}
          onChange={(event) => setStored(event.target.checked)}
          className="size-4 accent-[var(--color-primary)]"
        />
        I have stored these codes somewhere safe.
      </label>
      <DialogFooter>
        <Button disabled={!stored} onClick={onDone} className="rounded-[9px]">
          Done
        </Button>
      </DialogFooter>
    </>
  );
}

// -------------------------------------------------------------- dialogs

function RegenerateCodesDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setCode("");
      setCodes(null);
      setError(null);
    }
  }, [open]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setCodes((await regenerateRecoveryCodes(code.trim())).recoveryCodes);
      toast.success(
        "New recovery codes generated.",
        "The previous ones no longer work.",
      );
    } catch (failure) {
      setError(messageFor(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      // Closing is only allowed through "Done" once codes are on screen.
      onOpenChange={(next) => !next && !codes && onClose()}
    >
      <DialogContent className="max-w-md">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>
            {codes ? "Your new recovery codes" : "Generate new recovery codes"}
          </DialogTitle>
          <DialogDescription>
            {codes
              ? "Shown only once. Your previous codes no longer work."
              : "Your current recovery codes will stop working."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 p-6">
          {codes ? (
            <RecoveryCodesPanel codes={codes} onDone={onClose} />
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <CodeField
                id="regen-code"
                label="Confirm with a code"
                value={code}
                onChange={setCode}
                hint="From your authenticator app, or an unused recovery code."
              />
              <ErrorLine message={error} />
              <DialogFooter>
                <Button
                  type="submit"
                  disabled={busy || code.trim().length < 6}
                  className="rounded-[9px]"
                >
                  {busy && <LoaderCircle className="animate-spin" />}
                  Generate
                </Button>
              </DialogFooter>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ReplaceAuthenticatorDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const [step, setStep] = useState<"verify" | "scan" | "codes">("verify");
  const [proof, setProof] = useState("");
  const [setup, setSetup] = useState<TotpSetup | null>(null);
  const [qr, setQr] = useState("");
  const [newCode, setNewCode] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setStep("verify");
      setProof("");
      setSetup(null);
      setQr("");
      setNewCode("");
      setCodes([]);
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!setup) return;
    let active = true;
    QRCode.toDataURL(setup.otpauthUri, { width: 360, margin: 1 })
      .then((url) => active && setQr(url))
      .catch(
        () =>
          active &&
          setError("The QR code could not be drawn. Use the setup key."),
      );
    return () => {
      active = false;
    };
  }, [setup]);

  async function verify(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setSetup(await startTotpSetup(proof.trim()));
      setStep("scan");
    } catch (failure) {
      setError(messageFor(failure));
    } finally {
      setBusy(false);
    }
  }

  async function confirm(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setCodes((await confirmTotpSetup(newCode.trim())).recoveryCodes);
      setStep("codes");
      toast.success(
        "Authenticator replaced.",
        "Only the new app works from now on.",
      );
    } catch (failure) {
      setError(messageFor(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && step !== "codes" && onClose()}
    >
      <DialogContent className="max-w-md">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>
            {step === "verify" && "Replace your authenticator"}
            {step === "scan" && "Scan with the new app"}
            {step === "codes" && "Your new recovery codes"}
          </DialogTitle>
          <DialogDescription>
            {step === "verify" &&
              "Prove it's you with your current app. Lost the phone? Use a recovery code."}
            {step === "scan" &&
              "Your current app keeps working until you confirm the new one."}
            {step === "codes" &&
              "Shown only once. Your previous codes no longer work."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 p-6">
          {step === "verify" && (
            <form onSubmit={verify} className="space-y-4">
              <CodeField
                id="replace-proof"
                label="Current code or recovery code"
                value={proof}
                onChange={setProof}
                hint="6 digits from your current app, or XXXXX-XXXXX."
              />
              <ErrorLine message={error} />
              <DialogFooter>
                <Button
                  type="submit"
                  disabled={busy || proof.trim().length < 6}
                  className="rounded-[9px]"
                >
                  {busy && <LoaderCircle className="animate-spin" />}
                  Continue
                </Button>
              </DialogFooter>
            </form>
          )}
          {step === "scan" && setup && (
            <form onSubmit={confirm} className="space-y-4">
              <div className="mx-auto w-fit rounded-xl border border-border bg-white p-2">
                {qr ? (
                  <Image
                    src={qr}
                    alt="QR code for the new authenticator"
                    width={180}
                    height={180}
                    unoptimized
                  />
                ) : (
                  <div className="grid size-[180px] place-items-center">
                    <LoaderCircle className="animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>
              <p className="text-center font-mono text-[12px] tracking-[0.12em] break-all text-muted-foreground">
                {setup.secret.match(/.{1,4}/g)?.join(" ")}
              </p>
              <CodeField
                id="replace-new-code"
                label="Code from the new app"
                value={newCode}
                onChange={setNewCode}
                hint="The 6 digits now shown in the app you just set up."
              />
              <ErrorLine message={error} />
              <DialogFooter>
                <Button
                  type="submit"
                  disabled={busy || newCode.trim().length !== 6}
                  className="rounded-[9px]"
                >
                  {busy && <LoaderCircle className="animate-spin" />}
                  <KeyRound /> Confirm new app
                </Button>
              </DialogFooter>
            </form>
          )}
          {step === "codes" && (
            <RecoveryCodesPanel codes={codes} onDone={onClose} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ChangePasswordDialog({
  open,
  mfaEnabled,
  onClose,
}: {
  open: boolean;
  mfaEnabled: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setCurrent("");
      setNext("");
      setConfirmation("");
      setCode("");
      setError(null);
    }
  }, [open]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (next.length < 12)
      return setError("The new password needs at least 12 characters.");
    if (next !== confirmation)
      return setError("The new passwords do not match.");
    setBusy(true);
    setError(null);
    try {
      await changePassword({
        currentPassword: current,
        newPassword: next,
        mfaCode: mfaEnabled ? code.trim() : undefined,
      });
      toast.success(
        "Password changed.",
        "Your other sessions were signed out.",
      );
      onClose();
    } catch (failure) {
      setError(messageFor(failure));
    } finally {
      setBusy(false);
    }
  }

  const field = (
    id: string,
    label: string,
    value: string,
    onChange: (v: string) => void,
    autoComplete: string,
  ) => (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="password"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        maxLength={128}
        className="h-11 rounded-[9px]"
      />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>Change password</DialogTitle>
          <DialogDescription>
            At least 12 characters, and not containing your email.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4 p-6">
          {field(
            "pw-current",
            "Current password",
            current,
            setCurrent,
            "current-password",
          )}
          {field("pw-new", "New password", next, setNext, "new-password")}
          {field(
            "pw-confirm",
            "Confirm new password",
            confirmation,
            setConfirmation,
            "new-password",
          )}
          {mfaEnabled && (
            <CodeField
              id="pw-code"
              label="Verification code"
              value={code}
              onChange={setCode}
              hint="From your authenticator app, or an unused recovery code."
            />
          )}
          <ErrorLine message={error} />
          <DialogFooter>
            <Button
              type="submit"
              disabled={
                busy ||
                !current ||
                !next ||
                (mfaEnabled && code.trim().length < 6)
              }
              className="rounded-[9px]"
            >
              {busy && <LoaderCircle className="animate-spin" />}
              Change password
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
