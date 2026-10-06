import type { ClientContext } from '../../../common/application/client-context';
import type { AuthConfig } from '../../../config';
import type { AuditService } from '../../audit/application/audit.service';
import { SecureTokenService } from '../../security/infrastructure/secure-token.service';
import {
  RefreshSession,
  SessionChannel,
  SessionRevocationReason,
} from '../domain/refresh-session';
import {
  NewRefreshSessionData,
  RefreshSessionRepository,
  RotationData,
} from '../domain/refresh-session.repository';
import {
  CurrentSessionRevocationError,
  InvalidRefreshTokenError,
  SessionNotFoundError,
} from '../domain/session.errors';
import { ROTATION_GRACE_MS, SessionsService } from './sessions.service';

interface Row extends NewRefreshSessionData {
  id: string;
  previousTokenHash: string | null;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  revokedReason: SessionRevocationReason | null;
  createdAt: Date;
}

class InMemorySessions implements RefreshSessionRepository {
  rows: Row[] = [];

  private toDomain(row: Row): RefreshSession {
    return RefreshSession.rehydrate({ ...row });
  }

  private find(
    predicate: (row: Row) => boolean,
  ): Promise<RefreshSession | null> {
    const row = this.rows.find(predicate);
    return Promise.resolve(row ? this.toDomain(row) : null);
  }

  findById(id: string) {
    return this.find((r) => r.id === id);
  }

  findByTokenHash(hash: string) {
    return this.find((r) => r.tokenHash === hash);
  }

  findByPreviousTokenHash(hash: string) {
    return this.find((r) => r.previousTokenHash === hash);
  }

  create(data: NewRefreshSessionData): Promise<RefreshSession> {
    const row: Row = {
      ...data,
      id: `s${this.rows.length + 1}`,
      previousTokenHash: null,
      lastUsedAt: null,
      revokedAt: null,
      revokedReason: null,
      createdAt: new Date(),
    };
    this.rows.push(row);
    return Promise.resolve(this.toDomain(row));
  }

  rotate(data: RotationData): Promise<RefreshSession | null> {
    const row = this.rows.find(
      (r) =>
        r.id === data.sessionId &&
        r.tokenHash === data.currentTokenHash &&
        r.revokedAt === null,
    );
    if (!row) return Promise.resolve(null);
    row.previousTokenHash = row.tokenHash;
    row.tokenHash = data.newTokenHash;
    row.expiresAt = data.expiresAt;
    row.lastUsedAt = data.now;
    return Promise.resolve(this.toDomain(row));
  }

  revoke(id: string, reason: SessionRevocationReason, now: Date) {
    const row = this.rows.find((r) => r.id === id && r.revokedAt === null);
    if (row) Object.assign(row, { revokedAt: now, revokedReason: reason });
    return Promise.resolve(Boolean(row));
  }

  revokeAllForUser(userId: string, reason: SessionRevocationReason, now: Date) {
    const active = this.rows.filter(
      (r) => r.userId === userId && r.revokedAt === null,
    );
    active.forEach((r) =>
      Object.assign(r, { revokedAt: now, revokedReason: reason }),
    );
    return Promise.resolve(active.length);
  }

  listActiveForUser(userId: string, now: Date) {
    return Promise.resolve(
      this.rows
        .filter(
          (r) =>
            r.userId === userId &&
            r.revokedAt === null &&
            r.expiresAt > now &&
            r.absoluteExpiresAt > now,
        )
        .map((r) => ({
          id: r.id,
          channel: r.channel,
          ipAddress: r.ipAddress,
          userAgent: r.userAgent,
          createdAt: r.createdAt,
          lastUsedAt: r.lastUsedAt,
        })),
    );
  }

  revokeAllForUserExcept(
    userId: string,
    keepSessionId: string,
    reason: SessionRevocationReason,
    now: Date,
  ) {
    const others = this.rows.filter(
      (r) =>
        r.userId === userId && r.revokedAt === null && r.id !== keepSessionId,
    );
    others.forEach((r) =>
      Object.assign(r, { revokedAt: now, revokedReason: reason }),
    );
    return Promise.resolve(others.length);
  }
}

const authConfig = {
  tokenHashSecret: 'unit-test-token-hash-secret-32-chars-min',
  refreshSession: { idleTtlSeconds: 3600, absoluteTtlSeconds: 7200 },
} as AuthConfig;

const client: ClientContext = {
  requestId: 'req-1',
  ipAddress: '127.0.0.1',
  userAgent: 'jest',
};

const at = (ms: number) => new Date(Date.UTC(2026, 0, 1) + ms);

describe('SessionsService', () => {
  let repo: InMemorySessions;
  let audit: { record: jest.Mock };
  let service: SessionsService;

  beforeEach(() => {
    repo = new InMemorySessions();
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    service = new SessionsService(
      repo,
      new SecureTokenService(authConfig),
      audit as unknown as AuditService,
      authConfig,
    );
  });

  it('stores only the hash of the refresh token', async () => {
    const opened = await service.open(
      'u1',
      client,
      { persistent: true, channel: 'WEB' },
      at(0),
    );
    expect(repo.rows[0].tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(repo.rows[0].tokenHash).not.toBe(opened.refreshToken);
    expect(opened.refreshTokenExpiresAt).toEqual(at(3600_000));
  });

  it('rotates the token and never extends past the absolute lifetime', async () => {
    const opened = await service.open(
      'u1',
      client,
      { persistent: false, channel: 'WEB' },
      at(0),
    );
    // idle = 1h, absolute = 2h
    const first = await service.rotate(
      opened.refreshToken,
      'WEB',
      client,
      at(3000_000),
    );
    expect(first.refreshToken).not.toBe(opened.refreshToken);
    expect(first.session.id).toBe(opened.session.id);
    expect(first.session.persistent).toBe(false);
    expect(first.refreshTokenExpiresAt).toEqual(at(6600_000));

    const second = await service.rotate(
      first.refreshToken,
      'WEB',
      client,
      at(6000_000),
    );
    expect(second.refreshTokenExpiresAt).toEqual(at(7200_000));
  });

  it('rejects a just-rotated token without revoking (concurrent tabs)', async () => {
    const opened = await service.open(
      'u1',
      client,
      { persistent: true, channel: 'WEB' },
      at(0),
    );
    const rotated = await service.rotate(
      opened.refreshToken,
      'WEB',
      client,
      at(1000),
    );

    await expect(
      service.rotate(
        opened.refreshToken,
        'WEB',
        client,
        at(1000 + ROTATION_GRACE_MS - 1),
      ),
    ).rejects.toBeInstanceOf(InvalidRefreshTokenError);

    expect(repo.rows[0].revokedAt).toBeNull();
    await expect(
      service.rotate(rotated.refreshToken, 'WEB', client, at(2000)),
    ).resolves.toBeDefined();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('revokes the session when a rotated token is replayed after the grace window', async () => {
    const opened = await service.open(
      'u1',
      client,
      { persistent: true, channel: 'WEB' },
      at(0),
    );
    const rotated = await service.rotate(
      opened.refreshToken,
      'WEB',
      client,
      at(1000),
    );

    await expect(
      service.rotate(
        opened.refreshToken,
        'WEB',
        client,
        at(1000 + ROTATION_GRACE_MS),
      ),
    ).rejects.toBeInstanceOf(InvalidRefreshTokenError);

    expect(repo.rows[0].revokedReason).toBe(
      SessionRevocationReason.TOKEN_REUSE_DETECTED,
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'REFRESH_TOKEN_REUSE_DETECTED' }),
    );
    // The legitimate holder of the newest token is logged out too.
    await expect(
      service.rotate(rotated.refreshToken, 'WEB', client, at(20_000)),
    ).rejects.toBeInstanceOf(InvalidRefreshTokenError);
  });

  it('lets only one of two concurrent rotations win', async () => {
    const opened = await service.open(
      'u1',
      client,
      { persistent: true, channel: 'WEB' },
      at(0),
    );
    const results = await Promise.allSettled([
      service.rotate(opened.refreshToken, 'WEB', client, at(1000)),
      service.rotate(opened.refreshToken, 'WEB', client, at(1000)),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });

  it('rejects missing, unknown and expired tokens', async () => {
    const opened = await service.open(
      'u1',
      client,
      { persistent: true, channel: 'WEB' },
      at(0),
    );
    await expect(
      service.rotate(undefined, 'WEB', client),
    ).rejects.toBeInstanceOf(InvalidRefreshTokenError);
    await expect(
      service.rotate('unknown', 'WEB', client),
    ).rejects.toBeInstanceOf(InvalidRefreshTokenError);
    await expect(
      service.rotate(opened.refreshToken, 'WEB', client, at(3600_000)),
    ).rejects.toBeInstanceOf(InvalidRefreshTokenError);
  });

  it('logs out a single device by refresh token', async () => {
    const a = await service.open(
      'u1',
      client,
      { persistent: true, channel: 'WEB' },
      at(0),
    );
    const b = await service.open(
      'u1',
      client,
      { persistent: true, channel: 'WEB' },
      at(0),
    );
    const revoked = await service.revokeByRefreshToken(
      a.refreshToken,
      'WEB',
      SessionRevocationReason.LOGOUT,
      at(10),
    );
    expect(revoked?.id).toBe(a.session.id);
    expect(
      await service.findActiveSession(b.session.id, at(10)),
    ).not.toBeNull();
    expect(
      await service.revokeByRefreshToken(
        a.refreshToken,
        'WEB',
        'LOGOUT',
        at(20),
      ),
    ).toBeNull();
  });

  it('only accepts a refresh token on the channel it was issued for', async () => {
    const mobile = await service.open(
      'u1',
      client,
      { persistent: true, channel: 'MOBILE' },
      at(0),
    );

    await expect(
      service.rotate(mobile.refreshToken, 'WEB', client, at(1000)),
    ).rejects.toBeInstanceOf(InvalidRefreshTokenError);
    expect(
      await service.revokeByRefreshToken(
        mobile.refreshToken,
        'WEB',
        'LOGOUT',
        at(1000),
      ),
    ).toBeNull();

    // The wrong-channel attempts neither consumed nor revoked the session.
    const rotated = await service.rotate(
      mobile.refreshToken,
      'MOBILE',
      client,
      at(2000),
    );
    expect(rotated.session.channel).toBe('MOBILE');
    expect(audit.record).not.toHaveBeenCalled();
  });

  describe('active devices', () => {
    const open = (userAgent: string, now: Date) =>
      service.open(
        'user-1',
        { ...client, userAgent },
        { persistent: true, channel: SessionChannel.MOBILE },
        now,
      );

    it('lists signed-in devices, marks this one, and hides ended sessions', async () => {
      const phone = await open('CabinGuard/1.0.0 (Android 15; Pixel 8)', at(0));
      const laptop = await open(
        'Mozilla/5.0 (Windows NT 10.0) Chrome/140.0 Safari/537.36',
        at(1000),
      );
      const old = await open('Dart/3.13 (dart:io)', at(2000));
      await service.revoke(
        old.session.id,
        SessionRevocationReason.LOGOUT,
        at(3000),
      );

      const list = await service.listActive(
        'user-1',
        phone.session.id,
        at(4000),
      );
      expect(list.map((s) => [s.device.label, s.current])).toEqual(
        expect.arrayContaining([
          ['Pixel 8 · Android 15', true],
          ['Chrome on Windows', false],
        ]),
      );
      expect(list).toHaveLength(2);
      expect(
        await service.countOtherActive('user-1', laptop.session.id, at(4000)),
      ).toBe(1);
    });

    it('signs out another device but never the current one or a stranger', async () => {
      const phone = await open('CabinGuard/1.0.0 (Android 15; Pixel 8)', at(0));
      const tablet = await open('CabinGuard/1.0.0 (Android 14; Tab S9)', at(0));
      const stranger = await service.open(
        'user-2',
        client,
        { persistent: true, channel: SessionChannel.MOBILE },
        at(0),
      );

      await expect(
        service.revokeOwn(
          'user-1',
          phone.session.id,
          phone.session.id,
          client,
          at(10),
        ),
      ).rejects.toThrow(CurrentSessionRevocationError);
      await expect(
        service.revokeOwn(
          'user-1',
          stranger.session.id,
          phone.session.id,
          client,
          at(10),
        ),
      ).rejects.toThrow(SessionNotFoundError);

      await service.revokeOwn(
        'user-1',
        tablet.session.id,
        phone.session.id,
        client,
        at(10),
      );
      expect(
        await service.findActiveSession(tablet.session.id, at(20)),
      ).toBeNull();
      await expect(
        service.revokeOwn(
          'user-1',
          tablet.session.id,
          phone.session.id,
          client,
          at(30),
        ),
      ).rejects.toThrow(SessionNotFoundError);
    });

    it('signs out everywhere else, keeping this device', async () => {
      const phone = await open('CabinGuard/1.0.0 (Android 15; Pixel 8)', at(0));
      await open('a', at(0));
      await open('b', at(0));

      expect(
        await service.revokeOthers('user-1', phone.session.id, client, at(10)),
      ).toBe(2);
      const list = await service.listActive('user-1', phone.session.id, at(20));
      expect(list.map((s) => s.id)).toEqual([phone.session.id]);
    });
  });
});
