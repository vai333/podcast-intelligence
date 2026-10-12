import { describe, expect, it } from "vitest";
import { dark, light, type Palette } from "./tokens";

function channel(c: number) {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}
function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}
export function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// [foreground token, background token] pairs that carry text and must reach 4.5:1.
const textPairs: [keyof Palette, keyof Palette][] = [
  ["fg", "bg"],
  ["fg", "surface"],
  ["fg", "surface2"],
  ["muted", "bg"],
  ["muted", "surface"],
  ["muted", "surface2"],
  ["accent", "surface"],
  ["accent", "bg"],
  ["accent", "surface2"],
  ["accentSoftFg", "surface"],
  ["accentFg", "accent"],
  ["accentSoftFg", "accentSoft"],
  ["success", "successSoft"],
  ["warn", "warnSoft"],
  ["danger", "dangerSoft"],
  ["info", "infoSoft"],
  ["success", "surface"],
  ["danger", "surface"],
];

describe.each([
  ["light", light],
  ["dark", dark],
])("%s palette contrast", (_name, p) => {
  it.each(textPairs)("%s on %s reaches 4.5:1", (fg, bg) => {
    expect(contrast(p[fg], p[bg])).toBeGreaterThanOrEqual(4.5);
  });
});
