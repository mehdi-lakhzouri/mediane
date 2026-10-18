import { localizedMetadata } from "../../../lib/i18n/server";
import { UsersScreen } from "./users-screen";

export const generateMetadata = localizedMetadata({
  en: { title: "Users | CabinGuard" },
  fr: { title: "Utilisateurs | CabinGuard" },
});

export default function UsersPage() {
  return <UsersScreen />;
}
