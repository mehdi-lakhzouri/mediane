"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  LogOut,
} from "lucide-react";
import { RecoveryShell } from "../components/recovery-shell";
import { ApiError } from "../../lib/api/client";
import {
  changePassword,
  destinationFor,
  getCurrentUser,
  logout,
  type CurrentUser,
} from "../../lib/api/auth";

const MIN_LENGTH = 12;

function changeErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return "Something went wrong. Please try again.";
  }
  switch (error.code) {
    case "INVALID_CURRENT_PASSWORD":
      return "The temporary password is incorrect. Use the one from your invitation email.";
    case "WEAK_PASSWORD":
      return error.details[0]?.message
        ? `Your new password ${error.details[0].message}.`
        : "Choose a stronger password.";
    case "PASSWORD_UNCHANGED":
      return "Your new password must be different from the temporary one.";
    case "RATE_LIMITED":
      return "Too many attempts. Wait a few minutes, then try again.";
    case "NETWORK_ERROR":
      return error.message;
    default:
      return "We couldn't update your password. Please try again.";
  }
}

/**
 * First sign-in of an invited administrator: the temporary password from the
 * invitation email must be replaced before anything else. The API enforces
 * it (PASSWORD_CHANGE_REQUIRED); this screen is the way through.
 */
export function ChangePasswordScreen() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getCurrentUser()
      .then((me) => {
        if (!active) return;
        if (me.accountState !== "PASSWORD_CHANGE_REQUIRED") {
          router.replace(destinationFor(me.accountState));
          return;
        }
        setUser(me);
      })
      .catch(() => {
        if (active) router.replace("/");
      });
    return () => {
      active = false;
    };
  }, [router]);

  const emailName = user?.email.split("@")[0]?.toLowerCase() ?? "";
  const checks = {
    length: password.length >= MIN_LENGTH,
    different: password.length > 0 && password !== current,
    noEmail:
      password.length > 0 &&
      (emailName.length < 3 || !password.toLowerCase().includes(emailName)),
    match: password.length > 0 && password === confirmation,
  };
  const ready = Object.values(checks).every(Boolean) && current.length > 0;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    if (!ready) {
      setError("Check the requirements below the password fields.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const principal = await changePassword({
        currentPassword: current,
        newPassword: password,
      });
      router.replace(destinationFor(principal.accountState));
    } catch (failure) {
      setError(changeErrorMessage(failure));
      setSubmitting(false);
    }
  }

  async function signOut() {
    try {
      await logout();
    } finally {
      router.replace("/");
    }
  }

  if (!user) {
    return (
      <RecoveryShell
        icon={LoaderCircle}
        eyebrow="Secure sign-in"
        title="One moment"
        description="Checking your session."
        footnote="Your temporary password only works once and expires soon."
      >
        <LoaderCircle className="mx-auto size-6 animate-spin text-[var(--sx-accent)]" />
      </RecoveryShell>
    );
  }

  return (
    <RecoveryShell
      icon={KeyRound}
      eyebrow={`Welcome, ${user.firstName}`}
      title="Choose your own password"
      description="Replace the temporary password from your invitation email. You'll set up two-step verification right after."
      footnote="Your temporary password stops working as soon as you choose your own."
    >
      <form onSubmit={handleSubmit} aria-busy={submitting} noValidate>
        <PasswordField
          id="current-password"
          label="Temporary password"
          autoComplete="current-password"
          value={current}
          onChange={setCurrent}
          show={show}
          disabled={submitting}
          placeholder="From your invitation email"
          autoFocus
        />
        <PasswordField
          id="new-password"
          label="New password"
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
          show={show}
          disabled={submitting}
          placeholder={`At least ${MIN_LENGTH} characters`}
          onToggleShow={() => setShow((value) => !value)}
          className="mt-5"
        />
        <PasswordField
          id="confirm-password"
          label="Confirm new password"
          autoComplete="new-password"
          value={confirmation}
          onChange={setConfirmation}
          show={show}
          disabled={submitting}
          placeholder="Repeat your new password"
          className="mt-5"
        />

        <ul
          className="mt-4 grid gap-2 text-xs sm:grid-cols-2"
          aria-label="Password requirements"
        >
          <Requirement
            valid={checks.length}
            label={`${MIN_LENGTH} characters minimum`}
          />
          <Requirement
            valid={checks.different}
            label="Different from the temporary one"
          />
          <Requirement
            valid={checks.noEmail}
            label="Doesn't contain your email"
          />
          <Requirement valid={checks.match} label="Passwords match" />
        </ul>

        <AnimatePresence initial={false}>
          {error && (
            <motion.p
              initial={reduceMotion ? false : { opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              role="alert"
              className="mt-4 flex items-start gap-2.5 rounded-xl border border-[var(--sx-error-border)] bg-[var(--sx-error-bg)] px-4 py-3 text-sm text-[var(--sx-error-text)]"
            >
              <AlertCircle className="mt-0.5 size-[18px] shrink-0" />
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        <motion.button
          whileHover={reduceMotion || submitting ? undefined : { y: -2 }}
          whileTap={reduceMotion || submitting ? undefined : { scale: 0.985 }}
          type="submit"
          disabled={submitting}
          className="recovery-primary mt-6"
        >
          {submitting ? (
            <LoaderCircle className="size-5 animate-spin" />
          ) : (
            <ArrowRight className="size-5" />
          )}
          {submitting ? "Saving your password…" : "Save and continue"}
        </motion.button>
      </form>

      <button
        type="button"
        onClick={signOut}
        className="mx-auto mt-5 flex items-center gap-2 text-sm font-bold text-[var(--sx-muted)] transition hover:text-[var(--sx-accent)]"
      >
        <LogOut className="size-4" />
        Not {user.email}? Sign out
      </button>
    </RecoveryShell>
  );
}

interface PasswordFieldProps {
  id: string;
  label: string;
  autoComplete: string;
  value: string;
  onChange: (value: string) => void;
  show: boolean;
  disabled: boolean;
  placeholder: string;
  onToggleShow?: () => void;
  autoFocus?: boolean;
  className?: string;
}

function PasswordField(props: PasswordFieldProps) {
  return (
    <div className={props.className}>
      <label
        htmlFor={props.id}
        className="text-sm font-bold text-[var(--sx-label)]"
      >
        {props.label}
      </label>
      <div className="recovery-input-shell mt-2 flex h-14 items-center rounded-xl border px-4">
        <LockKeyhole className="size-5 shrink-0 text-[var(--sx-icon-muted)]" />
        <input
          id={props.id}
          type={props.show ? "text" : "password"}
          autoComplete={props.autoComplete}
          required
          maxLength={128}
          autoFocus={props.autoFocus}
          disabled={props.disabled}
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
          placeholder={props.placeholder}
          className="h-full min-w-0 flex-1 bg-transparent px-4 text-[15px] text-[var(--sx-ink)] outline-none placeholder:text-[var(--sx-placeholder)]"
        />
        {props.onToggleShow && (
          <button
            type="button"
            onClick={props.onToggleShow}
            className="grid size-9 place-items-center rounded-lg text-[var(--sx-icon-muted)] transition hover:bg-[var(--sx-icon-hover-bg)]"
            aria-label={props.show ? "Hide passwords" : "Show passwords"}
          >
            {props.show ? (
              <EyeOff className="size-5" />
            ) : (
              <Eye className="size-5" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function Requirement({ valid, label }: { valid: boolean; label: string }) {
  return (
    <li
      className={`flex items-center gap-2 transition-colors ${
        valid ? "text-[var(--sx-success-text)]" : "text-[var(--sx-muted)]"
      }`}
    >
      <span
        className={`grid size-5 place-items-center rounded-full border transition-colors ${
          valid
            ? "border-[var(--sx-success-border)] bg-[var(--sx-success-bg)]"
            : "border-[var(--sx-border)] bg-[var(--sx-input-bg)]"
        }`}
      >
        {valid && <Check className="size-3" strokeWidth={3} />}
      </span>
      {label}
    </li>
  );
}
