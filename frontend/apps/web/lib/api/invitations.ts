import { api } from "./client";

/**
 * Accepts an invitation. The token arrives in the URL fragment, which browsers
 * never send to a server, so it stays out of access logs and Referer headers.
 */
export function acceptInvitation(token: string): Promise<null> {
  return api.post<null>("/invitations/accept", { token });
}
