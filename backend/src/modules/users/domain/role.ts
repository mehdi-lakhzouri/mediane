export const Role = {
  ADMIN: 'ADMIN',
  DRIVER: 'DRIVER',
} as const;
export type Role = (typeof Role)[keyof typeof Role];
