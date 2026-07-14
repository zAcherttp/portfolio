# Outbound attribution

External links use three separate attribution layers:

1. The site sends origin-only referral data with
   `Referrer-Policy: strict-origin-when-cross-origin`.
2. A single click tracker records the destination host, first path segment,
   and a bounded link context. Query parameters and link text are never sent.
3. Standard UTM parameters are opt-in and reserved for real campaigns, such
   as component links embedded in social share actions.

Use `ExternalLink` for clickable external destinations:

```tsx
<ExternalLink
  attributionContext="docs-reference"
  href="https://example.com/reference"
  target="_blank"
>
  Reference
</ExternalLink>
```

New-tab links receive `rel="noopener"`. Use `noReferrer` only when a link must
hide the site origin from its destination.

Campaign parameters are added without replacing parameters already present on
the destination URL:

```tsx
<ExternalLink
  attributionContext="footer-credit"
  campaign={{
    source: "zacherttp-portfolio",
    medium: "referral",
    campaign: "component-credits",
  }}
  href="https://example.com"
>
  Example
</ExternalLink>
```

Do not add UTMs to ordinary bookmarks, citations, profile links, repositories,
or functional endpoints such as share intents and AI prompts. For social share
intents, attribute the portfolio URL nested inside the intent instead.
