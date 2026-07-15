import createMDX from "@next/mdx";
import createWithVercelToolbar from "@vercel/toolbar/plugins/next";
import type { NextConfig } from "next";
import { CODE_THEMES } from "./lib/code-theme";

const withMDX = createMDX({
  extension: /\.mdx?$/,
  options: {
    remarkPlugins: ["remark-gfm"],
    rehypePlugins: [
      "rehype-slug",
      [
        "rehype-pretty-code",
        {
          theme: CODE_THEMES,
          keepBackground: false,
        },
      ],
    ],
  },
});

const nextConfig: NextConfig = {
  pageExtensions:
    process.env.NODE_ENV === "development"
      ? ["dev.tsx", "js", "jsx", "md", "mdx", "ts", "tsx"]
      : ["js", "jsx", "md", "mdx", "ts", "tsx"],
  reactCompiler: true,
  cacheComponents: true,
  cacheLife: {
    daily: {
      stale: 86400,
      revalidate: 86400,
      expire: 86400,
    },
    monthly: {
      stale: 2592000,
      revalidate: 2592000,
      expire: 2592000,
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/components/:slug.mdx",
        destination: "/component-docs.mdx/:slug",
      },
      {
        source: "/components/:slug",
        destination: "/component-docs.mdx/:slug",
        has: [
          {
            type: "header",
            key: "accept",
            value: ".*text/markdown.*",
          },
        ],
      },
    ];
  },
};

const withVercelToolbar = createWithVercelToolbar();

export default withMDX(withVercelToolbar(nextConfig));
