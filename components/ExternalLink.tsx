import type { ComponentPropsWithoutRef } from "react";
import {
  isExternalHttpHref,
  type OutboundLinkContext,
  type UtmCampaign,
  withUtmParameters,
} from "@/lib/attribution";

export type ExternalLinkProps = Omit<ComponentPropsWithoutRef<"a">, "href"> & {
  href: string;
  attributionContext: OutboundLinkContext;
  campaign?: UtmCampaign;
  noReferrer?: boolean;
};

function resolveRel(
  rel: string | undefined,
  target: string | undefined,
  noReferrer: boolean,
) {
  const tokens = new Set(rel?.split(/\s+/).filter(Boolean));
  tokens.delete("noreferrer");

  if (target === "_blank") tokens.add("noopener");
  if (noReferrer) tokens.add("noreferrer");

  return tokens.size > 0 ? Array.from(tokens).join(" ") : undefined;
}

export function ExternalLink({
  attributionContext,
  campaign,
  href,
  noReferrer = false,
  rel,
  target,
  ...props
}: ExternalLinkProps) {
  const external = isExternalHttpHref(href);
  const attributedHref = campaign ? withUtmParameters(href, campaign) : href;

  return (
    <a
      {...props}
      data-outbound-context={external ? attributionContext : undefined}
      data-outbound-link={external ? "" : undefined}
      href={attributedHref}
      rel={external ? resolveRel(rel, target, noReferrer) : rel}
      target={target}
    />
  );
}
