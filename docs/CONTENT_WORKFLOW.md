# Content Workflow

This workflow governs public portfolio content, component documentation, and
future blog articles. It defines the shared publishing baseline while leaving
component registry requirements to `docs/COMPONENT_WORKFLOW.md`.

## 1. Choose The Content Type

Use one source of truth for each content family:

- Portfolio, profile, project, and bookmark content belongs in the relevant
  typed module under `data/`.
- Component catalog and installation metadata belong in `registry.json`.
  Usage extraction and presentation overrides belong in the keyed
  `data/components.ts` documentation overlay. Consumer documentation belongs
  in `content/components/<slug>.mdx` and must also follow
  `docs/COMPONENT_WORKFLOW.md`.
- Future articles belong in `content/blog/<slug>.mdx`. The filename is the
  canonical slug; do not repeat a separately editable slug in frontmatter.

Do not duplicate component names, descriptions, categories, status, files, or
dependencies in the documentation overlay or component MDX. Read those fields
from the validated registry pipeline instead. Keep fixtures and debugging
states out of public content.

## 2. Validate Article Frontmatter

Article loading must validate frontmatter through a typed schema before the
content is used for routing, metadata, feeds, or rendering. The future
`ArticleFrontmatter` contract is:

```ts
type ArticleFrontmatter = {
  title: string;
  description: string;
  publishedAt: string;
  updatedAt?: string;
  tags?: string[];
  draft?: boolean;
  image?: {
    src: string;
    alt: string;
  };
};
```

- `publishedAt` and `updatedAt` use ISO 8601 dates. Reject invalid dates and an
  `updatedAt` value earlier than `publishedAt`.
- Treat a missing `draft` value as `false`.
- Trim titles, descriptions, tags, and image alternative text. Reject empty
  required values and empty image fields.
- Use the existing site configuration for author and site identity rather than
  repeating those values in each article.

This contract documents the future article loader. Do not add frontmatter to
component MDX or maintain parallel article metadata in a separate manifest.

## 3. Publish Metadata And Discovery

- Build page metadata through `lib/seo/metadata.ts` so titles, descriptions,
  canonical URLs, robots directives, Open Graph data, and Twitter data remain
  consistent.
- Give every public page its canonical route. Use `type: "article"` for blog
  articles and emit appropriate article structured data.
- Include all indexable portfolio, component, and article routes in
  `app/sitemap.ts`.
- Include every published article in `/rss.xml` using its canonical URL,
  description, and publication date.
- Exclude drafts from production routes, navigation, structured data, the
  sitemap, and RSS. Draft previews must be explicitly non-indexable.
- Provide a route-specific Open Graph image when the content needs one;
  otherwise rely on the established site default.

Metadata, sitemap, feed, and navigation must use the same validated content
source so publication state cannot drift between surfaces.

## 4. Render Accessible MDX

- Render MDX through `mdx-components.tsx` so typography, links, figures, and
  code use the shared documentation primitives.
- Render exactly one page-level `h1` from route metadata. Begin authored MDX at
  `h2` and keep heading levels ordered without skipping levels for appearance.
- Use descriptive link text. Preserve the existing external-link behavior and
  visibly distinguish links without relying on color alone.
- Give informative images meaningful `alt` text. Use empty alternative text
  for decorative images and pair complex visuals with adjacent explanation or
  a caption.
- Mark fenced code blocks with the correct language so the configured Shiki
  pipeline can highlight them. Keep code usable without color and preserve the
  established copy and collapsed-code controls.
- Keep raw HTML and custom MDX components trusted, reviewable, and limited to
  what the article needs. Do not load remote executable content from MDX.

## 5. Handle Images And Assets

- Use `next/image` for raster content images. Supply intrinsic dimensions and
  an accurate `sizes` value so responsive pages avoid layout shift and
  unnecessary downloads.
- Keep lazy loading as the default. Use priority or high fetch priority only
  for the actual largest-contentful-paint image.
- Store stable local assets in `public/` or import them when static imports are
  useful. Use predictable, content-oriented filenames.
- Add remote image hosts to the Next.js image allowlist before publishing and
  prefer durable sources under project control.
- Keep SVG accessible: hide decorative SVGs from assistive technology and give
  meaningful standalone graphics an accessible name.
- Optimize media before committing it. Avoid shipping source-resolution images
  when the rendered surface is substantially smaller.

## 6. Isolate Interactive Showcases

- Keep narrative content and metadata server-rendered. Add a client boundary
  only around the interaction that needs state, effects, browser APIs, or a
  client-only library.
- Dynamically import heavy WebGL, shader, canvas, or visualization code and
  provide a stable fallback with the same reserved dimensions.
- Do not let loading, expanding, tab changes, or hydration alter surrounding
  content spacing unexpectedly.
- Respect reduced motion, keyboard interaction, focus visibility, and native
  semantics. Do not make hover the only way to reveal essential information.
- Pause or reduce work when an interactive surface is offscreen or hidden when
  practical. Clean up observers, listeners, timers, animation frames, media,
  and graphics resources.
- Avoid autoplaying sound or resource-heavy animation. Require a clear user
  action when the experience would be distracting or costly.

## 7. Complete The Publishing Gate

Before publishing content:

- The typed source or frontmatter validates and contains no placeholder copy.
- Canonical metadata, structured data, navigation, sitemap, and RSS inclusion
  agree with the content's publication state.
- Heading order, links, images, figures, and code are accessible.
- Interactive examples have stable fallbacks, no unintended layout shift, and
  appropriate reduced-motion behavior.
- Component documentation also satisfies `docs/COMPONENT_WORKFLOW.md`.
- `pnpm lint`, `pnpm exec tsc --noEmit`, and `pnpm build` pass when the change
  touches rendering, routes, metadata, loaders, or interactive behavior.
- Relevant unit and browser tests cover metadata generation, draft exclusion,
  sitemap and feed membership, MDX rendering, and interactive behavior when
  those systems exist or change.

For copy-only changes that cannot affect routing or rendering, review the
rendered page and run the smallest applicable checks. Expand verification when
shared MDX components, metadata helpers, or publishing infrastructure changes.
