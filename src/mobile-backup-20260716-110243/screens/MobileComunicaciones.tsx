// src/mobile/screens/MobileComunicaciones.tsx

import { useEffect, useState } from "react";
import { MessageCircle, RefreshCcw, Search } from "lucide-react";
import { supabase } from "../../lib/supabase";

type ConversationLite = {
  id: string;
  customer_name?: string | null;
  nombre?: string | null;
  phone?: string | null;
  telefono?: string | null;
  status?: string | null;
  estado?: string | null;
  last_message_at?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

function getName(item: ConversationLite): string {
  return item.customer_name || item.nombre || item.phone || item.telefono || "Conversación";
}

function getStatus(item: ConversationLite): string {
  return item.status || item.estado || "abierta";
}

function getDate(item: ConversationLite): string {
  const value = item.last_message_at || item.updated_at || item.created_at;

  if (!value) return "—";

  try {
    return new Intl.DateTimeFormat("es-AR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(value));
  } catch {
    return "—";
  }
}

export function MobileComunicaciones() {
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<ConversationLite[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function loadConversaciones() {
    setLoading(true);
    setError(null);

    const { data, error: loadError } = await supabase
      .from("conversations")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(50);

    if (loadError) {
      setError(loadError.message || "No se pudieron cargar las conversaciones.");
      setItems([]);
      setLoading(false);
      return;
    }

    setItems((data || []) as ConversationLite[]);
    setLoading(false);
  }

  useEffect(() => {
    loadConversaciones();
  }, []);

  const filtered = items.filter((item) => {
    const query = search.trim().toLowerCase();

    if (!query) return true;

    return (
      getName(item).toLowerCase().includes(query) ||
      String(item.phone || item.telefono || "").toLowerCase().includes(query) ||
      getStatus(item).toLowerCase().includes(query)
    );
  });

  return (
    <div className="min-h-full px-3 py-3">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-black/10 bg-white px-3 shadow-sm">
          <Search size={14} className="text-[#94a3b8]" />

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar conversación"
            className="h-full min-w-0 flex-1 bg-transparent text-[12px] font-bold text-[#111827] outline-none placeholder:text-[#94a3b8]"
          />
        </div>

        <button
          type="button"
          onClick={loadConversaciones}
          disabled={loading}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#64748b] shadow-sm ring-1 ring-black/10 disabled:opacity-50"
        >
          <RefreshCcw size={15} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {error ? (
        <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-bold leading-snug text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-2.5">
        {loading && filtered.length === 0 ? (
          <div className="rounded-[18px] bg-white p-4 text-center text-[12px] font-bold text-[#64748b]">
            Cargando conversaciones...
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-[18px] bg-white p-4 text-center text-[12px] font-bold text-[#64748b]">
            No hay conversaciones para mostrar.
          </div>
        ) : (
          filtered.map((item) => (
            <button
              key={item.id}
              type="button"
              className="flex min-h-[66px] items-center gap-2.5 rounded-[20px] border border-black/10 bg-white p-3 text-left shadow-sm active:scale-[0.99]"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-50 text-green-700">
                <MessageCircle size={18} strokeWidth={2} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-black leading-tight text-[#111827]">
                  {getName(item)}
                </div>

                <div className="mt-1 flex min-w-0 items-center gap-1.5">
                  <span className="rounded-lg bg-[#eef2f7] px-2 py-0.5 text-[9px] font-black uppercase leading-tight text-[#64748b]">
                    {getStatus(item)}
                  </span>

                  <span className="truncate text-[10px] font-bold leading-tight text-[#94a3b8]">
                    {item.phone || item.telefono || "Sin teléfono"}
                  </span>
                </div>
              </div>

              <div className="shrink-0 text-right text-[9px] font-black leading-tight text-[#94a3b8]">
                {getDate(item)}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

export default MobileComunicaciones;