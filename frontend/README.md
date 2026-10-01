# CabinGuard frontend

The frontend is a pnpm/Turborepo workspace containing the Next.js application
and shared UI/tooling packages.

## Workspace

- `apps/web` — CabinGuard Next.js application.
- `packages/ui` — shared shadcn/ui components and Tailwind v4 theme.
- `packages/eslint-config` — shared ESLint flat configurations.
- `packages/typescript-config` — shared TypeScript configurations.

## Commands

```bash
pnpm install
pnpm dev
pnpm lint
pnpm typecheck
pnpm build
```

Add shared shadcn/ui components from the repository root:

```bash
pnpm dlx shadcn@latest add button -c packages/ui
```

Applications import shared components through package exports, for example:

```tsx
import { Button } from "@repo/ui/components/ui/button";
```
