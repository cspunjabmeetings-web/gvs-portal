// spec: F28-AC1 (E25 GET /api/admin/export: orders ka CSV), F28-AC2 / SA13 (formula injection se bachao), A10,
//       9.2 (sirf admin; customer ka naam/phone sirf owner ke apne download mein, logs mein nahin)
// CSV Excel/Google Sheets mein seedha khule: UTF-8 BOM, CRLF lines, har khana double quotes mein.
import { requireAdmin, type AdminEnv } from './admin-auth';
import { fail, toResponse, API_MSG } from './api';
import { STATUS_LABEL } from './admin-ui';
import { itemDetail } from './cart';
import { sourceLabel } from './vu-source';
import type { OrderStatus } from './track';

/** UTF-8 BOM (Write tool `\u` escape ko asal harf bana deta hai — is liye code se) */
export const BOM = String.fromCharCode(0xfeff);

export interface ExportEnv extends Pick<AdminEnv, 'SESSION_SECRET'> {
  DB: D1Database;
}

/** F28-AC2: `=`, `+`, `-`, `@` (aur tab/CR, jo Excel bhi formula samajh sakta hai) se shuru cell ke aage `'` */
const FORMULA_START = /^[=+\-@\t\r]/;

/** Ek khana: formula se bachao, phir quotes ("" dohra) — comma, newline sab mehfooz */
export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? '' : String(value);
  if (FORMULA_START.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export function csvRow(cells: unknown[]): string {
  return cells.map(csvCell).join(',');
}

/** ISO (UTC) → "2026-11-22 14:05" Pakistan waqt; khali ho to khali */
export function karachiTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

/** "923001234567" → "03001234567" (purge shuda khali) */
const localPhone = (p: string) => (/^92\d{10}$/.test(p) ? '0' + p.slice(2) : p);

interface ItemLike {
  name?: string;
  fields?: Record<string, string>;
}

/** items_json → "VU Smart pack (CS101); MCQs pack (Islamiat)" */
export function itemsSummary(json: string): string {
  try {
    const items = JSON.parse(json) as ItemLike[];
    if (!Array.isArray(items)) return '';
    return items.map((i) => `${i.name ?? ''}${itemDetail({ fields: i.fields && typeof i.fields === 'object' ? i.fields : {} })}`).join('; ');
  } catch {
    return '';
  }
}

export const EXPORT_HEADER = [
  'Order number',
  'Tareekh (Pakistan)',
  'Darja',
  'Naam',
  'WhatsApp number',
  'Cheezein',
  'Kul (Rs.)',
  'Payment ka waqt',
  'Wada (due)',
  'Complete ka waqt',
  'WhatsApp khola',
  'Rabta hua',
  'Andaruni note',
  'Customer ke liye note',
  'Cancel ki wajah',
  'Kahan se',
] as const;

interface Row {
  id: string;
  name: string;
  phone: string;
  items_json: string;
  total: number;
  status: OrderStatus;
  due_at: string | null;
  whatsapp_opened_at: string | null;
  contacted: number;
  public_note: string | null;
  admin_note: string | null;
  cancel_reason: string | null;
  created_at: string;
  paid_at: string | null;
  completed_at: string | null;
  source: string | null;
}

export function ordersCsv(rows: Row[]): string {
  const lines = [csvRow([...EXPORT_HEADER])];
  for (const r of rows) {
    lines.push(
      csvRow([
        r.id,
        karachiTime(r.created_at),
        STATUS_LABEL[r.status] ?? r.status,
        r.name,
        localPhone(r.phone),
        itemsSummary(r.items_json),
        r.total,
        karachiTime(r.paid_at),
        karachiTime(r.due_at),
        karachiTime(r.completed_at),
        r.whatsapp_opened_at ? 'Haan' : 'Nahin',
        r.contacted ? 'Haan' : 'Nahin',
        r.admin_note,
        r.public_note,
        r.cancel_reason,
        sourceLabel(r.source),
      ]),
    );
  }
  // BOM: Excel UTF-8 pehchan le; CRLF: CSV ka mayari line ending
  return BOM + lines.join('\r\n') + '\r\n';
}

/** E25: GET /api/admin/export — saare orders (naye pehle), CSV file ke taur par */
export async function exportOrders(request: Request, env: ExportEnv, deps: { now?: () => Date } = {}): Promise<Response> {
  const denied = await requireAdmin(request, env);
  if (denied) return toResponse(denied);
  try {
    const { results } = await env.DB.prepare(
      `SELECT id, name, phone, items_json, total, status, due_at, whatsapp_opened_at, contacted, public_note, admin_note,
              cancel_reason, created_at, paid_at, completed_at, source
       FROM orders ORDER BY created_at DESC`,
    ).all<Row>();
    const day = karachiTime((deps.now ?? (() => new Date()))().toISOString()).slice(0, 10);
    return new Response(ordersCsv(results), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="gvs-orders-${day}.csv"`,
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex',
      },
    });
  } catch {
    return toResponse(fail(503, 'unavailable', API_MSG.unavailable));
  }
}
