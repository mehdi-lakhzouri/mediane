import { HeartPulse } from "lucide-react";
import { SectionPlaceholder } from "../../components/dashboard/section-placeholder";

export default function HealthPage() {
  return (
    <SectionPlaceholder
      icon={HeartPulse}
      title="Health monitoring"
      description="Driver wellbeing signals and alerts will be shown here once the health monitoring module is implemented."
    />
  );
}
