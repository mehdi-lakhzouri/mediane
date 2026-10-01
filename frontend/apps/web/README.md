# CabinGuard web

The CabinGuard Next.js application is managed from the frontend workspace root.

```bash
pnpm install
pnpm dev
```

The app runs at [http://localhost:3000](http://localhost:3000). Shared UI
components are imported from `@repo/ui`; add new shadcn/ui components from the
workspace root with:

```bash
pnpm dlx shadcn@latest add button -c packages/ui
```
