import type { Metadata } from "next";
import { DashboardOverview } from "./dashboard-overview";

export const metadata: Metadata = {
  title: "Overview | CabinGuard",
};

export default function DashboardOverviewPage() {
  return <DashboardOverview />;
}
