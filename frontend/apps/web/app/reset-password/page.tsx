import type { Metadata } from "next";
import { ResetPasswordScreen } from "./reset-password-screen";

export const metadata: Metadata = {
  title: "Choose a new password | CabinGuard",
  description: "Securely reset your CabinGuard password.",
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return <ResetPasswordScreen />;
}
