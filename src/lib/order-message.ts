// spec: F20-AC2 (sarkari fee ki raqam + documents), F04-AC8 (intent 9.3 ka template; phone number nahin), F05-AC2 (bina order number + track link), SA3
// Browser (seedha order) aur server (E02) dono yehi function istemal karte hain (spec 3.3).
import { itemDetail, type CartItem } from './cart';

const rs = (n: number) => `Rs. ${n.toLocaleString('en-PK')}`;

/** Message ke liye cheez: cart ki cheez ya server ki priced cheez */
export type MessageItem = Pick<CartItem, 'name' | 'price' | 'fields' | 'govtFeeExtra'> & {
  jobTitle?: string;
  /** Job ki sarkari fee (F20-AC2: "Sarkari fee Rs. X alag, official challan par") */
  govtFee?: number;
  /** Job apply: zaroori documents ki list (intent 9.3, 10.6) */
  documents?: string[];
};

/** F20-AC2 */
export const govtFeeLine = (govtFee?: number) => (typeof govtFee === 'number' ? `Sarkari fee ${rs(govtFee)} alag, official challan par` : 'Sarkari fee alag, official challan par');

export interface MessageInput {
  items: MessageItem[];
  name: string;
  /** Server ka order number; na ho to "seedha order" (F05) */
  orderId?: string;
  trackUrl?: string;
}

export function buildOrderMessage({ items, name, orderId, trackUrl }: MessageInput): string {
  const lines: string[] = ['Assalam o Alaikum GVS Academy,', orderId ? `Mera order: ${orderId}` : 'Mera order:', ''];
  let total = 0;
  items.forEach((it, i) => {
    total += it.price;
    // Job se aaya order: jobName ka khana aur jobTitle ek hi baat — dohra na likhein
    const detail = it.jobTitle ? ` (${it.jobTitle})` : itemDetail(it);
    lines.push(`${i + 1}. ${it.name}${detail} - ${rs(it.price)}`);
    if (it.govtFeeExtra || typeof it.govtFee === 'number') lines.push(`   (${govtFeeLine(it.govtFee)})`);
    if (it.documents?.length) lines.push(`   Documents: ${it.documents.join(', ')}`);
  });
  lines.push('', `Kul: ${rs(total)}`, `Naam: ${name.trim()}`);
  if (trackUrl) lines.push('', `Order track karein: ${trackUrl}`);
  return lines.join('\n');
}
