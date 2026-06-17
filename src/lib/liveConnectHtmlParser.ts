export type LiveConnectParsedMessage = {
  orden: number;
  fecha_mensaje: string | null;
  hora_texto: string | null;
  direction: "inbound" | "outbound" | "system";
  sender_name: string | null;
  sender_role: string | null;
  content: string | null;
  message_type: "text" | "image" | "audio" | "video" | "file" | "system";
  media_url: string | null;
  media_filename: string | null;
  media_mime_type: string | null;
  raw_html: string | null;
  metadata: Record<string, unknown>;
};

export type LiveConnectParsedHtml = {
  messages: LiveConnectParsedMessage[];
  metadata: Record<string, unknown>;
};

function cleanText(value: unknown): string {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeText(value: unknown): string {
  return cleanText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function stripHtmlToLines(html: string): string[] {
  const text = String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(div|p|li|tr|td|th|section|article|h1|h2|h3|h4)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

  return text
    .split(/\r?\n/)
    .map(cleanText)
    .filter(Boolean);
}


function getDateFromText(text: string): string | null {
  const raw = cleanText(text);

  const isoMatch = raw.match(/\b\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?\b/);
  if (isoMatch) {
    const parsed = new Date(isoMatch[0].replace(" ", "T"));
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }

  const dateTimeMatch = raw.match(
    /\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?\b/
  );

  if (dateTimeMatch) {
    const day = Number(dateTimeMatch[1]);
    const month = Number(dateTimeMatch[2]);
    const year = Number(dateTimeMatch[3].length === 2 ? `20${dateTimeMatch[3]}` : dateTimeMatch[3]);
    const hour = Number(dateTimeMatch[4] || 0);
    const minute = Number(dateTimeMatch[5] || 0);
    const second = Number(dateTimeMatch[6] || 0);

    const parsed = new Date(year, month - 1, day, hour, minute, second);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }

  const spanishDateMatch = normalizeText(raw).match(
    /\b(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\s+(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(\d{4})\b/
  );

  if (spanishDateMatch) {
    const day = Number(spanishDateMatch[2]);
    const monthName = spanishDateMatch[3];
    const year = Number(spanishDateMatch[4]);

    const months: Record<string, number> = {
      enero: 0,
      febrero: 1,
      marzo: 2,
      abril: 3,
      mayo: 4,
      junio: 5,
      julio: 6,
      agosto: 7,
      septiembre: 8,
      setiembre: 8,
      octubre: 9,
      noviembre: 10,
      diciembre: 11
    };

    const month = months[monthName];

    if (month !== undefined) {
      const parsed = new Date(year, month, day, 0, 0, 0);
      if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
    }
  }

  return null;
}

function isHeaderLine(line: string): boolean {
  const normalized = normalizeText(line);

  const exactHeader = new Set([
    "resumen de la conversacion",
    "fecha",
    "inicio / fin",
    "empresa",
    "canal (whatsapp qr)",
    "canal",
    "grupo",
    "agente",
    "mensajes",
    "nossix sas - franquicias de almundo",
    "almundo - nossix",
    "atencion virtual"
  ]);

  if (exactHeader.has(normalized)) return true;

  if (normalized.startsWith("resumen de la conversacion")) return true;
  if (normalized.startsWith("fecha de creacion:")) return true;

  return false;
}

function isSenderLine(line: string): boolean {
  const normalized = normalizeText(line);

  if (/^(am|pm)\s*-\s+.+/.test(normalized)) return true;
  if (/^\d{1,2}:\d{2}\s*-\s+.+/.test(normalized)) return true;

  return false;
}

function parseSenderLine(line: string): {
  sender: string;
  horaTexto: string | null;
  system: boolean;
} {
  const cleaned = cleanText(line);

  const match = cleaned.match(/^((?:am|pm)|(?:\d{1,2}:\d{2}))\s*-\s*(.+)$/i);

  if (!match) {
    return {
      sender: cleaned,
      horaTexto: null,
      system: false
    };
  }

  const sender = cleanText(match[2]);
  const normalizedSender = normalizeText(sender);

  return {
    sender,
    horaTexto: match[1],
    system:
      normalizedSender.includes("conversacion finalizada") ||
      normalizedSender.includes("conversacion iniciada") ||
      normalizedSender.includes("ha ingresado") ||
      normalizedSender.includes("ha salido") ||
      normalizedSender.includes("sistema")
  };
}

function inferDirection(senderName: string | null, content: string | null, agentName: string | null): "inbound" | "outbound" | "system" {
  const sender = normalizeText(senderName || "");
  const text = normalizeText(content || "");
  const agent = normalizeText(agentName || "");

  if (
    text.includes("conversacion finalizada") ||
    text.includes("conversacion iniciada") ||
    text.includes("ha ingresado a la conversacion") ||
    text.includes("ha salido de la conversacion")
  ) {
    return "system";
  }

  if (agent && sender && sender === agent) return "outbound";

  if (
    sender.includes("almundo") ||
    sender.includes("nossix") ||
    sender.includes("agente") ||
    sender.includes("asesor") ||
    sender.includes("operador") ||
    sender.includes("ayelen") ||
    sender.includes("aye") ||
    sender.includes("ojeda")
  ) {
    return "outbound";
  }

  return "inbound";
}

function inferMessageType(content: string | null): LiveConnectParsedMessage["message_type"] {
  const normalized = normalizeText(content || "");

  if (!normalized) return "text";

  if (normalized === "pdf") return "file";
  if (normalized.endsWith(".pdf")) return "file";
  if (normalized.match(/\.(jpg|jpeg|png|webp|gif)$/)) return "image";
  if (normalized.match(/\.(mp3|ogg|wav|m4a|webm)$/)) return "audio";
  if (normalized.match(/\.(mp4|mov|avi|mkv)$/)) return "video";

  if (
    normalized.includes("conversacion finalizada") ||
    normalized.includes("conversacion iniciada") ||
    normalized.includes("ha ingresado a la conversacion")
  ) {
    return "system";
  }

  return "text";
}

function extractAgentName(lines: string[]): string | null {
  const normalizedLines = lines.map((line) => normalizeText(line));

  const agentIndex = normalizedLines.findIndex((line) => line === "agente");

  if (agentIndex >= 0 && lines[agentIndex + 1]) {
    return cleanText(lines[agentIndex + 1]);
  }

  return null;
}

function getLinesAfterMessages(lines: string[]): string[] {
  const normalizedLines = lines.map((line) => normalizeText(line));
  const mensajesIndex = normalizedLines.findIndex((line) => line === "mensajes");

  if (mensajesIndex >= 0) {
    return lines.slice(mensajesIndex + 1);
  }

  return lines;
}

function shouldSkipMessageContent(content: string): boolean {
  const normalized = normalizeText(content);

  if (!normalized) return true;
  if (isHeaderLine(content)) return true;

  if (normalized.startsWith("am - fecha de creacion")) return true;
  if (normalized.startsWith("pm - fecha de creacion")) return true;

  return false;
}

function buildMessagesFromLines(lines: string[]): LiveConnectParsedMessage[] {
  const agentName = extractAgentName(lines);
  const messageLines = getLinesAfterMessages(lines);

  const messages: LiveConnectParsedMessage[] = [];

  let currentSender: string | null = null;
  let currentHoraTexto: string | null = null;

  for (let index = 0; index < messageLines.length; index += 1) {
    const line = cleanText(messageLines[index]);

    if (!line) continue;
    if (isHeaderLine(line)) continue;

    if (isSenderLine(line)) {
      const parsedSender = parseSenderLine(line);

      if (parsedSender.system) {
        messages.push({
          orden: messages.length + 1,
          fecha_mensaje: getDateFromText(line),
          hora_texto: parsedSender.horaTexto,
          direction: "system",
          sender_name: parsedSender.sender,
          sender_role: "system",
          content: parsedSender.sender,
          message_type: "system",
          media_url: null,
          media_filename: null,
          media_mime_type: null,
          raw_html: line,
          metadata: {
            parser: "liveconnect_structured_lines"
          }
        });

        currentSender = null;
        currentHoraTexto = null;
        continue;
      }

      currentSender = parsedSender.sender;
      currentHoraTexto = parsedSender.horaTexto;
      continue;
    }

    if (shouldSkipMessageContent(line)) continue;

    const nextLine = cleanText(messageLines[index + 1] || "");
    const currentType = inferMessageType(line);
    const nextType = inferMessageType(nextLine);

    let content = line;
    let mediaFilename: string | null = null;
    let mediaMimeType: string | null = null;

    if (currentType === "file" && line.toLowerCase() === "pdf" && nextType === "file") {
      content = nextLine;
      mediaFilename = nextLine;
      mediaMimeType = "application/pdf";
      index += 1;
    } else if (currentType === "file") {
      mediaFilename = line;
      if (line.toLowerCase().endsWith(".pdf")) mediaMimeType = "application/pdf";
    }

    const messageType = inferMessageType(content);
    const fechaMensaje = getDateFromText(content);

    messages.push({
      orden: messages.length + 1,
      fecha_mensaje: fechaMensaje,
      hora_texto: currentHoraTexto,
      direction: inferDirection(currentSender, content, agentName),
      sender_name: currentSender,
      sender_role: currentSender && normalizeText(currentSender) === normalizeText(agentName) ? "agent" : null,
      content,
      message_type: messageType,
      media_url: null,
      media_filename: mediaFilename,
      media_mime_type: mediaMimeType,
      raw_html: line,
      metadata: {
        parser: "liveconnect_structured_lines",
        agentName
      }
    });
  }

  return messages;
}

function dedupeMessages(messages: LiveConnectParsedMessage[]): LiveConnectParsedMessage[] {
  const seen = new Set<string>();

  return messages
    .filter((message) => {
      const key = normalizeText([
        message.hora_texto,
        message.direction,
        message.sender_name,
        message.content,
        message.media_filename
      ].join("|"));

      if (!key || seen.has(key)) return false;

      seen.add(key);
      return true;
    })
    .map((message, index) => ({
      ...message,
      orden: index + 1
    }));
}

export function parseLiveConnectHtml(html: string): LiveConnectParsedHtml {
  const raw = String(html || "");

  if (!raw.trim()) {
    return {
      messages: [],
      metadata: {
        parser: "empty_html",
        total: 0
      }
    };
  }

  const lines = stripHtmlToLines(raw);
  const messages = dedupeMessages(buildMessagesFromLines(lines));

  return {
    messages,
    metadata: {
      parser: "liveconnect_structured_lines",
      total: messages.length
    }
  };
}