import { localizedMetadata } from "../../lib/i18n/server";
import { ResetPasswordScreen } from "./reset-password-screen";

export const generateMetadata = localizedMetadata(
  {
    en: {
      title: "Choose a new password | CabinGuard",
      description: "Securely reset your CabinGuard password.",
    },
    fr: {
      title: "Nouveau mot de passe | CabinGuard",
      description:
        "Réinitialisez votre mot de passe CabinGuard en toute sécurité.",
    },
  },
  { robots: { index: false, follow: false } },
);

export default function ResetPasswordPage() {
  return <ResetPasswordScreen />;
}
