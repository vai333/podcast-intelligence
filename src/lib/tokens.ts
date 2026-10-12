// Mirror of the CSS variables in globals.css, used by the contrast test.
// If you change a token in globals.css, change it here too (the test fails on bad contrast).
export const light = {
  bg: "#fafaf9",
  surface: "#ffffff",
  surface2: "#f4f4f2",
  fg: "#1c1917",
  muted: "#57534e",
  accent: "#c2410c",
  accentFg: "#ffffff",
  accentSoft: "#ffedd5",
  accentSoftFg: "#9a3412",
  success: "#137333",
  successSoft: "#e6f4ea",
  warn: "#8a5300",
  warnSoft: "#fef3d6",
  danger: "#b3261e",
  dangerSoft: "#fce8e6",
  info: "#0b57d0",
  infoSoft: "#e8f0fe",
};

export const dark = {
  bg: "#0a0a0b",
  surface: "#111113",
  surface2: "#1a1a1d",
  fg: "#f5f5f4",
  muted: "#a1a1a8",
  accent: "#ff6a2b",
  accentFg: "#0a0a0b",
  accentSoft: "#2b1710",
  accentSoftFg: "#ff9a6b",
  success: "#4ade80",
  successSoft: "#12281a",
  warn: "#fbbf24",
  warnSoft: "#2e2408",
  danger: "#ff7b72",
  dangerSoft: "#2d1412",
  info: "#7cb4ff",
  infoSoft: "#101c2e",
};

export type Palette = typeof light;
