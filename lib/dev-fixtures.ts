import { notFound } from "next/navigation";

export function requireDevelopmentFixtures() {
  if (process.env.NODE_ENV !== "development") notFound();
}
