import type { ComponentType } from "react";
import type { ComponentSlug } from "@/data/components";

export type FixtureCase = {
  id: string;
  name: string;
  component: ComponentType;
  stageClassName?: string;
};

export type ComponentFixture<Slug extends ComponentSlug = ComponentSlug> = {
  slug: Slug;
  cases: readonly FixtureCase[];
};

export type FixtureRegistry = {
  [Slug in ComponentSlug]: ComponentFixture<Slug>;
};
