export type RegistryStatus = "stable" | "exploring";

export type RegistryEntry = {
  slug: string;
  name: string;
  category: string;
  description: string;
  status: RegistryStatus;
  files: readonly string[];
  dependencies: readonly string[];
  registryDependencies: readonly string[];
  usage: {
    format: "jsx";
    selector: string;
    source: string;
  };
};

export const componentRegistry = [
  {
    slug: "floating-tooltip",
    name: "Floating Tooltip",
    category: "Interaction",
    description:
      "An interruptible tooltip for DOM triggers and virtual anchors with collision-aware placement.",
    status: "exploring",
    files: [
      "components/registry/floating-tooltip/position.ts",
      "components/registry/floating-tooltip/virtual-tooltip.tsx",
      "components/registry/floating-tooltip/tooltip.tsx",
      "components/registry/floating-tooltip/index.ts",
    ],
    dependencies: ["motion"],
    registryDependencies: [],
    usage: {
      format: "jsx",
      selector: "VirtualTooltip",
      source: "components/docs/component-preview.tsx",
    },
  },
  {
    slug: "activity-grid",
    name: "Activity Grid",
    category: "Data Display",
    description:
      "A generic SVG grid with responsive geometry and virtual-anchor cell interaction.",
    status: "exploring",
    files: ["components/registry/activity-grid.tsx"],
    dependencies: [],
    registryDependencies: [],
    usage: {
      format: "jsx",
      selector: "ActivityGrid",
      source: "components/kibo-ui/contribution-graph/index.tsx",
    },
  },
  {
    slug: "contribution-graph",
    name: "Contribution Graph",
    category: "Composition",
    description:
      "A calendar heatmap composed from the activity grid and floating tooltip primitives.",
    status: "stable",
    files: ["components/kibo-ui/contribution-graph/index.tsx"],
    dependencies: ["date-fns"],
    registryDependencies: ["activity-grid", "floating-tooltip"],
    usage: {
      format: "jsx",
      selector: "ContributionGraph",
      source: "components/profile/GitHubContributions.tsx",
    },
  },
  {
    slug: "dither-footer",
    name: "Dither Footer",
    category: "Visual",
    description:
      "An interactive WebGL transition revealed after the page footer.",
    status: "exploring",
    files: [
      "components/DitherFooter.tsx",
      "components/BottomShader.tsx",
      "components/ui/shaders/dither.tsx",
    ],
    dependencies: ["three", "@react-three/fiber"],
    registryDependencies: [],
    usage: {
      format: "jsx",
      selector: "DitherFooter",
      source: "components/docs/component-preview.tsx",
    },
  },
  {
    slug: "theme-hotkey",
    name: "Theme Hotkey",
    category: "Utility",
    description:
      "A throttled global keyboard shortcut for switching the active color theme.",
    status: "stable",
    files: ["components/GlobalHotkeys.tsx", "components/Providers.tsx"],
    dependencies: [
      "next-themes",
      "@tanstack/react-hotkeys",
      "@tanstack/react-pacer",
    ],
    registryDependencies: [],
    usage: {
      format: "jsx",
      selector: "Tooltip",
      source: "components/docs/component-preview.tsx",
    },
  },
  {
    slug: "transaction-dock",
    name: "Transaction Dock",
    category: "Interaction",
    description:
      "A non-modal transaction detail dock with swipeable snap points, automatic capacity collapse, and deterministic re-entry.",
    status: "exploring",
    files: [
      "components/registry/transaction-dock/transaction-card.tsx",
      "components/registry/transaction-dock/transaction-dock.tsx",
      "components/registry/transaction-dock/index.ts",
    ],
    dependencies: ["lucide-react"],
    registryDependencies: ["drawer"],
    usage: {
      format: "jsx",
      selector: "TransactionDockProvider",
      source: "components/docs/component-preview.tsx",
    },
  },
  {
    slug: "while-away-notifications",
    name: "While Away Notifications",
    category: "Interaction",
    description:
      "A tab-scoped notification center that queues background activity and presents it when the user returns.",
    status: "exploring",
    files: [
      "components/registry/while-away-notifications/notification-state.ts",
      "components/registry/while-away-notifications/while-away-notifications.tsx",
      "components/registry/while-away-notifications/index.ts",
    ],
    dependencies: ["lucide-react", "sonner"],
    registryDependencies: ["popover", "sonner"],
    usage: {
      format: "jsx",
      selector: "WhileAwayNotificationsProvider",
      source: "components/docs/while-away-notifications-usage.tsx",
    },
  },
  {
    slug: "kbd",
    name: "KBD",
    category: "Input",
    description:
      "A keyboard key primitive with opt-in held-state visualization powered by TanStack Hotkeys.",
    status: "exploring",
    files: ["components/ui/kbd.tsx"],
    dependencies: ["@tanstack/react-hotkeys"],
    registryDependencies: [],
    usage: {
      format: "jsx",
      selector: "Kbd",
      source: "components/docs/keyboard-60-preview.tsx",
    },
  },
] as const satisfies readonly RegistryEntry[];

export type RegisteredComponent = (typeof componentRegistry)[number];
export type ComponentSlug = (typeof componentRegistry)[number]["slug"];
