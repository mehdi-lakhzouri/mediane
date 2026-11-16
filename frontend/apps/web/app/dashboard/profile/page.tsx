import { localizedMetadata } from "../../../lib/i18n/server";
import { ProfileScreen } from "./profile-screen";

export const generateMetadata = localizedMetadata({
  en: { title: "Your profile | Mediane" },
  fr: { title: "Votre profil | Mediane" },
});

export default function ProfilePage() {
  return <ProfileScreen />;
}
