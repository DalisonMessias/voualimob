import React from "react";
import { 
  Bell, 
  BellRing, 
  BellOff, 
  Smartphone, 
  Sparkles, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  Send,
  Loader2
} from "lucide-react";
import { registerPushNotification, isPushSupported, triggerDemoPush } from "../utils/push";

interface PushNotificationManagerProps {
  userId: string;
  role: "client" | "driver";
}

export default function PushNotificationManager({ userId, role }: PushNotificationManagerProps) {
  const [supported, setSupported] = React.useState(true);
  const [permission, setPermission] = React.useState<NotificationPermission>("default");
  const [isSubscribed, setIsSubscribed] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [testDelayed, setTestDelayed] = React.useState(5); // seconds
  const [testType, setTestType] = React.useState<"new_ride" | "driver_on_way">("new_ride");
  const [testResult, setTestResult] = React.useState<{ success: boolean; message: string } | null>(null);

  // Initialize permission state
  React.useEffect(() => {
    const isSupp = isPushSupported();
    setSupported(isSupp);
    if (isSupp && "Notification" in window) {
      setPermission(Notification.permission);
      // Check if service worker registered subscription is active
      navigator.serviceWorker.ready.then((reg) => {
        reg.pushManager.getSubscription().then((sub) => {
          setIsSubscribed(!!sub);
        });
      });
    }
  }, []);

  const handleSubscribe = async () => {
    setLoading(true);
    setTestResult(null);
    try {
      const success = await registerPushNotification(userId);
      if ("Notification" in window) {
        setPermission(Notification.permission);
      }
      setIsSubscribed(success);
      if (success) {
        setTestResult({
          success: true,
          message: "Excelente! Alertas em segundo plano configurados e prontos."
        });
      } else {
        setTestResult({
          success: false,
          message: "Não foi possível assinar. Verifique se as notificações do navegador estão liberadas."
        });
      }
    } catch (err: any) {
      console.error(err);
      setTestResult({
        success: false,
        message: err.message || "Erro inesperado ao ativar notificações."
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTestNotification = async () => {
    setLoading(true);
    setTestResult(null);

    const title = testType === "new_ride" 
      ? "🛸 Vouali e chego bem - Nova Corrida!" 
      : "⚡ Vouali e chego bem - Motorista a Caminho";
    
    const body = testType === "new_ride"
      ? "Passageiro em Barra para Rio Vermelho de Vouali Flash!"
      : "Seu piloto João aceitou sua corrida e já está com o motor ligado!";

    try {
      const result = await triggerDemoPush(userId, title, body, testDelayed);
      setTestResult(result);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || "Falha de conexão com o servidor de push."
      });
    } finally {
      setLoading(false);
    }
  };

  if (!supported) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-xl text-center">
        <BellOff className="w-10 h-10 text-zinc-650 mx-auto mb-3" />
        <h3 className="text-zinc-200 font-bold mb-1">Push Notifications Não Suportadas</h3>
        <p className="text-zinc-500 text-xs leading-relaxed max-w-sm mx-auto">
          Este navegador não suporta a API de Service Worker ou Push Notifications. Experimente em navegadores modernos como o Chrome, Edge ou Firefox.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
      {/* Configuration Status Card */}
      <div className="md:col-span-6 bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${isSubscribed ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-500"}`}>
              {isSubscribed ? <BellRing className="w-6 h-6" /> : <Bell className="w-6 h-6" />}
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-zinc-100">
                Notificações em Segundo Plano
              </h3>
              <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">
                Fique sabendo de corridas sem precisar estar com a aba ativa
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs border-b border-zinc-800/60 pb-2">
              <span className="text-zinc-455 font-semibold">Permissão no Navegador:</span>
              <span className={`font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                permission === "granted" 
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                  : permission === "denied"
                    ? "bg-red-500/10 text-red-500 border border-red-500/20"
                    : "bg-zinc-800 text-zinc-400 border border-zinc-750"
              }`}>
                {permission === "granted" ? "Permitido" : permission === "denied" ? "Bloqueado" : "Padrão / Perguntar"}
              </span>
            </div>

            <div className="flex justify-between items-center text-xs border-b border-zinc-800/60 pb-2">
              <span className="text-zinc-455 font-semibold">Registro no Vouali:</span>
              <span className={`font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                isSubscribed 
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                  : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
              }`}>
                {isSubscribed ? "Ativo no SW" : "Inativo"}
              </span>
            </div>
          </div>

          <p className="text-[11px] text-zinc-455 leading-relaxed">
            Nossa tecnologia de <strong className="text-zinc-300">Push Notifications via Service Worker</strong> faz conexões de rede em background para te atualizar na hora.
            {role === "driver" 
              ? " Condutores recebem avisos imediatos de novas corridas na rota." 
              : " Passageiros recebem alerta do status do motorista a caminho."}
          </p>
        </div>

        <div className="pt-4 mt-4 border-t border-zinc-800/80 flex items-center gap-3">
          <button
            onClick={handleSubscribe}
            disabled={loading}
            className={`w-full py-2.5 px-4 font-black uppercase text-xs tracking-wider rounded-xl transition duration-150 flex items-center justify-center gap-2 cursor-pointer ${
              isSubscribed
                ? "bg-zinc-800 hover:bg-zinc-750 text-zinc-200 border border-zinc-750"
                : "bg-amber-500 hover:bg-amber-400 text-zinc-950 hover:shadow-lg hover:shadow-amber-500/10"
            }`}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isSubscribed ? (
              <>
                <CheckCircle2 className="w-4 h-4" /> Recadastrar Push
              </>
            ) : (
              <>
                <Smartphone className="w-4 h-4" /> Ativar Alertas no Celular/PC
              </>
            )}
          </button>
        </div>
      </div>

      {/* Simulator / Background Test Card */}
      <div className="md:col-span-6 bg-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-zinc-100">
                Simulador de Segundo Plano
              </h3>
              <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">
                Comprove o funcionamento fechando ou minimizando
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="space-y-1.5Col span">
              <label className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider block">Tipo de Alerta</label>
              <select
                value={testType}
                onChange={(e) => setTestType(e.target.value as any)}
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl px-2.5 py-1.5 text-zinc-300 font-sans text-xs outline-none transition"
              >
                <option value="new_ride">Nova Corrida (Motorista)</option>
                <option value="driver_on_way">Motorista a Caminho (Cliente)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider block">Atraso Agendável</label>
              <select
                value={testDelayed}
                onChange={(e) => setTestDelayed(Number(e.target.value))}
                className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl px-2.5 py-1.5 text-zinc-300 font-mono text-xs outline-none transition"
              >
                <option value={5}>5 Segundos (Rápido)</option>
                <option value={10}>10 Segundos </option>
                <option value={30}>30 Segundos </option>
              </select>
            </div>
          </div>

          <div className="bg-zinc-950/40 p-3 rounded-xl border border-zinc-800/60 text-[11px] leading-relaxed text-zinc-400 flex items-start gap-2.5">
            <Clock className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-extrabold uppercase tracking-wider text-[10px] text-zinc-300">Como testar em Segundo Plano:</h4>
              <ol className="list-decimal pl-4 space-y-1 mt-1 font-sans text-[10.5px]">
                <li>Clique no botão abaixo de agendamento.</li>
                <li><strong className="text-zinc-200">Selecione outra aba</strong> ou <strong className="text-zinc-200">minimize o navegador</strong> no seu dispositivo imediatamente.</li>
                <li>Espere passar o tempo de atraso que configurou.</li>
              </ol>
            </div>
          </div>
        </div>

        <div className="pt-4 mt-4 border-t border-zinc-800/80 space-y-3">
          <button
            onClick={handleTestNotification}
            disabled={loading || !isSubscribed}
            className={`w-full py-2.5 px-4 font-black uppercase text-xs tracking-wider rounded-xl transition duration-150 flex items-center justify-center gap-2 cursor-pointer ${
              !isSubscribed
                ? "bg-zinc-800 text-zinc-500 shadow-none cursor-not-allowed border border-zinc-850"
                : "bg-purple-600 hover:bg-purple-500 text-white hover:shadow-lg hover:shadow-purple-500/10"
            }`}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Send className="w-3.5 h-3.5" /> Agendar Disparo ({testDelayed}s)
              </>
            )}
          </button>

          {!isSubscribed && (
            <p className="text-[10px] text-amber-500 text-center font-bold uppercase tracking-wider flex items-center justify-center gap-1 leading-none">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Ative primeiro as notificações do celular/PC à esquerda
            </p>
          )}

          {testResult && (
            <div className={`p-2.5 rounded-xl border text-[11px] text-center font-mono ${
              testResult.success 
                ? "bg-emerald-500/5 text-emerald-400 border-emerald-500/20" 
                : "bg-red-500/5 text-red-400 border-red-500/20"
            }`}>
              {testResult.message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
