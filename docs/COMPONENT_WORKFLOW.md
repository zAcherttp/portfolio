# Component Workflow

This workflow is mandatory for every component added to the portfolio component registry. A component is not complete or ready to ship until every gate below is satisfied.

## 1. Define The Boundary

- State the component's single responsibility and intended consumers.
- Separate ergonomic DOM APIs from lower-level virtual or headless primitives when both are needed.
- Reuse established project conventions before adding dependencies or abstractions.
- Decide which behavior is public contract and which behavior is an implementation detail.

## 2. Register The Component

- Add one stable slug and metadata entry to `data/components.ts`.
- List every source file, package dependency, and local registry dependency.
- Provide the smallest realistic usage example. Do not put implementation source in the usage example.
- Keep registry slugs compatible with route segments and fixture IDs.

## 3. Add Fixtures Before Polishing Documentation

- Add the component to `tests/fixtures/registry.ts` in the same change as its registry entry.
- Provide at least one deterministic default case.
- Add focused cases for interactions, edge conditions, responsive behavior, themes, reduced motion, fallbacks, and accessibility when relevant.
- Give cases stable IDs and controls so humans and browser tests use the same fixture contract.
- Fixtures must not depend on production data, random network responses, or mutable external state.
- Inspect behavior at `/dev/components/<slug>` while the API is still changing.

The typed fixture registry must cover every `componentRegistry` slug. Missing fixture coverage is a TypeScript failure, not a documentation reminder.

## 4. Implement And Refine

- Keep pure domain or geometry logic separate from framework rendering when practical.
- Preserve native browser behavior for focus, keyboard navigation, and semantics.
- Expose controlled and uncontrolled APIs where ownership can reasonably vary.
- Provide escape hatches through focused props, class slots, styles, or CSS variables without leaking internal state.
- Respect reduced motion and clean up observers, timers, listeners, and animation frames.
- Measure performance at event and layout boundaries rather than optimizing speculative code paths.

## 5. Publish Clean MDX

- MDX is user-facing documentation, not a development playground.
- Lead with preview and minimal usage code.
- Keep installation, API reference, credits, and references concise.
- Put exhaustive states, controls, failure modes, and debugging surfaces in fixtures instead of MDX.
- Update MDX only after the public API and fixture behavior have settled.

## 6. Preserve Behavior With Tests

- Unit-test pure resolvers and transformations.
- Test DOM interactions, accessibility, timers, and controlled state in a component environment.
- Test real geometry, scrolling, portals, interruption, viewport collision, and animation in a browser.
- Reuse fixture URLs as the authoritative browser-test harness.
- Add visual regression cases only for states where pixel output is part of the contract.

## 7. Completion Gate

Before a component is considered complete:

- Registry metadata and usage code are accurate.
- Typed fixture coverage exists for the slug.
- Every intended behavior has a focused fixture case.
- The component is manually inspected in light and dark themes at desktop and mobile sizes when applicable.
- MDX remains consumer-focused and contains no fixture-only controls.
- Biome, TypeScript, and the production build pass.
- Relevant interaction and browser checks pass.
- The development fixture route is inaccessible in production.

## Development Surfaces

- `/components/<slug>`: polished user-facing MDX documentation.
- `/dev/components`: development-only fixture index.
- `/dev/components/<slug>?case=<case-id>`: deterministic component inspection case.
- `/playground`: shader-specific experimentation; not the general component fixture system.

