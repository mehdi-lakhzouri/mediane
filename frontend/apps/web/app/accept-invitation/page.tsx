import { localizedMetadata } from "../../lib/i18n/server";
import { AcceptInvitationScreen } from "./accept-invitation-screen";

export const generateMetadata = localizedMetadata(
  {
    en: { title: "Accept your invitation | CabinGuard" },
    fr: { title: "Acceptez votre invitation | CabinGuard" },
  },
  // The page carries a one-time token in its fragment: keep it out of indexes.
  { robots: { index: false, follow: false } },
);

export default function AcceptInvitationPage() {
  return <AcceptInvitationScreen />;
}
