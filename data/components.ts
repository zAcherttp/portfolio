import componentsConfig from "@/components.json";
import {
  type RegistryEntry as CanonicalRegistryEntry,
  type ComponentDocsMetadata,
  createComponentRegistry,
} from "@/lib/component-registry";
import registryManifest from "@/registry.json";

const componentDocsMetadataDefinition = {
  "floating-tooltip": {
    usage: {
      format: "jsx",
      selector: "VirtualTooltip",
      source: "components/docs/component-preview.tsx",
    },
  },
  "activity-grid": {
    usage: {
      format: "jsx",
      selector: "ActivityGrid",
      source: "components/kibo-ui/contribution-graph/index.tsx",
    },
  },
  "contribution-graph": {
    primaryCategory: "composition",
    usage: {
      format: "jsx",
      selector: "ContributionGraph",
      source: "components/profile/GitHubContributions.tsx",
    },
  },
  "dither-footer": {
    additionalSourceFiles: ["components/DitherFooter.tsx"],
    usage: {
      format: "jsx",
      selector: "DitherFooter",
      source: "components/docs/component-preview.tsx",
    },
  },
  "theme-hotkey": {
    additionalSourceFiles: ["components/Providers.tsx"],
    usage: {
      format: "jsx",
      selector: "GlobalHotkeys",
      source: "components/Providers.tsx",
    },
  },
  "transaction-dock": {
    usage: {
      format: "jsx",
      selector: "TransactionDockProvider",
      source: "components/docs/component-preview.tsx",
    },
  },
  "while-away-notifications": {
    usage: {
      format: "jsx",
      selector: "WhileAwayNotificationsProvider",
      source: "components/docs/while-away-notifications-usage.tsx",
    },
  },
  kbd: {
    usage: {
      format: "jsx",
      selector: "Kbd",
      source: "components/docs/keyboard-60-preview.tsx",
    },
  },
} as const;

export type RegistrySlug = keyof typeof componentDocsMetadataDefinition;
export type ComponentSlug = RegistrySlug;

const componentDocsMetadata = componentDocsMetadataDefinition satisfies Record<
  RegistrySlug,
  ComponentDocsMetadata
>;

export const componentRegistry = createComponentRegistry(
  registryManifest,
  componentDocsMetadata,
  componentsConfig,
);

export type RegisteredComponent = (typeof componentRegistry)[number];
export type RegistryEntry = CanonicalRegistryEntry<ComponentSlug>;
export type RegistryStatus = RegistryEntry["status"];

const componentSlugSet: ReadonlySet<string> = new Set(
  componentRegistry.map((entry) => entry.slug),
);

export function isComponentSlug(value: string): value is ComponentSlug {
  return componentSlugSet.has(value);
}
