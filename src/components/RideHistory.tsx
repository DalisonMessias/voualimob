import { useState } from "react";
import { RideHistoryItem } from "../types";
import { Trash2, MapPin, Calendar, Clock, Navigation, CheckCircle, ExternalLink, Smile, AlertTriangle, X } from "lucide-react";

interface RideHistoryProps {
  history: RideHistoryItem[];
  onClearHistory: () => void;
  onDeleteItem: (id: string) => void;
  onSelectRide: (ride: RideHistoryItem) => void;
}

export default function RideHistory({
  history,
  onClearHistory,
  onDeleteItem,
  onSelectRide,
}: RideHistoryProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  
  const formatCost = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    if (minutes < 1) return "Menos de 1 min";
    return `${minutes} min`;
  };

  const formatDate = (isoStr: string) => {
    try {
      const date = new Date(isoStr);
      return date.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoStr;
    }
  };

  if (history.length === 0) {
    return (
      <div className="text-center py-12 px-4 max-w-md mx-auto space-y-4 animate-fade-in">
        <div className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-500">
          <Smile className="w-8 h-8" />
        </div>
        <div>
          <h3 className="text-base font-bold text-zinc-200">Sem corridas no histórico</h3>
          <p className="text-zinc-500 text-xs mt-1">
            As corridas calculadas ficarão salvas aqui para você acessar ou copiar os valores rapidamente.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* Header and counter */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-zinc-100">Histórico de Corridas</h2>
          <p className="text-zinc-500 text-xs">
            {history.length} {history.length === 1 ? "corrida registrada" : "corridas registradas"}
          </p>
        </div>
        {!showConfirm ? (
          <button
            onClick={() => setShowConfirm(true)}
            className="text-xs text-red-400/85 hover:text-red-400 flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-red-500/10 transition cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Limpar Tudo
          </button>
        ) : (
          <div className="flex items-center gap-2 bg-red-955/30 border border-red-900/30 p-2 rounded-xl animate-fade-in">
            <span className="text-[10px] text-red-400 font-bold flex items-center gap-1 uppercase tracking-wider">
              <AlertTriangle className="w-3.5 h-3.5 text-red-550 animate-pulse" />
              Apagar Histórico?
            </span>
            <button
              onClick={() => {
                onClearHistory();
                setShowConfirm(false);
              }}
              className="text-[10px] bg-red-500 text-black font-mono font-black px-2 py-1 rounded-lg hover:bg-red-400 transition cursor-pointer"
            >
              SIM
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              className="text-[10px] bg-zinc-800 text-zinc-300 font-bold px-2 py-1 rounded-lg hover:bg-zinc-700 transition cursor-pointer"
            >
              NÃO
            </button>
          </div>
        )}
      </div>

      {/* History List */}
      <div className="space-y-3">
        {history.map((item) => (
          <div
            key={item.id}
            className="group relative bg-zinc-900 border border-zinc-800 hover:border-zinc-700/80 rounded-2xl p-4 transition-all duration-150 shadow-md hover:shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 overflow-hidden"
          >
            {/* Left elements: Start -> End and Details */}
            <div className="space-y-3 flex-1">
              {/* Date & Simulator Badge */}
              <div className="flex items-center gap-2.5 text-[10px] text-zinc-500 font-mono">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-zinc-500" />
                  {formatDate(item.timestamp)}
                </span>
                <span className="text-zinc-700">•</span>
                {item.simulated ? (
                  <span className="bg-zinc-950 font-bold px-2 py-0.5 rounded text-zinc-500 border border-zinc-800/40">
                    ROTA LOCAL (MOCK)
                  </span>
                ) : (
                  <span className="bg-emerald-950/40 font-bold px-2 py-0.5 rounded text-emerald-400 border border-emerald-900/40">
                    REALTIME ORS
                  </span>
                )}
              </div>

              {/* Path Addresses layout */}
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 mt-1.5"></div>
                  <div className="text-xs text-zinc-300 font-medium leading-normal line-clamp-1">
                    <span className="text-zinc-500 text-[10px] uppercase font-mono mr-1">DE:</span>
                    {item.startAddress}
                  </div>
                </div>

                <div className="flex items-start gap-2 border-l border-zinc-800 ml-0.5 pl-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-1.5"></div>
                  <div className="text-xs text-zinc-200 font-bold leading-normal line-clamp-1 font-sans">
                    <span className="text-zinc-500 text-[10px] uppercase font-mono mr-1">PARA:</span>
                    {item.endAddress}
                  </div>
                </div>
              </div>

              {/* Ride Metrics */}
              <div className="flex items-center gap-4 text-xs font-mono text-zinc-400 pt-1">
                <span className="flex items-center gap-1">
                  <Navigation className="w-3.5 h-3.5 text-amber-500/80" />
                  {item.distance.toFixed(1)} KM
                </span>
                <span className="text-zinc-800">•</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-blue-400/80" />
                  {formatDuration(item.duration)}
                </span>
              </div>
            </div>

            {/* Right: Cost and Actions */}
            <div className="flex sm:flex-row md:flex-col items-center justify-between md:justify-center gap-3 border-t md:border-t-0 border-zinc-800/50 pt-3.5 md:pt-0 shrink-0">
              {/* Cost card */}
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wider font-bold text-zinc-500 font-mono">
                  Tarifado
                </div>
                <div className="text-lg font-mono font-black text-amber-500">
                  {formatCost(item.totalCost)}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => onSelectRide(item)}
                  title="Carregar corrida na Calculadora"
                  className="bg-zinc-950 hover:bg-zinc-800 text-zinc-300 hover:text-amber-500 p-2 rounded-xl border border-zinc-800 transition flex items-center gap-1 text-[11px] font-medium grow md:grow-0 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Carregar
                </button>
                <button
                  onClick={() => onDeleteItem(item.id)}
                  title="Excluir do Histórico"
                  className="text-zinc-505 hover:text-red-450 p-2 rounded-xl hover:bg-red-500/10 transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
