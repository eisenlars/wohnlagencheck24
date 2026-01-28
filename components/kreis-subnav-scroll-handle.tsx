"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type KreisSubnavScrollHandleProps = {
  targetId: string;
};

export function KreisSubnavScrollHandle({ targetId }: KreisSubnavScrollHandleProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [thumbWidth, setThumbWidth] = useState(0);
  const [thumbLeft, setThumbLeft] = useState(0);
  const targetRef = useRef<HTMLElement | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);
  const pointerStartX = useRef<number | null>(null);
  const scrollStartLeft = useRef<number>(0);
  const thumbStartLeft = useRef<number>(0);

  const className = useMemo(() => {
    return `kreis-subnav-scroll-handle${isActive ? " is-active" : ""}`;
  }, [isActive]);

  useEffect(() => {
    const target = document.getElementById(targetId);
    if (!target) return;

    targetRef.current = target;

    const updateVisibility = () => {
      const needsScroll = target.scrollWidth > target.clientWidth + 1;
      setIsVisible(needsScroll);
    };

    updateVisibility();

    const resizeObserver = new ResizeObserver(updateVisibility);
    resizeObserver.observe(target);

    window.addEventListener("resize", updateVisibility);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateVisibility);
    };
  }, [targetId]);

  useEffect(() => {
    if (!isVisible) return;
    const target = targetRef.current;
    if (!target) return;

    const updateThumb = () => {
      const rail = railRef.current;
      if (!rail) return;

      const total = target.scrollWidth;
      const visible = target.clientWidth;
      const maxScroll = Math.max(1, total - visible);

      const railWidth = rail.clientWidth;
      const ratio = visible / total;
      const nextThumbWidth = Math.max(48, Math.floor(railWidth * ratio));
      const maxThumbLeft = Math.max(0, railWidth - nextThumbWidth);
      const nextThumbLeft = Math.min(
        maxThumbLeft,
        Math.max(0, (target.scrollLeft / maxScroll) * maxThumbLeft),
      );

      setThumbWidth(nextThumbWidth);
      setThumbLeft(nextThumbLeft);
    };

    updateThumb();
    target.addEventListener("scroll", updateThumb, { passive: true });
    window.addEventListener("resize", updateThumb);

    return () => {
      target.removeEventListener("scroll", updateThumb);
      window.removeEventListener("resize", updateThumb);
    };
  }, [isVisible]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const target = targetRef.current;
    const rail = railRef.current;
    if (!target) return;
    if (!rail) return;

    event.preventDefault();
    pointerStartX.current = event.clientX;
    scrollStartLeft.current = target.scrollLeft;
    thumbStartLeft.current = thumbLeft;
    setIsActive(true);
  };

  useEffect(() => {
    if (!isActive) return;

    const onPointerMove = (event: PointerEvent) => {
      const target = targetRef.current;
      const rail = railRef.current;
      if (!target || pointerStartX.current === null) return;
      if (!rail) return;

      const delta = event.clientX - pointerStartX.current;
      const railWidth = rail.clientWidth;
      const maxThumbLeft = Math.max(0, railWidth - Math.max(48, thumbWidth));
      const nextThumbLeft = Math.min(
        maxThumbLeft,
        Math.max(0, thumbStartLeft.current + delta),
      );
      const total = target.scrollWidth;
      const visible = target.clientWidth;
      const maxScroll = Math.max(1, total - visible);
      const scrollLeft = (nextThumbLeft / Math.max(1, maxThumbLeft)) * maxScroll;

      target.scrollLeft = scrollLeft;
      setThumbLeft(nextThumbLeft);
    };

    const onPointerUp = () => {
      pointerStartX.current = null;
      setIsActive(false);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [isActive]);

  if (!isVisible) return null;

  return (
    <div
      className={className}
      ref={railRef}
      role="presentation"
      onPointerDown={handlePointerDown}
    >
      <div
        className="kreis-subnav-scroll-thumb"
        style={{ width: `${thumbWidth}px`, transform: `translateX(${thumbLeft}px)` }}
      />
    </div>
  );
}
