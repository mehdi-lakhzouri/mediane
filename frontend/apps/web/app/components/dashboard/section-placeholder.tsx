import Link from "next/link";
import { Construction, type LucideIcon } from "lucide-react";
import { Badge } from "@repo/ui/components/ui/badge";
import { Card } from "@repo/ui/components/ui/card";
import { defineMessages } from "../../../lib/i18n/messages";
import { getMessages } from "../../../lib/i18n/server";

const messages = defineMessages({
  en: { inDevelopment: "In development" },
  fr: { inDevelopment: "En développement" },
});

interface SectionPlaceholderProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  actionHref?: string;
  actionLabel?: string;
}

/**
 * Shown for sections whose APIs are not built yet. A server component: pages
 * pass it an icon component, which cannot cross into client code.
 */
export async function SectionPlaceholder({
  title,
  description,
  icon: Icon = Construction,
  actionHref,
  actionLabel,
}: SectionPlaceholderProps) {
  const t = await getMessages(messages);
  return (
    <Card className="min-h-[380px] items-center justify-center p-8 text-center">
      <div className="max-w-sm">
        <span className="mx-auto grid size-14 place-items-center rounded-xl bg-secondary">
          <Icon className="size-7 text-primary" strokeWidth={1.8} />
        </span>
        <h2 className="mt-5 text-lg font-bold tracking-tight text-foreground">
          {title}
        </h2>
        <p className="mt-2 text-[14px] leading-6 text-muted-foreground">
          {description}
        </p>
        <Badge variant="warning" className="mt-5">
          {t.inDevelopment}
        </Badge>
        {actionHref && actionLabel ? (
          <Link
            href={actionHref}
            className="mt-5 flex min-h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            {actionLabel}
          </Link>
        ) : null}
      </div>
    </Card>
  );
}
