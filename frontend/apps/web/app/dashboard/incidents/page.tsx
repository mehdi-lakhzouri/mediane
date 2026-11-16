import { localizedMetadata } from "../../../lib/i18n/server";
import { IncidentsScreen } from "./incidents-screen";

export const generateMetadata = localizedMetadata({
  en: { title: "Incidents | Mediane" },
  fr: { title: "Incidents | Mediane" },
});

export default function IncidentsPage() {
  return <IncidentsScreen />;
}
