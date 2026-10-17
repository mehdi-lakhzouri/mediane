"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  KeyRound,
  LifeBuoy,
  LoaderCircle,
  LockKeyhole,
  Smartphone,
} from "lucide-react";
import { MfaCodeInput } from "../../components/mfa-code-input";
import { MfaSecurityShell } from "../../components/mfa-security-shell";
import { ApiError } from "../../../lib/api/client";
import { completeMfaChallenge, destinationFor } from "../../../lib/api/auth";
import {
  clearMfaChallenge,
  pendingMfaChallenge,
  type PendingMfaChallenge,
} from "../../../lib/mfa-challenge";
import { useErrorText } from "../../../lib/i18n/api-errors";
import { useMessages } from "../../../lib/i18n/locale-provider";
import { defineMessages } from "../../../lib/i18n/messages";

const messages = defineMessages({
  en: {
    steps: ["Verify identity", "Sign in", "Complete"] as [
      string,
      string,
      string,
    ],
    preparing: "Preparing the verification step…",
    eyebrow: "Two-step verification",
    expiredTitle: "Sign in again",
    expiredCopy:
      "This sign-in attempt expired or was stopped after too many wrong codes. Your account is safe.",
    back: "Back to sign in",
    appTitle: "Enter your code",
    recoveryTitle: "Use a recovery code",
    appCopy:
      "Open your authenticator app and type the six-digit code for CabinGuard.",
    recoveryCopy:
      "Type one of the recovery codes you saved during setup. Each code works once.",
    recoveryLabel: "Recovery code",
    errors: {
      appInvalid:
        "That code didn't work. Wait for the next one in your app and try again.",
      recoveryInvalid: "That recovery code is not valid or was already used.",
      rateLimited: "Too many attempts. Wait a few minutes, then sign in again.",
    },
    expiresIn: (clock: string) => `This sign-in attempt expires in ${clock}`,
    submit: "Verify and sign in",
    submitting: "Verifying…",
    useRecovery: "Lost your phone? Use a recovery code",
    useApp: "Use the authenticator app instead",
  },
  fr: {
    steps: ["Vérifier l’identité", "Connexion", "Terminé"],
    preparing: "Préparation de l’étape de vérification…",
    eyebrow: "Vérification en deux étapes",
    expiredTitle: "Reconnectez-vous",
    expiredCopy:
      "Cette tentative de connexion a expiré ou a été bloquée après trop de codes erronés. Votre compte est en sécurité.",
    back: "Retour à la connexion",
    appTitle: "Saisissez votre code",
    recoveryTitle: "Utilisez un code de récupération",
    appCopy:
      "Ouvrez votre application d’authentification et saisissez le code à six chiffres de CabinGuard.",
    recoveryCopy:
      "Saisissez l’un des codes de récupération enregistrés lors de la configuration. Chaque code ne fonctionne qu’une fois.",
    recoveryLabel: "Code de récupération",
    errors: {
      appInvalid:
        "Ce code n’a pas fonctionné. Attendez le suivant dans votre application et réessayez.",
      recoveryInvalid:
        "Ce code de récupération n’est pas valide ou a déjà été utilisé.",
      rateLimited:
        "Trop de tentatives. Patientez quelques minutes puis reconnectez-vous.",
    },
    expiresIn: (clock: string) =>
      `Cette tentative de connexion expire dans ${clock}`,
    submit: "Vérifier et se connecter",
    submitting: "Vérification…",
    useRecovery: "Téléphone perdu ? Utilisez un code de récupération",
    useApp: "Utiliser plutôt l’application d’authentification",
  },
});

type Method = "app" | "recovery";

function remaining(challenge: PendingMfaChallenge): number {
  return Math.max(
    0,
    Math.round((challenge.expiresAt.getTime() - Date.now()) / 1000),
  );
}

function formatClock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * Second sign-in step. The challenge comes from the sign-in form, in memory
 * only: reloading this page, or letting it expire, means signing in again.
 */
export function MfaVerifyScreen() {
  const t = useMessages(messages);
  const errorText = useErrorText();
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [challenge, setChallenge] = useState<PendingMfaChallenge | null>(null);
  const [method, setMethod] = useState<Method>("app");
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    const current = pendingMfaChallenge();
    if (!current) {
      router.replace("/sign-in");
      return;
    }
    setChallenge(current);
    setSecondsLeft(remaining(current));
  }, [router]);

  useEffect(() => {
    if (!challenge) return;
    const timer = window.setInterval(() => {
      const left = remaining(challenge);
      setSecondsLeft(left);
      if (left === 0) {
        window.clearInterval(timer);
        clearMfaChallenge();
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [challenge]);

  async function verify(value: string) {
    if (!challenge || verifying || secondsLeft === 0) return;
    setVerifying(true);
    setError(null);
    try {
      const principal = await completeMfaChallenge(challenge.mfaToken, value);
      clearMfaChallenge();
      router.replace(destinationFor(principal.accountState));
    } catch (failure) {
      setVerifying(false);
      if (!(failure instanceof ApiError)) {
        setError(errorText.message(failure));
        return;
      }
      if (failure.code === "MFA_CHALLENGE_INVALID") {
        clearMfaChallenge();
        setSecondsLeft(0);
        return;
      }
      setCode("");
      setError(
        failure.code === "MFA_CODE_INVALID"
          ? method === "app"
            ? t.errors.appInvalid
            : t.errors.recoveryInvalid
          : failure.code === "RATE_LIMITED"
            ? t.errors.rateLimited
            : errorText.message(failure),
      );
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void verify(method === "app" ? code : recovery.trim());
  }

  function switchMethod(next: Method) {
    setMethod(next);
    setError(null);
    setCode("");
    setRecovery("");
  }

  if (!challenge) {
    return (
      <MfaSecurityShell activeStep={0} progressLabels={t.steps}>
        <div className="grid min-h-[480px] place-items-center text-center">
          <div>
            <LoaderCircle className="mx-auto size-9 animate-spin text-[#32caff]" />
            <p className="mt-5 text-sm font-semibold text-[#aebed0]">
              {t.preparing}
            </p>
          </div>
        </div>
      </MfaSecurityShell>
    );
  }

  if (secondsLeft === 0) {
    return (
      <MfaSecurityShell activeStep={0} progressLabels={t.steps}>
        <div className="flex min-h-[500px] flex-col items-center justify-center text-center">
          <div className="mfa-stage-icon">
            <LockKeyhole className="size-8" strokeWidth={1.6} />
          </div>
          <p className="mfa-screen-eyebrow mt-6">{t.eyebrow}</p>
          <h1 className="mfa-screen-title mt-2">{t.expiredTitle}</h1>
          <p className="mfa-screen-copy mt-3 max-w-[440px]">{t.expiredCopy}</p>
          <Link href="/sign-in" className="mfa-primary mt-7 max-w-[390px]">
            <ArrowLeft className="size-5" />
            {t.back}
          </Link>
        </div>
      </MfaSecurityShell>
    );
  }

  return (
    <MfaSecurityShell activeStep={0} progressLabels={t.steps}>
      <div className="text-center">
        <div className="mfa-stage-icon mx-auto">
          {method === "app" ? (
            <Smartphone className="size-8" strokeWidth={1.6} />
          ) : (
            <LifeBuoy className="size-8" strokeWidth={1.6} />
          )}
        </div>
        <p className="mfa-screen-eyebrow mt-5">{t.eyebrow}</p>
        <h1 className="mfa-screen-title mt-2">
          {method === "app" ? t.appTitle : t.recoveryTitle}
        </h1>
        <p className="mfa-screen-copy mx-auto mt-3 max-w-[470px]">
          {method === "app" ? t.appCopy : t.recoveryCopy}
        </p>
      </div>
      <form className="mt-8" onSubmit={handleSubmit} aria-busy={verifying}>
        <AnimatePresence mode="wait" initial={false}>
          {method === "app" ? (
            <motion.div
              key="app"
              initial={false}
              animate={{ opacity: 1, x: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, x: -16 }}
            >
              <MfaCodeInput
                value={code}
                onChange={(value) => {
                  setCode(value);
                  if (error) setError(null);
                  // Submit as soon as the sixth digit is typed.
                  if (value.length === 6) void verify(value);
                }}
                disabled={verifying}
                hasError={Boolean(error)}
                autoFocus
              />
            </motion.div>
          ) : (
            <motion.div
              key="recovery"
              initial={false}
              animate={{ opacity: 1, x: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, x: -16 }}
            >
              <label
                htmlFor="recovery-code"
                className="text-sm font-bold text-[#eaf4fc]"
              >
                {t.recoveryLabel}
              </label>
              <div className="mfa-key-row mt-2 h-14">
                <KeyRound className="size-5 shrink-0 text-[#5dccf4]" />
                <input
                  id="recovery-code"
                  value={recovery}
                  onChange={(event) => {
                    setRecovery(event.target.value.toUpperCase());
                    if (error) setError(null);
                  }}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  maxLength={12}
                  autoFocus
                  disabled={verifying}
                  placeholder="XXXXX-XXXXX"
                  className="h-full min-w-0 flex-1 bg-transparent px-2 font-mono text-[16px] tracking-[0.12em] text-white outline-none placeholder:text-[#607a90]"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-5 min-h-6 text-center" aria-live="polite">
          {error ? (
            <p
              role="alert"
              className="inline-flex items-start gap-2 text-left text-sm font-semibold text-[#ff8291]"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {error}
            </p>
          ) : (
            <p className="text-xs text-[#8fa5bc]">
              {t.expiresIn(formatClock(secondsLeft))}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={
            verifying ||
            (method === "app" ? code.length !== 6 : recovery.trim().length < 10)
          }
          className="mfa-primary mt-5"
        >
          {verifying ? (
            <LoaderCircle className="size-5 animate-spin" />
          ) : (
            <LockKeyhole className="size-5" />
          )}
          {verifying ? t.submitting : t.submit}
        </button>
      </form>

      <div className="mt-5 flex flex-col items-center gap-3 text-sm font-bold">
        <button
          type="button"
          onClick={() => switchMethod(method === "app" ? "recovery" : "app")}
          className="text-[#35caff] transition hover:text-[#8ae5ff]"
        >
          {method === "app" ? t.useRecovery : t.useApp}
        </button>
        <Link
          href="/sign-in"
          onClick={() => clearMfaChallenge()}
          className="flex items-center gap-2 text-[#8fa5bc] transition hover:text-[#35caff]"
        >
          <ArrowLeft className="size-4" />
          {t.back}
        </Link>
      </div>
    </MfaSecurityShell>
  );
}
