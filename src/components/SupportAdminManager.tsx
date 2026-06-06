// src/components/SupportAdminManager.tsx
// Gerenciador Administrativo de Chamados, Janelas de Atendimento e IA (Supabase)
// UTF-8 Brasil

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { 
  Headset, 
  MessageSquare, 
  Search, 
  Settings, 
  Bot, 
  Clock, 
  CheckCircle, 
  Clock3, 
  AlertTriangle,
  User,
  ExternalLink,
  ChevronRight,
  Save,
  Plus,
  Trash2,
  Calendar,
  MessageCircle,
  Hash,
  ArrowLeft,
  Loader2,
  ChevronDown
} from 'lucide-react';
import { supabase, handleSupabaseError } from '../lib/supabase';
import { auth } from '../lib/firebase';
import { SupportTicket, AppSettings, SupportSettings, SupportMessage } from '../types';

interface SupportAdminManagerProps {
  currentUser?: any;
}

const SupportAdminManager: React.FC<SupportAdminManagerProps> = ({ currentUser: propUser }) => {
  const currentUser = propUser || auth.currentUser;
  
  const [activeTab, setActiveTab] = useState<'tickets' | 'ai' | 'hours'>('tickets');
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [replyText, setReplyText] = useState('');
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Custom UI elements states
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);

  // AI Sandbox State
  const [sandboxMessages, setSandboxMessages] = useState<{role: 'user' | 'ai', text: string}[]>([]);
  const [sandboxInput, setSandboxInput] = useState('');
  const [sandboxLoading, setSandboxLoading] = useState(false);

  // AI Config State
  const [aiConfig, setAiConfig] = useState({
    enabled: true,
    name: 'Vouali Assist',
    avatar: '',
    instructions: '',
    behavior: '',
    context: '',
    model: 'llama-3.3-70b-versatile'
  });

  // Hours Config State
  const [businessHours, setBusinessHours] = useState({
    openingTime: '08:00',
    closingTime: '18:00',
    daysAvailable: [1, 2, 3, 4, 5],
    closedMessage: '',
    whatsappNumber: ''
  });

  // Mostrar Notificação Toast Customizada
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // 1. Carregar todos os tickets de suporte do Supabase
    supabase
      .from('support_tickets')
      .select('*')
      .order('updated_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          console.error("Erro ao carregar tickets:", error.message);
          setError("Falha ao sincronizar chamados com o Supabase.");
        } else if (data) {
          const mapped = data.map(t => ({
            id: t.id,
            userId: t.user_id,
            userName: t.user_name,
            userRole: t.user_role,
            subject: t.subject,
            category: t.category,
            description: t.description,
            status: t.status,
            unreadUser: t.unread_user,
            unreadAdmin: t.unread_admin,
            lastMessage: t.last_message,
            createdAt: t.created_at,
            updatedAt: t.updated_at
          } as SupportTicket));
          setTickets(mapped);
        }
        setLoading(false);
      });

    // 2. Escutar atualizações de chamados de suporte em tempo real
    const ticketsChannel = supabase.channel('support_tickets_admin')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'support_tickets'
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const fresh = payload.new;
            const mapped: SupportTicket = {
              id: fresh.id,
              userId: fresh.user_id,
              userName: fresh.user_name,
              userRole: fresh.user_role,
              subject: fresh.subject,
              category: fresh.category,
              description: fresh.description,
              status: fresh.status,
              unreadUser: fresh.unread_user,
              unreadAdmin: fresh.unread_admin,
              lastMessage: fresh.last_message,
              createdAt: fresh.created_at,
              updatedAt: fresh.updated_at
            };
            setTickets(prev => {
              if (prev.some(t => t.id === mapped.id)) return prev;
              return [mapped, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            const fresh = payload.new;
            setTickets(prev => prev.map(t => t.id === fresh.id ? {
              ...t,
              status: fresh.status,
              unreadUser: fresh.unread_user,
              unreadAdmin: fresh.unread_admin,
              lastMessage: fresh.last_message,
              updatedAt: fresh.updated_at
            } : t));
          } else if (payload.eventType === 'DELETE') {
            setTickets(prev => prev.filter(t => t.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    // 3. Carregar configurações gerais do Supabase
    supabase
      .from('settings')
      .select('data')
      .eq('id', 'global')
      .single()
      .then(({ data, error }) => {
        if (error) {
          console.warn("Nenhuma configuração global encontrada no Supabase. Usando defaults.");
        } else if (data && data.data) {
          const appSet = data.data as AppSettings;
          setSettings(appSet);
          if (appSet.supportSettings) {
            setAiConfig(appSet.supportSettings.aiConfig);
            setBusinessHours(appSet.supportSettings.businessHours);
          }
        }
      });

    return () => {
      supabase.removeChannel(ticketsChannel);
    };
  }, [currentUser]);

  // Carregar mensagens do ticket selecionado
  useEffect(() => {
    if (!selectedTicketId || !currentUser) {
      setMessages([]);
      return;
    }

    // 1. Carregar mensagens iniciais do chamado
    supabase
      .from('support_messages')
      .select('*')
      .eq('ticket_id', selectedTicketId)
      .order('timestamp', { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          console.error("Erro ao obter mensagens do ticket:", error.message);
        } else if (data) {
          const mapped = data.map(m => ({
            id: m.id,
            ticketId: m.ticket_id,
            senderId: m.sender_id,
            senderName: m.sender_name,
            senderRole: m.sender_role,
            text: m.text,
            timestamp: m.timestamp
          } as SupportMessage));
          setMessages(mapped);
        }

        // Marcar chamado como lido pelo Admin
        const ticket = tickets.find(t => t.id === selectedTicketId);
        if (ticket?.unreadAdmin) {
          supabase
            .from('support_tickets')
            .update({ unread_admin: false })
            .eq('id', selectedTicketId)
            .then(({ error: updateErr }) => {
              if (updateErr) console.warn("Erro ao ler ticket pelo admin:", updateErr.message);
            });
        }
      });

    // 2. Se inscrever para novas mensagens no chamado em tempo real
    const msgsChannel = supabase.channel(`support_messages_admin_${selectedTicketId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'support_messages',
          filter: `ticket_id=eq.${selectedTicketId}`
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
          setMessages(prev => {
            if (prev.some(m => m.id === mapped.id)) return prev;
            return [...prev, mapped];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(msgsChannel);
    };
  }, [selectedTicketId, currentUser, tickets]);

  // Responder chamado como Admin
  const handleSendReply = async () => {
    if (!selectedTicketId || !replyText.trim()) return;

    try {
      const msgId = "msg_" + Date.now();
      const timestamp = new Date().toISOString();

      // 1. Inserir resposta do admin no Supabase
      const { error: insertError } = await supabase
        .from('support_messages')
        .insert({
          id: msgId,
          ticket_id: selectedTicketId,
          sender_id: 'admin',
          sender_name: 'Atendimento Vouali',
          sender_role: 'admin',
          text: replyText,
          timestamp: timestamp
        });

      if (insertError) throw insertError;

      // Inserção otimista local
      const optimisticMsg: SupportMessage = {
        id: msgId,
        ticketId: selectedTicketId,
        senderId: 'admin',
        senderName: 'Atendimento Vouali',
        senderRole: 'admin',
        text: replyText,
        timestamp: timestamp
      };
      setMessages(prev => {
        if (prev.some(m => m.id === msgId)) return prev;
        return [...prev, optimisticMsg];
      });

      // 2. Atualizar chamado no Supabase
      const { error: updateError } = await supabase
        .from('support_tickets')
        .update({
          last_message: replyText,
          updated_at: timestamp,
          status: 'respondido',
          unread_user: true,
          unread_admin: false
        })
        .eq('id', selectedTicketId);

      if (updateError) throw updateError;

      setReplyText('');
    } catch (err) {
      console.error("Erro ao enviar resposta do admin:", err);
      showToast("Erro ao enviar mensagem.", "error");
    }
  };

  // Enviar mensagem no Sandbox de teste da IA
  const handleSandboxMessage = async () => {
    if (!sandboxInput.trim() || sandboxLoading) return;
    
    const userMsg = sandboxInput;
    setSandboxMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setSandboxInput('');
    setSandboxLoading(true);

    try {
      const response = await fetch('/api/support/ai-sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg,
          config: aiConfig
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setSandboxMessages(prev => [...prev, { 
          role: 'ai', 
          text: data.response
        }]);
      } else {
        throw new Error(data.error || "Erro na resposta da IA");
      }
    } catch (err: any) {
      setSandboxMessages(prev => [...prev, { role: 'ai', text: err.message || "Erro ao processar resposta da IA no sandbox." }]);
    } finally {
      setSandboxLoading(false);
    }
  };

  // Salvar configurações globais de suporte no Supabase
  const saveSettings = async () => {
    setSaving(true);
    try {
      const newSupportSettings = {
        aiConfig,
        businessHours
      };

      const updatedSettings = settings 
        ? { ...settings, supportSettings: newSupportSettings } 
        : { supportSettings: newSupportSettings };

      // Gravar no Supabase
      const { error: saveErr } = await supabase
        .from('settings')
        .upsert({
          id: 'global',
          data: updatedSettings,
          updated_at: new Date().toISOString()
        });

      if (saveErr) throw saveErr;

      setSettings(updatedSettings as AppSettings);
      showToast("Configurações de suporte salvas com sucesso!");
    } catch (err) {
      console.error("Erro ao salvar configurações globais:", err);
      showToast("Erro ao salvar configurações. Verifique os acessos.", "error");
    } finally {
      setSaving(false);
    }
  };

  // Atualizar status do ticket selecionado
  const updateTicketStatus = async (id: string, status: string) => {
    try {
      const { error: updateErr } = await supabase
        .from('support_tickets')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (updateErr) throw updateErr;

      showToast(`Status do chamado alterado para: ${status.toUpperCase()}`);
    } catch (err) {
      console.error("Erro ao alterar status do chamado:", err);
      showToast("Erro ao atualizar status.", "error");
    }
  };

  const currentTicket = tickets.find(t => t.id === selectedTicketId);

  return (
    <div className="flex flex-col h-full bg-zinc-950 rounded-3xl overflow-hidden shadow-2xl border border-zinc-800 text-zinc-100 relative">
      
      {/* Toast Notification Customizada */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={`absolute top-4 left-1/2 -translate-x-1/2 z-[2000] px-6 py-3.5 rounded-2xl shadow-xl font-bold uppercase tracking-widest text-[10px] flex items-center gap-3 border ${
              toast.type === 'success' 
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
              : 'bg-red-500/10 text-red-400 border-red-500/20'
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${toast.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`} />
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs */}
      <div className="flex p-1.5 bg-zinc-900 border-b border-zinc-800">
        {[
          { id: 'tickets', label: 'Tickets & Suporte', icon: MessageCircle },
          { id: 'ai', label: 'Vouali Assist', icon: Bot },
          { id: 'hours', label: 'Ciclo Operacional', icon: Clock }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-[10px] uppercase tracking-widest font-black transition-all duration-300 cursor-pointer ${
              activeTab === tab.id 
              ? 'bg-amber-500 text-zinc-950 shadow-lg shadow-amber-500/20' 
              : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-black/20">
            <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
            <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.3em]">Sincronizando Chamados...</p>
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 p-10 bg-black/20 text-center">
            <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20">
              <AlertTriangle className="w-10 h-10 text-red-500" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-black text-white uppercase tracking-tighter">Erro de Acesso</h3>
              <p className="text-zinc-400 text-xs max-w-sm leading-relaxed">{error}</p>
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="px-8 py-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-white transition-all cursor-pointer"
            >
              Recarregar Painel
            </button>
          </div>
        ) : activeTab === 'tickets' ? (
          <div className="flex-1 flex overflow-hidden">
            {/* Tickets List */}
            <div className={`w-full ${selectedTicketId ? 'hidden md:flex' : 'flex'} md:w-80 flex-col border-r border-zinc-800 bg-black/20`}>
              <div className="p-4 border-b border-zinc-800 bg-black/10">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                  <input 
                    type="text" 
                    placeholder="BUSCAR CHAMADO..."
                    className="w-full pl-9 pr-4 py-2.5 bg-zinc-900/50 border border-zinc-800 rounded-xl text-[10px] font-black uppercase tracking-widest text-white outline-none focus:ring-1 focus:ring-amber-500 transition-all"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {tickets.map(ticket => (
                  <button
                    key={ticket.id}
                    onClick={() => setSelectedTicketId(ticket.id)}
                    className={`w-full p-5 border-b border-zinc-800/50 text-left hover:bg-white/5 transition-all relative cursor-pointer ${
                      selectedTicketId === ticket.id ? 'bg-amber-500/10' : ''
                    }`}
                  >
                    {ticket.unreadAdmin && (
                      <div className="absolute top-0 right-0 w-3 h-3 bg-amber-500 rounded-bl-lg animate-pulse" />
                    )}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[9px] font-black text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-lg uppercase tracking-tighter">
                        {ticket.category}
                      </span>
                      <span className="text-[9px] text-zinc-600 font-bold uppercase">
                        {new Date(ticket.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="font-black text-xs uppercase tracking-tight text-white mb-1 truncate">{ticket.subject}</p>
                    <p className="text-[10px] text-zinc-500 font-medium truncate leading-relaxed">{ticket.lastMessage || ticket.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Ticket Chat View */}
            <div className={`flex-1 flex-col ${selectedTicketId ? 'flex' : 'hidden md:flex'} bg-black/40`}>
              {selectedTicketId && currentTicket ? (
                <>
                  <div className="p-4 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between shadow-lg relative z-20">
                    <div className="flex items-center gap-4">
                      <button onClick={() => setSelectedTicketId(null)} className="md:hidden p-2 text-zinc-400 hover:text-white transition-colors cursor-pointer">
                        <ArrowLeft className="w-5 h-5" />
                      </button>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-amber-500 flex items-center justify-center text-zinc-950 shadow-lg shadow-amber-500/20">
                          <User className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="font-black text-xs uppercase tracking-wider text-white">{currentTicket.userName}</h3>
                          <div className="flex items-center gap-2">
                             <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                             <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">{currentTicket.userRole}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Select Personalizado Dropdown (Estilo Premium) */}
                    <div className="relative">
                      <button 
                        onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
                        className="text-[9px] font-black uppercase tracking-widest py-3 px-4 rounded-xl bg-zinc-800 text-white border border-zinc-700 outline-none flex items-center gap-2 cursor-pointer hover:bg-zinc-700 transition-all"
                      >
                        Status: {currentTicket.status}
                        <ChevronDown className="w-3.5 h-3.5 text-amber-500" />
                      </button>
                      
                      <AnimatePresence>
                        {statusDropdownOpen && (
                          <motion.div 
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute right-0 mt-2 w-40 bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl z-30"
                          >
                            {['aberto', 'em_análise', 'respondido', 'resolvido', 'encerrado'].map(st => (
                              <button
                                key={st}
                                onClick={() => {
                                  updateTicketStatus(selectedTicketId, st);
                                  setStatusDropdownOpen(false);
                                }}
                                className={`w-full text-left px-5 py-3 text-[9px] uppercase font-black tracking-wider transition-all hover:bg-white/5 ${
                                  currentTicket.status === st ? 'text-amber-500 bg-amber-500/5' : 'text-zinc-400'
                                }`}
                              >
                                {st.replace('_', ' ')}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar relative z-10">
                    {messages.map(msg => (
                      <div key={msg.id} className={`flex ${msg.senderRole === 'admin' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] p-4 rounded-3xl relative shadow-2xl ${
                          msg.senderRole === 'admin' 
                          ? 'bg-amber-500 text-zinc-950 rounded-tr-none' 
                          : msg.senderRole === 'ai'
                            ? 'bg-zinc-800/80 backdrop-blur-md text-zinc-400 rounded-tl-none border border-zinc-700 font-mono text-[11px] italic'
                            : 'bg-zinc-900 border border-zinc-800 text-white rounded-tl-none'
                        }`}>
                          <div className="flex items-center gap-2 mb-2 opacity-60">
                            <span className="text-[9px] font-black uppercase tracking-widest">{msg.senderName}</span>
                          </div>
                          <div className="markdown-body">
                            <Markdown>{msg.text}</Markdown>
                          </div>
                          <span className="text-[8px] block text-right mt-2 font-black uppercase opacity-40">
                            {new Date(msg.timestamp).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-4 bg-zinc-900 border-t border-zinc-800 relative z-20">
                    <div className="flex gap-3">
                      <input 
                        type="text" 
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="DIGITE SUA RESPOSTA..."
                        className="flex-1 p-4 bg-black/20 border border-zinc-800 text-white rounded-2xl text-xs font-bold uppercase tracking-widest outline-none focus:ring-2 focus:ring-amber-500 transition-all font-mono"
                        onKeyPress={(e) => e.key === 'Enter' && handleSendReply()}
                      />
                      <button 
                        onClick={handleSendReply}
                        className="px-8 py-4 bg-amber-500 text-zinc-950 font-black uppercase text-[10px] tracking-widest rounded-2xl shadow-xl shadow-amber-500/20 active:scale-95 transition-all cursor-pointer"
                      >
                        Enviar
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-zinc-800">
                  <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-6">
                    <MessageSquare className="w-12 h-12 opacity-20" />
                  </div>
                  <p className="font-black text-[10px] uppercase tracking-[0.2em] opacity-40">Selecione um chamado para gerenciar</p>
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'ai' ? (
          <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 bg-black/20 custom-scrollbar">
            <div className="max-w-5xl mx-auto space-y-8">
              <div className="flex items-center justify-between bg-zinc-900 px-6 py-5 rounded-[32px] border border-zinc-800 shadow-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl group-hover:bg-amber-500/10 transition-all duration-700" />
                <div className="flex items-center gap-4 relative z-10">
                  <div className="w-16 h-16 rounded-2xl bg-amber-500 flex items-center justify-center text-zinc-950 shadow-xl shadow-amber-500/20 rotate-3 group-hover:rotate-0 transition-transform duration-500">
                    <Bot className="w-10 h-10" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white uppercase tracking-tight">Vouali Assist</h2>
                    <p className="text-[9px] text-zinc-500 font-black uppercase tracking-[0.2em] mt-0.5">Gestão de Inteligência Artificial</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 relative z-10">
                  <div className="flex flex-col items-end">
                    <span className="text-[8px] font-black uppercase tracking-widest text-zinc-500 mb-1.5">{aiConfig.enabled ? 'Operacional' : 'Inativo'}</span>
                    
                    {/* Custom Switch Checkbox */}
                    <button 
                      onClick={() => setAiConfig({...aiConfig, enabled: !aiConfig.enabled})}
                      className={`w-14 h-7 rounded-full transition-all p-1 duration-500 shadow-inner cursor-pointer ${aiConfig.enabled ? 'bg-amber-500' : 'bg-zinc-800'}`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white shadow-lg transition-all transform duration-500 ${aiConfig.enabled ? 'translate-x-7' : 'translate-x-0'}`} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Config Panel */}
                <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-zinc-900/50 p-5 rounded-2xl border border-zinc-800">
                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500 block mb-3 ml-1">Codinome IA</label>
                    <input 
                      type="text" 
                      value={aiConfig.name}
                      onChange={e => setAiConfig({...aiConfig, name: e.target.value})}
                      className="w-full px-4 py-3 bg-black/40 border border-zinc-800 text-white rounded-xl font-bold uppercase tracking-widest text-[10px] outline-none focus:ring-1 focus:ring-amber-500 transition-all font-mono"
                    />
                  </div>
                  
                  {/* Select Personalizado para o Modelo de IA */}
                  <div className="bg-zinc-900/50 p-5 rounded-2xl border border-zinc-800 relative z-20">
                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500 block mb-3 ml-1">Motor de Processamento</label>
                    
                    <select 
                      value={aiConfig.model}
                      onChange={e => setAiConfig({...aiConfig, model: e.target.value})}
                      className="w-full px-4 py-3 bg-black/40 border border-zinc-800 text-white rounded-xl font-bold uppercase tracking-widest text-[9px] outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer transition-all"
                    >
                      <option value="llama-3.3-70b-versatile">LLAMA 3.3 70B (PRECISÃO)</option>
                      <option value="llama-3.1-8b-instant">LLAMA 3.1 8B (VELOCIDADE)</option>
                      <option value="mixtral-8x7b-32768">MIXTRAL 8X7B (VERSÁTIL)</option>
                    </select>
                  </div>
                  
                  <div className="bg-zinc-900/50 p-5 rounded-2xl border border-zinc-800">
                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500 block mb-3 ml-1">Estilo de Conversa</label>
                    <input 
                      type="text" 
                      value={aiConfig.behavior}
                      onChange={e => setAiConfig({...aiConfig, behavior: e.target.value})}
                      placeholder="EX: FORMAL, AMIGÁVEL, RÍGIDO..."
                      className="w-full px-4 py-3 bg-black/40 border border-zinc-800 text-zinc-300 rounded-xl font-bold uppercase tracking-widest text-[10px] outline-none focus:ring-1 focus:ring-amber-500 transition-all"
                    />
                  </div>
                </div>

                <div className="lg:col-span-7 space-y-6">
                  <div className="bg-zinc-900/50 p-6 rounded-[32px] border border-zinc-800 shadow-xl">
                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500 block mb-4 ml-1 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      Algoritmo de Atendimento (System Prompt)
                    </label>
                    <textarea 
                      value={aiConfig.instructions}
                      onChange={e => setAiConfig({...aiConfig, instructions: e.target.value})}
                      placeholder="REGRAS CRÍTICAS..."
                      rows={8}
                      className="w-full p-5 bg-black/40 border border-zinc-800 text-amber-500/80 rounded-2xl font-mono text-[10px] leading-relaxed outline-none focus:ring-1 focus:ring-amber-500 resize-none transition-all shadow-inner custom-scrollbar"
                    />
                  </div>

                  <div className="bg-zinc-900/50 p-6 rounded-[32px] border border-zinc-800 shadow-xl">
                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500 block mb-4 ml-1 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      Enciclopédia de Conhecimento (Context)
                    </label>
                    <textarea 
                      value={aiConfig.context}
                      onChange={e => setAiConfig({...aiConfig, context: e.target.value})}
                      placeholder="REGRAS, TARIFAS, FAQ..."
                      rows={10}
                      className="w-full p-5 bg-black/40 border border-zinc-800 text-zinc-300 rounded-2xl font-medium text-[10px] leading-relaxed outline-none focus:ring-1 focus:ring-amber-500 resize-none transition-all shadow-inner custom-scrollbar"
                    />
                  </div>
                </div>

                {/* AI Sandbox / Playground */}
                <div className="lg:col-span-5 flex flex-col h-full bg-zinc-900/50 rounded-[32px] border border-zinc-800 shadow-2xl overflow-hidden min-h-[500px]">
                  <div className="p-5 border-b border-zinc-800 bg-zinc-900 inline-flex items-center gap-3">
                     <div className="w-8 h-8 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-500">
                        <MessageSquare className="w-4 h-4" />
                     </div>
                     <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white">IA Playground (Sandbox)</h3>
                  </div>
                  
                  <div className="flex-1 p-5 overflow-y-auto space-y-4 custom-scrollbar bg-black/10">
                    {sandboxMessages.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center px-6 opacity-30">
                        <Bot className="w-12 h-12 mb-4" />
                        <p className="text-[9px] font-black uppercase tracking-widest leading-loose">Envie uma mensagem para testar o comportamento da sua IA em tempo real.</p>
                      </div>
                    ) : (
                      sandboxMessages.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[85%] p-4 rounded-2xl text-[10px] ${
                            msg.role === 'user' 
                            ? 'bg-zinc-800 text-white rounded-tr-none' 
                            : 'bg-amber-500/10 border border-amber-500/20 text-zinc-300 rounded-tl-none font-medium'
                          }`}>
                            <div className="markdown-body">
                              <Markdown>{msg.text}</Markdown>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                    {sandboxLoading && (
                      <div className="flex justify-start">
                        <div className="bg-zinc-800/50 px-4 py-3 rounded-2xl flex gap-1 items-center">
                          <div className="w-1 h-1 bg-amber-500 rounded-full animate-bounce" />
                          <div className="w-1 h-1 bg-amber-500 rounded-full animate-bounce delay-75" />
                          <div className="w-1 h-1 bg-amber-500 rounded-full animate-bounce delay-150" />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="p-4 bg-zinc-900 border-t border-zinc-800">
                    <div className="flex gap-2">
                       <input 
                        type="text" 
                        value={sandboxInput}
                        onChange={e => setSandboxInput(e.target.value)}
                        onKeyPress={e => e.key === 'Enter' && handleSandboxMessage()}
                        placeholder="TESTAR IA..."
                        className="flex-1 bg-black/40 border border-zinc-800 text-white rounded-xl px-4 py-3 text-[10px] font-bold uppercase tracking-widest outline-none focus:ring-1 focus:ring-purple-500 transition-all font-mono"
                       />
                       <button 
                        onClick={handleSandboxMessage}
                        disabled={sandboxLoading || !sandboxInput.trim()}
                        className="w-11 h-11 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl flex items-center justify-center transition-all disabled:opacity-30 cursor-pointer"
                       >
                          <ChevronRight className="w-5 h-5" />
                       </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-center pb-10">
                <button 
                  onClick={saveSettings}
                  disabled={saving}
                  className="group px-12 py-5 bg-amber-500 text-zinc-950 font-black uppercase text-[10px] tracking-[0.2em] rounded-2xl shadow-xl shadow-amber-500/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-3 disabled:opacity-50 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'SINCRONIZANDO...' : 'ATUALIZAR VOUALI ASSIST'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 bg-black/20 custom-scrollbar">
             <div className="max-w-4xl mx-auto space-y-8">
                <div className="flex items-center gap-6 bg-zinc-900 px-6 py-5 rounded-[32px] border border-zinc-800 shadow-xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl group-hover:bg-blue-500/10 transition-all duration-700" />
                  <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 border border-blue-500/20 shadow-inner group-hover:scale-110 transition-transform duration-500">
                    <Clock className="w-10 h-10" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white uppercase tracking-tight">Ciclo Operacional</h2>
                    <p className="text-[9px] text-zinc-500 font-black uppercase tracking-[0.2em] mt-0.5">Gestão de Janelas de Atendimento</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-8">
                    <div className="bg-zinc-900/50 p-6 rounded-[32px] border border-zinc-800 shadow-xl">
                      <label className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500 block mb-5 px-1">Janela de Atendimento Humano</label>
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <p className="text-[8px] font-black text-zinc-600 uppercase mb-2 ml-1">Abertura</p>
                          <input 
                            type="time" 
                            value={businessHours.openingTime}
                            onChange={e => setBusinessHours({...businessHours, openingTime: e.target.value})}
                            className="w-full px-4 py-3 bg-black/40 border border-zinc-800 text-white rounded-2xl font-black tracking-widest text-lg outline-none focus:ring-1 focus:ring-amber-500 text-center shadow-inner"
                          />
                        </div>
                        <div className="mt-6">
                          <div className="w-4 h-[2px] bg-zinc-800" />
                        </div>
                        <div className="flex-1">
                          <p className="text-[8px] font-black text-zinc-600 uppercase mb-2 ml-1">Fechamento</p>
                          <input 
                            type="time" 
                            value={businessHours.closingTime}
                            onChange={e => setBusinessHours({...businessHours, closingTime: e.target.value})}
                            className="w-full px-4 py-3 bg-black/40 border border-zinc-800 text-white rounded-2xl font-black tracking-widest text-lg outline-none focus:ring-1 focus:ring-amber-500 text-center shadow-inner"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="bg-zinc-900/50 p-6 rounded-[32px] border border-zinc-800 shadow-xl">
                      <label className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500 block mb-5 px-1">Plantão WhatsApp (DDI + DDD + NÚMERO)</label>
                      <div className="relative">
                        <input 
                          type="text" 
                          value={businessHours.whatsappNumber}
                          onChange={e => setBusinessHours({...businessHours, whatsappNumber: e.target.value})}
                          placeholder="EX: 5571988887777"
                          className="w-full px-6 py-4 bg-black/40 border border-zinc-800 text-white rounded-2xl font-black tracking-widest text-xs outline-none focus:ring-1 focus:ring-green-500 shadow-inner"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-zinc-900/50 p-6 rounded-[32px] border border-zinc-800 shadow-xl h-full">
                     <label className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500 block mb-6 px-1">Escala Semanal de Disponibilidade</label>
                     <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {['DOMINGO', 'SEGUNDA', 'TERÇA', 'QUARTA', 'QUINTA', 'SEXTA', 'SÁBADO'].map((day, idx) => (
                          <button
                            key={day}
                            onClick={() => {
                              const days = [...businessHours.daysAvailable];
                              if (days.includes(idx)) {
                                setBusinessHours({...businessHours, daysAvailable: days.filter(d => d !== idx)});
                              } else {
                                setBusinessHours({...businessHours, daysAvailable: [...days, idx]});
                              }
                            }}
                            className={`p-4 rounded-xl text-[8px] font-black tracking-widest transition-all duration-300 border cursor-pointer ${
                              businessHours.daysAvailable.includes(idx)
                              ? 'bg-amber-500 text-zinc-950 border-amber-500 shadow-lg shadow-amber-500/20'
                              : 'bg-black/20 border-zinc-800 text-zinc-600 hover:text-zinc-400'
                            }`}
                          >
                            {day}
                          </button>
                        ))}
                     </div>
                  </div>
                </div>

                <div className="bg-zinc-900/50 p-6 rounded-[32px] border border-zinc-800 shadow-xl">
                  <label className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500 block mb-5 ml-1">Comunicado de Indisponibilidade</label>
                  <textarea 
                    value={businessHours.closedMessage}
                    onChange={e => setBusinessHours({...businessHours, closedMessage: e.target.value})}
                    placeholder="OLÁ! NO MOMENTO ESTAMOS EM PAUSA..."
                    rows={4}
                    className="w-full p-5 bg-black/40 border border-zinc-800 text-zinc-300 rounded-2xl font-medium text-[10px] leading-relaxed outline-none focus:ring-1 focus:ring-blue-500 resize-none transition-all shadow-inner"
                  />
                  <div className="mt-4 flex items-center gap-2 text-zinc-600">
                    <Clock className="w-3 h-3" />
                    <p className="text-[8px] font-black uppercase tracking-widest">Exibido automaticamente fora do horário operacional.</p>
                  </div>
                </div>

                <div className="flex justify-center pb-10">
                  <button 
                    onClick={saveSettings}
                    disabled={saving}
                    className="group px-12 py-5 bg-zinc-800 hover:bg-zinc-700 text-white font-black uppercase text-[10px] tracking-[0.2em] rounded-2xl shadow-xl transition-all flex items-center gap-3 disabled:opacity-50 cursor-pointer"
                  >
                    <Save className="w-4 h-4 text-amber-500" />
                    {saving ? 'SINCRONIZANDO...' : 'SALVAR CRONOGRAMA'}
                  </button>
                </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SupportAdminManager;
