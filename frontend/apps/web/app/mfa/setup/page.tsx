import type { Metadata } from "next";
import { MfaSetupFlow } from "../../components/mfa-setup-flow";

export const metadata: Metadata = {
  title: "Set up multi-factor authentication | CabinGuard",
  description: "Connect and verify an authenticator app for CabinGuard.",
};

export default function MfaSetupPage() {
  return <MfaSetupFlow />;
}
