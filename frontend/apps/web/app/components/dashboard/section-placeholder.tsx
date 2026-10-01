import { Construction, type LucideIcon } from "lucide-react";
import { Badge } from "@repo/ui/components/ui/badge";
import { Card } from "@repo/ui/components/ui/card";

interface SectionPlaceholderProps {
  title: string;
  description: string;
  icon?: LucideIcon;
}

/** Shown for sections whose APIs are not built yet. */
export function SectionPlaceholder({
  title,
  description,
  icon: Icon = Construction,
}: SectionPlaceholderProps) {
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
          In development
        </Badge>
      </div>
    </Card>
  );
}
