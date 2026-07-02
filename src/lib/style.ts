import type { CSSProperties } from "react";

function toCamel(prop: string): string {
  const p = prop
    .trim()
    .replace(/^-(webkit|moz|o)-/, (_, v: string) => v.charAt(0).toUpperCase() + v.slice(1) + "-")
    .replace(/^-ms-/, "ms-");
  return p.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

const BORDER_SHORTHANDS = new Set(["border", "border-top", "border-right", "border-bottom", "border-left"]);

// React 19 warns (and can misrender) when a shorthand like `border` and a longhand
// like `borderColor` are both present across renders of the same style object — the
// design's base/hover pattern does exactly that (base sets `border`, hover overrides
// `border-color`). Expand border shorthands into width/style/color longhands so the
// merged style object never mixes shorthand and longhand for the same property.
function expandBorderShorthand(prop: string, value: string, out: Record<string, string>) {
  const parts = value.trim().split(/\s+/);
  if (parts.length < 3) {
    out[toCamel(prop)] = value;
    return;
  }
  const [width, style, ...colorParts] = parts;
  const base = toCamel(prop);
  out[`${base}Width`] = width;
  out[`${base}Style`] = style;
  out[`${base}Color`] = colorParts.join(" ");
}

// Parse a CSS declaration string (as used in the design) into a React style object.
// Splits on the first ":" per declaration, so gradient/url commas and parens are preserved.
export function css(styleText: string): CSSProperties {
  const out: Record<string, string> = {};
  for (const decl of styleText.split(";")) {
    const trimmed = decl.trim();
    if (!trimmed) continue;
    const idx = trimmed.indexOf(":");
    if (idx === -1) continue;
    const prop = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!prop || !value) continue;
    if (BORDER_SHORTHANDS.has(prop)) {
      expandBorderShorthand(prop, value, out);
      continue;
    }
    out[toCamel(prop)] = value;
  }
  return out as CSSProperties;
}
