import { localizedMetadata } from "../../lib/i18n/server";
import { ResetPasswordScreen } from "./reset-password-screen";

export const generateMetadata = localizedMetadata(
  {
    en: {
      title: "Choose a new password | Mediane",
      description: "Securely reset your Mediane password.",
    },
    fr: {
      title: "Nouveau mot de passe | Mediane",
      description:
        "Réinitialisez votre mot de passe Mediane en toute sécurité.",
    },
  },
  { robots: { index: false, follow: false } },
);

export default function ResetPasswordPage() {
  return <ResetPasswordScreen />;
}
