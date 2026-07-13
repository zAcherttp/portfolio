import { cache } from "react";
import { codeToHast } from "shiki";
import { CODE_THEMES } from "./code-theme";

export const highlightCode = cache(async (code: string, language = "tsx") =>
  codeToHast(code, {
    lang: language,
    themes: CODE_THEMES,
    defaultColor: false,
    transformers: [
      {
        line(node) {
          node.properties["data-line"] = "";
        },
      },
    ],
  }),
);
