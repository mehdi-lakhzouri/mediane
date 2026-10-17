import { localizedMetadata } from "../../../lib/i18n/server";
import { InvitationsScreen } from "./invitations-screen";

export const generateMetadata = localizedMetadata({
  en: { title: "Invitations | CabinGuard" },
  fr: { title: "Invitations | CabinGuard" },
});

export default function InvitationsPage() {
  return <InvitationsScreen />;
}
