import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Database,
  FileSpreadsheet,
  Loader2,
  RefreshCcw,
  Search,
  TableProperties,
  UploadCloud,
  X
} from "lucide-react";
import {
  getImportCatalogFields,
  getImportCatalogLabel,
  getImportFieldLabel,
  useImportadorCatalogosStore,
  type ImportCatalogType
} from "../../store/importadorCatalogosStore";

type SelectOption = {
  value: string;
  label: string;
};

const CATALOG_OPTIONS: SelectOption[] = [
  { value: "clientes", label: "Clientes" },
  { value: "destinos", label: "Destinos" },
  { value: "metodos_contacto", label: "Métodos de contacto" },
  { value: "servicios", label: "Servicios" },
  { value: "formas_pago", label: "Formas de pago" },
  { value: "operadores", label: "Operadores" },
  { value: "proveedores", label: "Proveedores" },
  { value: "cajas", label: "Cajas" },
  { value: "hoteles_maestros", label: "Hoteles maestros" },
  { value: "carritos", label: "Carritos" },
  { value: "carritos_files_historicos", label: "Carritos / Files históricos" },
  { value: "live_contactos", label: "Live Connect · Contactos" },
  { value: "live_conversaciones", label: "Live Connect · Conversaciones" },
  { value: "live_mensajes", label: "Live Connect · Mensajes" }
];  

const DELIMITER_OPTIONS: SelectOption[] = [
  { value: ",", label: "Coma (,)" },
  { value: ";", label: "Punto y coma (;)" },
  { value: "\t", label: "Tabulación" }
];

function normalizeText(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function getImportPlaceholder(catalogType: ImportCatalogType): string {
  if (catalogType === "clientes") {
    return `Ejemplo para clientes:
nombre_completo,nombre,apellido,email,telefono,telefono_normalizado,dni,cuit,fecha_nacimiento,ciudad,provincia,pais,direccion,observaciones,activo
Juan Pérez,Juan,Pérez,juan@email.com,+5493510000000,5493510000000,30111222,,1985-04-10,Córdoba,Córdoba,Argentina,"Av. Siempre Viva 123","Cliente histórico",true
María Gómez,María,Gómez,maria@email.com,+5493511111111,5493511111111,28999888,,1990-08-22,Córdoba,Córdoba,Argentina,,"Importado desde sistema anterior",true

Campos mínimos recomendados:
nombre_completo o nombre + apellido
telefono o email

Notas:
- Si viene telefono_normalizado, se usa para evitar duplicados.
- Si no viene telefono_normalizado, se normaliza desde telefono.
- También se puede detectar duplicado por email.`;
  }

  if (catalogType === "live_contactos") {
    return `Ejemplo para contactos Live:
live_contact_id,nombre,apellidos,nombre_completo,email,celular,celular_normalizado,empresa,etiquetas,pais,ciudad,live_fecha_creado,live_fecha_editado
123,Juan,Pérez,Juan Pérez,juan@email.com,+5493510000000,5493510000000,NOSSIX,"cliente, viaje",Argentina,Córdoba,2026-05-01,2026-05-02

Campos mínimos:
live_contact_id`;
  }

  if (catalogType === "live_conversaciones") {
    return `Ejemplo para conversaciones Live:
live_conversation_id,etiqueta,canal_nombre,canal_tipo,live_contact_id,live_contacto_nombre,telefono,telefono_normalizado,empresa,agente,grupo,pais,ultimo_mensaje,url_conversacion,live_fecha_creado,live_fecha_editado,live_fecha_finalizado
abc123,Consulta,WhatsApp,whatsapp,123,Juan Pérez,+5493510000000,5493510000000,NOSSIX,Jorge,Ventas,Argentina,"Hola, quiero viajar",https://...,2026-05-01,2026-05-02,

Campos mínimos:
live_conversation_id`;
  }

  if (catalogType === "live_mensajes") {
    return `Ejemplo para mensajes Live:
live_conversation_id,orden,fecha_mensaje,hora_texto,direction,sender_name,sender_role,content,message_type,media_url,media_filename,media_mime_type,raw_html
abc123,1,2026-05-01 10:30,10:30,inbound,Juan,cliente,"Hola, quiero viajar",text,,,,

Campos mínimos:
live_conversation_id, orden, direction, message_type`;
  }

  if (catalogType === "hoteles_maestros") {
    return `Ejemplo para hoteles maestros:
nombre,ubicacion,categoria,descripcion,imagenes,regimen,tipo_habitacion,tipo_tarifa,cargos_adicionales,descripcion_cargos,activo
Buzios Arambare,"Colinas De Geribá, 18 - Geribá",3,"Hotel con piscina y desayuno buffet","[{""url"":""https://...""}]",Desayuno,Standard,Reembolsable,false,,true

Campos mínimos:
nombre

Notas:
- imagenes puede venir vacío o como JSON.
- categoria puede ser número: 3, 4, 5.
- cargos_adicionales acepta true/false, sí/no, 1/0.`;
  }

  if (catalogType === "carritos") {
    return `Ejemplo para carritos históricos:
telefono,email,nombre_pasajero,numero_carrito,fecha_venta,servicio_id,servicio,metodo_contacto,forma_pago_id,forma_pago,destino,fecha_in,fecha_out,solo_ida,importe,moneda,observaciones
+5493510000000,cliente@email.com,Juan Pérez,203358486,2026-04-06,,Paquete,WhatsApp,,Transferencia,Río de Janeiro,2026-07-16,2026-07-24,false,153227.06,ARS,Observación interna

Campos mínimos recomendados:
telefono, nombre_pasajero, numero_carrito, fecha_venta`;
  }

  if (catalogType === "destinos") {
    return `Ejemplo para destinos:
nombre,pais,activo
Cancún,México,true
Bariloche,Argentina,true
Madrid,España,true`;
  }

  if (catalogType === "metodos_contacto") {
    return `Ejemplo para métodos de contacto:
nombre,color,activo
WhatsApp,#22c55e,true
Instagram,#a855f7,true
Referido,#2563eb,true`;
  }

  if (catalogType === "servicios") {
    return `Ejemplo para servicios:
nombre,color,activo
Aéreo,#2563eb,true
Hotel,#f97316,true
Paquete,#22c55e,true
Traslado,#64748b,true`;
  }

  if (catalogType === "formas_pago") {
    return `Ejemplo para formas de pago:
nombre,impacta_tesoreria,activo
Transferencia,true,true
Efectivo,true,true
Tarjeta,true,true
Promocode,false,true`;
  }

  if (catalogType === "operadores") {
    return `Ejemplo para operadores:
nombre,color,razon_social,cuit,activo
Piamonte,#FF6A00,Piamonte Turismo,30-00000000-0,true
Delfos,#2563eb,Delfos Tour,30-00000000-0,true`;
  }

  if (catalogType === "proveedores") {
    return `Ejemplo para proveedores:
nombre_comercial,razon_social,cuit,telefono,activo
Proveedor Hotelero,Proveedor Hotelero SA,30-00000000-0,+5493510000000,true
Proveedor Traslados,Proveedor Traslados SA,30-00000000-0,+5493510000000,true`;
  }

  return `Ejemplo para cajas:
nombre,tipo,moneda,sucursal_id,descripcion,orden,activa,activo
Caja pesos,CAJA,ARS,,Caja principal pesos,10,true,true
Caja dólares,CAJA,USD,,Caja principal dólares,20,true,true
Banco pesos,BANCO,ARS,,Cuenta bancaria pesos,30,true,true
Banco dólares,BANCO,USD,,Cuenta bancaria dólares,40,true,true
Billetera virtual,BILLETERA,ARS,,Mercado Pago u otra billetera,50,true,true`;
}

function getCatalogHelp(catalogType: ImportCatalogType): string | null {
  if (catalogType === "clientes") {
    return "Importa clientes históricos desde la base anterior. Se recomienda comparar por teléfono normalizado y email para evitar duplicados.";
  }

  if (catalogType === "live_contactos") {
    return "Importa el maestro de contactos exportado desde Live Connect. Se compara por live_contact_id para evitar duplicados.";
  }

  if (catalogType === "live_conversaciones") {
    return "Importa el listado histórico de conversaciones de Live Connect. Luego se puede vincular con contactos y retomar conversaciones.";
  }

  if (catalogType === "live_mensajes") {
    return "Importa los mensajes parseados de cada conversación Live. Se ordenan por live_conversation_id + orden.";
  }

  if (catalogType === "carritos") {
    return "Los carritos se importan como operación normal: visibles en Carritos y preparados para control, facturación/cobro y reportes.";
  }

  if (catalogType === "hoteles_maestros") {
    return "Importa hoteles a la base maestra para que después el presupuestador pueda buscarlos por nombre. Se compara por nombre + ubicación para evitar duplicados.";
  }

  return null;
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.14em] text-[#64748b]">
      {children}
    </label>
  );
}

function TextArea({
  value,
  onChange,
  placeholder
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="min-h-[260px] w-full resize-none rounded-2xl border border-black/10 bg-[#f8fafc] px-3 py-3 text-xs font-semibold text-[#111827] outline-none transition placeholder:text-[#94a3b8] focus:border-nostur-orange"
    />
  );
}

function NosturSelect({
  value,
  onChange,
  options,
  placeholder = "Seleccionar"
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selected = options.find((option) => option.value === value);

  const filteredOptions = useMemo(() => {
    const q = normalizeText(search);

    if (!q) return options;

    return options.filter((option) => normalizeText(`${option.label} ${option.value}`).includes(q));
  }, [options, search]);

  return (
    <div className={["relative", open ? "z-[160]" : "z-0"].join(" ")}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-black/10 bg-[#f8fafc] px-3 text-left text-xs font-semibold text-[#111827] outline-none transition hover:bg-white"
      >
        <span className={selected ? "truncate" : "truncate text-[#94a3b8]"}>
          {selected?.label || placeholder}
        </span>

        <ChevronDown
          size={14}
          strokeWidth={1.8}
          className={["shrink-0 text-[#64748b] transition", open ? "rotate-180" : ""].join(" ")}
        />
      </button>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default bg-transparent"
            onClick={() => {
              setOpen(false);
              setSearch("");
            }}
            tabIndex={-1}
          />

          <div className="absolute left-0 right-0 top-[44px] z-[170] rounded-2xl border border-black/10 bg-white p-2 shadow-xl">
            <div className="mb-2 flex h-8 items-center gap-2 rounded-xl border border-black/10 bg-[#f8fafc] px-2">
              <Search size={13} className="text-[#94a3b8]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar..."
                autoFocus
                className="h-full min-w-0 flex-1 bg-transparent text-xs font-semibold outline-none"
              />
            </div>

            <div className="max-h-56 overflow-auto">
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-2 text-xs font-bold text-[#94a3b8]">Sin opciones</div>
              ) : (
                filteredOptions.map((option) => {
                  const active = option.value === value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        onChange(option.value);
                        setOpen(false);
                        setSearch("");
                      }}
                      className={[
                        "flex h-8 w-full items-center rounded-xl px-3 text-left text-xs font-bold transition",
                        active ? "bg-nostur-orange text-white" : "text-[#334155] hover:bg-[#f1f5f9]"
                      ].join(" ")}
                    >
                      <span className="truncate">{option.label}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function BooleanChip({
  checked,
  onChange,
  label
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={[
        "flex h-10 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-black transition",
        checked
          ? "border-nostur-orange/40 bg-nostur-orange/20 text-[#111827]"
          : "border-black/10 bg-white/70 text-[#64748b]"
      ].join(" ")}
    >
      {checked ? <CheckCircle2 size={15} /> : <X size={15} />}
      {label}
    </button>
  );
}

function MetricCard({
  label,
  value,
  tone = "default"
}: {
  label: string;
  value: string | number;
  tone?: "default" | "green" | "amber" | "red";
}) {
  const toneClass = {
    default: "bg-white/75 text-[#111827]",
    green: "bg-green-50 text-green-700 border-green-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    red: "bg-red-50 text-red-700 border-red-200"
  }[tone];

  return (
    <div className={["rounded-2xl border border-black/10 p-3 shadow-sm", toneClass].join(" ")}>
      <div className="text-lg font-black">{value}</div>
      <div className="text-[11px] font-bold text-[#64748b]">{label}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: "nuevo" | "duplicado" | "invalido" }) {
  const className = {
    nuevo: "border-green-200 bg-green-50 text-green-700",
    duplicado: "border-amber-200 bg-amber-50 text-amber-700",
    invalido: "border-red-200 bg-red-50 text-red-700"
  }[status];

  const label = {
    nuevo: "Nuevo",
    duplicado: "Duplicado",
    invalido: "Inválido"
  }[status];

  return (
    <span
      className={[
        "inline-flex h-7 items-center rounded-xl border px-2.5 text-[10px] font-black uppercase tracking-wide",
        className
      ].join(" ")}
    >
      {label}
    </span>
  );
}

export function ImportadorCatalogosPanel() {
  const loading = useImportadorCatalogosStore((state) => state.loading);
  const importing = useImportadorCatalogosStore((state) => state.importing);
  const error = useImportadorCatalogosStore((state) => state.error);
  const catalogType = useImportadorCatalogosStore((state) => state.catalogType);
  const rawText = useImportadorCatalogosStore((state) => state.rawText);
  const delimiter = useImportadorCatalogosStore((state) => state.delimiter);
  const hasHeaders = useImportadorCatalogosStore((state) => state.hasHeaders);
  const detectedColumns = useImportadorCatalogosStore((state) => state.detectedColumns);
  const columnMap = useImportadorCatalogosStore((state) => state.columnMap);
  const rawRows = useImportadorCatalogosStore((state) => state.rawRows);
  const previewRows = useImportadorCatalogosStore((state) => state.previewRows);
  const result = useImportadorCatalogosStore((state) => state.result);

  const setCatalogType = useImportadorCatalogosStore((state) => state.setCatalogType);
  const setRawText = useImportadorCatalogosStore((state) => state.setRawText);
  const setDelimiter = useImportadorCatalogosStore((state) => state.setDelimiter);
  const setHasHeaders = useImportadorCatalogosStore((state) => state.setHasHeaders);
  const setColumnMapValue = useImportadorCatalogosStore((state) => state.setColumnMapValue);
  const parseRawText = useImportadorCatalogosStore((state) => state.parseRawText);
  const buildPreview = useImportadorCatalogosStore((state) => state.buildPreview);
  const importPreview = useImportadorCatalogosStore((state) => state.importPreview);
  const reset = useImportadorCatalogosStore((state) => state.reset);
  const clearError = useImportadorCatalogosStore((state) => state.clearError);

  const fields = getImportCatalogFields(catalogType);
  const catalogHelp = getCatalogHelp(catalogType);

  const columnOptions: SelectOption[] = useMemo(
    () => [
      { value: "", label: "No mapear" },
      ...detectedColumns.map((column) => ({
        value: column,
        label: column
      }))
    ],
    [detectedColumns]
  );

  const previewMetrics = useMemo(() => {
    return {
      total: previewRows.length,
      nuevos: previewRows.filter((row) => row.status === "nuevo").length,
      duplicados: previewRows.filter((row) => row.status === "duplicado").length,
      invalidos: previewRows.filter((row) => row.status === "invalido").length
    };
  }, [previewRows]);

  const canParse = rawText.trim().length > 0;
  const canPreview = rawRows.length > 0 && detectedColumns.length > 0;
  const canImport = previewMetrics.nuevos > 0 && !loading && !importing;

  async function handleFileChange(file: File | null) {
    if (!file) return;

    const text = await file.text();
    setRawText(text);

    const lowerName = file.name.toLowerCase();

    if (lowerName.endsWith(".tsv")) {
      setDelimiter("\t");
    }

    if (lowerName.endsWith(".csv")) {
      setDelimiter(",");
    }
  }

  async function handleImport() {
    const ok = await importPreview();

    if (ok) {
      window.setTimeout(() => {
        void buildPreview();
      }, 300);
    }
  }

  return (
    <div className="max-h-[calc(100vh-120px)] w-full overflow-y-auto rounded-[24px] border border-black/10 bg-white/55 p-4 shadow-sm backdrop-blur">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-nostur-orange/15 text-nostur-orange">
              <UploadCloud size={17} strokeWidth={1.8} />
            </div>

            <div>
              <h2 className="text-sm font-black text-[#111827]">Importador / mapeador</h2>
              <p className="text-[11px] font-semibold text-[#64748b]">
                Pegá datos, detectá columnas, mapeá campos y evitá duplicados antes de importar.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={reset}
          className="flex h-9 items-center gap-2 rounded-xl bg-white/80 px-3 text-xs font-black text-[#334155] shadow-sm hover:bg-white"
        >
          <RefreshCcw size={14} strokeWidth={1.8} />
          Reiniciar
        </button>
      </div>

      {error ? (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">
          <div className="flex items-start gap-2">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>

          <button type="button" onClick={clearError} className="text-red-500 hover:text-red-700">
            <X size={14} />
          </button>
        </div>
      ) : null}

      {result ? (
        <div className="mb-4 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-xs font-bold text-green-700">
          Importación finalizada: {result.inserted} creados · {result.skipped} duplicados omitidos · {result.invalid} inválidos.
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[390px_minmax(0,1fr)]">
        <section className="min-w-0 rounded-2xl border border-black/10 bg-white/75 p-4 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <FileSpreadsheet size={16} className="text-nostur-orange" />
            <h3 className="text-xs font-black uppercase tracking-[0.14em] text-[#475569]">
              Origen de datos
            </h3>
          </div>

          <div className="grid gap-3">
            <div>
              <FieldLabel>Catálogo destino</FieldLabel>
              <NosturSelect
                value={catalogType}
                onChange={(value) => setCatalogType(value as ImportCatalogType)}
                options={CATALOG_OPTIONS}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <FieldLabel>Separador</FieldLabel>
                <NosturSelect
                  value={delimiter}
                  onChange={(value) => setDelimiter(value as "," | ";" | "\t")}
                  options={DELIMITER_OPTIONS}
                />
              </div>

              <div>
                <FieldLabel>Encabezados</FieldLabel>
                <BooleanChip
                  checked={hasHeaders}
                  onChange={setHasHeaders}
                  label={hasHeaders ? "Tiene encabezados" : "Sin encabezados"}
                />
              </div>
            </div>

            <div>
              <FieldLabel>Archivo CSV / TSV / JSON</FieldLabel>

              <label className="flex min-h-[92px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-nostur-orange/40 bg-nostur-orange/5 px-4 py-4 text-center transition hover:bg-nostur-orange/10">
                <UploadCloud size={22} className="mb-2 text-nostur-orange" strokeWidth={1.8} />
                <span className="text-xs font-black text-[#111827]">Seleccionar archivo</span>
                <span className="mt-1 text-[11px] font-semibold text-[#64748b]">
                  También podés pegar el contenido abajo.
                </span>

                <input
                  type="file"
                  accept=".csv,.tsv,.txt,.json"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0] || null;
                    void handleFileChange(file);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
            </div>

            <div>
              <FieldLabel>Datos pegados</FieldLabel>
              <TextArea
                value={rawText}
                onChange={setRawText}
                placeholder={getImportPlaceholder(catalogType)}
              />
            </div>

            <button
              type="button"
              onClick={parseRawText}
              disabled={!canParse}
              className="flex h-10 items-center justify-center gap-2 rounded-xl bg-nostur-orange px-4 text-xs font-black text-white shadow-sm hover:bg-nostur-orangeSoft disabled:opacity-50"
            >
              <TableProperties size={15} strokeWidth={1.8} />
              Detectar columnas
            </button>
          </div>
        </section>

        <section className="min-w-0 rounded-2xl border border-black/10 bg-white/75 p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Database size={16} className="text-nostur-orange" />
                <h3 className="text-xs font-black uppercase tracking-[0.14em] text-[#475569]">
                  Mapeo hacia {getImportCatalogLabel(catalogType)}
                </h3>
              </div>

              <p className="mt-1 text-[11px] font-semibold text-[#64748b]">
                {rawRows.length > 0
                  ? `${rawRows.length} filas detectadas · ${detectedColumns.length} columnas`
                  : "Primero detectá columnas para armar el mapeo."}
              </p>
            </div>

            <button
              type="button"
              onClick={buildPreview}
              disabled={!canPreview || loading}
              className="flex h-9 items-center gap-2 rounded-xl bg-white/80 px-3 text-xs font-black text-[#334155] shadow-sm hover:bg-white disabled:opacity-50"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              Previsualizar
            </button>
          </div>

          {detectedColumns.length === 0 ? (
            <div className="rounded-2xl border border-black/10 bg-[#f8fafc] p-5 text-center text-xs font-semibold text-[#64748b]">
              Todavía no hay columnas detectadas.
            </div>
          ) : (
            <div className="grid gap-4">
              <div className="rounded-2xl border border-black/10 bg-[#f8fafc] p-3">
                <FieldLabel>Columnas detectadas</FieldLabel>

                <div className="flex flex-wrap gap-1.5">
                  {detectedColumns.map((column) => (
                    <span
                      key={column}
                      className="rounded-xl border border-black/10 bg-white px-2 py-1 text-[11px] font-bold text-[#334155]"
                    >
                      {column}
                    </span>
                  ))}
                </div>
              </div>

              {catalogHelp ? (
                <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs font-semibold text-blue-700">
                  {catalogHelp}
                </div>
              ) : null}

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {fields.map((field) => (
                  <div key={field}>
                    <FieldLabel>{getImportFieldLabel(field)}</FieldLabel>
                    <NosturSelect
                      value={columnMap[field] || ""}
                      onChange={(value) => setColumnMapValue(field, value)}
                      options={columnOptions}
                      placeholder="Elegir columna"
                    />
                  </div>
                ))}
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                <MetricCard label="Filas previsualizadas" value={previewMetrics.total} />
                <MetricCard label="Nuevos" value={previewMetrics.nuevos} tone="green" />
                <MetricCard label="Duplicados" value={previewMetrics.duplicados} tone="amber" />
                <MetricCard label="Inválidos" value={previewMetrics.invalidos} tone="red" />
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={buildPreview}
                  disabled={!canPreview || loading}
                  className="flex h-10 items-center justify-center gap-2 rounded-xl bg-white px-4 text-xs font-black text-[#334155] shadow-sm hover:bg-[#f8fafc] disabled:opacity-50"
                >
                  {loading ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                  Actualizar preview
                </button>

                <button
                  type="button"
                  onClick={handleImport}
                  disabled={!canImport}
                  className="flex h-10 items-center justify-center gap-2 rounded-xl bg-nostur-orange px-5 text-xs font-black text-white shadow-sm hover:bg-nostur-orangeSoft disabled:opacity-50"
                >
                  {importing ? <Loader2 size={15} className="animate-spin" /> : <UploadCloud size={15} />}
                  Importar nuevos
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      <section className="mt-4 min-w-0 rounded-2xl border border-black/10 bg-white/75 p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-[#111827]">Preview de importación</h3>
            <p className="text-[11px] font-semibold text-[#64748b]">
              Se importan solamente las filas marcadas como “Nuevo”.
            </p>
          </div>
        </div>

        {previewRows.length === 0 ? (
          <div className="rounded-2xl border border-black/10 bg-[#f8fafc] p-5 text-center text-xs font-semibold text-[#64748b]">
            Todavía no hay preview. Detectá columnas y luego tocá “Previsualizar”.
          </div>
        ) : (
          <div className="max-h-[520px] overflow-auto rounded-2xl border border-black/10">
            <table className="w-full min-w-[900px] border-collapse bg-white text-left text-xs">
              <thead className="sticky top-0 z-10 bg-[#f8fafc]">
                <tr className="border-b border-black/10">
                  <th className="w-[70px] px-3 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-[#64748b]">
                    Fila
                  </th>
                  <th className="w-[120px] px-3 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-[#64748b]">
                    Estado
                  </th>

                  {fields.map((field) => (
                    <th
                      key={field}
                      className="px-3 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-[#64748b]"
                    >
                      {getImportFieldLabel(field)}
                    </th>
                  ))}

                  <th className="px-3 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-[#64748b]">
                    Observación
                  </th>
                </tr>
              </thead>

              <tbody>
                {previewRows.map((row) => (
                  <tr
                    key={row.index}
                    className={[
                      "border-b border-black/5",
                      row.status === "nuevo"
                        ? "bg-white"
                        : row.status === "duplicado"
                          ? "bg-amber-50/45"
                          : "bg-red-50/45"
                    ].join(" ")}
                  >
                    <td className="px-3 py-2 font-black text-[#111827]">{row.index}</td>

                    <td className="px-3 py-2">
                      <StatusBadge status={row.status} />
                    </td>

                    {fields.map((field) => (
                      <td key={field} className="px-3 py-2 font-semibold text-[#334155]">
                        {String(row.mapped[field] ?? "") || "—"}
                      </td>
                    ))}

                    <td className="px-3 py-2 font-semibold text-[#64748b]">
                      {row.reason || "Listo para importar"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}