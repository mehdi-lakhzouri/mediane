import { localizedMetadata } from "../../lib/i18n/server";
import { DashboardOverview } from "./dashboard-overview";

export const generateMetadata = localizedMetadata({
  en: { title: "Overview | Mediane" },
  fr: { title: "Vue d’ensemble | Mediane" },
});

export default function DashboardOverviewPage() {
  return <DashboardOverview />;
}
