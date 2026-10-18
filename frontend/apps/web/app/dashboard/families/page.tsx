import { localizedMetadata } from "../../../lib/i18n/server";
import { FamiliesScreen } from "./families-screen";

export const generateMetadata = localizedMetadata({
  en: { title: "Families | CabinGuard" },
  fr: { title: "Familles | CabinGuard" },
});

export default function FamiliesPage() {
  return <FamiliesScreen />;
}
