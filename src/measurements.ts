export type DisplayUnit = "mm" | "cm";

export function formatLength(millimeters: number, unit: DisplayUnit): string {
  const value = unit === "cm" ? millimeters / 10 : millimeters;
  return `${Number(value.toPrecision(4)).toLocaleString("ja-JP", { maximumSignificantDigits: 4 })} ${unit}`;
}

// Round grid spacing up to a readable 1, 2 or 5 × power of ten in millimeters.
export function gridSpacing(radius: number): number {
  const target = (radius * 3) / 20;
  const magnitude = 10 ** Math.floor(Math.log10(target));
  const fraction = target / magnitude;
  return (
    (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * magnitude
  );
}
