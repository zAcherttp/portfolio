export const outboundLinkContexts = [
  "bookmark",
  "docs-action",
  "docs-reference",
  "docs-share",
  "footer-credit",
  "footer-resource",
  "profile",
  "project",
  "skill",
  "unclassified",
] as const;

export type OutboundLinkContext = (typeof outboundLinkContexts)[number];

export type UtmCampaign = {
  source: string;
  medium: string;
  campaign: string;
  content?: string;
  term?: string;
};

const outboundLinkContextSet = new Set<string>(outboundLinkContexts);

export function isExternalHttpHref(href: string) {
  return /^(?:https?:)?\/\//i.test(href);
}

export function normalizeOutboundContext(
  context: string | undefined,
): OutboundLinkContext {
  return context && outboundLinkContextSet.has(context)
    ? (context as OutboundLinkContext)
    : "unclassified";
}

export function getOutboundPathGroup(pathname: string) {
  const firstSegment = pathname.split("/").find(Boolean);
  return firstSegment ? `/${firstSegment}` : "/";
}

export function withUtmParameters(href: string, campaign: UtmCampaign) {
  if (!isExternalHttpHref(href)) return href;

  const protocolRelative = href.startsWith("//");
  let url: URL;

  try {
    url = new URL(protocolRelative ? `https:${href}` : href);
  } catch {
    return href;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return href;

  const parameters = {
    utm_source: campaign.source,
    utm_medium: campaign.medium,
    utm_campaign: campaign.campaign,
    utm_content: campaign.content,
    utm_term: campaign.term,
  };

  for (const [name, value] of Object.entries(parameters)) {
    if (value && !url.searchParams.has(name)) {
      url.searchParams.set(name, value);
    }
  }

  const attributedUrl = url.toString();
  return protocolRelative
    ? attributedUrl.replace(/^https:/, "")
    : attributedUrl;
}
