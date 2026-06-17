// src/lib/parseVuelos.ts

import { supabase } from "./supabase";

export type ParsedVueloDireccion = "ida" | "vuelta";

export type ParsedVueloAirport = {
  iata: string | null;
  ciudad: string | null;
  aeropuerto: string | null;
  terminal: string | null;
};

export type ParsedVueloTramo = {
  direccion: ParsedVueloDireccion;
  indice: number;
  aerolinea: string | null;
  codigo_aerolinea: string | null;
  numero_vuelo: string | null;
  clase: string | null;
  fecha_salida: string | null;
  hora_salida: string | null;
  origen: ParsedVueloAirport;
  fecha_llegada: string | null;
  hora_llegada: string | null;
  destino: ParsedVueloAirport;
  duracion: string | null;
  equipaje: string | null;
  escala_posterior: {
    ciudad: string | null;
    iata: string | null;
    espera: string | null;
  } | null;
};

export type ParsedVuelosResult = {
  tipo: "ida_vuelta" | "solo_ida" | "multidestino";
  pasajeros: {
    adultos: number;
    ninos: number;
    infantes: number;
  } | null;
  tramos: ParsedVueloTramo[];
  precio: {
    moneda: string | null;
    por_pasajero: number | null;
    total: number | null;
    impuestos_incluidos: boolean | null;
  } | null;
  observaciones: string | null;
};

export async function parseVuelos(params: {
  text: string;
  presupuesto_id?: string;
  contexto?: {
    fecha_salida?: string | null;
    fecha_regreso?: string | null;
    origen?: string | null;
    destino?: string | null;
  };
}): Promise<ParsedVuelosResult> {
  const { data, error } = await supabase.functions.invoke("parse-vuelos", {
    body: params
  });

  if (error) {
    throw new Error(error.message || "No se pudo invocar parse-vuelos.");
  }

  if (data?.error) {
    throw new Error(String(data.error));
  }

  const result = data?.data || data?.parsed || data;

  if (!result || typeof result !== "object") {
    throw new Error("parse-vuelos no devolvió información válida.");
  }

  return {
    tipo: result.tipo || "solo_ida",
    pasajeros: result.pasajeros || null,
    tramos: Array.isArray(result.tramos) ? result.tramos : [],
    precio: result.precio || null,
    observaciones: result.observaciones || null
  };
}

export function getTramosByDireccion(parsed: ParsedVuelosResult, direccion: ParsedVueloDireccion) {
  return parsed.tramos
    .filter((tramo) => tramo.direccion === direccion)
    .sort((a, b) => Number(a.indice || 0) - Number(b.indice || 0));
}

export function formatAirportLabel(airport: ParsedVueloAirport | null | undefined): string {
  if (!airport) return "";

  const ciudad = String(airport.ciudad || "").trim();
  const iata = String(airport.iata || "").trim();

  if (ciudad && iata) return `${ciudad} (${iata})`;
  if (iata) return iata;
  return ciudad;
}

export function getResumenDireccion(tramos: ParsedVueloTramo[]) {
  if (!tramos.length) return null;

  const first = tramos[0];
  const last = tramos[tramos.length - 1];

  const aerolineas = Array.from(
    new Set(tramos.map((tramo) => tramo.aerolinea).filter(Boolean).map(String))
  );

  const vuelos = tramos
    .map((tramo) => tramo.numero_vuelo)
    .filter(Boolean)
    .map(String);

  const equipaje =
    tramos.map((tramo) => tramo.equipaje).filter(Boolean).map(String)[0] || null;

  return {
    aerolinea: aerolineas.join(" / ") || first.aerolinea || null,
    numero_vuelo: vuelos.join(" / ") || null,
    origen: formatAirportLabel(first.origen),
    destino: formatAirportLabel(last.destino),
    fecha_salida: first.fecha_salida || null,
    hora_salida: first.hora_salida || null,
    fecha_llegada: last.fecha_llegada || null,
    hora_llegada: last.hora_llegada || null,
    duracion: tramos.map((tramo) => tramo.duracion).filter(Boolean).join(" + ") || null,
    equipaje
  };
}