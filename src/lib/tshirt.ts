const SIZE_ORDER = ["XXXXL", "XXXL", "XXL", "XL", "XXXS", "XXS", "XS", "S", "M", "L"];
const SIZE_LABEL_MAP: Record<string, string> = {
  XXXS: "3XS",
  XXS: "2XS",
  XXL: "2XL",
  XXXL: "3XL",
  XXXXL: "4XL",
};

/**
 * Extract size category from T-Shirt Size values like "L-42", "S-38", "XXL-48", "Select"
 * Returns normalized size: XS | S | M | L | XL | XXL | XXXL | null
 */
export function extractTshirtSizeCategory(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  const s = String(raw).trim().toUpperCase();
  if (!s || s === "SELECT") return null;
  // Match longest first (XXXL, XXL, XL, XS, then S, M, L)
  for (const size of SIZE_ORDER) {
    if (s.startsWith(size) || s === size) return size;
  }
  // Fallback: take part before hyphen if present
  const beforeHyphen = s.split(/[-–]/)[0]?.trim();
  if (beforeHyphen && SIZE_ORDER.includes(beforeHyphen)) return beforeHyphen;
  // Single letter
  if (["S", "M", "L"].includes(s[0] ?? "")) return s[0];
  return null;
}

export const TSHIRT_SIZES = ["XXXS", "XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL", "XXXXL"] as const;

export function getTshirtSizeLabel(size: string | null | undefined): string {
  if (!size) return "";
  return SIZE_LABEL_MAP[size] ?? size;
}

export function formatTshirtSizeForDisplay(raw: string | null | undefined): string {
  if (!raw) return "";
  const text = String(raw);
  const normalized = text.toUpperCase();
  // Replace longer keys first to avoid partial replacement collisions.
  const orderedKeys = Object.keys(SIZE_LABEL_MAP).sort((a, b) => b.length - a.length);
  for (const key of orderedKeys) {
    if (normalized.includes(key)) {
      return text.replace(new RegExp(key, "ig"), SIZE_LABEL_MAP[key]);
    }
  }
  return text;
}

export type TshirtInventory = Record<string, number>;

export function getDefaultTshirtInventory(): TshirtInventory {
  return {
    XXXS: 0,
    XXS: 0,
    XS: 0,
    S: 0,
    M: 0,
    L: 0,
    XL: 0,
    XXL: 0,
    XXXL: 0,
    XXXXL: 0,
  };
}
