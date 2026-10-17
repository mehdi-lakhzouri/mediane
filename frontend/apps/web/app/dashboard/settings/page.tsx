import { localizedMetadata } from "../../../lib/i18n/server";
import { SecuritySettings } from "./security-settings";

export const generateMetadata = localizedMetadata({
  en: { title: "Settings | CabinGuard" },
  fr: { title: "Paramètres | CabinGuard" },
});

export default function SettingsPage() {
  return <SecuritySettings />;
}
