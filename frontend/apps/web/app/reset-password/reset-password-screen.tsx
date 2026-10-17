"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
} from "lucide-react";
import { RecoveryShell } from "../components/recovery-shell";
import { ApiError } from "../../lib/api/client";
import { resetPassword } from "../../lib/api/auth";
import { useErrorText, type ErrorText } from "../../lib/i18n/api-errors";
import { useMessages } from "../../lib/i18n/locale-provider";
import { defineMessages } from "../../lib/i18n/messages";

const messages = defineMessages({
  en: {
    errors: {
      weak: "Choose a stronger password.",
      weakDetail: (detail: string) => `Password ${detail}.`,
      rateLimited: "Too many attempts. Wait a moment, then try again.",
      failed: "We couldn't update your password. Please try again.",
      tooShort: "Password must be at least 12 characters.",
      mismatch: "The passwords do not match.",
    },
    reading: {
      eyebrow: "Secure verification",
      title: "Checking your link",
      description: "One moment while we verify your single-use recovery link.",
    },
    invalid: {
      eyebrow: "Link unavailable",
      title: "Request a fresh link",
      description:
        "This reset link is invalid, expired, or has already been used. Your current password has not changed.",
      resend: "Send a new recovery link",
      back: "Back to sign in",
    },
    success: {
      eyebrow: "Password updated",
      title: "You’re ready to sign in",
      description:
        "Your new password is active and previous sessions have been securely signed out.",
      body: "Your account is protected with the new password. Use it the next time you sign in.",
      next: "Continue to sign in",
    },
    eyebrow: "Secure recovery",
    title: "Choose a new password",
    description:
      "Use a memorable passphrase with at least 12 characters. All existing sessions will be signed out.",
    newPassword: "New password",
    newPlaceholder: "At least 12 characters",
    confirm: "Confirm password",
    confirmPlaceholder: "Repeat your new password",
    showPassword: "Show password",
    hidePassword: "Hide password",
    checkLength: "12 characters minimum",
    checkMatch: "Passwords match",
    submit: "Set new password",
    submitting: "Updating password…",
  },
  fr: {
    errors: {
      weak: "Choisissez un mot de passe plus robuste.",
      weakDetail: (detail: string) => `Le mot de passe ${detail}.`,
      rateLimited: "Trop de tentatives. Patientez un instant puis réessayez.",
      failed:
        "Nous n’avons pas pu mettre à jour votre mot de passe. Veuillez réessayer.",
      tooShort: "Le mot de passe doit contenir au moins 12 caractères.",
      mismatch: "Les mots de passe ne correspondent pas.",
    },
    reading: {
      eyebrow: "Vérification sécurisée",
      title: "Vérification de votre lien",
      description:
        "Un instant, nous vérifions votre lien de récupération à usage unique.",
    },
    invalid: {
      eyebrow: "Lien indisponible",
      title: "Demandez un nouveau lien",
      description:
        "Ce lien de réinitialisation est invalide, a expiré ou a déjà été utilisé. Votre mot de passe actuel n’a pas changé.",
      resend: "Envoyer un nouveau lien de récupération",
      back: "Retour à la connexion",
    },
    success: {
      eyebrow: "Mot de passe mis à jour",
      title: "Vous pouvez vous connecter",
      description:
        "Votre nouveau mot de passe est actif et les sessions précédentes ont été fermées en toute sécurité.",
      body: "Votre compte est protégé par le nouveau mot de passe. Utilisez-le lors de votre prochaine connexion.",
      next: "Continuer vers la connexion",
    },
    eyebrow: "Récupération sécurisée",
    title: "Choisissez un nouveau mot de passe",
    description:
      "Utilisez une phrase de passe facile à retenir d’au moins 12 caractères. Toutes les sessions ouvertes seront fermées.",
    newPassword: "Nouveau mot de passe",
    newPlaceholder: "Au moins 12 caractères",
    confirm: "Confirmer le mot de passe",
    confirmPlaceholder: "Répétez votre nouveau mot de passe",
    showPassword: "Afficher le mot de passe",
    hidePassword: "Masquer le mot de passe",
    checkLength: "12 caractères minimum",
    checkMatch: "Les mots de passe correspondent",
    submit: "Définir le nouveau mot de passe",
    submitting: "Mise à jour du mot de passe…",
  },
});

type ResetState =
  | { kind: "reading" }
  | { kind: "ready"; token: string }
  | { kind: "submitting"; token: string }
  | { kind: "error"; token: string; message: string }
  | { kind: "invalid" }
  | { kind: "success" };

function resetErrorMessage(
  error: unknown,
  t: (typeof messages)["en"]["errors"],
  errorText: ErrorText,
): string {
  if (!(error instanceof ApiError)) return errorText.message(error);
  if (error.code === "WEAK_PASSWORD") {
    const detail = errorText.detail(error);
    return detail ? t.weakDetail(detail) : t.weak;
  }
  if (error.code === "RATE_LIMITED") return t.rateLimited;
  return error.code === "NETWORK_ERROR" ? errorText.message(error) : t.failed;
}

export function ResetPasswordScreen() {
  const t = useMessages(messages);
  const errorText = useErrorText();
  const [state, setState] = useState<ResetState>({ kind: "reading" });
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const reduceMotion = useReducedMotion();
  const tokenRead = useRef(false);

  useEffect(() => {
    if (tokenRead.current) return;
    tokenRead.current = true;
    const token = new URLSearchParams(
      window.location.hash.replace(/^#/, ""),
    ).get("token");
    window.history.replaceState(null, "", window.location.pathname);
    setState(token ? { kind: "ready", token } : { kind: "invalid" });
  }, []);

  const submitting = state.kind === "submitting";
  const longEnough = password.length >= 12;
  const passwordsMatch = password.length > 0 && password === confirmation;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || (state.kind !== "ready" && state.kind !== "error")) {
      return;
    }
    if (!longEnough) {
      setState({
        kind: "error",
        token: state.token,
        message: t.errors.tooShort,
      });
      return;
    }
    if (!passwordsMatch) {
      setState({
        kind: "error",
        token: state.token,
        message: t.errors.mismatch,
      });
      return;
    }

    const token = state.token;
    setState({ kind: "submitting", token });
    try {
      await resetPassword(token, password);
      setPassword("");
      setConfirmation("");
      setState({ kind: "success" });
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.code === "PASSWORD_RESET_TOKEN_INVALID"
      ) {
        setState({ kind: "invalid" });
      } else {
        setState({
          kind: "error",
          token,
          message: resetErrorMessage(error, t.errors, errorText),
        });
      }
    }
  }

  if (state.kind === "reading") {
    return (
      <RecoveryShell
        icon={LoaderCircle}
        eyebrow={t.reading.eyebrow}
        title={t.reading.title}
        description={t.reading.description}
        visual="password-reset"
      >
        <LoaderCircle className="mx-auto size-6 animate-spin text-[var(--sx-accent)]" />
      </RecoveryShell>
    );
  }

  if (state.kind === "invalid") {
    return (
      <RecoveryShell
        icon={RefreshCw}
        eyebrow={t.invalid.eyebrow}
        title={t.invalid.title}
        description={t.invalid.description}
        visual="password-reset"
      >
        <Link href="/forgot-password" className="recovery-primary">
          <RefreshCw className="size-5" />
          {t.invalid.resend}
        </Link>
        <Link
          href="/sign-in"
          className="mt-5 flex items-center justify-center gap-2 text-sm font-bold text-[var(--sx-accent)]"
        >
          <ArrowLeft className="size-4" />
          {t.invalid.back}
        </Link>
      </RecoveryShell>
    );
  }

  if (state.kind === "success") {
    return (
      <RecoveryShell
        icon={CheckCircle2}
        eyebrow={t.success.eyebrow}
        title={t.success.title}
        description={t.success.description}
        visual="password-reset"
      >
        <div className="rounded-2xl border border-[var(--sx-success-border)] bg-[var(--sx-success-bg)] px-5 py-4 text-center text-sm leading-6 text-[var(--sx-success-text)]">
          {t.success.body}
        </div>
        <Link href="/sign-in" className="recovery-primary mt-7">
          <ArrowRight className="size-5" />
          {t.success.next}
        </Link>
      </RecoveryShell>
    );
  }

  return (
    <RecoveryShell
      icon={LockKeyhole}
      eyebrow={t.eyebrow}
      title={t.title}
      description={t.description}
      visual="password-reset"
    >
      <form onSubmit={handleSubmit} aria-busy={submitting}>
        <label
          htmlFor="new-password"
          className="text-sm font-bold text-[var(--sx-label)]"
        >
          {t.newPassword}
        </label>
        <div className="recovery-input-shell mt-2 flex h-14 items-center rounded-xl border px-4">
          <LockKeyhole className="size-5 shrink-0 text-[var(--sx-icon-muted)]" />
          <input
            id="new-password"
            name="newPassword"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={128}
            autoFocus
            disabled={submitting}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={t.newPlaceholder}
            className="h-full min-w-0 flex-1 bg-transparent px-4 text-[15px] text-[var(--sx-ink)] outline-none placeholder:text-[var(--sx-placeholder)]"
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            className="grid size-9 place-items-center rounded-lg text-[var(--sx-icon-muted)] transition hover:bg-[var(--sx-icon-hover-bg)]"
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
          htmlFor="confirm-password"
          className="mt-5 block text-sm font-bold text-[var(--sx-label)]"
        >
          {t.confirm}
        </label>
        <div className="recovery-input-shell mt-2 flex h-14 items-center rounded-xl border px-4">
          <Check className="size-5 shrink-0 text-[var(--sx-icon-muted)]" />
          <input
            id="confirm-password"
            name="confirmPassword"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={128}
            disabled={submitting}
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            placeholder={t.confirmPlaceholder}
            className="h-full min-w-0 flex-1 bg-transparent px-4 text-[15px] text-[var(--sx-ink)] outline-none placeholder:text-[var(--sx-placeholder)]"
          />
        </div>

        <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
          <PasswordCheck valid={longEnough} label={t.checkLength} />
          <PasswordCheck valid={passwordsMatch} label={t.checkMatch} />
        </div>

        <AnimatePresence initial={false}>
          {state.kind === "error" && (
            <motion.p
              initial={reduceMotion ? false : { opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              role="alert"
              className="mt-4 flex items-start gap-2.5 rounded-xl border border-[var(--sx-error-border)] bg-[var(--sx-error-bg)] px-4 py-3 text-sm text-[var(--sx-error-text)]"
            >
              <AlertCircle className="mt-0.5 size-[18px] shrink-0" />
              {state.message}
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
          {submitting ? t.submitting : t.submit}
        </motion.button>
      </form>
    </RecoveryShell>
  );
}

function PasswordCheck({ valid, label }: { valid: boolean; label: string }) {
  return (
    <span
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
    </span>
  );
}
