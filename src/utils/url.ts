export function normalizeUrl(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    return "https://www.google.com/";
  }

  if (trimmed === "nostur://home") {
    return trimmed;
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  if (trimmed.includes(".") && !trimmed.includes(" ")) {
    return `https://${trimmed}`;
  }

  return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
}

export function getDomainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return "";
  }
}

export function getFaviconUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");

    /*
      Íconos locales forzados para apps de ALMUNDO.
      Esto evita depender del favicon que devuelve Google.
      El archivo debe existir en:
      public/brand/almundo-isotipo.png
    */
    const almundoDomains = [
      "almundo.com",
      "experts.almundo.com",
      "abaco.almundo.com",
      "krooze.almundo.com"
    ];

    if (almundoDomains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))) {
      return "brand/almundo-isotipo.png";
    }

    return `https://www.google.com/s2/favicons?domain=${parsed.hostname}&sz=64`;
  } catch {
    return "";
  }
}