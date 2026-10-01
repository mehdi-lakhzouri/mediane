import { UserRound } from "lucide-react";
import { SectionPlaceholder } from "../../components/dashboard/section-placeholder";

export default function ProfilePage() {
  return (
    <SectionPlaceholder
      icon={UserRound}
      title="Your profile"
      description="Your name, contact details and emergency contact will be editable here once the profile API is implemented."
    />
  );
}
