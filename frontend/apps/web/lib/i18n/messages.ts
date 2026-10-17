import type { Locale } from "./config";

/** The same message tree, once per locale. */
export type Messages<T> = Record<Locale, T>;

/**
 * Declares a component's copy in every locale. English is the reference
 * shape: a French tree with a missing, extra or differently typed entry does
 * not compile. Entries that depend on values are plain functions, e.g.
 * `count: (n: number) => (n === 1 ? "1 user" : `${n} users`)`.
 *
 * Keep message files next to the components that use them, so each route
 * only ships its own copy.
 */
export function defineMessages<T>(messages: {
  en: T;
  fr: NoInfer<T>;
}): Messages<T> {
  return messages;
}
