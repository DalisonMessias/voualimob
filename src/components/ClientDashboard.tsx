import React, { useState, useEffect } from "react";
import { AppSettings, ClientProfile, MototaxistaProfile, RideRequestItem, ModalidadeCorrida, StatusCorrida } from "../types";
import { motion, AnimatePresence } from "motion/react";
import ChatBox from "./ChatBox";
import QRious from "qrious";
import { generatePixPayload } from "../lib/pix";
import { 
  MapPin, 
  Trash2, 
  Compass, 
  Calculator, 
  AlertTriangle, 
  Clock, 
  Bike, 
  Package, 
  Star, 
  Sparkles, 
  Zap, 
  Navigation, 
  Bell, 
  Phone, 
  ArrowRight, 
  Search, 
  X, 
  Heart,
  SortAsc,
  Wallet,
  Coins,
  Receipt,
  PlusCircle,
  History,
  CreditCard,
  Smartphone,
  ShieldCheck,
  Loader2,
  Headset
} from "lucide-react";
import InteractiveMap from "./InteractiveMap";
import RechargeModal from "./RechargeModal";
import SupportHub from "./SupportHub";

interface ClientDashboardProps {
  socket: any;
  settings: AppSettings;
  activeClient: ClientProfile;
  onlineDrivers: MototaxistaProfile[];
  activeRequest: RideRequestItem | null;
  onRequestRide: (request: RideRequestItem) => void;
  onCancelRide: () => void;
  onDismissRide: () => void;
  clientHistory: RideRequestItem[];
  onClearHistory: () => void;
}

interface MatchCandidate {
  driver: MototaxistaProfile;
  totalCost: number;
  distanceToClient: number; // KM from driver to client origin
  etaToClient: number;      // minutes from driver to client origin
  rideDuration: number;     // minutes from origin to destination
}

export default function ClientDashboard({
  socket,
  settings,
  activeClient,
  onlineDrivers,
  activeRequest,
  onRequestRide,
  onCancelRide,
  onDismissRide,
  clientHistory,
  onClearHistory,
}: ClientDashboardProps) {
  // Input fields
  const [startAddress, setStartAddress] = useState<string>("");
  const [endAddress, setEndAddress] = useState<string>("");
  const [stops, setStops] = useState<{ address: string; coords: [number, number] | null }[]>([]);
  const [modalidade, setModalidade] = useState<ModalidadeCorrida>("moto");
  const [observacoes, setObservacoes] = useState<string>("");

  // Resolution states
  const [startCoords, setStartCoords] = useState<[number, number] | null>(null); // [lat, lng]
  const [endCoords, setEndCoords] = useState<[number, number] | null>(null);     // [lat, lng]
  const [routeGeometry, setRouteGeometry] = useState<[number, number][]>([]);
  const [rideDistance, setRideDistance] = useState<number>(0);
  const [rideDuration, setRideDuration] = useState<number>(0);

  // Sorting
  const [sortBy, setSortBy] = useState<"price" | "distance" | "eta">("price");

  // UX logs/tracking
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [gpsLoading, setGpsLoading] = useState<boolean>(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Match proposals
  const [candidates, setCandidates] = useState<MatchCandidate[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);

  // New Favorite Location state
  const [favLabel, setFavLabel] = useState("");
  const [favAddress, setFavAddress] = useState("");
  const [showFavModal, setShowFavModal] = useState(false);

  // Payments integration local states
  const [formaPagamento, setFormaPagamento] = useState<'PIX' | 'Dinheiro' | 'Cartão' | 'Aproximação' | 'Saldo Vouali'>('PIX');
  const [precisaTroco, setPrecisaTroco] = useState<boolean>(false);
  const [trocoPara, setTrocoPara] = useState<number | "">("");
  const [showWalletDetails, setShowWalletDetails] = useState<boolean>(false);
  
  const [pixCopied, setPixCopied] = useState<boolean>(false);
  const [showRechargeModal, setShowRechargeModal] = useState<boolean>(false);
  const [showSupport, setShowSupport] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [qrLoaded, setQrLoaded] = useState<boolean>(false);

  // Trigger copy vibration & visual toast
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    if (navigator.vibrate) {
      navigator.vibrate(120);
    }
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Socket listeners for waiting events
  useEffect(() => {
    if (!socket || !activeRequest) return;

    const onWaitingStarted = () => {
      triggerToast("⏳ O motorista iniciou o tempo de espera!");
    };

    const onWaitingEnded = (data: any) => {
      triggerToast(`✅ Espera finalizada. Novo valor: R$ ${data.newTotalCost.toFixed(2)}`);
    };

    socket.on("waiting_started", onWaitingStarted);
    socket.on("waiting_ended", onWaitingEnded);

    return () => {
      socket.off("waiting_started", onWaitingStarted);
      socket.off("waiting_ended", onWaitingEnded);
    };
  }, [socket, activeRequest]);

  // Callback ref for drawing the QRious QR Code on mount safely
  const pixCanvasRef = (node: HTMLCanvasElement | null) => {
    if (node && activeRequest?.pixPayload) {
      setQrLoaded(true);
      new QRious({
        element: node,
        value: activeRequest.pixPayload,
        size: 300,
      });
    }
  };

  const getCityRegionLabel = () => {
    if (startAddress && startAddress.includes("(") && startAddress.includes(")")) {
      const startIdx = startAddress.indexOf("(");
      const endIdx = startAddress.indexOf(")");
      return startAddress.substring(startIdx + 1, endIdx);
    }
    return "Sua Região Ativa";
  };

  // Automatically read GPS location on mount if possible
  useEffect(() => {
    handleFetchCurrentLocation();
  }, []);

  // Update dynamic QR Code utilizing QRious when activeRequest payload shifts
  useEffect(() => {
    if (activeRequest?.formaPagamento === "PIX" && activeRequest?.pixPayload) {
      const qrcodeCanvas = document.getElementById("pix-qrcode");
      if (qrcodeCanvas) {
        new QRious({
          element: qrcodeCanvas,
          value: activeRequest.pixPayload,
          size: 300,
        });
      }
    }
  }, [activeRequest?.pixPayload, activeRequest?.statusPagamento, activeRequest?.formaPagamento]);

  const handleFetchCurrentLocation = () => {
    setGpsLoading(true);
    setGpsError(null);

    const useIpLocationFallback = async () => {
      // Try freeipapi.com (HTTPS, high performance, no keys)
      try {
        const ipRes = await fetch("https://freeipapi.com/api/json");
        if (ipRes.ok) {
          const ipData = await ipRes.json();
          if (ipData && ipData.latitude && ipData.longitude) {
            setStartCoords([ipData.latitude, ipData.longitude]);
            const city = ipData.cityName || "Sua Cidade";
            const state = ipData.regionName || "Sua Região";
            setStartAddress(`Minha Localização (${city} - ${state})`);
            setGpsLoading(false);
            return;
          }
        }
      } catch (err) {
        console.warn("freeipapi.com failed in client dashboard, trying ipapi.co", err);
      }

      // Try ipapi.co as secondary
      try {
        const ipRes2 = await fetch("https://ipapi.co/json/");
        if (ipRes2.ok) {
          const ipData2 = await ipRes2.json();
          if (ipData2.latitude && ipData2.longitude) {
            setStartCoords([ipData2.latitude, ipData2.longitude]);
            const city = ipData2.city || "Sua Cidade";
            const state = ipData2.region || "Sua Região";
            setStartAddress(`Minha Localização (${city} - ${state})`);
            setGpsLoading(false);
            return;
          }
        }
      } catch (err2) {
        console.warn("ipapi.co failed too in client dashboard", err2);
      }

      // Absolute fallback if everything fails
      setStartCoords([-12.9714, -38.5014]);
      setStartAddress("Centro, Salvador - BA");
      setGpsLoading(false);
    };

    if (!navigator.geolocation) {
      useIpLocationFallback();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setStartCoords([latitude, longitude]);
        setGpsLoading(false);

        // Reverse geo-code via free Nominatim API to get city/state name for aesthetic pairing
        try {
          const reverseUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=11`;
          const res = await fetch(reverseUrl, { headers: { "Accept-Language": "pt-BR" } });
          if (res.ok) {
            const data = await res.json();
            const city = data.address?.city || data.address?.town || data.address?.village || data.address?.municipality || "Sua Cidade";
            const state = data.address?.state || "Sua Região";
            setStartAddress(`Minha Localização (${city} - ${state})`);
          } else {
            setStartAddress(`Minha Localização (GPS: ${latitude.toFixed(5)}, ${longitude.toFixed(5)})`);
          }
        } catch (err) {
          setStartAddress(`Minha Localização (GPS: ${latitude.toFixed(5)}, ${longitude.toFixed(5)})`);
        }
      },
      (err) => {
        console.warn("Browser GPS permission denied or failed, performing IP city lookup fallback...", err);
        useIpLocationFallback();
      },
      { timeout: 5000 }
    );
  };

  // Run matching logic when route parameters are resolved or online drivers list updates
  useEffect(() => {
    if (!startCoords || !endCoords || rideDistance <= 0 || onlineDrivers.length === 0) {
      setCandidates([]);
      return;
    }

    // Georeferenced candidates
    const matches: MatchCandidate[] = onlineDrivers
      .filter((driver) => {
        // Driver must support modality and be online
        const baseMatch = driver.online && driver.modalidades.includes(modalidade);
        if (!baseMatch) return false;

        // Intelligent Payment Compatibility Filter
        if (formaPagamento === 'PIX' && driver.acceptsPix === false) return false;
        if (formaPagamento === 'Dinheiro' && driver.acceptsCash === false) return false;
        if (formaPagamento === 'Cartão' && driver.acceptsCard === false) return false;
        if (formaPagamento === 'Aproximação' && driver.usesTapToPay === false) return false;
        // Saldo Vouali is processed by the platform, always accepted by driver (they receive it as pix/credits balance)
        
        return true;
      })
      .map((driver) => {
        // Count distance from driver to client origin
        // Convert driver coordinates [lng, lat] back to [lat, lng]
        const driverLat = driver.currentCoords[1];
        const driverLng = driver.currentCoords[0];
        const distToClient = haversineDistance([startCoords[0], startCoords[1]], [driverLat, driverLng]);
        
        // Custom rate evaluation for match comparison list
        // Base rate + distance fee
        let baseRate = driver.taxaSaida;
        let kmRate = driver.valorKm;
        let minPrice = settings.taxaMinima;

        // Overlay with platform category pricing if exists
        if (settings.pricing && settings.pricing[modalidade]) {
          const cat = settings.pricing[modalidade];
          if (cat.ativo) {
            baseRate = cat.taxaSaida;
            kmRate = cat.valorKm;
            minPrice = cat.precoMinimo;
          }
        }

        // Overlay with driver custom category pricing if exists (driver override)
        if (driver.customPricing && driver.customPricing[modalidade]) {
          const custom = (driver.customPricing as any)[modalidade];
          if (custom) {
            baseRate = custom.taxaSaida;
            kmRate = custom.valorKm;
          }
        }

        let totalCost = baseRate + (rideDistance * kmRate);
        totalCost = Math.max(totalCost, minPrice);

        // ETA simulation to fetch passenger (approx 2 minutes per KM distance)
        const etaToClient = Math.max(1, Math.round(distToClient * 2.2));
        
        return {
          driver,
          totalCost: parseFloat(totalCost.toFixed(2)),
          distanceToClient: parseFloat(distToClient.toFixed(1)),
          etaToClient,
          rideDuration: Math.max(2, Math.round(rideDistance * 1.8))
        };
      });

    // Handle sort filters
    const sorted = [...matches].sort((a, b) => {
      if (sortBy === "price") return a.totalCost - b.totalCost;
      if (sortBy === "distance") return a.distanceToClient - b.distanceToClient;
      if (sortBy === "eta") return a.etaToClient - b.etaToClient;
      return 0;
    });

    setCandidates(sorted);
    if (sorted.length > 0 && !selectedCandidateId) {
      setSelectedCandidateId(sorted[0].driver.id);
    }
  }, [startCoords, endCoords, rideDistance, onlineDrivers, modalidade, sortBy]);

  // Utility Haversine for local tracking calculation
  const haversineDistance = (pt1: [number, number], pt2: [number, number]) => {
    const [lat1, lon1] = pt1;
    const [lat2, lon2] = pt2;
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Direct address Geocoding and route layout generation
  const handleResolveRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startAddress.trim() || !endAddress.trim()) {
      setErrorMsg("Insira os locais de partida e destino.");
      return;
    }

    if (stops.some(s => !s.address.trim())) {
      setErrorMsg("Preencha todos os endereços das paradas.");
      return;
    }

    setErrorMsg(null);
    setLoading(true);

    try {
      let resolvedStart: [number, number] | null = startCoords; // [lat, lng]
      let startName = startAddress;

      // 1. Geocode starting point
      if (!startCoords || startAddress.includes("Localização (GPS:")) {
        const geoStartRes = await fetch("/api/geocode", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-ors-api-key": settings.apiKeyValue },
          body: JSON.stringify({ address: startAddress }),
        });
        if (!geoStartRes.ok) throw new Error("Não encontrei o local de partida informado.");
        const dStart = await geoStartRes.json();
        resolvedStart = [dStart.coordinates[1], dStart.coordinates[0]]; // [lat, lng]
        startName = dStart.address;
        setStartCoords(resolvedStart);
        setStartAddress(startName);
      }

      // 2. Geocode intermediate stops
      const resolvedStops: { address: string; coords: [number, number] }[] = [];
      const updatedStopsState = [...stops];

      for (let i = 0; i < stops.length; i++) {
        const stop = stops[i];
        if (stop.coords && !stop.address.includes("...")) {
          resolvedStops.push({ address: stop.address, coords: stop.coords });
        } else {
          const geoStopRes = await fetch("/api/geocode", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-ors-api-key": settings.apiKeyValue },
            body: JSON.stringify({ 
              address: stop.address,
              currentLat: resolvedStart ? resolvedStart[0] : undefined,
              currentLng: resolvedStart ? resolvedStart[1] : undefined
            }),
          });
          if (!geoStopRes.ok) throw new Error(`Não localizei a parada ${i + 1} informada.`);
          const dStop = await geoStopRes.json();
          const coords: [number, number] = [dStop.coordinates[1], dStop.coordinates[0]];
          resolvedStops.push({ address: dStop.address, coords });
          updatedStopsState[i] = { address: dStop.address, coords };
        }
      }
      setStops(updatedStopsState);

      // 3. Geocode ending destination
      const lastPoint = resolvedStops.length > 0 ? resolvedStops[resolvedStops.length - 1].coords : resolvedStart;
      const geoEndRes = await fetch("/api/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ors-api-key": settings.apiKeyValue },
        body: JSON.stringify({ 
          address: endAddress,
          currentLat: lastPoint ? lastPoint[0] : undefined,
          currentLng: lastPoint ? lastPoint[1] : undefined
        }),
      });
      if (!geoEndRes.ok) throw new Error("Não localizei o local de destino informado.");
      const dEnd = await geoEndRes.json();
      const resolvedEnd = [dEnd.coordinates[1], dEnd.coordinates[0]] as [number, number]; // [lat, lng]
      const endName = dEnd.address;
      setEndCoords(resolvedEnd);
      setEndAddress(endName);

      // 4. Request router endpoints with all waypoints
      const allWaypoints = [
        [resolvedStart![1], resolvedStart![0]], // [lon, lat]
        ...resolvedStops.map(s => [s.coords[1], s.coords[0]]),
        [resolvedEnd[1], resolvedEnd[0]]
      ];

      const directionsRouteRes = await fetch("/api/route", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-ors-api-key": settings.apiKeyValue },
        body: JSON.stringify({
          waypoints: allWaypoints
        }),
      });

      if (!directionsRouteRes.ok) throw new Error("Incapaz de traçar rota viável.");
      const routeInfo = await directionsRouteRes.json();

      setRideDistance(routeInfo.distance);
      setRideDuration(routeInfo.duration);
      
      const pts: [number, number][] = routeInfo.geometry.map((pt: [number, number]) => [pt[1], pt[0]]);
      setRouteGeometry(pts);

    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Erro de conexão ao pesquisar rota e mapa.");
    } finally {
      setLoading(false);
    }
  };

  // Submit active booking request
  const handleRequestRide = () => {
    if (!startCoords || !endCoords || candidates.length === 0) return;
    
    // Grab selected driver matched info or default to best one
    const chosenMatch = candidates.find(c => c.driver.id === selectedCandidateId) || candidates[0];
    const driver = chosenMatch.driver;

    let payload = "";
    if (formaPagamento === "PIX") {
      try {
        payload = generatePixPayload({
          key: driver.pixChave || "financeiro@vouali.com",
          keyType: driver.pixTipoChave || "EMAIL",
          name: driver.pixNomeRecebedor || driver.name || "Vouali Recebedor",
          city: driver.pixCidadeRecebedor || "SALVADOR",
          amount: chosenMatch.totalCost,
          description: "Corrida Vouali"
        });
      } catch (e) {
        console.error("Erro ao gerar payload PIX:", e);
        payload = "Erro ao gerar QRCode. Verifique as configurações do piloto.";
      }
    }
    
    const requestItem: RideRequestItem = {
      id: "req_" + Date.now(),
      timestamp: new Date().toISOString(),
      clientId: activeClient.id,
      clientName: activeClient.name,
      clientPhone: activeClient.phone,
      startAddress,
      endAddress,
      stops: stops.map(s => ({ address: s.address, coords: s.coords!, status: "pendente" })),
      startCoords: [startCoords[1], startCoords[0]], // [lng, lat]
      endCoords: [endCoords[1], endCoords[0]],     // [lng, lat]
      distance: rideDistance,
      duration: rideDuration,
      modalidade,
      observacoes,
      driverId: chosenMatch.driver.id,
      driverName: chosenMatch.driver.name,
      driverPhone: chosenMatch.driver.phone,
      driverCoords: chosenMatch.driver.currentCoords, // [lng, lat]
      veiculoPlaca: chosenMatch.driver.veiculoPlaca,
      veiculoModelo: chosenMatch.driver.veiculoModelo,
      totalCost: chosenMatch.totalCost,
      originalTotalCost: chosenMatch.totalCost,
      waitingTimeCost: 0,
      waitingLogs: [],
      isWaiting: false,
      status: "procurando", // Start looking
      geometry: routeGeometry.map(pt => [pt[1], pt[0]]), // saved geometry coordinates as [lng, lat] pairs
      simulated: true,
      formaPagamento,
      statusPagamento: "pendente",
      pixPayload: payload,
      precisaTroco: formaPagamento === "Dinheiro" ? precisaTroco : false,
      trocoPara: (formaPagamento === "Dinheiro" && precisaTroco) ? Number(trocoPara) : undefined,
    };

    onRequestRide(requestItem);
  };

  const handleFavoriteClick = (coords: [number, number], label: string, address: string, isStart: boolean) => {
    // Coords saved in types as [lng, lat]
    const leafletCoords: [number, number] = [coords[1], coords[0]];
    if (isStart) {
      setStartCoords(leafletCoords);
      setStartAddress(address);
    } else {
      setEndCoords(leafletCoords);
      setEndAddress(address);
    }
  };

  // Clear inputs and map markers layout reset helper
  const handleResetForm = () => {
    setEndAddress("");
    setEndCoords(null);
    setRouteGeometry([]);
    setRideDistance(0);
    setRideDuration(0);
    setCandidates([]);
    setSelectedCandidateId(null);
    setObservacoes("");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start pb-12 animate-fade-in text-zinc-100">
      
      {/* LEFT COLUMN: Request interface & match list */}
      <div className="lg:col-span-5 space-y-5">
        
        {/* CARTEIRA DIGITAL VOUALI (REQUISITO PREMIUM) */}
        {!activeRequest && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 shadow-2xl relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full -translate-y-12 translate-x-12 blur-3xl group-hover:bg-amber-500/10 transition-colors" />
            
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                  <Wallet className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-zinc-100">Carteira Vouali</h3>
                  <p className="text-[9px] text-zinc-500 uppercase font-bold">Saldo para Corridas</p>
                </div>
              </div>
              <button 
                onClick={() => setShowWalletDetails(!showWalletDetails)}
                className="text-[10px] bg-zinc-950 px-2.5 py-1 rounded-full border border-zinc-800 text-zinc-400 hover:text-amber-500 hover:border-amber-500/30 transition-all font-bold uppercase tracking-wider cursor-pointer"
              >
                {showWalletDetails ? "Recolher" : "Extrato"}
              </button>
            </div>

            <div className="flex items-end justify-between">
              <div>
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest block mb-1">Saldo Atual</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-black text-white font-mono">R$ {(activeClient.creditsBalance || 0).toFixed(2)}</span>
                  {(activeClient.creditsBalance || 0) <= 5 && (
                    <span className="text-[8px] bg-red-500/10 text-red-500 px-1 rounded font-black uppercase tracking-tighter animate-pulse border border-red-500/20">Saldo Baixo</span>
                  )}
                </div>
              </div>
              <div className="flex gap-3">
                <button 
                  className="flex flex-col items-center gap-1 group/btn cursor-pointer"
                  onClick={() => setShowSupport(true)}
                >
                  <div className="w-9 h-9 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500 group-hover/btn:bg-blue-500 group-hover/btn:text-black transition-all shadow-lg shadow-blue-500/5">
                    <Headset className="w-5 h-5" />
                  </div>
                  <span className="text-[8px] font-black text-zinc-400 uppercase group-hover/btn:text-blue-400 tracking-widest">Suporte</span>
                </button>

                <button 
                  className="flex flex-col items-center gap-1 group/btn cursor-pointer"
                  onClick={() => setShowRechargeModal(true)}
                >
                  <div className="w-9 h-9 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 group-hover/btn:bg-emerald-500 group-hover/btn:text-black transition-all shadow-lg shadow-emerald-500/5">
                    <PlusCircle className="w-5 h-5" />
                  </div>
                  <span className="text-[8px] font-black text-zinc-400 uppercase group-hover/btn:text-emerald-400 tracking-widest">Recarregar</span>
                </button>
              </div>
            </div>

            <AnimatePresence>
              {showWalletDetails && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="mt-5 pt-4 border-t border-zinc-805 space-y-3 overflow-hidden"
                >
                  <div className="flex items-center justify-between text-[8px] font-black uppercase tracking-widest text-zinc-500">
                    <span>Últimas Movimentações</span>
                    <History className="w-3 h-3" />
                  </div>
                  
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                    {activeClient.creditTransactions && activeClient.creditTransactions.length > 0 ? (
                      activeClient.creditTransactions.map((tx) => (
                        <div key={tx.id} className="flex items-center justify-between p-2 rounded-xl bg-zinc-950 border border-zinc-805">
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                              tx.type.includes('recharge') || tx.type === 'cashback' || tx.type === 'bonus' 
                                ? 'bg-emerald-500/10 text-emerald-500' 
                                : 'bg-red-500/10 text-red-500'
                            }`}>
                              {tx.type.includes('recharge') ? <PlusCircle className="w-3 h-3" /> : 
                               tx.type === 'cashback' ? <Sparkles className="w-3 h-3" /> :
                               tx.type === 'bonus' ? <Zap className="w-3 h-3" /> :
                               <Receipt className="w-3 h-3" />}
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-zinc-300">{tx.description}</p>
                              <p className="text-[8px] text-zinc-600 uppercase">{new Date(tx.timestamp).toLocaleDateString()} • {new Date(tx.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                            </div>
                          </div>
                          <span className={`text-[10px] font-black font-mono ${
                            tx.type.includes('recharge') || tx.type === 'cashback' || tx.type === 'bonus'
                              ? 'text-emerald-500'
                              : 'text-zinc-500'
                          }`}>
                            {tx.type.includes('recharge') || tx.type === 'cashback' || tx.type === 'bonus' ? '+' : '-'} R$ {tx.amount.toFixed(2)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="py-8 text-center bg-zinc-950 rounded-2xl border border-dashed border-zinc-800">
                        <Coins className="w-6 h-6 text-zinc-700 mx-auto mb-2 opacity-20" />
                        <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest">Nenhuma transação encontrada</p>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[9px] font-black uppercase tracking-widest text-zinc-400">
                    <div className="bg-zinc-950 p-2 rounded-xl border border-zinc-805 flex items-center gap-2">
                      <Sparkles className="w-3 h-3 text-amber-500" />
                      <span>Cashback: R$ 0.00</span>
                    </div>
                    <div className="bg-zinc-950 p-2 rounded-xl border border-zinc-805 flex items-center gap-2">
                      <Zap className="w-3 h-3 text-violet-500" />
                      <span>Bônus: R$ 0.00</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* If there is an active ride in progress, overlay/render tracked details */}
        {activeRequest ? (
          <>
            <motion.div
              key={activeRequest.status}
              initial={{ opacity: 0, scale: 0.98, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: -15 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="bg-zinc-900 border-2 border-amber-500 rounded-2xl p-5 shadow-2xl relative space-y-4"
            >
              
              <div className="flex items-center justify-between border-b border-zinc-805 pb-3">
                <div>
                  <span className="text-[9px] bg-amber-500 text-black px-1.5 py-0.5 rounded-md font-black uppercase font-sans tracking-wide">
                    Vouali e chego bem
                  </span>
                  <h4 className="text-sm font-black text-zinc-100 uppercase mt-1">Status da Corrida</h4>
                </div>
                
                <div className="flex items-center gap-1 bg-zinc-950 px-2.5 py-1 rounded-full border border-zinc-800">
                  <span className={`w-2 h-2 rounded-full ${
                    activeRequest.status === "finalizado" ? "bg-emerald-500" : "bg-amber-400 animate-ping"
                  }`}></span>
                  <span className="text-[10px] font-bold uppercase tracking-wider font-mono">
                    {activeRequest.status}
                  </span>
                </div>
              </div>

              {/* Simulated Live Stage tracker card */}
              <div className="space-y-2">
                <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Progresso da Viagem</p>
                
                <div className="grid grid-cols-5 gap-1 text-center">
                  <div className={`p-1.5 rounded-lg text-[9px] font-bold ${
                    activeRequest.status === "procurando" ? "bg-amber-500 text-zinc-950 animate-pulse" : "bg-zinc-800 text-zinc-500"
                  }`}>BUSCANDO</div>
                  
                  <div className={`p-1.5 rounded-lg text-[9px] font-bold ${
                    activeRequest.status === "aceito" ? "bg-amber-500 text-zinc-950 animate-pulse" : "bg-zinc-800 text-zinc-500"
                  }`}>ACEITO</div>
                  
                  <div className={`p-1.5 rounded-lg text-[9px] font-bold ${
                    activeRequest.status === "a_caminho" ? "bg-amber-500 text-zinc-950 animate-pulse" : "bg-zinc-800 text-zinc-500"
                  }`}>A CAMINHO</div>
                  
                  <div className={`p-1.5 rounded-lg text-[9px] font-bold ${
                    activeRequest.status === "em_andamento" ? "bg-amber-500 text-zinc-950 animate-pulse" : "bg-zinc-800 text-zinc-500"
                  }`}>BORDO</div>
                  
                  <div className={`p-1.5 rounded-lg text-[9px] font-bold ${
                    activeRequest.status === "finalizado" ? "bg-emerald-500 text-zinc-950" : "bg-zinc-800 text-zinc-500"
                  }`}>CHEGOU</div>
                </div>
              </div>

              {/* Assigned Driver Details block */}
              {activeRequest.driverName && (
                <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img 
                        src={`https://api.dicebear.com/7.x/bottts/svg?seed=${activeRequest.driverName}`} 
                        className="w-10 h-10 rounded-full bg-zinc-850 p-0.5 border border-zinc-700" 
                        alt="Driver" 
                      />
                      <div>
                        <p className="text-xs font-bold text-zinc-200">{activeRequest.driverName}</p>
                        <p className="text-[10px] text-zinc-500">{activeRequest.veiculoModelo}</p>
                        <p className="text-[10px] text-amber-500 font-mono font-bold">{activeRequest.veiculoPlaca}</p>
                        <div className="flex gap-1 mt-1">
                           {(formaPagamento === "Aproximação" || activeRequest.formaPagamento === "Aproximação") && (
                             <span className="text-[7px] bg-violet-500/20 text-violet-400 px-1 rounded font-black uppercase border border-violet-500/20">Aproximação Ativo</span>
                           )}
                           {activeRequest.formaPagamento === "Cartão" && (
                             <span className="text-[7px] bg-blue-500/20 text-blue-400 px-1 rounded font-black uppercase border border-blue-500/20">Maquininha Disponível</span>
                           )}
                        </div>
                      </div>
                    </div>
                    
                    <a 
                      href={`tel:${activeRequest.driverPhone}`}
                      className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 hover:bg-amber-500 hover:text-black transition cursor-pointer"
                    >
                      <Phone className="w-3.5 h-3.5" />
                    </a>
                  </div>
                  <div className="grid grid-cols-3 border-t border-zinc-800/60 pt-2 text-center text-[10px] gap-2">
                    <div>
                      <span className="text-zinc-500 uppercase block tracking-wide">Valor Fixo</span>
                      <strong className="text-zinc-100 font-bold font-mono">R$ {activeRequest.totalCost.toFixed(2)}</strong>
                    </div>
                    <div>
                      <span className="text-zinc-500 uppercase block tracking-wide">Distância</span>
                      <strong className="text-zinc-100 font-mono">{activeRequest.distance.toFixed(1)} km</strong>
                    </div>
                    <div>
                      <span className="text-zinc-500 uppercase block tracking-wide">Modo</span>
                      <strong className="text-zinc-100 uppercase text-[9px] font-black tracking-widest text-amber-500">{activeRequest.modalidade}</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* DETALHES DO PAGAMENTO EM PROGRESSO (IN-TRANSIT REMINDER) */}
              <div className="bg-zinc-950/80 border border-zinc-805 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between border-b border-zinc-900 pb-1.5 text-xs font-black uppercase tracking-wider">
                  <span className="text-zinc-450 text-[10px]">Forma de Pagamento</span>
                  <span className={`text-[9px] uppercase font-black px-2 py-0.5 rounded ${
                    activeRequest.formaPagamento === "PIX" 
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25" 
                      : activeRequest.formaPagamento === "Dinheiro"
                      ? "bg-amber-500/10 text-amber-500 border border-amber-500/25"
                      : activeRequest.formaPagamento === "Saldo Vouali"
                      ? "bg-amber-500 text-black border border-amber-500 shadow-lg shadow-amber-500/20"
                      : activeRequest.formaPagamento === "Aproximação"
                      ? "bg-violet-500/10 text-violet-400 border border-violet-500/25"
                      : "bg-blue-500/10 text-blue-400 border border-blue-500/25"
                  }`}>
                    ⚡ {activeRequest.formaPagamento === "Saldo Vouali" ? "VOUALI WALLET" : activeRequest.formaPagamento || "PIX"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs py-1">
                  <span className="text-zinc-500 font-bold uppercase tracking-wider text-[10px]">Total Estimado:</span>
                  <strong className="text-sm font-mono text-amber-500 font-black">R$ {activeRequest.totalCost.toFixed(2)}</strong>
                </div>
                <div className="bg-amber-500/5 p-2 rounded-lg border border-amber-500/10 text-[9px] text-amber-450 text-center uppercase tracking-wide font-bold leading-normal">
                  🔒 Pagamento solicitado apenas ao finalizar a corrida no destino.
                </div>
              </div>

              {/* Cancel controls or reset controls */}
              {activeRequest.status !== "finalizado" && activeRequest.status !== "cancelado" && (
                <button 
                  onClick={onCancelRide}
                  className="w-full bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-black hover:font-bold py-2.5 rounded-xl border border-red-500/20 text-xs uppercase font-extrabold tracking-wider transition cursor-pointer"
                >
                  Cancelar Corrida Atual
                </button>
              )}

            </motion.div>

            {socket && (["aceito", "a_caminho", "em_andamento"].includes(activeRequest.status)) && (
              <ChatBox 
                socket={socket} 
                rideId={activeRequest.id} 
                sender="client" 
                otherName={activeRequest.driverName || "Mototaxista"} 
              />
            )}
          </>
        ) : (
          <div className="space-y-4">
            
            {/* SEARCH AND BOOKING FORM PANEL */}
            <form onSubmit={handleResolveRoute} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4 shadow-xl relative">
              {loading && (
                <div id="loading-overlay" className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm flex flex-col items-center justify-center z-25 gap-2">
                  <div className="w-10 h-10 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin"></div>
                  <span className="text-xs font-bold text-zinc-300 tracking-wider">Calculando melhor trajeto...</span>
                </div>
              )}

              <div className="flex justify-between items-center pb-2 border-b border-zinc-800/60">
                <h3 className="text-xs font-black uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
                  <Navigation className="w-4 h-4 animate-pulse text-amber-500" />
                  Vouali e chego bem
                </h3>
                <span className="text-[10px] text-zinc-400 font-mono">{getCityRegionLabel()}</span>
              </div>

              {/* Category selection - Premium Cards */}
              <div className="space-y-3 pb-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest font-mono">Selecione a Categoria</h4>
                  {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />}
                </div>
                
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { id: "moto", name: "Moto", icon: Bike, color: "amber", desc: "Transporte rápido de passageiros" },
                    { id: "moto_flash", name: "Moto Flash", icon: Package, color: "amber", desc: "Coleta e entrega de objetos" },
                    { id: "carro", name: "Carro", icon: Navigation, color: "emerald", desc: "Transporte em automóveis" },
                    { id: "carro_flash", name: "Carro Flash", icon: Zap, color: "emerald", desc: "Entregas e coletas em carro" }
                  ].map((cat) => {
                    const isSelected = modalidade === cat.id;
                    const Icon = cat.icon;
                    const colorClass = cat.color === "amber" ? "amber" : "emerald";
                    
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          setModalidade(cat.id as ModalidadeCorrida);
                        }}
                        className={`relative overflow-hidden group p-3 rounded-2xl border-2 transition-all text-left flex flex-col justify-between min-h-[100px] cursor-pointer ${
                          isSelected 
                            ? `bg-${colorClass}-500/15 border-${colorClass}-500 shadow-lg shadow-${colorClass}-500/10` 
                            : "bg-zinc-950 border-zinc-850 hover:border-zinc-700"
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 transition-transform group-hover:scale-110 ${
                          isSelected ? `bg-${colorClass}-500 text-zinc-950` : `bg-zinc-900 text-zinc-400`
                        }`}>
                          <Icon className="w-4.5 h-4.5" />
                        </div>
                        
                        <div>
                          <p className={`text-[11px] font-black uppercase tracking-tight ${isSelected ? `text-${colorClass}-400` : "text-zinc-200"}`}>
                            {cat.name}
                          </p>
                          <p className="text-[8px] text-zinc-500 font-bold uppercase truncate">{cat.desc}</p>
                        </div>
                        
                        {isSelected && (
                          <motion.div layoutId="active-cat" className={`absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-${colorClass}-500`}></motion.div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Start address fields */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Partida (A)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-emerald-500"></span>
                  <input
                    type="text"
                    required
                    value={startAddress}
                    onChange={(e) => setStartAddress(e.target.value)}
                    placeholder="Ender. de saída, Link do Maps ou Coordenadas"
                    className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl py-2.5 pl-8 pr-12 text-xs outline-none transition"
                  />
                  
                  <button
                    type="button"
                    onClick={handleFetchCurrentLocation}
                    disabled={gpsLoading}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-zinc-500 hover:text-amber-500 hover:bg-zinc-900 rounded-lg transition disabled:opacity-50 cursor-pointer"
                    title="Obter minha localização GPS em tempo real"
                  >
                    <Compass className={`w-4 h-4 ${gpsLoading ? "animate-spin text-amber-500" : ""}`} />
                  </button>
                </div>
              </div>

              {/* End destination fields */}
              <div className="space-y-3">
                {stops.map((stop, idx) => (
                  <div key={idx} className="space-y-1 animate-fade-in">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Parada {idx + 1}</label>
                      <button 
                        type="button"
                        onClick={() => setStops(stops.filter((_, i) => i !== idx))}
                        className="text-red-500 hover:text-red-400 transition"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full border-2 border-amber-500 bg-zinc-950"></span>
                      <input
                        type="text"
                        required
                        value={stop.address}
                        onChange={(e) => {
                          const newStops = [...stops];
                          newStops[idx].address = e.target.value;
                          setStops(newStops);
                        }}
                        placeholder="Local da parada..."
                        className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl py-2.5 pl-8 pr-4 text-xs outline-none transition"
                      />
                    </div>
                  </div>
                ))}

                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest font-sans">Chegada (B)</label>
                    {stops.length < (settings.maxParadas || 3) && (
                      <button 
                        type="button"
                        onClick={() => setStops([...stops, { address: "", coords: null }])}
                        className="flex items-center gap-1 text-[9px] bg-zinc-850 hover:bg-zinc-800 text-amber-500 border border-zinc-800 px-2 py-0.5 rounded-full font-black uppercase tracking-wider transition cursor-pointer"
                      >
                        <PlusCircle className="w-3 h-3" /> Adicionar Parada
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                    <input
                      type="text"
                      required
                      value={endAddress}
                      onChange={(e) => setEndAddress(e.target.value)}
                      placeholder="Digite o local de destino..."
                      className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl py-2.5 pl-8 pr-4 text-xs outline-none transition"
                    />
                  </div>
                </div>
              </div>

              {/* Courier Specific observations observations */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">
                  {modalidade === "moto_flash" ? "Detalhes do Envio (O que recolher?)" : "Observação para o Mototaxista"}
                </label>
                <input
                  type="text"
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder={modalidade === "moto_flash" ? "Ex: Pegar chave com porteiro na portaria B" : "Ex: Levar capacete extra, troco para 50 reais"}
                  className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl py-2 px-3 text-xs outline-none transition"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full bg-amber-500 hover:bg-amber-400 text-zinc-950 font-extrabold uppercase py-3 rounded-xl transition text-xs tracking-wider cursor-pointer shadow-lg shadow-amber-500/10 flex items-center justify-center gap-2"
                >
                  <Search className="w-4 h-4" /> Traçar Rota de {modalidade === "moto" ? "Passeio" : "Entrega"}
                </button>
              </div>
            </form>

            {/* MATCH OPTIONS / COMPARATOR PANEL */}
            {rideDistance > 0 && candidates.length > 0 && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-4 shadow-xl">
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-zinc-800 gap-2">
                  <div>
                    <h4 className="text-xs font-black uppercase text-zinc-100 tracking-wider">Compare os Melhores Preços</h4>
                    <p className="text-[10px] text-zinc-400">Total de {candidates.length} mototaxistas online próximos</p>
                  </div>

                  {/* Sorter tabs */}
                  <div className="flex items-center gap-1.5 bg-zinc-950 p-1 rounded-lg border border-zinc-800/80">
                    <button
                      onClick={() => setSortBy("price")}
                      className={`text-[9px] font-bold uppercase px-2 py-1 rounded transition whitespace-nowrap cursor-pointer ${
                        sortBy === "price" ? "bg-amber-500 text-zinc-950" : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      $ Preço
                    </button>
                    <button
                      onClick={() => setSortBy("distance")}
                      className={`text-[9px] font-bold uppercase px-2 py-1 rounded transition whitespace-nowrap cursor-pointer ${
                        sortBy === "distance" ? "bg-amber-500 text-zinc-950" : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      🚗 Proximidade
                    </button>
                    <button
                      onClick={() => setSortBy("eta")}
                      className={`text-[9px] font-bold uppercase px-2 py-1 rounded transition whitespace-nowrap cursor-pointer ${
                        sortBy === "eta" ? "bg-amber-500 text-zinc-950" : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      ⌛ ETA
                    </button>
                  </div>
                </div>

                {/* Candidate driver match row grids */}
                <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                  {candidates.map(({ driver, totalCost, distanceToClient, etaToClient }) => {
                    const isSelected = selectedCandidateId === driver.id;
                    return (
                      <div
                        key={driver.id}
                        onClick={() => setSelectedCandidateId(driver.id)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected 
                            ? "bg-amber-500/10 border-amber-500" 
                            : "bg-zinc-950 border-zinc-800/80 hover:border-zinc-700"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <img src={driver.avatar} className="w-9 h-9 rounded-full bg-zinc-900 border border-zinc-800" alt="Avatar" />
                            <span className="absolute -bottom-1 -right-1 bg-amber-500/90 text-zinc-950 text-[8px] font-bold w-4 h-4 rounded-full border border-black flex items-center justify-center">
                              ★{driver.rating.toFixed(0)}
                            </span>
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h5 className="text-xs font-bold text-zinc-200">{driver.name}</h5>
                              <span className="text-[8px] bg-zinc-900 border border-zinc-800 text-zinc-400 px-1 rounded">
                                {distanceToClient}km de você
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {(driver.acceptsPix ?? true) && (
                                <span className="text-[7px] bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-1 rounded uppercase font-bold">Pix</span>
                              )}
                              {(driver.acceptsCash ?? true) && (
                                <span className="text-[7px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-1 rounded uppercase font-bold">Dinheiro</span>
                              )}
                              {driver.acceptsCard && (
                                <span className="text-[7px] bg-blue-500/10 text-blue-500 border border-blue-500/20 px-1 rounded uppercase font-bold">Cartão</span>
                              )}
                              {driver.usesTapToPay && (
                                <span className="text-[7px] bg-violet-500/10 text-violet-500 border border-violet-500/20 px-1 rounded uppercase font-bold">Aproximação</span>
                              )}
                            </div>
                            <p className="text-[9px] text-zinc-500 italic mt-1">Chega em {etaToClient} min • Taxa especial Km</p>
                          </div>
                        </div>

                        <div className="text-right">
                          <p className="text-xs font-black text-amber-500 font-mono">R$ {totalCost.toFixed(2)}</p>
                          <span className={`text-[8px] uppercase font-bold tracking-widest ${
                            isSelected ? "text-amber-400 font-extrabold" : "text-zinc-500"
                          }`}>
                            {isSelected ? "Selecionado" : "Clique p/ ver"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* SELEÇÃO DE FORMA DE PAGAMENTO (OBRIGATÓRIO ANTES DE CONFIRMAR) */}
                <div className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800/80 space-y-2 mt-4">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-wider block">Forma de Pagamento</label>
                    <span className="text-[8px] bg-amber-500/10 text-amber-500 px-1 py-0.5 rounded font-bold uppercase tracking-wider">Obrigatório</span>
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormaPagamento("Saldo Vouali")}
                      className={`py-2 px-1 rounded-lg text-[8px] font-black uppercase transition flex flex-col items-center justify-center gap-1 cursor-pointer border ${
                        formaPagamento === "Saldo Vouali"
                          ? "bg-amber-500 text-black shadow-lg shadow-amber-500/20 border-amber-500"
                          : "bg-zinc-900 border-zinc-850 text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      <Wallet className="w-3.5 h-3.5 mb-0.5" />
                      <span>Vouali</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormaPagamento("PIX")}
                      className={`py-2 px-1.5 rounded-lg text-[9px] font-black uppercase transition flex flex-col items-center justify-center gap-1 cursor-pointer border ${
                        formaPagamento === "PIX"
                          ? "bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-sm"
                          : "bg-zinc-900 border-zinc-850 text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      <span className="text-[10px]">📱 PIX</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormaPagamento("Dinheiro")}
                      className={`py-2 px-1.5 rounded-lg text-[9px] font-black uppercase transition flex flex-col items-center justify-center gap-1 cursor-pointer border ${
                        formaPagamento === "Dinheiro"
                          ? "bg-amber-500/10 border-amber-500 text-amber-400 shadow-sm"
                          : "bg-zinc-900 border-zinc-850 text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      <span className="text-[10px]">💵 Dinheiro</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormaPagamento("Cartão")}
                      className={`py-2 px-1.5 rounded-lg text-[9px] font-black uppercase transition flex flex-col items-center justify-center gap-1 cursor-pointer border ${
                        formaPagamento === "Cartão"
                          ? "bg-blue-500/10 border-blue-500 text-blue-400 shadow-sm"
                          : "bg-zinc-900 border-zinc-850 text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      <span className="text-[10px]">💳 Cartão</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormaPagamento("Aproximação")}
                      className={`py-2 px-1.5 rounded-lg text-[9px] font-black uppercase transition flex flex-col items-center justify-center gap-1 cursor-pointer border ${
                        formaPagamento === "Aproximação"
                          ? "bg-violet-500/10 border-violet-500 text-violet-400 shadow-sm"
                          : "bg-zinc-900 border-zinc-850 text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      <span className="text-[10px]">📡 NFC</span>
                    </button>
                  </div>

                  {/* SUB-MODAL DE TROCO (INTELIGENTE) */}
                  <AnimatePresence>
                    {formaPagamento === "Dinheiro" && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3.5 space-y-3 mt-2 shadow-inner">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest">Precisa de Troco?</span>
                            <div 
                              onClick={() => setPrecisaTroco(!precisaTroco)}
                              className={`w-9 h-5 rounded-full p-1 cursor-pointer transition-colors relative ${precisaTroco ? "bg-amber-500" : "bg-zinc-800"}`}
                            >
                              <div className={`w-3 h-3 bg-white rounded-full transition-all ${precisaTroco ? "ml-4" : "ml-0"}`} />
                            </div>
                          </div>

                          {precisaTroco && (
                            <div className="space-y-2 animate-fade-in">
                              <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-wide block">Troco para quanto?</label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-600">R$</span>
                                <input 
                                  type="number"
                                  value={trocoPara}
                                  onChange={(e) => setTrocoPara(e.target.value === "" ? "" : Number(e.target.value))}
                                  placeholder="Ex: 50.00"
                                  className="w-full bg-zinc-950 border border-zinc-805 rounded-xl py-2 pl-9 pr-3 text-xs outline-none focus:border-amber-500 transition font-mono font-bold"
                                />
                              </div>
                              {Number(trocoPara) > 0 && Number(candidates.find(c => c.driver.id === selectedCandidateId)?.totalCost || 0) > 0 && (
                                <p className="text-[9px] text-zinc-555 italic">
                                  Motorista levará <strong className="text-amber-500 font-black">R$ {(Number(trocoPara) - (candidates.find(c => c.driver.id === selectedCandidateId)?.totalCost || 0)).toFixed(2)}</strong> de troco.
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* AVISO SALDO VOUALI (EXCLUSIVO) */}
                  <AnimatePresence>
                    {formaPagamento === "Saldo Vouali" && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className={`p-3 rounded-2xl border mt-2 flex items-start gap-2.5 ${
                          (activeClient.creditsBalance || 0) < (candidates.find(c => c.driver.id === selectedCandidateId)?.totalCost || 0)
                            ? "bg-red-500/5 border-red-500/20"
                            : "bg-amber-500/5 border-amber-500/20"
                        }`}>
                          {(activeClient.creditsBalance || 0) < (candidates.find(c => c.driver.id === selectedCandidateId)?.totalCost || 0) ? (
                            <>
                              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                              <div className="space-y-1">
                                <p className="text-[9px] font-black text-red-500 uppercase">Saldo Insuficiente</p>
                                <p className="text-[9px] text-zinc-500 leading-tight">Seu saldo atual é R$ {(activeClient.creditsBalance || 0).toFixed(2)}. Por favor, recarregue ou escolha outra forma de pagamento.</p>
                              </div>
                            </>
                          ) : (
                            <>
                              <ShieldCheck className="w-4 h-4 text-amber-500 flex-shrink-0" />
                              <div className="space-y-1">
                                <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest">Pagamento Instantâneo</p>
                                <p className="text-[9px] text-zinc-500 leading-tight">O valor de <strong>R$ {(candidates.find(c => c.driver.id === selectedCandidateId)?.totalCost || 0).toFixed(2)}</strong> será reservado e descontado automaticamente ao fim da viagem.</p>
                              </div>
                            </>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-zinc-555 uppercase font-bold tracking-wider">Distância total do Trajeto</p>
                    <p className="text-xs font-black text-zinc-200">
                      {rideDistance.toFixed(2)} KM • Aprox {Math.max(1, Math.round(rideDuration / 60))} min
                    </p>
                  </div>

                  <button
                    onClick={handleRequestRide}
                    className="bg-amber-500 hover:bg-amber-400 text-zinc-950 px-5 py-2.5 rounded-xl font-black uppercase text-xs tracking-wider transition cursor-pointer flex items-center gap-1.5 shadow-lg shadow-amber-500/10"
                  >
                    Confirmar Vouali <ArrowRight className="w-4 h-4" />
                  </button>
                </div>

              </div>
            )}

            {/* Error alerts if geocoding or math calculator fails */}
            {errorMsg && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-start gap-2.5 text-xs text-red-400 animate-pulse">
                <AlertTriangle className="w-4 h-4 text-red-450 mt-0.5 flex-shrink-0" />
                <p>{errorMsg}</p>
              </div>
            )}

          </div>
        )}

        {/* SAVED FAVORITES QUICK ADDRESS ACCORDION */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3 shadow-xl">
          <div className="flex items-center justify-between pb-1.5 border-b border-zinc-800">
            <h4 className="text-xs font-black text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
              <Heart className="w-3.5 h-3.5 text-amber-500" /> Locais Favoritos
            </h4>
            <span className="text-[9px] text-zinc-500">Toque para preencher rápido</span>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {activeClient.favoritos && activeClient.favoritos.map((fav) => (
              <div 
                key={fav.id} 
                className="bg-zinc-950/80 border border-zinc-850 p-2.5 rounded-xl hover:border-zinc-700 transition flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div className="truncate">
                  <span className="text-[9px] bg-amber-500/10 border border-amber-500/20 text-amber-500 px-1 py-0.5 rounded font-bold uppercase tracking-wider">
                    {fav.label}
                  </span>
                  <p className="text-[10px] text-zinc-300 font-bold mt-1 truncate max-w-[2400px]">{fav.address}</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleFavoriteClick(fav.coords, fav.label, fav.address, true)}
                    className="text-[9px] bg-zinc-900 text-zinc-400 hover:text-amber-500 hover:bg-zinc-800 px-2 py-1 rounded border border-zinc-800 transition cursor-pointer font-bold"
                  >
                    Usar de Partida (A)
                  </button>
                  <button
                    onClick={() => handleFavoriteClick(fav.coords, fav.label, fav.address, false)}
                    className="text-[9px] bg-zinc-900 text-zinc-400 hover:text-red-400 hover:bg-zinc-800 px-2 py-1 rounded border border-zinc-800 transition cursor-pointer font-bold"
                  >
                    Usar de Destino (B)
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CLIENT BOOKING OPERATION TRIP HISTORIES */}
        {clientHistory.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3 shadow-xl">
            <div className="flex items-center justify-between pb-1.5 border-b border-zinc-800">
              <h4 className="text-xs font-black text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-500" /> Seus Pedidos Anteriores
              </h4>
              <button
                onClick={onClearHistory}
                className="text-[10px] uppercase font-black tracking-wider text-red-500 hover:text-red-400 hover:underline transition cursor-pointer flex items-center gap-1"
                title="Limpar histórico"
              >
                <Trash2 className="w-3 h-3" /> Limpar Tudo
              </button>
            </div>

            <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
              {clientHistory.map((item, index) => (
                <div key={`${item.id}-${index}`} className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-850 space-y-1">
                  <div className="flex items-center justify-between text-[9px]">
                    <span className="text-zinc-500 font-mono">{new Date(item.timestamp).toLocaleDateString("pt-BR")}</span>
                    <span className="text-amber-500 font-bold font-mono">R$ {item.totalCost.toFixed(2)}</span>
                  </div>
                  <p className="text-[10px] text-zinc-300 truncate"><strong>De:</strong> {item.startAddress}</p>
                  <p className="text-[10px] text-zinc-300 truncate"><strong>Para:</strong> {item.endAddress}</p>
                  <div className="flex justify-between items-center text-[9px] pt-1 border-t border-zinc-800/40">
                    <span className="text-zinc-400 uppercase font-bold tracking-widest">{item.modalidade === "moto_flash" ? "🏍️ Flash" : "🏍️ Corrida"}</span>
                    <span className="text-emerald-450 font-bold uppercase flex items-center gap-1">● Concluída</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* RIGHT COLUMN: Interactive Leaflet Map panel */}
      <div className="lg:col-span-7 h-full space-y-4 lg:sticky lg:top-20">
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-2.5 shadow-xl h-[400px] md:h-[520px] relative">
          <InteractiveMap
            startCoords={startCoords}
            endCoords={endCoords}
            routeGeometry={routeGeometry}
            raioCobranca={settings.raioCobranca}
            drivers={onlineDrivers}
            activeRideDriverId={activeRequest?.driverId}
            driverLiveCoords={
              activeRequest && activeRequest.status !== "procurando" && activeRequest.status !== "finalizado" && activeRequest.status !== "cancelado" && activeRequest.driverId
                ? (activeRequest.driverCoords ? [activeRequest.driverCoords[1], activeRequest.driverCoords[0]] : null)
                : null
            }
          />
        </div>
      </div>

      {/* SUCCESS/PAYMENT PREMIUM CLIENT MODAL */}
      <AnimatePresence>
        {activeRequest && activeRequest.status === "finalizado" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[2500] backdrop-blur-xl bg-zinc-950/90 flex items-center justify-center p-4 overflow-y-auto font-sans"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -30 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="bg-zinc-900/95 border border-zinc-800/80 rounded-3xl w-full max-w-md p-6 shadow-2xl relative space-y-6 text-zinc-100 overflow-hidden"
            >
              {/* Decorative subtle ambient lights */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-10 -right-10 w-24 h-24 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

              {/* Header Layout */}
              <div className="text-center space-y-1 my-2">
                <span className="text-[9px] bg-amber-500/15 text-amber-400 px-3 py-1 rounded-full border border-amber-500/20 font-black tracking-widest uppercase font-mono">
                  CORRIDA FINALIZADA
                </span>
                <h2 className="text-2xl font-black uppercase tracking-tight text-white leading-tight mt-3">
                  Chegamos ao Destino!
                </h2>
                <p className="text-[11px] text-zinc-400 font-medium">
                  Por favor, realize o fechamento do pagamento abaixo
                </p>
              </div>

              {/* Price Tag Box */}
              <div className="bg-zinc-950/80 border border-zinc-800 py-4 px-6 rounded-2xl text-center space-y-1 relative">
                <p className="text-[9px] text-zinc-500 font-extrabold uppercase tracking-widest">Valor do Trajeto</p>
                <p className="text-3xl font-black font-mono text-amber-500">R$ {activeRequest.totalCost?.toFixed(2)}</p>
                <div className="flex justify-center items-center gap-1.5 pt-2 border-t border-zinc-900/40 text-[10px]">
                  <span className="text-zinc-400 font-semibold">Forma escolhida:</span>
                  <span className={`px-2 py-0.5 rounded font-black text-[9px] uppercase ${
                    activeRequest.formaPagamento === "PIX" 
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25" 
                      : activeRequest.formaPagamento === "Dinheiro"
                      ? "bg-amber-500/10 text-amber-550 text-amber-500 border border-amber-500/25"
                      : "bg-blue-500/10 text-blue-400 border border-blue-500/25"
                  }`}>
                    ⚡ {activeRequest.formaPagamento || "PIX"}
                  </span>
                </div>
              </div>

              {/* Driver Mini Card */}
              <div className="flex items-center gap-3 bg-zinc-950/50 p-3 rounded-2xl border border-zinc-800/60">
                <img 
                  src={`https://api.dicebear.com/7.x/bottts/svg?seed=${activeRequest.driverName}`} 
                  className="w-12 h-12 rounded-full bg-zinc-800 p-0.5 border border-zinc-700 shadow-inner" 
                  alt="Driver Profile" 
                  referrerPolicy="no-referrer"
                />
                <div className="flex-1 min-w-0">
                  <span className="text-[8px] text-zinc-500 uppercase font-black tracking-widest font-mono">Condutor Parceiro</span>
                  <h4 className="text-sm font-black text-white truncate uppercase leading-tight">{activeRequest.driverName || "Motorista Particular"}</h4>
                  <p className="text-[10px] text-zinc-400 font-mono truncate">{activeRequest.veiculoModelo || "Veículo Oficial"} • <span className="text-amber-550 text-amber-550 text-amber-500 font-extrabold">{activeRequest.veiculoPlaca}</span></p>
                </div>
                <div className="flex flex-col items-end shrink-0">
                  <span className="text-[10px] font-black text-zinc-300 flex items-center gap-1">★ 4.9</span>
                  <span className="text-[8px] text-zinc-500 uppercase tracking-widest font-mono">Avaliação</span>
                </div>
              </div>

              {/* Payment Detail / Core UI */}
              <div className="space-y-4">
                {activeRequest.formaPagamento === "PIX" ? (
                  <div className="space-y-4">
                    {/* PIX Details card */}
                    {!(["pago", "confirmado", "pago_dinheiro", "pago_cartao"].includes(activeRequest.statusPagamento || "")) ? (
                      <div className="flex flex-col items-center justify-center space-y-3.5 bg-zinc-950/60 p-4 rounded-2xl border border-zinc-850">
                        <span className="text-[8px] text-amber-450 tracking-wider font-black uppercase font-mono animate-pulse">Aguardando Pagamento Pix</span>
                        
                        {/* QRCode Grande */}
                        <div className="bg-white p-3.5 rounded-2xl shadow-xl border border-zinc-700/50 relative flex items-center justify-center">
                          <canvas ref={pixCanvasRef} className="w-[180px] h-[180px]" />
                          {!qrLoaded && (
                            <div className="absolute inset-0 bg-zinc-900/65 backdrop-blur-sm flex items-center justify-center rounded-2xl">
                              <span className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></span>
                            </div>
                          )}
                        </div>
                        
                        <div className="text-center space-y-1">
                          <p className="text-[10px] text-zinc-400">
                            Recebedor: <span className="text-zinc-200 font-bold">{activeRequest.driverName || "Condutor"}</span>
                          </p>
                          <p className="text-[9px] text-zinc-500 font-mono">
                            Chave PIX: {activeRequest.pixPayload ? "Chave Pix Associada" : "vouali.central.pix@vouali.com"}
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-2 w-full pt-1.5">
                          {/* Copiar PIX */}
                          <button
                            type="button"
                            onClick={() => {
                              if (activeRequest.pixPayload) {
                                navigator.clipboard.writeText(activeRequest.pixPayload);
                                triggerToast("PIX Copiado!");
                              }
                            }}
                            className="bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-black hover:font-black border border-emerald-500/25 text-[10px] uppercase font-bold py-3 px-3 rounded-xl transition duration-200 cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                          >
                            📋 Copiar PIX
                          </button>

                          {/* Compartilhar WhatsApp */}
                          <button
                            type="button"
                            onClick={() => {
                              if (activeRequest.pixPayload) {
                                const message = `Olá, segue o PIX da corrida no Vouali.\n\nValor: R$ ${activeRequest.totalCost?.toFixed(2)}\n\nPIX copia e cola:\n${activeRequest.pixPayload}\n\nObrigado por usar o Vouali 🚀`;
                                window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`, "_blank");
                              }
                            }}
                            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-750 text-[10px] font-black uppercase py-3 px-3 rounded-xl transition duration-200 cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                          >
                            💬 WhatsApp
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-6 px-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl space-y-2 animate-pulse">
                        <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto text-emerald-400 border border-emerald-500/30">
                          ✓
                        </div>
                        <p className="text-emerald-400 font-black text-sm uppercase tracking-wider flex items-center justify-center gap-1.5">
                          ✓ PAGAMENTO APROVADO
                        </p>
                        <p className="text-[10px] text-zinc-400 leading-relaxed">
                          O motorista recebeu e validou o PIX com sucesso! Sua viagem está liquidada.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  /* CASH OR CARD DETAIL FLOW */
                  <div className="space-y-4">
                    {!(["pago", "confirmado", "pago_dinheiro", "pago_cartao"].includes(activeRequest.statusPagamento || "")) ? (
                      <div className="text-center py-5 px-4 bg-zinc-950/65 border border-zinc-850 rounded-2xl space-y-3">
                        <div className="w-10 h-10 rounded-full bg-amber-500/15 flex items-center justify-center mx-auto text-amber-400 border border-amber-500/20">
                          <Clock className="w-5 h-5 animate-spin" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-black uppercase tracking-wider text-zinc-200">
                            Aguardando acerto em {activeRequest.formaPagamento === "Dinheiro" ? "Dinheiro" : "Cartão"}
                          </p>
                          <p className="text-[10px] text-zinc-400 leading-normal max-w-[250px] mx-auto">
                            {activeRequest.formaPagamento === "Dinheiro" 
                              ? "Efetue o pagamento em cédulas diretamente ao motorista. Ele irá confirmar o recebimento em seu console." 
                              : "Entregue seu cartão ao condutor para efetuação eletrônica via maquininha física."}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-6 px-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl space-y-2">
                        <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto text-emerald-400 border border-emerald-500/30">
                          ✓
                        </div>
                        <p className="text-emerald-400 font-black text-sm uppercase tracking-wider flex items-center justify-center gap-1.5">
                          ✓ VIAGEM LIQUIDADA
                        </p>
                        <p className="text-[10px] text-zinc-400 leading-relaxed">
                          {activeRequest.statusPagamento === "pago_dinheiro" 
                            ? "O motorista confirmou o pagamento recebido em Dinheiro físico!" 
                            : activeRequest.statusPagamento === "pago_cartao"
                            ? "O motorista confirmou o pagamento recebido em Cartão!"
                            : "Recebimento confirmado pelo parceiro no console de bordo!"}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer Dynamic Status HUD */}
              <div className="flex flex-col items-center justify-center space-y-3 pt-4 border-t border-zinc-800/60">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-black font-mono">Status do Checkout:</span>
                  <span className={`text-[9px] uppercase tracking-wider font-extrabold px-2.5 py-0.5 rounded ${
                    ["pago", "confirmado", "pago_dinheiro", "pago_cartao"].includes(activeRequest.statusPagamento || "")
                      ? "bg-emerald-500 text-zinc-950 font-black"
                      : "bg-amber-500/15 text-amber-500 border border-amber-500/20 animate-pulse"
                  }`}>
                    {activeRequest.statusPagamento === "pago" || activeRequest.statusPagamento === "confirmado"
                      ? "PAGAMENTO RECEBIDO"
                      : activeRequest.statusPagamento === "pago_dinheiro"
                      ? "PAGO EM DINHEIRO"
                      : activeRequest.statusPagamento === "pago_cartao"
                      ? "PAGO EM CARTÃO"
                      : "AGUARDANDO PAGAMENTO"}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={onDismissRide}
                  className={`w-full font-black text-xs uppercase py-3.5 rounded-2xl transition duration-200 cursor-pointer flex items-center justify-center gap-2 ${
                    ["pago", "confirmado", "pago_dinheiro", "pago_cartao"].includes(activeRequest.statusPagamento || "")
                      ? "bg-emerald-500 hover:bg-emerald-450 text-zinc-950 shadow-lg shadow-emerald-500/15"
                      : "bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white border border-zinc-750"
                  }`}
                >
                  {["pago", "confirmado", "pago_dinheiro", "pago_cartao"].includes(activeRequest.statusPagamento || "") 
                    ? "✓ Concluir e Voltar ao Início" 
                    : "Voltar para o Menu Principal"}
                </button>
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -50, x: "-50%", scale: 0.95 }}
            animate={{ opacity: 1, y: 0, x: "-50%", scale: 1 }}
            exit={{ opacity: 0, y: -50, x: "-50%", scale: 0.95 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-[3000] bg-zinc-950 border border-emerald-500/35 text-emerald-400 text-[10px] font-black uppercase px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2 tracking-wider"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
      <RechargeModal
        isOpen={showRechargeModal}
        onClose={() => setShowRechargeModal(false)}
        userId={activeClient.id}
        userName={activeClient.name}
        userRole="client"
        settings={settings}
      />

      <AnimatePresence>
        {showSupport && (
          <SupportHub 
            userId={activeClient.id}
            userName={activeClient.name}
            userRole="client"
            onClose={() => setShowSupport(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
