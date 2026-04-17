'use client';

import { useEffect, useRef } from "react";
import type { Map as MapLibreMap, Marker as MapLibreMarker } from "maplibre-gl";

const OPEN_FREE_MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/3d";

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
  const initialZoom = approximate ? 12.8 : 15.2;

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
  }, [approximate, initialZoom, lat, lng]);

  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.flyTo({
      center: [lng, lat],
      zoom: initialZoom,
      essential: true,
      duration: 650,
    });
    markerRef.current?.setLngLat([lng, lat]);
  }, [initialZoom, lat, lng, resetToken]);

  return <div ref={containerRef} className="offer-detail-map-canvas" />;
}
