# Repository Guidelines

## Project context

- This is a single Next.js App Router application using React, strict
  TypeScript, Tailwind CSS v4, Base UI, and shadcn/ui with the `base-nova`
  style.
- Use pnpm for every project command and dependency change. Prefer the local
  CLI through `pnpm exec` over downloading an unpinned tool at runtime.
- Keep global design tokens and Tailwind configuration in `app/globals.css`.
- Treat `components/ui` as reusable UI primitives, `components/registry` as
  distributable component source, and `components/docs` as documentation UI.

## Code discovery

Prefer the codebase knowledge graph for code definitions and relationships:

1. `search_graph` for functions, classes, routes, variables, and concepts.
2. `trace_path` for callers, callees, dependencies, and data flow.
3. `get_code_snippet` for a known symbol's implementation.
4. `query_graph` for cross-cutting or multi-hop questions.
5. `get_architecture` for system-level orientation.

Use `rg` for string literals, class names, error messages, configuration,
Markdown, shell scripts, and any discovery the graph cannot answer. Inspect
`git status --short` before editing and preserve unrelated worktree changes.

## Working rules

- Read the relevant implementation, tests, and local documentation before
  changing behavior.
- Make the smallest cohesive change that satisfies the request. Do not mix
  unrelated cleanup into a feature or fix.
- Preserve public behavior unless the request explicitly changes the contract.
- Keep pure state, parsing, and geometry logic separate from React rendering
  when practical.
- Validate untrusted or file-backed data at its boundary. Prefer typed schemas
  and actionable errors over unchecked casts.
- Do not hand-edit generated artifacts. Regenerate them with their project
  command and review the resulting diff.
- Use `apply_patch` for source edits. Preserve existing line endings and
  formatting conventions.

## Next.js and React

- This project can use Next.js APIs newer than model training data. Before
  changing framework behavior, read the relevant guide under
  `node_modules/next/dist/docs/` and heed deprecations.
- Prefer Server Components. Add `"use client"` only when a file needs state,
  effects, event handlers, browser APIs, or client-only libraries.
- Keep secrets, privileged data access, and server-only modules out of client
  dependency trees.
- Preserve accessibility, native browser semantics, focus behavior, reduced
  motion, and cleanup of observers, listeners, timers, and animation frames.

## Content and publishing

Read `docs/CONTENT_WORKFLOW.md` before adding or materially changing public
portfolio content, component documentation, or blog articles. Keep each
content type's source of truth distinct:

- Typed modules under `data/` own portfolio, project, bookmark, and profile
  content.
- `registry.json` owns component catalog and installation metadata.
  `data/components.ts` contains only the keyed documentation overlay, while
  `content/components/<slug>.mdx` contains the published prose; follow
  `docs/COMPONENT_WORKFLOW.md` for component-specific gates.
- Future articles live under `content/blog/<slug>.mdx` and use validated typed
  frontmatter. Derive the public slug from the filename.

Every public content route needs canonical metadata and sitemap coverage.
Published articles also need article structured data and inclusion in
`/rss.xml`; drafts must remain out of production navigation and discovery
surfaces. Render MDX through the shared component map, keep media and code
accessible, prefer Server Components, isolate interactive demos as client
islands, and reserve layout space for deferred content. Verify content changes
in proportion to their routing, rendering, and publishing impact.

## UI conventions

- Use the project-local `$shadcn` skill for work involving `components.json`,
  `registry.json`, `components/ui`, Base UI composition, or shadcn CLI changes.
- Confirm project context with `pnpm exec shadcn info --json` before adding or
  updating shadcn components.
- This project uses Base UI. Use the `render` prop for polymorphic composition,
  not Radix `asChild`. When rendering a button primitive as a non-button, set
  `nativeButton={false}`.
- Reuse installed components and existing variants before creating custom
  markup or new dependencies.
- Use `cn()` for conditional or merged classes. Prefer `gap-*` for layout,
  `size-*` for equal dimensions, and semantic design tokens for routine UI.
- Use `data-slot`, `data-variant`, and `data-size` on reusable primitives when
  those attributes improve composition, styling, or stable test targeting.
- Use the icon library configured in `components.json`. Let UI primitives own
  icon sizing and use `data-icon` where the primitive supports it.
- Bespoke visual surfaces may use intentional palette values or custom motion.
  Keep those exceptions local and do not let them replace semantic tokens in
  ordinary product UI.

## Component registry workflow

Read `docs/COMPONENT_WORKFLOW.md` before adding or materially changing a
published component. Registry work is incomplete until the relevant layers
agree:

- `registry.json` is canonical for slugs, titles, descriptions, categories,
  status, installable files, and dependencies.
- `data/components.ts` contains only documentation usage and presentation
  overrides keyed by registry slug.
- `content/components/<slug>.mdx` contains consumer-facing documentation.
- `tests/fixtures/registry.ts` and its fixture module provide deterministic
  development and browser-test cases.
- Unit, component, and browser tests protect the public behavior.

Keep registry source copyable and consumer-safe: no hidden application-only
imports, undeclared packages, mutable production data, or undocumented setup.
Address same-registry dependencies as `@<registry-name>/<item>` and keep that
namespace configured in `components.json`. Bare dependency names are reserved
for official items; every namespaced local target must exist in `registry.json`.
Keep consumer targets aligned with the aliases in `components.json`.

Generated registry output and `data/type-tables-registry.json` are build
artifacts. Regenerate them through `pnpm registry:build` and
`pnpm precompute-types`; do not edit them directly.

## Verification

Run checks proportional to the change, then expand when risk warrants it:

- `pnpm lint` for Biome formatting and lint rules.
- `pnpm exec tsc --noEmit` for TypeScript.
- `pnpm registry:validate` for registry source changes.
- `pnpm test:component <slug>` for focused unit and DOM behavior.
- `pnpm test:component:browser <slug>.spec.ts` for focused browser behavior.
- `pnpm test:run` for the complete unit/component suite.
- `pnpm build` and `pnpm test:browser` for release-level confidence.

For a bug fix, add or update a test that would fail without the fix. Prefer
roles, accessible names, visible state, and public outputs over implementation
details.

## Commits

- Use Conventional Commits with a concise imperative subject.
- Split independent concerns into reviewable commits.
- Stage only files authored for the current task. Leave unrelated modified and
  untracked files untouched.
