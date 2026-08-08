import React, { useState, useEffect, useRef } from 'react';
import { store } from '../lib/db';
import { RouteMap, Waypoint } from '../types';
import L from 'leaflet';
import {
  MapPin,
  Download,
  WifiOff,
  CheckCircle2,
  Navigation,
  Mountain,
  Gauge,
  Compass,
  AlertTriangle,
  HardDrive,
  Info,
} from 'lucide-react';
import { motion } from 'motion/react';

export const OfflineMaps: React.FC = () => {
  const [routes, setRoutes] = useState<RouteMap[]>(() => store.getRoutes());
  const [selectedRoute, setSelectedRoute] = useState<RouteMap>(() => routes[0] || store.getRoutes()[0]);
  const [isSimulatedOffline, setIsSimulatedOffline] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const markersRef = useRef<L.Marker[]>([]);

  const refreshRoutes = () => {
    const updated = store.getRoutes();
    setRoutes(updated);
    const curr = updated.find((r) => r.id === selectedRoute.id);
    if (curr) setSelectedRoute(curr);
  };

  const handleToggleOfflineCache = (routeId: string) => {
    store.toggleOfflineRouteCache(routeId);
    refreshRoutes();
  };

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        zoomControl: true,
        scrollWheelZoom: true,
      }).setView(selectedRoute.coordinates[0], 10);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 18,
      }).addTo(map);

      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;

    // Clear old markers & polyline
    if (polylineRef.current) {
      map.removeLayer(polylineRef.current);
    }
    markersRef.current.forEach((m) => map.removeLayer(m));
    markersRef.current = [];

    // Draw route line
    const polyline = L.polyline(selectedRoute.coordinates, {
      color: '#10b981',
      weight: 5,
      opacity: 0.9,
    }).addTo(map);

    polylineRef.current = polyline;
    map.fitBounds(polyline.getBounds(), { padding: [40, 40] });

    // Add Waypoint Markers
    selectedRoute.waypoints.forEach((wp) => {
      const customIcon = L.divIcon({
        className: 'custom-map-pin',
        html: `<div style="background-color: #0f172a; color: #10b981; border: 2px solid #10b981; border-radius: 9999px; padding: 4px 8px; font-weight: bold; font-size: 11px; white-space: nowrap; box-shadow: 0 4px 12px rgba(16,185,129,0.4);">${wp.name}</div>`,
        iconSize: [120, 30],
        iconAnchor: [60, 15],
      });

      const marker = L.marker([wp.lat, wp.lng], { icon: customIcon })
        .addTo(map)
        .bindPopup(`<b>${wp.name}</b><br/>${wp.type} • ${wp.description || ''}`);

      markersRef.current.push(marker);
    });

    // Handle ResizeObserver
    const observer = new ResizeObserver(() => {
      map.invalidateSize();
    });
    observer.observe(mapContainerRef.current);

    return () => {
      observer.disconnect();
    };
  }, [selectedRoute]);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-2xl font-extrabold text-[#1b4332] flex items-center gap-2">
            <MapPin className="w-7 h-7 text-[#2d6a4f]" />
            Offline Route Maps & GPS Caching
          </h2>
          <p className="text-xs text-[#52605d] mt-0.5">
            Download vector maps & turn-by-turn waypoints for mountain passes and coastal dead zones
          </p>
        </div>

        {/* Offline Mode Toggle Simulation */}
        <button
          onClick={() => setIsSimulatedOffline(!isSimulatedOffline)}
          className={`py-2 px-3.5 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all cursor-pointer ${
            isSimulatedOffline
              ? 'bg-[#d8f3dc] text-[#1b4332] border-[#b7e4c7]'
              : 'bg-white text-[#52605d] border-[#e2ece2] hover:bg-[#f7f9f7]'
          }`}
        >
          <WifiOff className="w-4 h-4" />
          <span>{isSimulatedOffline ? 'Simulating Low Connectivity' : 'Network Active'}</span>
        </button>
      </div>

      {/* Offline Alert Banner */}
      {isSimulatedOffline && (
        <div className="p-4 rounded-2xl bg-[#d8f3dc] border border-[#b7e4c7] text-[#1b4332] text-xs flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-[#2d6a4f] shrink-0" />
          <div>
            <p className="font-bold text-[#1b4332]">Offline Mode Simulated (No Cellular Signals)</p>
            <p className="text-[11px] text-[#52605d]">
              Viewing cached vector coordinates and waypoint data stored in browser IndexedDB.
            </p>
          </div>
        </div>
      )}

      {/* Route Selection Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {routes.map((r) => {
          const isSelected = r.id === selectedRoute.id;
          return (
            <button
              key={r.id}
              onClick={() => setSelectedRoute(r)}
              className={`p-4 rounded-2xl border text-left transition-all cursor-pointer space-y-2 ${
                isSelected
                  ? 'bg-white border-[#1b4332] shadow-xs'
                  : 'bg-white border-[#e2ece2] hover:border-[#b7e4c7]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#d8f3dc] text-[#1b4332]">
                  {r.difficulty} Difficulty
                </span>
                {r.offlineCached && (
                  <span className="text-[10px] text-[#2d6a4f] font-bold flex items-center gap-1">
                    <HardDrive className="w-3 h-3 text-[#2d6a4f]" /> Cached
                  </span>
                )}
              </div>
              <h3 className="font-heading font-bold text-[#1b4332] text-sm line-clamp-1">
                {r.name}
              </h3>
              <p className="text-[11px] text-[#52605d]">
                {r.distanceMiles} mi • {r.elevationGainFt} ft elevation
              </p>
            </button>
          );
        })}
      </div>

      {/* Main Map Container & Waypoints Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Leaflet Map Stage */}
        <div className="lg:col-span-2 space-y-4">
          <div className="relative rounded-3xl bg-white border border-[#e2ece2] overflow-hidden shadow-xs h-[450px]">
            <div ref={mapContainerRef} className="w-full h-full z-10" />

            {/* Offline Cache Control Floating Badge */}
            <div className="absolute top-4 right-4 z-20">
              <button
                onClick={() => handleToggleOfflineCache(selectedRoute.id)}
                className={`py-2 px-3.5 rounded-xl font-bold text-xs flex items-center gap-2 shadow-md border cursor-pointer backdrop-blur-md transition-all ${
                  selectedRoute.offlineCached
                    ? 'bg-[#1b4332] text-white border-[#2d6a4f]'
                    : 'bg-white text-[#1b4332] border-[#e2ece2] hover:bg-gray-50'
                }`}
              >
                <Download className="w-4 h-4" />
                <span>
                  {selectedRoute.offlineCached ? 'Downloaded Offline' : 'Download Route for Offline Use'}
                </span>
              </button>
            </div>
          </div>

          {/* Elevation Profile Visualizer */}
          <div className="p-5 rounded-3xl bg-white border border-[#e2ece2] space-y-3 shadow-xs">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-[#1b4332] flex items-center gap-1.5">
                <Mountain className="w-4 h-4 text-[#2d6a4f]" />
                Route Elevation Profile Graph
              </span>
              <span className="text-[#52605d] font-mono">Max: {selectedRoute.elevationGainFt} ft</span>
            </div>

            {/* Simulated Elevation Curve */}
            <div className="h-20 w-full bg-[#f7f9f7] rounded-2xl border border-[#e2ece2] p-3 flex items-end gap-1">
              {[20, 35, 45, 75, 90, 100, 80, 65, 40, 50, 70, 85, 60, 30, 15].map((h, i) => (
                <div
                  key={i}
                  style={{ height: `${h}%` }}
                  className="flex-1 bg-[#2d6a4f] rounded-t-xs hover:bg-[#1b4332] transition-all"
                  title={`Segment ${i + 1}: ${Math.round((h / 100) * selectedRoute.elevationGainFt)} ft`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Waypoints & Details Sidebar */}
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-white border border-[#e2ece2] space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <h3 className="font-heading text-base font-bold text-[#1b4332]">
                GPS Waypoint Stops
              </h3>
              <span className="text-xs text-[#2d6a4f] font-mono">
                {selectedRoute.waypoints.length} waypoints
              </span>
            </div>

            <div className="space-y-3">
              {selectedRoute.waypoints.map((wp, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-2xl bg-[#f7f9f7] border border-[#e2ece2] space-y-1 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <strong className="text-[#1b4332] font-bold">{wp.name}</strong>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#d8f3dc] text-[#1b4332]">
                      {wp.type}
                    </span>
                  </div>
                  {wp.description && (
                    <p className="text-[11px] text-[#52605d]">{wp.description}</p>
                  )}
                  <p className="text-[10px] text-[#52605d] font-mono">
                    GPS: {wp.lat.toFixed(4)}, {wp.lng.toFixed(4)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
