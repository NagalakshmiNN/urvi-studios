"use client";

import { useEffect, useState } from "react";

// Renders as a single <img>, no wrapping element — it sits directly inside
// a .category-card, so the existing `.category-card img` styling (absolute
// fill, cover, opacity) applies unchanged. Cycles through a handful of real
// product photos from that category with a soft crossfade; falls back to
// the static illustration when there are no photos yet to roll through.
export default function RollingCategoryImage({
  images,
  fallback,
  alt,
}: {
  images: string[];
  fallback: string;
  alt: string;
}) {
  const list = images.length > 0 ? images : [fallback];
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (list.length <= 1) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const rotate = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex((i) => (i + 1) % list.length);
        setVisible(true);
      }, 400);
    }, 4000);
    return () => clearInterval(rotate);
    // list.length is stable per page load — only re-run if the category
    // this instance is showing actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.length]);

  return (
    <img
      src={list[index]}
      alt={alt}
      style={{ transition: "opacity 0.4s ease", opacity: visible ? 0.92 : 0 }}
    />
  );
}
