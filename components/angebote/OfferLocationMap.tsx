'use client';

import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap, Marker as MapLibreMarker } from "maplibre-gl";

const OPEN_FREE_MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/bright";
const BUILDINGS_LAYER_ID = "wc24-3d-buildings";
const DEFAULT_BEARING = -18;
const EXACT_2D_ZOOM = 15.2;
const APPROXIMATE_2D_ZOOM = 12.8;
const EXACT_3D_ZOOM = 17.2;
const APPROXIMATE_3D_ZOOM = 15.8;

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

type OfferLocationMapProps = {
  lat: number;
  lng: number;
  approximate: boolean;
  resetToken: number;
};

export function OfferLocationMap(props: OfferLocationMapProps) {
  const { lat, lng, approximate, resetToken } = props;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<MapLibreMarker | null>(null);
  const [is3dEnabled, setIs3dEnabled] = useState(true);
  const initialZoom = is3dEnabled
    ? (approximate ? APPROXIMATE_3D_ZOOM : EXACT_3D_ZOOM)
    : (approximate ? APPROXIMATE_2D_ZOOM : EXACT_2D_ZOOM);
  const initialPitch = is3dEnabled ? 58 : 0;
  const initialBearing = is3dEnabled ? DEFAULT_BEARING : 0;

  useEffect(() => {
    let cancelled = false;

    async function initMap() {
      if (!containerRef.current || mapRef.current) return;

      const maplibregl = await import("maplibre-gl");
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: OPEN_FREE_MAP_STYLE_URL,
        center: [lng, lat],
        zoom: initialZoom,
        attributionControl: false,
        dragRotate: false,
        pitchWithRotate: false,
        touchZoomRotate: true,
        bearing: initialBearing,
        pitch: initialPitch,
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

      map.on("load", () => {
        ensureBuildingExtrusions(map, is3dEnabled);
      });

      if (!approximate) {
        const markerElement = document.createElement("div");
        markerElement.className = "offer-detail-map-marker";
        const logo = document.createElement("img");
        logo.src = "/logo/wohnlagencheck24.svg";
        logo.alt = "";
        markerElement.appendChild(logo);
        markerRef.current = new maplibregl.Marker({
          element: markerElement,
          anchor: "bottom",
        })
          .setLngLat([lng, lat])
          .addTo(map);
      }

      mapRef.current = map;
    }

    void initMap();

    return () => {
      cancelled = true;
      markerRef.current?.remove();
      markerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [approximate, initialBearing, initialPitch, initialZoom, is3dEnabled, lat, lng]);

  useEffect(() => {
    if (!mapRef.current) return;
    ensureBuildingExtrusions(mapRef.current, is3dEnabled);
    setBuildingExtrusions(mapRef.current, is3dEnabled);
    mapRef.current.easeTo({
      pitch: is3dEnabled ? 58 : 0,
      bearing: is3dEnabled ? DEFAULT_BEARING : 0,
      duration: 650,
      essential: true,
    });
  }, [is3dEnabled]);

  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.flyTo({
      center: [lng, lat],
      zoom: initialZoom,
      pitch: is3dEnabled ? 58 : 0,
      bearing: is3dEnabled ? DEFAULT_BEARING : 0,
      essential: true,
      duration: 650,
    });
    markerRef.current?.setLngLat([lng, lat]);
  }, [initialZoom, is3dEnabled, lat, lng, resetToken]);

  return (
    <div className="offer-detail-map-surface">
      <button
        type="button"
        className={`offer-detail-map-toggle${is3dEnabled ? " is-active" : ""}`}
        onClick={() => setIs3dEnabled((current) => !current)}
        aria-pressed={is3dEnabled}
      >
        {is3dEnabled ? "2D" : "3D"}
      </button>
      <div ref={containerRef} className="offer-detail-map-canvas" />
    </div>
  );
}
