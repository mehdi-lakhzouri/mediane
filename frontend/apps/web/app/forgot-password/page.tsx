import { localizedMetadata } from "../../lib/i18n/server";
import { ForgotPasswordScreen } from "./forgot-password-screen";

export const generateMetadata = localizedMetadata(
  {
    en: {
      title: "Forgot password | Mediane",
      description: "Request a secure Mediane password reset link.",
    },
    fr: {
      title: "Mot de passe oublié | Mediane",
      description:
        "Demandez un lien sécurisé de réinitialisation de votre mot de passe Mediane.",
    },
  },
  { robots: { index: false, follow: false } },
);

export default function ForgotPasswordPage() {
  return <ForgotPasswordScreen />;
}
