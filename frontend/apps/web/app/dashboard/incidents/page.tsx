import { Siren } from "lucide-react";
import { SectionPlaceholder } from "../../components/dashboard/section-placeholder";

export default function IncidentsPage() {
  return (
    <SectionPlaceholder
      icon={Siren}
      title="Incidents"
      description="Emergency events and their response timeline will appear here once the incident module is implemented."
    />
  );
}
