import { localizedMetadata } from "../../../lib/i18n/server";
import { SecuritySettings } from "./security-settings";

export const generateMetadata = localizedMetadata({
  en: { title: "Settings | Mediane" },
  fr: { title: "Paramètres | Mediane" },
});

export default function SettingsPage() {
  return <SecuritySettings />;
}
