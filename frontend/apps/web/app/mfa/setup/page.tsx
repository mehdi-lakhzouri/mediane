import { localizedMetadata } from "../../../lib/i18n/server";
import { MfaSetupFlow } from "../../components/mfa-setup-flow";

export const generateMetadata = localizedMetadata({
  en: {
    title: "Set up multi-factor authentication | CabinGuard",
    description: "Connect and verify an authenticator app for CabinGuard.",
  },
  fr: {
    title: "Configurer l’authentification multifacteur | CabinGuard",
    description:
      "Associez et vérifiez une application d’authentification pour CabinGuard.",
  },
});

export default function MfaSetupPage() {
  return <MfaSetupFlow />;
}
