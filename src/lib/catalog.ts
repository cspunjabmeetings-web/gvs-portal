// spec: 3.3 (catalog shared front/back), F02-AC1, F02-AC2, F02-AC3, F02-AC5, intent 12.3
import data from '../data/catalog.json';

export type Door = 'job-prep' | 'vu' | 'board' | 'career' | 'sarkari';

export interface ProductField {
  key: string;
  label: string;
  type: 'text' | 'select' | 'month' | 'number';
  required: boolean;
  pattern?: string;
  options?: string[];
  example?: string;
}

export interface Product {
  id: string;
  name: string;
  door: Door;
  /** null = qeemat tay nahin; sirf "Rabta karein", order list mein nahin (F02-AC5) */
  price: number | null;
  deliveryMinutes: number;
  needsDocuments: boolean;
  /** true = "Qeemat mein sarkari fee shamil nahin" (F02-AC4) */
  govtFeeExtra: boolean;
  fields: ProductField[];
  includes: string[];
  sample: string | null;
  fileHint: string;
  active: boolean;
}

const ALL = data.products as Product[];

/** Sirf `active` products (F02-AC3). Default: asal catalog. */
export function activeProducts(list: Product[] = ALL): Product[] {
  return list.filter((p) => p.active);
}

/** Active product id se; inactive ya ghair-maujood par undefined */
export function getProduct(id: string, list: Product[] = ALL): Product | undefined {
  return activeProducts(list).find((p) => p.id === id);
}

/** Order list mein ja sakta hai? (qeemat ho aur active ho) */
export function isOrderable(p: Product): boolean {
  return p.active && typeof p.price === 'number';
}

/** Product ka page (rate list aur links ke liye; spec 6.2 ki screens) */
const PRODUCT_PAGE: Record<string, string> = {
  'mcq-pack': '/mcqs',
  'past-papers': '/past-papers',
  'current-affairs': '/current-affairs',
  'mock-series': '/mock-series',
  'vu-quick': '/vu',
  'vu-smart': '/vu',
  'vu-complete': '/vu',
  'vu-topper': '/vu',
  'board-paper': '/board',
  'cv-cover': '/career/cv',
  'job-apply': '/apply-service',
  'scheme-help': '/sarkari-services',
  'interview-prep': '/career',
};
export function productPage(id: string): string {
  return PRODUCT_PAGE[id] ?? '/plans';
}

export const DOOR_LABEL: Record<Door, string> = {
  'job-prep': 'Job ki tayyari',
  vu: 'VU Corner',
  board: 'Board Classes',
  career: 'Career Desk',
  sarkari: 'Sarkari Services',
};

/** "Rs. 350" (PKR, poore rupay) */
export function formatPrice(price: number): string {
  return `Rs. ${price.toLocaleString('en-PK')}`;
}

/** Ghalat input ka paigham (F02-AC2): "Course code aisa hona chahiye, maslan CS101." */
export function fieldMessage(f: ProductField): string {
  return f.example ? `${f.label} aisa hona chahiye, maslan ${f.example}.` : `${f.label} sahih bharein.`;
}
