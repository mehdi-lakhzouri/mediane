import { localizedMetadata } from "../../../lib/i18n/server";
import { MfaVerifyScreen } from "./mfa-verify-screen";

export const generateMetadata = localizedMetadata(
  {
    en: {
      title: "Verification code | CabinGuard",
      description:
        "Enter the code from your authenticator app to finish signing in.",
    },
    fr: {
      title: "Code de vérification | CabinGuard",
      description:
        "Saisissez le code de votre application d’authentification pour terminer la connexion.",
    },
  },
  { robots: { index: false, follow: false } },
);

export default function MfaVerifyPage() {
  return <MfaVerifyScreen />;
}
