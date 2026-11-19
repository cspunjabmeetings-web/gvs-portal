// spec: F16-AC5 (Article + BreadcrumbList schema; owner ka faisla Qadam 12: 1a — isi qadam mein). Qadam 15 baqi pages ke liye yahi istemal kare.
// `<script type="application/ld+json">` mein daalne ke liye mehfooz JSON: `<`, `>`, `&` aur U+2028/2029 unicode escape (`</script>` se bahar nahin nikal sakta).

export const ORG_NAME = 'GVS Academy';

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
