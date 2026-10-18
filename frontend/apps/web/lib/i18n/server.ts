import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import {
  isLocale,
  LOCALE_COOKIE,
  negotiateLocale,
  type Locale,
} from "./config";
import type { Messages } from "./messages";

/**
 * The reader's locale for this request (Server Components, generateMetadata):
 * their saved choice first, then their browser languages.
 */
export async function getLocale(): Promise<Locale> {
  const saved = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(saved)) return saved;
  return negotiateLocale((await headers()).get("accept-language"));
}

export async function getMessages<T>(messages: Messages<T>): Promise<T> {
  return messages[await getLocale()];
}

/**
 * A page's `generateMetadata` from per-locale titles and descriptions:
 *   export const generateMetadata = localizedMetadata({ en: {...}, fr: {...} });
 * `shared` holds what does not depend on the language (robots...).
 */
export function localizedMetadata(
  byLocale: Messages<Metadata>,
  shared: Metadata = {},
): () => Promise<Metadata> {
  return async () => ({ ...shared, ...(await getMessages(byLocale)) });
}
