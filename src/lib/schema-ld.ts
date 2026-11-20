// spec: F16-AC5 (Article + BreadcrumbList schema; owner ka faisla Qadam 12: 1a — isi qadam mein). Qadam 15a: F21-AC5 intent 13 ki table
//       (EducationalOrganization, WebSite, Product, Service). Qeemat hamesha catalog se; koi rating/review nahin (jhoota dawa nahin, usool 7).
// `<script type="application/ld+json">` mein daalne ke liye mehfooz JSON: `<`, `>`, `&` aur U+2028/2029 unicode escape (`</script>` se bahar nahin nikal sakta).

import type { Product } from './catalog';

export const ORG_NAME = 'GVS Academy';
const CTX = 'https://schema.org';
const orgRef = (base: string) => ({ '@type': 'EducationalOrganization', name: ORG_NAME, url: new URL('/', base).href });

const UNSAFE = new RegExp('[<>&' + String.fromCharCode(0x2028, 0x2029) + ']', 'g');

export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(UNSAFE, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

export function breadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: it.url })),
  };
}

export function articleSchema(a: { title: string; description: string | null; url: string; datePublished: string; dateModified: string; section?: string; logo: string }) {
  const org = { '@type': 'Organization', name: ORG_NAME, logo: { '@type': 'ImageObject', url: a.logo } };
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: a.title.slice(0, 110),
    ...(a.description ? { description: a.description } : {}),
    ...(a.section ? { articleSection: a.section } : {}),
    datePublished: a.datePublished,
    dateModified: a.dateModified,
    mainEntityOfPage: { '@type': 'WebPage', '@id': a.url },
    author: { '@type': 'Organization', name: ORG_NAME },
    publisher: org,
  };
}

/** intent page list: /jobs/ppsc|fpsc|nts par FAQPage (FAQ component ke wohi sawal) */
export function faqSchema(items: { q: string; a: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((it) => ({ '@type': 'Question', name: it.q, acceptedAnswer: { '@type': 'Answer', text: it.a } })),
  };
}

/** F25-AC4: /how-to-order par HowTo (wohi qadam jo page par dikhte hain) */
export function howToSchema(h: { name: string; description: string; url: string; steps: { t: string; d: string }[] }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: h.name,
    description: h.description,
    step: h.steps.map((s, i) => ({ '@type': 'HowToStep', position: i + 1, name: s.t, text: s.d, url: `${h.url}#qadam-${i + 1}` })),
  };
}

/** Home: EducationalOrganization (niji academy; sarkari idara nahin) */
export function organizationSchema(base: string, description: string) {
  return {
    '@context': CTX,
    ...orgRef(base),
    logo: new URL('/images/logo.svg', base).href,
    description,
    areaServed: { '@type': 'Country', name: 'Pakistan' },
  };
}

/** Home: WebSite (search box nahin — site par search nahin) */
export function websiteSchema(base: string) {
  return { '@context': CTX, '@type': 'WebSite', name: ORG_NAME, url: new URL('/', base).href, inLanguage: 'en' };
}

/** catalog product → Offer (qeemat null = offer nahin) */
export function offerOf(p: Pick<Product, 'name' | 'price'>, url: string) {
  return p.price === null ? null : { '@type': 'Offer', name: p.name, price: String(p.price), priceCurrency: 'PKR', availability: 'https://schema.org/InStock', url };
}

const offersOf = (products: Pick<Product, 'name' | 'price'>[], url: string) => products.map((p) => offerOf(p, url)).filter((o) => o !== null);

/** /past-papers, /current-affairs, /mock-series, /board/<class>, /vu (4 offers) */
export function productSchema(o: { name: string; description: string; url: string; base: string; products: Pick<Product, 'name' | 'price'>[] }) {
  const offers = offersOf(o.products, o.url);
  return {
    '@context': CTX,
    '@type': 'Product',
    name: o.name,
    description: o.description,
    image: new URL('/images/og.png', o.base).href,
    brand: { '@type': 'Brand', name: ORG_NAME },
    offers: offers.length === 1 ? offers[0] : offers,
  };
}

/** /career, /career/cv, /apply-service */
export function serviceSchema(o: { name: string; description: string; url: string; base: string; serviceType: string; products: Pick<Product, 'name' | 'price'>[] }) {
  const offers = offersOf(o.products, o.url);
  return {
    '@context': CTX,
    '@type': 'Service',
    name: o.name,
    description: o.description,
    serviceType: o.serviceType,
    url: o.url,
    provider: orgRef(o.base),
    areaServed: { '@type': 'Country', name: 'Pakistan' },
    ...(offers.length ? { offers: offers.length === 1 ? offers[0] : offers } : {}),
  };
}
