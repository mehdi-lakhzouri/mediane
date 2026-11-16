import { lockScreenPreview } from './lock-screen-preview';
import {
  DEFAULT_PREFERENCES,
  NotificationCategory,
  NotificationPolicy,
} from './notification';
import {
  composeNotification,
  type NotificationMessage,
} from './notification-catalog';

const allMuted = {
  ...DEFAULT_PREFERENCES,
  safety: false,
  family: false,
  account: false,
};

describe('NotificationPolicy.shouldDeliver', () => {
  it('delivers everything by default', () => {
    for (const category of Object.values(NotificationCategory)) {
      expect(
        NotificationPolicy.shouldDeliver(
          { category, critical: false },
          DEFAULT_PREFERENCES,
        ),
      ).toBe(true);
    }
  });

  it('respects mutes, except security and family emergencies', () => {
    const shouldDeliver = (message: NotificationMessage) =>
      NotificationPolicy.shouldDeliver(composeNotification(message), allMuted);

    expect(shouldDeliver({ type: 'FAMILY_MEMBER_SAFE', memberName: 'K' })).toBe(
      false,
    );
    expect(
      shouldDeliver({ type: 'FAMILY_JOIN_APPROVED', familyName: 'F' }),
    ).toBe(false);
    expect(shouldDeliver({ type: 'ANNOUNCEMENT', title: 't', body: 'b' })).toBe(
      false,
    );

    expect(
      shouldDeliver({ type: 'FAMILY_MEMBER_NEEDS_HELP', memberName: 'K' }),
    ).toBe(true);
    expect(shouldDeliver({ type: 'PASSWORD_CHANGED' })).toBe(true);
    expect(shouldDeliver({ type: 'NEW_SIGN_IN', deviceLabel: 'Pixel 8' })).toBe(
      true,
    );
  });
});

describe('lockScreenPreview', () => {
  const alert = composeNotification({
    type: 'FAMILY_MEMBER_NEEDS_HELP',
    memberName: 'Karim',
  });

  it('is generic by default: no names, no details', () => {
    const preview = lockScreenPreview(alert, DEFAULT_PREFERENCES);
    expect(preview).toEqual({
      title: 'Mediane',
      body: 'You have a new safety alert.',
    });
    expect(JSON.stringify(preview)).not.toContain('Karim');
  });

  it('names people only with consent, and never shows the body', () => {
    const preview = lockScreenPreview(alert, {
      showNamesOnLockScreen: true,
    });
    expect(preview.title).toBe('Karim may need help');
    expect(preview.body).toBe('Open Mediane for details.');
    expect(preview.body).not.toContain(alert.body);
  });
});

describe('composeNotification', () => {
  it('marks only family emergencies as critical', () => {
    expect(
      composeNotification({
        type: 'FAMILY_MEMBER_NEEDS_HELP',
        memberName: 'K',
      }).critical,
    ).toBe(true);
    expect(
      composeNotification({ type: 'OWN_ALERT_ESCALATED', incidentId: 'i' })
        .critical,
    ).toBe(false);
  });

  it('links safety notifications to in-app routes', () => {
    expect(
      composeNotification({ type: 'OWN_ALERT_ESCALATED', incidentId: 'abc' })
        .link,
    ).toBe('/incidents/abc');
    expect(
      composeNotification({ type: 'FAMILY_JOIN_REQUESTED', requesterName: 'N' })
        .link,
    ).toBe('/family/requests');
  });

  it('pluralizes recovery codes', () => {
    expect(
      composeNotification({ type: 'RECOVERY_CODES_LOW', remaining: 1 }).body,
    ).toContain('1 recovery code is left');
    expect(
      composeNotification({ type: 'RECOVERY_CODES_LOW', remaining: 3 }).body,
    ).toContain('3 recovery codes are left');
  });
});
