import type { LockScreenPreview } from './lock-screen-preview';

/**
 * Port for push delivery to the user's phones. In-app only for now: the
 * default adapter does nothing, and the notification center plus polling
 * carry everything. A provider (FCM/APNs) plugs in here, together with
 * device token registration, without touching the producers.
 */
export abstract class PushGateway {
  abstract send(
    userId: string,
    preview: LockScreenPreview,
    data: { notificationId?: string; link: string | null },
  ): Promise<void>;
}

export class NoopPushGateway extends PushGateway {
  send(): Promise<void> {
    return Promise.resolve();
  }
}
