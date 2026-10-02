import type { Metadata } from "next";
import { MfaVerifyScreen } from "./mfa-verify-screen";

export const metadata: Metadata = {
  title: "Verification code | CabinGuard",
  description:
    "Enter the code from your authenticator app to finish signing in.",
  robots: { index: false, follow: false },
};

export default function MfaVerifyPage() {
  return <MfaVerifyScreen />;
}
