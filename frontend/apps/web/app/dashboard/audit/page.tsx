import type { Metadata } from "next";
import { AuditScreen } from "./audit-screen";

export const metadata: Metadata = {
  title: "Audit log | CabinGuard",
};

export default function AuditPage() {
  return <AuditScreen />;
}
