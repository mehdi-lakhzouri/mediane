import type { AuditService } from '../../audit/application/audit.service';
import {
  type ComposedNotification,
  DEFAULT_PREFERENCES,
  type NotificationPreferences,
} from '../domain/notification';
import type { NotificationRepository } from '../domain/notification.repository';
import { NotificationsService } from './notifications.service';

describe('NotificationsService.notify', () => {
  let stored: (ComposedNotification & { userId: string })[];
  let preferences: Map<string, NotificationPreferences>;
  let push: { send: jest.Mock };
  let service: NotificationsService;

  beforeEach(() => {
    stored = [];
    preferences = new Map();
    push = { send: jest.fn().mockResolvedValue(undefined) };
    const repository = {
      preferencesOf: (ids: string[]) =>
        Promise.resolve(
          new Map(
            ids.map((id) => [
              id,
              preferences.get(id) ?? { ...DEFAULT_PREFERENCES },
            ]),
          ),
        ),
      createMany: (entries: (ComposedNotification & { userId: string })[]) => {
        stored.push(...entries);
        return Promise.resolve(entries.length);
      },
    } as unknown as NotificationRepository;
    service = new NotificationsService(repository, push, {} as AuditService);
  });

  it('skips muted recipients and de-duplicates the list', async () => {
    preferences.set('muted', { ...DEFAULT_PREFERENCES, family: false });

    const delivered = await service.notify(['a', 'muted', 'a', 'b'], {
      type: 'FAMILY_MEMBER_JOINED',
      memberName: 'Nour',
      familyName: 'Ben Salah',
    });

    expect(delivered).toBe(2);
    expect(stored.map((n) => n.userId)).toEqual(['a', 'b']);
    expect(stored[0]).toMatchObject({
      category: 'FAMILY',
      type: 'FAMILY_MEMBER_JOINED',
      body: 'Nour joined Ben Salah.',
      critical: false,
    });
  });

  it('hands push a lock-screen safe preview per recipient', async () => {
    preferences.set('named', {
      ...DEFAULT_PREFERENCES,
      showNamesOnLockScreen: true,
    });

    await service.notify(['plain', 'named'], {
      type: 'FAMILY_MEMBER_NEEDS_HELP',
      memberName: 'Karim',
    });

    expect(push.send).toHaveBeenCalledWith(
      'plain',
      { title: 'Mediane', body: 'You have a new safety alert.' },
      { link: '/family' },
    );
    expect(push.send).toHaveBeenCalledWith(
      'named',
      { title: 'Karim may need help', body: 'Open Mediane for details.' },
      { link: '/family' },
    );
  });

  it('does nothing for nobody', async () => {
    expect(await service.notify([], { type: 'PASSWORD_CHANGED' })).toBe(0);
    expect(stored).toEqual([]);
    expect(push.send).not.toHaveBeenCalled();
  });
});
