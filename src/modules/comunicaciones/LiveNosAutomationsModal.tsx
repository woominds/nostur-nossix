// src/modules/components/comunicaciones/LiveNosAutomationsModal.tsx

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock3,
  Loader2,
  MessageCircle,
  Plus,
  RefreshCcw,
  Save,
  ToggleLeft,
  ToggleRight,
  Trash2,
  X
} from "lucide-react";
import { supabase } from "././../../lib/supabase";

type AutoReplyRule = {
  id: string;
  nombre: string;
  activo: boolean;
  dias_semana: number[];
  hora_desde: string;
  hora_hasta: string;
  timezone: string;
  mensaje: string;
  cooldown_minutos: number;
  aplicar_si_cande_activa: boolean;
  aplicar_si_conversacion_tomada: boolean;
  prioridad: number;
  created_at?: string;
  updated_at?: string;
};

type LiveNosAutomationsModalProps = {
  open: boolean;
  onClose: () => void;
};

const DIAS = [
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mié" },
  { value: 4, label: "Jue" },
  { value: 5, label: "Vie" },
  { value: 6, label: "Sáb" },
  { value: 0, label: "Dom" }
];

const DEFAULT_MESSAGE =
  "¡Hola! Gracias por escribirnos. En este momento estamos fuera de nuestro horario de atención. Ya recibimos tu mensaje y apenas retomemos la atención un asesor va a responderte.";

const emptyRule: Partial<AutoReplyRule> = {
  nombre: "Respuesta fuera de horario",
  activo: true,
  dias_semana: [1, 2, 3, 4, 5],
  hora_desde: "09:00",
  hora_hasta: "20:30",
  timezone: "America/Argentina/Cordoba",
  mensaje: DEFAULT_MESSAGE,
  cooldown_minutos: 720,
  aplicar_si_cande_activa: false,
  aplicar_si_conversacion_tomada: false,
  prioridad: 100
};

function normalizeTime(value: string | null | undefined) {
  const raw = String(value || "").trim();
  if (!raw) return "00:00";

  const [hh = "00", mm = "00"] = raw.split(":");

  return `${hh.padStart(2, "0")}:${mm.padStart(2, "0")}`;
}

function parseCooldown(value: string | number | null | undefined) {
  const num = Number(value || 0);
  if (!Number.isFinite(num) || num <= 0) return 720;
  return Math.round(num);
}



function getTodayValue() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Argentina/Cordoba",
    weekday: "short"
  }).formatToParts(new Date());

  const weekday = parts.find((part) => part.type === "weekday")?.value || "Mon";

  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6
  };

  return map[weekday] ?? 1;
}

function getNowTime() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Argentina/Cordoba",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(new Date());

  const hour = parts.find((part) => part.type === "hour")?.value || "00";
  const minute = parts.find((part) => part.type === "minute")?.value || "00";

  return `${hour}:${minute}`;
}

function isRuleTestingNow(rule: Partial<AutoReplyRule>) {
  const dias = Array.isArray(rule.dias_semana) ? rule.dias_semana : [];
  const today = getTodayValue();

  if (!dias.includes(today)) {
    return false;
  }

  const desde = normalizeTime(rule.hora_desde);
  const hasta = normalizeTime(rule.hora_hasta);

  if (desde === "00:00" && (hasta === "23:59" || hasta === "24:00")) {
    return true;
  }

  const now = getNowTime();

  return now < desde || now > hasta;
}

export function LiveNosAutomationsModal({ open, onClose }: LiveNosAutomationsModalProps) {
  const [rules, setRules] = useState<AutoReplyRule[]>([]);
  const [selectedId, setSelectedId] = useState<string | "new">("new");
  const [draft, setDraft] = useState<Partial<AutoReplyRule>>(emptyRule);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedRule = useMemo(() => {
    if (selectedId === "new") return null;
    return rules.find((rule) => rule.id === selectedId) || null;
  }, [rules, selectedId]);

  const activeCount = useMemo(() => {
    return rules.filter((rule) => rule.activo).length;
  }, [rules]);

  const matchesNow = useMemo(() => {
    return isRuleTestingNow(draft);
  }, [draft]);

  useEffect(() => {
    if (!open) return;

    void loadRules();
  }, [open]);

  useEffect(() => {
    if (selectedRule) {
      setDraft({
        ...selectedRule,
        hora_desde: normalizeTime(selectedRule.hora_desde),
        hora_hasta: normalizeTime(selectedRule.hora_hasta),
        dias_semana: Array.isArray(selectedRule.dias_semana)
          ? selectedRule.dias_semana
          : []
      });
    } else {
      setDraft(emptyRule);
    }
  }, [selectedRule, selectedId]);

  async function loadRules() {
    setLoading(true);
    setError(null);
    setSuccess(null);

    const { data, error: loadError } = await supabase
      .from("livenos_auto_reply_rules")
      .select("*")
      .order("prioridad", { ascending: true })
      .order("created_at", { ascending: true });

    if (loadError) {
      setError(loadError.message || "No se pudieron cargar las automatizaciones.");
      setRules([]);
      setLoading(false);
      return;
    }

    const parsed = (data || []).map((item) => ({
      ...item,
      hora_desde: normalizeTime(item.hora_desde),
      hora_hasta: normalizeTime(item.hora_hasta),
      dias_semana: Array.isArray(item.dias_semana) ? item.dias_semana : []
    })) as AutoReplyRule[];

    setRules(parsed);

    if (parsed.length > 0) {
      setSelectedId(parsed[0].id);
    } else {
      setSelectedId("new");
    }

    setLoading(false);
  }

  function patchDraft(patch: Partial<AutoReplyRule>) {
    setDraft((prev) => ({
      ...prev,
      ...patch
    }));
    setSuccess(null);
    setError(null);
  }

  function toggleDay(day: number) {
    const current = Array.isArray(draft.dias_semana) ? draft.dias_semana : [];
    const exists = current.includes(day);

    const next = exists
      ? current.filter((item) => item !== day)
      : [...current, day];

    const sorted = DIAS.map((dia) => dia.value).filter((dia) => next.includes(dia));

    patchDraft({
      dias_semana: sorted
    });
  }

  function selectWeekdays() {
    patchDraft({
      dias_semana: [1, 2, 3, 4, 5]
    });
  }

  function selectAllDays() {
    patchDraft({
      dias_semana: [1, 2, 3, 4, 5, 6, 0]
    });
  }

  function selectWeekend() {
    patchDraft({
      dias_semana: [6, 0]
    });
  }

  function prepareNewRule() {
    setSelectedId("new");
    setDraft({
      ...emptyRule,
      nombre: "Nueva automatización"
    });
    setError(null);
    setSuccess(null);
  }

  function validateDraft() {
    const nombre = String(draft.nombre || "").trim();
    const mensaje = String(draft.mensaje || "").trim();
    const dias = Array.isArray(draft.dias_semana) ? draft.dias_semana : [];

    if (!nombre) return "La automatización necesita un nombre.";
    if (!mensaje) return "La automatización necesita un mensaje.";
    if (!dias.length) return "Seleccioná al menos un día.";
    if (!draft.hora_desde) return "Indicá la hora desde.";
    if (!draft.hora_hasta) return "Indicá la hora hasta.";

    return null;
  }

  async function saveRule() {
    const validationError = validateDraft();

    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    const payload = {
      nombre: String(draft.nombre || "").trim(),
      activo: Boolean(draft.activo),
      dias_semana: Array.isArray(draft.dias_semana) ? draft.dias_semana : [],
      hora_desde: normalizeTime(draft.hora_desde),
      hora_hasta: normalizeTime(draft.hora_hasta),
      timezone: String(draft.timezone || "America/Argentina/Cordoba").trim(),
      mensaje: String(draft.mensaje || "").trim(),
      cooldown_minutos: parseCooldown(draft.cooldown_minutos),
      aplicar_si_cande_activa: Boolean(draft.aplicar_si_cande_activa),
      aplicar_si_conversacion_tomada: Boolean(draft.aplicar_si_conversacion_tomada),
      prioridad: Number(draft.prioridad || 100),
      updated_at: new Date().toISOString()
    };

    if (selectedId === "new") {
      const { data, error: insertError } = await supabase
        .from("livenos_auto_reply_rules")
        .insert(payload)
        .select("*")
        .single();

      if (insertError) {
        setError(insertError.message || "No se pudo crear la automatización.");
        setSaving(false);
        return;
      }

      setSuccess("Automatización creada correctamente.");
      await loadRules();

      if (data?.id) {
        setSelectedId(data.id);
      }

      setSaving(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("livenos_auto_reply_rules")
      .update(payload)
      .eq("id", selectedId);

    if (updateError) {
      setError(updateError.message || "No se pudo guardar la automatización.");
      setSaving(false);
      return;
    }

    setSuccess("Automatización guardada correctamente.");
    await loadRules();
    setSelectedId(selectedId);
    setSaving(false);
  }

  async function deleteRule() {
    if (selectedId === "new") return;

    const confirmed = window.confirm(
      "¿Seguro que querés eliminar esta automatización? Esta acción no se puede deshacer."
    );

    if (!confirmed) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    const { error: deleteError } = await supabase
      .from("livenos_auto_reply_rules")
      .delete()
      .eq("id", selectedId);

    if (deleteError) {
      setError(deleteError.message || "No se pudo eliminar la automatización.");
      setSaving(false);
      return;
    }

    setSuccess("Automatización eliminada.");
    setSelectedId("new");
    await loadRules();
    setSaving(false);
  }

  async function toggleActive(rule: AutoReplyRule) {
    setSaving(true);
    setError(null);
    setSuccess(null);

    const { error: updateError } = await supabase
      .from("livenos_auto_reply_rules")
      .update({
        activo: !rule.activo,
        updated_at: new Date().toISOString()
      })
      .eq("id", rule.id);

    if (updateError) {
      setError(updateError.message || "No se pudo cambiar el estado.");
      setSaving(false);
      return;
    }

    await loadRules();
    setSelectedId(rule.id);
    setSuccess(!rule.activo ? "Automatización activada." : "Automatización desactivada.");
    setSaving(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 px-3 py-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
                <Bot className="h-5 w-5" />
              </div>

              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Automatizaciones de LiveNos
                </h2>
                <p className="text-sm text-slate-500">
                  Respuestas automáticas por día, horario y estado de conversación.
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[330px_minmax(0,1fr)]">
          <aside className="min-h-0 border-b border-slate-100 bg-slate-50/70 lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Reglas
                </p>
                <p className="text-sm text-slate-600">
                  {activeCount} activa{activeCount === 1 ? "" : "s"} / {rules.length} total
                </p>
              </div>

              <button
                type="button"
                onClick={prepareNewRule}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
              >
                <Plus className="h-4 w-4" />
                Nueva
              </button>
            </div>

            <div className="max-h-[68vh] space-y-2 overflow-y-auto p-3">
              {loading ? (
                <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando automatizaciones...
                </div>
              ) : rules.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
                  Todavía no hay automatizaciones. Creá la primera para responder fuera de horario.
                </div>
              ) : (
                rules.map((rule) => {
                  const selected = selectedId === rule.id;

                  return (
                    <button
                      key={rule.id}
                      type="button"
                      onClick={() => setSelectedId(rule.id)}
                      className={[
                        "w-full rounded-2xl border p-3 text-left transition",
                        selected
                          ? "border-orange-300 bg-orange-50 shadow-sm"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {rule.nombre}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {normalizeTime(rule.hora_desde)} a {normalizeTime(rule.hora_hasta)}
                          </p>
                        </div>

                        <span
                          className={[
                            "rounded-full px-2 py-1 text-[11px] font-semibold",
                            rule.activo
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-500"
                          ].join(" ")}
                        >
                          {rule.activo ? "Activa" : "Inactiva"}
                        </span>
                      </div>

                      <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">
                        {rule.mensaje}
                      </p>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          <main className="min-h-0 overflow-y-auto">
            <div className="space-y-5 p-5">
              {error ? (
                <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              ) : null}

              {success ? (
                <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{success}</span>
                </div>
              ) : null}

              <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Automatización
                    </p>
                    <h3 className="mt-1 text-base font-semibold text-slate-900">
                      {selectedId === "new" ? "Nueva regla" : "Editar regla"}
                    </h3>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {selectedId !== "new" && selectedRule ? (
                      <button
                        type="button"
                        onClick={() => void toggleActive(selectedRule)}
                        disabled={saving}
                        className={[
                          "inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-semibold transition disabled:opacity-60",
                          draft.activo
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                        ].join(" ")}
                      >
                        {draft.activo ? (
                          <ToggleRight className="h-4 w-4" />
                        ) : (
                          <ToggleLeft className="h-4 w-4" />
                        )}
                        {draft.activo ? "Activa" : "Inactiva"}
                      </button>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => void loadRules()}
                      disabled={loading || saving}
                      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
                    >
                      <RefreshCcw className={["h-4 w-4", loading ? "animate-spin" : ""].join(" ")} />
                      Actualizar
                    </button>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <label className="space-y-1.5">
                    <span className="text-sm font-semibold text-slate-700">
                      Nombre
                    </span>
                    <input
                      value={draft.nombre || ""}
                      onChange={(event) => patchDraft({ nombre: event.target.value })}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                      placeholder="Respuesta fuera de horario"
                    />
                  </label>

                  <label className="space-y-1.5">
                    <span className="text-sm font-semibold text-slate-700">
                      Prioridad
                    </span>
                    <input
                      value={draft.prioridad ?? 100}
                      onChange={(event) => patchDraft({ prioridad: Number(event.target.value || 100) })}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                      placeholder="100"
                    />
                  </label>
                </div>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <Clock3 className="h-5 w-5 text-orange-500" />
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">
                      Día y horario
                    </h3>
                    <p className="text-sm text-slate-500">
                      La regla responde fuera del rango configurado. Si ponés 00:00 a 23:59, responde todo el día.
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-4">
                  <div>
                    <p className="mb-2 text-sm font-semibold text-slate-700">
                      Días activos
                    </p>

                    <div className="flex flex-wrap gap-2">
                      {DIAS.map((dia) => {
                        const active = Array.isArray(draft.dias_semana)
                          ? draft.dias_semana.includes(dia.value)
                          : false;

                        return (
                          <button
                            key={dia.value}
                            type="button"
                            onClick={() => toggleDay(dia.value)}
                            className={[
                              "rounded-2xl border px-3 py-2 text-sm font-semibold transition",
                              active
                                ? "border-orange-300 bg-orange-50 text-orange-700"
                                : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                            ].join(" ")}
                          >
                            {dia.label}
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={selectWeekdays}
                        className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-50"
                      >
                        Lunes a viernes
                      </button>

                      <button
                        type="button"
                        onClick={selectWeekend}
                        className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-50"
                      >
                        Fin de semana
                      </button>

                      <button
                        type="button"
                        onClick={selectAllDays}
                        className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-50"
                      >
                        Todos los días
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <label className="space-y-1.5">
                      <span className="text-sm font-semibold text-slate-700">
                        Atención desde
                      </span>
                      
                      <input
  value={draft.hora_desde || ""}
  onChange={(event) => patchDraft({ hora_desde: event.target.value })}
  onBlur={() => patchDraft({ hora_desde: normalizeTime(draft.hora_desde) })}
  inputMode="numeric"
  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
  placeholder="09:00"
/>
                    </label>

                    <label className="space-y-1.5">
                      <span className="text-sm font-semibold text-slate-700">
                        Atención hasta
                      </span>
                     <input
  value={draft.hora_hasta || ""}
  onChange={(event) => patchDraft({ hora_hasta: event.target.value })}
  onBlur={() => patchDraft({ hora_hasta: normalizeTime(draft.hora_hasta) })}
  inputMode="numeric"
  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
  placeholder="20:30"
/>
                    </label>

                    <label className="space-y-1.5">
                      <span className="text-sm font-semibold text-slate-700">
                        Tiempo para proximo mensaje.
                      </span>
                      <input
                        value={draft.cooldown_minutos ?? 720}
                        onChange={(event) =>
                          patchDraft({
                            cooldown_minutos: parseCooldown(event.target.value)
                          })
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                        placeholder="720"
                      />
                    </label>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                    <strong>Estado actual:</strong>{" "}
                    {matchesNow
                      ? "con la configuración actual, esta regla podría responder ahora si entra un mensaje."
                      : "con la configuración actual, esta regla no respondería ahora porque estás dentro del horario o el día no aplica."}
                  </div>
                </div>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5 text-orange-500" />
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">
                      Mensaje automático
                    </h3>
                    <p className="text-sm text-slate-500">
                      Este texto se envía al pasajero por WhatsApp.
                    </p>
                  </div>
                </div>

                <label className="mt-4 block space-y-1.5">
                  <span className="text-sm font-semibold text-slate-700">
                    Texto
                  </span>
                  <textarea
                    value={draft.mensaje || ""}
                    onChange={(event) => patchDraft({ mensaje: event.target.value })}
                    rows={7}
                    className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                    placeholder={DEFAULT_MESSAGE}
                  />
                </label>

                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Vista previa
                  </p>
                  <div className="max-w-xl rounded-2xl bg-white p-3 text-sm leading-6 text-slate-700 shadow-sm">
                    {draft.mensaje || "El mensaje aparecerá acá."}
                  </div>
                </div>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="text-base font-semibold text-slate-900">
                  Condiciones
                </h3>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <button
                    type="button"
                    onClick={() =>
                      patchDraft({
                        aplicar_si_cande_activa: !draft.aplicar_si_cande_activa
                      })
                    }
                    className={[
                      "rounded-2xl border p-4 text-left transition",
                      draft.aplicar_si_cande_activa
                        ? "border-orange-300 bg-orange-50"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    ].join(" ")}
                  >
                    <div className="flex items-center gap-2">
                      {draft.aplicar_si_cande_activa ? (
                        <ToggleRight className="h-5 w-5 text-orange-600" />
                      ) : (
                        <ToggleLeft className="h-5 w-5 text-slate-400" />
                      )}
                      <span className="text-sm font-semibold text-slate-900">
                        Responder aunque CANDE esté activa
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      Para prueba conviene activarlo. En producción normalmente queda apagado para no pisar a CANDE.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      patchDraft({
                        aplicar_si_conversacion_tomada: !draft.aplicar_si_conversacion_tomada
                      })
                    }
                    className={[
                      "rounded-2xl border p-4 text-left transition",
                      draft.aplicar_si_conversacion_tomada
                        ? "border-orange-300 bg-orange-50"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    ].join(" ")}
                  >
                    <div className="flex items-center gap-2">
                      {draft.aplicar_si_conversacion_tomada ? (
                        <ToggleRight className="h-5 w-5 text-orange-600" />
                      ) : (
                        <ToggleLeft className="h-5 w-5 text-slate-400" />
                      )}
                      <span className="text-sm font-semibold text-slate-900">
                        Responder aunque esté tomada
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      Si está apagado, no responde cuando un vendedor ya tomó la conversación.
                    </p>
                  </button>
                </div>

             
              </section>

              <div className="sticky bottom-0 -mx-5 -mb-5 flex flex-col-reverse gap-3 border-t border-slate-100 bg-white/95 px-5 py-4 backdrop-blur md:flex-row md:items-center md:justify-between">
                <div className="text-xs text-slate-400">
                  Zona horaria: America/Argentina/Cordoba
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2">
                  {selectedId !== "new" ? (
                    <button
                      type="button"
                      onClick={() => void deleteRule()}
                      disabled={saving}
                      className="inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-60"
                    >
                      <Trash2 className="h-4 w-4" />
                      Eliminar
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                  >
                    Cerrar
                  </button>

                  <button
                    type="button"
                    onClick={() => void saveRule()}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600 disabled:opacity-60"
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Guardar automatización
                  </button>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}