import type { Metadata } from "next";
import { ChangePasswordScreen } from "./change-password-screen";

export const metadata: Metadata = {
  title: "Choose your password | CabinGuard",
  description: "Replace your temporary CabinGuard password with your own.",
  robots: { index: false, follow: false },
};

export default function ChangePasswordPage() {
  return <ChangePasswordScreen />;
}
