import fs from "node:fs";

const file = "supabase/functions/whatsapp-send-message/index.ts";
let content = fs.readFileSync(file, "utf8");

function replaceOnce(from, to, label) {
  if (!content.includes(from)) {
    console.log(`AVISO: no encontré ${label}`);
    return;
  }

  content = content.replace(from, to);
  console.log(`OK: ${label}`);
}

/* 1) Agrega normalizador de versión Graph */
replaceOnce(
`function cleanText(value: unknown): string {
  return String(value || "").trim();
}`,
`function cleanText(value: unknown): string {
  return String(value || "").trim();
}

function normalizeGraphApiVersion(value: unknown): string {
  const raw = String(value || "v25.0")
    .trim()
    .replace(/^\\/+/, "")
    .replace(/\\/+$/, "");

  if (!raw) return "v25.0";

  return raw.startsWith("v") ? raw : \`v\${raw}\`;
}`,
"normalizeGraphApiVersion"
);

/* 2) Corrige getMetaConfig */
replaceOnce(
`  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  const apiVersion = Deno.env.get("WHATSAPP_API_VERSION") || "v25.0";

  if (!token) {
    throw new Error("Falta configurar WHATSAPP_ACCESS_TOKEN.");
  }

  if (!phoneNumberId) {
    throw new Error("Falta configurar WHATSAPP_PHONE_NUMBER_ID.");
  }

  return {
    token,
    phoneNumberId,
    apiVersion
  };`,
`  const phoneNumberId = cleanText(Deno.env.get("WHATSAPP_PHONE_NUMBER_ID"));
  const apiVersion = normalizeGraphApiVersion(Deno.env.get("WHATSAPP_API_VERSION"));

  if (!token) {
    throw new Error("Falta configurar WHATSAPP_ACCESS_TOKEN.");
  }

  if (!phoneNumberId) {
    throw new Error("Falta configurar WHATSAPP_PHONE_NUMBER_ID.");
  }

  return {
    token,
    phoneNumberId,
    apiVersion
  };`,
"getMetaConfig"
);

/* 3) Corrige URL upload media */
replaceOnce(
`  const url = \`https://graph.facebook.com/\${params.apiVersion}/\${params.phoneNumberId}/media\`;`,
`  const apiVersion = normalizeGraphApiVersion(params.apiVersion);
  const phoneNumberId = cleanText(params.phoneNumberId);

  if (!phoneNumberId) {
    throw new Error("Falta WHATSAPP_PHONE_NUMBER_ID para subir media.");
  }

  const url = \`https://graph.facebook.com/\${apiVersion}/\${phoneNumberId}/media\`;

  console.log("[whatsapp-send-message] upload media url", {
    apiVersion,
    phoneNumberId
  });`,
"media URL"
);

/* 4) Corrige URL send messages */
replaceOnce(
`  const url = \`https://graph.facebook.com/\${params.apiVersion}/\${params.phoneNumberId}/messages\`;`,
`  const apiVersion = normalizeGraphApiVersion(params.apiVersion);
  const phoneNumberId = cleanText(params.phoneNumberId);

  if (!phoneNumberId) {
    throw new Error("Falta WHATSAPP_PHONE_NUMBER_ID para enviar mensaje.");
  }

  const url = \`https://graph.facebook.com/\${apiVersion}/\${phoneNumberId}/messages\`;

  console.log("[whatsapp-send-message] send url", {
    apiVersion,
    phoneNumberId
  });`,
"messages URL"
);

fs.writeFileSync(file, content, "utf8");
console.log("\\nListo. Revisá con:");
console.log("grep -n 'normalizeGraphApiVersion\\|send url\\|upload media url\\|graph.facebook.com' supabase/functions/whatsapp-send-message/index.ts");
