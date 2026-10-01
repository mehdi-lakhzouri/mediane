import { ClipboardList } from "lucide-react";
import { SectionPlaceholder } from "../../components/dashboard/section-placeholder";

export default function AuditPage() {
  return (
    <SectionPlaceholder
      icon={ClipboardList}
      title="Audit log"
      description="A searchable, immutable record of administrative actions will be shown here once the audit query API is exposed."
    />
  );
}
