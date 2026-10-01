import type { Response } from 'supertest';

/**
 * Minimal browser-like cookie store for e2e tests (ignores Path/Domain on
 * purpose: tests also replay cookies explicitly to simulate stolen tokens).
 */
export class CookieJar {
  private readonly cookies = new Map<string, string>();

  absorb(res: Response): this {
    for (const line of res.get('Set-Cookie') ?? []) {
      const [pair, ...attributes] = line.split(';').map((part) => part.trim());
      const separator = pair.indexOf('=');
      const name = pair.slice(0, separator);
      const value = pair.slice(separator + 1);
      const expired = attributes.some(
        (attr) =>
          attr.toLowerCase().startsWith('expires=') &&
          new Date(attr.slice('expires='.length)).getTime() <= Date.now(),
      );
      if (!value || expired) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
    return this;
  }

  get(name: string): string | undefined {
    return this.cookies.get(name);
  }

  set(name: string, value: string): this {
    this.cookies.set(name, value);
    return this;
  }

  header(): string {
    return [...this.cookies]
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  }

  clone(): CookieJar {
    const copy = new CookieJar();
    this.cookies.forEach((value, name) => copy.set(name, value));
    return copy;
  }
}
