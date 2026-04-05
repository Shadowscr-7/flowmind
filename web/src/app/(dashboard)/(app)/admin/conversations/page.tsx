"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/layout/Header";
import { Spinner } from "@/components/ui/Spinner";
import {
  MessageSquare,
  Search,
  User,
  XCircle,
  Mic,
  Image,
  RefreshCw,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react";

const ADMIN_EMAIL = "jgomez@flowmind.app";

interface Conversation {
  phone: string;
  user_id: string | null;
  display_name: string | null;
  plan: string | null;
  last_message: string | null;
  last_message_at: string;
  last_direction: string;
  message_count: number;
}

interface Message {
  id: string;
  created_at: string;
  direction: "inbound" | "outbound";
  message_type: "text" | "audio" | "image";
  content: string | null;
  intent: string | null;
  transaction_id: string | null;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-UY", { day: "numeric", month: "short" });
}

function initials(name: string | null, phone: string) {
  if (name) return name.slice(0, 2).toUpperCase();
  return phone.slice(-2);
}

function intentBadge(intent: string | null) {
  if (!intent) return null;
  const map: Record<string, { label: string; color: string }> = {
    TRANSACTION: { label: "Transacción", color: "bg-emerald-100 text-emerald-700" },
    QUERY: { label: "Consulta", color: "bg-blue-100 text-blue-700" },
    HELP: { label: "Ayuda", color: "bg-slate-100 text-slate-600" },
  };
  const entry = map[intent];
  if (!entry) return null;
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${entry.color}`}>
      {entry.label}
    </span>
  );
}

function MessageTypeIcon({ type }: { type: string }) {
  if (type === "audio") return <Mic className="h-3.5 w-3.5 opacity-60 shrink-0" />;
  if (type === "image") return <Image className="h-3.5 w-3.5 opacity-60 shrink-0" />;
  return null;
}

export default function ConversationsPage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auth check
  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      if (user?.email !== ADMIN_EMAIL) {
        setIsAdmin(false);
      } else {
        setIsAdmin(true);
      }
    });
  }, []);

  // Load conversations
  const loadConversations = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await fetch("/api/admin/conversations");
      const data = await res.json();
      setConversations(data.conversations ?? []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isAdmin) loadConversations();
  }, [isAdmin]);

  // Load messages for selected phone
  const loadMessages = async (phone: string) => {
    setLoadingMsgs(true);
    setMessages([]);
    try {
      const res = await fetch(`/api/admin/conversations?phone=${encodeURIComponent(phone)}`);
      const data = await res.json();
      setMessages(data.messages ?? []);
    } finally {
      setLoadingMsgs(false);
    }
  };

  useEffect(() => {
    if (selectedPhone) loadMessages(selectedPhone);
  }, [selectedPhone]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (isAdmin === null) {
    return (
      <>
        <Header title="Conversaciones WhatsApp" />
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      </>
    );
  }

  if (isAdmin === false) {
    return (
      <>
        <Header title="Conversaciones WhatsApp" />
        <main className="flex-1 p-6 max-w-2xl mx-auto">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 flex flex-col items-center gap-3 text-center">
            <XCircle className="h-10 w-10 text-red-400" />
            <p className="font-medium text-slate-700">Acceso restringido</p>
            <p className="text-sm text-slate-400">Solo el super admin puede ver las conversaciones</p>
          </div>
        </main>
      </>
    );
  }

  const filtered = conversations.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.phone.includes(q) ||
      (c.display_name ?? "").toLowerCase().includes(q)
    );
  });

  const selectedConv = conversations.find((c) => c.phone === selectedPhone);

  // Group messages by date
  const groupedMessages: { date: string; msgs: Message[] }[] = [];
  for (const msg of messages) {
    const date = formatDate(msg.created_at);
    const last = groupedMessages[groupedMessages.length - 1];
    if (last?.date === date) {
      last.msgs.push(msg);
    } else {
      groupedMessages.push({ date, msgs: [msg] });
    }
  }

  return (
    <>
      <Header title="Conversaciones WhatsApp" />
      <main className="flex-1 flex overflow-hidden" style={{ height: "calc(100vh - 64px)" }}>
        {/* ── Left: conversation list ── */}
        <div className="w-80 shrink-0 border-r border-slate-100 flex flex-col bg-white">
          {/* Search + refresh */}
          <div className="p-3 border-b border-slate-100 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar usuario o teléfono..."
                className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-400 bg-slate-50"
              />
            </div>
            <button
              onClick={() => loadConversations(true)}
              disabled={refreshing}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              <RefreshCw className={`h-4 w-4 text-slate-500 ${refreshing ? "animate-spin" : ""}`} />
            </button>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-12"><Spinner /></div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center px-4">
                <MessageSquare className="h-8 w-8 text-slate-300" />
                <p className="text-sm text-slate-400">
                  {search ? "Sin resultados" : "Sin conversaciones aún"}
                </p>
              </div>
            ) : (
              filtered.map((conv) => (
                <button
                  key={conv.phone}
                  onClick={() => setSelectedPhone(conv.phone)}
                  className={`w-full text-left px-4 py-3.5 border-b border-slate-50 hover:bg-slate-50 transition-colors ${
                    selectedPhone === conv.phone ? "bg-indigo-50 border-l-2 border-l-indigo-500" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                      conv.user_id ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-500"
                    }`}>
                      {initials(conv.display_name, conv.phone)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-sm font-medium text-slate-800 truncate">
                          {conv.display_name ?? `+${conv.phone}`}
                        </span>
                        <span className="text-[11px] text-slate-400 shrink-0">
                          {timeAgo(conv.last_message_at)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        {conv.last_direction === "outbound" ? (
                          <ArrowUpRight className="h-3 w-3 text-indigo-400 shrink-0" />
                        ) : (
                          <ArrowDownLeft className="h-3 w-3 text-slate-400 shrink-0" />
                        )}
                        <p className="text-xs text-slate-500 truncate">
                          {conv.last_message ?? "Imagen / Audio"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {conv.plan && (
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                            conv.plan === "pro" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"
                          }`}>
                            {conv.plan}
                          </span>
                        )}
                        {!conv.user_id && (
                          <span className="text-[10px] text-red-500 font-medium">Sin cuenta</span>
                        )}
                        <span className="text-[10px] text-slate-400">{conv.message_count} msgs</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Footer stats */}
          {!loading && (
            <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50">
              <p className="text-xs text-slate-400">
                {conversations.length} conversaciones ·{" "}
                {conversations.filter((c) => c.user_id).length} usuarios registrados
              </p>
            </div>
          )}
        </div>

        {/* ── Right: chat view ── */}
        <div className="flex-1 flex flex-col bg-slate-50">
          {!selectedPhone ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6">
              <div className="h-16 w-16 rounded-2xl bg-indigo-50 flex items-center justify-center">
                <MessageSquare className="h-8 w-8 text-indigo-300" />
              </div>
              <p className="text-slate-500 font-medium">Seleccioná una conversación</p>
              <p className="text-sm text-slate-400">
                {conversations.length > 0
                  ? `${conversations.length} conversaciones disponibles`
                  : "Las conversaciones aparecerán aquí cuando lleguen mensajes de WhatsApp"}
              </p>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="px-5 py-3.5 bg-white border-b border-slate-100 flex items-center gap-3">
                <div className={`h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold ${
                  selectedConv?.user_id ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-500"
                }`}>
                  {initials(selectedConv?.display_name ?? null, selectedPhone)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800 text-sm">
                      {selectedConv?.display_name ?? `+${selectedPhone}`}
                    </span>
                    {selectedConv?.plan && (
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                        selectedConv.plan === "pro" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"
                      }`}>
                        {selectedConv.plan}
                      </span>
                    )}
                    {!selectedConv?.user_id && (
                      <span className="text-[10px] text-red-500 font-medium">Sin cuenta</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">+{selectedPhone}</p>
                </div>
                <div className="flex items-center gap-1">
                  {selectedConv?.user_id && (
                    <User className="h-4 w-4 text-emerald-500" title="Usuario registrado" />
                  )}
                  <span className="text-xs text-slate-400">{messages.length} msgs</span>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
                {loadingMsgs ? (
                  <div className="flex justify-center py-12"><Spinner /></div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-12 text-center">
                    <MessageSquare className="h-8 w-8 text-slate-300" />
                    <p className="text-sm text-slate-400">Sin mensajes</p>
                  </div>
                ) : (
                  groupedMessages.map(({ date, msgs }) => (
                    <div key={date}>
                      {/* Date separator */}
                      <div className="flex items-center gap-3 my-3">
                        <div className="flex-1 h-px bg-slate-200" />
                        <span className="text-xs text-slate-400 font-medium">{date}</span>
                        <div className="flex-1 h-px bg-slate-200" />
                      </div>

                      {msgs.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex mb-1.5 ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 shadow-sm ${
                              msg.direction === "outbound"
                                ? "bg-indigo-600 text-white rounded-tr-sm"
                                : "bg-white text-slate-800 rounded-tl-sm border border-slate-100"
                            }`}
                          >
                            {/* Type icon + intent */}
                            {(msg.message_type !== "text" || msg.intent) && (
                              <div className="flex items-center gap-1.5 mb-1">
                                <MessageTypeIcon type={msg.message_type} />
                                {intentBadge(msg.intent)}
                              </div>
                            )}

                            {/* Content */}
                            <p className={`text-sm leading-relaxed whitespace-pre-wrap ${
                              msg.direction === "outbound" ? "text-white" : "text-slate-700"
                            }`}>
                              {msg.content ?? (
                                <span className="italic opacity-60">
                                  {msg.message_type === "audio" ? "Nota de voz" : "Imagen"}
                                </span>
                              )}
                            </p>

                            {/* Timestamp */}
                            <p className={`text-[10px] mt-1 text-right ${
                              msg.direction === "outbound" ? "text-indigo-200" : "text-slate-400"
                            }`}>
                              {formatTime(msg.created_at)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}
