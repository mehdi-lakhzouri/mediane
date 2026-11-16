import { localizedMetadata } from "../../../lib/i18n/server";
import { AuditScreen } from "./audit-screen";

export const generateMetadata = localizedMetadata({
  en: { title: "Audit log | Mediane" },
  fr: { title: "Journal d’audit | Mediane" },
});

export default function AuditPage() {
  return <AuditScreen />;
}
