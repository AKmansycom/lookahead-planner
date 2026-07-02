"use client";

import { useState, CSSProperties, ReactNode, ElementType } from "react";
import { css } from "@/lib/style";

// Mirrors the design's `style` + `style-hover` pattern: a base style with an
// overlay applied while hovered. Both are CSS declaration strings.
export function HoverCard({
  base,
  hover,
  as = "div",
  children,
  onClick,
  extra,
  title,
}: {
  base: string;
  hover: string;
  as?: ElementType;
  children: ReactNode;
  onClick?: () => void;
  extra?: CSSProperties;
  title?: string;
}) {
  const [h, setH] = useState(false);
  const Tag = as;
  const style: CSSProperties = { ...css(base), ...(h ? css(hover) : {}), ...extra };
  return (
    <Tag
      style={style}
      title={title}
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
    >
      {children}
    </Tag>
  );
}
