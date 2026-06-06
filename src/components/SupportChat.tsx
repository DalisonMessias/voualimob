// src/components/SupportChat.tsx
// Chat de chamados de suporte em tempo real no Supabase
// UTF-8 Brasil

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { 
  ArrowLeft, 
  Send, 
  Bot, 
  User, 
  Circle,
  MoreVertical,
  CheckCircle2,
  Clock,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';
import { supabase, handleSupabaseError } from '../lib/supabase';
import { auth } from '../lib/firebase';
import { SupportTicket, SupportMessage } from '../types';

interface SupportChatProps {
  ticketId: string;
  ticket: SupportTicket;
  userId: string;
  userName: string;
  userRole: 'client' | 'driver';
  onBack: () => void;
}

const SupportChat: React.FC<SupportChatProps> = ({ ticketId, ticket, userId, userName, userRole, onBack }) => {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkUser = userId || auth.currentUser?.uid;
    if (!checkUser) return;
    
    // 1. Carregar mensagens iniciais do Supabase
    supabase
      .from('support_messages')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('timestamp', { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          console.error("Erro ao carregar mensagens iniciais:", error.message);
        } else if (data) {
          // Mapear snake_case para camelCase
          const mappedMsgs = data.map(m => ({
            id: m.id,
            ticketId: m.ticket_id,
            senderId: m.sender_id,
            senderName: m.sender_name,
            senderRole: m.sender_role,
            text: m.text,
            timestamp: m.timestamp
          } as SupportMessage));
          setMessages(mappedMsgs);
        }

        // Marcar mensagens como lidas se houver pendências para o usuário
        if (ticket.unreadUser) {
          supabase
            .from('support_tickets')
            .update({ unread_user: false })
            .eq('id', ticketId)
            .then(({ error: updateError }) => {
              if (updateError) console.warn("Falha ao marcar ticket como lido:", updateError.message);
            });
        }
      });

    // 2. Se inscrever para novas mensagens em tempo real via Supabase Realtime
    const channel = supabase.channel(`support_messages_${ticketId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'support_messages',
          filter: `ticket_id=eq.${ticketId}`
        },
        (payload) => {
          const fresh = payload.new;
          const mapped: SupportMessage = {
            id: fresh.id,
            ticketId: fresh.ticket_id,
            senderId: fresh.sender_id,
            senderName: fresh.sender_name,
            senderRole: fresh.sender_role,
            text: fresh.text,
            timestamp: fresh.timestamp
          };
          
          // Evitar mensagens duplicadas caso o insert local já tenha adicionado
          setMessages(prev => {
            if (prev.some(m => m.id === fresh.id)) return prev;
            return [...prev, mapped];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ticketId, ticket.unreadUser, userId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const text = inputText;
    setInputText('');

    try {
      const msgId = "msg_" + Date.now();
      const timestamp = new Date().toISOString();

      // 1. Salvar mensagem do usuário no Supabase
      const { error: insertError } = await supabase
        .from('support_messages')
        .insert({
          id: msgId,
          ticket_id: ticketId,
          sender_id: userId,
          sender_name: userName,
          sender_role: userRole,
          text: text,
          timestamp: timestamp
        });

      if (insertError) throw insertError;

      // Adicionar localmente para feedback instantâneo (otimista)
      const optimisticMsg: SupportMessage = {
        id: msgId,
        ticketId,
        senderId: userId,
        senderName: userName,
        senderRole: userRole,
        text: text,
        timestamp: timestamp
      };
      setMessages(prev => {
        if (prev.some(m => m.id === msgId)) return prev;
        return [...prev, optimisticMsg];
      });

      // 2. Atualizar último status do chamado no Supabase
      const { error: updateError } = await supabase
        .from('support_tickets')
        .update({
          last_message: text,
          updated_at: timestamp,
          unread_admin: true,
          unread_user: false
        })
        .eq('id', ticketId);

      if (updateError) throw updateError;

      // 3. Disparar resposta da IA se o chamado estiver ativo para receber interações
      if (ticket.status === 'aberto' || ticket.status === 'respondido' || ticket.status === 'em_análise') {
        setIsTyping(true);
        const response = await fetch('/api/support/ai-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ticketId,
            message: text,
            userId,
            userName,
            userRole
          })
        });
        
        if (!response.ok) {
          console.error("Erro na API do AI Chat:", await response.text());
        }
        setIsTyping(false);
      }
    } catch (err) {
      console.error("Erro ao enviar mensagem no suporte:", err);
      setIsTyping(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
    >
      <div className="w-full max-w-lg bg-zinc-950 rounded-[40px] overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col h-[90vh] border border-zinc-800 animate-fade-in">
        {/* Chat Header */}
        <div className="p-6 bg-zinc-900 border-b border-zinc-800 flex items-center gap-4 relative z-10 shadow-lg">
          <button 
            onClick={onBack}
            className="w-10 h-10 flex items-center justify-center hover:bg-white/5 rounded-full transition-all text-zinc-400 hover:text-white cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <div className="flex-1 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500 flex items-center justify-center text-zinc-950 shadow-xl shadow-amber-500/20 rotate-3">
              <Bot className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-black text-xs uppercase tracking-widest text-white truncate">Vouali Assist</h3>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-[0.2em]">IA Ativa</span>
              </div>
            </div>
          </div>

          <button className="w-10 h-10 flex items-center justify-center hover:bg-white/5 rounded-full transition-all text-zinc-400 cursor-pointer">
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>

        {/* Messages Area */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-black/40 relative"
        >
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03] pointer-events-none" />
          
          {/* Ticket Context Label */}
          <div className="flex justify-center mb-8 relative z-10">
            <div className="bg-zinc-900/80 backdrop-blur-md px-5 py-2.5 rounded-2xl text-[9px] uppercase font-black text-zinc-500 border border-zinc-800 flex items-center gap-3 tracking-[0.2em] shadow-2xl">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
              Incidente: {ticket.subject}
            </div>
          </div>

          {messages.map((msg, idx) => {
            const isMe = msg.senderId === userId;
            const isAI = msg.senderRole === 'ai';
            const isAdmin = msg.senderRole === 'admin';
            
            return (
              <motion.div
                key={msg.id || idx}
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className={`flex ${isMe ? 'justify-end' : 'justify-start'} relative z-10`}
              >
                <div className={`max-w-[85%] rounded-[30px] p-5 shadow-2xl relative ${
                  isMe 
                    ? 'bg-amber-500 text-zinc-950 rounded-tr-none shadow-amber-500/10' 
                    : isAI 
                      ? 'bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-tl-none font-medium italic'
                      : isAdmin 
                        ? 'bg-blue-600 text-white rounded-tl-none shadow-blue-600/10'
                        : 'bg-zinc-800 border border-zinc-700 text-white rounded-tl-none'
                }`}>
                  <div className="markdown-body">
                    <Markdown>{msg.text}</Markdown>
                  </div>
                  <div className={`flex items-center justify-end gap-2 mt-2 opacity-40`}>
                    <span className="text-[8px] font-black uppercase tracking-tighter">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {isMe && <CheckCircle2 className="w-3 h-3" />}
                  </div>
                </div>
              </motion.div>
            );
          })}

          {isTyping && (
            <div className="flex justify-start relative z-10">
              <div className="bg-zinc-900 border border-zinc-800 text-zinc-500 px-5 py-3 rounded-2xl flex gap-1.5 items-center shadow-xl">
                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce" />
                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce delay-75" />
                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce delay-150" />
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 bg-zinc-900 flex items-center gap-3 border-t border-zinc-800 relative z-10">
          <form onSubmit={handleSendMessage} className="flex-1 flex gap-3">
            <div className="flex-1 relative">
              <input 
                type="text"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                placeholder="DIGITE SUA MENSAGEM..."
                className="w-full py-4 px-6 rounded-2xl bg-black/40 border border-zinc-800 text-white text-xs font-bold uppercase tracking-widest outline-none focus:ring-1 focus:ring-amber-500 transition-all font-mono"
              />
            </div>
            <button 
              type="submit"
              disabled={!inputText.trim() || isTyping}
              className="w-14 h-14 rounded-2xl bg-amber-500 flex items-center justify-center text-zinc-950 shadow-xl shadow-amber-500/20 hover:scale-[1.05] active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
            >
              <Send className="w-6 h-6 fill-current" />
            </button>
          </form>
        </div>
      </div>
    </motion.div>
  );
};

export default SupportChat;
