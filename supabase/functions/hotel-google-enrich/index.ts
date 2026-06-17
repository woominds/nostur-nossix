// supabase/functions/hotel-google-enrich/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

type HotelGoogleRequest = {
  hotel_nombre?: string;
  destino?: string;
  direccion?: string;
};

type GooglePlaceSearchResponse = {
  candidates?: Array<{
    place_id?: string;
    name?: string;
    formatted_address?: string;
    rating?: number;
    user_ratings_total?: number;
  }>;
  status?: string;
  error_message?: string;
};

type GooglePlaceDetailsResponse = {
  result?: {
    place_id?: string;
    name?: string;
    formatted_address?: string;
    international_phone_number?: string;
    website?: string;
    rating?: number;
    user_ratings_total?: number;
    url?: string;
    photos?: Array<{
      photo_reference?: string;
      width?: number;
      height?: number;
    }>;
    editorial_summary?: {
      overview?: string;
    };
    types?: string[];
  };
  status?: string;
  error_message?: string;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}

function cleanText(value: unknown): string {
  return String(value || "").trim();
}

function buildPhotoUrl(photoReference: string, apiKey: string): string {
  const params = new URLSearchParams({
    maxwidth: "900",
    photo_reference: photoReference,
    key: apiKey
  });

  return `https://maps.googleapis.com/maps/api/place/photo?${params.toString()}`;
}

async function fetchWithTimeout(
  url: string,
  timeoutMs = 12000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      method: "GET",
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders
    });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      {
        ok: false,
        error: "Método no permitido. Usá POST."
      },
      405
    );
  }

  try {
    const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");

    if (!apiKey) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Falta GOOGLE_PLACES_API_KEY en Supabase Secrets. Ejecutá: supabase secrets set GOOGLE_PLACES_API_KEY=\"TU_API_KEY\""
        },
        500
      );
    }

    const body = (await req.json().catch(() => ({}))) as HotelGoogleRequest;

    const hotelNombre = cleanText(body.hotel_nombre);
    const destino = cleanText(body.destino);
    const direccion = cleanText(body.direccion);

    if (!hotelNombre) {
      return jsonResponse(
        {
          ok: false,
          error: "Falta hotel_nombre."
        },
        400
      );
    }

    const query = [hotelNombre, direccion, destino]
      .filter(Boolean)
      .join(" ");

    const searchParams = new URLSearchParams({
      input: query,
      inputtype: "textquery",
      fields: "place_id,name,formatted_address,rating,user_ratings_total",
      language: "es",
      key: apiKey
    });

    const searchUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?${searchParams.toString()}`;

    const searchResponse = await fetchWithTimeout(searchUrl);
    const searchData =
      (await searchResponse.json()) as GooglePlaceSearchResponse;

    if (!searchResponse.ok) {
      return jsonResponse(
        {
          ok: false,
          error: "Google Places no respondió correctamente en la búsqueda.",
          status: searchResponse.status,
          detail: searchData
        },
        502
      );
    }

    if (searchData.status !== "OK" || !searchData.candidates?.length) {
      return jsonResponse(
        {
          ok: false,
          error: "No se encontró el hotel en Google Places.",
          google_status: searchData.status,
          google_error: searchData.error_message || null,
          query
        },
        404
      );
    }

    const placeId = searchData.candidates[0]?.place_id;

    if (!placeId) {
      return jsonResponse(
        {
          ok: false,
          error: "Google encontró un resultado, pero no devolvió place_id.",
          candidate: searchData.candidates[0]
        },
        502
      );
    }

    const detailsParams = new URLSearchParams({
      place_id: placeId,
      fields:
        "place_id,name,formatted_address,international_phone_number,website,rating,user_ratings_total,url,photos,editorial_summary,types",
      language: "es",
      key: apiKey
    });

    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?${detailsParams.toString()}`;

    const detailsResponse = await fetchWithTimeout(detailsUrl);
    const detailsData =
      (await detailsResponse.json()) as GooglePlaceDetailsResponse;

    if (!detailsResponse.ok) {
      return jsonResponse(
        {
          ok: false,
          error: "Google Places no respondió correctamente en el detalle.",
          status: detailsResponse.status,
          detail: detailsData
        },
        502
      );
    }

    if (detailsData.status !== "OK" || !detailsData.result) {
      return jsonResponse(
        {
          ok: false,
          error: "No se pudo obtener el detalle del hotel.",
          google_status: detailsData.status,
          google_error: detailsData.error_message || null
        },
        502
      );
    }

 const result = detailsData.result;

const fotos = (result.photos || [])
  .slice(0, 4)
  .map((photo) => {
    if (!photo.photo_reference) return null;

    return {
      url: buildPhotoUrl(photo.photo_reference, apiKey),
      width: photo.width || null,
      height: photo.height || null
    };
  })
  .filter(Boolean);

return jsonResponse({
  ok: true,
  query,
  hotel: {
    place_id: result.place_id || placeId,
    nombre: result.name || hotelNombre,
    direccion: result.formatted_address || direccion || null,
    telefono: result.international_phone_number || null,
    website: result.website || null,
    google_maps_url: result.url || null,
    rating: result.rating || null,
    user_ratings_total: result.user_ratings_total || null,
    descripcion:
      result.editorial_summary?.overview ||
      `Hotel ${result.name || hotelNombre}${
        destino ? ` ubicado en ${destino}` : ""
      }.`,
    tipos: result.types || [],
    foto_url: fotos[0]?.url || null,
    fotos
  }
});
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error desconocido.";

    return jsonResponse(
      {
        ok: false,
        error: "Error interno en hotel-google-enrich.",
        detail: message
      },
      500
    );
  }
});