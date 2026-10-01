export const InvitationStatus = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  REVOKED: 'REVOKED',
  SUPERSEDED: 'SUPERSEDED',
} as const;
export type InvitationStatus =
  (typeof InvitationStatus)[keyof typeof InvitationStatus];

/** Stored statuses + EXPIRED, which is derived from expiresAt and never stored. */
export type EffectiveInvitationStatus = InvitationStatus | 'EXPIRED';

export interface InvitationProps {
  id: string;
  userId: string;
  invitedById: string | null;
  status: InvitationStatus;
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  revokedById: string | null;
  createdAt: Date;
}

/**
 * Invitation aggregate. Single-use and replay-safe by construction:
 * only a PENDING, non-expired invitation can be accepted; accepting, revoking or
 * superseding (resend) moves it to a terminal status. Transition methods are
 * added with the invitation use cases.
 */
export class Invitation {
  private constructor(private readonly props: InvitationProps) {}

  static rehydrate(props: InvitationProps): Invitation {
    return new Invitation(props);
  }

  get id(): string {
    return this.props.id;
  }

  get userId(): string {
    return this.props.userId;
  }

  get invitedById(): string | null {
    return this.props.invitedById;
  }

  get expiresAt(): Date {
    return this.props.expiresAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  effectiveStatus(now: Date): EffectiveInvitationStatus {
    if (
      this.props.status === InvitationStatus.PENDING &&
      this.props.expiresAt <= now
    ) {
      return 'EXPIRED';
    }
    return this.props.status;
  }

  isUsable(now: Date): boolean {
    return this.effectiveStatus(now) === InvitationStatus.PENDING;
  }
}
