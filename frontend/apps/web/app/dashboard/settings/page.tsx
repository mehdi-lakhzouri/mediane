import { Settings } from "lucide-react";
import { SectionPlaceholder } from "../../components/dashboard/section-placeholder";

export default function SettingsPage() {
  return (
    <SectionPlaceholder
      icon={Settings}
      title="Settings"
      description="Account and workspace preferences will live here. Password and security settings will connect to the existing auth endpoints."
      actionHref="/mfa/setup"
      actionLabel="Preview MFA setup"
    />
  );
}
