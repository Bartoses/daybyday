/**
 * Design tokens — DaybyDay v1 visual language.
 * Warm & calm: coral primary on a warm sand background, navy serif headings,
 * cream cards, peach + sage soft fills. Display serif = Newsreader, UI = Hanken Grotesk.
 */
export const colors = {
  bg: "#E7E2D9", // warm sand app background
  surface: "#FFFFFF", // white cards
  surfaceAlt: "#FAF4EC", // cream cards on warm bg
  primary: "#E07E5F", // coral — primary actions, brand
  primaryPress: "#C9694B", // coral-deep — pressed/hover, links on light
  primarySoft: "#FBEAE0", // peach — coral chips / soft fills
  accent: "#7F9C7B", // sage — success, secondary accent
  accentSoft: "#E8EFE4", // sage tint
  heading: "#233152", // navy — headings, dark surfaces
  text: "#2A2A2E", // ink — body text
  textMuted: "#6E665C", // secondary text
  textFaint: "#8A8276", // tertiary text
  success: "#7F9C7B",
  warning: "#D9A441",
  danger: "#C2685A",
  border: "#EADFCF", // hairlines on cream
  inputBorder: "#E4D9CB", // input outlines
  onPrimary: "#FFFFFF",
} as const;

/** Display serif (headlines) + body. Loaded via the web <link> in app/+html.tsx. */
export const fonts = {
  display: 'Newsreader, Georgia, "Times New Roman", serif',
  body: '"Hanken Grotesk", system-ui, -apple-system, "Segoe UI", sans-serif',
} as const;

/** Per-category chip styling for quick visual recognition. */
export const categoryMeta: Record<
  string,
  { emoji: string; tint: string; ink: string; label: string }
> = {
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
  button: 16,
  buttonSm: 12,
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

/** Soft, low-opacity navy-tinted shadow. Works on web + native. */
export const shadow = {
  shadowColor: "#233152",
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.1,
  shadowRadius: 18,
  elevation: 2,
} as const;

/** Coral-tinted shadow for primary buttons (matches the design's CTA glow). */
export const coralShadow = {
  shadowColor: "#E07E5F",
  shadowOffset: { width: 0, height: 12 },
  shadowOpacity: 0.45,
  shadowRadius: 20,
  elevation: 4,
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
