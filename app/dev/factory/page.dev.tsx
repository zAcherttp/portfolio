import type { Metadata } from "next";
import { BackButton } from "@/components/BackButton";
import { FactoryLive } from "@/components/figures/factory/live";
import { requireDevelopmentFixtures } from "@/lib/dev-fixtures";
import { createSeoMetadata } from "@/lib/seo/metadata";
import "@/components/figures/factory/factory.css";

export const metadata: Metadata = createSeoMetadata({
  title: "Factory",
  description: "Development-only full-screen view of the screw factory.",
  path: "/dev/factory",
  noIndex: true,
});

export default function FactoryDevPage() {
  requireDevelopmentFixtures();

  return (
    <main className="min-h-dvh px-4 py-3 text-foreground">
      <BackButton className="mb-2" href="/">
        Home
      </BackButton>
      <FactoryLive full tune />
    </main>
  );
}
