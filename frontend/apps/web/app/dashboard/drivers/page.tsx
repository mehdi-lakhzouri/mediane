import { localizedMetadata } from "../../../lib/i18n/server";
import { UsersScreen } from "./users-screen";

export const generateMetadata = localizedMetadata({
  en: { title: "Users | Mediane" },
  fr: { title: "Utilisateurs | Mediane" },
});

export default function UsersPage() {
  return <UsersScreen />;
}
