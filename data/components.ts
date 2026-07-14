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
    code: string;
    title: string;
    language: string;
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
      title: "example.tsx",
      language: "tsx",
      code: `import { Tooltip } from "@/components/registry/floating-tooltip";

<Tooltip content="42 requests" highlight>
  <button type="button">Requests</button>
</Tooltip>`,
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
      title: "example.tsx",
      language: "tsx",
      code: `import { ActivityGrid } from "@/components/registry/activity-grid";

<ActivityGrid
  columns={weeks}
  cellSize={8}
  gap={2}
  getKey={(item) => item?.date ?? "empty"}
  renderCell={({ item }) => <ActivityCell item={item} />}
/>`,
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
      title: "example.tsx",
      language: "tsx",
      code: `import {
  ContributionGraph,
  ContributionGraphBlock,
  ContributionGraphCalendar,
} from "@/components/kibo-ui/contribution-graph";

<ContributionGraph data={activity}>
  <ContributionGraphCalendar>
    {(cell) => <ContributionGraphBlock {...cell} />}
  </ContributionGraphCalendar>
</ContributionGraph>`,
    },
  },
  {
    slug: "dither-footer",
    name: "Dither Footer",
    category: "Visual",
    description:
      "An interactive WebGL transition revealed after the page footer.",
    status: "exploring",
    files: ["components/BottomShader.tsx", "components/ui/shaders/dither.tsx"],
    dependencies: ["three", "@react-three/fiber"],
    registryDependencies: [],
    usage: {
      title: "layout.tsx",
      language: "tsx",
      code: `import BottomShader from "@/components/BottomShader";

<Footer />
<BottomShader />`,
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
      title: "providers.tsx",
      language: "tsx",
      code: `import GlobalHotkeys from "@/components/GlobalHotkeys";

<ThemeProvider attribute="class" defaultTheme="system" enableSystem>
  <GlobalHotkeys />
  {children}
</ThemeProvider>`,
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
      title: "shortcut.tsx",
      language: "tsx",
      code: `import { Kbd, KbdGroup } from "@/components/ui/kbd";

<KbdGroup>
  <Kbd>Ctrl</Kbd>
  <span>+</span>
  <Kbd keyName="K" reactive>K</Kbd>
</KbdGroup>`,
    },
  },
] as const satisfies readonly RegistryEntry[];

export type RegisteredComponent = (typeof componentRegistry)[number];
export type ComponentSlug = (typeof componentRegistry)[number]["slug"];
