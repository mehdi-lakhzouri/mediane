"use client";

import { useMessages } from "../../../lib/i18n/locale-provider";
import { marketingContent, type MarketingContent } from "./content";

/** The marketing copy in the reader's language. */
export function useContent(): MarketingContent {
  return useMessages(marketingContent);
}
