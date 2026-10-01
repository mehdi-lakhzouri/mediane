import { MailPlus } from "lucide-react";
import { SectionPlaceholder } from "../../components/dashboard/section-placeholder";

export default function InvitationsPage() {
  return (
    <SectionPlaceholder
      icon={MailPlus}
      title="Invitations"
      description="Send, resend, revoke and inspect invitation status here. This view activates once the invitation APIs are implemented."
    />
  );
}
