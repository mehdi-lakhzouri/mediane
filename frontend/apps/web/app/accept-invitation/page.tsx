import type { Metadata } from "next";
import { AcceptInvitationScreen } from "./accept-invitation-screen";

export const metadata: Metadata = {
  title: "Accept your invitation | CabinGuard",
  // The page carries a one-time token in its fragment: keep it out of indexes.
  robots: { index: false, follow: false },
};

export default function AcceptInvitationPage() {
  return <AcceptInvitationScreen />;
}
