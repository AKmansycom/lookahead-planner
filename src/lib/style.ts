import type { CSSProperties } from "react";

function toCamel(prop: string): string {
  const p = prop
    .trim()
    .replace(/^-(webkit|moz|o)-/, (_, v: string) => v.charAt(0).toUpperCase() + v.slice(1) + "-")
    .replace(/^-ms-/, "ms-");
  return p.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
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
    const prop = trimmed.slice(0, idx);
    const value = trimmed.slice(idx + 1).trim();
    if (!prop || !value) continue;
    out[toCamel(prop)] = value;
  }
  return out as CSSProperties;
}
