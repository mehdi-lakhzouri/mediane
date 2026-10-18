import { localizedMetadata } from "../../../lib/i18n/server";
import { ProfileScreen } from "./profile-screen";

export const generateMetadata = localizedMetadata({
  en: { title: "Your profile | CabinGuard" },
  fr: { title: "Votre profil | CabinGuard" },
});

export default function ProfilePage() {
  return <ProfileScreen />;
}
