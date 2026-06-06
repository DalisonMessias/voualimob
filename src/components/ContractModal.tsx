import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ShieldCheck, FileText, CheckCircle2, ChevronRight, AlertCircle, Clock } from "lucide-react";
import { Contract, MototaxistaProfile } from "../types";
import { supabase } from "../lib/supabase";

interface ContractModalProps {
  driver: MototaxistaProfile;
  onAcceptSuccess: (updatedDriver: MototaxistaProfile) => void;
}

export default function ContractModal({ driver, onAcceptSuccess }: ContractModalProps) {
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepted, setAccepted] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);

  useEffect(() => {
    const fetchLatestContract = async () => {
      try {
        const { data, error: fetchErr } = await supabase
          .from("contracts")
          .select("*")
          .eq("active", true)
          .order("version", { ascending: false })
          .limit(1);

        if (fetchErr) throw fetchErr;

        if (data && data.length > 0) {
          const contractData = data[0];
          setContract({
            id: contractData.id,
            version: contractData.version,
            content: contractData.content,
            active: contractData.active,
            createdAt: contractData.created_at,
            updatedAt: contractData.updated_at,
            createdBy: contractData.created_by
          });
        } else {
          // Fallback static contract if none exists in DB yet
          setContract({
            id: "initial",
            version: 1,
            content: `
# CONTRATO DE PRESTAÇÃO DE SERVIÇOS E USO DA PLATAFORMA VOUALI

Este Contrato de Prestação de Serviços ("Contrato") disciplina o uso da plataforma Vouali pelo Motorista Parceiro.

## 1. Responsabilidades do Motorista
O motorista é integralmente responsável por manter sua documentação (CNH, documento do veículo, seguros) em dia e válida perante os órgãos competentes.

## 2. Uso da Plataforma
A Vouali é uma plataforma de intermediação tecnológica. O motorista recebe os valores diretamente dos passageiros via PIX ou Dinheiro.

## 3. Taxas e Remuneração
A plataforma cobra uma taxa de intermediação por cada corrida realizada com sucesso. Estas taxas são descontadas do saldo da carteira virtual do motorista dentro do aplicativo.

## 4. Regras de Conduta
O motorista compromete-se a manter um comportamento ético, profissional e respeitoso com todos os passageiros. Fraudes, comportamentos inadequados ou uso indevido da plataforma resultarão em suspensão imediata.

## 5. Cancelamentos e Segurança
O motorista deve priorizar a segurança em todas as viagens. Políticas de cancelamento abusivas podem impactar a visibilidade do motorista na plataforma.

## 6. Aceite Digital
Ao clicar em "Li e aceito os termos", o motorista declara estar ciente de todas as cláusulas e compromete-se a cumpri-as integralmente. O sistema registrará a data, hora, IP e versão do contrato no momento do aceite.
            `,
            active: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: "system"
          });
        }
      } catch (err) {
        console.error("Erro ao buscar contrato:", err);
        setError("Não foi possível carregar os termos de contrato.");
      } finally {
        setLoading(false);
      }
    };

    fetchLatestContract();
  }, []);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight + 50) {
      setHasScrolledToBottom(true);
    }
  };

  const handleAccept = async () => {
    if (!contract || !accepted || !hasScrolledToBottom) return;

    setAccepting(true);
    setError(null);

    try {
      const response = await fetch("/api/driver/accept-contract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: driver.id,
          contractVersion: contract.version
        })
      });

      const result = await response.json();

      if (response.ok) {
        onAcceptSuccess({
          ...driver,
          contractAcceptedVersion: contract.version,
          contractAcceptedAt: new Date().toISOString()
        });
      } else {
        throw new Error(result.error || "Erro ao registrar aceite.");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[100] bg-zinc-950 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-zinc-400 font-bold uppercase tracking-widest text-xs">Carregando Contrato Digital...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] bg-zinc-950/90 backdrop-blur-sm flex items-center justify-center p-4 md:p-6 overflow-hidden">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="p-6 border-b border-zinc-800 flex items-center gap-4 bg-zinc-900/50">
          <div className="p-3 bg-amber-500/10 rounded-2xl text-amber-500">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-zinc-100 uppercase tracking-tight">Contrato Digital Obrigatório</h2>
            <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">Vouali • Versão {contract?.version}.0</p>
          </div>
        </div>

        {/* Content Scroll Area */}
        <div 
          className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 text-zinc-300 leading-relaxed custom-scrollbar"
          onScroll={handleScroll}
        >
          {contract ? (
            <div className="prose prose-invert max-w-none prose-headings:text-amber-500 prose-headings:font-black prose-headings:uppercase prose-headings:tracking-tighter">
              {contract.content.split('\n').map((line, i) => {
                if (line.startsWith('# ')) return <h1 key={i} className="text-2xl mt-4 mb-2">{line.replace('# ', '')}</h1>;
                if (line.startsWith('## ')) return <h2 key={i} className="text-xl mt-6 mb-3">{line.replace('## ', '')}</h2>;
                if (line.trim() === '') return <div key={i} className="h-2" />;
                return <p key={i} className="text-sm mb-2">{line}</p>;
              })}
              
              <div className="mt-8 p-4 bg-zinc-950/50 border border-zinc-800 rounded-2xl space-y-3">
                <div className="flex items-center gap-2 text-zinc-400 text-[10px] uppercase font-bold tracking-wider">
                  <Clock className="w-3 h-3 text-amber-500" />
                  Informações de Registro
                </div>
                <div className="grid grid-cols-2 gap-4 text-[11px]">
                  <div>
                    <span className="text-zinc-500 block uppercase tracking-tighter">Identificação</span>
                    <span className="text-zinc-200">{driver.name}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block uppercase tracking-tighter">Data de Emissão</span>
                    <span className="text-zinc-200">{new Date().toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-40 text-red-400 gap-2">
              <AlertCircle className="w-8 h-8" />
              <p className="font-bold uppercase text-xs">Erro ao carregar o contrato.</p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-zinc-800 bg-zinc-900/50 space-y-4">
          {!hasScrolledToBottom ? (
            <div className="flex items-center justify-center gap-2 text-amber-500 text-[10px] font-black uppercase tracking-widest animate-pulse p-2 bg-amber-500/5 rounded-xl border border-amber-500/10">
              <ChevronRight className="w-4 h-4 rotate-90" />
              Role até o final para habilitar o aceite
            </div>
          ) : (
            <div className="flex items-center gap-3 p-3 bg-emerald-500/5 rounded-2xl border border-emerald-500/10">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <p className="text-[10px] text-emerald-400 font-bold uppercase leading-tight">
                Leitura concluída. Você agora pode aceitar os termos da plataforma.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-4">
            <label className={`flex items-start gap-3 p-4 rounded-2xl border transition-all cursor-pointer ${
              accepted ? "bg-amber-500/10 border-amber-500/40" : "bg-zinc-950 border-zinc-800"
            } ${!hasScrolledToBottom ? "opacity-50 cursor-not-allowed" : ""}`}>
              <div className="mt-0.5">
                <input 
                  type="checkbox" 
                  checked={accepted}
                  disabled={!hasScrolledToBottom}
                  onChange={(e) => setAccepted(e.target.checked)}
                  className="w-5 h-5 accent-amber-500 rounded-lg cursor-pointer"
                />
              </div>
              <div>
                <p className={`text-xs font-black uppercase tracking-tight ${accepted ? "text-amber-500" : "text-zinc-400"}`}>
                  Li e aceito todos os termos do contrato Vouali
                </p>
                <p className="text-[10px] text-zinc-500 mt-1">
                  Ao marcar esta caixa, você concorda juridicamente com todas as cláusulas acima.
                </p>
              </div>
            </label>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-red-500 text-[10px] font-bold uppercase">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            <button
              onClick={handleAccept}
              disabled={!accepted || accepting || !hasScrolledToBottom}
              className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl flex items-center justify-center gap-2 ${
                accepted && hasScrolledToBottom
                  ? "bg-amber-500 text-zinc-950 hover:bg-amber-400 active:scale-[0.98] shadow-amber-500/20" 
                  : "bg-zinc-800 text-zinc-500 cursor-not-allowed shadow-none"
              }`}
            >
              {accepting ? (
                <>
                  <div className="w-4 h-4 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin"></div>
                  Processando Aceite...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" />
                  Confirmar e Ativar Conta
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
