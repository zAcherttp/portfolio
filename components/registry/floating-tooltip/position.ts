export const DEFAULT_COLLISION_PADDING = 8;
export const DEFAULT_GAP = 6;

export type VirtualAnchor = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type FloatingTooltipPlacement =
  | "top-left"
  | "top"
  | "top-right"
  | "right"
  | "bottom-right"
  | "bottom"
  | "bottom-left"
  | "left";

export type FloatingTooltipOffset = {
  x: number;
  y: number;
};

export type TooltipSize = {
  width: number;
  height: number;
};

export type ViewportBounds = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type ResolvedTooltipPosition = {
  left: number;
  top: number;
  placement: FloatingTooltipPlacement;
};

type PlacementVector = {
  x: -1 | 0 | 1;
  y: -1 | 0 | 1;
};

const PLACEMENT_VECTORS: Record<FloatingTooltipPlacement, PlacementVector> = {
  "top-left": { x: -1, y: -1 },
  top: { x: 0, y: -1 },
  "top-right": { x: 1, y: -1 },
  right: { x: 1, y: 0 },
  "bottom-right": { x: 1, y: 1 },
  bottom: { x: 0, y: 1 },
  "bottom-left": { x: -1, y: 1 },
  left: { x: -1, y: 0 },
};

const VECTOR_PLACEMENTS = new Map<string, FloatingTooltipPlacement>(
  Object.entries(PLACEMENT_VECTORS).map(([placement, vector]) => [
    `${vector.x},${vector.y}`,
    placement as FloatingTooltipPlacement,
  ]),
);

function getPlacement(vector: PlacementVector) {
  return VECTOR_PLACEMENTS.get(`${vector.x},${vector.y}`);
}

function getDefaultOffset({ x, y }: PlacementVector): FloatingTooltipOffset {
  return { x: x * DEFAULT_GAP, y: y * DEFAULT_GAP };
}

function getCandidatePlacements(
  placement: FloatingTooltipPlacement,
): FloatingTooltipPlacement[] {
  const vector = PLACEMENT_VECTORS[placement];
  const vectors: PlacementVector[] = [vector];

  if (vector.x !== 0) vectors.push({ x: -vector.x as -1 | 1, y: vector.y });
  if (vector.y !== 0) vectors.push({ x: vector.x, y: -vector.y as -1 | 1 });
  if (vector.x !== 0 && vector.y !== 0) {
    vectors.push({ x: -vector.x as -1 | 1, y: -vector.y as -1 | 1 });
  }

  return vectors.flatMap((candidate) => {
    const resolved = getPlacement(candidate);
    return resolved ? [resolved] : [];
  });
}

function mirrorOffset(
  offset: FloatingTooltipOffset,
  requested: PlacementVector,
  candidate: PlacementVector,
) {
  return {
    x: requested.x !== candidate.x && requested.x !== 0 ? -offset.x : offset.x,
    y: requested.y !== candidate.y && requested.y !== 0 ? -offset.y : offset.y,
  };
}

function calculatePosition(
  anchor: VirtualAnchor,
  size: TooltipSize,
  placement: FloatingTooltipPlacement,
  offset: FloatingTooltipOffset,
) {
  const { x, y } = PLACEMENT_VECTORS[placement];
  const anchorX = anchor.left + ((x + 1) / 2) * anchor.width;
  const anchorY = anchor.top + ((y + 1) / 2) * anchor.height;
  const tooltipX = ((1 - x) / 2) * size.width;
  const tooltipY = ((1 - y) / 2) * size.height;

  return {
    left: anchorX - tooltipX + offset.x,
    top: anchorY - tooltipY + offset.y,
  };
}

function getOverflowScore(
  position: { left: number; top: number },
  size: TooltipSize,
  bounds: ViewportBounds,
) {
  return (
    Math.max(0, bounds.left - position.left) +
    Math.max(0, position.left + size.width - bounds.right) +
    Math.max(0, bounds.top - position.top) +
    Math.max(0, position.top + size.height - bounds.bottom)
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

export function resolveTooltipPosition({
  anchor,
  size,
  placement,
  offset,
  bounds,
}: {
  anchor: VirtualAnchor;
  size: TooltipSize;
  placement: FloatingTooltipPlacement;
  offset?: FloatingTooltipOffset;
  bounds: ViewportBounds;
}): ResolvedTooltipPosition {
  const requestedVector = PLACEMENT_VECTORS[placement];
  const requestedOffset = offset ?? getDefaultOffset(requestedVector);
  const candidates = getCandidatePlacements(placement).map(
    (candidatePlacement) => {
      const candidateOffset = mirrorOffset(
        requestedOffset,
        requestedVector,
        PLACEMENT_VECTORS[candidatePlacement],
      );
      const position = calculatePosition(
        anchor,
        size,
        candidatePlacement,
        candidateOffset,
      );

      return {
        ...position,
        placement: candidatePlacement,
        overflow: getOverflowScore(position, size, bounds),
      };
    },
  );
  const best = candidates.reduce((current, candidate) =>
    candidate.overflow < current.overflow ? candidate : current,
  );

  return {
    placement: best.placement,
    left: clamp(best.left, bounds.left, bounds.right - size.width),
    top: clamp(best.top, bounds.top, bounds.bottom - size.height),
  };
}
