import {
  ActivityGridDefaultFixture,
  ActivityGridEmptyFixture,
  ActivityGridWideFixture,
} from "./activity-grid";
import {
  ContributionGraphDefaultFixture,
  ContributionGraphNoLabelsFixture,
  ContributionGraphSparseFixture,
} from "./contribution-graph";
import { DitherAnimatedFixture, DitherStaticFixture } from "./dither-footer";
import type { FixtureRegistry } from "./fixture-types";
import {
  TooltipCollisionFixture,
  TooltipContentResizeFixture,
  TooltipControlledFixture,
  TooltipDefaultFixture,
  TooltipPlacementsFixture,
  TooltipScrollFixture,
  TooltipVirtualTargetsFixture,
} from "./floating-tooltip";
import {
  ThemeHotkeyDefaultFixture,
  ThemeHotkeyInputFixture,
  ThemeHotkeyRapidFixture,
} from "./theme-hotkey";

export const fixtureRegistry: FixtureRegistry = {
  "floating-tooltip": {
    slug: "floating-tooltip",
    cases: [
      {
        id: "default",
        name: "Default",
        component: TooltipDefaultFixture,
      },
      {
        id: "placements",
        name: "Placements",
        component: TooltipPlacementsFixture,
      },
      {
        id: "collision",
        name: "Collision",
        component: TooltipCollisionFixture,
        stageClassName: "min-h-[calc(100svh-14rem)]",
      },
      {
        id: "virtual-targets",
        name: "Virtual targets",
        component: TooltipVirtualTargetsFixture,
      },
      {
        id: "content-resize",
        name: "Content resize",
        component: TooltipContentResizeFixture,
      },
      {
        id: "scroll",
        name: "Scroll",
        component: TooltipScrollFixture,
      },
      {
        id: "controlled",
        name: "Controlled",
        component: TooltipControlledFixture,
      },
    ],
  },
  "activity-grid": {
    slug: "activity-grid",
    cases: [
      {
        id: "default",
        name: "Default",
        component: ActivityGridDefaultFixture,
      },
      {
        id: "wide",
        name: "Wide",
        component: ActivityGridWideFixture,
      },
      {
        id: "empty",
        name: "Empty",
        component: ActivityGridEmptyFixture,
      },
    ],
  },
  "contribution-graph": {
    slug: "contribution-graph",
    cases: [
      {
        id: "default",
        name: "Default",
        component: ContributionGraphDefaultFixture,
      },
      {
        id: "sparse",
        name: "Sparse",
        component: ContributionGraphSparseFixture,
      },
      {
        id: "no-labels",
        name: "No labels",
        component: ContributionGraphNoLabelsFixture,
      },
    ],
  },
  "dither-footer": {
    slug: "dither-footer",
    cases: [
      {
        id: "animated",
        name: "Animated",
        component: DitherAnimatedFixture,
        stageClassName: "p-0",
      },
      {
        id: "static",
        name: "Static",
        component: DitherStaticFixture,
        stageClassName: "p-0",
      },
    ],
  },
  "theme-hotkey": {
    slug: "theme-hotkey",
    cases: [
      {
        id: "default",
        name: "Default",
        component: ThemeHotkeyDefaultFixture,
      },
      {
        id: "input",
        name: "Input exclusion",
        component: ThemeHotkeyInputFixture,
      },
      {
        id: "rapid",
        name: "Rapid fire",
        component: ThemeHotkeyRapidFixture,
      },
    ],
  },
};
