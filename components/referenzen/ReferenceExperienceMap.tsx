"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import type { Map as MapLibreMap, Marker as MapLibreMarker, LngLatBoundsLike } from "maplibre-gl";

import type { RegionalReference } from "@/lib/referenzen";

const OPEN_FREE_MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/bright";
const BUILDINGS_LAYER_ID = "wc24-reference-3d-buildings";
const DEFAULT_BEARING = -18;
type ReferenceMapViewMode = "2d" | "3d";

type ReferenceExperienceMapProps = {
  items: RegionalReference[];
  heading?: string;
  intro?: string;
  enable3dToggle?: boolean;
  initialViewMode?: ReferenceMapViewMode;
};

type ReferenceMapCanvasProps = {
  items: RegionalReference[];
  activeId: string | null;
  interactive?: boolean;
  onSelect?: (item: RegionalReference) => void;
  className?: string;
  enable3dToggle?: boolean;
  initialViewMode?: ReferenceMapViewMode;
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

function setBuildingExtrusions(map: MapLibreMap, enabled: boolean) {
  const layer = map.getLayer(BUILDINGS_LAYER_ID);
  if (!layer) return;
  map.setLayoutProperty(BUILDINGS_LAYER_ID, "visibility", enabled ? "visible" : "none");
}

function ensureBuildingExtrusions(map: MapLibreMap, enabled: boolean) {
  if (map.getLayer(BUILDINGS_LAYER_ID)) return;

  const style = map.getStyle();
  const layers = style.layers ?? [];
  const firstSymbolLayer = layers.find((layer) => layer.type === "symbol");
  const firstFillExtrusionLayer = layers.find((layer) => layer.type === "fill-extrusion");
  const candidateLayer = firstFillExtrusionLayer
    ?? [...layers].reverse().find((layer) => {
      const sourceLayer = "source-layer" in layer ? layer["source-layer"] : undefined;
      return typeof sourceLayer === "string" && sourceLayer.toLowerCase().includes("building");
    });

  if (!candidateLayer || !("source" in candidateLayer)) return;

  const source = candidateLayer.source;
  const sourceLayer = "source-layer" in candidateLayer ? candidateLayer["source-layer"] : undefined;
  if (typeof source !== "string" || typeof sourceLayer !== "string") return;

  map.addLayer(
    {
      id: BUILDINGS_LAYER_ID,
      type: "fill-extrusion",
      source,
      "source-layer": sourceLayer,
      minzoom: 12,
      layout: {
        visibility: enabled ? "visible" : "none",
      },
      paint: {
        "fill-extrusion-color": "#9fb5a8",
        "fill-extrusion-height": [
          "coalesce",
          ["to-number", ["get", "render_height"]],
          ["to-number", ["get", "height"]],
          16,
        ],
        "fill-extrusion-base": [
          "coalesce",
          ["to-number", ["get", "render_min_height"]],
          ["to-number", ["get", "min_height"]],
          0,
        ],
        "fill-extrusion-opacity": 0.72,
      },
    },
    firstSymbolLayer?.id,
  );
}

function getViewOptions(is3dEnabled: boolean) {
  return {
    pitch: is3dEnabled ? 58 : 0,
    bearing: is3dEnabled ? DEFAULT_BEARING : 0,
  };
}

function focusMap(
  map: MapLibreMap,
  items: RegionalReference[],
  activeId: string | null,
  interactive: boolean,
  is3dEnabled: boolean,
) {
  if (items.length === 0) return;

  const activeItem = items.find((item) => item.id === activeId) ?? items[0];
  if (!activeItem) return;
  const viewOptions = getViewOptions(is3dEnabled);

  if (!interactive) {
    map.easeTo({
      center: [activeItem.lng ?? 0, activeItem.lat ?? 0],
      zoom: is3dEnabled ? 15.4 : 13.8,
      ...viewOptions,
      duration: 500,
      essential: true,
    });
    return;
  }

  if (items.length === 1) {
    map.easeTo({
      center: [activeItem.lng ?? 0, activeItem.lat ?? 0],
      zoom: is3dEnabled ? 15.2 : 13.2,
      ...viewOptions,
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
    maxZoom: is3dEnabled ? 15.2 : 12.8,
    duration: 550,
    essential: true,
  });
  map.easeTo({
    ...viewOptions,
    duration: 550,
    essential: true,
  });
}

function ReferenceMapCanvas(props: ReferenceMapCanvasProps) {
  const {
    items,
    activeId,
    interactive = true,
    onSelect,
    className,
    enable3dToggle = false,
    initialViewMode = "2d",
  } = props;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<MapLibreMarker[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [viewMode, setViewMode] = useState<ReferenceMapViewMode>(initialViewMode);
  const is3dEnabled = enable3dToggle && viewMode === "3d";

  useEffect(() => {
    let cancelled = false;
    setMapReady(false);
    const initial3dEnabled = enable3dToggle && initialViewMode === "3d";
    const initialViewOptions = getViewOptions(initial3dEnabled);

    async function initMap() {
      if (!containerRef.current || mapRef.current) return;
      const maplibregl = await import("maplibre-gl");
      if (cancelled || !containerRef.current || mapRef.current) return;

      const seed = items[0];
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: OPEN_FREE_MAP_STYLE_URL,
        center: [seed?.lng ?? 13.74, seed?.lat ?? 51.05],
        zoom: initial3dEnabled ? 14.2 : 11.8,
        attributionControl: false,
        dragRotate: false,
        pitchWithRotate: false,
        touchZoomRotate: true,
        ...initialViewOptions,
      });

      map.keyboard.disableRotation();
      map.touchPitch.disable();
      map.touchZoomRotate.disableRotation();
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
        ensureBuildingExtrusions(map, initial3dEnabled);
        setMapReady(true);
        focusMap(map, items, null, interactive, initial3dEnabled);
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
  }, [enable3dToggle, initialViewMode, interactive, items]);

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
      focusMap(mapRef.current, items, activeId, interactive, is3dEnabled);
    });

    return () => {
      cancelled = true;
    };
  }, [activeId, interactive, is3dEnabled, items, mapReady, onSelect]);

  useEffect(() => {
    if (!mapRef.current || !mapReady) return;
    ensureBuildingExtrusions(mapRef.current, is3dEnabled);
    setBuildingExtrusions(mapRef.current, is3dEnabled);
    mapRef.current.easeTo({
      ...getViewOptions(is3dEnabled),
      duration: 650,
      essential: true,
    });
  }, [is3dEnabled, mapReady]);

  return (
    <>
      {enable3dToggle ? (
        <button
          type="button"
          className={`reference-experience-map__toggle${is3dEnabled ? " is-active" : ""}`}
          onClick={() => setViewMode((current) => (current === "3d" ? "2d" : "3d"))}
          aria-pressed={is3dEnabled}
        >
          {is3dEnabled ? "2D" : "3D"}
        </button>
      ) : null}
      <div ref={containerRef} className={className ?? "reference-experience-map__canvas"} />
    </>
  );
}

export function ReferenceExperienceMap(props: ReferenceExperienceMapProps) {
  const {
    items,
    heading = "Vermittlungserfahrung in der Region",
    intro = "Diese Referenzen zeigen, dass der Makler bei vergleichbaren Immobilien in dieser Objektart bereits aktiv vermittelt hat.",
    enable3dToggle = false,
    initialViewMode = "2d",
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
          enable3dToggle={enable3dToggle}
          initialViewMode={initialViewMode}
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
                enable3dToggle={false}
                initialViewMode={initialViewMode}
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
