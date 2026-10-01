import type { Metadata } from "next";
import { ForgotPasswordScreen } from "./forgot-password-screen";

export const metadata: Metadata = {
  title: "Forgot password | CabinGuard",
  description: "Request a secure CabinGuard password reset link.",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordScreen />;
}
