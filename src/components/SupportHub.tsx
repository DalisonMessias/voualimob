// src/components/SupportHub.tsx
// Hub de chamados e suporte em tempo real usando Supabase
// UTF-8 Brasil

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Headset, 
  MessageSquare, 
  AlertCircle, 
  Info, 
  CreditCard, 
  Settings, 
  ArrowRight, 
  X, 
  ChevronRight,
  Clock,
  ExternalLink
} from 'lucide-react';
import { supabase, handleSupabaseError } from '../lib/supabase';
import { auth } from '../lib/firebase';
import { SupportTicket, SupportCategory } from '../types';
import SupportChat from './SupportChat';

interface SupportHubProps {
  userId: string;
  userName: string;
  userRole: 'client' | 'driver';
  onClose: () => void;
}

const SupportHub: React.FC<SupportHubProps> = ({ userId, userName, userRole, onClose }) => {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newTicket, setNewTicket] = useState({
    category: 'duvida' as SupportCategory,
    subject: '',
    description: ''
  });
  const [supportStatus, setSupportStatus] = useState<{ online: boolean; settings: any } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const ticketUserId = userId || auth.currentUser?.uid;
    if (!ticketUserId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // 1. Carregar chamados iniciais do Supabase
    supabase
      .from('support_tickets')
      .select('*')
      .eq('user_id', ticketUserId)
      .order('updated_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          console.error("Erro ao carregar chamados iniciais:", error.message);
        } else if (data) {
          // Mapear snake_case para camelCase
          const mappedTickets = data.map(t => ({
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
          setTickets(mappedTickets);
        }
        setLoading(false);
      });

    // 2. Se inscrever para atualizações em tempo real via canais do Supabase
    const channel = supabase.channel(`user_tickets_${ticketUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'support_tickets',
          filter: `user_id=eq.${ticketUserId}`
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
            setTickets(prev => [mapped, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            const fresh = payload.new;
            const mapped: Partial<SupportTicket> = {
              id: fresh.id,
              status: fresh.status,
              unreadUser: fresh.unread_user,
              unreadAdmin: fresh.unread_admin,
              lastMessage: fresh.last_message,
              updatedAt: fresh.updated_at
            };
            setTickets(prev => prev.map(t => t.id === fresh.id ? { ...t, ...mapped } : t));
          } else if (payload.eventType === 'DELETE') {
            setTickets(prev => prev.filter(t => t.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    // 3. Checar status operacional do suporte via API
    fetch('/api/support/status')
      .then(res => res.json())
      .then(data => setSupportStatus(data))
      .catch(err => console.error("Erro ao obter status do suporte:", err));

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, auth.currentUser]);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicket.subject || !newTicket.description) return;

    setLoading(true);
    try {
      const ticketId = "ticket_" + Date.now();
      const timestamp = new Date().toISOString();

      // 1. Criar o ticket no Supabase
      const { error: insertTicketError } = await supabase
        .from('support_tickets')
        .insert({
          id: ticketId,
          user_id: userId,
          user_name: userName,
          user_role: userRole,
          category: newTicket.category,
          subject: newTicket.subject,
          description: newTicket.description,
          status: 'aberto',
          unread_admin: true,
          unread_user: false,
          created_at: timestamp,
          updated_at: timestamp
        });

      if (insertTicketError) throw insertTicketError;

      // 2. Inserir a mensagem inicial no Supabase
      const msgId = "msg_" + Date.now();
      const { error: insertMsgError } = await supabase
        .from('support_messages')
        .insert({
          id: msgId,
          ticket_id: ticketId,
          sender_id: userId,
          sender_name: userName,
          sender_role: userRole,
          text: newTicket.description,
          timestamp: timestamp
        });

      if (insertMsgError) throw insertMsgError;

      setActiveTicketId(ticketId);
      setIsCreating(false);
      setNewTicket({ category: 'duvida', subject: '', description: '' });
    } catch (err) {
      handleSupabaseError(err, 'support_tickets/messages', 'CREATE');
    } finally {
      setLoading(false);
    }
  };

  const categories: { id: SupportCategory; label: string; icon: any; color: string }[] = [
    { id: 'duvida', label: 'Dúvidas', icon: Info, color: 'bg-blue-500' },
    { id: 'contestacao', label: 'Contestar Corrida', icon: AlertCircle, color: 'bg-red-500' },
    { id: 'ajuda', label: 'Ajuda', icon: Headset, color: 'bg-green-500' },
    { id: 'problema', label: 'Reportar Problema', icon: MessageSquare, color: 'bg-orange-500' },
    { id: 'financeiro', label: 'Financeiro', icon: CreditCard, color: 'bg-purple-500' },
    { id: 'tecnico', label: 'Suporte Técnico', icon: Settings, color: 'bg-gray-500' },
  ];

  if (activeTicketId) {
    const activeTicket = tickets.find(t => t.id === activeTicketId);
    return (
      <SupportChat 
        ticketId={activeTicketId}
        ticket={activeTicket!}
        userId={userId}
        userName={userName}
        userRole={userRole}
        onBack={() => setActiveTicketId(null)}
      />
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed inset-0 z-[1050] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
    >
      <div className="w-full max-w-lg bg-zinc-950 rounded-[40px] overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col max-h-[90vh] border border-zinc-800 relative animate-fade-in">
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        
        {/* Header */}
        <div className="p-8 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-500 flex items-center justify-center text-zinc-950 shadow-xl shadow-amber-500/20 rotate-3">
              <Headset className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white uppercase tracking-tight">Suporte</h2>
              <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.3em] mt-1">Como podemos te ajudar?</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-full transition-all text-zinc-400 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar relative z-10">
          {/* Status Alert */}
          {supportStatus && !supportStatus.online && (
            <div className="bg-amber-500/5 p-6 rounded-[32px] border border-amber-500/20 flex gap-4 relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1 h-full bg-amber-500" />
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                <Clock className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <p className="text-[11px] font-black text-amber-500 uppercase tracking-widest">Atendimento em Pausa</p>
                <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                  {supportStatus.settings?.closedMessage || "Nossa equipe humana está descansando. Fale com nossa IA ou deixe um recado."}
                </p>
              </div>
            </div>
          )}

          {isCreating ? (
            <form onSubmit={handleCreateTicket} className="space-y-8">
              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 block ml-1">Selecione o Assunto</label>
                <div className="grid grid-cols-2 gap-3">
                  {categories.map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setNewTicket({...newTicket, category: cat.id})}
                      className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                        newTicket.category === cat.id 
                        ? 'border-amber-500 bg-amber-500/5 shadow-lg shadow-amber-500/5' 
                        : 'border-zinc-800 bg-black/20 text-zinc-500'
                      }`}
                    >
                      <cat.icon className={`w-5 h-5 ${newTicket.category === cat.id ? 'text-amber-500' : 'opacity-40'}`} />
                      <span className={`text-[10px] font-black uppercase tracking-tight ${newTicket.category === cat.id ? 'text-white' : ''}`}>{cat.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 block ml-1">Título do Chamado</label>
                <input 
                  type="text"
                  value={newTicket.subject}
                  onChange={e => setNewTicket({...newTicket, subject: e.target.value})}
                  placeholder="DIGITE O TÍTULO..."
                  className="w-full p-5 bg-black/40 border border-zinc-800 text-white rounded-2xl text-xs font-bold uppercase tracking-widest outline-none focus:ring-2 focus:ring-amber-500 transition-all"
                  required
                />
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 block ml-1">Detalhes do Problema</label>
                <textarea 
                  value={newTicket.description}
                  onChange={e => setNewTicket({...newTicket, description: e.target.value})}
                  placeholder="EXPLIQUE O QUE ACONTECEU..."
                  rows={4}
                  className="w-full p-6 bg-black/40 border border-zinc-800 text-zinc-300 rounded-[30px] font-medium text-xs leading-relaxed outline-none focus:ring-2 focus:ring-amber-500 resize-none transition-all shadow-inner"
                  required
                />
              </div>

              <div className="flex gap-4 pt-2">
                <button 
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="flex-1 py-5 font-black uppercase text-[10px] tracking-widest rounded-3xl bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-white transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-5 bg-amber-500 text-zinc-950 font-black uppercase text-[10px] tracking-widest rounded-3xl shadow-xl shadow-amber-500/20 disabled:opacity-50 active:scale-95 transition-all cursor-pointer"
                >
                  {loading ? 'ENVIANDO...' : 'ABRIR CHAMADO'}
                </button>
              </div>
            </form>
          ) : (
            <>
              {/* Actions */}
              <div className="space-y-4">
                <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] ml-1">Novo Atendimento</h3>
                <button 
                  onClick={() => setIsCreating(true)}
                  className="w-full p-6 bg-zinc-900 rounded-[32px] border border-zinc-800 flex items-center justify-between group hover:border-amber-500/50 transition-all shadow-xl relative overflow-hidden cursor-pointer"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl group-hover:bg-amber-500/10 transition-all" />
                  <div className="flex items-center gap-5 relative z-10">
                    <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 shadow-inner group-hover:scale-110 transition-transform">
                      <MessageSquare className="w-7 h-7" />
                    </div>
                    <div className="text-left">
                      <p className="font-black text-white uppercase text-xs tracking-widest">Iniciar Chat</p>
                      <p className="text-[10px] text-zinc-500 font-bold mt-0.5">Vouali Assist responde em segundos</p>
                    </div>
                  </div>
                  <ChevronRight className="w-6 h-6 text-zinc-700 group-hover:translate-x-1 group-hover:text-amber-500 transition-all" />
                </button>
              </div>

              {/* History */}
              <div className="space-y-4">
                <div className="flex items-center justify-between ml-1">
                  <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]">Meus Chamados</h3>
                  <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest bg-zinc-900 px-2 py-0.5 rounded-lg border border-zinc-800">{tickets.length} CHAMADOS</span>
                </div>
                
                {loading ? (
                  <div className="text-center py-12">
                    <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Carregando histórico...</p>
                  </div>
                ) : tickets.length === 0 ? (
                  <div className="text-center py-16 bg-black/20 rounded-[40px] border-2 border-dashed border-zinc-800">
                    <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-6">
                       <Headset className="w-10 h-10 text-zinc-800" />
                    </div>
                    <p className="text-zinc-600 text-[10px] font-black uppercase tracking-[0.2em]">Sem chamados ativos.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {tickets.map(ticket => (
                      <button
                        key={ticket.id}
                        onClick={() => setActiveTicketId(ticket.id)}
                        className="w-full p-6 bg-zinc-900/50 rounded-[32px] border border-zinc-800/50 flex flex-col gap-3 hover:bg-zinc-900 hover:border-zinc-700 transition-all relative overflow-hidden group shadow-lg cursor-pointer text-left"
                      >
                        {ticket.unreadUser && (
                          <div className="absolute top-0 right-0 w-4 h-4 bg-amber-500 rounded-bl-xl animate-pulse" />
                        )}
                        <div className="flex items-center justify-between">
                          <span className={`text-[9px] uppercase font-black px-3 py-1 rounded-full border ${
                            ticket.status === 'resolvido' || ticket.status === 'resolvido' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                            ticket.status === 'aberto' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                            'bg-amber-500/10 text-amber-500 border-amber-500/20'
                          }`}>
                            {ticket.status.replace('_', ' ')}
                          </span>
                          <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest">
                            {new Date(ticket.updatedAt).toLocaleDateString()}
                          </span>
                        </div>
                        <div>
                          <p className="font-black text-left text-xs uppercase tracking-tight text-white line-clamp-1 group-hover:text-amber-500 transition-colors">{ticket.subject}</p>
                          <p className="text-[11px] text-zinc-500 font-medium text-left line-clamp-1 leading-relaxed mt-1 opacity-60">{ticket.lastMessage || ticket.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default SupportHub;
