"use client";

import React, { useEffect, useState } from "react";

type BundeslandHeroSlideshowProps = {
  slides: string[];
};

export function BundeslandHeroSlideshow({ slides }: BundeslandHeroSlideshowProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(max-width: 767.98px)");
    const updateIsMobile = () => setIsMobile(mediaQuery.matches);

    updateIsMobile();

    if ("addEventListener" in mediaQuery) {
      mediaQuery.addEventListener("change", updateIsMobile);
      return () => mediaQuery.removeEventListener("change", updateIsMobile);
    }

    mediaQuery.addListener(updateIsMobile);
    return () => mediaQuery.removeListener(updateIsMobile);
  }, []);

  if (isMobile) return null;

  return (
    <div className="region-hero-slideshow" aria-hidden="true">
      {slides.map((src, index) => (
        <div
          key={`${src}-${index}`}
          className="region-hero-slide"
          style={{
            backgroundImage: `url(${src})`,
            animationDelay: `${index * 10}s`,
          }}
        />
      ))}
    </div>
  );
}
