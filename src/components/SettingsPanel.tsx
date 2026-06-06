import React from "react";
import { AppSettings } from "../types";
import { Settings, HelpCircle, Key, Percent, Check, RefreshCw } from "lucide-react";

interface SettingsPanelProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  onResetSettings: () => void;
}

export default function SettingsPanel({
  settings,
  onUpdateSettings,
  onResetSettings,
}: SettingsPanelProps) {
  const [localKey, setLocalKey] = React.useState(settings.apiKeyValue);
  const [saveSuccess, setSaveSuccess] = React.useState(false);
  const [showResetConfirm, setShowResetConfirm] = React.useState(false);

  React.useEffect(() => {
    setLocalKey(settings.apiKeyValue);
  }, [settings.apiKeyValue]);

  const handleChange = (field: keyof AppSettings, value: any) => {
    onUpdateSettings({
      ...settings,
      [field]: value,
    });
  };

  const handleSaveApiKey = () => {
    handleChange("apiKeyValue", localKey);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      {/* Header Info */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500">
          <Settings className="w-6 h-6 animate-spin-slow" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-zinc-100">Painel de Tarifação</h2>
          <p className="text-zinc-500 text-xs uppercase tracking-wider font-bold">Ajuste taxas, raios operacionais e conexões de API</p>
        </div>
      </div>

      {/* Pricing Inputs */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4 shadow-xl">
        <h3 className="text-sm font-bold uppercase tracking-wider text-amber-500 flex items-center gap-2">
          <Percent className="w-4 h-4" /> Valores Base da Corrida
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Taxa de Saída */}
          <div className="space-y-1.5 animate-fade-in">
            <label className="text-xs font-semibold text-zinc-400 block">
              Taxa de Saída (R$)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-zinc-550 font-mono font-bold">R$</span>
              <input
                type="number"
                step="0.50"
                min="0"
                value={settings.taxaSaida}
                onChange={(e) => handleChange("taxaSaida", Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl py-2.5 pl-10 pr-4 text-zinc-200 font-mono text-sm uppercase transition duration-150 outline-none"
                placeholder="5,00"
              />
            </div>
          </div>

          {/* Valor por KM */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-405 block">
              Valor por KM Rodado (R$)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-zinc-550 font-mono font-bold">R$</span>
              <input
                type="number"
                step="0.10"
                min="0"
                value={settings.valorKm}
                onChange={(e) => handleChange("valorKm", Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl py-2.5 pl-10 pr-4 text-zinc-200 font-mono text-sm uppercase transition duration-150 outline-none"
                placeholder="2,00"
              />
            </div>
          </div>
        </div>

        {/* Raio mínimo de cobrança */}
        <div className="space-y-3 pt-3 border-t border-zinc-800/60">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">
              Raio de Isenção ou Filtro Ajustável (KM)
            </label>
            <span className="font-mono text-xs font-black text-amber-500 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20">
              {settings.raioCobranca.toFixed(1)} KM
            </span>
          </div>
          
          <input
            type="range"
            min="3.0"
            max="4.0"
            step="0.1"
            value={settings.raioCobranca}
            onChange={(e) => handleChange("raioCobranca", parseFloat(e.target.value))}
            className="w-full accent-amber-500 range-sm cursor-pointer"
          />
          
          <div className="flex justify-between text-[10px] text-zinc-500 font-mono font-semibold">
            <span>Mínimo: 3.0 KM</span>
            <span>Máximo: 4.0 KM</span>
          </div>

          <div className="bg-zinc-950/60 p-3 rounded-lg border border-zinc-800/40 text-[11px] text-zinc-400 leading-relaxed flex gap-2">
            <HelpCircle className="w-5 h-5 text-amber-500/80 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-zinc-300 uppercase tracking-wider text-[10px]">Regra de Cálculo Inteligente:</p>
              <p className="mt-0.5">
                O raio delimita a zona de partida do mototaxista. O valor por KM é calculado 
                em cima da distância total, mas você pode definir o raio de tolerância (entre 3,0 km e 4,0 km) no qual o mototáxi foca suas corridas principais.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* OpenRouteService Setup */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4 shadow-xl">
        <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
          <Key className="w-4 h-4 text-emerald-500" /> Servidor de Mapas & Chave de API
        </h3>

        <div className="space-y-3">
          <p className="text-xs text-zinc-400 leading-relaxed">
            Este aplicativo calcula distâncias reais de ruas e calçamentos usando a API do 
            <strong className="text-zinc-200"> OpenRouteService</strong>. Adicione uma credencial 
            própria para cálculo de trânsito em tempo real, ou teste livremente o roteador simulado.
          </p>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-400 block">
              OpenRouteService API Key
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                value={localKey}
                onChange={(e) => setLocalKey(e.target.value)}
                className="flex-1 bg-zinc-950 border border-zinc-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl py-2 px-3 text-zinc-200 font-mono text-xs transition duration-150 outline-none"
                placeholder="Insira sua chave (começa com 5b3ce...)"
              />
              <button
                onClick={handleSaveApiKey}
                className="bg-amber-500 text-black hover:bg-amber-400 active:bg-amber-600 px-4 py-2 font-bold text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer"
              >
                {saveSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5 stroke-[3px]" /> Salvo!
                  </>
                ) : (
                  "Aplicar"
                )}
              </button>
            </div>
          </div>

          <div className="bg-emerald-500/5 text-emerald-450/90 border border-emerald-500/10 p-3 rounded-lg text-[11px] leading-relaxed flex items-start gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1 shrink-0 animate-pulse"></div>
            <div>
              <p className="font-bold text-emerald-300 uppercase tracking-wider text-[10px]">Modo de Operação:</p>
              <p className="mt-0.5">
                {settings.apiKeyValue.trim() !== "" 
                  ? "Ativo! O aplicativo está utilizando a sua chave customizada para consultar rotas reais."
                  : "Modo Simulação Ativo: Como você está sem chave API cadastrada, o app usa o roteador geo-analítico super veloz integrado."}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Reset Defaults button */}
      <div className="flex justify-end pr-2">
        {!showResetConfirm ? (
          <button
            onClick={() => setShowResetConfirm(true)}
            className="flex items-center gap-2 text-xs text-zinc-500 hover:text-red-400 transition cursor-pointer font-bold uppercase tracking-wider"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Restaurar Tarifação de Fábrica
          </button>
        ) : (
          <div className="flex items-center gap-2 bg-red-950/20 border border-red-900/30 p-2 rounded-xl animate-fade-in">
            <span className="text-[10px] text-red-400 font-bold uppercase tracking-wider mr-1">
              Restaurar Valores de Fábrica?
            </span>
            <button
              onClick={() => {
                onResetSettings();
                setShowResetConfirm(false);
              }}
              className="text-[10px] bg-red-500 text-black font-black px-2 py-1 rounded-lg hover:bg-red-400 transition cursor-pointer"
            >
              SIM
            </button>
            <button
              onClick={() => setShowResetConfirm(false)}
              className="text-[10px] bg-zinc-800 text-zinc-300 font-bold px-2 py-1 rounded-lg hover:bg-zinc-700 transition cursor-pointer"
            >
              NÃO
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
