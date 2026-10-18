import { localizedMetadata } from "../../lib/i18n/server";
import { DashboardOverview } from "./dashboard-overview";

export const generateMetadata = localizedMetadata({
  en: { title: "Overview | CabinGuard" },
  fr: { title: "Vue d’ensemble | CabinGuard" },
});

export default function DashboardOverviewPage() {
  return <DashboardOverview />;
}
