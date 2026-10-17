import { localizedMetadata } from "../../lib/i18n/server";
import { ForgotPasswordScreen } from "./forgot-password-screen";

export const generateMetadata = localizedMetadata(
  {
    en: {
      title: "Forgot password | CabinGuard",
      description: "Request a secure CabinGuard password reset link.",
    },
    fr: {
      title: "Mot de passe oublié | CabinGuard",
      description:
        "Demandez un lien sécurisé de réinitialisation de votre mot de passe CabinGuard.",
    },
  },
  { robots: { index: false, follow: false } },
);

export default function ForgotPasswordPage() {
  return <ForgotPasswordScreen />;
}
