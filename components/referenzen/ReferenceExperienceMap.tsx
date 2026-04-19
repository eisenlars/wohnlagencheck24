"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import type { Map as MapLibreMap, Marker as MapLibreMarker, LngLatBoundsLike } from "maplibre-gl";

import type { RegionalReference } from "@/lib/referenzen";

const OPEN_FREE_MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/bright";

type ReferenceExperienceMapProps = {
  items: RegionalReference[];
  heading?: string;
  intro?: string;
};

type ReferenceMapCanvasProps = {
  items: RegionalReference[];
  activeId: string | null;
  interactive?: boolean;
  onSelect?: (item: RegionalReference) => void;
  className?: string;
};

function buildFacts(item: RegionalReference): string[] {
  return [
    item.statusBadge,
    item.objectType,
    item.rooms != null ? `${item.rooms} Zi.` : null,
    item.areaSqm != null ? `${item.areaSqm} m²` : null,
    item.locationText,
  ].filter(Boolean) as string[];
}

function focusMap(map: MapLibreMap, items: RegionalReference[], activeId: string | null, interactive: boolean) {
  if (items.length === 0) return;

  const activeItem = items.find((item) => item.id === activeId) ?? items[0];
  if (!activeItem) return;

  if (!interactive) {
    map.easeTo({
      center: [activeItem.lng ?? 0, activeItem.lat ?? 0],
      zoom: 13.8,
      duration: 500,
      essential: true,
    });
    return;
  }

  if (items.length === 1) {
    map.easeTo({
      center: [activeItem.lng ?? 0, activeItem.lat ?? 0],
      zoom: 13.2,
      duration: 500,
      essential: true,
    });
    return;
  }

  const bounds = items.reduce(
    (acc, item) => {
      if (item.lng == null || item.lat == null) return acc;
      if (!acc) return [[item.lng, item.lat], [item.lng, item.lat]] as LngLatBoundsLike;
      const [[minLng, minLat], [maxLng, maxLat]] = acc as [[number, number], [number, number]];
      return [
        [Math.min(minLng, item.lng), Math.min(minLat, item.lat)],
        [Math.max(maxLng, item.lng), Math.max(maxLat, item.lat)],
      ] as LngLatBoundsLike;
    },
    null as LngLatBoundsLike | null,
  );

  if (!bounds) return;
  map.fitBounds(bounds, {
    padding: { top: 56, right: 56, bottom: 56, left: 56 },
    maxZoom: 12.8,
    duration: 550,
    essential: true,
  });
}

function ReferenceMapCanvas(props: ReferenceMapCanvasProps) {
  const { items, activeId, interactive = true, onSelect, className } = props;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<MapLibreMarker[]>([]);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setMapReady(false);

    async function initMap() {
      if (!containerRef.current || mapRef.current) return;
      const maplibregl = await import("maplibre-gl");
      if (cancelled || !containerRef.current || mapRef.current) return;

      const seed = items[0];
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: OPEN_FREE_MAP_STYLE_URL,
        center: [seed?.lng ?? 13.74, seed?.lat ?? 51.05],
        zoom: 11.8,
        attributionControl: false,
        dragRotate: false,
        pitchWithRotate: false,
      });

      map.addControl(
        new maplibregl.AttributionControl({
          compact: true,
          customAttribution: [
            '<a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a>',
            '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>',
          ],
        }),
        "bottom-left",
      );

      if (!interactive) {
        map.scrollZoom.disable();
        map.dragPan.disable();
        map.boxZoom.disable();
        map.doubleClickZoom.disable();
        map.touchZoomRotate.disable();
        map.keyboard.disable();
      }

      mapRef.current = map;
      map.on("load", () => {
        if (cancelled) return;
        setMapReady(true);
        focusMap(map, items, null, interactive);
      });
    }

    void initMap();
    return () => {
      cancelled = true;
      for (const marker of markersRef.current) marker.remove();
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [interactive, items]);

  useEffect(() => {
    if (!mapRef.current || !mapReady) return;

    for (const marker of markersRef.current) marker.remove();
    markersRef.current = [];

    let cancelled = false;
    void import("maplibre-gl").then((maplibregl) => {
      if (cancelled || !mapRef.current) return;
      for (const item of items) {
        if (item.lng == null || item.lat == null) continue;
        const button = document.createElement("button");
        button.type = "button";
        button.className = `reference-experience-map__marker${item.id === activeId ? " is-active" : ""}${onSelect ? "" : " is-static"}`;
        button.setAttribute("aria-label", item.title);
        if (!onSelect) {
          button.tabIndex = -1;
          button.setAttribute("aria-hidden", "true");
        }
        button.innerHTML = `<span class="reference-experience-map__marker-pin"><img src="/logo/wohnlagencheck24.svg" alt="" /></span>`;
        button.addEventListener("click", () => onSelect?.(item));
        const marker = new maplibregl.Marker({
          element: button,
          anchor: "bottom",
        })
          .setLngLat([item.lng, item.lat])
          .addTo(mapRef.current);
        markersRef.current.push(marker);
      }
      focusMap(mapRef.current, items, activeId, interactive);
    });

    return () => {
      cancelled = true;
    };
  }, [activeId, interactive, items, mapReady, onSelect]);

  return <div ref={containerRef} className={className ?? "reference-experience-map__canvas"} />;
}

export function ReferenceExperienceMap(props: ReferenceExperienceMapProps) {
  const {
    items,
    heading = "Vermittlungserfahrung in der Region",
    intro = "Diese Referenzen zeigen, dass der Makler bei vergleichbaren Immobilien in dieser Objektart bereits aktiv vermittelt hat.",
  } = props;
  const safeItems = useMemo(() => items.filter((item) => item.lat != null && item.lng != null), [items]);
  const [activeId, setActiveId] = useState<string | null>(safeItems[0]?.id ?? null);
  const [modalId, setModalId] = useState<string | null>(null);
  const effectiveActiveId = useMemo(() => {
    if (modalId && safeItems.some((item) => item.id === modalId)) return modalId;
    if (activeId && safeItems.some((item) => item.id === activeId)) return activeId;
    return safeItems[0]?.id ?? null;
  }, [activeId, modalId, safeItems]);
  const modalReference = safeItems.find((item) => item.id === modalId) ?? null;

  useEffect(() => {
    if (!modalReference) return undefined;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setModalId(null);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [modalReference]);

  if (safeItems.length === 0) return null;

  const activeReference = safeItems.find((item) => item.id === effectiveActiveId) ?? safeItems[0];
  const openReference = (item: RegionalReference) => {
    setActiveId(item.id);
    setModalId(item.id);
  };

  return (
    <section className="reference-experience">
      <div className="reference-experience__intro">
        <div className="reference-experience__eyebrow">Maklererfahrung</div>
        <div>
          <h2 className="reference-experience__title">{heading}</h2>
          <p className="reference-experience__copy">{intro}</p>
        </div>
      </div>

      <div className="reference-experience__map-shell">
        <ReferenceMapCanvas
          items={safeItems}
          activeId={activeReference?.id ?? null}
          onSelect={openReference}
          className="reference-experience-map__canvas"
        />
      </div>

      <div className="reference-experience__legend">
        <span>{safeItems.length} passende Referenzen im aktuellen Gebietsausschnitt</span>
        <span>Pin anklicken, um ein Referenzbeispiel zu öffnen</span>
      </div>

      {modalReference ? (
        <div
          className="reference-experience-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`reference-experience-modal-title-${modalReference.id}`}
          onClick={() => setModalId(null)}
        >
          <div className="reference-experience-modal__card" onClick={(event) => event.stopPropagation()}>
            <div className="reference-experience-modal__header">
              <div>
                <div className="reference-experience__eyebrow">Referenz</div>
                <h3
                  className="reference-experience-modal__title"
                  id={`reference-experience-modal-title-${modalReference.id}`}
                >
                  {modalReference.title}
                </h3>
              </div>
              <button
                type="button"
                className="reference-experience-modal__close"
                onClick={() => setModalId(null)}
                aria-label="Referenz schließen"
              >
                ×
              </button>
            </div>

            <div className="reference-experience-modal__map">
              <ReferenceMapCanvas
                items={safeItems}
                activeId={modalReference.id}
                interactive={false}
                className="reference-experience-map__canvas reference-experience-map__canvas--modal"
              />
            </div>

            <div className="reference-experience-modal__content">
              <div className="reference-experience-modal__image">
                {modalReference.imageUrl ? (
                  <Image
                    src={modalReference.imageUrl}
                    alt={modalReference.title}
                    fill
                    sizes="(max-width: 900px) 100vw, 320px"
                    quality={68}
                    style={{ objectFit: "cover" }}
                  />
                ) : (
                  <div className="reference-experience-modal__image-placeholder">Keine Referenzabbildung</div>
                )}
              </div>

              <div className="reference-experience-modal__copy">
                {buildFacts(modalReference).length > 0 ? (
                  <p className="reference-experience-modal__facts">{buildFacts(modalReference).join(" · ")}</p>
                ) : null}
                <p className="reference-experience-modal__description">
                  {modalReference.description || "Erfolgreich vermittelte Immobilie aus der Region."}
                </p>
                {modalReference.challengeText ? (
                  <div className="reference-experience-modal__challenge">
                    <div className="reference-experience-modal__challenge-title">Herausforderung</div>
                    <p>{modalReference.challengeText}</p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
