import { localizedMetadata } from "../../lib/i18n/server";
import { ChangePasswordScreen } from "./change-password-screen";

export const generateMetadata = localizedMetadata(
  {
    en: {
      title: "Choose your password | Mediane",
      description: "Replace your temporary Mediane password with your own.",
    },
    fr: {
      title: "Choisissez votre mot de passe | Mediane",
      description:
        "Remplacez votre mot de passe temporaire Mediane par le vôtre.",
    },
  },
  { robots: { index: false, follow: false } },
);

export default function ChangePasswordPage() {
  return <ChangePasswordScreen />;
}
