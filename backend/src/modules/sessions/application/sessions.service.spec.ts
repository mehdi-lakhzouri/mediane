import type { ClientContext } from '../../../common/application/client-context';
import type { AuthConfig } from '../../../config';
import type { AuditService } from '../../audit/application/audit.service';
import { SecureTokenService } from '../../security/infrastructure/secure-token.service';
import {
  RefreshSession,
  SessionRevocationReason,
} from '../domain/refresh-session';
import {
  NewRefreshSessionData,
  RefreshSessionRepository,
  RotationData,
} from '../domain/refresh-session.repository';
import { InvalidRefreshTokenError } from '../domain/session.errors';
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
});
