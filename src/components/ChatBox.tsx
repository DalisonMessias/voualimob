import React, { useState, useEffect, useRef } from "react";
import { MessageCircle, Send, X, MessageSquare, Check, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { supabase } from "../lib/supabase";

interface ChatMessage {
  sender: "client" | "driver";
  text: string;
  timestamp: string;
}

interface ChatBoxProps {
  socket: any;
  rideId: string;
  sender: "client" | "driver";
  otherName: string;
}

export default function ChatBox({ socket, rideId, sender, otherName }: ChatBoxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sound generator helper for messages
  const playIncomingSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.setValueAtTime(440, audioCtx.currentTime); // A4
      osc.frequency.setValueAtTime(554.37, audioCtx.currentTime + 0.1); // C#5
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.25);
    } catch (e) {
      console.warn("Audio block:", e);
    }
  };

  // Listen directly to Supabase ride_messages table and real-time channel
  useEffect(() => {
    if (!rideId) return;

    // 1. Consulta inicial das mensagens existentes no Supabase
    supabase
      .from('ride_messages')
      .select('sender, text, timestamp')
      .eq('ride_id', rideId)
      .order('timestamp', { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          console.error("Erro ao buscar mensagens do chat:", error.message);
        } else if (data) {
          setMessages(data.map(m => ({
            sender: m.sender as "client" | "driver",
            text: m.text,
            timestamp: m.timestamp
          })));
        }
      });

    // 2. Ouvinte realtime do Supabase para novas mensagens desta corrida
    const channel = supabase.channel(`ride_chat_${rideId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ride_messages',
          filter: `ride_id=eq.${rideId}`
        },
        (payload) => {
          const fresh = payload.new;
          const mappedMsg: ChatMessage = {
            sender: fresh.sender as "client" | "driver",
            text: fresh.text,
            timestamp: fresh.timestamp
          };

          setMessages(prev => {
            // Evitar duplicações de mensagens locais já inseridas
            const exists = prev.some(m => m.timestamp === mappedMsg.timestamp && m.text === mappedMsg.text);
            if (exists) return prev;

            if (mappedMsg.sender !== sender) {
              playIncomingSound();
              if (!isOpen) {
                setUnreadCount(c => c + 1);
              }
            }
            return [...prev, mappedMsg];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [rideId, sender, isOpen]);

  // Handle active viewing clears unreads
  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
    }
  }, [isOpen]);

  // Automatically scroll messages list to the bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !rideId) return;

    const msgText = inputValue.trim();
    setInputValue("");

    try {
      const msgId = "msg_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5);
      
      // Inserir mensagem no Supabase
      const { error: insertErr } = await supabase
        .from('ride_messages')
        .insert({
          id: msgId,
          ride_id: rideId,
          sender,
          text: msgText,
          timestamp: new Date().toISOString()
        });

      if (insertErr) throw insertErr;

      // Também emite via socket para manter notificações de push ativas integradas se houver backend conectado
      if (socket) {
        socket.emit("sendChatMessage", {
          rideId,
          sender,
          text: msgText
        });
      }
    } catch (err) {
      console.error("Supabase Chat send failed:", err);
    }
  };

  return (
    <div id="vouali-chat-module" className="fixed bottom-6 right-6 z-[1100] font-sans">
      <AnimatePresence>
        {!isOpen ? (
          // COLLAPSED TRIGGER BUBBLE
          <motion.button
            key="chat-trigger"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => setIsOpen(true)}
            className="w-14 h-14 rounded-full bg-amber-500 hover:bg-amber-400 text-zinc-950 flex items-center justify-center shadow-xl shadow-amber-500/20 cursor-pointer pointer-events-auto border-4 border-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-transform hover:scale-105 active:scale-95 animate-bounce"
            aria-label="Abrir Mensagens"
          >
            <div className="relative">
              <MessageCircle className="w-6 h-6 stroke-[2.2]" />
              {unreadCount > 0 && (
                <span className="absolute -top-3.5 -right-3.5 bg-red-500 text-white font-mono text-[9px] font-black min-w-[20px] h-5 rounded-full flex items-center justify-center border-2 border-zinc-950 px-1">
                  {unreadCount}
                </span>
              )}
            </div>
          </motion.button>
        ) : (
          // EXPANDED CHAT PANEL CARD
          <motion.div
            key="chat-panel"
            initial={{ opacity: 0, scale: 0.9, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 50 }}
            className="w-80 sm:w-86 h-[420px] bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* CHAT HEADER */}
            <div className="bg-zinc-900 border-b border-zinc-850 px-4 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-xs font-black text-zinc-100 uppercase tracking-tight">Chat em Tempo Real</h4>
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" title="Conectado"></span>
                  </div>
                  <p className="text-[10px] text-zinc-400 truncate max-w-[160px]">Mensagens com {otherName || "parceiro"}</p>
                </div>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 rounded-lg transition-colors cursor-pointer"
                title="Minimizar Chat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* MESSAGE CONTAINER LIST */}
            <div className="flex-1 overflow-y-auto px-4 py-3 bg-zinc-900/40 space-y-3.5 scrollbar-thin scrollbar-thumb-zinc-805">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-4 space-y-1.5 opacity-60">
                  <MessageSquare className="w-8 h-8 text-zinc-500 stroke-[1.2]" />
                  <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Conversa Iniciada</p>
                  <p className="text-[9px] text-zinc-500">Consulte o ponto de embarque ou coletas de encomendas aqui.</p>
                </div>
              ) : (
                messages.map((msg, idx) => {
                  const isMe = msg.sender === sender;
                  return (
                    <div
                      key={`${msg.timestamp}-${idx}`}
                      className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                    >
                      <div className="flex items-baseline gap-1.5 mb-0.5">
                        <span className="text-[8px] font-bold uppercase tracking-wider text-zinc-500">
                          {isMe ? "Você" : otherName}
                        </span>
                        <span className="text-[7px] text-zinc-650 font-mono">
                          {new Date(msg.timestamp).toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>

                      <div
                        className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed break-words shadow-md ${
                          isMe
                            ? "bg-amber-500 text-zinc-950 rounded-tr-none font-medium"
                            : "bg-zinc-800 text-zinc-100 rounded-tl-none border border-zinc-705/50"
                        }`}
                      >
                        {msg.text}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* CHAT INPUT PANEL */}
            <form onSubmit={handleSendMessage} className="p-3 bg-zinc-900 border-t border-zinc-850 flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Envie uma mensagem..."
                className="flex-1 bg-zinc-950 border border-zinc-800 text-zinc-100 rounded-xl px-3.5 py-2 text-xs focus:ring-1 focus:ring-amber-500 focus:border-amber-500 focus:outline-none transition-all placeholder:text-zinc-600"
              />
              <button
                type="submit"
                disabled={!inputValue.trim()}
                className="w-10 h-10 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:hover:bg-amber-500 text-zinc-950 flex items-center justify-center transition-all shadow shadow-amber-500/10 cursor-pointer disabled:cursor-not-allowed"
                title="Enviar Mensagem"
              >
                <Send className="w-3.5 h-3.5 stroke-[2.2]" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
