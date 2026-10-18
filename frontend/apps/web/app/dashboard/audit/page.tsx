import { localizedMetadata } from "../../../lib/i18n/server";
import { AuditScreen } from "./audit-screen";

export const generateMetadata = localizedMetadata({
  en: { title: "Audit log | CabinGuard" },
  fr: { title: "Journal d’audit | CabinGuard" },
});

export default function AuditPage() {
  return <AuditScreen />;
}
