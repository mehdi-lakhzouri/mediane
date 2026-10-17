"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  LoaderCircle,
  LockKeyhole,
} from "lucide-react";
import { acceptInvitation } from "../../lib/api/invitations";
import { ApiError } from "../../lib/api/client";
import { useErrorText } from "../../lib/i18n/api-errors";
import { useMessages } from "../../lib/i18n/locale-provider";
import { defineMessages } from "../../lib/i18n/messages";
import { LanguageSwitch } from "../components/language-switch";

const messages = defineMessages({
  en: {
    invalidLink:
      "This invitation link is invalid or has expired. Ask an administrator to send you a new one.",
    confirming: "Confirming your invitation",
    oneMoment: "One moment.",
    acceptedTitle: "You're all set",
    acceptedBody:
      "Your email is confirmed. Sign in with the temporary password from your invitation email, then choose a password of your own.",
    failedTitle: "We couldn't confirm this link",
    signIn: "Go to sign in",
  },
  fr: {
    invalidLink:
      "Ce lien d’invitation est invalide ou a expiré. Demandez-en un nouveau à un administrateur.",
    confirming: "Confirmation de votre invitation",
    oneMoment: "Un instant.",
    acceptedTitle: "Tout est prêt",
    acceptedBody:
      "Votre adresse e-mail est confirmée. Connectez-vous avec le mot de passe temporaire reçu dans votre e-mail d’invitation, puis choisissez votre propre mot de passe.",
    failedTitle: "Nous n’avons pas pu confirmer ce lien",
    signIn: "Aller à la connexion",
  },
});

type State =
  | { kind: "reading" }
  | { kind: "accepting" }
  | { kind: "accepted" }
  // The reason, not the text: the message follows a language switch.
  | { kind: "failed"; error: unknown };

export function AcceptInvitationScreen() {
  const t = useMessages(messages);
  const errorText = useErrorText();
  const [state, setState] = useState<State>({ kind: "reading" });

  // Accepting is one-shot and destructive: the token is single-use and the
  // fragment is wiped as soon as it is read. React remounts effects (twice in
  // development), so this guard keeps a remount from replaying the request and
  // reporting a failure for an acceptance that already succeeded.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    // The fragment is only readable here, after the page is in the browser.
    const token = new URLSearchParams(
      window.location.hash.replace(/^#/, ""),
    ).get("token");

    if (!token) {
      setState({ kind: "failed", error: null });
      return;
    }

    // Drop the token from the address bar and from the history entry.
    window.history.replaceState(null, "", window.location.pathname);

    setState({ kind: "accepting" });
    acceptInvitation(token)
      .then(() => setState({ kind: "accepted" }))
      .catch((error: unknown) => {
        setState({ kind: "failed", error });
      });
  }, []);

  return (
    <main
      className="relative grid min-h-svh place-items-center overflow-hidden px-5 py-10"
      style={{ background: "var(--sx-page-bg)", color: "var(--sx-ink)" }}
    >
      <div className="hero-background" aria-hidden="true" />
      <div className="hero-shade" aria-hidden="true" />
      <LanguageSwitch variant="auth" className="right-4 sm:right-6" />

      <section className="glass-panel relative z-10 w-full max-w-[520px] rounded-[26px] px-6 py-10 text-center sm:px-12">
        <div
          className="mx-auto grid size-[84px] place-items-center rounded-full border shadow-[0_0_28px_rgba(0,132,255,.18)]"
          style={{
            borderColor: "var(--sx-badge-border)",
            background: "var(--sx-badge-bg)",
          }}
        >
          {state.kind === "accepted" ? (
            <CheckCircle2
              className="size-9"
              style={{ color: "var(--sx-success-text)" }}
              strokeWidth={1.8}
            />
          ) : state.kind === "failed" ? (
            <AlertCircle
              className="size-9"
              style={{ color: "var(--sx-error-text)" }}
              strokeWidth={1.8}
            />
          ) : (
            <LockKeyhole
              className="size-9"
              style={{ color: "var(--sx-badge-icon)" }}
              strokeWidth={1.8}
            />
          )}
        </div>

        <div aria-live="polite">
          {(state.kind === "reading" || state.kind === "accepting") && (
            <>
              <h1 className="mt-6 text-[26px] font-extrabold tracking-[-0.03em]">
                {t.confirming}
              </h1>
              <p
                className="mx-auto mt-3 flex max-w-[400px] items-center justify-center gap-2 text-[15px]"
                style={{ color: "var(--sx-body)" }}
              >
                <LoaderCircle className="size-4 animate-spin" />
                {t.oneMoment}
              </p>
            </>
          )}

          {state.kind === "accepted" && (
            <>
              <h1 className="mt-6 text-[26px] font-extrabold tracking-[-0.03em]">
                {t.acceptedTitle}
              </h1>
              <p
                className="mx-auto mt-3 max-w-[400px] text-[15px] leading-7"
                style={{ color: "var(--sx-body)" }}
              >
                {t.acceptedBody}
              </p>
            </>
          )}

          {state.kind === "failed" && (
            <>
              <h1 className="mt-6 text-[26px] font-extrabold tracking-[-0.03em]">
                {t.failedTitle}
              </h1>
              <p
                role="alert"
                className="mx-auto mt-3 max-w-[400px] text-[15px] leading-7"
                style={{ color: "var(--sx-error-text)" }}
              >
                {state.error instanceof ApiError &&
                state.error.code === "NETWORK_ERROR"
                  ? errorText.message(state.error)
                  : t.invalidLink}
              </p>
            </>
          )}
        </div>

        <Link
          href="/sign-in"
          className="primary-button mt-8 inline-flex h-[56px] w-full items-center justify-center gap-4 rounded-2xl text-base font-extrabold text-white transition duration-300"
        >
          <ArrowRight className="size-5" />
          {t.signIn}
        </Link>
      </section>
    </main>
  );
}
