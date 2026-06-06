import React, { useState, useEffect, useRef } from "react";
import { AppSettings, MototaxistaProfile, RideRequestItem, ModalidadeCorrida, StatusCorrida } from "../types";
import { motion, AnimatePresence } from "motion/react";
import QRious from "qrious";
import ChatBox from "./ChatBox";
import { supabase } from "../lib/supabase";
import { 
  Bike, 
  Settings, 
  MapPin, 
  Phone, 
  TrendingUp, 
  History, 
  Map as MapIcon, 
  Compass, 
  Bell, 
  Check, 
  X, 
  AlertOctagon, 
  AlertCircle,
  HelpCircle,
  DollarSign,
  Coins,
  ShieldCheck,
  Headset,
  Clock
} from "lucide-react";
import InteractiveMap from "./InteractiveMap";
import ContractModal from "./ContractModal";
import SupportHub from "./SupportHub";
import RechargeModal from "./RechargeModal";
import { transferToCredits, requestWithdrawal } from "../lib/finances";
import { 
  ArrowRightLeft, 
  Wallet, 
  Download, 
  History as HistoryIcon, 
  BarChart3, 
  Info,
  ChevronRight
} from "lucide-react";

interface DriverDashboardProps {
  socket: any;
  settings: AppSettings;
  activeDriver: MototaxistaProfile;
  onUpdateDriver: (driver: MototaxistaProfile) => void;
  activeRequest: RideRequestItem | null;
  onAcceptRequest: () => void;
  onDeclineRequest: () => void;
  onProgressRequest: (status: StatusCorrida) => void;
  onDismissRide: () => void;
  driverHistory: RideRequestItem[];
  onClearHistory: () => void;
}

export default function DriverDashboard({
  socket,
  settings,
  activeDriver,
  onUpdateDriver,
  activeRequest,
  onAcceptRequest,
  onDeclineRequest,
  onProgressRequest,
  onDismissRide,
  driverHistory,
  onClearHistory,
}: DriverDashboardProps) {
  // Config state inputs
  const [rate, setRate] = useState(activeDriver.valorKm.toString());
  const [base, setBase] = useState(activeDriver.taxaSaida.toString());
  const [radius, setRadius] = useState(activeDriver.raioMaximo.toString());
  const [acceptsMoto, setAcceptsMoto] = useState(activeDriver.modalidades.includes("moto"));
  const [acceptsFlash, setAcceptsFlash] = useState(activeDriver.modalidades.includes("moto_flash"));
  
  // Custom PIX configuration states
  const [pixChave, setPixChave] = useState(activeDriver.pixChave || "");
  const [pixTipoChave, setPixTipoChave] = useState<'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'EVP'>(activeDriver.pixTipoChave || "CPF");
  const [pixNomeRecebedor, setPixNomeRecebedor] = useState(activeDriver.pixNomeRecebedor || "");
  const [pixCidadeRecebedor, setPixCidadeRecebedor] = useState(activeDriver.pixCidadeRecebedor || "");

  // Intelligent Payment States
  const [acceptsPix, setAcceptsPix] = useState(activeDriver.acceptsPix ?? true);
  const [acceptsCash, setAcceptsCash] = useState(activeDriver.acceptsCash ?? true);
  const [acceptsCard, setAcceptsCard] = useState(activeDriver.acceptsCard ?? false);
  const [hasMachine, setHasMachine] = useState(activeDriver.hasMachine ?? false);
  const [usesTapToPay, setUsesTapToPay] = useState(activeDriver.usesTapToPay ?? false);
  const [tapToPayApp, setTapToPayApp] = useState(activeDriver.tapToPayApp || "");
  const [hasNfcHardware, setHasNfcHardware] = useState(activeDriver.hasNfcHardware ?? false);

  // Waiting Time State
  const [isWaiting, setIsWaiting] = useState(false);
  const [waitingStartTime, setWaitingStartTime] = useState<number | null>(null);
  const [elapsedWaitingSeconds, setElapsedWaitingSeconds] = useState(0);
  const waitingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showPixTipoChaveDropdown, setShowPixTipoChaveDropdown] = useState(false);
  const [showTapToPayAppDropdown, setShowTapToPayAppDropdown] = useState(false);
  
  // Contract enforcement states
  const [latestContractVersion, setLatestContractVersion] = useState<number | null>(null);
  const [showContract, setShowContract] = useState(false);
  const [contractLoading, setContractLoading] = useState(true);

  // Credit wallet and admin approval warning states
  const [showApprovalWarning, setShowApprovalWarning] = useState(false);
  const [showRechargeModal, setShowRechargeModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferAmount, setTransferAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [financialLoading, setFinancialLoading] = useState(false);
  const [financialError, setFinancialError] = useState<string | null>(null);

  const [showSupport, setShowSupport] = useState(false);
  const [rechargeAmount, setRechargeAmount] = useState("30");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Directly update payment status in Supabase and emit websocket event for sync
  const handleUpdatePayment = async (status: 'confirmado' | 'pago_dinheiro' | 'pago_cartao') => {
    if (!activeRequest) return;
    try {
      const { error } = await supabase
        .from("rides")
        .update({
          status_pagamento: status
        })
        .eq("id", activeRequest.id);

      if (error) throw error;

      if (socket) {
        socket.emit("updatePaymentStatus", {
          rideId: activeRequest.id,
          statusPagamento: status
        });
      }
    } catch (err) {
      console.error("Error setting dynamic payment status: ", err);
    }
  };

  // Sync internal form parameters if the active profile updates
  useEffect(() => {
    setRate(activeDriver.valorKm.toString());
    setBase(activeDriver.taxaSaida.toString());
    setRadius(activeDriver.raioMaximo.toString());
    setAcceptsMoto(activeDriver.modalidades.includes("moto"));
    setAcceptsFlash(activeDriver.modalidades.includes("moto_flash"));
    setPixChave(activeDriver.pixChave || "");
    setPixTipoChave(activeDriver.pixTipoChave || "CPF");
    setPixNomeRecebedor(activeDriver.pixNomeRecebedor || "");
    setPixCidadeRecebedor(activeDriver.pixCidadeRecebedor || "");
    setAcceptsPix(activeDriver.acceptsPix ?? true);
    setAcceptsCash(activeDriver.acceptsCash ?? true);
    setAcceptsCard(activeDriver.acceptsCard ?? false);
    setHasMachine(activeDriver.hasMachine ?? false);
    setUsesTapToPay(activeDriver.usesTapToPay ?? false);
    setTapToPayApp(activeDriver.tapToPayApp || "");
    setHasNfcHardware(activeDriver.hasNfcHardware ?? false);
  }, [activeDriver]);

  // Handle configuration updates
  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    const modes: ModalidadeCorrida[] = [];
    if (acceptsMoto) modes.push("moto");
    if (acceptsFlash) modes.push("moto_flash");

    onUpdateDriver({
      ...activeDriver,
      valorKm: parseFloat(rate) || 2.00,
      taxaSaida: parseFloat(base) || 5.00,
      raioMaximo: parseFloat(radius) || 5.0,
      modalidades: modes.length > 0 ? modes : ["moto"],
      pixChave,
      pixTipoChave,
      pixNomeRecebedor,
      pixCidadeRecebedor,
      acceptsPix,
      acceptsCash,
      acceptsCard,
      hasMachine,
      usesTapToPay,
      tapToPayApp,
      hasNfcHardware
    });

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  // Execute Simulated Instant Credit Pocket Deposit (Removed old logic)
  const handleToggleOnline = () => {
    if (!activeDriver.online) {
      // Trying to switch online
      if (activeDriver.approved !== "aprovado") {
        setShowApprovalWarning(true);
        return;
      }
      const balance = activeDriver.creditsBalance !== undefined ? activeDriver.creditsBalance : 50.00;
      if (balance < settings.saldoMinimoOnline) {
        setShowRechargeModal(true);
        return;
      }
    }

    onUpdateDriver({
      ...activeDriver,
      online: !activeDriver.online
    });
  };

  // Sum driver absolute profits
  const todayEarnings = driverHistory.reduce((acc, item) => {
    return item.status === "finalizado" ? acc + item.totalCost : acc;
  }, 0);

  // Waiting Timer Logic
  useEffect(() => {
    if (isWaiting && waitingStartTime) {
      waitingTimerRef.current = setInterval(() => {
        const now = Date.now();
        const elapsed = Math.floor((now - waitingStartTime) / 1000);
        setElapsedWaitingSeconds(elapsed);
      }, 1000);
    } else {
      if (waitingTimerRef.current) clearInterval(waitingTimerRef.current);
    }
    return () => {
      if (waitingTimerRef.current) clearInterval(waitingTimerRef.current);
    };
  }, [isWaiting, waitingStartTime]);

  const handleStartWaiting = () => {
    setIsWaiting(true);
    setWaitingStartTime(Date.now());
    setElapsedWaitingSeconds(0);
    
    if (socket && activeRequest) {
      socket.emit("waiting_started", {
        rideId: activeRequest.id,
        timestamp: new Date().toISOString()
      });
    }
  };

  const handleStopWaiting = async () => {
    if (!activeRequest || !waitingStartTime) return;

    const endTime = Date.now();
    const durationSeconds = Math.floor((endTime - waitingStartTime) / 1000);
    const durationMinutes = durationSeconds / 60;
    
    // Calculate cost
    const freeMinutes = settings.minutosGratisEspera || 5;
    const ratePerMin = settings.valorMinutoEspera || 0.5;
    const minWaitingCost = settings.valorMinimoEspera || 2.0;

    let cost = 0;
    if (durationMinutes > freeMinutes) {
      cost = (durationMinutes - freeMinutes) * ratePerMin;
      if (cost < minWaitingCost) cost = minWaitingCost;
    }

    const log = {
      startTime: new Date(waitingStartTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
      durationMinutes: parseFloat(durationMinutes.toFixed(2)),
      cost: parseFloat(cost.toFixed(2))
    };

    setIsWaiting(false);
    setWaitingStartTime(null);
    setElapsedWaitingSeconds(0);

    // Update ride in Supabase
    try {
      const updatedTotalWaitingCost = (activeRequest.waitingTimeCost || 0) + log.cost;
      const updatedTotalCost = activeRequest.totalCost + log.cost;
      const currentLogs = activeRequest.waitingLogs || [];

      const { error } = await supabase
        .from("rides")
        .update({
          waiting_logs: [...currentLogs, log],
          waiting_time_cost: updatedTotalWaitingCost,
          total_cost: updatedTotalCost
        })
        .eq("id", activeRequest.id);

      if (error) throw error;

      if (socket) {
        socket.emit("waiting_ended", {
          rideId: activeRequest.id,
          log,
          newTotalCost: updatedTotalCost
        });
      }
    } catch (err) {
      console.error("Error saving waiting log:", err);
    }
  };

  const formatWaitingTimer = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  // Coordinates converted from [lng, lat] to Leaflet standard object format [lat, lng]
  const currentLatCoords: [number, number] = [activeDriver.currentCoords[1], activeDriver.currentCoords[0]];

  // Fetch latest contract version to enforce acceptance
  useEffect(() => {
    const checkContract = async () => {
      try {
        const { data, error } = await supabase
          .from("contracts")
          .select("version")
          .eq("active", true)
          .order("version", { ascending: false })
          .limit(1);

        if (error) throw error;

        let currentVer = 1; // Fallback version 1
        if (data && data.length > 0) {
          currentVer = data[0].version;
        }
        setLatestContractVersion(currentVer);
        
        // If driver hasn't accepted the latest version, force them to
        if (activeDriver.contractAcceptedVersion !== currentVer?.toString()) {
          setShowContract(true);
        }
      } catch (err) {
        console.error("Error checking contract version:", err);
      } finally {
        setContractLoading(false);
      }
    };
    checkContract();
  }, [activeDriver.contractAcceptedVersion]);

  // Simulated NFC Detection
  useEffect(() => {
    // Detect NFC hardware capability
    const checkNfc = async () => {
      if ('NDEFReader' in window) {
        setHasNfcHardware(true);
      } else {
        // Fallback simulation for common android environments or mocked state
        setHasNfcHardware(true); // Default to true in our sandbox for testing 'Tap to Pay'
      }
    };
    checkNfc();
  }, []);

  // Determine if active client matches this specific driver id
  const hasIncomingMatch = activeRequest && activeRequest.driverId === activeDriver.id;

  const handleShowRecharge = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowRechargeModal(true);
  };

  const handleTransfer = async () => {
    if (!transferAmount || isNaN(Number(transferAmount))) return;
    setFinancialLoading(true);
    setFinancialError(null);
    try {
      await transferToCredits(activeDriver.id, Number(transferAmount));
      setTransferAmount("");
      setShowTransferModal(false);
      // Data will sync via parent listener/props
    } catch (err: any) {
      setFinancialError(err.message || "Erro ao transferir.");
    } finally {
      setFinancialLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || isNaN(Number(withdrawAmount))) return;
    if (!activeDriver.pixChave) {
      setFinancialError("Configure sua chave PIX nas configurações antes de sacar.");
      return;
    }
    setFinancialLoading(true);
    setFinancialError(null);
    try {
      await requestWithdrawal({
        driverId: activeDriver.id,
        driverName: activeDriver.name,
        amount: Number(withdrawAmount),
        pixChave: activeDriver.pixChave || "",
        pixTipoChave: activeDriver.pixTipoChave || "CPF"
      });
      setWithdrawAmount("");
      setShowWithdrawModal(false);
    } catch (err: any) {
      setFinancialError(err.message || "Erro ao solicitar saque.");
    } finally {
      setFinancialLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start pb-12 animate-fade-in text-zinc-100">
      
      {/* Contract Enforcement Modal */}
      <AnimatePresence>
        {showContract && (
          <ContractModal 
            driver={activeDriver} 
            onAcceptSuccess={(updated) => {
              onUpdateDriver(updated);
              setShowContract(false);
            }} 
          />
        )}
      </AnimatePresence>

      {/* DRIVER LEFT PANEL: Active dispatcher and statistics */}
      <div className="lg:col-span-5 space-y-5">
        
        {/* ONLINE STATUS TOGGLE CONTROLLERS */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-xl flex items-center justify-between gap-4">
          <div className="truncate">
            <span className="text-[9px] text-zinc-500 uppercase font-extrabold tracking-wider">Vouali e chego bem</span>
            <h4 className="text-sm font-black text-zinc-100 uppercase">
              {activeDriver.online ? `● Conectado em ${activeDriver.pixCidadeRecebedor ? activeDriver.pixCidadeRecebedor.charAt(0).toUpperCase() + activeDriver.pixCidadeRecebedor.slice(1).toLowerCase() : "sua região"}` : "○ Modo Offline Ativo"}
            </h4>
            <p className="text-[10px] text-zinc-400 mt-0.5 truncate">
              {activeDriver.name} • Placa mercosul: {activeDriver.veiculoPlaca}
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowSupport(true)}
              className="p-2.5 bg-zinc-800 hover:bg-blue-500/10 text-zinc-400 hover:text-blue-400 rounded-xl transition-all border border-zinc-800 hover:border-blue-500/30"
              title="Suporte Técnico"
            >
              <Headset className="w-5 h-5" />
            </button>

            <button
              onClick={handleToggleOnline}
              className={`px-4 py-2.5 rounded-xl font-bold uppercase text-xs tracking-wider transition cursor-pointer ${
                activeDriver.online 
                  ? "bg-emerald-500 text-zinc-950 font-black hover:bg-emerald-400 shadow-md shadow-emerald-500/10" 
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              }`}
            >
              {activeDriver.online ? "ONLINE" : "OFFLINE"}
            </button>
          </div>
        </div>

        {/* ACTIVE DISPATCH RIDE REQUESTER ALERT SCREEN */}
        {hasIncomingMatch && activeRequest && (
          <>
            <motion.div
              key={activeRequest.status}
              initial={{ opacity: 0, scale: 0.98, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: -15 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="bg-zinc-900 border-2 border-amber-500 rounded-2xl p-5 shadow-2xl relative space-y-4"
            >
              
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <span className="text-[9px] bg-amber-500 text-zinc-950 px-2 py-0.5 rounded font-black uppercase tracking-wider flex items-center gap-1">
                  <Bell className="w-3 h-3 animate-pulse" /> Vouali e chego bem
                </span>
                <span className="text-[10px] text-zinc-400 font-mono">Modo: {activeRequest.modalidade.toUpperCase()}</span>
              </div>

              {activeRequest.status === "procurando" ? (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">Cliente Solicitante</p>
                    <h3 className="text-sm font-black text-zinc-100">{activeRequest.clientName}</h3>
                    <p className="text-[10px] text-zinc-400 font-mono">Endereço de Viagem:</p>
                    <p className="text-xs bg-zinc-950 border border-zinc-850 p-2 rounded-lg text-zinc-200">
                      🏁 {activeRequest.endAddress}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 bg-zinc-950/80 border border-zinc-850 p-2.5 rounded-xl text-center gap-2">
                    <div>
                      <span className="text-zinc-500 text-[9px] uppercase tracking-wide block">Ganhos Estimados</span>
                      <strong className="text-amber-500 font-mono text-base font-black">R$ {activeRequest.totalCost.toFixed(2)}</strong>
                    </div>
                    <div>
                      <span className="text-zinc-500 text-[9px] uppercase tracking-wide block">Distância Total</span>
                      <strong className="text-zinc-200 font-mono text-base font-bold">{activeRequest.distance.toFixed(1)} KM</strong>
                    </div>
                  </div>

                  {activeRequest.observacoes && (
                    <p className="text-[10px] text-zinc-400 italic bg-amber-500/5 px-2.5 py-1.5 rounded-lg border border-amber-500/10">
                      📝 <strong>OBS:</strong> {activeRequest.observacoes}
                    </p>
                  )}

                  {/* INFO TROCO (INTELIGENTE) */}
                  {activeRequest.formaPagamento === "Dinheiro" && activeRequest.precisaTroco && (
                    <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl space-y-2 animate-pulse">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-amber-500 uppercase">Necessário levar Troco</span>
                        <Coins className="w-4 h-4 text-amber-500" />
                      </div>
                      <div className="grid grid-cols-2 text-[10px] gap-2 pt-1">
                        <div className="bg-zinc-950 p-1.5 rounded-lg border border-zinc-800">
                          <span className="text-zinc-500 block uppercase tracking-tighter">Troco Para</span>
                          <strong className="text-zinc-100 font-mono">R$ {activeRequest.trocoPara?.toFixed(2)}</strong>
                        </div>
                        <div className="bg-zinc-950 p-1.5 rounded-lg border border-zinc-800">
                          <span className="text-zinc-500 block uppercase tracking-tighter">Levar Exato</span>
                          <strong className="text-amber-500 font-mono">R$ {(Number(activeRequest.trocoPara) - activeRequest.totalCost).toFixed(2)}</strong>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* INFO SALDO VOUALI (PLATAFORMA) */}
                  {activeRequest.formaPagamento === "Saldo Vouali" && (
                    <div className="bg-amber-500 border border-amber-600 p-3 rounded-xl space-y-1 shadow-lg shadow-amber-500/20 animate-fade-in">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-black uppercase tracking-widest">Saldo Vouali (Pago via Carteira)</span>
                        <ShieldCheck className="w-4 h-4 text-black" />
                      </div>
                      <p className="text-[9px] text-black/80 font-bold leading-tight">
                        🔒 Este pagamento é garantido pela Vouali. O valor será creditado automaticamente no seu saldo pix assim que finalizar a corrida.
                      </p>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={onDeclineRequest}
                      className="w-1/2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-black hover:font-black border border-red-500/20 py-2.5 rounded-xl text-xs uppercase tracking-wider transition cursor-pointer"
                    >
                      Recusar
                    </button>
                    <button
                      onClick={onAcceptRequest}
                      className="w-1/2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black py-2.5 rounded-xl text-xs uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/15"
                    >
                      Aceitar Corrida
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-3 bg-zinc-950 border border-zinc-850 rounded-xl space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-400">Corrida com {activeRequest.clientName}</span>
                      <strong className="text-amber-500 font-mono">R$ {activeRequest.totalCost.toFixed(2)}</strong>
                    </div>
                    
                    <div className="space-y-1 mt-2 border-l-2 border-amber-500/30 pl-2">
                       <p className="text-[10px] text-zinc-400 truncate"><strong>Partida:</strong> {activeRequest.startAddress}</p>
                       
                       {activeRequest.stops && activeRequest.stops.length > 0 && activeRequest.stops.map((stop, sidx) => (
                         <p key={sidx} className="text-[10px] text-amber-500/80 truncate">
                           <strong>Parada {sidx + 1}:</strong> {stop.address}
                         </p>
                       ))}
                       
                       <p className="text-[10px] text-zinc-405 truncate"><strong>Destino:</strong> {activeRequest.endAddress}</p>
                    </div>
                  </div>

                  {/* DETALHE DO PAGAMENTO (PRO MOTORISTA VER E CONFIRMAR) */}
                  <div className="bg-zinc-950/80 border border-zinc-850 rounded-xl p-3.5 space-y-3">
                    <div className="flex items-center justify-between text-[10px] uppercase font-bold tracking-wider text-zinc-400">
                      <span>Forma Selecionada</span>
                      <span className={`px-2 py-0.5 rounded font-black text-[9px] uppercase ${
                        activeRequest.formaPagamento === "PIX" 
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                          : activeRequest.formaPagamento === "Dinheiro"
                          ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          : activeRequest.formaPagamento === "Saldo Vouali"
                          ? "bg-amber-500 text-black border border-amber-500 shadow-md shadow-amber-500/10"
                          : activeRequest.formaPagamento === "Cartão"
                          ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                          : "bg-violet-500/10 text-violet-400 border border-violet-500/20"
                      }`}>
                        ⚡ {activeRequest.formaPagamento === "Saldo Vouali" ? "VOUALI WALLET" : activeRequest.formaPagamento === "Aproximação" ? "NFC / APROX." : activeRequest.formaPagamento || "PIX"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 text-xs gap-2 pt-1">
                      <div>
                        <span className="text-zinc-500 block text-[9px] uppercase tracking-wide">Valor do Trajeto</span>
                        <strong className="text-sm font-mono text-amber-500 font-black">R$ {activeRequest.totalCost.toFixed(2)}</strong>
                      </div>

                      <div>
                        <span className="text-zinc-500 block text-[9px] uppercase tracking-wide">Status Checkout</span>
                        <span className={`inline-block text-[9px] uppercase font-black px-2 py-0.5 rounded mt-0.5 ${
                          ["pago", "confirmado", "pago_dinheiro", "pago_cartao"].includes(activeRequest.statusPagamento || "")
                            ? "bg-emerald-500 text-zinc-950 font-black"
                            : "bg-amber-500/15 text-amber-400 border border-amber-500/20 animate-pulse"
                        }`}>
                          {["pago", "confirmado", "pago_dinheiro", "pago_cartao"].includes(activeRequest.statusPagamento || "")
                            ? "✓ PAGO"
                            : "⌛ AGUARDANDO"}
                        </span>
                      </div>
                    </div>

                    {/* Deferred payment reminder during transit */}
                    {activeRequest.status !== "finalizado" && (
                      <div className="bg-amber-500/5 p-2 rounded-lg border border-amber-500/10 text-[9px] text-amber-400 text-center uppercase tracking-wider font-bold">
                        🔒 O recebimento será liberado assim que você finalizar a corrida.
                      </div>
                    )}
                  </div>

                  {/* TRIP MILESTONES OR PAYMENT SETTLEMENT ACTIONS */}
                  <div className="space-y-2">
                    {/* Active In-Transit milestones */}
                    {activeRequest.status === "aceito" && (
                      <button
                        onClick={() => onProgressRequest("a_caminho")}
                        className="w-full bg-amber-500 hover:bg-amber-400 text-black font-black py-3 rounded-xl text-xs uppercase tracking-wider transition cursor-pointer"
                      >
                        📍 Cheguei
                      </button>
                    )}

                    {activeRequest.status === "a_caminho" && (
                      <div className="space-y-3">
                        <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl text-center">
                          <p className="text-[10px] text-amber-500 font-bold uppercase">Motorista no Local</p>
                          <p className="text-[9px] text-zinc-400 mt-1">Aguardando embarque do passageiro para iniciar.</p>
                        </div>
                        <button
                          onClick={() => onProgressRequest("em_andamento")}
                          className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-black py-3 rounded-xl text-xs uppercase tracking-wider transition cursor-pointer shadow-lg shadow-emerald-500/20"
                        >
                          🚀 Iniciar corrida
                        </button>
                      </div>
                    )}

                    {activeRequest.status === "em_andamento" && (
                      <div className="space-y-3">
                        {/* WAITING TIME CONTROLS */}
                        <div className={`p-4 rounded-2xl border transition-all ${isWaiting ? "bg-red-500/10 border-red-500 animate-pulse" : "bg-zinc-950 border-zinc-850"}`}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Clock className={`w-4 h-4 ${isWaiting ? "text-red-500" : "text-zinc-500"}`} />
                              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Tempo de Espera</span>
                            </div>
                            <span className={`text-sm font-black font-mono ${isWaiting ? "text-red-500" : "text-zinc-600"}`}>
                              {formatWaitingTimer(elapsedWaitingSeconds)}
                            </span>
                          </div>
                          
                          {isWaiting ? (
                            <button
                              onClick={handleStopWaiting}
                              className="w-full bg-red-600 hover:bg-red-500 text-white font-black py-2 rounded-xl text-[10px] uppercase tracking-widest transition cursor-pointer"
                            >
                              Finalizar Espera
                            </button>
                          ) : (
                            <button
                              onClick={handleStartWaiting}
                              className="w-full bg-zinc-850 hover:bg-zinc-800 text-amber-500 font-black py-2 rounded-xl text-[10px] uppercase tracking-widest transition cursor-pointer border border-zinc-800"
                            >
                              Iniciar Espera (Parada Rápida)
                            </button>
                          )}
                          
                          {isWaiting && (elapsedWaitingSeconds / 60) > (settings.minutosGratisEspera || 5) && (
                            <p className="text-[8px] text-red-500 font-bold uppercase mt-2 text-center animate-bounce">
                              ⚠️ Cobrança Adicional Ativa (R$ {settings.valorMinutoEspera || 0.5}/min)
                            </p>
                          )}
                        </div>

                        {activeRequest.reservedFee && (
                          <div className="bg-zinc-950 border border-zinc-800 p-2.5 rounded-xl flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <ShieldCheck className="w-4 h-4 text-emerald-400" />
                              <span className="text-[9px] text-zinc-400 uppercase font-bold">Taxa Plataforma Reservada</span>
                            </div>
                            <span className="text-xs font-mono text-emerald-400 font-black">R$ {activeRequest.reservedFee.toFixed(2)}</span>
                          </div>
                        )}
                        <button
                          onClick={() => onProgressRequest("finalizado")}
                          className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-black py-3 rounded-xl text-xs uppercase tracking-wider transition cursor-pointer"
                        >
                          🏁 Finalizar corrida
                        </button>
                      </div>
                    )}

                    {/* Post-Trip finalizado settlement console */}
                    {activeRequest.status === "finalizado" && (
                      <div className="space-y-4">
                        {!(["pago", "confirmado", "pago_dinheiro", "pago_cartao"].includes(activeRequest.statusPagamento || "")) ? (
                          <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-850 space-y-3">
                            <span className="text-[10px] text-zinc-400 block uppercase font-black font-mono border-b border-zinc-900 pb-2">
                              👉 Settle Payment Receipt / Registrar Acerto:
                            </span>

                            {activeRequest.formaPagamento === "PIX" && (
                              <button
                                type="button"
                                onClick={() => handleUpdatePayment("confirmado")}
                                className="w-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black py-3 rounded-xl text-xs uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/10 active:scale-95"
                              >
                                📱 Confirmar PIX Recebido (Auto-Aprovado)
                              </button>
                            )}

                            {activeRequest.formaPagamento === "Saldo Vouali" && (
                              <div className="w-full bg-emerald-500 text-zinc-950 font-black py-3 rounded-xl text-xs uppercase tracking-wider text-center flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/10 animate-fade-in">
                                <ShieldCheck className="w-4 h-4" /> Pagamento Autodebitado (Vouali)
                              </div>
                            )}

                            <button
                              type="button"
                              onClick={() => handleUpdatePayment("pago_dinheiro")}
                              className="w-full bg-amber-500/10 hover:bg-amber-500 border border-amber-500/20 text-amber-400 hover:text-black hover:font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                            >
                              💵 Marcar como Pago em Dinheiro (Físico)
                            </button>

                            <button
                              type="button"
                              onClick={() => handleUpdatePayment("pago_cartao")}
                              className="w-full bg-blue-500/10 hover:bg-blue-500 border border-blue-500/20 text-blue-400 hover:text-black hover:font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                            >
                              💳 Marcar como Pago em Cartão (Maquininha)
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="text-center py-4 bg-emerald-555 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-1">
                              <p className="text-emerald-400 font-black text-xs uppercase tracking-widest leading-loose">
                                ✓ ACERTO FINANCEIRO MENSURADO
                              </p>
                              <p className="text-[10px] text-zinc-400">
                                {activeRequest.statusPagamento === "confirmado" || activeRequest.statusPagamento === "pago"
                                  ? "PIX Conferido e Homologado!"
                                  : activeRequest.statusPagamento === "pago_dinheiro"
                                  ? "Saldado em dinheiro físico com sucesso."
                                  : "Saldado em cartão via maquininha eletrônica."}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={onDismissRide}
                              className="w-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black py-3 rounded-xl text-xs uppercase tracking-wider transition cursor-pointer shadow-lg shadow-emerald-500/15"
                            >
                              🏁 Concluir e Voltar para Fila
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex justify-between items-center text-[10px] text-zinc-400 font-medium pt-1">
                      <span className="flex items-center gap-1 font-mono uppercase text-[9px] font-bold">
                        <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping"></span>
                        Status: {activeRequest.status}
                      </span>
                      {activeRequest.status !== "finalizado" && (
                        <button 
                          onClick={onDeclineRequest}
                          className="text-red-400 hover:underline hover:text-red-350 hover:text-red-300 pointer-events-auto cursor-pointer"
                        >
                          Cancelar Viagem
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

            </motion.div>

            {socket && (["aceito", "a_caminho", "em_andamento"].includes(activeRequest.status)) && (
              <ChatBox 
                socket={socket} 
                rideId={activeRequest.id} 
                sender="driver" 
                otherName={activeRequest.clientName || "Passageiro"} 
              />
            )}
          </>
        )}

        {/* NEW DUAL-WALLET FINANCIAL AREA */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-amber-500" /> Painel Financeiro
            </h3>
            <span className="text-[10px] text-zinc-500 font-serif italic">Premium Finance System</span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {/* CARTEIRA DE GANHOS (WITHDRAWABLE) */}
            <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 rounded-3xl p-5 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                <Wallet className="w-24 h-24 text-emerald-500" />
              </div>
              
              <div className="relative z-10 flex flex-col justify-between h-full">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                      <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Carteira de Ganhos</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-zinc-500 text-sm font-medium">R$</span>
                      <h3 className="text-4xl font-black text-emerald-400 font-mono tracking-tighter">
                        {(activeDriver.earningsBalance || 0).toFixed(2)}
                      </h3>
                    </div>
                  </div>
                  <Download className="w-5 h-5 text-zinc-700" />
                </div>

                <div className="mt-8 flex gap-3">
                  <button
                    onClick={() => setShowWithdrawModal(true)}
                    className="flex-1 bg-zinc-100 hover:bg-white text-zinc-950 px-4 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-xl shadow-white/5 active:scale-95 flex items-center justify-center gap-2"
                  >
                    <Download className="w-3.5 h-3.5" /> Solicitar Saque
                  </button>
                  <button
                    onClick={() => setShowTransferModal(true)}
                    className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 px-4 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all border border-zinc-700 active:scale-95 flex items-center justify-center gap-2"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5 text-amber-500" /> Mover p/ Créditos
                  </button>
                </div>
              </div>
            </div>

            {/* CARTEIRA DE CRÉDITOS (PLATFORM) */}
            <div className={`bg-zinc-900 border rounded-3xl p-5 shadow-xl transition-all ${
              (activeDriver.creditsBalance || 0) < settings.saldoMinimoOnline 
                ? "border-red-500/50 bg-red-500/5" 
                : "border-zinc-800"
            }`}>
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-xl ${
                    (activeDriver.creditsBalance || 0) < settings.saldoMinimoOnline ? "bg-red-500/20 text-red-500" : "bg-amber-500/10 text-amber-500"
                  }`}>
                    <Coins className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block">Créditos de Taxas</span>
                    <h4 className={`text-xl font-black font-mono tracking-tight ${
                      (activeDriver.creditsBalance || 0) < settings.saldoMinimoOnline ? "text-red-500" : "text-zinc-100"
                    }`}>
                      R$ {(activeDriver.creditsBalance || 0).toFixed(2)}
                    </h4>
                  </div>
                </div>
                <button
                  onClick={() => setShowRechargeModal(true)}
                  className="bg-amber-500 hover:bg-amber-400 text-zinc-950 px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-amber-500/20 active:scale-95 flex items-center gap-2"
                >
                  Recarregar
                </button>
              </div>

              <div className="flex items-center gap-2 p-2.5 bg-zinc-950/50 rounded-xl border border-zinc-800/50">
                <Info className="w-3.5 h-3.5 text-zinc-500" />
                <p className="text-[9px] text-zinc-400 font-medium leading-tight">
                  {(activeDriver.creditsBalance || 0) >= settings.saldoMinimoOnline 
                    ? `Status: Online. Desco de taxas operacional. Mínimo exigido: R$ ${settings.saldoMinimoOnline.toFixed(2)}`
                    : `Status: Bloqueado. Seu saldo está abaixo do mínimo (R$ ${settings.saldoMinimoOnline.toFixed(2)}). Recarregue para receber corridas.`}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* QUICK STATS MINI GRIDS */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-xl">
             <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide flex items-center gap-1.5">
               <HistoryIcon className="w-3 h-3" /> Ganhos de Hoje
             </span>
             <h3 className="text-xl font-black text-zinc-100 font-mono mt-1">R$ {todayEarnings.toFixed(2)}</h3>
             <p className="text-[8px] text-zinc-500 mt-1 uppercase font-bold tracking-tighter">{driverHistory.length} Viagens Finalizadas</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 shadow-xl">
             <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide flex items-center gap-1.5">
               <TrendingUp className="w-3 h-3" /> Taxas Pagas
             </span>
             <h3 className="text-xl font-black text-amber-500 font-mono mt-1">
               R$ {driverHistory.reduce((acc, r) => acc + (r.platformFee || 0), 0).toFixed(2)}
             </h3>
             <p className="text-[8px] text-zinc-500 mt-1 uppercase font-bold tracking-tighter">Total Taxas Plataforma</p>
          </div>
        </div>

        {/* DRIVER INDIVIDUAL SERVICE CONFIGURATOR */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-4 shadow-xl">
          <div className="flex items-center justify-between pb-1.5 border-b border-zinc-805">
            <h4 className="text-xs font-black uppercase text-zinc-100 tracking-wider flex items-center gap-1.5">
              <Settings className="w-4 h-4 text-amber-500" /> Configuração de Tarifação
            </h4>
            <span className="text-[9px] text-zinc-500 font-mono">Personalizado</span>
          </div>

          <form onSubmit={handleSaveConfig} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Preço por KM (R$)</label>
                <input
                  type="number"
                  step="0.05"
                  required
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-1.5 px-3 text-xs outline-none focus:border-amber-500 transition"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Taxa de Saída (R$)</label>
                <input
                  type="number"
                  step="0.10"
                  required
                  value={base}
                  onChange={(e) => setBase(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-1.5 px-3 text-xs outline-none focus:border-amber-500 transition"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Raio Máximo Atendimento (KM)</label>
                <input
                  type="number"
                  step="0.5"
                  required
                  value={radius}
                  onChange={(e) => setRadius(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-1.5 px-3 text-xs outline-none focus:border-amber-500 transition"
                />
              </div>
            </div>

            <div className="space-y-2 pt-1 border-t border-zinc-800/40">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">Modalidades Atendidas</label>
              
              <div className="grid grid-cols-2 gap-2">
                <div 
                  onClick={() => setAcceptsMoto(!acceptsMoto)}
                  className={`flex items-center justify-between p-3 rounded-xl bg-zinc-950 border border-zinc-850 cursor-pointer transition-all select-none ${
                    acceptsMoto ? "border-amber-500/40 bg-amber-500/5 text-amber-500" : "text-zinc-400"
                  }`}
                >
                  <span className="text-[10px] font-bold uppercase">Moto Passeio</span>
                  <button
                    type="button"
                    className={`w-9 h-5 rounded-full transition-all p-0.5 duration-300 flex items-center ${
                      acceptsMoto ? "bg-amber-500 justify-end" : "bg-zinc-855 justify-start"
                    }`}
                  >
                    <div className="w-3.5 h-3.5 rounded-full bg-zinc-955 shadow-md" />
                  </button>
                </div>
                
                <div 
                  onClick={() => setAcceptsFlash(!acceptsFlash)}
                  className={`flex items-center justify-between p-3 rounded-xl bg-zinc-950 border border-zinc-850 cursor-pointer transition-all select-none ${
                    acceptsFlash ? "border-amber-500/40 bg-amber-500/5 text-amber-500" : "text-zinc-400"
                  }`}
                >
                  <span className="text-[10px] font-bold uppercase">Vouali Flash</span>
                  <button
                    type="button"
                    className={`w-9 h-5 rounded-full transition-all p-0.5 duration-300 flex items-center ${
                      acceptsFlash ? "bg-amber-500 justify-end" : "bg-zinc-855 justify-start"
                    }`}
                  >
                    <div className="w-3.5 h-3.5 rounded-full bg-zinc-955 shadow-md" />
                  </button>
                </div>
              </div>
            </div>

            {/* GESTÃO INTELIGENTE DE PAGAMENTOS (REQUISITO PREMIUM) */}
            <div className="space-y-4 pt-4 border-t border-zinc-800/40">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black text-amber-500 uppercase tracking-widest block">Recebimentos & Pagamentos</label>
                <div className="flex items-center gap-1.5 bg-zinc-950 px-2 py-1 rounded-full border border-zinc-800">
                  <span className={`w-1.5 h-1.5 rounded-full ${hasNfcHardware ? "bg-emerald-500 animate-pulse" : "bg-zinc-600"}`} />
                  <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider">NFC {hasNfcHardware ? "ATIVO" : "INDISP."}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* PIX TOGGLE */}
                <div 
                  onClick={() => setAcceptsPix(!acceptsPix)}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 ${
                    acceptsPix ? "bg-emerald-500/10 border-emerald-500/40" : "bg-zinc-950 border-zinc-850 opacity-60"
                  }`}
                >
                  <span className={`text-lg transition-transform ${acceptsPix ? "scale-110" : ""}`}>📱</span>
                  <span className={`text-[9px] font-black uppercase tracking-wider ${acceptsPix ? "text-emerald-400" : "text-zinc-500"}`}>PIX</span>
                </div>

                {/* DINHEIRO TOGGLE */}
                <div 
                  onClick={() => setAcceptsCash(!acceptsCash)}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 ${
                    acceptsCash ? "bg-amber-500/10 border-amber-500/40" : "bg-zinc-950 border-zinc-850 opacity-60"
                  }`}
                >
                  <span className={`text-lg transition-transform ${acceptsCash ? "scale-110" : ""}`}>💵</span>
                  <span className={`text-[9px] font-black uppercase tracking-wider ${acceptsCash ? "text-amber-500" : "text-zinc-500"}`}>Dinheiro</span>
                </div>

                {/* CARTÃO TOGGLE */}
                <div 
                  onClick={() => setAcceptsCard(!acceptsCard)}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 ${
                    acceptsCard ? "bg-blue-500/10 border-blue-500/40 shadow-lg shadow-blue-500/5" : "bg-zinc-950 border-zinc-850 opacity-60"
                  }`}
                >
                  <span className={`text-lg transition-transform ${acceptsCard ? "scale-110" : ""}`}>💳</span>
                  <span className={`text-[9px] font-black uppercase tracking-wider ${acceptsCard ? "text-blue-400" : "text-zinc-500"}`}>Cartão</span>
                </div>

                {/* NFC / TAP TO PAY TOGGLE */}
                <div 
                  onClick={() => {
                    if (hasNfcHardware) {
                      setUsesTapToPay(!usesTapToPay);
                    }
                  }}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 ${
                    usesTapToPay ? "bg-violet-500/10 border-violet-500/40" : "bg-zinc-950 border-zinc-850 opacity-60"
                  } ${!hasNfcHardware ? "grayscale cursor-not-allowed" : ""}`}
                >
                  <span className={`text-lg transition-transform ${usesTapToPay ? "scale-110" : ""}`}>📡</span>
                  <span className={`text-[9px] font-black uppercase tracking-wider ${usesTapToPay ? "text-violet-400" : "text-zinc-500"}`}>Tap to Pay</span>
                </div>
              </div>

              {/* PIX DETAILED CONFIG (SHOWN ONLY IF PIX ACTIVE) */}
              <AnimatePresence>
                {acceptsPix && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="space-y-2 bg-emerald-500/5 p-3 rounded-2xl border border-emerald-500/10 overflow-hidden"
                  >
                    <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest block mb-2">Dados do Recebedor PIX</span>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="relative">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowPixTipoChaveDropdown(!showPixTipoChaveDropdown);
                          }}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-1.5 px-2 text-[10px] outline-none text-zinc-300 text-left flex items-center justify-between"
                        >
                          <span>{pixTipoChave === "CPF" ? "CPF" : pixTipoChave === "CNPJ" ? "CNPJ" : pixTipoChave === "EMAIL" ? "E-mail" : pixTipoChave === "PHONE" ? "Telefone" : "Chave Aleatória (EVP)"}</span>
                          <span className="text-zinc-500 text-[8px]">▼</span>
                        </button>
                        <AnimatePresence>
                          {showPixTipoChaveDropdown && (
                            <>
                              <div className="fixed inset-0 z-30" onClick={() => setShowPixTipoChaveDropdown(false)} />
                              <motion.div
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 5 }}
                                className="absolute left-0 mt-1 w-full bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl z-40 max-h-40 overflow-y-auto"
                              >
                                {[
                                  { value: "CPF", label: "CPF" },
                                  { value: "CNPJ", label: "CNPJ" },
                                  { value: "EMAIL", label: "E-mail" },
                                  { value: "PHONE", label: "Telefone" },
                                  { value: "EVP", label: "Chave Aleatória (EVP)" }
                                ].map((opt) => (
                                  <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => {
                                      setPixTipoChave(opt.value as any);
                                      setShowPixTipoChaveDropdown(false);
                                    }}
                                    className={`w-full text-left px-3 py-2 text-[10px] hover:bg-zinc-800 transition ${
                                      pixTipoChave === opt.value ? "text-amber-500 font-bold bg-amber-500/5" : "text-zinc-300"
                                    }`}
                                  >
                                    {opt.label}
                                  </button>
                                ))}
                              </motion.div>
                            </>
                          )}
                        </AnimatePresence>
                      </div>
                      <input
                        type="text"
                        placeholder="Chave Pix"
                        value={pixChave}
                        onChange={(e) => setPixChave(e.target.value)}
                        className="bg-zinc-950 border border-zinc-800 rounded-lg py-1 px-2 text-[10px] outline-none text-zinc-100"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Nome Completo"
                        value={pixNomeRecebedor}
                        onChange={(e) => setPixNomeRecebedor(e.target.value)}
                        className="bg-zinc-950 border border-zinc-800 rounded-lg py-1 px-2 text-[10px] outline-none text-zinc-100"
                      />
                      <input
                        type="text"
                        placeholder="Cidade"
                        value={pixCidadeRecebedor}
                        onChange={(e) => setPixCidadeRecebedor(e.target.value)}
                        className="bg-zinc-950 border border-zinc-800 rounded-lg py-1 px-2 text-[10px] outline-none text-zinc-100"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* CARD DETAILED CONFIG (SHOWN ONLY IF CARD ACTIVE) */}
              <AnimatePresence>
                {acceptsCard && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="space-y-3 bg-blue-500/5 p-3 rounded-2xl border border-blue-500/10 overflow-hidden"
                  >
                    <span className="text-[8px] font-black text-blue-400 uppercase tracking-widest block">Configuração de Cartão</span>
                    
                    <div className="flex gap-2">
                       <div 
                         onClick={() => setHasMachine(!hasMachine)}
                         className={`flex-1 flex items-center justify-between p-3 rounded-xl bg-zinc-955 border border-zinc-855 cursor-pointer transition-all select-none ${
                           hasMachine ? "border-blue-500/40 bg-blue-500/5 text-blue-400" : "text-zinc-400"
                         }`}
                       >
                         <span className="text-[9px] font-bold uppercase">Maquininha</span>
                         <button
                           type="button"
                           className={`w-9 h-5 rounded-full transition-all p-0.5 duration-300 flex items-center ${
                             hasMachine ? "bg-blue-500 justify-end" : "bg-zinc-855 justify-start"
                           }`}
                         >
                           <div className="w-3.5 h-3.5 rounded-full bg-zinc-955 shadow-md" />
                         </button>
                       </div>
                       <div 
                         onClick={() => hasNfcHardware && setUsesTapToPay(!usesTapToPay)}
                         className={`flex-1 flex items-center justify-between p-3 rounded-xl bg-zinc-955 border border-zinc-855 cursor-pointer transition-all select-none ${
                           usesTapToPay ? "border-violet-500/40 bg-violet-500/5 text-violet-400" : "text-zinc-400"
                         } ${!hasNfcHardware ? "opacity-40 cursor-not-allowed" : ""}`}
                       >
                         <span className="text-[9px] font-bold uppercase">Tap to Pay</span>
                         <button
                           type="button"
                           disabled={!hasNfcHardware}
                           className={`w-9 h-5 rounded-full transition-all p-0.5 duration-300 flex items-center ${
                             usesTapToPay ? "bg-violet-500 justify-end" : "bg-zinc-855 justify-start"
                           }`}
                         >
                           <div className="w-3.5 h-3.5 rounded-full bg-zinc-955 shadow-md" />
                         </button>
                       </div>
                    </div>

                    {(hasMachine || usesTapToPay) && (
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-wide">Interface / App Utilizado</label>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowTapToPayAppDropdown(!showTapToPayAppDropdown);
                            }}
                            className="w-full bg-zinc-950 border border-zinc-805 rounded-xl py-2 px-3 text-[10px] outline-none text-zinc-300 text-left flex items-center justify-between"
                          >
                            <span>{tapToPayApp || "Selecione o Aplicativo"}</span>
                            <span className="text-zinc-500 text-[8px]">▼</span>
                          </button>
                          <AnimatePresence>
                            {showTapToPayAppDropdown && (
                              <>
                                <div className="fixed inset-0 z-30" onClick={() => setShowTapToPayAppDropdown(false)} />
                                <motion.div
                                  initial={{ opacity: 0, y: 5 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: 5 }}
                                  className="absolute left-0 mt-1 w-full bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-40 max-h-40 overflow-y-auto"
                                >
                                  {[
                                    { value: "", label: "Selecione o Aplicativo" },
                                    { value: "InfinitePay", label: "InfinitePay" },
                                    { value: "Mercado Pago", label: "Mercado Pago" },
                                    { value: "PagBank", label: "PagBank" },
                                    { value: "Ton", label: "Ton" },
                                    { value: "SumUp", label: "SumUp" }
                                  ].map((opt) => (
                                    <button
                                      key={opt.value}
                                      type="button"
                                      onClick={() => {
                                        setTapToPayApp(opt.value);
                                        setShowTapToPayAppDropdown(false);
                                      }}
                                      className={`w-full text-left px-3 py-2 text-[10px] hover:bg-zinc-800 transition ${
                                        tapToPayApp === opt.value ? "text-violet-500 font-bold bg-violet-500/5" : "text-zinc-300"
                                      }`}
                                    >
                                      {opt.label}
                                    </button>
                                  ))}
                                </motion.div>
                              </>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    )}

                    {!hasMachine && !usesTapToPay && (
                      <div className="bg-amber-500/10 p-2 rounded-xl border border-amber-500/20 space-y-1.5">
                        <p className="text-[8px] text-amber-500 font-bold uppercase leading-tight italic">
                          💡 Dica: Você marcou "Aceita Cartão" mas não possui maquininha.
                        </p>
                        <p className="text-[8px] text-zinc-500 leading-normal">
                          Ative o <strong>Tap to Pay</strong> no seu Android {hasNfcHardware ? " (Hardware NFC Detectado)" : ""} para receber por aproximação usando apps como Mercado Pago ou Ton.
                        </p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="w-full bg-zinc-100 hover:bg-zinc-200 text-black font-extrabold uppercase py-2.5 rounded-xl text-xs transition cursor-pointer"
              >
                Salvar Configurações
              </button>
            </div>

            {saveSuccess && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 py-1.5 px-3 rounded-lg text-center text-[10px] uppercase font-bold animate-pulse">
                Tarifas atualizadas com sucesso!
              </div>
            )}
          </form>
        </div>

        {/* TRIP RECIPT HISTORY FOR ACTIVE DRIVER */}
        {driverHistory.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3 shadow-xl">
            <div className="flex items-center justify-between pb-1.5 border-b border-zinc-805">
              <h4 className="text-xs font-black uppercase text-zinc-100 tracking-wider flex items-center gap-1.5">
                <History className="w-4 h-4 text-amber-500" /> Histórico de Corridas do Dia
              </h4>
              <button
                onClick={onClearHistory}
                className="text-[10px] uppercase font-black tracking-wider text-red-500 hover:text-red-400 hover:underline transition cursor-pointer flex items-center gap-1"
                title="Limpar histórico"
              >
                <X className="w-3.5 h-3.5" /> Limpar Tudo
              </button>
            </div>

            <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
              {driverHistory.map((item, index) => (
                <div key={`${item.id}-${index}`} className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-850 space-y-1">
                  <div className="flex items-center justify-between text-[9px]">
                    <span className="text-zinc-500 font-mono">{new Date(item.timestamp).toLocaleTimeString("pt-BR")}</span>
                    <strong className="text-emerald-450 font-bold font-mono">R$ {item.totalCost.toFixed(2)}</strong>
                  </div>
                  <p className="text-[10px] text-zinc-300 truncate"><strong>De:</strong> {item.startAddress}</p>
                  <p className="text-[10px] text-zinc-300 truncate"><strong>Para:</strong> {item.endAddress}</p>
                  <div className="flex justify-between items-center text-[9px] pt-1 border-t border-zinc-800/40">
                    <span className="text-zinc-400 font-bold flex items-center gap-1">
                      👤 {item.clientName}
                      {item.formaPagamento && (
                        <span className="text-[8px] bg-zinc-900 border border-zinc-800 text-zinc-500 px-1 py-0.5 rounded font-black uppercase">
                          {item.formaPagamento}
                        </span>
                      )}
                    </span>
                    <span className="text-[8px] bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded uppercase font-black">{item.modalidade === "moto_flash" ? "Flash" : "Transporte"}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* DRIVER RIGHT PANEL: Real-time map navigation */}
      <div className="lg:col-span-7 h-full space-y-4 lg:sticky lg:top-20">
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-2.5 shadow-xl h-[400px] md:h-[520px] relative">
          {/* Active Navigation Map */}
          <InteractiveMap
            startCoords={
              activeRequest && activeRequest.status !== "procurando"
                ? [activeRequest.startCoords[1], activeRequest.startCoords[0]] // origin coords flipped of the request
                : currentLatCoords
            }
            endCoords={
              activeRequest && activeRequest.status !== "procurando" && activeRequest.status !== "cancelado"
                ? [activeRequest.endCoords[1], activeRequest.endCoords[0]] // destination coords flipped of the request
                : null
            }
            routeGeometry={
              activeRequest && activeRequest.status !== "procurando" && activeRequest.geometry
                ? activeRequest.geometry.map(pt => [pt[1], pt[0]]) // flipped road line geometries
                : []
            }
            raioCobranca={settings.raioCobranca}
            drivers={[]} // Hide other drivers on driver personal maps
            activeRideDriverId={activeDriver.id}
            driverLiveCoords={
              activeRequest && activeRequest.status !== "procurando" && activeRequest.status !== "finalizado" && activeRequest.status !== "cancelado"
                ? (activeRequest.driverCoords ? [activeRequest.driverCoords[1], activeRequest.driverCoords[0]] : null)
                : currentLatCoords // Shows driver personal position if no active request
            }
          />
        </div>
      </div>

      {/* OVERLAY PANEL MODALS FOR RESTORING CREDITS AND APPROVAL CHECK */}
      <AnimatePresence>
        {/* 1. MANUAL APPROVAL AUDIT ALERT BANNER */}
        {showApprovalWarning && (
          <div className="fixed inset-0 z-[2028] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowApprovalWarning(false)}
              className="absolute inset-0 bg-zinc-950/80 backdrop-blur-md"
            ></motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl z-10 text-center space-y-4"
            >
              <div className="mx-auto w-12 h-12 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/25">
                <AlertOctagon className="w-6 h-6 animate-pulse" />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-sm font-black uppercase text-zinc-100 tracking-tight">Cadastro em Análise Manual</h3>
                <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wide ${
                  activeDriver.approved === "recusado" ? "bg-red-500/20 text-red-400" : "bg-amber-500/15 text-amber-500"
                }`}>
                  Status: {activeDriver.approved || "pendente"}
                </span>
              </div>

              <p className="text-[11px] text-zinc-400 leading-relaxed font-sans">
                Todo mototaxista do Vouali passa por auditoria e aprovação manual de documento. 
                {activeDriver.approved === "recusado" ? (
                  <div className="mt-3 p-3 bg-red-500/10 rounded-xl border border-red-500/20 text-red-400 text-left">
                    <strong>Motivo de recusa:</strong> {activeDriver.docRejectionReason || "Por favor, altere seus dados em Configuração de Tarifação."}
                  </div>
                ) : (
                  "Nossos administradores estão avaliando sua CNH, selfie de identificação, e placa do veículo cadastrado no Salvador Digital Hub. Você receberá um alerta automático em breve!"
                )}
              </p>

              <div className="pt-2">
                <button
                  onClick={() => setShowApprovalWarning(false)}
                  className="w-full bg-zinc-100 hover:bg-zinc-200 text-black font-extrabold uppercase py-2.5 rounded-xl text-xs transition cursor-pointer"
                >
                  Entendi, aguardar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showTransferModal && (
          <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-5"
            >
              <div className="text-center space-y-1">
                <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <ArrowRightLeft className="w-6 h-6 text-amber-500" />
                </div>
                <h3 className="text-xl font-black uppercase tracking-tight text-white">Transferência</h3>
                <p className="text-xs text-zinc-400">Mover saldo de Ganhos para Créditos</p>
              </div>

              <div className="space-y-4 text-zinc-100">
                <div className="bg-zinc-950 p-3 rounded-2xl border border-zinc-850 flex justify-between items-center">
                  <span className="text-[10px] font-black text-zinc-500 uppercase">Saldo Disponível</span>
                  <span className="text-sm font-black text-emerald-400 font-mono">R$ {(activeDriver.earningsBalance || 0).toFixed(2)}</span>
                </div>

                <div className="space-y-1.5 text-left">
                  <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Valor a Transferir</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 font-bold">R$</span>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={transferAmount}
                      onChange={(e) => setTransferAmount(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-zinc-100 font-mono outline-none focus:border-amber-500 transition-all"
                    />
                  </div>
                </div>

                {financialError && (
                  <p className="text-[10px] text-red-500 font-bold text-center animate-pulse">
                    ⚠️ {financialError}
                  </p>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowTransferModal(false)}
                    className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 font-bold py-3 rounded-xl text-[10px] uppercase tracking-widest transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleTransfer}
                    disabled={financialLoading || !transferAmount}
                    className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-black py-3 rounded-xl text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
                  >
                    {financialLoading ? "Processando..." : "Confirmar"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showWithdrawModal && (
          <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-5"
            >
              <div className="text-center space-y-1">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Download className="w-6 h-6 text-zinc-950" />
                </div>
                <h3 className="text-xl font-black uppercase tracking-tight text-white">Solicitar Saque</h3>
                <p className="text-xs text-zinc-400">Receba seus ganhos via PIX</p>
              </div>

              <div className="space-y-4 text-zinc-100">
                <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-850 space-y-2">
                  <div className="flex justify-between items-center text-[10px] font-black uppercase">
                    <span className="text-zinc-500">Chave PIX Ativa</span>
                    <span className="text-zinc-100 truncate flex-1 text-right ml-2">{activeDriver.pixChave || "Não configurada"}</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-black uppercase">
                    <span className="text-zinc-500">Tipo</span>
                    <span className="text-zinc-100">{activeDriver.pixTipoChave || "---"}</span>
                  </div>
                </div>

                <div className="space-y-1.5 text-left">
                  <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Valor para Saque</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 font-bold">R$</span>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-zinc-100 font-mono outline-none focus:border-amber-500 transition-all"
                    />
                  </div>
                </div>

                {financialError && (
                  <p className="text-[10px] text-red-500 font-bold text-center animate-pulse">
                    ⚠️ {financialError}
                  </p>
                )}

                {!activeDriver.pixChave && (
                  <button
                    onClick={() => {
                        setShowWithdrawModal(false);
                        // Force settings view could be added here if we had a tab system
                    }}
                    className="w-full text-[9px] text-amber-500 font-bold uppercase underline text-center"
                  >
                    Configure sua chave PIX antes
                  </button>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowWithdrawModal(false)}
                    className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 font-bold py-3 rounded-xl text-[10px] uppercase tracking-widest transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleWithdraw}
                    disabled={financialLoading || !withdrawAmount || !activeDriver.pixChave}
                    className="flex-1 bg-zinc-100 hover:bg-zinc-200 disabled:opacity-50 text-zinc-950 font-black py-3 rounded-xl text-[10px] uppercase tracking-widest transition-all shadow-xl shadow-white/10 cursor-pointer"
                  >
                    {financialLoading ? "Processando..." : "Solicitar Saque"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <RechargeModal
        isOpen={showRechargeModal}
        onClose={() => setShowRechargeModal(false)}
        userId={activeDriver.id}
        userName={activeDriver.name}
        userRole="driver"
        settings={settings}
      />
      <AnimatePresence>
        {showSupport && (
          <SupportHub 
            userId={activeDriver.id}
            userName={activeDriver.name}
            userRole="driver"
            onClose={() => setShowSupport(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
