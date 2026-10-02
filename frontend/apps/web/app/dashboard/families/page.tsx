import type { Metadata } from "next";
import { FamiliesScreen } from "./families-screen";

export const metadata: Metadata = {
  title: "Families | CabinGuard",
};

export default function FamiliesPage() {
  return <FamiliesScreen />;
}
