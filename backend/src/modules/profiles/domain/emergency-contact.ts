export const Gender = {
  MALE: 'MALE',
  FEMALE: 'FEMALE',
} as const;
export type Gender = (typeof Gender)[keyof typeof Gender];

export const EmergencyContactRelationship = {
  SPOUSE: 'SPOUSE',
  PARENT: 'PARENT',
  CHILD: 'CHILD',
  SIBLING: 'SIBLING',
  RELATIVE: 'RELATIVE',
  FRIEND: 'FRIEND',
  COLLEAGUE: 'COLLEAGUE',
  OTHER: 'OTHER',
} as const;
export type EmergencyContactRelationship =
  (typeof EmergencyContactRelationship)[keyof typeof EmergencyContactRelationship];

/** Someone to call when the driver has an incident. */
export interface EmergencyContact {
  fullName: string;
  relationship: EmergencyContactRelationship;
  /** E.164 */
  phoneNumber: string;
  /** 1 = called first. Derived from the order the driver gave. */
  priority: number;
}
