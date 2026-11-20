// spec: F01-AC5, F02-AC1 (order ke 4 qadam), intent 9.2, F25-AC4 (/how-to-order ka HowTo isi list se — page aur schema ek jaise)
export const ORDER_STEPS = [
  { t: 'Cheez chunein', d: 'Pack ya service chunein aur zaroori tafseel bharein, maslan course code ya class.' },
  { t: 'Naam aur number dein', d: 'Sirf naam aur WhatsApp number. Sign up ya password nahin.' },
  { t: 'WhatsApp par bhejein', d: 'Tayyar message WhatsApp par khulta hai. Order number aap ke paas mehfooz rehta hai.' },
  { t: 'Payment aur delivery', d: 'JazzCash ya Easypaisa se payment. File ya kaam WhatsApp par aata hai; darja "Order track karein" par dekhein.' },
] as const;
