import { useEffect } from "react";

export const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

export function isFocusableOrContainsFocusable(element: HTMLElement): boolean {
  const isSelfFocusable =
    element.hasAttribute("tabindex") &&
    element.getAttribute("tabindex") !== "-1";
  if (isSelfFocusable) return true;
  return element.querySelector(FOCUSABLE_SELECTOR) !== null;
}

export function useInertManager() {
  useEffect(() => {
    // Automatically apply the native 'inert' attribute to structural elements marked with aria-hidden="true"
    // to prevent keyboard focus issues (axe aria-hidden-focusable rule)
    const handleMutation = (target: HTMLElement) => {
      const isStructural = /^(DIV|SECTION|MAIN|ASIDE|HEADER|FOOTER)$/i.test(
        target.tagName,
      );
      if (!isStructural) return;

      if (
        target.getAttribute("aria-hidden") === "true" &&
        isFocusableOrContainsFocusable(target)
      ) {
        target.setAttribute("inert", "");
      } else {
        target.removeAttribute("inert");
      }
    };

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (
          mutation.type === "attributes" &&
          mutation.attributeName === "aria-hidden" &&
          mutation.target instanceof HTMLElement
        ) {
          handleMutation(mutation.target);
        }
      }
    });

    observer.observe(document.body, {
      attributes: true,
      subtree: true,
      attributeFilter: ["aria-hidden"],
    });

    // Run initial scan on mount after hydration completes
    const timeoutId = setTimeout(() => {
      const elements = document.querySelectorAll(
        'div[aria-hidden="true"], section[aria-hidden="true"], main[aria-hidden="true"]',
      );
      for (const element of elements) {
        if (
          element instanceof HTMLElement &&
          isFocusableOrContainsFocusable(element)
        ) {
          element.setAttribute("inert", "");
        }
      }
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      observer.disconnect();
    };
  }, []);
}
