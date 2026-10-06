"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Download,
  Info,
  KeyRound,
  LoaderCircle,
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
import { MfaCodeInput } from "./mfa-code-input";
import { MfaSecurityShell } from "./mfa-security-shell";

type SetupStep = "scan" | "verify" | "recovery" | "success";

function splitSecret(secret: string): string {
  return secret.match(/.{1,4}/g)?.join(" ") ?? secret;
}

function StepMotion({
  children,
  step,
}: {
  children: ReactNode;
  step: SetupStep;
}) {
  return (
    <div key={step} className={`mfa-setup-step mfa-setup-step-${step}`}>
      {children}
    </div>
  );
}

function ScanStep({
  qrCode,
  secret,
  copied,
  onCopy,
  onContinue,
}: {
  qrCode: string;
  secret: string;
  copied: boolean;
  onCopy: () => void;
  onContinue: () => void;
}) {
  return (
    <StepMotion step="scan">
      <div className="text-center">
        <h1 className="mfa-screen-title">Connect your authenticator</h1>
        <p className="mfa-screen-copy mx-auto mt-2 max-w-[540px]">
          Open your authenticator app (Google Authenticator, Microsoft
          Authenticator, Authy, etc.) and scan this QR code.
        </p>
      </div>
      <div className="mfa-qr-stage mx-auto mt-5">
        <span className="mfa-qr-corner is-tl" />
        <span className="mfa-qr-corner is-tr" />
        <span className="mfa-qr-corner is-bl" />
        <span className="mfa-qr-corner is-br" />
        <div className="rounded-[9px] bg-white p-2 shadow-[0_0_30px_rgba(32,181,255,.18)]">
          <Image
            src={qrCode}
            alt="QR code for the CabinGuard authenticator setup"
            width={218}
            height={218}
            unoptimized
            priority
            className="size-[184px] sm:size-[208px]"
          />
        </div>
      </div>
      <div className="mfa-divider mt-5">
        <span>or enter manually</span>
      </div>
      <div className="mfa-key-row mt-4">
        <code>{splitSecret(secret)}</code>
        <button
          type="button"
          onClick={onCopy}
          aria-label="Copy setup key"
          title="Copy setup key"
        >
          {copied ? (
            <Check className="size-[18px]" />
          ) : (
            <Copy className="size-[18px]" />
          )}
        </button>
      </div>
      <div className="mfa-security-tip mt-4">
        <Info className="mt-0.5 size-4 shrink-0 text-[#72cfff]" />
        <p>
          This code is unique to your CabinGuard account and works only once.
          Keep it confidential.
        </p>
      </div>
      <button type="button" onClick={onContinue} className="mfa-primary mt-5">
        I&apos;ve scanned the code <ArrowRight className="size-5" />
      </button>
    </StepMotion>
  );
}

function VerifyStep({
  code,
  error,
  remainingSeconds,
  verifying,
  onCodeChange,
  onSubmit,
}: {
  code: string;
  error: string | null;
  remainingSeconds: number;
  verifying: boolean;
  onCodeChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <StepMotion step="verify">
      <div className="text-center">
        <div className="mfa-stage-icon mx-auto">
          <Smartphone className="size-8" strokeWidth={1.6} />
        </div>
        <p className="mfa-screen-eyebrow mt-5">Verify your authenticator</p>
        <h1 className="mfa-screen-title mt-2">Enter the six-digit code</h1>
        <p className="mfa-screen-copy mx-auto mt-2 max-w-[470px]">
          Type the code currently shown for CabinGuard in your authenticator
          app.
        </p>
      </div>
      <form className="mt-8" onSubmit={onSubmit} aria-busy={verifying}>
        <MfaCodeInput
          value={code}
          onChange={onCodeChange}
          disabled={verifying}
          hasError={Boolean(error)}
          autoFocus
        />
        <div
          className="mt-5 flex min-h-6 items-center justify-center"
          aria-live="polite"
        >
          {error ? (
            <p
              role="alert"
              className="flex items-center gap-2 text-sm font-semibold text-[#ff8291]"
            >
              <AlertCircle className="size-4" />
              {error}
            </p>
          ) : (
            <p className="flex items-center gap-2 text-xs text-[#8fa5bc]">
              <TimerReset className="size-4 text-[#45caff]" />
              Code refreshes in {remainingSeconds}s
            </p>
          )}
        </div>
        <button
          type="submit"
          disabled={verifying || code.length !== 6}
          className="mfa-primary mt-5"
        >
          {verifying ? (
            <LoaderCircle className="size-5 animate-spin" />
          ) : (
            <ShieldCheck className="size-5" />
          )}
          {verifying ? "Verifying…" : "Verify securely"}
        </button>
      </form>
      <div className="mfa-security-tip mt-6">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-[#3bd0ff]" />
        <p>
          Your code is checked securely. Your setup key is encrypted and never
          displayed again after setup.
        </p>
      </div>
    </StepMotion>
  );
}

function RecoveryStep({
  codes,
  onContinue,
}: {
  codes: string[];
  onContinue: () => void;
}) {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const text = `CabinGuard recovery codes\nEach code works once. Keep them private.\n\n${codes.join("\n")}\n`;

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Codes remain selectable and downloadable when clipboard access is blocked.
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
    <StepMotion step="recovery">
      <div className="text-center">
        <div className="mfa-stage-icon mx-auto">
          <KeyRound className="size-8" strokeWidth={1.6} />
        </div>
        <p className="mfa-screen-eyebrow mt-4">Save these recovery codes</p>
        <h1 className="mfa-screen-title mt-2">Keep these codes safe</h1>
        <p className="mfa-screen-copy mx-auto mt-2 max-w-[520px]">
          If you lose your phone, these recovery codes let you sign in once.
          Store them in a password manager or print them — we can&apos;t show
          them again.
        </p>
      </div>
      <ol className="mfa-recovery-grid mt-5" aria-label="Recovery codes">
        {codes.map((item, index) => (
          <li key={item}>
            <span>{index + 1}</span>
            <code>{item}</code>
          </li>
        ))}
      </ol>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button type="button" onClick={copyAll} className="mfa-secondary">
          <Copy className="size-4" />
          {copied ? "Copied" : "Copy all"}
        </button>
        <button type="button" onClick={download} className="mfa-secondary">
          <Download className="size-4" />
          Download .txt
        </button>
      </div>
      <label className="mt-5 flex cursor-pointer items-center gap-3 text-[13px] font-semibold text-[#e5edf6]">
        <input
          type="checkbox"
          checked={saved}
          onChange={(event) => setSaved(event.target.checked)}
          className="mfa-checkbox"
        />
        I have stored these codes somewhere safe.
      </label>
      <button
        type="button"
        onClick={onContinue}
        disabled={!saved}
        className="mfa-primary mt-5"
      >
        Continue <ArrowRight className="size-5" />
      </button>
      <div className="mfa-security-tip mt-5">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-[#3bd0ff]" />
        <p>
          <strong className="mb-0.5 block text-[#3bd0ff]">Security tip</strong>
          Store your recovery codes in a password manager or a secure, offline
          location.
        </p>
      </div>
    </StepMotion>
  );
}

function SuccessStep() {
  return (
    <StepMotion step="success">
      <div className="flex min-h-[520px] flex-col items-center justify-center text-center">
        <div className="mfa-success-mark">
          <CheckCircle2 className="size-14" strokeWidth={1.55} />
        </div>
        <p className="mfa-screen-eyebrow mt-8">
          Multi-factor security is active
        </p>
        <h1 className="mfa-screen-title mt-2 text-[36px]!">
          You&apos;re all set
        </h1>
        <p className="mfa-screen-copy mt-3 max-w-[450px]">
          Your authenticator is connected and your recovery codes are saved.
          Every sign-in is now protected by a second secure step.
        </p>
        <Link href="/dashboard" className="mfa-primary mt-8 max-w-[420px]">
          Continue to dashboard <ArrowRight className="size-5" />
        </Link>
      </div>
    </StepMotion>
  );
}

function setupErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "RATE_LIMITED")
      return "Too many attempts. Wait a few minutes, then try again.";
    if (error.code === "NETWORK_ERROR") return error.message;
  }
  return "Two-step verification could not be prepared. Refresh the page to try again.";
}

export function MfaSetupFlow() {
  const router = useRouter();
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
          router.replace("/sign-in");
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

  async function copySecret() {
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
        setStep("scan");
        setSetup(await startTotpSetup().catch(() => null));
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

  const activeStep: 0 | 1 | 2 =
    step === "scan" ? 0 : step === "success" ? 2 : 1;
  const labels =
    step === "recovery" || step === "success"
      ? (["Scan QR Code", "Save Codes", "Complete"] as const)
      : (["Scan QR Code", "Verify", "Complete"] as const);
  const goBack =
    step !== "verify"
      ? undefined
      : () => {
          setError(null);
          setStep("scan");
        };

  return (
    <MfaSecurityShell
      activeStep={activeStep}
      progressLabels={labels}
      onBack={goBack}
      backHref={step === "scan" ? "/" : "/dashboard"}
    >
      {fatal ? (
        <div
          className="flex min-h-[480px] flex-col items-center justify-center text-center"
          role="alert"
        >
          <AlertCircle className="size-10 text-[#ff8291]" />
          <p className="mt-5 max-w-[400px] text-sm font-semibold text-[#c0ccda]">
            {fatal}
          </p>
          <Link href="/sign-in" className="mfa-secondary mt-6 w-full max-w-[320px]">
            <ArrowLeft className="size-4" />
            Back to sign in
          </Link>
        </div>
      ) : step !== "recovery" && step !== "success" && (!setup || !qrCode) ? (
        <div className="grid min-h-[480px] place-items-center text-center">
          <div>
            <LoaderCircle className="mx-auto size-9 animate-spin text-[#32caff]" />
            <p className="mt-5 text-sm font-semibold text-[#aebed0]">
              Preparing your private setup…
            </p>
          </div>
        </div>
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
    </MfaSecurityShell>
  );
}
