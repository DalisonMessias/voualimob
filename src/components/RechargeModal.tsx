// src/components/RechargeModal.tsx
// Modal de Recargas via PIX em tempo real usando Supabase
// UTF-8 Brasil

import React, { useState, useEffect, useRef } from "react";
import QRious from "qrious";
import { 
  X, 
  Copy, 
  Share2, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  QrCode, 
  Wallet,
  ChevronRight,
  ChevronDown,
  Check
} from "lucide-react";
import { supabase, handleSupabaseError } from "../lib/supabase";
import { AppSettings, FinancialTransaction } from "../types";
import { generatePixPayload } from "../lib/pix";

interface RechargeModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  userRole: "driver" | "client";
  settings: AppSettings;
}

export default function RechargeModal({ isOpen, onClose, userId, userName, userRole, settings }: RechargeModalProps) {
  const [amount, setAmount] = useState<string>("50.00");
  const [pixPayload, setPixPayload] = useState<string>("");
  const [status, setStatus] = useState<"input" | "pending" | "confirmed">("input");
  const [copied, setCopied] = useState(false);
  const [activeTxId, setActiveTxId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const pixSettings = settings.pixSettings;

  useEffect(() => {
    if (status === "pending" && pixSettings && parseFloat(amount) > 0) {
      const payload = generatePixPayload({
        key: pixSettings.chave,
        name: pixSettings.nomeRecebedor,
        city: pixSettings.cidade,
        amount: parseFloat(amount),
        description: `REC ${userId.slice(-4).toUpperCase()}`,
        keyType: pixSettings.tipoChave
      });
      setPixPayload(payload);

      if (canvasRef.current) {
        new QRious({
          element: canvasRef.current,
          value: payload,
          size: 240,
          level: 'H'
        });
      }
    }
  }, [status, amount, pixSettings, userId]);

  // Sincronização em tempo real da confirmação da recarga via Supabase
  useEffect(() => {
    if (activeTxId) {
      // 1. Ouvinte em tempo real via canal
      const txChannel = supabase.channel(`recharge_tx_${activeTxId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'financial_transactions',
            filter: `id=eq.${activeTxId}`
          },
          (payload) => {
            const fresh = payload.new;
            if (fresh.status === 'confirmado') {
              setStatus("confirmed");
              setActiveTxId(null);
            }
          }
        )
        .subscribe();

      // 2. Fallback de verificação rápida caso tenha sido confirmada instantaneamente
      const checker = setInterval(() => {
        supabase
          .from('financial_transactions')
          .select('status')
          .eq('id', activeTxId)
          .single()
          .then(({ data }) => {
            if (data && data.status === 'confirmado') {
              setStatus("confirmed");
              setActiveTxId(null);
              clearInterval(checker);
            }
          });
      }, 3000);

      return () => {
        supabase.removeChannel(txChannel);
        clearInterval(checker);
      };
    }
  }, [activeTxId]);

  if (!isOpen) return null;

  const handleStartRecharge = async () => {
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) return;

    setStatus("pending");

    try {
      const payload = generatePixPayload({
        key: pixSettings?.chave || "",
        name: pixSettings?.nomeRecebedor || "",
        city: pixSettings?.cidade || "",
        amount: val,
        description: `REC ${userId.slice(-4).toUpperCase()}`,
        keyType: pixSettings?.tipoChave
      });

      const txId = "tx_rec_" + Date.now();

      // Gravar transação pendente no Supabase
      const { error: insertErr } = await supabase
        .from('financial_transactions')
        .insert({
          id: txId,
          driver_id: userId, // o ID do usuário (cliente ou motorista)
          type: userRole === "driver" ? "recharge_driver" : "recharge_client",
          amount: val,
          balance_after: val, // provisório
          description: `Recarga via PIX - Vouali Wallet`,
          timestamp: new Date().toISOString()
        });

      if (insertErr) throw insertErr;

      setActiveTxId(txId);
    } catch (err) {
      console.error("Erro ao registrar transação no Supabase:", err);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(pixPayload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "PIX Copia e Cola - Vouali",
          text: pixPayload
        });
      } catch (err) {
        console.warn("Erro ao compartilhar:", err);
      }
    } else {
      handleCopy();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-zinc-950/80 backdrop-blur-sm animate-fade-in font-sans">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-[2.5rem] shadow-2xl relative overflow-hidden">
        
        {/* HEADER */}
        <div className="p-6 pb-0 flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-2xl ${status === 'confirmed' ? 'bg-emerald-500 text-zinc-950' : 'bg-amber-500 text-zinc-950'}`}>
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase text-zinc-100 tracking-tighter">Recarga Saldo</h2>
              <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest leading-none mt-1">Vouali Wallet</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 bg-zinc-850 hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 rounded-full transition-all border border-zinc-800 shadow-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 pt-8">
          {status === "input" && (
            <div className="space-y-6">
              <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 shadow-inner text-center">
                <label className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.2em] mb-4 block">Valor para Recarga</label>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-2xl font-black text-amber-500">R$</span>
                  <input 
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="bg-transparent text-5xl font-black text-zinc-100 outline-none w-48 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    autoFocus
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {["20.00", "50.00", "100.00"].map((val) => (
                  <button
                    key={val}
                    onClick={() => setAmount(val)}
                    className={`py-3 rounded-2xl border text-xs font-black uppercase transition-all cursor-pointer ${
                      amount === val 
                        ? "bg-amber-500 border-amber-500 text-zinc-950 shadow-lg shadow-amber-500/20" 
                        : "bg-zinc-850/50 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                    }`}
                  >
                    R$ {val}
                  </button>
                ))}
              </div>

              <button
                onClick={handleStartRecharge}
                disabled={!pixSettings?.ativo || parseFloat(amount) <= 0}
                className="w-full py-5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:grayscale text-zinc-950 font-black uppercase text-xs tracking-[0.1em] rounded-3xl transition-all shadow-xl shadow-amber-500/20 flex items-center justify-center gap-3 active:scale-95 cursor-pointer"
              >
                Gerar PIX para Recarga <ChevronRight className="w-5 h-5" />
              </button>

              {!pixSettings?.ativo && (
                <div className="flex items-center gap-2 text-red-400 text-[10px] font-black uppercase justify-center bg-red-500/10 p-3 rounded-2xl border border-red-500/20 animate-pulse">
                  <AlertCircle className="w-4 h-4" /> O PIX da plataforma está temporariamente desativado
                </div>
              )}
            </div>
          )}

          {status === "pending" && (
            <div className="space-y-6 animate-scale-up">
              <div className="flex flex-col items-center gap-4">
                <div className="bg-white p-4 rounded-3xl shadow-2xl relative overflow-hidden group">
                   <canvas ref={canvasRef} className="w-[200px] h-[200px]" />
                   <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                     <QrCode className="w-12 h-12 text-zinc-950 animate-pulse" />
                   </div>
                </div>

                <div className="text-center space-y-1">
                  <h3 className="text-sm font-black text-zinc-100 uppercase">Escaneie o QR Code</h3>
                  <p className="text-zinc-500 text-[10px] font-bold">Valor: <span className="text-zinc-200 font-mono font-black">R$ {parseFloat(amount).toFixed(2)}</span></p>
                </div>
              </div>

              <div className="space-y-3 font-sans">
                <div className="bg-zinc-950 p-4 rounded-3xl border border-zinc-800 space-y-2">
                   <span className="text-[9px] font-black uppercase text-zinc-500 tracking-wider">PIX Copia e Cola</span>
                   <div className="text-[10px] font-mono text-zinc-400 break-all bg-zinc-900/50 p-3 rounded-xl border border-zinc-800 line-clamp-3">
                     {pixPayload}
                   </div>
                   <div className="flex gap-2">
                     <button
                       onClick={handleCopy}
                       className="flex-1 flex items-center justify-center gap-2 py-3 bg-zinc-850 hover:bg-zinc-800 text-zinc-200 text-[10px] font-black uppercase rounded-2xl transition border border-zinc-800 cursor-pointer"
                     >
                       {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                       {copied ? "Copiado!" : "Copiar Código"}
                     </button>
                     <button
                       onClick={handleShare}
                       className="p-3 bg-zinc-850 hover:bg-zinc-800 text-zinc-200 rounded-2xl border border-zinc-800 transition cursor-pointer"
                     >
                       <Share2 className="w-4 h-4" />
                     </button>
                   </div>
                </div>

                <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-3xl space-y-2">
                   <div className="flex items-center gap-3">
                      <div className="p-2 bg-amber-500 rounded-full">
                        <Clock className="w-4 h-4 text-zinc-950 animate-spin-slow" />
                      </div>
                      <div className="flex-1">
                         <span className="text-[10px] font-black uppercase text-amber-500 block">Aguardando Pagamento</span>
                         <span className="text-[9px] text-zinc-400 block font-medium">O saldo será liberado automaticamente após a confirmação.</span>
                      </div>
                   </div>
                </div>
              </div>

              <button
                onClick={() => setStatus("input")}
                className="w-full py-4 text-zinc-500 hover:text-zinc-300 font-black uppercase text-[10px] tracking-wider transition-all cursor-pointer border-0 bg-transparent"
              >
                Alterar Valor
              </button>
            </div>
          )}

          {status === "confirmed" && (
            <div className="space-y-6 text-center animate-scale-up py-4">
              <div className="flex justify-center">
                <div className="w-24 h-24 bg-emerald-500 text-zinc-950 rounded-full flex items-center justify-center relative shadow-xl shadow-emerald-500/10">
                   <CheckCircle2 className="w-12 h-12" />
                   <div className="absolute inset-0 rounded-full border-4 border-emerald-500 animate-ping opacity-20"></div>
                </div>
              </div>

              <div className="space-y-2">
                <h2 className="text-3xl font-black text-emerald-400 uppercase italic">Sucesso!</h2>
                <h3 className="text-xl font-black text-zinc-100 uppercase tracking-tight">Recarga Aprovada</h3>
                <p className="text-zinc-500 text-xs font-bold px-6">Seu saldo de <span className="text-emerald-400 font-mono">R$ {parseFloat(amount).toFixed(2)}</span> já está disponível na sua carteira.</p>
              </div>

              <div className="bg-zinc-950/50 border border-zinc-800/50 p-6 rounded-[2rem] shadow-inner">
                <div className="flex justify-between items-center text-[10px] text-zinc-500 uppercase font-black">
                  <span>Banco: {pixSettings?.banco || "Plataforma"}</span>
                  <span className="font-mono">{new Date().toLocaleTimeString()}</span>
                </div>
              </div>

              <button
                onClick={onClose}
                className="w-full py-5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black uppercase text-xs tracking-[0.1em] rounded-3xl transition-all shadow-xl shadow-emerald-500/20 active:scale-95 cursor-pointer"
              >
                Concluir Operação
              </button>
            </div>
          )}
        </div>

        {/* FOOTER ACCENT */}
        <div className={`h-1.5 w-full ${status === 'confirmed' ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
      </div>

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scale-up {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
        .animate-scale-up { animation: scale-up 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
        .animate-spin-slow { animation: spin 3s linear infinite; }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
