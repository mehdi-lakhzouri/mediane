import { MedianeWordmark } from "./mediane-brand";

export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <MedianeWordmark
      height={compact ? 44 : 64}
      surface="auto"
      className="max-w-full"
    />
  );
}
