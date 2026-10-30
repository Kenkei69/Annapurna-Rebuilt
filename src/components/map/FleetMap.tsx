"use client";

import React, { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import "leaflet/dist/leaflet.css";

export interface MapShipment {
  id: string;
  trackingNumber: string;
  title: string;
  cargoType: string;
  status: string;
  tempMin: number;
  tempMax: number;
  latestTemperature?: number | null;
  originName: string;
  originLat?: number | null;
  originLng?: number | null;
  destName: string;
  destLat?: number | null;
  destLng?: number | null;
  latestLat?: number | null;
  latestLng?: number | null;
  licensePlate?: string | null;
  driverName?: string | null;
  isSimulated?: boolean;
}

interface FleetMapProps {
  shipments: MapShipment[];
  selectedShipmentId?: string | null;
  onSelectShipment?: (shipmentId: string) => void;
  className?: string;
}

export default function FleetMap({
  shipments,
  selectedShipmentId,
  onSelectShipment,
  className = "w-full h-full min-h-[450px]",
}: FleetMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LeafletMap | null>(null);
  const layerGroupRef = useRef<LayerGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);

  // Initialize Map Once
  useEffect(() => {
    let isCancelled = false;

    async function initLeaflet() {
      if (!mapContainerRef.current) return;
      if (mapInstanceRef.current) return;

      try {
        const L = (await import("leaflet")).default;
        if (isCancelled || !mapContainerRef.current) return;

        // Default center: India (Maharashtra/Mumbai center approx 19.0760, 72.8777)
        const map = L.map(mapContainerRef.current, {
          zoomControl: false,
          attributionControl: true,
          center: [19.076, 74.0],
          zoom: 7,
        });

        // Add CartoDB Voyager tiles (crisp, professional logistics basemap)
        L.tileLayer(
          "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
          {
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OSM</a> &copy; <a href="https://carto.com/attributions" target="_blank">CARTO</a>',
            subdomains: "abcd",
            maxZoom: 19,
          }
        ).addTo(map);

        // Add zoom control in bottom-right
        L.control.zoom({ position: "bottomright" }).addTo(map);

        const layers = L.layerGroup().addTo(map);
        mapInstanceRef.current = map;
        layerGroupRef.current = layers;
        setLoading(false);
      } catch (err: unknown) {
        console.error("Leaflet init error:", err);
        setMapError("Map initialization failed. Falling back to textual telemetry.");
        setLoading(false);
      }
    }

    initLeaflet();

    return () => {
      isCancelled = true;
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch {}
        mapInstanceRef.current = null;
        layerGroupRef.current = null;
      }
    };
  }, []);

  // Update Layers & Markers on data or selection change
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layers = layerGroupRef.current;
    if (!map || !layers) return;

    let isMounted = true;

    async function updateMarkers() {
      const L = (await import("leaflet")).default;
      if (!isMounted || !layers) return;

      layers.clearLayers();

      const selectedShipment = shipments.find((s) => s.id === selectedShipmentId);
      const boundsPoints: [number, number][] = [];

      // Helper to generate circular HTML marker
      const createMarkerIcon = (
        color: string,
        label: string,
        size = 12,
        isPulsing = false
      ) => {
        return L.divIcon({
          className: "custom-leaflet-icon",
          html: `
            <div style="position: relative; width: ${size}px; height: ${size}px;">
              ${
                isPulsing
                  ? `<div style="position: absolute; inset: -4px; border-radius: 9999px; background: ${color}; opacity: 0.5; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>`
                  : ""
              }
              <div style="position: relative; width: 100%; height: 100%; background: ${color}; border-radius: 9999px; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">
              </div>
            </div>
          `,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });
      };

      // 1. Draw non-selected shipments (smaller markers)
      shipments.forEach((s) => {
        if (s.id === selectedShipmentId) return;

        // Origin
        if (s.originLat && s.originLng) {
          boundsPoints.push([s.originLat, s.originLng]);
        }

        // Current truck location
        const truckLat = s.latestLat ?? s.originLat;
        const truckLng = s.latestLng ?? s.originLng;

        if (truckLat && truckLng) {
          boundsPoints.push([truckLat, truckLng]);
          const isAlerted = s.status === "ALERTED" || s.status === "RESCUE_PENDING";
          const color = isAlerted ? "#dc2626" : "#059669";

          const marker = L.marker([truckLat, truckLng], {
            icon: createMarkerIcon(color, s.licensePlate || "Reefer", 12, isAlerted),
          }).addTo(layers);

          marker.bindTooltip(
            `<strong>${s.trackingNumber}</strong> (${s.licensePlate || "Truck"})<br/>` +
              `Status: ${s.status}<br/>` +
              `Temp: ${s.latestTemperature != null ? s.latestTemperature.toFixed(1) + "°C" : "N/A"}`,
            { direction: "top", offset: [0, -6] }
          );

          marker.on("click", () => {
            if (onSelectShipment) onSelectShipment(s.id);
          });
        }
      });

      // 2. Draw selected shipment with route, origin, destination and prominent truck
      if (selectedShipment) {
        const oLat = selectedShipment.originLat ?? 19.9975;
        const oLng = selectedShipment.originLng ?? 73.7898;
        const dLat = selectedShipment.destLat ?? 19.076;
        const dLng = selectedShipment.destLng ?? 72.8777;
        const curLat = selectedShipment.latestLat ?? (oLat + (dLat - oLat) * 0.45);
        const curLng = selectedShipment.latestLng ?? (oLng + (dLng - oLng) * 0.45);

        boundsPoints.push([oLat, oLng], [dLat, dLng], [curLat, curLng]);

        // Origin Marker (Green)
        L.marker([oLat, oLng], {
          icon: createMarkerIcon("#10b981", "Origin", 14),
        })
          .addTo(layers)
          .bindTooltip(`Origin: ${selectedShipment.originName}`, {
            permanent: false,
            direction: "bottom",
          });

        // Destination Marker (Blue)
        L.marker([dLat, dLng], {
          icon: createMarkerIcon("#2563eb", "Dest", 14),
        })
          .addTo(layers)
          .bindTooltip(`Destination: ${selectedShipment.destName}`, {
            permanent: false,
            direction: "bottom",
          });

        // Completed Route (Emerald solid line)
        L.polyline(
          [
            [oLat, oLng],
            [curLat, curLng],
          ],
          {
            color: "#059669",
            weight: 4,
            opacity: 0.85,
          }
        ).addTo(layers);

        // Projected Remaining Route (Blue dashed line)
        L.polyline(
          [
            [curLat, curLng],
            [dLat, dLng],
          ],
          {
            color: "#2563eb",
            weight: 3,
            opacity: 0.6,
            dashArray: "6, 8",
          }
        ).addTo(layers);

        // Prominent Truck Marker
        const isAlerted =
          selectedShipment.status === "ALERTED" ||
          selectedShipment.status === "RESCUE_PENDING";
        const truckColor = isAlerted ? "#dc2626" : "#2563eb";

        const truckIcon = L.divIcon({
          className: "selected-truck-icon",
          html: `
            <div style="position: relative; width: 24px; height: 24px;">
              <div style="position: absolute; inset: -6px; border-radius: 9999px; background: ${truckColor}; opacity: 0.35; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
              <div style="position: relative; width: 24px; height: 24px; background: ${truckColor}; border-radius: 9999px; border: 3px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; color: white;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/>
                  <path d="M15 18H9"/>
                  <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/>
                  <circle cx="17" cy="18" r="2"/>
                  <circle cx="7" cy="18" r="2"/>
                </svg>
              </div>
            </div>
          `,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        const truckMarker = L.marker([curLat, curLng], { icon: truckIcon }).addTo(layers);
        truckMarker
          .bindTooltip(
            `<strong>${selectedShipment.trackingNumber}</strong> — ${selectedShipment.title}<br/>` +
              `Status: ${selectedShipment.status}<br/>` +
              `Temp: ${selectedShipment.latestTemperature != null ? selectedShipment.latestTemperature.toFixed(1) + "°C" : "No reading"}<br/>` +
              `Truck: ${selectedShipment.licensePlate || "Unassigned"}`,
            { permanent: true, direction: "top", offset: [0, -12] }
          )
          .openTooltip();
      }

      // Auto-fit bounds if we have valid points
      if (boundsPoints.length > 0 && map) {
        try {
          const latLngBounds = L.latLngBounds(boundsPoints);
          map.fitBounds(latLngBounds, { padding: [40, 40], maxZoom: 12 });
        } catch {}
      }
    }

    updateMarkers();

    return () => {
      isMounted = false;
    };
  }, [shipments, selectedShipmentId, onSelectShipment]);

  return (
    <div className={`relative rounded-xl overflow-hidden border border-slate-200 bg-slate-900 shadow-xs ${className}`}>
      {loading && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-900/80 text-white backdrop-blur-xs">
          <div className="w-7 h-7 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mb-2" />
          <p className="text-xs text-slate-300 font-medium">Initializing Fleet Console Map...</p>
        </div>
      )}

      {mapError && (
        <div className="absolute top-4 left-4 right-4 z-20 bg-amber-500/90 text-white px-3 py-2 rounded-lg text-xs font-medium shadow-md">
          {mapError}
        </div>
      )}

      <div ref={mapContainerRef} className="w-full h-full min-h-[450px]" />

      {/* Map Legend Overlay */}
      <div className="absolute bottom-3 left-3 z-10 bg-slate-900/90 border border-slate-800 text-slate-200 px-3 py-2 rounded-lg text-[11px] backdrop-blur-md shadow-md flex items-center gap-3">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-white" />
          <span>Nominal</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-600 border border-white animate-pulse" />
          <span>Alert / Breach</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-600 border border-white" />
          <span>Selected</span>
        </span>
      </div>
    </div>
  );
}
