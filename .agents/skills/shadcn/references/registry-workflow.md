# Registry workflow

Read `docs/COMPONENT_WORKFLOW.md` before registry work. Treat it as the detailed project procedure and use this reference as the execution checklist.

## Define the public boundary

- State the component's responsibility and intended consumers.
- Identify the files and packages that form its public installation surface.
- Preserve stable behavior unless the task explicitly changes the contract.
- Split reusable lower-level primitives from application-specific composition when that improves the installable boundary.

## Keep registry layers aligned

A published component normally touches these layers:

1. `registry.json` as the canonical source for public metadata, installable files, dependencies, and registry dependencies.
2. `data/components.ts` for usage extraction and explicit documentation presentation overrides keyed by registry slug.
3. `content/components/<slug>.mdx` for consumer documentation.
4. `tests/fixtures/<slug>.tsx` plus `tests/fixtures/registry.ts` for deterministic cases.
5. Unit, component, and browser tests for the public behavior.

Use one stable slug across the layers. Keep fixture registration typed and make sure its cases cover the documented contract.

## Author installable source

- List every copied source file and its consumer target in `registry.json`.
- Declare package dependencies and registry dependencies explicitly.
- Use bare official item names only where the configured registry resolves them. Address same-registry dependencies as `@<registry-name>/<item>` and require every local target to exist. Use a configured namespace or a pinned repository address for external registries.
- Keep copied source consumer-safe: no application-only imports, production data mutation, private environment assumptions, or undocumented setup.
- Use aliases that resolve in a clean consumer project.
- Do not duplicate canonical registry fields in the documentation overlay.
- Keep the documentation usage example minimal and executable.

## Build and inspect

Run:

```powershell
pnpm registry:validate
pnpm registry:build
```

Treat `registry.json`, component source, docs, metadata, fixtures, and tests as authored inputs. Treat generated registry output and `data/type-tables-registry.json` as build artifacts; regenerate rather than hand-edit them.

Inspect generated output for:

- Correct consumer target paths.
- Resolvable registry dependency addresses.
- Undeclared imports or packages.
- Missing or unintended files.
- Independence from this application's private modules and runtime state.

## Documentation and fixtures

- Keep the MDX page focused on installation, public API, and representative usage.
- Put edge cases and debugging states in deterministic fixtures rather than production pages.
- Expose fixture URLs through the established browser harness.
- Avoid time-, network-, or account-dependent fixture behavior.

## Verification gate

Use focused checks first:

```powershell
pnpm registry:validate
pnpm exec tsc --noEmit
pnpm test:component <slug>
pnpm test:component:browser <slug>.spec.ts
```

For shared primitives or published changes, also run `pnpm test:run`, `pnpm build`, and `pnpm test:browser`. Add a regression test for corrected behavior and verify the generated component from a clean consumer path when installation semantics change.
