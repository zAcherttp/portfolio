---
name: shadcn
description: Project-aware workflow for adding, updating, composing, reviewing, and publishing shadcn/ui components in this Next.js, Tailwind CSS v4, Base UI registry codebase. Use for tasks involving components.json, registry.json, components/ui, components/registry, shadcn CLI commands, Base UI composition, component installation, registry metadata, or component documentation and fixtures.
---

# shadcn/ui workflow

Use the installed CLI and the existing component system as the source of truth. Preserve local conventions, preview mutations, and verify both application behavior and registry consumption.

## Establish context

1. Read the root `AGENTS.md` and inspect `git status --short`.
2. Read `components.json`, `package.json`, and the relevant component, test, and documentation files.
3. Run `pnpm exec shadcn info --json`.
4. Confirm the configured style, Base UI primitives, icon library, aliases, Tailwind entry point, installed components, and package manager.
5. Before changing Next.js behavior, read the relevant installed guide under `node_modules/next/dist/docs/`.

## Choose the operation

- For application UI composition, read [component conventions](references/component-conventions.md).
- To add a component, search configured registries, inspect the candidate, preview the diff, and then install it.
- To update a component, use dry-run and per-file diffs. Preserve intentional local changes.
- To publish or materially change a registry item, read [registry workflow](references/registry-workflow.md) and `docs/COMPONENT_WORKFLOW.md`.
- To fix or review generated code, inspect imports, composition, accessibility, Base UI usage, icon handling, dependencies, and consumer-safe paths.

## Discover before creating

1. Check whether the needed primitive or pattern is already installed under the alias reported by `shadcn info`.
2. Search and inspect before adding:

   ```powershell
   pnpm exec shadcn search -q "<need>"
   pnpm exec shadcn view <registry>/<item>
   pnpm exec shadcn docs <component>
   ```

3. Prefer an existing project primitive, an added variant, or a focused wrapper over parallel custom markup.
4. Do not guess third-party registry names or item addresses. Confirm them through configured registry metadata.

## Preview mutations

Use the CLI's preview modes before changing files:

```powershell
pnpm exec shadcn add <item> --dry-run
pnpm exec shadcn add <item> --diff
pnpm exec shadcn add <item> --diff <file>
```

- Do not overwrite a locally modified component without explicit approval.
- Treat style, theme, preset, and dependency changes as broader migrations that require full diff review.
- If only part of an upstream change is useful, apply the relevant change selectively and retain project behavior.
- Use the aliases and icon library returned by `shadcn info`; do not hardcode assumptions from another shadcn setup.

## Implement and review

- Read every changed file after a CLI operation. Confirm imports, package dependencies, aliases, and generated paths.
- This project uses Base UI: compose with `render`, not Radix `asChild`; set `nativeButton={false}` when a button primitive renders a non-button element.
- Keep Server Components by default. Add `"use client"` only for client behavior.
- Preserve native semantics, keyboard and focus behavior, accessible names, overlay titles, image fallbacks, controlled and uncontrolled state, reduced motion, and effect cleanup.
- Put reusable variants in the primitive. Keep one-off layout and bespoke visual treatment near the usage.
- Keep registry source independent of application-only modules and undeclared packages.

## Verify

Start with focused checks:

```powershell
pnpm exec biome check <changed-files>
pnpm exec tsc --noEmit
pnpm registry:validate
pnpm test:component <slug>
pnpm test:component:browser <slug>.spec.ts
```

Run `pnpm test:run`, `pnpm build`, and `pnpm test:browser` when changing shared primitives, framework behavior, published registry items, or multiple components. For a bug fix, add or update a regression test that fails without the fix.
