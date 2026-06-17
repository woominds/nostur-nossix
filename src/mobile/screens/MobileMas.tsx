// src/mobile/screens/MobileMas.tsx

import { ExternalLink, MessageCircle, Sparkles, UserRound } from "lucide-react";
import { useAuthStore } from "../../store/authStore";

export function MobileMas() {
  const user = useAuthStore((state) => state.user);

  return (
    <div className="min-h-full px-3 py-3">
      <section className="mb-3 rounded-[22px] border border-black/10 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#172033] text-white">
            <UserRound size={20} strokeWidth={2} />
          </div>

          <div className="min-w-0">
            <div className="truncate text-[13px] font-black leading-tight text-[#111827]">
              Usuario
            </div>

            <div className="mt-0.5 truncate text-[11px] font-bold leading-tight text-[#64748b]">
              {user?.email || "Sin email"}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-2.5">
        <div className="rounded-[20px] border border-black/10 bg-white p-3.5 shadow-sm">
          <div className="mb-1.5 flex items-center gap-1.5 text-[13px] font-black leading-tight text-[#111827]">
            <Sparkles size={16} className="text-nostur-orange" />
            NIA Mobile
          </div>

          <p className="text-[11px] font-semibold leading-snug text-[#64748b]">
            En la V1 vamos a usar esta sección para avisos internos, resumen comercial,
            oportunidades demoradas y alertas de atención.
          </p>
        </div>

        <div className="rounded-[20px] border border-black/10 bg-white p-3.5 shadow-sm">
          <div className="mb-1.5 flex items-center gap-1.5 text-[13px] font-black leading-tight text-[#111827]">
            <MessageCircle size={16} className="text-green-600" />
            Comunicaciones
          </div>

          <p className="text-[11px] font-semibold leading-snug text-[#64748b]">
            La prioridad mobile será responder y revisar conversaciones desde el celular.
          </p>
        </div>

        <a
          href="https://www.google.com.ar/"
          target="_blank"
          rel="noreferrer"
          className="flex min-h-12 items-center justify-between rounded-[20px] border border-black/10 bg-white p-3.5 text-[13px] font-black leading-tight text-[#111827] shadow-sm"
        >
          Abrir navegador externo
          <ExternalLink size={15} className="text-[#94a3b8]" />
        </a>
      </section>
    </div>
  );
}

export default MobileMas;