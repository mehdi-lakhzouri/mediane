"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { ApiError } from "../../lib/api/client";
import {
  login,
  type AccountState,
  type SessionPrincipal,
} from "../../lib/api/auth";

type LoginStatus =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "error"; message: string }
  | { kind: "success"; principal: SessionPrincipal };

const SUCCESS_MESSAGES: Record<AccountState, string> = {
  PASSWORD_CHANGE_REQUIRED:
    "Signed in. For your security, please choose a new password to replace your temporary one.",
  PROFILE_SETUP_REQUIRED:
    "Signed in. Please complete your profile to finish setting up your account.",
  ACTIVE: "Signed in successfully.",
};

function loginErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return "Something went wrong. Please try again.";
  }
  switch (error.code) {
    case "INVALID_CREDENTIALS":
      return "Invalid email or password.";
    case "RATE_LIMITED":
      return "Too many sign-in attempts. Please wait a few minutes and try again.";
    case "VALIDATION_FAILED":
      return "Please enter a valid email address and password.";
    case "TEMPORARY_PASSWORD_EXPIRED":
    case "NETWORK_ERROR":
      return error.message;
    default:
      return "Something went wrong. Please try again.";
  }
}

// Where to send the user once signed in, based on their account state.
// The password-change and profile-setup pages are not built yet, so for now
// every authenticated state lands on the dashboard (its guard handles the rest).
const DESTINATION: Record<AccountState, string> = {
  PASSWORD_CHANGE_REQUIRED: "/dashboard",
  PROFILE_SETUP_REQUIRED: "/dashboard",
  ACTIVE: "/dashboard",
};

export function LoginCard() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [status, setStatus] = useState<LoginStatus>({ kind: "idle" });
  const reduceMotion = useReducedMotion();
  // Stays true from success through navigation so the button never flips back.
  const submitting = status.kind === "submitting" || status.kind === "success";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const form = event.currentTarget;
    const data = new FormData(form);
    setStatus({ kind: "submitting" });
    try {
      const principal = await login({
        email: String(data.get("email") ?? "").trim(),
        password: String(data.get("password") ?? ""),
        rememberMe: remember,
      });
      form.reset();
      setStatus({ kind: "success", principal });
      router.replace(DESTINATION[principal.accountState]);
    } catch (error) {
      setStatus({ kind: "error", message: loginErrorMessage(error) });
    }
  }

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={
        reduceMotion
          ? { duration: 0 }
          : {
              delay: 0.15,
              duration: 0.65,
              ease: [0.22, 1, 0.36, 1],
            }
      }
      className="glass-panel flex w-full max-w-[602px] flex-col rounded-[28px] px-6 py-10 sm:px-12 xl:h-[calc(100svh-149px)] xl:min-h-[700px] xl:max-w-none xl:max-h-[790px] xl:rounded-[26px] xl:px-[clamp(36px,3.25vw,55px)] xl:py-9"
    >
      <div
        className="mx-auto grid size-[92px] place-items-center rounded-full border shadow-[0_12px_32px_rgba(25,120,180,.2)]"
        style={{
          borderColor: "var(--sx-badge-border)",
          background: "var(--sx-badge-bg)",
        }}
      >
        <LockKeyhole
          className="size-9 drop-shadow-[0_4px_8px_rgba(43,139,197,.28)]"
          style={{ color: "var(--sx-badge-icon)" }}
          strokeWidth={1.8}
        />
      </div>

      <div className="mt-5 text-center">
        <h2
          className="text-[clamp(30px,2.2vw,38px)] font-extrabold tracking-[-0.045em]"
          style={{ color: "var(--sx-ink)" }}
        >
          Welcome back
        </h2>
        <p
          className="mx-auto mt-2 max-w-[430px] text-[15px] leading-6 sm:text-[17px]"
          style={{ color: "var(--sx-body)" }}
        >
          Sign in to your CabinGuard account to continue
          <br className="hidden sm:block" /> your journey, safely and securely.
        </p>
      </div>

      <form className="mt-7" onSubmit={handleSubmit} aria-busy={submitting}>
        <label
          htmlFor="email"
          className="text-sm font-semibold"
          style={{ color: "var(--sx-label)" }}
        >
          Email address
        </label>
        <div className="input-shell mt-2 flex h-14 items-center rounded-xl border px-4 transition sm:h-[56px]">
          <Mail
            className="size-[22px] shrink-0"
            style={{ color: "var(--sx-icon-muted)" }}
            strokeWidth={1.7}
          />
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            disabled={submitting}
            placeholder="you@company.com"
            className="h-full w-full bg-transparent px-5 text-[15px] outline-none placeholder:text-[var(--sx-placeholder)]"
            style={{ color: "var(--sx-ink)" }}
          />
        </div>

        <div className="mt-6 flex items-center justify-between">
          <label
            htmlFor="password"
            className="text-sm font-semibold"
            style={{ color: "var(--sx-label)" }}
          >
            Password
          </label>
        </div>
        <div className="input-shell mt-2 flex h-14 items-center rounded-xl border px-4 transition sm:h-[56px]">
          <LockKeyhole
            className="size-[21px] shrink-0"
            style={{ color: "var(--sx-icon-muted)" }}
            strokeWidth={1.7}
          />
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            maxLength={128}
            disabled={submitting}
            placeholder="Enter your password"
            className="h-full min-w-0 flex-1 bg-transparent px-5 text-[15px] outline-none placeholder:text-[var(--sx-placeholder)]"
            style={{ color: "var(--sx-ink)" }}
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            className="grid size-9 place-items-center rounded-lg transition hover:bg-[var(--sx-icon-hover-bg)] hover:text-[var(--sx-icon-hover-fg)]"
            style={{ color: "var(--sx-icon-muted)" }}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <EyeOff className="size-5" />
            ) : (
              <Eye className="size-5" />
            )}
          </button>
        </div>

        <div className="mt-3 text-right">
          <Link
            href="/forgot-password"
            className="text-sm font-semibold underline underline-offset-2 transition hover:text-[var(--sx-accent-hover)]"
            style={{ color: "var(--sx-accent)" }}
          >
            Forgot password?
          </Link>
        </div>

        <label className="mt-4 flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={remember}
            onChange={(event) => setRemember(event.target.checked)}
            className="sr-only"
          />
          <span
            className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md border transition"
            style={
              remember
                ? {
                    borderColor: "var(--sx-check-border)",
                    background: "var(--sx-check-bg)",
                    boxShadow: "0 6px 14px rgba(31,146,255,.24)",
                  }
                : {
                    borderColor: "var(--sx-check-off-border)",
                    background: "var(--sx-check-off-bg)",
                  }
            }
          >
            {remember && (
              <Check className="size-[18px] text-white" strokeWidth={3} />
            )}
          </span>
          <span>
            <span
              className="block text-sm font-semibold"
              style={{ color: "var(--sx-label)" }}
            >
              Keep me signed in
            </span>
            <span
              className="mt-0.5 block text-xs"
              style={{ color: "var(--sx-muted)" }}
            >
              On this device for a more seamless experience.
            </span>
          </span>
        </label>

        <div aria-live="polite" className="mt-5 empty:hidden">
          {status.kind === "error" && (
            <p
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm"
              style={{
                borderColor: "var(--sx-error-border)",
                background: "var(--sx-error-bg)",
                color: "var(--sx-error-text)",
              }}
            >
              <AlertCircle className="mt-0.5 size-[18px] shrink-0" />
              {status.message}
            </p>
          )}
          {status.kind === "success" && (
            <p
              className="flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm"
              style={{
                borderColor: "var(--sx-success-border)",
                background: "var(--sx-success-bg)",
                color: "var(--sx-success-text)",
              }}
            >
              <CheckCircle2 className="mt-0.5 size-[18px] shrink-0" />
              {SUCCESS_MESSAGES[status.principal.accountState]}
            </p>
          )}
        </div>

        <motion.button
          whileHover={reduceMotion || submitting ? undefined : { y: -2 }}
          whileTap={reduceMotion || submitting ? undefined : { scale: 0.985 }}
          type="submit"
          disabled={submitting}
          className="primary-button mt-6 flex h-[60px] w-full items-center justify-center gap-5 rounded-2xl text-base font-extrabold text-white transition duration-300 disabled:cursor-wait disabled:opacity-70 sm:text-lg"
        >
          {submitting ? (
            <LoaderCircle className="size-5 animate-spin" />
          ) : (
            <ArrowRight className="size-5" />
          )}
          {submitting ? "Signing in…" : "Sign in securely"}
        </motion.button>
      </form>

      <div
        className="mt-8 border-t pt-5"
        style={{ borderColor: "var(--sx-divider)" }}
      >
        <div
          className="flex items-center justify-center gap-4"
          style={{ color: "var(--sx-muted)" }}
        >
          <ShieldCheck
            className="size-7 shrink-0"
            style={{ color: "var(--sx-icon-soft)" }}
            strokeWidth={1.7}
          />
          <p className="text-[11px] leading-[1.55] sm:text-xs">
            Your data is encrypted and protected with industry-leading
            <br className="hidden sm:block" /> security standards.
          </p>
          <a
            href="#"
            className="ml-auto hidden shrink-0 items-center gap-1 text-xs font-semibold sm:flex"
            style={{ color: "var(--sx-accent)" }}
          >
            Learn more <ArrowRight className="size-4" />
          </a>
        </div>
      </div>
    </motion.div>
  );
}
