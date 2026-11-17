// spec: F04-AC8 (intent 9.3 ka template; phone number nahin), F05-AC2 (bina order number + track link), SA3
// Browser (seedha order) aur server (E02) dono yehi function istemal karte hain (spec 3.3).
import { itemDetail, type CartItem } from './cart';

const rs = (n: number) => `Rs. ${n.toLocaleString('en-PK')}`;

/** Message ke liye cheez: cart ki cheez ya server ki priced cheez */
export type MessageItem = Pick<CartItem, 'name' | 'price' | 'fields' | 'govtFeeExtra'> & {
  jobTitle?: string;
  /** Job apply: zaroori documents ki list (intent 9.3, 10.6) */
  documents?: string[];
};

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
    const detail = it.jobTitle ? itemDetail({ fields: { job: it.jobTitle, ...it.fields } }) : itemDetail(it);
    lines.push(`${i + 1}. ${it.name}${detail} - ${rs(it.price)}`);
    if (it.govtFeeExtra) lines.push('   (Sarkari fee alag, official challan par)');
    if (it.documents?.length) lines.push(`   Documents: ${it.documents.join(', ')}`);
  });
  lines.push('', `Kul: ${rs(total)}`, `Naam: ${name.trim()}`);
  if (trackUrl) lines.push('', `Order track karein: ${trackUrl}`);
  return lines.join('\n');
}
