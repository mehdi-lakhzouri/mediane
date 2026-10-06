import type { Metadata } from "next";
import { InvitationsScreen } from "./invitations-screen";

export const metadata: Metadata = {
  title: "Invitations | CabinGuard",
};

export default function InvitationsPage() {
  return <InvitationsScreen />;
}
