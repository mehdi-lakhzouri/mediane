import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';
import { InvitationStatus } from '../../domain/invitation';

export class AcceptInvitationDto {
  @ApiProperty({ description: 'Raw token from the invitation link' })
  @IsString()
  @Length(32, 256)
  token!: string;
}

export class InvitationStatusResponse {
  @ApiProperty({ format: 'uuid' })
  invitationId!: string;

  @ApiProperty({ enum: [...Object.values(InvitationStatus), 'EXPIRED'] })
  status!: string;

  @ApiProperty({ nullable: true, example: 'Mahdi Lakhzouri' })
  invitedBy!: string | null;

  @ApiProperty()
  expiresAt!: Date;

  @ApiProperty()
  createdAt!: Date;
}
