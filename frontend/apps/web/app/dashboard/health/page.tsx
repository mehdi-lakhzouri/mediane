import { HeartPulse } from "lucide-react";
import { defineMessages } from "../../../lib/i18n/messages";
import { getMessages, localizedMetadata } from "../../../lib/i18n/server";
import { SectionPlaceholder } from "../../components/dashboard/section-placeholder";

const messages = defineMessages({
  en: {
    title: "Health monitoring",
    description:
      "Driver wellbeing signals and alerts will be shown here once the health monitoring module is implemented.",
  },
  fr: {
    title: "Suivi de santé",
    description:
      "Les signaux de bien-être et les alertes des conducteurs s’afficheront ici une fois le module de suivi de santé mis en place.",
  },
});

export const generateMetadata = localizedMetadata({
  en: { title: "Health monitoring | CabinGuard" },
  fr: { title: "Suivi de santé | CabinGuard" },
});

export default async function HealthPage() {
  const t = await getMessages(messages);
  return (
    <SectionPlaceholder
      icon={HeartPulse}
      title={t.title}
      description={t.description}
    />
  );
}
