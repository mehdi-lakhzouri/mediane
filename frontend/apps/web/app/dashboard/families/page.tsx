import { localizedMetadata } from "../../../lib/i18n/server";
import { FamiliesScreen } from "./families-screen";

export const generateMetadata = localizedMetadata({
  en: { title: "Families | Mediane" },
  fr: { title: "Familles | Mediane" },
});

export default function FamiliesPage() {
  return <FamiliesScreen />;
}
