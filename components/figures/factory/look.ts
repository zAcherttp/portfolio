// How the factory drawing is inked. Kept free of three.js so the page can
// import it without the renderer.

/** How the drawing is inked; /dev/factory tunes these live. */
export interface FactoryLook {
  /** Render scale over the canvas: ink is found at this size, then averaged down. */
  supersample: 1 | 2 | 3;
  /** Ink width in supersampled pixels, 1–3; fractions ink the outer ring in part. */
  lineWidth: number;
  /** Crease strength when fully zoomed in, 0–1. */
  crease: number;
  /** Outline strength of footing and small details when fully zoomed in, 0–1. */
  detail: number;
  /** Screen scale (CSS pixels per metre) where creases and details are at full strength. */
  fadeScale: number;
}

export const DEFAULT_LOOK: FactoryLook = {
  supersample: 3,
  lineWidth: 1.5,
  crease: 0.8,
  detail: 0.8,
  fadeScale: 5,
};

/** Creases and details fade in between 40% and 100% of `fadeScale`. */
export function lookStrengths(look: FactoryLook, pixelsPerMetre: number) {
  const t = Math.min(
    1,
    Math.max(
      0,
      (pixelsPerMetre - look.fadeScale * 0.4) / (look.fadeScale * 0.6),
    ),
  );
  const s = t * t * (3 - 2 * t);
  return { crease: look.crease * s, detail: look.detail * (0.25 + 0.75 * s) };
}
