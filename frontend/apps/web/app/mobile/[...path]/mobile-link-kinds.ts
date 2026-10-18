/** The links the driver app handles; the same paths after /mobile. */
export const MOBILE_LINK_KINDS = [
  "accept-invitation",
  "join-family",
  "reset-password",
] as const;

export type MobileLinkKind = (typeof MOBILE_LINK_KINDS)[number];
