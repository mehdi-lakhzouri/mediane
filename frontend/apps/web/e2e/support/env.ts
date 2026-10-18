function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for the E2E suite`);
  return value;
}

export const ADMIN_EMAIL = required("ADMIN_EMAIL");
export const ADMIN_PASSWORD = required("ADMIN_PASSWORD");
export const API_URL = process.env.API_URL ?? "http://localhost:4000/api/v1";
