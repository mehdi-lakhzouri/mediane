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
import { destinationFor, login, type AccountState } from "../../lib/api/auth";
import { holdMfaChallenge } from "../../lib/mfa-challenge";
import { useErrorText, type ErrorText } from "../../lib/i18n/api-errors";
import { useMessages } from "../../lib/i18n/locale-provider";
import { defineMessages } from "../../lib/i18n/messages";

const messages = defineMessages({
  en: {
    success: {
      PASSWORD_CHANGE_REQUIRED:
        "Signed in. Choose your own password to replace the temporary one.",
      MFA_SETUP_REQUIRED:
        "Signed in. Set up two-step verification to protect your account.",
      PROFILE_SETUP_REQUIRED: "Signed in.",
      ACTIVE: "Signed in successfully.",
    } satisfies Record<AccountState, string>,
    mfaNext: "Password accepted. One more step: your verification code.",
    errors: {
      rateLimited:
        "Too many sign-in attempts. Please wait a few minutes and try again.",
      validation: "Please enter a valid email address and password.",
      mobileOnly: "Driver accounts sign in with the CabinGuard mobile app.",
    },
    title: "Welcome back",
    eyebrow: "Secure portal",
    subtitle: "Sign in to your CabinGuard account",
    email: "Email address",
    emailPlaceholder: "you@company.com",
    password: "Password",
    passwordPlaceholder: "Enter your password",
    showPassword: "Show password",
    hidePassword: "Hide password",
    forgot: "Forgot password?",
    remember: "Keep me signed in",
    rememberHint: "On this device for a more seamless experience.",
    submit: "Sign in securely",
    submitting: "Signing in…",
    encrypted: "Encrypted connection",
    protected: "Your account and health data stay protected.",
  },
  fr: {
    success: {
      PASSWORD_CHANGE_REQUIRED:
        "Connecté. Choisissez votre propre mot de passe pour remplacer le mot de passe temporaire.",
      MFA_SETUP_REQUIRED:
        "Connecté. Configurez la vérification en deux étapes pour protéger votre compte.",
      PROFILE_SETUP_REQUIRED: "Connecté.",
      ACTIVE: "Connexion réussie.",
    },
    mfaNext:
      "Mot de passe accepté. Encore une étape : votre code de vérification.",
    errors: {
      rateLimited:
        "Trop de tentatives de connexion. Patientez quelques minutes puis réessayez.",
      validation: "Saisissez une adresse e-mail et un mot de passe valides.",
      mobileOnly:
        "Les comptes conducteur se connectent avec l’application mobile CabinGuard.",
    },
    title: "Bon retour",
    eyebrow: "Portail sécurisé",
    subtitle: "Connectez-vous à votre compte CabinGuard",
    email: "Adresse e-mail",
    emailPlaceholder: "vous@entreprise.com",
    password: "Mot de passe",
    passwordPlaceholder: "Saisissez votre mot de passe",
    showPassword: "Afficher le mot de passe",
    hidePassword: "Masquer le mot de passe",
    forgot: "Mot de passe oublié ?",
    remember: "Rester connecté",
    rememberHint: "Sur cet appareil, pour une expérience plus fluide.",
    submit: "Se connecter en toute sécurité",
    submitting: "Connexion…",
    encrypted: "Connexion chiffrée",
    protected: "Votre compte et vos données de santé restent protégés.",
  },
});

type LoginMessages = (typeof messages)["en"];

type LoginStatus =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "error"; message: string }
  | { kind: "success"; message: string };

function loginErrorMessage(
  error: unknown,
  t: LoginMessages,
  errorText: ErrorText,
): string {
  if (!(error instanceof ApiError)) return errorText.message(error);
  switch (error.code) {
    case "RATE_LIMITED":
      return t.errors.rateLimited;
    case "VALIDATION_FAILED":
      return t.errors.validation;
    case "USE_MOBILE_APP":
      return t.errors.mobileOnly;
    case "INVALID_CREDENTIALS":
    case "TEMPORARY_PASSWORD_EXPIRED":
    case "NETWORK_ERROR":
      return errorText.message(error);
    default:
      // Never echo other server messages here: login stays uninformative.
      return errorText.message(null);
  }
}

export function LoginCard() {
  const t = useMessages(messages);
  const errorText = useErrorText();
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
      const outcome = await login({
        email: String(data.get("email") ?? "").trim(),
        password: String(data.get("password") ?? ""),
        rememberMe: remember,
      });
      form.reset();
      if (outcome.kind === "mfa") {
        holdMfaChallenge(outcome);
        setStatus({
          kind: "success",
          message: t.mfaNext,
        });
        router.push("/mfa/verify");
        return;
      }
      const state = outcome.principal.accountState;
      setStatus({ kind: "success", message: t.success[state] });
      router.replace(destinationFor(state));
    } catch (error) {
      setStatus({
        kind: "error",
        message: loginErrorMessage(error, t, errorText),
      });
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
      className="glass-panel flex w-full max-w-[602px] flex-col rounded-[28px] px-6 py-8 sm:px-10 sm:py-9 xl:h-[calc(100svh-149px)] xl:min-h-[660px] xl:max-h-[790px] xl:max-w-none xl:justify-center xl:rounded-[26px] xl:px-[clamp(36px,3.25vw,55px)] xl:py-8"
    >
      <div className="flex items-center justify-between gap-5">
        <div
          className="inline-flex h-9 items-center gap-2 rounded-full border px-3 text-[10px] font-extrabold uppercase tracking-[0.18em]"
          style={{
            borderColor: "var(--sx-badge-border)",
            background: "var(--sx-input-bg)",
            color: "var(--sx-accent)",
          }}
        >
          <ShieldCheck className="size-4" strokeWidth={2.2} />
          {t.eyebrow}
        </div>
        <div
          className="grid size-14 shrink-0 place-items-center rounded-full border shadow-[0_10px_30px_rgba(25,120,180,.16)]"
          style={{
            borderColor: "var(--sx-badge-border)",
            background: "var(--sx-badge-bg)",
          }}
        >
          <LockKeyhole
            className="size-6 drop-shadow-[0_4px_8px_rgba(43,139,197,.24)]"
            style={{ color: "var(--sx-badge-icon)" }}
            strokeWidth={1.9}
          />
        </div>
      </div>

      <div className="mt-5">
        <h2
          className="text-[clamp(30px,2.2vw,38px)] font-extrabold leading-tight tracking-[-0.045em]"
          style={{ color: "var(--sx-ink)" }}
        >
          {t.title}
        </h2>
        <p
          className="mt-2 text-[15px] leading-6 sm:text-base"
          style={{ color: "var(--sx-body)" }}
        >
          {t.subtitle}
        </p>
      </div>

      <form className="mt-7" onSubmit={handleSubmit} aria-busy={submitting}>
        <label
          htmlFor="email"
          className="text-sm font-semibold"
          style={{ color: "var(--sx-label)" }}
        >
          {t.email}
        </label>
        <div className="input-shell mt-2 flex h-14 items-center rounded-[14px] border px-4 transition">
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
            placeholder={t.emailPlaceholder}
            className="h-full w-full bg-transparent px-5 text-[15px] outline-none placeholder:text-[var(--sx-placeholder)]"
            style={{ color: "var(--sx-ink)" }}
          />
        </div>

        <div className="mt-5 flex items-center justify-between gap-4">
          <label
            htmlFor="password"
            className="text-sm font-semibold"
            style={{ color: "var(--sx-label)" }}
          >
            {t.password}
          </label>
          <Link
            href="/forgot-password"
            className="text-sm font-semibold underline decoration-transparent underline-offset-4 transition hover:decoration-current hover:text-[var(--sx-accent-hover)]"
            style={{ color: "var(--sx-accent)" }}
          >
            {t.forgot}
          </Link>
        </div>
        <div className="input-shell mt-2 flex h-14 items-center rounded-[14px] border px-4 transition">
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
            placeholder={t.passwordPlaceholder}
            className="h-full min-w-0 flex-1 bg-transparent px-5 text-[15px] outline-none placeholder:text-[var(--sx-placeholder)]"
            style={{ color: "var(--sx-ink)" }}
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            className="grid size-9 place-items-center rounded-lg transition hover:bg-[var(--sx-icon-hover-bg)] hover:text-[var(--sx-icon-hover-fg)]"
            style={{ color: "var(--sx-icon-muted)" }}
            aria-label={showPassword ? t.hidePassword : t.showPassword}
          >
            {showPassword ? (
              <EyeOff className="size-5" />
            ) : (
              <Eye className="size-5" />
            )}
          </button>
        </div>

        <label
          className="mt-4 flex cursor-pointer items-center gap-3 rounded-[14px] border px-3.5 py-3"
          style={{
            borderColor: "var(--sx-divider)",
            background: "var(--sx-input-bg)",
          }}
        >
          <input
            type="checkbox"
            checked={remember}
            onChange={(event) => setRemember(event.target.checked)}
            className="peer sr-only"
          />
          <span
            className="grid size-6 shrink-0 place-items-center rounded-md border transition peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--sx-accent)]"
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
              <Check className="size-4 text-white" strokeWidth={3} />
            )}
          </span>
          <span className="min-w-0">
            <span
              className="block text-sm font-semibold"
              style={{ color: "var(--sx-label)" }}
            >
              {t.remember}
            </span>
            <span
              className="mt-0.5 block truncate text-xs"
              style={{ color: "var(--sx-muted)" }}
            >
              {t.rememberHint}
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
              {status.message}
            </p>
          )}
        </div>

        <motion.button
          whileHover={reduceMotion || submitting ? undefined : { y: -2 }}
          whileTap={reduceMotion || submitting ? undefined : { scale: 0.985 }}
          type="submit"
          disabled={submitting}
          className="primary-button relative mt-5 flex h-14 w-full items-center justify-center rounded-[14px] px-14 text-base font-extrabold text-white transition duration-300 disabled:cursor-wait disabled:opacity-70 sm:text-[17px]"
        >
          {submitting ? (
            <LoaderCircle className="size-5 animate-spin" />
          ) : (
            <ArrowRight className="absolute right-5 size-5" />
          )}
          <span>{submitting ? t.submitting : t.submit}</span>
        </motion.button>
      </form>

      <div className="mt-6" style={{ color: "var(--sx-muted)" }}>
        <div className="flex items-center gap-3">
          <span
            className="h-px flex-1"
            style={{ background: "var(--sx-divider)" }}
            aria-hidden="true"
          />
          <LockKeyhole
            className="size-4 shrink-0"
            style={{ color: "var(--sx-icon-soft)" }}
            strokeWidth={1.8}
          />
          <p className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.1em] sm:text-xs">
            {t.encrypted}
          </p>
          <span
            className="h-px flex-1"
            style={{ background: "var(--sx-divider)" }}
            aria-hidden="true"
          />
        </div>
        <p className="mt-2 text-center text-[11px] leading-5 sm:text-xs">
          {t.protected}
        </p>
      </div>
    </motion.div>
  );
}
