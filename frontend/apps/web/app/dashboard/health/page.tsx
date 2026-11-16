import { localizedMetadata } from "../../../lib/i18n/server";
import { HealthScreen } from "./health-screen";

export const generateMetadata = localizedMetadata({
  en: { title: "Health monitoring | Mediane" },
  fr: { title: "Suivi de santé | Mediane" },
});

export default function HealthPage() {
  return <HealthScreen />;
}
