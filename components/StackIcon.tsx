import type { SVGProps } from "react";
import * as SVGs from "@/components/ui/svgs";

const iconComponents: Record<
  string,
  | React.ComponentType<SVGProps<SVGSVGElement>>
  | {
      light: React.ComponentType<SVGProps<SVGSVGElement>>;
      dark: React.ComponentType<SVGProps<SVGSVGElement>>;
    }
> = {
  TypeScript: SVGs.Typescript,
  JavaScript: SVGs.Javascript,
  Go: { light: SVGs.Golang, dark: SVGs.GolangDark },
  React: { light: SVGs.ReactLight, dark: SVGs.ReactDark },
  "Next.js": SVGs.NextjsIconDark,
  "Tailwind CSS": SVGs.Tailwindcss,
  TanStack: SVGs.Tanstack,
  "shadcn/ui": { light: SVGs.ShadcnUi, dark: SVGs.ShadcnUiDark },
  "Base UI": { light: SVGs.BaseUi, dark: SVGs.BaseUiDark },
  Hono: SVGs.Hono,
  "Node.js": SVGs.Nodejs,
  Bun: SVGs.Bun,
  "Better Auth": { light: SVGs.BetterAuthLight, dark: SVGs.BetterAuthDark },
  PostgreSQL: SVGs.Postgresql,
  Redis: SVGs.Redis,
  SQLite: SVGs.Sqlite,
  Convex: SVGs.Convex,
  "Drizzle ORM": { light: SVGs.DrizzleOrmLight, dark: SVGs.DrizzleOrmDark },
  Git: SVGs.Git,
  GitHub: { light: SVGs.GithubLight, dark: SVGs.GithubDark },
  Vercel: { light: SVGs.Vercel, dark: SVGs.VercelDark },
  Docker: SVGs.Docker,
  Postman: SVGs.Postman,
  Vitest: SVGs.Vitest,
  Linear: SVGs.Linear,
  Claude: SVGs.ClaudeAiIcon,
  Antigravity: SVGs.Antigravity,
  Gemini: SVGs.Gemini,
  Codex: { light: SVGs.CodexLight, dark: SVGs.CodexDark },
  Paper: SVGs.Paper,
  Motion: { light: SVGs.Motion, dark: SVGs.MotionDark },
  ChatGPT: { light: SVGs.Openai, dark: SVGs.OpenaiDark },
  Excalidraw: SVGs.ExcalidrawIcon,
  tldraw: SVGs.TldrawIcon,
};

interface StackIconProps {
  color: string;
  name: string;
}

export default function StackIcon({ color, name }: StackIconProps) {
  const component = iconComponents[name];

  if (component) {
    if (
      typeof component === "object" &&
      "light" in component &&
      "dark" in component
    ) {
      const LightComponent = component.light;
      const DarkComponent = component.dark;
      return (
        <>
          <LightComponent className="size-3 dark:hidden" />
          <DarkComponent className="size-3 hidden dark:block" />
        </>
      );
    }
    const SingleComponent = component as React.ComponentType<
      SVGProps<SVGSVGElement>
    >;
    return <SingleComponent className="size-3" />;
  }

  return (
    <span
      aria-hidden="true"
      className="inline-block size-3 rounded-[3px]"
      style={{ backgroundColor: color }}
    />
  );
}
