import { localizedMetadata } from "../../lib/i18n/server";
import { ChangePasswordScreen } from "./change-password-screen";

export const generateMetadata = localizedMetadata(
  {
    en: {
      title: "Choose your password | CabinGuard",
      description: "Replace your temporary CabinGuard password with your own.",
    },
    fr: {
      title: "Choisissez votre mot de passe | CabinGuard",
      description:
        "Remplacez votre mot de passe temporaire CabinGuard par le vôtre.",
    },
  },
  { robots: { index: false, follow: false } },
);

export default function ChangePasswordPage() {
  return <ChangePasswordScreen />;
}
