"use client";

import React, { useEffect, useRef, useState } from "react";

type NeedleRotateEnterProps = {
  cx: number;
  cy: number;
  targetAngle: number;
  overshootAngle: number;
  durationMs?: number;
  animateOnVisible?: boolean;
  threshold?: number;
  rootMargin?: string;
  children: React.ReactNode;
};

export function NeedleRotateEnter(props: NeedleRotateEnterProps) {
  const {
    cx,
    cy,
    targetAngle,
    overshootAngle,
    durationMs = 900,
    animateOnVisible = false,
    threshold = 0.35,
    rootMargin = "0px 0px -10% 0px",
    children,
  } = props;

  const ref = useRef<SVGGElement | null>(null);
  const [entered, setEntered] = useState(!animateOnVisible);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", update);
      return () => media.removeEventListener("change", update);
    }
    media.addListener(update);
    return () => media.removeListener(update);
  }, []);

  useEffect(() => {
    if (!animateOnVisible || entered) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      const raf = window.requestAnimationFrame(() => setEntered(true));
      return () => window.cancelAnimationFrame(raf);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setEntered(true);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold, rootMargin },
    );

    const observeTarget = el.ownerSVGElement ?? el;
    observer.observe(observeTarget);
    return () => observer.disconnect();
  }, [animateOnVisible, entered, threshold, rootMargin]);

  const currentAngle = reducedMotion ? targetAngle : 0;
  const shouldAnimate = entered && !reducedMotion;

  return (
    <g ref={ref} transform={`rotate(${currentAngle} ${cx} ${cy})`}>
      {shouldAnimate ? (
        <animateTransform
          attributeName="transform"
          type="rotate"
          dur={`${durationMs}ms`}
          calcMode="spline"
          keyTimes="0;0.78;1"
          keySplines="0.22 1 0.36 1;0.22 1 0.36 1"
          values={`0 ${cx} ${cy}; ${overshootAngle} ${cx} ${cy}; ${targetAngle} ${cx} ${cy}`}
          fill="freeze"
        />
      ) : null}
      {children}
    </g>
  );
}
