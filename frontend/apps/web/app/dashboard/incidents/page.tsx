import { Siren } from "lucide-react";
import { defineMessages } from "../../../lib/i18n/messages";
import { getMessages, localizedMetadata } from "../../../lib/i18n/server";
import { SectionPlaceholder } from "../../components/dashboard/section-placeholder";

const messages = defineMessages({
  en: {
    title: "Incidents",
    description:
      "Emergency events and their response timeline will appear here once the incident module is implemented.",
  },
  fr: {
    title: "Incidents",
    description:
      "Les urgences et la chronologie de leur prise en charge apparaîtront ici une fois le module d’incidents mis en place.",
  },
});

export const generateMetadata = localizedMetadata({
  en: { title: "Incidents | Mediane" },
  fr: { title: "Incidents | Mediane" },
});

export default async function IncidentsPage() {
  const t = await getMessages(messages);
  return (
    <SectionPlaceholder
      icon={Siren}
      title={t.title}
      description={t.description}
    />
  );
}
