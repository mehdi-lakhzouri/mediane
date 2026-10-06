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

type State =
  | { kind: "reading" }
  | { kind: "accepting" }
  | { kind: "accepted" }
  | { kind: "failed"; message: string };

const INVALID_LINK =
  "This invitation link is invalid or has expired. Ask an administrator to send you a new one.";

export function AcceptInvitationScreen() {
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
      setState({ kind: "failed", message: INVALID_LINK });
      return;
    }

    // Drop the token from the address bar and from the history entry.
    window.history.replaceState(null, "", window.location.pathname);

    setState({ kind: "accepting" });
    acceptInvitation(token)
      .then(() => setState({ kind: "accepted" }))
      .catch((error: unknown) => {
        setState({
          kind: "failed",
          message:
            error instanceof ApiError && error.code === "NETWORK_ERROR"
              ? error.message
              : INVALID_LINK,
        });
      });
  }, []);

  return (
    <main
      className="relative grid min-h-svh place-items-center overflow-hidden px-5 py-10"
      style={{ background: "var(--sx-page-bg)", color: "var(--sx-ink)" }}
    >
      <div className="hero-background" aria-hidden="true" />
      <div className="hero-shade" aria-hidden="true" />

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
                Confirming your invitation
              </h1>
              <p
                className="mx-auto mt-3 flex max-w-[400px] items-center justify-center gap-2 text-[15px]"
                style={{ color: "var(--sx-body)" }}
              >
                <LoaderCircle className="size-4 animate-spin" />
                One moment.
              </p>
            </>
          )}

          {state.kind === "accepted" && (
            <>
              <h1 className="mt-6 text-[26px] font-extrabold tracking-[-0.03em]">
                You&apos;re all set
              </h1>
              <p
                className="mx-auto mt-3 max-w-[400px] text-[15px] leading-7"
                style={{ color: "var(--sx-body)" }}
              >
                Your email is confirmed. Sign in with the temporary password
                from your invitation email, then choose a password of your own.
              </p>
            </>
          )}

          {state.kind === "failed" && (
            <>
              <h1 className="mt-6 text-[26px] font-extrabold tracking-[-0.03em]">
                We couldn&apos;t confirm this link
              </h1>
              <p
                role="alert"
                className="mx-auto mt-3 max-w-[400px] text-[15px] leading-7"
                style={{ color: "var(--sx-error-text)" }}
              >
                {state.message}
              </p>
            </>
          )}
        </div>

        <Link
          href="/sign-in"
          className="primary-button mt-8 inline-flex h-[56px] w-full items-center justify-center gap-4 rounded-2xl text-base font-extrabold text-white transition duration-300"
        >
          <ArrowRight className="size-5" />
          Go to sign in
        </Link>
      </section>
    </main>
  );
}
