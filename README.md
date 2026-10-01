# Tuấn Phát's portfolio

Personal portfolio and reusable interface component registry built with Next.js,
React, TypeScript, Tailwind CSS, and Base UI.

[Live portfolio](https://zachrttp.vercel.app) ·
[Projects](https://zachrttp.vercel.app/projects) ·
[Components](https://zachrttp.vercel.app/components)

## Local development

Use Node.js 24 or newer and the pnpm version pinned in `package.json`:

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Portless serves the app at [https://portfolio.localhost](https://portfolio.localhost)
and gives linked Git worktrees their own branch-prefixed subdomain. Its first run
may ask to trust the local certificate authority.

Use `pnpm dev:app` for a direct Next.js server. Browser tests use this command
without the Portless proxy.

## Maintain portfolio content

- `data/profile.ts` owns the shared name, role, description, and social links.
- `data/projects.ts` owns project selection, display order, descriptions, tags,
  repository URLs, and language statistics. The first three projects appear on
  the homepage.
- `data/bookmarks.ts` owns the bookmark collection.
- `app/home-profile.client.tsx` contains the displayed contact details;
  `app/page.tsx` contains the About and Stack sections.

Read [the content workflow](docs/CONTENT_WORKFLOW.md) before changing public
content. Read [the component workflow](docs/COMPONENT_WORKFLOW.md) before adding
or changing a registry component.

Refresh GitHub language statistics with:

```bash
pnpm projects:refresh
git diff -- data/projects.ts
```

The command uses the current project list and preserves curated copy, tags,
ordering, and URLs. It validates every response before replacing the file;
request or validation failures leave the original file untouched. Empty
repositories retain their previous language values. Descriptions and project
selection remain manual edits.

Public repositories work without a token. Set `GITHUB_TOKEN` in the environment
or an ignored `.env` file if GitHub's unauthenticated rate limit is reached.

### GitHub activity

The homepage combines the personal (`zAcherttp`) and work (`Phat-Learneris`)
accounts listed in `data/profile.ts`. Contributions on the same date are added
together, and color intensity is recalculated from those combined daily counts.
This sums GitHub contribution counts, rather than deduplicating shared commits.

No token is needed: both calendars come from the public GitHub contributions API.
Its totals follow each account's public visibility settings. Account data is
cached daily, with a one-hour browser cache. If either calendar fails to load,
the endpoint returns an error instead of a partial combined total.

Set `GITHUB_USERNAMES=zAcherttp,Phat-Learneris` to override the complete account
list. The legacy `GITHUB_USERNAME` setting overrides the primary account while
retaining the default work account, so existing deployments combine both without
changing environment settings. Duplicate usernames are counted only once.
`GITHUB_CONTRIBUTIONS_API_URL` can override the upstream API base URL.

## Verify changes

```bash
pnpm lint
pnpm exec tsc --noEmit
pnpm test:run
pnpm build
```

Run `pnpm test:browser` for browser behavior checks after installing Chromium
with `pnpm exec playwright install chromium`. See `AGENTS.md` for focused checks.

## Deployment

The live site is hosted on Vercel. `lib/seo/site.ts` resolves the canonical origin
from `NEXT_PUBLIC_SITE_URL`, Vercel's production URL, or Vercel's deployment URL,
with localhost as the development fallback. Set `NEXT_PUBLIC_SITE_URL` to the
production origin when building outside Vercel.

## License and attribution

The source is [MIT licensed](LICENSE). See [attribution notes](docs/ATTRIBUTION.md)
for component and design credits.
