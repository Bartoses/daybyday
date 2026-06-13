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
  primarySoft: "#E8EFE9", // light sage tint for the action block
  accent: "#E8A87C",
  text: "#2B2B2A",
  textMuted: "#6E6A64",
  success: "#5C9A6B",
  warning: "#D9A441",
  danger: "#C2685A",
  border: "#E7E1D8",
  onPrimary: "#FFFFFF",
} as const;

/** Display serif (headlines) + body. Loaded via the web <link> in app/+html.tsx. */
export const fonts = {
  display: 'Fraunces, Georgia, "Times New Roman", serif',
  body: 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif',
} as const;

/** Per-category chip styling for quick visual recognition. */
export const categoryMeta: Record<string, { emoji: string; tint: string; ink: string; label: string }> = {
  sleep: { emoji: "🌙", tint: "#ECEFF7", ink: "#5B6B96", label: "Sleep" },
  feeding: { emoji: "🍽️", tint: "#FAF0E7", ink: "#B0793F", label: "Feeding" },
  development: { emoji: "🌱", tint: "#E9F1EB", ink: "#557159", label: "Development" },
  learning_play: { emoji: "🧩", tint: "#F6F1E1", ink: "#A07F2E", label: "Learning & Play" },
  emotional: { emoji: "💛", tint: "#FBF2E4", ink: "#B5853A", label: "Emotional" },
  behavior: { emoji: "🧭", tint: "#E8F1EF", ink: "#4F8C81", label: "Behavior" },
  safety: { emoji: "🛟", tint: "#F0F0F4", ink: "#6E6A8A", label: "Safety" },
};

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
