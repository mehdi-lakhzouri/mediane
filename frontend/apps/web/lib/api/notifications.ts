import { api } from "./client";

export function getUnreadNotificationCount(): Promise<number> {
  return api
    .get<{ unread: number }>("/notifications/unread-count")
    .then(({ unread }) => unread);
}
