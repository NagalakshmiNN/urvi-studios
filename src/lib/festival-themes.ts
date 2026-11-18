/** Theme color tokens for each festival theme.
 *  Extracted into its own file so client components can import it
 *  without pulling in the pg database driver.
 */
export const FESTIVAL_THEMES: Record<
  string,
  { primary: string; accent: string; bg: string; bgEnd: string; text: string }
> = {
  gold: {
    primary: "#A98238",
    accent: "#F7F0E4",
    bg: "#3F4827",
    bgEnd: "#51462F",
    text: "#F7F0E4",
  },
  "festive-red": {
    primary: "#C23B22",
    accent: "#FFE4D6",
    bg: "#8B1A1A",
    bgEnd: "#4A0E0E",
    text: "#FFE4D6",
  },
  "sage-green": {
    primary: "#6A7444",
    accent: "#E8EDD4",
    bg: "#3F4827",
    bgEnd: "#2D3618",
    text: "#E8EDD4",
  },
  midnight: {
    primary: "#7C83FF",
    accent: "#E0D6FF",
    bg: "#1A1A2E",
    bgEnd: "#0F3460",
    text: "#E0D6FF",
  },
  /* ── Festival-specific themes ── */
  diwali: {
    primary: "#A98238",
    accent: "#F7F0E4",
    bg: "#3F4827",
    bgEnd: "#51462F",
    text: "#F7F0E4",
  },
  christmas: {
    primary: "#B22222",
    accent: "#FFF5F5",
    bg: "#1B4332",
    bgEnd: "#0B2B1E",
    text: "#FFF5F5",
  },
  sankranti: {
    primary: "#E67E22",
    accent: "#FFF8E7",
    bg: "#1565C0",
    bgEnd: "#0D47A1",
    text: "#FFF8E7",
  },
  navratri: {
    primary: "#C23B22",
    accent: "#FFE4D6",
    bg: "#8B1A1A",
    bgEnd: "#4A0E0E",
    text: "#FFE4D6",
  },
  ugadi: {
    primary: "#6A7444",
    accent: "#E8EDD4",
    bg: "#3F4827",
    bgEnd: "#2D3618",
    text: "#E8EDD4",
  },
};
