"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Download,
  KeyRound,
  LifeBuoy,
  LoaderCircle,
  LockKeyhole,
  ScanLine,
  ShieldCheck,
  Smartphone,
  TimerReset,
} from "lucide-react";
import QRCode from "qrcode";
import { ApiError } from "../../lib/api/client";
import { destinationFor, getCurrentUser } from "../../lib/api/auth";
import {
  confirmTotpSetup,
  startTotpSetup,
  type TotpSetup,
} from "../../lib/api/mfa";
import { BrandLogo } from "./brand-logo";
import { MfaCodeInput } from "./mfa-code-input";
import { ThemeToggle } from "./theme-toggle";

type SetupStep = "scan" | "verify" | "recovery" | "success";

const STEP_ORDER: SetupStep[] = ["scan", "verify", "recovery", "success"];
const STEPS = [
  {
    key: "scan" as const,
    label: "Connect an app",
    caption: "Scan your secure QR code",
    icon: ScanLine,
  },
  {
    key: "verify" as const,
    label: "Verify the code",
    caption: "Confirm everything is in sync",
    icon: KeyRound,
  },
  {
    key: "recovery" as const,
    label: "Save recovery codes",
    caption: "Your way back in without the phone",
    icon: LifeBuoy,
  },
  {
    key: "success" as const,
    label: "Ready to protect",
    caption: "Finish the security setup",
    icon: ShieldCheck,
  },
];

function stepIndex(step: SetupStep): number {
  return STEP_ORDER.indexOf(step);
}

function splitSecret(secret: string): string {
  return secret.match(/.{1,4}/g)?.join(" ") ?? secret;
}

function StepRail({ step }: { step: SetupStep }) {
  const activeIndex = stepIndex(step);

  return (
    <ol className="mt-10 space-y-1" aria-label="MFA setup progress">
      {STEPS.map((item, index) => {
        const Icon = item.icon;
        const done = index < activeIndex;
        const active = index === activeIndex;
        return (
          <li key={item.key} className="relative flex gap-4 pb-7 last:pb-0">
            {index < STEPS.length - 1 && (
              <span
                aria-hidden="true"
                className={`mfa-step-line ${done ? "is-complete" : ""}`}
              />
            )}
            <span
              className={`mfa-step-icon ${active ? "is-active" : ""} ${done ? "is-complete" : ""}`}
              aria-current={active ? "step" : undefined}
            >
              {done ? (
                <Check className="size-4" strokeWidth={2.6} />
              ) : (
                <Icon className="size-[18px]" strokeWidth={1.8} />
              )}
            </span>
            <span className="pt-0.5">
              <span className="block text-sm font-bold">{item.label}</span>
              <span className="mt-1 block text-xs leading-5 text-white/55">
                {item.caption}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function CompactProgress({ step }: { step: SetupStep }) {
  const activeIndex = stepIndex(step);
  return (
    <div className="mb-5 flex items-center gap-2 lg:hidden" aria-hidden="true">
      {STEPS.map((item, index) => (
        <span
          key={item.key}
          className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
            index <= activeIndex
              ? "bg-[linear-gradient(90deg,#2ac8ff,#3978ff)] shadow-[0_0_14px_rgba(42,200,255,.36)]"
              : "bg-[var(--mfa-track)]"
          }`}
        />
      ))}
    </div>
  );
}

function LoadingSetup() {
  return (
    <div className="grid min-h-[440px] place-items-center text-center">
      <div>
        <div className="mfa-icon mx-auto grid size-[76px] place-items-center rounded-[24px]">
          <LoaderCircle className="size-8 animate-spin" strokeWidth={1.8} />
        </div>
        <p className="mt-5 text-sm font-semibold text-[var(--sx-body)]">
          Preparing your private setup…
        </p>
      </div>
    </div>
  );
}

interface ScanStepProps {
  qrCode: string;
  secret: string;
  copied: boolean;
  onCopy: () => void;
  onContinue: () => void;
}

function ScanStep(props: ScanStepProps) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      key="scan"
      initial={reduceMotion ? false : { opacity: 0, x: 22 }}
      animate={{ opacity: 1, x: 0 }}
      exit={reduceMotion ? undefined : { opacity: 0, x: -22 }}
      transition={{
        duration: reduceMotion ? 0 : 0.38,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <div className="text-center">
        <p className="mfa-eyebrow">Multi-factor authentication</p>
        <h1 className="mt-2 text-[30px] font-extrabold tracking-[-0.045em] sm:text-[36px]">
          Scan to connect
        </h1>
        <p className="mx-auto mt-3 max-w-[470px] text-sm leading-6 text-[var(--sx-body)] sm:text-[15px]">
          Open your authenticator app, add a new account, then scan this QR
          code.
        </p>
      </div>

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, scale: 0.88, rotate: -2 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={{
          delay: reduceMotion ? 0 : 0.14,
          type: "spring",
          stiffness: 190,
          damping: 20,
        }}
        className="mfa-qr-shell mx-auto mt-7 w-fit rounded-[25px] p-3"
      >
        <div className="relative overflow-hidden rounded-[18px] bg-white p-2.5">
          <Image
            src={props.qrCode}
            alt="QR code for the CabinGuard authenticator setup"
            width={226}
            height={226}
            unoptimized
            priority
            className="size-[202px] sm:size-[226px]"
          />
          <span className="mfa-qr-scan" aria-hidden="true" />
        </div>
      </motion.div>

      <div className="mt-6 text-center">
        <p className="text-xs font-semibold text-[var(--sx-muted)]">
          Can’t scan it? Enter this setup key instead.
        </p>
        <div className="mfa-secret mt-3 flex min-h-12 items-center gap-3 rounded-xl px-4 py-2.5">
          <code className="min-w-0 flex-1 break-all text-left text-[12px] font-bold tracking-[0.13em] text-[var(--sx-label)] sm:text-center sm:text-[13px]">
            {splitSecret(props.secret)}
          </code>
          <motion.button
            whileTap={reduceMotion ? undefined : { scale: 0.9 }}
            type="button"
            onClick={props.onCopy}
            className="grid size-9 shrink-0 place-items-center rounded-lg text-[var(--sx-accent)] transition hover:bg-[var(--sx-icon-hover-bg)]"
            aria-label="Copy setup key"
            title="Copy setup key"
          >
            {props.copied ? (
              <Check className="size-[18px]" strokeWidth={2.5} />
            ) : (
              <Copy className="size-[18px]" strokeWidth={1.8} />
            )}
          </motion.button>
        </div>
      </div>

      <button
        type="button"
        onClick={props.onContinue}
        className="mfa-primary mt-7"
      >
        I’ve scanned the code
        <ArrowRight className="size-5" />
      </button>
    </motion.div>
  );
}

interface VerifyStepProps {
  code: string;
  error: string | null;
  remainingSeconds: number;
  verifying: boolean;
  onCodeChange: (value: string) => void;
  onBack: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

function VerifyStep(props: VerifyStepProps) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      key="verify"
      initial={reduceMotion ? false : { opacity: 0, x: 22 }}
      animate={{ opacity: 1, x: 0 }}
      exit={reduceMotion ? undefined : { opacity: 0, x: -22 }}
      transition={{
        duration: reduceMotion ? 0 : 0.38,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <button
        type="button"
        onClick={props.onBack}
        disabled={props.verifying}
        className="mb-3 inline-flex items-center gap-2 rounded-lg py-1 text-xs font-bold text-[var(--sx-muted)] transition hover:text-[var(--sx-accent)] disabled:opacity-50"
      >
        <ArrowLeft className="size-4" />
        Back to QR code
      </button>

      <div className="text-center">
        <motion.div
          animate={reduceMotion ? undefined : { y: [0, -4, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="mfa-icon mx-auto grid size-[76px] place-items-center rounded-[24px]"
        >
          <Smartphone className="size-8" strokeWidth={1.7} />
        </motion.div>
        <p className="mfa-eyebrow mt-6">One last security check</p>
        <h1 className="mt-2 text-[30px] font-extrabold tracking-[-0.045em] sm:text-[36px]">
          Enter your code
        </h1>
        <p className="mx-auto mt-3 max-w-[430px] text-sm leading-6 text-[var(--sx-body)] sm:text-[15px]">
          Type the six-digit code currently shown in your authenticator app.
        </p>
      </div>

      <form className="mt-8" onSubmit={props.onSubmit}>
        <MfaCodeInput
          value={props.code}
          onChange={props.onCodeChange}
          disabled={props.verifying}
          hasError={Boolean(props.error)}
          autoFocus
        />

        <div
          className="mt-5 flex min-h-6 items-center justify-center"
          aria-live="polite"
        >
          {props.error ? (
            <p
              role="alert"
              className="flex items-center gap-2 text-sm font-semibold text-[var(--sx-error-text)]"
            >
              <AlertCircle className="size-4 shrink-0" />
              {props.error}
            </p>
          ) : (
            <p className="flex items-center gap-2 text-xs text-[var(--sx-muted)]">
              <TimerReset className="size-4 text-[var(--sx-icon-soft)]" />
              Code refreshes in {props.remainingSeconds}s
            </p>
          )}
        </div>

        <motion.button
          whileHover={reduceMotion || props.verifying ? undefined : { y: -2 }}
          whileTap={
            reduceMotion || props.verifying ? undefined : { scale: 0.985 }
          }
          type="submit"
          disabled={props.verifying || props.code.length !== 6}
          className="mfa-primary mt-5"
        >
          {props.verifying ? (
            <LoaderCircle className="size-5 animate-spin" />
          ) : (
            <LockKeyhole className="size-5" />
          )}
          {props.verifying ? "Verifying…" : "Verify securely"}
        </motion.button>
      </form>

      <div className="mfa-tip mt-6 flex items-start gap-3 rounded-xl px-4 py-3.5">
        <ShieldCheck
          className="mt-0.5 size-5 shrink-0 text-[var(--sx-accent)]"
          strokeWidth={1.8}
        />
        <p className="text-xs leading-5 text-[var(--sx-body)]">
          CabinGuard checks the code on its servers. Your setup key is stored
          encrypted and never shown again after this setup.
        </p>
      </div>
    </motion.div>
  );
}

interface RecoveryStepProps {
  codes: string[];
  onContinue: () => void;
}

function RecoveryStep({ codes, onContinue }: RecoveryStepProps) {
  const reduceMotion = useReducedMotion();
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const text = `CabinGuard recovery codes\nEach code works once. Keep them private.\n\n${codes.join("\n")}\n`;

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked: the codes stay selectable, and download still works.
    }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "cabinguard-recovery-codes.txt";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <motion.div
      key="recovery"
      initial={reduceMotion ? false : { opacity: 0, x: 22 }}
      animate={{ opacity: 1, x: 0 }}
      exit={reduceMotion ? undefined : { opacity: 0, x: -22 }}
      transition={{
        duration: reduceMotion ? 0 : 0.38,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <div className="text-center">
        <div className="mfa-icon mx-auto grid size-[76px] place-items-center rounded-[24px]">
          <LifeBuoy className="size-8" strokeWidth={1.7} />
        </div>
        <p className="mfa-eyebrow mt-6">Shown only once</p>
        <h1 className="mt-2 text-[30px] font-extrabold tracking-[-0.045em] sm:text-[36px]">
          Save your recovery codes
        </h1>
        <p className="mx-auto mt-3 max-w-[460px] text-sm leading-6 text-[var(--sx-body)] sm:text-[15px]">
          If you lose your phone, each code lets you sign in once. Store them in
          a password manager or print them — we can&apos;t show them again.
        </p>
      </div>

      <ol
        className="mfa-secret mt-7 grid grid-cols-2 gap-x-6 gap-y-2.5 rounded-2xl px-5 py-5 font-mono text-[14px] font-bold tracking-[0.1em] text-[var(--sx-label)] sm:text-[15px]"
        aria-label="Recovery codes"
      >
        {codes.map((code, index) => (
          <li key={code} className="flex items-center gap-2.5 select-all">
            <span className="w-5 text-right text-[11px] font-semibold text-[var(--sx-muted)]">
              {index + 1}.
            </span>
            {code}
          </li>
        ))}
      </ol>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={copyAll}
          className="flex h-11 items-center justify-center gap-2 rounded-xl border border-[var(--sx-border)] text-sm font-bold text-[var(--sx-accent)] transition hover:bg-[var(--sx-icon-hover-bg)]"
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? "Copied" : "Copy all"}
        </button>
        <button
          type="button"
          onClick={download}
          className="flex h-11 items-center justify-center gap-2 rounded-xl border border-[var(--sx-border)] text-sm font-bold text-[var(--sx-accent)] transition hover:bg-[var(--sx-icon-hover-bg)]"
        >
          <Download className="size-4" />
          Download .txt
        </button>
      </div>

      <label className="mt-6 flex cursor-pointer items-start gap-3 text-sm text-[var(--sx-label)]">
        <input
          type="checkbox"
          checked={saved}
          onChange={(event) => setSaved(event.target.checked)}
          className="mt-0.5 size-5 accent-[var(--sx-accent)]"
        />
        <span>I have stored these codes somewhere safe.</span>
      </label>

      <button
        type="button"
        onClick={onContinue}
        disabled={!saved}
        className="mfa-primary mt-6 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Continue
        <ArrowRight className="size-5" />
      </button>
    </motion.div>
  );
}

function SuccessStep() {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      key="success"
      initial={reduceMotion ? false : { opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        duration: reduceMotion ? 0 : 0.5,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="flex min-h-[480px] flex-col justify-center text-center"
    >
      <div className="relative mx-auto">
        <motion.span
          aria-hidden="true"
          initial={reduceMotion ? false : { scale: 0.65, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{
            delay: reduceMotion ? 0 : 0.08,
            type: "spring",
            stiffness: 190,
            damping: 16,
          }}
          className="mfa-success-ring absolute -inset-4 rounded-full"
        />
        <motion.div
          initial={reduceMotion ? false : { scale: 0.4, rotate: -24 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{
            delay: reduceMotion ? 0 : 0.12,
            type: "spring",
            stiffness: 220,
            damping: 17,
          }}
          className="mfa-success-icon relative grid size-[96px] place-items-center rounded-full"
        >
          <CheckCircle2 className="size-12" strokeWidth={1.7} />
        </motion.div>
      </div>

      <p className="mfa-eyebrow mt-9">Authenticator verified</p>
      <h1 className="mt-2 text-[32px] font-extrabold tracking-[-0.05em] sm:text-[38px]">
        Your codes are in sync
      </h1>
      <p className="mx-auto mt-4 max-w-[440px] text-sm leading-6 text-[var(--sx-body)] sm:text-[15px]">
        From now on, every sign-in to the console asks for a code from this app.
        Keep your recovery codes somewhere safe.
      </p>

      <Link href="/dashboard" className="mfa-primary mt-8">
        Continue to dashboard
        <ArrowRight className="size-5" />
      </Link>
    </motion.div>
  );
}

function setupErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "RATE_LIMITED") {
      return "Too many attempts. Wait a few minutes, then try again.";
    }
    if (error.code === "NETWORK_ERROR") return error.message;
  }
  return "Two-step verification could not be prepared. Refresh the page to try again.";
}

/**
 * Mandatory authenticator setup for administrators (MFA_SETUP_REQUIRED). The
 * secret is generated and checked by the API; this screen only displays it.
 */
export function MfaSetupFlow() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [step, setStep] = useState<SetupStep>("scan");
  const [setup, setSetup] = useState<TotpSetup | null>(null);
  const [qrCode, setQrCode] = useState("");
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(30);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  // Starting a setup creates a new secret server-side: do it once, even when
  // React re-runs effects in development.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    getCurrentUser()
      .then(async (me) => {
        if (me.accountState !== "MFA_SETUP_REQUIRED") {
          router.replace(destinationFor(me.accountState));
          return;
        }
        setSetup(await startTotpSetup());
      })
      .catch((failure: unknown) => {
        if (failure instanceof ApiError && failure.status === 401) {
          router.replace("/");
          return;
        }
        setFatal(setupErrorMessage(failure));
      });
  }, [router]);

  useEffect(() => {
    if (!setup) return;
    let active = true;
    setQrCode("");
    QRCode.toDataURL(setup.otpauthUri, {
      width: 452,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#071a2d", light: "#ffffff" },
    })
      .then((url) => {
        if (active) setQrCode(url);
      })
      .catch(() => {
        if (active) setFatal(setupErrorMessage(null));
      });
    return () => {
      active = false;
    };
  }, [setup]);

  useEffect(() => {
    if (!setup || step !== "verify") return;
    const update = () =>
      setRemainingSeconds(
        Math.max(
          1,
          setup.period - (Math.floor(Date.now() / 1000) % setup.period),
        ),
      );
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [setup, step]);

  async function copySecret(): Promise<void> {
    if (!setup) return;
    try {
      await navigator.clipboard.writeText(setup.secret);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Copying is blocked. Select the setup key manually.");
    }
  }

  async function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (code.length !== 6 || verifying) return;
    setVerifying(true);
    setError(null);
    try {
      const result = await confirmTotpSetup(code);
      setRecoveryCodes(result.recoveryCodes);
      setStep("recovery");
    } catch (failure) {
      setCode("");
      if (
        failure instanceof ApiError &&
        failure.code === "MFA_SETUP_NOT_STARTED"
      ) {
        // The setup expired: show a fresh QR code to scan again.
        setStep("scan");
        setSetup(await startTotpSetup().catch(() => null));
        setError(null);
      } else {
        setError(
          failure instanceof ApiError && failure.code === "MFA_CODE_INVALID"
            ? "That code doesn’t match. Wait for a fresh code and try again."
            : setupErrorMessage(failure),
        );
      }
    } finally {
      setVerifying(false);
    }
  }

  return (
    <main className="mfa-canvas relative min-h-svh overflow-hidden text-[var(--sx-ink)]">
      <div className="mfa-background" aria-hidden="true" />
      <div className="mfa-shade" aria-hidden="true" />
      <div className="mfa-glow mfa-glow-one" aria-hidden="true" />
      <div className="mfa-glow mfa-glow-two" aria-hidden="true" />

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: reduceMotion ? 0 : 0.55,
          ease: [0.22, 1, 0.36, 1],
        }}
        className="absolute top-5 left-5 z-30 sm:top-7 sm:left-8"
      >
        <Link
          href="/"
          aria-label="Back to CabinGuard sign in"
          className="block rounded-2xl focus-visible:ring-2 focus-visible:ring-[#30b5ff] focus-visible:ring-offset-4 focus-visible:outline-none"
        >
          <BrandLogo compact />
        </Link>
      </motion.div>
      <ThemeToggle />

      <div className="relative z-10 mx-auto grid min-h-svh w-full max-w-[1320px] place-items-center px-4 pt-28 pb-10 sm:px-7 sm:pt-32 lg:grid-cols-[350px_minmax(0,640px)] lg:justify-center lg:gap-8 lg:px-10 lg:py-24 xl:gap-12">
        <motion.aside
          initial={reduceMotion ? false : { opacity: 0, x: -28 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{
            delay: reduceMotion ? 0 : 0.1,
            duration: reduceMotion ? 0 : 0.62,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="mfa-side-panel hidden w-full self-stretch rounded-[30px] px-8 py-9 text-white lg:flex lg:max-h-[660px] lg:min-h-[600px] lg:flex-col"
        >
          <div className="grid size-12 place-items-center rounded-2xl border border-white/15 bg-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,.18)] backdrop-blur-xl">
            <ShieldCheck className="size-7 text-[#71d6ff]" strokeWidth={1.7} />
          </div>
          <p className="mt-7 text-[11px] font-bold tracking-[0.22em] text-[#75d6ff] uppercase">
            Account protection
          </p>
          <h2 className="mt-3 text-[30px] font-extrabold leading-[1.08] tracking-[-0.045em]">
            A second lock for every sign-in.
          </h2>
          <p className="mt-4 text-sm leading-6 text-white/65">
            Your password proves what you know. Your authenticator proves what
            you have.
          </p>
          <StepRail step={step} />
          <div className="mt-auto flex items-center gap-3 border-t border-white/10 pt-6 text-xs leading-5 text-white/52">
            <LockKeyhole className="size-4 shrink-0 text-[#71d6ff]" />
            Codes rotate every 30 seconds and work offline.
          </div>
        </motion.aside>

        <motion.section
          initial={reduceMotion ? false : { opacity: 0, y: 26, scale: 0.965 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{
            delay: reduceMotion ? 0 : 0.16,
            duration: reduceMotion ? 0 : 0.65,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="mfa-card w-full max-w-[640px] rounded-[30px] px-5 py-6 sm:px-10 sm:py-9 lg:min-h-[600px]"
        >
          <CompactProgress step={step} />
          {fatal ? (
            <div
              role="alert"
              className="grid min-h-[440px] place-items-center text-center"
            >
              <div>
                <AlertCircle className="mx-auto size-8 text-[var(--sx-error-text)]" />
                <p className="mx-auto mt-4 max-w-[380px] text-sm font-semibold text-[var(--sx-body)]">
                  {fatal}
                </p>
              </div>
            </div>
          ) : step !== "recovery" &&
            step !== "success" &&
            (!setup || !qrCode) ? (
            <LoadingSetup />
          ) : (
            <AnimatePresence mode="wait" initial={false}>
              {step === "scan" && setup && (
                <ScanStep
                  qrCode={qrCode}
                  secret={setup.secret}
                  copied={copied}
                  onCopy={copySecret}
                  onContinue={() => {
                    setError(null);
                    setCode("");
                    setStep("verify");
                  }}
                />
              )}
              {step === "verify" && (
                <VerifyStep
                  code={code}
                  error={error}
                  remainingSeconds={remainingSeconds}
                  verifying={verifying}
                  onCodeChange={(value) => {
                    setCode(value);
                    if (error) setError(null);
                  }}
                  onBack={() => {
                    setError(null);
                    setStep("scan");
                  }}
                  onSubmit={handleVerify}
                />
              )}
              {step === "recovery" && (
                <RecoveryStep
                  codes={recoveryCodes}
                  onContinue={() => {
                    setRecoveryCodes([]);
                    setStep("success");
                  }}
                />
              )}
              {step === "success" && <SuccessStep />}
            </AnimatePresence>
          )}
        </motion.section>
      </div>
    </main>
  );
}
