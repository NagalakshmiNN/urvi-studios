// Color family groupings for the shop filter.
//
// Instead of showing 30+ individual color chips, the filter shows base
// color families like "Green & Shades" that, when selected, match every
// product whose color name belongs to that family. A product with "Sage
// Green" or "Olive" shows up when the customer picks "Green & Shades".
//
// Colors not in any family show up as their own chip (ungrouped).

export type ColorFamily = {
  /** Display label, e.g. "Green & Shades of Green" */
  label: string;
  /** The key used in the URL query param */
  key: string;
  /** Representative hex for the filter dot */
  hex: string;
  /** Individual color names (case-insensitive) that belong to this family */
  members: string[];
};

/**
 * Canonical color families. Order here is display order in the filter bar.
 * Member matching is case-insensitive.
 */
export const COLOR_FAMILIES: ColorFamily[] = [
  {
    label: "Black",
    key: "black",
    hex: "#222222",
    members: ["Black"],
  },
  {
    label: "White & Off White",
    key: "white",
    hex: "#f5f5f0",
    members: ["White", "Off White", "Cream", "Cream white with green prints"],
  },
  {
    label: "Beige & Neutrals",
    key: "beige",
    hex: "#d4b896",
    members: ["Beige", "Light Brown", "Brown"],
  },
  {
    label: "Green & Shades of Green",
    key: "green",
    hex: "#3F7A3F",
    members: ["Green", "GREEN", "Sage Green", "Olive"],
  },
  {
    label: "Blue & Shades of Blue",
    key: "blue",
    hex: "#3366AA",
    members: ["Blue", "Light Blue", "Sky Blue", "Navy Blue", "Navy blue with pink flower"],
  },
  {
    label: "Pink & Shades of Pink",
    key: "pink",
    hex: "#E88DAE",
    members: ["Pink", "Rani Pink", "Magenta", "Berry", "Peach"],
  },
  {
    label: "Red & Maroon",
    key: "red",
    hex: "#CC3333",
    members: ["Red", "Maroon"],
  },
  {
    label: "Yellow & Mustard",
    key: "yellow",
    hex: "#D4A017",
    members: ["Yellow", "Light Yellow", "Mustard"],
  },
  {
    label: "Grey & Lavender",
    key: "grey",
    hex: "#999999",
    members: ["Grey", "Lavender"],
  },
];

/**
 * Given all the individual color names present in the current product set,
 * return the families that have at least one member present, plus any
 * ungrouped colors as standalone entries.
 */
export function buildColorFamilyOptions(
  individualColors: Map<string, string>
): { key: string; label: string; hex: string; memberNames: string[] }[] {
  const claimed = new Set<string>();
  const result: { key: string; label: string; hex: string; memberNames: string[] }[] = [];

  for (const family of COLOR_FAMILIES) {
    const present = family.members.filter((m) =>
      Array.from(individualColors.keys()).some((k) => k.toLowerCase() === m.toLowerCase())
    );
    if (present.length > 0) {
      result.push({
        key: family.key,
        label: present.length === 1 ? present[0] : family.label,
        hex: family.hex,
        memberNames: present,
      });
      present.forEach((p) => claimed.add(p.toLowerCase()));
    }
  }

  // Any color not claimed by a family shows on its own
  for (const [name, hex] of individualColors) {
    if (!claimed.has(name.toLowerCase())) {
      result.push({ key: name, label: name, hex, memberNames: [name] });
    }
  }

  return result;
}

/**
 * Given the selected family keys from the URL, return all the individual
 * color names they expand to (for filtering products).
 */
export function expandColorSelection(selectedKeys: string[]): string[] {
  const names: string[] = [];
  for (const key of selectedKeys) {
    const family = COLOR_FAMILIES.find((f) => f.key === key);
    if (family) {
      names.push(...family.members);
    } else {
      // Standalone color — the key IS the color name
      names.push(key);
    }
  }
  return names;
}
