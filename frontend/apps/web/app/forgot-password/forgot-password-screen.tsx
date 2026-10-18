"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  LoaderCircle,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { RecoveryShell } from "../components/recovery-shell";
import { ApiError } from "../../lib/api/client";
import { requestPasswordReset } from "../../lib/api/auth";
import { useErrorText, type ErrorText } from "../../lib/i18n/api-errors";
import { useMessages } from "../../lib/i18n/locale-provider";
import { defineMessages } from "../../lib/i18n/messages";

const messages = defineMessages({
  en: {
    errors: {
      invalidEmail: "Enter a valid email address.",
      rateLimited: "Too many requests. Wait a moment, then try again.",
      failed: "We couldn't send the request. Please try again.",
    },
    sent: {
      eyebrow: "Request received",
      title: "Check your inbox",
      description:
        "If an account matches that address, a secure reset link is already on its way.",
      requestedFor: "Email instructions requested for",
      privacy:
        "For your privacy, we show this confirmation whether or not the address exists. Check spam if the email does not arrive within a few minutes.",
      back: "Return to sign in",
    },
    eyebrow: "Account recovery",
    title: "Reset your password",
    description:
      "Enter the email linked to your CabinGuard account. We’ll send a single-use recovery link.",
    email: "Email address",
    emailPlaceholder: "you@company.com",
    submit: "Send recovery link",
    submitting: "Sending secure link…",
    back: "Back to sign in",
    private: "Private by design",
  },
  fr: {
    errors: {
      invalidEmail: "Saisissez une adresse e-mail valide.",
      rateLimited: "Trop de demandes. Patientez un instant puis réessayez.",
      failed: "Nous n’avons pas pu envoyer la demande. Veuillez réessayer.",
    },
    sent: {
      eyebrow: "Demande reçue",
      title: "Consultez votre boîte de réception",
      description:
        "Si un compte correspond à cette adresse, un lien de réinitialisation sécurisé est déjà en route.",
      requestedFor: "Instructions demandées pour",
      privacy:
        "Pour protéger votre vie privée, cette confirmation s’affiche que l’adresse existe ou non. Vérifiez vos spams si l’e-mail n’arrive pas d’ici quelques minutes.",
      back: "Retour à la connexion",
    },
    eyebrow: "Récupération du compte",
    title: "Réinitialisez votre mot de passe",
    description:
      "Saisissez l’adresse e-mail liée à votre compte CabinGuard. Nous vous enverrons un lien de récupération à usage unique.",
    email: "Adresse e-mail",
    emailPlaceholder: "vous@entreprise.com",
    submit: "Envoyer le lien de récupération",
    submitting: "Envoi du lien sécurisé…",
    back: "Retour à la connexion",
    private: "Confidentiel par conception",
  },
});

type ForgotState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "error"; message: string }
  | { kind: "sent"; email: string };

function errorMessage(
  error: unknown,
  t: (typeof messages)["en"]["errors"],
  errorText: ErrorText,
): string {
  if (!(error instanceof ApiError)) return errorText.message(error);
  if (error.code === "VALIDATION_FAILED") return t.invalidEmail;
  if (error.code === "RATE_LIMITED") return t.rateLimited;
  return error.code === "NETWORK_ERROR" ? errorText.message(error) : t.failed;
}

export function ForgotPasswordScreen() {
  const t = useMessages(messages);
  const errorText = useErrorText();
  const [state, setState] = useState<ForgotState>({ kind: "idle" });
  const reduceMotion = useReducedMotion();
  const submitting = state.kind === "submitting";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const form = event.currentTarget;
    const email = String(new FormData(form).get("email") ?? "").trim();
    setState({ kind: "submitting" });
    try {
      await requestPasswordReset(email);
      setState({ kind: "sent", email });
    } catch (error) {
      setState({
        kind: "error",
        message: errorMessage(error, t.errors, errorText),
      });
    }
  }

  if (state.kind === "sent") {
    return (
      <RecoveryShell
        icon={CheckCircle2}
        eyebrow={t.sent.eyebrow}
        title={t.sent.title}
        description={t.sent.description}
        visual="password-reset"
      >
        <div className="rounded-2xl border border-[var(--sx-success-border)] bg-[var(--sx-success-bg)] px-5 py-4 text-center">
          <p className="text-sm font-semibold text-[var(--sx-success-text)]">
            {t.sent.requestedFor}
          </p>
          <p className="mt-1 break-all text-sm font-bold text-[var(--sx-ink)]">
            {state.email}
          </p>
        </div>
        <p className="mt-5 text-center text-[13px] leading-6 text-[var(--sx-muted)]">
          {t.sent.privacy}
        </p>
        <Link href="/sign-in" className="recovery-primary mt-7">
          <ArrowLeft className="size-5" />
          {t.sent.back}
        </Link>
      </RecoveryShell>
    );
  }

  return (
    <RecoveryShell
      icon={Mail}
      eyebrow={t.eyebrow}
      title={t.title}
      description={t.description}
      visual="password-reset"
    >
      <form method="post" onSubmit={handleSubmit} aria-busy={submitting}>
        <label
          htmlFor="recovery-email"
          className="text-sm font-bold text-[var(--sx-label)]"
        >
          {t.email}
        </label>
        <div className="recovery-input-shell mt-2 flex h-14 items-center rounded-xl border px-4">
          <Mail
            className="size-5 shrink-0 text-[var(--sx-icon-muted)]"
            strokeWidth={1.8}
          />
          <input
            id="recovery-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            autoFocus
            disabled={submitting}
            placeholder={t.emailPlaceholder}
            className="h-full min-w-0 flex-1 bg-transparent px-4 text-[15px] text-[var(--sx-ink)] outline-none placeholder:text-[var(--sx-placeholder)]"
          />
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

      <div className="mt-6 flex items-center justify-between gap-4 border-t border-[var(--sx-divider)] pt-5">
        <Link
          href="/sign-in"
          className="inline-flex items-center gap-2 text-sm font-bold text-[var(--sx-accent)] transition hover:text-[var(--sx-accent-hover)]"
        >
          <ArrowLeft className="size-4" />
          {t.back}
        </Link>
        <span className="inline-flex items-center gap-1.5 text-xs text-[var(--sx-muted)]">
          <ShieldCheck className="size-4" />
          {t.private}
        </span>
      </div>
    </RecoveryShell>
  );
}
