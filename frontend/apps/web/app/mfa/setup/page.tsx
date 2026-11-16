import { localizedMetadata } from "../../../lib/i18n/server";
import { MfaSetupFlow } from "../../components/mfa-setup-flow";

export const generateMetadata = localizedMetadata({
  en: {
    title: "Set up multi-factor authentication | Mediane",
    description: "Connect and verify an authenticator app for Mediane.",
  },
  fr: {
    title: "Configurer l’authentification multifacteur | Mediane",
    description:
      "Associez et vérifiez une application d’authentification pour Mediane.",
  },
});

export default function MfaSetupPage() {
  return <MfaSetupFlow />;
}
