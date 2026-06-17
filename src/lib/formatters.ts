export function parseMoneyAR(value: string | number | null | undefined): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const raw = String(value || "").trim();

  if (!raw) return 0;

  const normalized = raw
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");

  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatMoneyAR(
  value: string | number | null | undefined,
  moneda?: string | null
): string {
  const parsed = parseMoneyAR(value);

  const formatted = new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(parsed);

  return moneda ? `${formatted} ${moneda}` : formatted;
}