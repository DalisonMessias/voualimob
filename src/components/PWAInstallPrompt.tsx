import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Download, 
  X, 
  Navigation, 
  Zap, 
  Smartphone, 
  Bell, 
  Monitor,
  Share,
  PlusSquare,
  ChevronRight
} from "lucide-react";

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // 1. Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }

    // 2. Check for iOS
    const isIphone = /iPhone|iPad|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIphone);

    // 3. Capturar beforeinstallprompt
    const handler = (e: any) => {
      // Prevenir o prompt automático do navegador (especialmente no Android)
      e.preventDefault();
      setDeferredPrompt(e);
      
      // Mostrar modal após alguns segundos de uso
      const hasDismissed = localStorage.getItem("vouali_pwa_dismissed");
      if (!hasDismissed) {
        setTimeout(() => {
          setIsVisible(true);
        }, 5000);
      }
    };

    window.addEventListener("beforeinstallprompt", handler);

    // 4. Mostrar tutorial iOS se for Apple e não estiver instalado
    if (isIphone && !isInstalled) {
      const hasDismissed = localStorage.getItem("vouali_pwa_dismissed");
      if (!hasDismissed) {
        setTimeout(() => {
          setIsVisible(true);
        }, 8000);
      }
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [isInstalled]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Abrir o prompt oficial do navegador
    deferredPrompt.prompt();

    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);

    // Resetar o prompt salvo
    setDeferredPrompt(null);
    setIsVisible(false);

    if (outcome === "accepted") {
      setIsInstalled(true);
      localStorage.setItem("vouali_pwa_installed", "true");
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    // Salvar preferência para não mostrar imediatamente na próxima sessão
    localStorage.setItem("vouali_pwa_dismissed", Date.now().toString());
  };

  if (isInstalled) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleDismiss}
            className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.95 }}
            className="relative w-full max-w-[420px] bg-zinc-900 border border-zinc-800 rounded-[2.5rem] shadow-2xl overflow-hidden font-sans"
          >
            {/* Header / Logo Section */}
            <div className="relative h-44 flex flex-col items-center justify-center bg-gradient-to-br from-amber-500 to-amber-600 overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-full opacity-10">
                 <div className="absolute top-0 left-0 w-64 h-64 bg-white rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl"></div>
              </div>
              
              <motion.div 
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="w-20 h-20 bg-zinc-950 rounded-3xl flex items-center justify-center shadow-2xl mb-3"
              >
                <Navigation className="w-10 h-10 text-amber-500 stroke-[2.5] -rotate-45" />
              </motion.div>
              
              <h2 className="text-2xl font-black text-zinc-950 uppercase tracking-tighter">Vouali</h2>
              <p className="text-[10px] text-zinc-950/70 font-bold uppercase tracking-widest">Vouali e chego bem</p>

              <button 
                onClick={handleDismiss}
                className="absolute top-6 right-6 p-2 bg-zinc-950/20 hover:bg-zinc-950/40 rounded-full transition-colors"
                id="pwa-dismiss-btn"
              >
                <X className="w-4 h-4 text-zinc-950" />
              </button>
            </div>

            {/* Content Section */}
            <div className="p-8 pt-6 space-y-6">
              <div className="space-y-4">
                <h3 className="text-lg font-black text-white leading-tight">
                  Instale o App e tenha <br/>uma experiência premium
                </h3>
                
                <div className="grid grid-cols-1 gap-3">
                  {[
                    { icon: Zap, text: "Acesso Instantâneo", detail: "Abra direto da sua tela inicial" },
                    { icon: Bell, text: "Notificações Reais", detail: "Saiba quando sua moto chegar" },
                    { icon: Smartphone, text: "Interface Nativa", detail: "Experiência fluida em tela cheia" },
                    { icon: Monitor, text: "Leve e Rápido", detail: "Não ocupa espaço como apps comuns" }
                  ].map((item, idx) => (
                    <motion.div 
                      key={idx}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + idx * 0.1 }}
                      className="flex items-center gap-3 p-3 bg-zinc-950/50 rounded-2xl border border-zinc-800"
                    >
                      <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                        <item.icon className="w-4 h-4 text-amber-500" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-zinc-100 uppercase tracking-wide leading-none">{item.text}</p>
                        <p className="text-[10px] text-zinc-500 mt-1 font-medium">{item.detail}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3 pt-2">
                {!isIOS ? (
                  <button
                    onClick={handleInstallClick}
                    className="w-full bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black py-4 rounded-2xl uppercase tracking-wider text-xs transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 group cursor-pointer"
                    id="pwa-install-action"
                  >
                    <Download className="w-4 h-4 group-hover:bounce transition-transform" />
                    Instalar Aplicativo
                  </button>
                ) : (
                  <div className="space-y-4">
                     <p className="text-[11px] text-zinc-400 text-center font-medium leading-relaxed">
                      Como instalar no seu <span className="text-white font-bold">iPhone</span>:
                    </p>
                    <div className="bg-zinc-950/50 rounded-2xl p-4 border border-zinc-800 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-white">1</div>
                        <p className="text-[10px] text-zinc-300 font-bold uppercase tracking-tight">Toque no ícone de Compartilhar <Share className="w-3.5 h-3.5 inline ml-1 text-blue-400" /></p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-white">2</div>
                        <p className="text-[10px] text-zinc-300 font-bold uppercase tracking-tight">Selecione <PlusSquare className="w-3.5 h-3.5 inline ml-1 text-zinc-100" /> "Tela de Início"</p>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleDismiss}
                  className="w-full text-zinc-500 hover:text-zinc-300 font-black py-3 uppercase tracking-widest text-[10px] transition-colors cursor-pointer"
                  id="pwa-later-action"
                >
                  Agora Não
                </button>
              </div>
            </div>

            {/* Bottom Glow */}
            <div className="absolute bottom-0 left-0 w-full h-1 bg-amber-500 shadow-[0_0_20px_2px_rgba(245,158,11,0.5)]"></div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
