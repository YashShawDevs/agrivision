export const FIELD_CENTER: [number, number] = [19.076, 72.8777];
export const FIELD_LABEL = "Mumbai, Maharashtra";

export function buildFallbackWeedWaypoints(): [number, number][] {
  return Array.from({ length: 6 }, (_, i) => [
    FIELD_CENTER[0] + (Math.floor(i / 3) - 0.5) * 0.00054,
    FIELD_CENTER[1] + ((i % 3) - 1.0) * 0.00054,
  ]);
}
