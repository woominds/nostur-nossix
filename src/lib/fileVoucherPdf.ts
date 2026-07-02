// src/lib/fileVoucherPdf.ts

import type {
  FileItem,
  FileVoucher,
  FileVoucherServicio
} from "../store/filesStore";

type FileVoucherPdfInput = {
  file: FileItem;
  voucher: FileVoucher;
  servicios: FileVoucherServicio[];
};

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDateAR(value?: string | null): string {
  if (!value) return "—";

  const clean = value.slice(0, 10);
  const [year, month, day] = clean.split("-");

  if (!year || !month || !day) return "—";

  return `${day}/${month}/${year}`;
}

function getTodayAR(): string {
  const formatter = new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Cordoba",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });

  return formatter.format(new Date());
}

function getVoucherNumber(voucher: FileVoucher): string {
  const record = voucher as unknown as Record<string, unknown>;
  const numero = record.numero_voucher;

  if (numero === null || numero === undefined || numero === "") return "—";

  return String(numero);
}

function getClientName(file: FileItem, voucher: FileVoucher): string {
  return (
    voucher.a_favor_de ||
    file.clientes?.nombre_completo ||
    "Cliente"
  );
}

function getReservaId(voucher: FileVoucher): string {
  return voucher.reserva_id || "—";
}

function buildServiciosRows(servicios: FileVoucherServicio[]): string {
  if (servicios.length === 0) {
    return `
      <tr>
        <td class="service-cell muted">Sin servicios cargados.</td>
        <td class="qty-cell">—</td>
      </tr>
    `;
  }

  return servicios
    .map((servicio) => {
      const detalle = escapeHtml(servicio.servicio_detalle || "Servicio");
      const cantidad = Number(servicio.cantidad_pasajeros || 1);
      const desde = formatDateAR(servicio.fecha_inicio);
      const hasta = formatDateAR(servicio.fecha_fin);

      const fechas =
        servicio.fecha_inicio || servicio.fecha_fin
          ? `<div class="service-date">Desde ${escapeHtml(desde)} hasta ${escapeHtml(hasta)}</div>`
          : "";

      return `
        <tr>
          <td class="service-cell">
            <div class="service-title">${detalle}</div>
            ${fechas}
          </td>
          <td class="qty-cell">${cantidad}</td>
        </tr>
      `;
    })
    .join("");
}

export function buildFileVoucherHtml({
  file,
  voucher,
  servicios
}: FileVoucherPdfInput): string {
  const voucherNumber = getVoucherNumber(voucher);
  const cliente = getClientName(file, voucher);
  const reservaId = getReservaId(voucher);

  return `
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Voucher ${escapeHtml(voucherNumber)}</title>

  <style>
    @page {
      size: A4 portrait;
      margin: 14mm;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      background: #ffffff;
      color: #111111;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 12px;
      line-height: 1.35;
    }

    .page {
      width: 100%;
      min-height: 267mm;
      padding: 0;
      background: #ffffff;
    }

    .brand {
      border-bottom: 1.5px solid #111111;
      padding-bottom: 14px;
      text-align: center;
    }

    .brand-title {
      margin: 0;
      font-size: 28px;
      line-height: 1;
      font-weight: 800;
      letter-spacing: 0.08em;
    }

    .brand-subtitle {
      margin-top: 8px;
      font-size: 13px;
      font-weight: 500;
      text-transform: lowercase;
    }

    .brand-cuit {
      margin-top: 2px;
      font-size: 13px;
      font-weight: 500;
    }

    .data-row {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 22px;
      border-bottom: 1px solid #111111;
      padding: 18px 0 16px;
    }

    .label {
      margin-bottom: 5px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .value {
      font-size: 15px;
      font-weight: 700;
    }

    .client {
      border-bottom: 1px solid #111111;
      padding: 18px 0 16px;
    }

    .client-name {
      font-size: 16px;
      font-weight: 700;
    }

    .client-extra {
      margin-top: 3px;
      font-size: 12px;
      font-weight: 400;
    }

    .content {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 245px;
      gap: 18px;
      padding-top: 24px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }

    th {
      border: 1px solid #111111;
      padding: 10px 12px;
      background: #f3f3f3;
      font-size: 12px;
      font-weight: 800;
      text-align: left;
      text-transform: uppercase;
    }

    td {
      border: 1px solid #111111;
      padding: 9px 12px;
      vertical-align: top;
    }

    .service-cell {
      width: auto;
    }

    .qty-cell {
      width: 78px;
      text-align: center;
      font-size: 13px;
      font-weight: 700;
    }

    .service-title {
      white-space: pre-wrap;
      font-size: 12px;
      font-weight: 500;
    }

    .service-date {
      margin-top: 4px;
      color: #555555;
      font-size: 10.5px;
      font-weight: 400;
    }

    .side-card {
      border: 1px solid #111111;
      border-radius: 6px;
      padding: 16px;
      min-height: 310px;
    }

    .side-title {
      margin: 0 0 12px;
      border-bottom: 1px solid #111111;
      padding-bottom: 10px;
      text-align: center;
      font-size: 15px;
      font-weight: 800;
      text-transform: uppercase;
    }

    .voucher-number {
      border-bottom: 1px solid #111111;
      padding-bottom: 12px;
      text-align: center;
      font-size: 25px;
      font-weight: 800;
      letter-spacing: 0.04em;
    }

    .contact-block {
      margin-top: 16px;
      display: grid;
      gap: 12px;
    }

    .contact-label {
      margin-bottom: 2px;
      font-size: 9.5px;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .contact-value {
      font-size: 11.5px;
      font-weight: 500;
    }

    .note {
      margin-top: 26px;
      border: 1px solid #111111;
      padding: 14px 16px;
      font-size: 12px;
      line-height: 1.55;
    }

    .footer {
      margin-top: 22px;
      padding-top: 10px;
      color: #444444;
      font-size: 10px;
      text-align: center;
    }

    .muted {
      color: #666666;
    }

    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .page {
        min-height: auto;
      }
    }
  </style>
</head>

<body>
  <main class="page">
    <header class="brand">
      <h1 class="brand-title">NOSSIX TRAVEL</h1>
      <div class="brand-subtitle">de nossix sas</div>
      <div class="brand-cuit">CUIT 30-71854982-1</div>
    </header>

    <section class="data-row">
      <div>
        <div class="label">ID reserva</div>
        <div class="value">${escapeHtml(reservaId)}</div>
      </div>

      <div>
        <div class="label">Fecha de emisión</div>
        <div class="value">${escapeHtml(getTodayAR())}</div>
      </div>

      <div>
        <div class="label">Vence</div>
        <div class="value">${escapeHtml(formatDateAR(file.fecha_out || file.fecha_in))}</div>
      </div>
    </section>

    <section class="client">
      <div class="label">A favor de</div>
      <div class="client-name">${escapeHtml(cliente)}</div>
      ${
        file.clientes?.telefono
          ? `<div class="client-extra">${escapeHtml(file.clientes.telefono)}</div>`
          : ""
      }
    </section>

    <section class="content">
      <div>
        <table>
          <thead>
            <tr>
              <th>Servicios incluidos</th>
              <th class="qty-cell">Cant.</th>
            </tr>
          </thead>
          <tbody>
            ${buildServiciosRows(servicios)}
          </tbody>
        </table>
      </div>

      <aside class="side-card">
        <h2 class="side-title">Voucher de servicios</h2>

        <div class="voucher-number">N° ${escapeHtml(voucherNumber)}</div>

        <div class="contact-block">
          <div>
            <div class="contact-label">Dirección</div>
            <div class="contact-value">
              OVIDIO LAGOS 56<br />
              Barrio General Paz<br />
              Córdoba, Argentina
            </div>
          </div>

          <div>
            <div class="contact-label">Teléfono</div>
            <div class="contact-value">+549351258792</div>
          </div>

          <div>
            <div class="contact-label">Teléfono de emergencia</div>
            <div class="contact-value">+5491133950050</div>
          </div>
        </div>
      </aside>
    </section>

    <section class="note">
      Presentá este voucher para acceder a los servicios detallados.<br />
      Este voucher es personal e intransferible.
    </section>

    <footer class="footer">
      NOSSIX TRAVEL · NOSSIX SAS · CUIT 30-71854982-1
    </footer>
  </main>
</body>
</html>
`;
}

export function printFileVoucherPdf(input: FileVoucherPdfInput): void {
  const html = buildFileVoucherHtml(input);
  const printWindow = window.open("", "_blank", "width=900,height=1200");

  if (!printWindow) {
    throw new Error("No se pudo abrir la ventana de impresión.");
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();

  printWindow.focus();

  window.setTimeout(() => {
    printWindow.print();
  }, 350);
}