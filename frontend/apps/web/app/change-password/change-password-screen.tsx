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
import { useErrorText, type ErrorText } from "../../lib/i18n/api-errors";
import { useMessages } from "../../lib/i18n/locale-provider";
import { defineMessages } from "../../lib/i18n/messages";

const MIN_LENGTH = 12;

const messages = defineMessages({
  en: {
    errors: {
      wrongTemporary:
        "The temporary password is incorrect. Use the one from your invitation email.",
      weak: "Choose a stronger password.",
      weakDetail: (detail: string) => `Your new password ${detail}.`,
      unchanged: "Your new password must be different from the temporary one.",
      rateLimited: "Too many attempts. Wait a few minutes, then try again.",
      failed: "We couldn't update your password. Please try again.",
      requirements: "Check the requirements below the password fields.",
    },
    loading: {
      eyebrow: "Secure sign-in",
      title: "One moment",
      description: "Checking your session.",
      footnote: "Your temporary password only works once and expires soon.",
    },
    welcome: (name: string) => `Welcome, ${name}`,
    title: "Choose your own password",
    description:
      "Replace the temporary password from your invitation email. You'll set up two-step verification right after.",
    footnote:
      "Your temporary password stops working as soon as you choose your own.",
    temporary: "Temporary password",
    temporaryPlaceholder: "From your invitation email",
    newPassword: "New password",
    newPlaceholder: (min: number) => `At least ${min} characters`,
    confirm: "Confirm new password",
    confirmPlaceholder: "Repeat your new password",
    showPasswords: "Show passwords",
    hidePasswords: "Hide passwords",
    requirements: "Password requirements",
    checks: {
      length: (min: number) => `${min} characters minimum`,
      different: "Different from the temporary one",
      noEmail: "Doesn't contain your email",
      match: "Passwords match",
    },
    submit: "Save and continue",
    submitting: "Saving your password…",
    notYou: (email: string) => `Not ${email}? Sign out`,
  },
  fr: {
    errors: {
      wrongTemporary:
        "Le mot de passe temporaire est incorrect. Utilisez celui de votre e-mail d’invitation.",
      weak: "Choisissez un mot de passe plus robuste.",
      weakDetail: (detail: string) => `Votre nouveau mot de passe ${detail}.`,
      unchanged:
        "Votre nouveau mot de passe doit être différent du mot de passe temporaire.",
      rateLimited:
        "Trop de tentatives. Patientez quelques minutes puis réessayez.",
      failed:
        "Nous n’avons pas pu mettre à jour votre mot de passe. Veuillez réessayer.",
      requirements:
        "Vérifiez les exigences indiquées sous les champs de mot de passe.",
    },
    loading: {
      eyebrow: "Connexion sécurisée",
      title: "Un instant",
      description: "Vérification de votre session.",
      footnote:
        "Votre mot de passe temporaire ne fonctionne qu’une fois et expire bientôt.",
    },
    welcome: (name: string) => `Bienvenue, ${name}`,
    title: "Choisissez votre propre mot de passe",
    description:
      "Remplacez le mot de passe temporaire reçu dans votre e-mail d’invitation. Vous configurerez ensuite la vérification en deux étapes.",
    footnote:
      "Votre mot de passe temporaire cesse de fonctionner dès que vous choisissez le vôtre.",
    temporary: "Mot de passe temporaire",
    temporaryPlaceholder: "Celui de votre e-mail d’invitation",
    newPassword: "Nouveau mot de passe",
    newPlaceholder: (min: number) => `Au moins ${min} caractères`,
    confirm: "Confirmer le nouveau mot de passe",
    confirmPlaceholder: "Répétez votre nouveau mot de passe",
    showPasswords: "Afficher les mots de passe",
    hidePasswords: "Masquer les mots de passe",
    requirements: "Exigences du mot de passe",
    checks: {
      length: (min: number) => `${min} caractères minimum`,
      different: "Différent du mot de passe temporaire",
      noEmail: "Ne contient pas votre adresse e-mail",
      match: "Les mots de passe correspondent",
    },
    submit: "Enregistrer et continuer",
    submitting: "Enregistrement du mot de passe…",
    notYou: (email: string) => `Vous n’êtes pas ${email} ? Se déconnecter`,
  },
});

function changeErrorMessage(
  error: unknown,
  t: (typeof messages)["en"]["errors"],
  errorText: ErrorText,
): string {
  if (!(error instanceof ApiError)) return errorText.message(error);
  switch (error.code) {
    case "INVALID_CURRENT_PASSWORD":
      return t.wrongTemporary;
    case "WEAK_PASSWORD": {
      const detail = errorText.detail(error);
      return detail ? t.weakDetail(detail) : t.weak;
    }
    case "PASSWORD_UNCHANGED":
      return t.unchanged;
    case "RATE_LIMITED":
      return t.rateLimited;
    case "NETWORK_ERROR":
      return errorText.message(error);
    default:
      return t.failed;
  }
}

/**
 * First sign-in of an invited administrator: the temporary password from the
 * invitation email must be replaced before anything else. The API enforces
 * it (PASSWORD_CHANGE_REQUIRED); this screen is the way through.
 */
export function ChangePasswordScreen() {
  const t = useMessages(messages);
  const errorText = useErrorText();
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
        if (active) router.replace("/sign-in");
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
      setError(t.errors.requirements);
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
      setError(changeErrorMessage(failure, t.errors, errorText));
      setSubmitting(false);
    }
  }

  async function signOut() {
    try {
      await logout();
    } finally {
      router.replace("/sign-in");
    }
  }

  if (!user) {
    return (
      <RecoveryShell
        icon={LoaderCircle}
        eyebrow={t.loading.eyebrow}
        title={t.loading.title}
        description={t.loading.description}
        visual="password-reset"
        footnote={t.loading.footnote}
      >
        <LoaderCircle className="mx-auto size-6 animate-spin text-[var(--sx-accent)]" />
      </RecoveryShell>
    );
  }

  return (
    <RecoveryShell
      icon={KeyRound}
      eyebrow={t.welcome(user.firstName)}
      title={t.title}
      description={t.description}
      visual="password-reset"
      footnote={t.footnote}
    >
      <form onSubmit={handleSubmit} aria-busy={submitting} noValidate>
        <PasswordField
          id="current-password"
          label={t.temporary}
          autoComplete="current-password"
          value={current}
          onChange={setCurrent}
          show={show}
          disabled={submitting}
          placeholder={t.temporaryPlaceholder}
          autoFocus
        />
        <PasswordField
          id="new-password"
          label={t.newPassword}
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
          show={show}
          disabled={submitting}
          placeholder={t.newPlaceholder(MIN_LENGTH)}
          onToggleShow={() => setShow((value) => !value)}
          toggleLabel={show ? t.hidePasswords : t.showPasswords}
          className="mt-5"
        />
        <PasswordField
          id="confirm-password"
          label={t.confirm}
          autoComplete="new-password"
          value={confirmation}
          onChange={setConfirmation}
          show={show}
          disabled={submitting}
          placeholder={t.confirmPlaceholder}
          className="mt-5"
        />

        <ul
          className="mt-4 grid gap-2 text-xs sm:grid-cols-2"
          aria-label={t.requirements}
        >
          <Requirement
            valid={checks.length}
            label={t.checks.length(MIN_LENGTH)}
          />
          <Requirement valid={checks.different} label={t.checks.different} />
          <Requirement valid={checks.noEmail} label={t.checks.noEmail} />
          <Requirement valid={checks.match} label={t.checks.match} />
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
          {submitting ? t.submitting : t.submit}
        </motion.button>
      </form>

      <button
        type="button"
        onClick={signOut}
        className="mx-auto mt-5 flex items-center gap-2 text-sm font-bold text-[var(--sx-muted)] transition hover:text-[var(--sx-accent)]"
      >
        <LogOut className="size-4" />
        {t.notYou(user.email)}
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
  toggleLabel?: string;
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
            aria-label={props.toggleLabel}
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
