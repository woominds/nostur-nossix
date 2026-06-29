import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

const SRC_URL = process.env.SRC_SUPABASE_URL;
const SRC_SERVICE_KEY = process.env.SRC_SUPABASE_SERVICE_ROLE_KEY;

const DST_URL = process.env.DST_SUPABASE_URL;
const DST_SERVICE_KEY = process.env.DST_SUPABASE_SERVICE_ROLE_KEY;

if (!SRC_URL || !SRC_SERVICE_KEY || !DST_URL || !DST_SERVICE_KEY) {
  throw new Error(
    "Faltan variables: SRC_SUPABASE_URL, SRC_SUPABASE_SERVICE_ROLE_KEY, DST_SUPABASE_URL, DST_SUPABASE_SERVICE_ROLE_KEY"
  );
}

const ORIGEN = createClient(SRC_URL, SRC_SERVICE_KEY);
const DESTINO = createClient(DST_URL, DST_SERVICE_KEY);

const BATCH_SIZE = 500;

function md5Uuid(input) {
  const hash = crypto.createHash("md5").update(String(input)).digest("hex");

  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    hash.slice(12, 16),
    hash.slice(16, 20),
    hash.slice(20, 32)
  ].join("-");
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toDate(value) {
  if (!value) return null;
  return String(value).slice(0, 10);
}

function toTimestampFromDate(value) {
  const date = toDate(value);
  return date ? `${date}T12:00:00-03:00` : null;
}

function getMonth(value) {
  const date = toDate(value);
  if (!date) return null;
  return Number(date.slice(5, 7));
}

function getYear(value) {
  const date = toDate(value);
  if (!date) return null;
  return Number(date.slice(0, 4));
}

function normalizeTipoDocumento(factura) {
  const raw = String(factura.tipo_factura || factura.tipo_comprobante || "").toUpperCase();

  if (raw.includes("NC") || raw.includes("NOTA_CREDITO") || factura.anula_factura_id) {
    return "NOTA_CREDITO";
  }

  if (raw.includes("ND") || raw.includes("NOTA_DEBITO")) {
    return "NOTA_DEBITO";
  }

  return "FACTURA";
}

function isFacturaCobrada(factura) {
  return Boolean(
    factura.cobrado ||
      factura.descontada_cashflow ||
      factura.cobrada_transferencia
  );
}

function normalizeEstadoFactura(factura) {
  const estadoFiscal = String(factura.estado_fiscal || "").toLowerCase();

  if (estadoFiscal === "anulada" || estadoFiscal === "anulado") {
    return "ANULADA";
  }

  if (isFacturaCobrada(factura)) {
    return "COBRADA";
  }

  return "PENDIENTE";
}

function normalizeFormaCobro(factura) {
  if (!isFacturaCobrada(factura)) return null;
  if (factura.descontada_cashflow) return "CASHFLOW";
  if (factura.cobrada_transferencia) return "TRANSFERENCIA";
  return "TRANSFERENCIA";
}

function getNumeroDocumento(factura) {
  const numero = String(factura.numero_factura || "").trim();

  if (numero) return numero;

  return [factura.punto_venta, factura.numero_comprobante]
    .filter(Boolean)
    .join("-");
}

function getMesAnioFactura(factura) {
  if (factura.mes_liquidado && /^\d{4}-\d{2}$/.test(factura.mes_liquidado)) {
    return {
      anio: Number(factura.mes_liquidado.slice(0, 4)),
      mes: Number(factura.mes_liquidado.slice(5, 7))
    };
  }

  const baseDate =
    factura.fecha_factura ||
    factura.fecha_emision ||
    factura.created_at;

  return {
    anio: getYear(baseDate),
    mes: getMonth(baseDate)
  };
}

async function fetchAll(client, table, select = "*") {
  const rows = [];
  let from = 0;

  while (true) {
    const { data, error } = await client
      .from(table)
      .select(select)
      .range(from, from + BATCH_SIZE - 1);

    if (error) {
      throw new Error(`${table}: ${error.message}`);
    }

    if (!data || data.length === 0) break;

    rows.push(...data);

    if (data.length < BATCH_SIZE) break;
    from += BATCH_SIZE;
  }

  return rows;
}

async function upsertInBatches(client, table, rows, options = { onConflict: "id" }) {
  if (!rows.length) {
    console.log(`${table}: 0 filas`);
    return;
  }

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    const { error } = await client
      .from(table)
      .upsert(batch, options);

    if (error) {
      console.error(`Error upsert ${table}`, error);
      throw new Error(`${table}: ${error.message}`);
    }

    console.log(`${table}: ${Math.min(i + batch.length, rows.length)} / ${rows.length}`);
  }
}

async function main() {
  console.log("Leyendo origen...");

const [
  facturasOrigen,
  facturasCarritosOrigen,
  cobrosOrigen,
  cobrosItemsOrigen
] = await Promise.all([
  fetchAll(ORIGEN, "facturas"),
  fetchAll(ORIGEN, "facturas_carritos"),
  fetchAll(ORIGEN, "cobros_facturas"),
  fetchAll(ORIGEN, "cobros_facturas_items")
]);

let retencionesOrigen = [];

try {
  retencionesOrigen = await fetchAll(ORIGEN, "retenciones_percepciones");
} catch (error) {
  console.warn("ATENCIÓN: no se pudieron leer retenciones_percepciones. Se migra sin retenciones por ahora.");
  console.warn(error.message);
  retencionesOrigen = [];
}

  console.log("Origen:");
  console.log({
    facturas: facturasOrigen.length,
    facturas_carritos: facturasCarritosOrigen.length,
    cobros_facturas: cobrosOrigen.length,
    cobros_facturas_items: cobrosItemsOrigen.length,
    retenciones_percepciones: retencionesOrigen.length
  });

  console.log("Leyendo catálogos destino...");

  const [
    sucursalesDestino,
    cajasDestino,
    carritosDestino,
    clientesDestino
  ] = await Promise.all([
    fetchAll(DESTINO, "sucursales"),
    fetchAll(DESTINO, "cajas"),
    fetchAll(DESTINO, "carritos", "id, legacy_id, numero_carrito, cliente_id, fecha_venta, moneda, sucursal_id"),
    fetchAll(DESTINO, "clientes", "id, nombre_completo, sucursal_id")
  ]);

  const sucursalById = new Map(sucursalesDestino.map((s) => [s.id, s]));
  const cajaById = new Map(cajasDestino.map((c) => [c.id, c]));
  const carritoByLegacyId = new Map(
    carritosDestino
      .filter((c) => c.legacy_id)
      .map((c) => [c.legacy_id, c])
  );
  const carritoById = new Map(carritosDestino.map((c) => [c.id, c]));
  const clienteById = new Map(clientesDestino.map((c) => [c.id, c]));

  const facturasById = new Map(facturasOrigen.map((f) => [f.id, f]));
  const cobrosById = new Map(cobrosOrigen.map((c) => [c.id, c]));

  console.log("Transformando facturas...");

  const facturasCobrar = facturasOrigen.map((f) => {
    const cobradas = isFacturaCobrada(f);
    const fechaCobro = f.fecha_cobro || f.fecha_factura || f.fecha_emision || null;
    const mesAnio = getMesAnioFactura(f);
    const sucursal = f.sucursal_id ? sucursalById.get(f.sucursal_id) : null;

    return {
      id: f.id,
      tipo_documento: normalizeTipoDocumento(f),
      numero_documento: getNumeroDocumento(f),
      razon_social: String(f.razon_social || "ALMUNDO.COM").trim() || "ALMUNDO.COM",
      moneda: f.moneda || "ARS",
      sucursal_id: sucursalById.has(f.sucursal_id) ? f.sucursal_id : null,
      sucursal: sucursal?.nombre || null,
      mes: mesAnio.mes,
      anio: mesAnio.anio,
      neto_gravado: toNumber(f.neto_gravado, toNumber(f.importe_total)),
      alicuota_iva: toNumber(f.iva_alicuota),
      iva_importe: toNumber(f.iva_importe),
      no_gravado: toNumber(f.no_gravado),
      exento: toNumber(f.exento),
      total: toNumber(f.importe_total),
      estado: normalizeEstadoFactura(f),
      cobrado: cobradas,
      cobrado_at: cobradas ? toTimestampFromDate(fechaCobro) : null,
      cobrado_by: null,
      forma_cobro: normalizeFormaCobro(f),
      caja_id: null,
      caja: null,
      referencia_cobro: null,
      no_impacta_caja: Boolean(f.descontada_cashflow),
      observaciones: f.descripcion || null,
      created_by: null,
      created_at: f.created_at || new Date().toISOString(),
      updated_at: f.updated_at || f.created_at || new Date().toISOString(),
      punto_venta: f.punto_venta || null,
      tipo_comprobante: f.tipo_comprobante || f.tipo_factura || null,
      cae: null,
      cae_vencimiento: null,
      arca_estado: "HISTORICA",
      arca_error: null,
      arca_payload: null,
      arca_response: null
    };
  });

  console.log("Transformando relaciones factura-carrito...");

  const relacionesCarritos = [];
  const relacionesSinMapear = [];

  for (const rel of facturasCarritosOrigen) {
    const factura = facturasById.get(rel.factura_id);
    if (!factura) continue;

    const carritoDestino =
      carritoByLegacyId.get(rel.carrito_id) ||
      carritoById.get(rel.carrito_id);

    if (!carritoDestino) {
      relacionesSinMapear.push(rel);
      continue;
    }

    const cliente = clienteById.get(carritoDestino.cliente_id);

    relacionesCarritos.push({
      id: rel.id,
      factura_id: rel.factura_id,
      carrito_id: carritoDestino.id,
      control_id: null,
      numero_carrito: carritoDestino.numero_carrito || null,
      pasajero: cliente?.nombre_completo || null,
      fecha_venta: carritoDestino.fecha_venta || null,
      importe_facturado: toNumber(factura.importe_total),
      moneda: factura.moneda || carritoDestino.moneda || "ARS",
      created_at: rel.created_at || factura.created_at || new Date().toISOString()
    });
  }

  console.log({
    relacionesCarritos: relacionesCarritos.length,
    relacionesSinMapear: relacionesSinMapear.length
  });

  if (relacionesSinMapear.length > 0) {
    console.log("Primeras relaciones sin mapear:");
    console.table(
      relacionesSinMapear.slice(0, 20).map((r) => ({
        factura_id: r.factura_id,
        carrito_id_origen: r.carrito_id
      }))
    );
  }

  console.log("Transformando cobros...");

  const cobrosDestino = cobrosOrigen.map((cobro) => {
    const caja = cobro.caja_id ? cajaById.get(cobro.caja_id) : null;
    const cajaExiste = Boolean(caja);

    return {
      id: cobro.id,
      fecha_cobro: cobro.fecha_cobro,
      moneda: cobro.moneda || "ARS",
      sucursal_id: null,
      sucursal: null,
      total_facturas: toNumber(cobro.importe_bruto),
      importe_ingresado_banco: toNumber(cobro.importe_neto),
      total_retenciones: toNumber(cobro.total_retenciones),
      caja_id: cajaExiste ? cobro.caja_id : null,
      caja: caja?.nombre || null,
      forma_cobro: cajaExiste ? "TRANSFERENCIA" : "CASHFLOW",
      referencia: cobro.referencia || cobro.cliente_descripcion || null,
      observaciones: cobro.cliente_descripcion || null,
      created_by: null,
      created_at: cobro.created_at || toTimestampFromDate(cobro.fecha_cobro) || new Date().toISOString()
    };
  });

  console.log("Transformando items de cobros...");

  const itemsDestino = cobrosItemsOrigen
    .filter((item) => facturasById.has(item.factura_id))
    .map((item) => {
      const factura = facturasById.get(item.factura_id);
      const cobro = cobrosById.get(item.cobro_id);
      const importeFactura = toNumber(factura?.importe_total);
      const importeCobrado = toNumber(item.importe_aplicado);

      return {
        id: item.id,
        cobro_id: item.cobro_id,
        factura_id: item.factura_id,
        numero_documento: getNumeroDocumento(factura),
        moneda: factura?.moneda || cobro?.moneda || "ARS",
        importe_factura: importeFactura,
        importe_cobrado: importeCobrado,
        importe_retencion: Math.max(importeFactura - importeCobrado, 0),
        created_at: cobro?.created_at || toTimestampFromDate(cobro?.fecha_cobro) || new Date().toISOString()
      };
    });

  console.log("Transformando retenciones...");

  const itemsByCobroId = new Map();

  for (const item of cobrosItemsOrigen) {
    if (!itemsByCobroId.has(item.cobro_id)) {
      itemsByCobroId.set(item.cobro_id, []);
    }

    itemsByCobroId.get(item.cobro_id).push(item);
  }

  const retencionesDestino = [];

  for (const ret of retencionesOrigen) {
    if (!ret.cobro_id) continue;

    const itemsDelCobro = itemsByCobroId.get(ret.cobro_id) || [];
    const itemsValidos = itemsDelCobro.filter((item) => facturasById.has(item.factura_id));

    if (itemsValidos.length === 0) continue;

    const totalAplicado = itemsValidos.reduce(
      (total, item) => total + toNumber(item.importe_aplicado),
      0
    );

    itemsValidos.forEach((item, index) => {
      const factura = facturasById.get(item.factura_id);
      const ratio =
        totalAplicado > 0
          ? toNumber(item.importe_aplicado) / totalAplicado
          : 1 / itemsValidos.length;

      const importe =
        index === itemsValidos.length - 1
          ? toNumber(ret.importe) -
            retencionesDestino
              .filter((r) => r.__source_ret_id === ret.id)
              .reduce((sum, r) => sum + r.importe, 0)
          : Number((toNumber(ret.importe) * ratio).toFixed(2));

      retencionesDestino.push({
        __source_ret_id: ret.id,
        id: itemsValidos.length === 1 ? ret.id : md5Uuid(`${ret.id}-${item.factura_id}`),
        factura_id: item.factura_id,
        tipo: ret.tipo,
        jurisdiccion: ret.jurisdiccion || null,
        porcentaje: ret.porcentaje ?? null,
        importe: Number(importe.toFixed(2)),
        numero_certificado: ret.nro_certificado || null,
        created_at:
          ret.created_at ||
          toTimestampFromDate(ret.fecha) ||
          factura?.created_at ||
          new Date().toISOString()
      });
    });
  }

  const retencionesFinal = retencionesDestino.map(({ __source_ret_id, ...row }) => row);

  console.log("Insertando en destino...");

  await upsertInBatches(DESTINO, "facturas_cobrar", facturasCobrar, { onConflict: "id" });
  await upsertInBatches(DESTINO, "facturas_cobrar_carritos", relacionesCarritos, { onConflict: "id" });
  await upsertInBatches(DESTINO, "facturas_cobrar_cobros", cobrosDestino, { onConflict: "id" });
  await upsertInBatches(DESTINO, "facturas_cobrar_cobros_items", itemsDestino, { onConflict: "id" });
  await upsertInBatches(DESTINO, "facturas_cobrar_retenciones", retencionesFinal, { onConflict: "id" });

  console.log("Sincronizando carritos con facturas históricas...");

  const carritoIdsFacturados = Array.from(
    new Set(relacionesCarritos.map((rel) => rel.carrito_id).filter(Boolean))
  );

  for (let i = 0; i < carritoIdsFacturados.length; i += BATCH_SIZE) {
    const ids = carritoIdsFacturados.slice(i, i + BATCH_SIZE);

    const { data: relaciones, error: relError } = await DESTINO
      .from("facturas_cobrar_carritos")
      .select("carrito_id, factura_id, facturas_cobrar(id, numero_documento, cobrado, cobrado_at, mes, anio)")
      .in("carrito_id", ids);

    if (relError) {
      throw new Error(`sync relaciones: ${relError.message}`);
    }

    for (const rel of relaciones || []) {
      const factura = Array.isArray(rel.facturas_cobrar)
        ? rel.facturas_cobrar[0]
        : rel.facturas_cobrar;

      if (!factura) continue;

      const fechaFactura =
        factura.anio && factura.mes
          ? `${factura.anio}-${String(factura.mes).padStart(2, "0")}-01`
          : null;

      const { error: updError } = await DESTINO
        .from("carritos")
        .update({
          facturado: true,
          numero_factura: factura.numero_documento,
          fecha_factura: fechaFactura,
          cobrado: Boolean(factura.cobrado),
          fecha_cobro: factura.cobrado ? toDate(factura.cobrado_at) : null,
          estado: factura.cobrado ? "COBRADO" : "FACTURADO",
          updated_at: new Date().toISOString()
        })
        .eq("id", rel.carrito_id);

      if (updError) {
        throw new Error(`sync carrito ${rel.carrito_id}: ${updError.message}`);
      }
    }

    console.log(`carritos sync: ${Math.min(i + ids.length, carritoIdsFacturados.length)} / ${carritoIdsFacturados.length}`);
  }

  console.log("Migración finalizada.");
  console.log({
    facturas_cobrar: facturasCobrar.length,
    facturas_cobrar_carritos: relacionesCarritos.length,
    relaciones_sin_mapear: relacionesSinMapear.length,
    facturas_cobrar_cobros: cobrosDestino.length,
    facturas_cobrar_cobros_items: itemsDestino.length,
    facturas_cobrar_retenciones: retencionesFinal.length
  });
}

main().catch((error) => {
  console.error("ERROR MIGRACIÓN:", error);
  process.exit(1);
});