/**
 * Design tokens — ported from docs/04-DESIGN-SYSTEM.md.
 * Brand: friendly, premium, calm. Sage green + warm peach on warm off-white.
 */
export const colors = {
  bg: "#FBF9F6",
  surface: "#FFFFFF",
  surfaceAlt: "#F3EFE9",
  primary: "#6B8F71",
  primaryPress: "#557159",
  accent: "#E8A87C",
  text: "#2B2B2A",
  textMuted: "#6E6A64",
  success: "#5C9A6B",
  warning: "#D9A441",
  danger: "#C2685A",
  border: "#E7E1D8",
  onPrimary: "#FFFFFF",
} as const;

/** 4-pt spacing grid. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  card: 20,
  button: 14,
  pill: 999,
} as const;

export const font = {
  display: 32,
  title: 24,
  heading: 20,
  body: 16,
  small: 14,
  tiny: 12,
} as const;

/** Soft shadow (y2 blur8 ~8%). Works on web + native. */
export const shadow = {
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 8,
  elevation: 2,
} as const;

/** Human-friendly labels for the content categories. */
export const categoryLabels: Record<string, string> = {
  sleep: "Sleep",
  feeding: "Feeding",
  development: "Development",
  learning_play: "Learning & Play",
  emotional: "Emotional",
  behavior: "Behavior",
  safety: "Safety",
};
