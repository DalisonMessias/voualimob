import { useEffect, useRef } from "react";
import L from "leaflet";
import { MototaxistaProfile } from "../types";

interface InteractiveMapProps {
  startCoords: [number, number] | null;    // [lat, lng]
  endCoords: [number, number] | null;      // [lat, lng]
  stops?: { address: string; coords: [number, number]; status: string }[]; // coords are [lng, lat]
  routeGeometry: [number, number][];        // array of [lat, lng] of the route
  raioCobranca: number;                     // radius in KM
  drivers?: MototaxistaProfile[];           // list of drivers online
  activeRideDriverId?: string | null;       // matched driver ID
  driverLiveCoords?: [number, number] | null; // [lat, lng] for live tracking
}

export default function InteractiveMap({
  startCoords,
  endCoords,
  stops = [],
  routeGeometry,
  raioCobranca,
  drivers = [],
  activeRideDriverId = null,
  driverLiveCoords = null,
}: InteractiveMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const startMarkerRef = useRef<L.Marker | null>(null);
  const endMarkerRef = useRef<L.Marker | null>(null);
  const stopMarkersRef = useRef<L.Marker[]>([]);
  const radiusCircleRef = useRef<L.Circle | null>(null);
  
  // Track dynamic list of driver markers
  const driverMarkersRef = useRef<{ [id: string]: L.Marker }>({});
  const liveDriverMarkerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // 1. Initialize map if not yet done
    if (!mapInstanceRef.current) {
      const initialLat = startCoords ? startCoords[0] : -12.9714; // Salvador BR center
      const initialLng = startCoords ? startCoords[1] : -38.5014;
      const initialZoom = startCoords ? 14 : 12;

      const map = L.map(mapContainerRef.current, {
        zoomControl: true,
        attributionControl: true,
      }).setView([initialLat, initialLng], initialZoom);

      // Add elegant CartoDB Dark Matter tile layer for an immersive, modern dark UI feel
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 20,
      }).addTo(map);

      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;

    // Invalidate size to load leafet tiles cleanly
    setTimeout(() => {
      map.invalidateSize();
    }, 150);

    // Clean up persistent standard markers to redraw freshly
    if (startMarkerRef.current) startMarkerRef.current.remove();
    if (endMarkerRef.current) endMarkerRef.current.remove();
    if (radiusCircleRef.current) radiusCircleRef.current.remove();
    if (routePolylineRef.current) routePolylineRef.current.remove();
    stopMarkersRef.current.forEach(m => m.remove());
    stopMarkersRef.current = [];

    // 2. Render Point A Origin Marker (Client's location)
    if (startCoords) {
      const startIcon = L.divIcon({
        className: "custom-marker-start",
        html: `
          <div class="relative flex items-center justify-center">
            <span class="absolute inline-flex h-8 w-8 bg-amber-500 opacity-20 rounded-full animate-ping"></span>
            <div class="w-8 h-8 rounded-full bg-zinc-900 border-2 border-amber-500 shadow-xl flex items-center justify-center text-amber-500 font-extrabold text-xs">
              A
            </div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      startMarkerRef.current = L.marker(startCoords, { icon: startIcon })
        .addTo(map)
        .bindPopup("<div class='font-sans font-semibold text-zinc-100 text-xs text-center'><span class='text-amber-500 font-bold'>Ponto de Partida</span><br/>Local de embarque</div>");

      // 3. Highlight the pricing radius (e.g., 3.5km bounds)
      radiusCircleRef.current = L.circle(startCoords, {
        radius: raioCobranca * 1000,
        color: "#f59e0b",
        fillColor: "#f59e0b",
        fillOpacity: 0.03,
        weight: 1,
        dashArray: "3, 6",
      })
        .addTo(map)
        .bindPopup(`<div class='font-sans text-xs text-zinc-100 text-center text-amber-500 font-bold'>Raio sem Adicional de Km: ${raioCobranca.toFixed(1)} km</div>`);
    }

    // 4. Render Intermediate Stops
    stops.forEach((stop, index) => {
      const stopCoords: [number, number] = [stop.coords[1], stop.coords[0]];
      const isFinished = stop.status === "finalizado";
      
      const stopIcon = L.divIcon({
        className: `custom-marker-stop-${index}`,
        html: `
          <div class="relative flex items-center justify-center">
            <div class="w-7 h-7 rounded-full ${isFinished ? 'bg-emerald-500 border-zinc-950' : 'bg-zinc-800 border-zinc-400'} border shadow-xl flex items-center justify-center text-white font-black text-[10px]">
              ${index + 1}
            </div>
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const mk = L.marker(stopCoords, { icon: stopIcon })
        .addTo(map)
        .bindPopup(`<div class='font-sans font-semibold text-zinc-100 text-xs text-center'><span class='${isFinished ? 'text-emerald-400' : 'text-zinc-400'} font-bold'>Parada ${index + 1}</span><br/>${stop.address}</div>`);
      
      stopMarkersRef.current.push(mk);
    });

    // 5. Render Destination Point B Marker
    if (endCoords) {
      const endIcon = L.divIcon({
        className: "custom-marker-end",
        html: `
          <div class="relative flex items-center justify-center">
            <span class="absolute inline-flex h-8 w-8 animate-pulse rounded-full bg-red-500 opacity-25"></span>
            <div class="w-8 h-8 rounded-full bg-red-500 border border-zinc-950 shadow-xl flex items-center justify-center text-zinc-950 font-black text-xs">
              B
            </div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      endMarkerRef.current = L.marker(endCoords, { icon: endIcon })
        .addTo(map)
        .bindPopup("<div class='font-sans font-semibold text-zinc-100 text-xs text-center'><span class='text-red-400 font-bold'>🏁 Destino</span><br/>Local de entrega/chegada</div>");
    }

    // 6. Draw active route polyline
    if (routeGeometry && routeGeometry.length > 0) {
      routePolylineRef.current = L.polyline(routeGeometry, {
        color: "#f59e0b",
        weight: 5,
        opacity: 0.85,
        lineJoin: "round",
      }).addTo(map);

      // Snap bounds to route mesh
      const bounds = L.latLngBounds(routeGeometry);
      map.fitBounds(bounds, { padding: [40, 40] });
    } else if (startCoords && endCoords) {
      // Connect straight dashed line represents request pending geometry
      const points = [startCoords, ...stops.map(s => [s.coords[1], s.coords[0]] as [number, number]), endCoords];
      routePolylineRef.current = L.polyline(points, {
        color: "#71717a",
        weight: 2.5,
        dashArray: "4, 8",
        opacity: 0.6,
      }).addTo(map);

      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [50, 50] });
    } else if (startCoords) {
      map.setView(startCoords, 14);
    }
  }, [startCoords, endCoords, stops, routeGeometry, raioCobranca]);

  // Clean and render available nearby drivers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear previous generic drivers
    Object.keys(driverMarkersRef.current).forEach((id) => {
      driverMarkersRef.current[id].remove();
    });
    driverMarkersRef.current = {};

    // Don't show generic nearby drivers if active driver-customer tracking is in progress
    if (activeRideDriverId) return;

    drivers.forEach((driver) => {
      // Drivers have coords in standard [lng, lat] format, map needs [lat, lng]
      const driverLatCoords = [driver.currentCoords[1], driver.currentCoords[0]] as [number, number];

      // Custom div icon with moving motorcycle vector representation
      const driverIcon = L.divIcon({
        className: `custom-driver-marker-${driver.id}`,
        html: `
          <div class="relative group cursor-pointer transition transform hover:scale-110">
            <span class="absolute inline-flex h-10 w-10 bg-amber-500 opacity-20 rounded-full animate-ping"></span>
            <div class="w-9 h-9 rounded-full bg-amber-500 border border-zinc-950 shadow-lg flex items-center justify-center text-black">
              <!-- MOTO SVG VECTOR -->
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="18.5" cy="17.5" r="2.5"/>
                <circle cx="5.5" cy="17.5" r="2.5"/>
                <path d="M12 17.5V14l-3-3 4-3 2 3h2"/>
              </svg>
            </div>
            <!-- Tooltip -->
            <div class="absolute -top-8 left-1/2 -translate-x-1/2 bg-zinc-900 border border-zinc-800 text-[9px] text-zinc-100 font-bold px-1.5 py-0.5 rounded shadow-lg opacity-0 group-hover:opacity-100 transition whitespace-nowrap z-[1000] pointer-events-none">
              ${driver.name} - ⭐${driver.rating}
            </div>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      const mk = L.marker(driverLatCoords, { icon: driverIcon })
        .addTo(map)
        .bindPopup(`
          <div class="font-sans text-xs space-y-1 text-zinc-100 p-1">
            <div class="flex items-center gap-1.5 font-bold text-amber-500">
              <span>🏍️ ${driver.name}</span>
              <span class="text-[10px] bg-amber-500/10 border border-amber-500/20 px-1 rounded text-amber-500">⭐${driver.rating}</span>
            </div>
            <p class="text-[10px] text-zinc-400"><strong>Veículo:</strong> ${driver.veiculoModelo}</p>
            <p class="text-[10px] text-zinc-400"><strong>Base:</strong> R$ ${driver.taxaSaida.toFixed(2)} + R$ ${driver.valorKm.toFixed(2)}/KM</p>
            <div class="flex flex-wrap gap-1 mt-1 pb-1">
              ${(driver.acceptsPix ?? true) ? '<span class="text-[7px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 px-1 rounded uppercase font-bold">Pix</span>' : ''}
              ${(driver.acceptsCash ?? true) ? '<span class="text-[7px] bg-amber-500/20 text-amber-500 border border-amber-500/20 px-1 rounded uppercase font-bold">Dinheiro</span>' : ''}
              ${driver.acceptsCard ? '<span class="text-[7px] bg-blue-500/20 text-blue-400 border border-blue-500/20 px-1 rounded uppercase font-bold">Cartão</span>' : ''}
              ${driver.usesTapToPay ? '<span class="text-[7px] bg-violet-500/20 text-violet-400 border border-violet-500/20 px-1 rounded uppercase font-bold">NFC</span>' : ''}
            </div>
            <p class="text-[10px] text-emerald-400 flex items-center gap-1">● Disponível Próximo</p>
          </div>
        `);

      driverMarkersRef.current[driver.id] = mk;
    });
  }, [drivers, activeRideDriverId]);

  // Handle active tracked driver coordinates movement on route line
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (liveDriverMarkerRef.current) {
      liveDriverMarkerRef.current.remove();
      liveDriverMarkerRef.current = null;
    }

    if (driverLiveCoords) {
      // Dynamic pulsing live tracker icon (Custom Gold-Green pulse)
      const liveIcon = L.divIcon({
        className: "custom-live-driver-marker",
        html: `
          <div class="relative flex items-center justify-center animate-bounce">
            <span class="absolute inline-flex h-11 w-11 bg-emerald-400 opacity-30 rounded-full animate-ping"></span>
            <div class="w-10 h-10 rounded-full bg-emerald-500 border-2 border-zinc-950 shadow-2xl flex items-center justify-center text-zinc-950 font-black">
              <!-- Animated custom motorcycle tracker -->
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="18.5" cy="17.5" r="2.5"/>
                <circle cx="5.5" cy="17.5" r="2.5"/>
                <path d="M12 17.5V14l-3-3 4-3 2 3h2"/>
              </svg>
            </div>
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });

      liveDriverMarkerRef.current = L.marker(driverLiveCoords, { icon: liveIcon })
        .addTo(map)
        .bindPopup("<div class='font-sans font-bold text-[11px] text-zinc-100 text-center text-emerald-400'>🛸 Vouali Solicitado<br/><span class='text-zinc-400 text-[10px] font-normal'>A caminho no mapa</span></div>");

      // Auto center map periodically to keep moving driver in focus
      map.panTo(driverLiveCoords, { animate: true });
    }
  }, [driverLiveCoords]);

  // Bind window listeners safely to respond to app container adjustments
  useEffect(() => {
    const handleResize = () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl bg-zinc-900 min-h-[340px] md:min-h-[480px]">
      <div id="vouali-map" ref={mapContainerRef} className="w-full h-full" style={{ outline: "none" }} />
      
      {/* Dynamic Map Legend HUD */}
      <div className="absolute top-3 right-3 z-[1000] bg-zinc-950/95 backdrop-blur-md px-3 py-2 rounded-xl border border-zinc-800/80 shadow-xl text-[9px] space-y-1 text-zinc-400 pointer-events-auto select-none max-w-[150px]">
        <p className="text-[10px] text-zinc-300 font-bold border-b border-zinc-800 pb-1 mb-1 tracking-wider uppercase">Filtros Vouali</p>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
          <span>Embarque (A)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
          <span>Chegada (B)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Motorista Ativo</span>
        </div>
      </div>
    </div>
  );
}
