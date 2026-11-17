// spec: F04-AC8 (intent 9.3 ka template; phone number nahin), F05-AC2 (bina order number + track link), SA3
import { cartTotal, itemDetail, type CartItem } from './cart';

const rs = (n: number) => `Rs. ${n.toLocaleString('en-PK')}`;

export interface MessageInput {
  items: CartItem[];
  name: string;
  /** Qadam 5: server ka order number; na ho to "seedha order" (F05) */
  orderId?: string;
  trackUrl?: string;
}

export function buildOrderMessage({ items, name, orderId, trackUrl }: MessageInput): string {
  const lines: string[] = ['Assalam o Alaikum GVS Academy,', orderId ? `Mera order: ${orderId}` : 'Mera order:', ''];
  items.forEach((it, i) => {
    lines.push(`${i + 1}. ${it.name}${itemDetail(it)} - ${rs(it.price)}`);
    if (it.govtFeeExtra) lines.push('   (Sarkari fee alag, official challan par)');
  });
  lines.push('', `Kul: ${rs(cartTotal(items))}`, `Naam: ${name.trim()}`);
  if (trackUrl) lines.push('', `Order track karein: ${trackUrl}`);
  return lines.join('\n');
}
