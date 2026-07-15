# Component conventions

Apply these conventions incrementally. Preserve established behavior and avoid mechanical restyling outside the requested component.

## Base UI composition

- The project is configured for Base UI. Use the `render` prop for polymorphic composition, not Radix `asChild`.
- Set `nativeButton={false}` when a button primitive renders an anchor or another non-button element.
- Preserve merged handlers, attributes, refs, and component state when supplying a rendered element.
- Prefer the existing project wrapper over importing the underlying primitive directly.

```tsx
<Button render={<a href="/docs" />} nativeButton={false}>
  Documentation
</Button>
```

## Reusable primitive shape

- Add `data-slot` to reusable structural parts when it provides a stable styling or testing hook.
- Add `data-variant` and `data-size` when the primitive exposes those public dimensions.
- Use CVA when a component has a real public variant matrix. Do not introduce it for a single conditional class.
- Accept `className`, merge with `cn()`, and spread remaining props onto the public root.
- Keep wrappers small. Extract pure state, parsing, and geometry logic into separate modules when useful.

## Composition patterns

- Use the project's matching component groups instead of recreating their internal spacing or borders.
- Place tab triggers inside the tab list and keep their accessible relationship with tab panels.
- Give dialogs, sheets, drawers, and other overlays an accessible title; use visually hidden text when the design omits a visible heading.
- Provide avatar fallbacks and meaningful image `alt` text.
- Reuse established alert, empty-state, separator, skeleton, badge, and toast primitives.
- For a loading button, combine `disabled` state and a spinner with the existing button API. Do not invent an `isLoading` prop unless it is a deliberate public contract.

## Forms

- Prefer the installed `Field` system for labels, descriptions, errors, and grouped controls.
- Preserve native validation semantics where possible.
- Put `data-invalid` on the field wrapper and `aria-invalid` on the control.
- Use `fieldset` and `legend` for related controls.
- Use the existing grouped-input primitive for prefixes, suffixes, actions, and multiline controls.

## Styling

- Use semantic tokens for routine product UI and add a token before repeating an unexplained literal color.
- Prefer existing variants over usage-site selector overrides.
- Merge conditional classes with `cn()`.
- Prefer `gap-*` for layout spacing and `size-*` for equal width and height.
- Use truncation utilities for text inside flexible rows.
- Let the overlay component own its stacking context unless the design requires a documented exception.
- Let component primitives own icon sizing. Use `data-icon` where the primitive supports it.

Bespoke shader, canvas, data-visualization, or authored motion surfaces may use intentional local palette values and explicit dimensions. Keep those exceptions local so ordinary interface components remain token-driven.

## Client behavior

- Keep the client boundary as narrow as practical.
- Support controlled and uncontrolled state consistently when both are exposed.
- Make motion interruptible, respect reduced motion, and clean up observers, listeners, timers, and animation frames.
- Test public behavior through roles, accessible names, visible state, and outputs rather than implementation details.
