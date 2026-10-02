import type { Metadata } from "next";
import { SecuritySettings } from "./security-settings";

export const metadata: Metadata = {
  title: "Settings | CabinGuard",
};

export default function SettingsPage() {
  return <SecuritySettings />;
}
