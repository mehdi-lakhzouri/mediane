/** Request metadata forwarded to use cases (auditing, session binding). */
export interface ClientContext {
  requestId: string;
  ipAddress: string | null;
  userAgent: string | null;
}
