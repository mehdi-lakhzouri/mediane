"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Smartphone } from "lucide-react";
import { useMessages } from "../../../lib/i18n/locale-provider";
import { defineMessages } from "../../../lib/i18n/messages";
import { LanguageSwitch } from "../../components/language-switch";
import type { MobileLinkKind } from "./mobile-link-kinds";

const messages = defineMessages({
  en: {
    title: "Open Mediane on your phone",
    body: {
      "accept-invitation":
        "Your driver account is ready to be activated. Drivers use Mediane through the mobile app: finish there.",
      "join-family":
        "You were invited to join a family on Mediane. The invitation opens in the mobile app.",
      "reset-password":
        "Choose your new password in the Mediane mobile app.",
    } satisfies Record<MobileLinkKind, string>,
    open: "Open in the Mediane app",
    noApp:
      "Nothing happens? Install the Mediane Android app, then open this link again from your phone.",
    computer:
      "On a computer? Open this email on the phone where the app is installed.",
    incomplete:
      "This link is incomplete. Open it again from the email you received.",
  },
  fr: {
    title: "Ouvrez Mediane sur votre téléphone",
    body: {
      "accept-invitation":
        "Votre compte conducteur est prêt à être activé. Les conducteurs utilisent Mediane via l’application mobile : terminez-y l’activation.",
      "join-family":
        "Vous êtes invité à rejoindre une famille sur Mediane. L’invitation s’ouvre dans l’application mobile.",
      "reset-password":
        "Choisissez votre nouveau mot de passe dans l’application mobile Mediane.",
    } satisfies Record<MobileLinkKind, string>,
    open: "Ouvrir dans l’application Mediane",
    noApp:
      "Rien ne se passe ? Installez l’application Android Mediane, puis rouvrez ce lien depuis votre téléphone.",
    computer:
      "Sur un ordinateur ? Ouvrez cet e-mail sur le téléphone où l’application est installée.",
    incomplete:
      "Ce lien est incomplet. Rouvrez-le depuis l’e-mail que vous avez reçu.",
  },
});

/**
 * Hands a link over to the driver app. It never calls the API: a token in the
 * fragment is single-use and belongs to the app, which redeems it.
 */
export function MobileLinkScreen({ kind }: { kind: MobileLinkKind }) {
  const t = useMessages(messages);
  // null while reading the fragment, which only exists in the browser.
  const [appLink, setAppLink] = useState<string | null | false>(null);

  useEffect(() => {
    const fragment = window.location.hash;
    // The custom scheme the app registers for the same paths.
    setAppLink(
      fragment.length > 1 ? `cabinguard://app/${kind}${fragment}` : false,
    );
  }, [kind]);

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
          {appLink === false ? (
            <AlertCircle
              className="size-9"
              style={{ color: "var(--sx-error-text)" }}
              strokeWidth={1.8}
            />
          ) : (
            <Smartphone
              className="size-9"
              style={{ color: "var(--sx-badge-icon)" }}
              strokeWidth={1.8}
            />
          )}
        </div>

        <h1 className="mt-6 text-[26px] font-extrabold tracking-[-0.03em]">
          {t.title}
        </h1>

        {appLink === false ? (
          <p
            role="alert"
            className="mx-auto mt-3 max-w-[400px] text-[15px] leading-7"
            style={{ color: "var(--sx-error-text)" }}
          >
            {t.incomplete}
          </p>
        ) : (
          <>
            <p
              className="mx-auto mt-3 max-w-[400px] text-[15px] leading-7"
              style={{ color: "var(--sx-body)" }}
            >
              {t.body[kind]}
            </p>
            <a
              href={appLink ?? undefined}
              aria-disabled={appLink === null}
              className="primary-button mt-8 inline-flex h-[56px] w-full items-center justify-center gap-4 rounded-2xl text-base font-extrabold text-white transition duration-300"
            >
              <Smartphone className="size-5" />
              {t.open}
            </a>
            <p
              className="mx-auto mt-6 max-w-[400px] text-[13px] leading-6"
              style={{ color: "var(--sx-body)" }}
            >
              {t.noApp}
            </p>
            <p
              className="mx-auto mt-2 max-w-[400px] text-[13px] leading-6"
              style={{ color: "var(--sx-body)" }}
            >
              {t.computer}
            </p>
          </>
        )}
      </section>
    </main>
  );
}
