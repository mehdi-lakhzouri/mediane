import { notFound } from "next/navigation";
import { localizedMetadata } from "../../../lib/i18n/server";
import { MOBILE_LINK_KINDS, type MobileLinkKind } from "./mobile-link-kinds";
import { MobileLinkScreen } from "./mobile-link-screen";

// Links meant for the driver app (Android App Links). A phone with the app
// installed opens them in the app directly; anything else lands here.
export const generateMetadata = localizedMetadata(
  {
    en: { title: "Open in the Mediane app | Mediane" },
    fr: { title: "Ouvrir dans l’application Mediane | Mediane" },
  },
  // The fragment may carry a one-time token: keep these pages out of indexes.
  { robots: { index: false, follow: false } },
);

function isMobileLinkKind(value: string): value is MobileLinkKind {
  return (MOBILE_LINK_KINDS as readonly string[]).includes(value);
}

export default async function MobileLinkPage({
  params,
}: PageProps<"/mobile/[...path]">) {
  const { path } = await params;
  const kind = path.join("/");
  if (!isMobileLinkKind(kind)) notFound();
  return <MobileLinkScreen kind={kind} />;
}
