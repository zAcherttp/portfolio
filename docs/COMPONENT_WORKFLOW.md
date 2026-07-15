# Component Workflow

This workflow is mandatory for every component added to the portfolio component registry. A component is not complete or ready to ship until every gate below is satisfied.

## 1. Define The Boundary

- State the component's single responsibility and intended consumers.
- Separate ergonomic DOM APIs from lower-level virtual or headless primitives when both are needed.
- Reuse established project conventions before adding dependencies or abstractions.
- Decide which behavior is public contract and which behavior is an implementation detail.

## 2. Register The Component

- Add one stable slug and all distributable metadata to `registry.json`.
- List every installable source file, package dependency, local registry
  dependency, category, and status there; do not duplicate those fields in
  `data/components.ts`.
- Add a documentation overlay keyed by the same slug to `data/components.ts`.
  Keep it limited to usage extraction and explicit presentation overrides.
- Address dependencies on another item in this registry as
  `@<registry-name>/<item>`. The namespace must match `registry.json`, be
  configured in `components.json`, and resolve to an existing local item.
- Provide the smallest realistic usage example. Do not put implementation
  source in the usage example.
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

- Start from the public contract: inputs, user actions, rendered output, emitted events, side effects, errors, and accessibility semantics.
- Structure tests as arrange, act, assert, with one meaningful behavior per test and a name that describes the regression it prevents.
- Unit-test pure resolvers and transformations.
- Test DOM interactions, accessibility, timers, and controlled state in a component environment.
- Test real geometry, scrolling, portals, interruption, viewport collision, and animation in a browser.
- Reuse fixture URLs as the authoritative browser-test harness.
- Add visual regression cases only for states where pixel output is part of the contract.
- Prefer queries and assertions based on roles, accessible names, visible content, and user-observable state. Do not couple tests to internal state, helper calls, child-component structure, CSS classes, or DOM shape unless that detail is an explicit contract.
- Keep tests isolated and deterministic. Use controlled fixtures instead of depending on another test, mutable production data, or a third-party service.
- In browser tests, use retrying locators and web-first assertions instead of reading a value once and wrapping the result in a synchronous boolean assertion.

### Test Value Gate

Every test must be capable of failing when a plausible behavior regression is introduced. Before keeping a test, name the regression it protects against and verify that changing or removing the behavior would make the test fail.

Do not add tests that only increase test counts without increasing confidence. Reject tests that:

- Assert a constant or condition that is always true, such as `expect(true).toBe(true)`.
- Calculate the expected value with the same constant, branch, or algorithm used by the implementation.
- Assert that a hardcoded default, token, class name, coordinate, duration, or internal object has its current exact value when consumers do not depend on that exact value.
- Assert only that rendering did not throw, an element exists, or a callback is defined when the intended interaction and outcome can be tested instead.
- Snapshot large or incidental DOM output without identifying which consumer-visible behavior the snapshot protects.

Exact-value assertions are appropriate only when the exact value is part of the public contract, such as formatted output, an accessible name, a persisted wire format, boundary math, or a published design token. Otherwise, assert the smallest meaningful semantic outcome, invariant, range, relationship, state transition, or error path.

Prefer precise matchers that express the contract. For example, assert `toBeDefined()` when presence matters, a visible role and name when accessibility matters, `toBeCloseTo()` for floating-point behavior, or an object subset when unrelated fields are allowed to change. Avoid broad truthiness checks that could pass for the wrong reason.

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

## Test Commands

- `pnpm test:component <slug>`: run one component's unit and DOM tests.
- `pnpm test:component:browser <slug>.spec.ts`: run one component's Chromium behavior tests.
- `pnpm test:component:browser:dev <slug>.spec.ts`: reuse the active Portless development server.
- `pnpm test:run`: run every unit and DOM test once.
- `pnpm test:browser`: run the full desktop and mobile browser suite.

## CI Tiers

- Every push and pull request runs Biome, TypeScript, and all unit/component tests.
- Pull requests run the production build and full desktop/mobile browser suite after the fast checks pass.
- Pushes to `master` repeat the production build and browser gate against the merged commit.
- Pushes to `dev` intentionally run only the fast tier; open a pull request to exercise the merge gate.

## Testing References

- [Testing Library: Introduction and guiding philosophy](https://testing-library.com/docs/)
- [Playwright: Best practices](https://playwright.dev/docs/best-practices)
- [Vitest: Testing in practice](https://vitest.dev/guide/learn/testing-in-practice)
- [Vitest: Using matchers](https://vitest.dev/guide/learn/matchers)
