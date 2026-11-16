import { localizedMetadata } from "../../../lib/i18n/server";
import { InvitationsScreen } from "./invitations-screen";

export const generateMetadata = localizedMetadata({
  en: { title: "Invitations | Mediane" },
  fr: { title: "Invitations | Mediane" },
});

export default function InvitationsPage() {
  return <InvitationsScreen />;
}
