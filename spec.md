# GVS Academy Portal: spec.md

| | |
|---|---|
| **Document** | spec.md (technical spec, `intent.md` se bani) |
| **Version** | 0.3 (DRAFT, owner ke review ke liye) |
| **Tareekh** | 16 November 2026 |
| **Source** | `intent.md` v1.0 (16 Nov 2026) |
| **Scope** | Sirf Version 1 (intent section 3). V2/V3 sirf "tayyari" ke hisse tak |
| **Haalat** | **Manzoor (16 Nov 2026):** P-01 (Workers), P-11 (R2 custom domain), Q-01 (`/job-prep` page), Q-02 (GA4 deferred), Q-03 (domain Cloudflare DNS par). **P-02 se P-10 aur P-12 bhi manzoor (v0.3).** Ab koi proposal baqi nahin; nayi cheez ke liye change request (13.5) |

---

## 0. Khulasa (Roman Urdu mein, owner ke liye)

**Kya faisla hua (intent ke mutabiq, kuch naya nahin):**

- Stack: Astro + Tailwind + Preact islands, Cloudflare par hosting, D1 database, R2 tasveerein. Intent ka stack hi sab se tez, halka aur sasta nikla; is liye database mein Supabase/Firebase ki bajaye **D1 hi chuna** (wajah section 4 mein).
- Shuru ka kharcha: sirf domain. Lekin free tier ki **hard hadein** hain (section 4.3): Workers 100,000 requests rozana, D1 5 million reads aur **100,000 writes** rozana. Hadd paar hone par D1 queries **fail** hoti hain. Is liye zyada se zyada pages static rakhe gaye hain aur har query ka kharcha naapa jata hai.

**Jo intent se thora alag nikla (aap ki ijazat chahiye, section 14):**

1. **P-01 (MANZOOR):** Astro ka naya Cloudflare adapter (v13) ne **Cloudflare Pages ka support khatam** kar diya hai; hosting ab **Workers** (static assets ke sath) par. Wohi Cloudflare, wohi free tier, bas deploy ka tareeqa alag. Intent mein "Pages" likha tha.
2. Chand chhoti gaps jo intent mein reh gayi (maslan Home par "taza jobs" ke liye endpoint nahin, "410 Gone" ke liye soft delete, duplicate sawal pakadne ka tareeqa). Sab section 14 mein.

**Flags (khatra / mehnga / gair zaroori):** section 12 mein alag, teen tables mein.

**Claude Code ko qaboo mein rakhne ke liye "loops":** section 13 mein. Is mein protected files, har qadam ka 6-marhale ka loop, scope check, golden tests, aur tayyar `CLAUDE.md` / `.claude/settings.json` ka maswida hai.

**Sawal:** Q-01 se Q-03 ke jawab mil chuke (section 15.1). 12 chhote assumptions (15.2) maine default le liye hain; ghalat hon to batayen. Saare proposals (P-01 se P-12) manzoor ho chuke (section 14).

---

## 1. Is document ko kaise istemal karein

1. **Sach ka darja:** owner ki hidayat, phir `intent.md`, phir yeh `spec.md`, phir `design.md`, phir code (intent 0.2). Takrao ho to `intent.md` jeetta hai.
2. Yeh file **`intent.md` ke scope ke andar** hai. Jo cheez intent mein nahin, wo yahan sirf "Proposal" ya "Sawal" ban kar aayi hai, aur jab tak owner "haan" na kahe, build mein nahin jaye gi.
3. Har feature ki ID hai (`F01`...), har acceptance criterion ki (`F08-AC3`), har screen ki (`S01`, `A02`), har endpoint ki (`E01`...), har flag ki (`FL-xx`, `FX-xx`, `FU-xx`). Code mein commit message aur tests inhi IDs ka hawala dein (section 13).
4. Zaban: technical hissa English mein (taake Claude Code se ghalat-fehmi na ho). Visitor ko dikhne wale alfaz Roman Urdu mein, intent section 27 ke lehje mein.

### 1.1 Machine-readable markers

`ROUTES`, `API`, `DEPS` aur `TABLES` ke `<!-- ...:BEGIN -->` / `<!-- ...:END -->` blocks ko `scripts/check-scope.mjs` (section 13.6) parh kar code, `package.json` aur migrations se milaye ga. In blocks ko haath se na badlein; badalna ho to owner ki ijazat se.

---

## 2. Scope lock

### 2.1 Version 1 mein hai (intent section 3 ka khulasa)

Home + 4 darwaze, product pages, rate list, order list (cart), order form, WhatsApp tayyar message, order tracking + timer, admin (Orders, Notifications, Content, Jobs, Settings), muft rozana test, mazmoon-war practice, muft mock tests, muft notes, history (browser mein), Jobs, SEO, house ads, About/Contact/Privacy/Terms/How-to-order, V2 ki tayyari (band endpoints, `fileHint`, `agent_log`).

### 2.2 Version 1 mein NAHIN (jaan boojh kar)

Customer sign up/login, online payment/PSID, paid files ka upload/download, automatic WhatsApp messages/WaSender, advance balance, AdSense, admin se qeemat badalna, har VU course ka alag page, interview tayyari aur law/commerce notes ka order, Urdu Nastaliq, mobile app.

### 2.3 Change control

Koi bhi nayi cheez (page, endpoint, table, column, dependency, feature, UI text jo spec mein nahin) **pehle owner se poochi jaye**. Tareeqa: section 13.5.

---

## 3. Tech stack

### 3.1 Faisla

Maqsad: click karte hi jawab (feedback 100 ms ke andar), halka page, kam se kam processing aur browsing time, aur free tier mein rehna.

| Hissa | Choice | Kyun (performance ke lihaz se) |
|---|---|---|
| Framework | **Astro** (latest stable, abhi 6.x; scaffold par `npm create astro@latest`, exact version `package.json` mein pin) | Default par zero JavaScript; pages pehle se HTML; sirf zaroori "islands" JS lete hain. Content sites mein sab se tez rasta |
| Rendering | `static` default; on-demand sirf wahan jahan DB chahiye (`export const prerender = false`) | Static pages edge se free aur unlimited milte hain (Workers static assets). On-demand sirf jobs/notes/mcqs/mocks/sitemap |
| Adapter | **`@astrojs/cloudflare` v13** (Workers target) | Pages ka support is version mein khatam; Cloudflare bhi naye projects ko Workers hi recommend karta hai. **P-01 (manzoor)** |
| Styling | **Tailwind CSS 4.x** (Vite plugin) + CSS variables | Sirf istemal hui CSS shamil; chhoti stylesheet; rang ek jagah (design.md) |
| Interactive | **Preact** (about 3 KB) islands; chhote kaam ke liye vanilla JS | Quiz, mock test, cart, order form, track, admin. React ke muqable kai guna halka |
| Navigation | MPA (normal page loads) + Astro **prefetch** (`tap` default) | Click se pehle hi agla page tayyar; "instant" mehsoos hota hai. View-transition/router library nahin (JS ka bojh) |
| Validation | **Valibot** (tree-shakeable, bahut chhota) sirf server par; client par `src/lib/validators.ts` ke chhote functions | Zod ke muqable halka. Client bundle mein library nahin |
| Markdown (notes) | Apna chhota `markdown.ts` (sirf `##`, `###`, `-`, `**`, links) | Zero dependency, mehfooz (section 9.2) |
| Language | **TypeScript** (strict) | Ghaltiyan build par pakri jayen |
| Tests | **Vitest** + `@cloudflare/vitest-pool-workers` (D1 ke sath asal jaisa test) | Intent ka `tests/` folder; Playwright/E2E nahin (FU-01) |
| Database | **Cloudflare D1** (SQLite) | Section 4 |
| Tasveerein | **Cloudflare R2** | Section 4.4 |
| Hosting | **Cloudflare Workers + static assets** (Pages ki jagah, P-01) | Free tier; apna domain; tez CDN |
| Secrets | Cloudflare secrets (`wrangler secret`) | Admin password, session key, agent key |
| Code | GitHub private repo; Cloudflare Workers Builds se khud deploy | Intent 12.1 |
| Analytics | `analytics.ts` ke peeche; GA4 **deferred load** (pehli interaction ya idle ke baad) | GA4 script ka wazan LCP/JS budget kharab na kare (FX-04). **GA4 chuna gaya (Q-02, manzoor)** |
| Fonts | System font stack, ya ek self-hosted variable font (woff2, Latin subset, 40 KB tak, `font-display: swap`). Aakhri faisla design.md mein | Roman Urdu Latin harfon mein hai, bhaari font ki zaroorat nahin |
| Icons | Inline SVG | Icon font ya library nahin |

**Nahin istemal hone wale (wajah ke sath):** ORM (Prisma/Drizzle), state library (Redux), UI kit (MUI), Storybook, Playwright. Wajah: bundle ka bojh ya kam fayda is size ke project mein (FU-01).

### 3.2 Folder structure

Intent 12.2 ka naqsha **bina tabdeeli** ke. Is mein spec ki taraf se sirf yeh izafa (section 13 ke liye, Step 0 mein owner ki ijazat se):

- `scripts/check-scope.mjs`, `tests/golden/*.test.ts`, `.claude/settings.json`
- `PROGRESS.md` (P-10 manzoor)

### 3.3 Shared code ka usool (intent 12.2 se)

`catalog.json`, `timer.ts`, `parser.ts`, `phone.ts`, `validators.ts` frontend aur backend dono istemal karte hain. Qeemat, waqt aur format ka hisab sirf yahan se. Server hamesha dobara hisab karta hai.

### 3.4 Caching ka usool

| Cheez | Rule |
|---|---|
| Static pages aur assets | Cloudflare edge; hashed assets `immutable, max-age=31536000` |
| On-demand pages (jobs, notes, mocks, mcqs) | `Cache-Control: public, max-age=60, s-maxage=300, stale-while-revalidate=60`. Worker ke andar `caches.default` bhi (D1 reads bachane ke liye) |
| `GET /api/settings` | `s-maxage=60`; client `sessionStorage` mein 10 minute (har page par dobara na maange) |
| `GET /api/daily-test` | `s-maxage=300` |
| `GET /api/track`, sab `/api/admin/*`, `POST` | `Cache-Control: no-store` |
| Admin se content badalna | `caches.default.delete(url)` best-effort. **Dhyan:** yeh sirf usi data-center ka cache saaf karta hai (FL-04), baqi jagah TTL (5 minute) ke baad |

---

## 4. Database ka intikhab

### 4.1 Faisla: Cloudflare D1

| Maiyar | D1 | Supabase | Firebase (Firestore) |
|---|---|---|---|
| Data ki qism | SQL (orders, status, relations) | SQL (Postgres) | NoSQL (relations haath se) |
| Hosting ke sath | Usi Cloudflare platform par, Worker se seedha binding, alag network hop nahin | Alag service, har query internet par | Alag service |
| Free tier | 5 GB storage, 5M reads/din, 100K writes/din | Free plan hai; hadein aur "pause" ke qawaid launch se pehle dekhein | Free plan hai; reads/writes ki rozana hadein |
| Raftar | Worker ke qareeb, kam latency | Region par munhasir | Region par munhasir |
| Naya account/billing | Wohi Cloudflare account | Nayi service, nayi billing | Google Cloud billing |
| Backup | Time Travel + CSV/DB export | Plan ke mutabiq | Plan ke mutabiq |

**Natija:** D1 (intent 12.1). Wajah: relational data (orders, events, notifications), sirf text, ek hi platform, aur free tier mein kaafi. Doosra rasta Supabase hai (intent 12.1), lekin sirf tab jab D1 ki hadein masla banen.

Dhyan: upar ke Supabase/Firebase ke free-tier ke qawaid maine yahan check nahin kiye; sirf D1 aur Workers ki hadein taza docs se dekhi gayi hain (section 4.3). Launch se pehle jaiza zaroori hai.

### 4.2 Kharcha

| Cheez | Shuru mein | Agar hadein paar hon |
|---|---|---|
| Hosting, D1, R2 | Free | Workers Paid, taqreeban 5 dollar mahana (10 million requests aur zyada D1 allowance shamil) |
| Domain | Alag (owner) | |
| Baqi sab | Free | |

### 4.3 Free tier ki hadein (Nov 2026 ki research; launch se pehle Cloudflare ke docs se dobara tasdeeq karein)

| Cheez | Free hadd | Is ka asar |
|---|---|---|
| Workers requests | 100,000 rozana; CPU 10 ms har request | Har **on-demand page**, har **API call** ek request. Static assets muft aur beshumar |
| D1 rows read | 5 million rozana | Har query ka "rows scanned" ginta jata hai; index zaroori |
| D1 rows written | **100,000 rozana** | Har INSERT/UPDATE/DELETE; `rate_limits` aur notifications bhi |
| D1 hadd paar | **1 Sept 2026 se queries fail** hoti hain (midnight UTC tak) | Site ka database wala hissa ruk jaye ga; order bhi save nahin hoga (FL-03) |
| D1 queries har request | 50 (free) | Batch ko chhota rakhein (section 8.5) |
| D1 database size | 500 MB har database | Text data ke liye bahut kaafi |
| Hadein reset | Roz 00:00 UTC (Pakistan mein subah 5:00 baje) | |

**Andaza (sirf rehnumai):** agar har visitor 5 requests banata hai (settings 1, ek-do on-demand pages, daily-test 1, baqi static), to free tier taqreeban 20,000 visitors/din tak chalti hai. 70,000 requests rozana par owner Workers Paid ($5/mahina) par chala jaye. Is ki nigrani section 9.6 mein.

### 4.4 R2

Sirf job posts ki tasveerein. Free allowance is ke liye kaafi (150 KB × chand sau tasveerein). Tasveerein Worker se guzar kar na dikhayi jayen (har view ek Worker request ban jata hai); R2 ka **custom domain** (`img.<domain>`) istemal ho, jis ke liye domain Cloudflare DNS par hona chahiye (P-11 manzoor, Q-03: owner domain Cloudflare par laye ga; `.pk` registrar se nameserver badalna pehle tasdeeq karein).

---

## 5. Features: user stories aur acceptance criteria

**Kirdar:** V = visitor, C = customer (order dene wala visitor), A = admin/owner, S = system.
**Format:** har feature ki ek ya ziada story, phir AC (har AC jaanchne ke qabil: "Given/When/Then" ka mukhtasar rup). Intent ka hawala `[i:x.y]`.

### F01. Home aur chaar darwaze `[i:8, 13]`

**Stories**
- V: "Main chahta hoon ke home par ek nazar mein samajh aaye ke GVS mere liye kya karta hai, taake main sahi jagah pohanch jaun."
- V: "Main roz aaj ka muft test seedha home se shuru karna chahta hoon."

**AC**
- F01-AC1: Home par H1 "Aap kon hain?" aur 4 darwaze: Job ki tayyari, VU Corner, Board Classes, Kaam karwana hai (Career Desk + Sarkari Services). Darwaza 1 `/job-prep` par, darwaza 2 `/vu` par, darwaza 3 `/board` par; darwaza 4 par home par hi do sub-links: Career Desk (`/career`) aur Sarkari Services (`/sarkari-services`) (Q-01, manzoor).
- F01-AC2: "Aaj ka muft test" card seedha `/daily-test` par.
- F01-AC3: Agar `history` mein streak ≥ 1 hai aur aaj ka test nahin hua, to yaad dihani ("Aaj ka test baqi hai, streak na toden").
- F01-AC4: Taza jobs (3 tak, sirf khuli, naye pehle). Data `GET /api/jobs/latest` (E07, P-05 manzoor) se.
- F01-AC5: Mashhoor packs `catalog.json` se; order ke 4 qadam; FAQ; `bottom` ad slot.
- F01-AC6: Bina JavaScript ke bhi darwaze aur links kaam karein.
- F01-AC7: Mobile par pehli load: JS ≤ 100 KB (gzip), LCP < 2.5 s (section 9.1).
- F01-AC8: Naya static page `/job-prep` (S02): H1 "Job ki tayyari", links: rozana test (`/daily-test`), MCQs (`/mcqs`), mock tests (`/mock-tests`), notes (`/notes`), past papers (`/past-papers`), current affairs (`/current-affairs`), paid mock series (`/mock-series`), jobs (`/jobs`); har link ke sath ek line ki wazahat; kam az kam 300 alfaz ka asal content; FAQ; breadcrumbs; `top` aur `bottom` ad; alag title/description; sitemap mein.

### F02. Product pages aur rate list `[i:7.2, 8, 12.3, 13]`

**Stories**
- V: "Order se pehle mujhe qeemat, pack mein kya hai, aur ek muft namoona saaf dikhna chahiye."
- C: "Mujhe order ke liye sirf wohi poochha jaye jo zaroori hai (course code, mazmoon, class)."

**AC**
- F02-AC1: Har paid page par qeemat `catalog.json` se, "includes" ki list, muft namoona (`sample`), order ke 4 qadam, refund policy ka link, WhatsApp number.
- F02-AC2: Form ke khane `fields` se bante hain (key, label, type, required, pattern, example). Ghalat input par saaf paigham: "Course code aisa hona chahiye, maslan CS101."
- F02-AC3: `active: false` product kahin nahin dikhta, aur server par order bhi nahin hota.
- F02-AC4: `job-apply` aur `scheme-help` ke sath likha ho: "Qeemat mein sarkari fee shamil nahin."
- F02-AC5: Interview tayyari "Rabta karein" ke sath, bina qeemat, aur order list mein nahin ja sakti. Law/commerce notes rate list mein nahin.
- F02-AC6: `/plans` par sab `active` products darwaze ke hisab se ek jagah.
- F02-AC7: Kisi bhi page, catalog ya FAQ mein mamnoo alfaz nahin ("guarantee", "100%", "pakki naukri", "sab se behtareen"). Is ka automatic test (section 13.5).
- F02-AC8: Catalog ki qeematein intent 7.2 se bilkul milti hain (golden test).

### F03. Order list (cart) `[i:9.2]`

**Stories**
- C: "Main kai cheezein ek sath order karna chahta hoon, aur page badalne par list yaad rahe."

**AC**
- F03-AC1: "Order list mein daalein" turant (< 100 ms) cart badal deta hai; koi network call nahin.
- F03-AC2: Cart `localStorage` mein; har page par neeche `CartBar` (cheezon ki ginti, kul raqam). Admin par nahin.
- F03-AC3: Zyada se zyada 10 cheezein; 11vi par paigham: "Ek order mein 10 cheezein hi ho sakti hain."
- F03-AC4: Same product + same tafseel dobara daalne par rok ("Yeh cheez pehle se list mein hai"). Same product + alag tafseel (alag course code) alag line.
- F03-AC5: Har line hatane ke qabil. Khali cart ka saaf message.
- F03-AC6: `orders_open = false` ho to "Order list mein daalein" aur "WhatsApp par order karein" ki jagah elaan; cart ki maujooda cheezein mehfooz rahein.
- F03-AC7: `localStorage` band ho to cart us page tak chale (memory mein), crash nahin.

### F04. Order dena (server par save, phir WhatsApp) `[i:9.2, 9.3, 12.6]`

**Stories**
- C: "Mujhe sirf naam aur WhatsApp number dena ho, phir WhatsApp par tayyar message khule."
- A: "Customer WhatsApp tak na bhi aaye, to bhi mere paas us ka order maujood ho."

**AC**
- F04-AC1: Form mein sirf Naam (2 se 60 harf) aur WhatsApp number. Number `03XXXXXXXXX` (11 hindse). Dashes/spaces/`+92` bardasht; server `923XXXXXXXXX` mein badalta hai.
- F04-AC2: "WhatsApp par order karein" dabane par `POST /api/orders`; kamyabi par screen par order number bara + copy button + "WhatsApp par bhejein".
- F04-AC3: Server qeemat `catalog.json` se (job apply ki fee job se, khali ho to `default_job_fee`) khud hisab karta hai; browser ki bheji qeemat ignore.
- F04-AC4: Server in cheezon ki jaanch karta hai: product `active`, `fields` ka pattern, cheezein ≤ 10, `orders_open`, rate limit (5 naye orders har ghante har number se), job band to nahin.
- F04-AC5: Order number `GVS-YYMM-NNNN`, mahine ke hisab se (Asia/Karachi), bina takrao (section 8.5).
- F04-AC6: Order save hone ke sath `order_new` notification banti hai.
- F04-AC7: "WhatsApp par bhejein" par `POST /api/orders/:id/whatsapp-opened` (sirf pehli dafa); `whatsapp_opened_at` set; notification.
- F04-AC8: WhatsApp message intent 9.3 ke template ke mutabiq (cheezein + tafseel, kul, naam, track link). Customer ka phone number message mein nahin.
- F04-AC9: Agar WhatsApp na khule: number aur message dono ke copy buttons aur "Fikr na karein, aap ka order hamare paas aa gaya hai..." ka paigham.
- F04-AC10: Order kamyab hone par cart khali ho jata hai, aur `history` mein order ka number + aakhri 4 hindse "Mere orders" ke liye mehfooz hote hain.
- F04-AC11: Order form khulne par **Cloudflare Turnstile** (P-09, invisible/managed) lazy-load hota hai (home ke JS budget mein nahin ginta). Server `turnstileToken` ko Turnstile ke `siteverify` se jaanchta hai; ghalat/ghair-maujood token par 400. Agar Turnstile load ya verify na ho (service ki kharabi), to order band nahin: F05 ka "WhatsApp par seedha order bhejein" rasta chale. Site key public, `TURNSTILE_SECRET` Cloudflare secret.

### F05. API ki kharabi mein order na zaya ho `[i:9.2]`

**Story:** C: "Agar server na chale, tab bhi mera order WhatsApp tak pohanch jaye."

**AC**
- F05-AC1: `POST /api/orders` fail (network, 5xx, timeout 10 s) par saaf ghalti ka paigham aur "WhatsApp par seedha order bhejein" ka bara button.
- F05-AC2: Yeh button wohi message (bina order number aur bina track link ke) banata hai, number `sessionStorage` ke cache se, warna build ke waqt ki fallback value se.
- F05-AC3: Cart is rastay mein khali nahin hota.
- F05-AC4: D1 ki free hadd paar (section 4.3) par bhi yehi rasta chale (API 503 deta hai, UI wohi fallback).

### F06. Order track karna aur timer `[i:9.4, 12.6, 12.7]`

**Stories**
- C: "Main order number se dekhna chahta hoon ke payment mili ya nahin, aur file kab tak aaye gi."

**AC**
- F06-AC1: `/track` par order number + phone ke aakhri 4 hindse. WhatsApp message ke link se `?id=` pehle se bhara.
- F06-AC2: Sahih jawab: darja, timer, `public_note`, darje ke hisab se intent 9.4 ka matn. Jawab mein phone number kabhi nahin.
- F06-AC3: Ghalat id ya last4: ek hi saada paigham "Order nahin mila" (dono ghaltiyon mein farq nahin).
- F06-AC4: Brute-force se bachao: ek order id par 5 ghalat koshishon ke baad 15 minute rok, aur har IP par had (section 9.3).
- F06-AC5: `paid` par ulti ginti `due_at - abhi`; "1 ghanta 20 minute" shakal. Waqt guzar jane par: "Thori der ho gayi hai, hum aap se WhatsApp par rabte mein hain." (manfi ginti nahin).
- F06-AC6: Page har 60 second baad status dobara leta hai, lekin tab chhupa ho, ya darja `complete`/`cancelled` ho to rok deta hai.
- F06-AC7: `new` par payment ke qadam (JazzCash/Easypaisa number, raqam, "screenshot WhatsApp par bhejein"); documents wali services mein documents ki list.
- F06-AC8: `complete` par "Dobara order karein" jo wohi cheezein cart mein dalta hai.
- F06-AC9: Page `noindex`, koi ad nahin, jawab `no-store`.

### F07. Admin login `[i:9.6, 12.8]`

**Story:** A: "Sirf main admin kholoon, aur phone par aasani se."

**AC**
- F07-AC1: `/admin` par password; sahih par signed `HttpOnly; Secure; SameSite=Strict` cookie, 7 din.
- F07-AC2: 5 ghalat koshishon (har IP hash par) ke baad 15 minute ki rok, aur bachay hue waqt ka paigham.
- F07-AC3: Bina cookie ke har `/api/admin/*` 401.
- F07-AC4: Logout cookie saaf karta hai. `/admin` `noindex` aur `robots.txt` mein band.
- F07-AC5: Password code ya repo mein nahin; sirf `ADMIN_PASSWORD` secret. Password constant-time compare se.
- F07-AC6: **Cloudflare Access** (P-08) `/admin` aur `/api/admin/*` dono ke samne lagi ho (email OTP), password ke upar ek izafi tah. Agent endpoints (V2) Access ke bahar rahein aur sirf bearer key se chalein. Access ki setting Cloudflare dashboard mein hai (code ka hissa nahin); owner Qadam 18 par lagaye.

### F08. Admin: Orders tab `[i:9.4, 9.7]`

**Stories**
- A: "Subah kholte hi mujhe nazar aaye ke raat ko kya aaya, kis ne WhatsApp nahin khola, aur kya karna hai."
- A: "Ek tap se darja badlun, aur customer ko sahi message ke sath chat khol sakun."

**AC**
- F08-AC1: Upar din ka khulasa: aaj ke naye, paid, mukammal orders aur aaj ki kamai (Sawal A-01).
- F08-AC2: Filter: Naye, WhatsApp nahin khola, Paid, Pending, Complete, Cancel, Sab. Search: order number, naam, phone ka hissa.
- F08-AC3: Card par: order number, naam, poora number, cheezein+tafseel, kul, kitni der pehle, darja, timer, "WhatsApp khola" (haan/nahin), "Rabta hua" (owner tick).
- F08-AC4: Buttons Paid, Pending, Complete, Cancel; ek tap. Sirf ijazat shuda tabdeeliyan (section 8.6).
- F08-AC5: "Paid" par tasdeeq ka chhota dialog: hisab shuda wada ("Wada: aaj 5:00 PM"), badalne ka option, phir tasdeeq. Multi-item order mein sab se lamba waqt.
- F08-AC6: "Cancel" par wajah likhna zaroori (customer ko dikhegi).
- F08-AC7: "Khud rabta karein": `wa.me/<customer>?text=` darje ke hisab se intent 9.7 ke message ke sath.
- F08-AC8: Har order par do alag note: public aur andaruni.
- F08-AC9: Har tabdeeli `order_events` mein; notification banti hai.
- F08-AC10: Har button kam az kam 44px ooncha; panel 360px par poora chale.
- F08-AC11: Admin khula ho to har 60 s par naye orders; naye order par halki awaz aur (ijazat ho to) browser notification; ghanti ki ginti barhti hai.
- F08-AC12: `complete`, `cancelled` ke 90 din baad customer ka naam/number mitaya ja chuka ho to card par "Data mita diya gaya" likha ho.

### F09. Admin: Notifications tab `[i:9.8]`

**AC**
- F09-AC1: Naya order, WhatsApp khola, darje ki tabdeeli, khud cancel, `low_mcq_bank` list mein, naye upar.
- F09-AC2: Har notification par order ka link aur "Parh liya"; "Sab parh liye" ka button.
- F09-AC3: Ghanti ka nishan na-parhi ginti dikhata hai (har tab par).
- F09-AC4: Ek hi qism ki dohri `low_mcq_bank` notification ek din mein ek dafa se zyada nahin.

### F10. Admin: Settings tab `[i:9.9, 12.4]`

**AC**
- F10-AC1: WhatsApp number: 11 hindse, `03` se shuru; ghalat par mehfooz nahin.
- F10-AC2: JazzCash/Easypaisa number aur title. Kaam ke auqaat (`HH:MM`, end > start). Default delivery minute (15 se 1440). Har product ka waqt (override). Auto-cancel ghante (1 se 720).
- F10-AC3: Elaan ki patti (160 harf tak) on/off; "orders band" switch.
- F10-AC4: Mazameen ki list badalne ki jagah (intent 10.3 ki list shuru ki value).
- F10-AC5: Password badalne ka tareeqa sirf likha hua (Cloudflare secret ke qadam); koi password-change endpoint nahin.
- F10-AC6: "Agent (Version 2)" ka khana dikhe lekin band; key banane ka button band.
- F10-AC7: Tabdeeli ke baad poori site naya number istemal kare (settings cache ≤ 60 s + client 10 min; admin ke apne browser mein foran).

### F11. Content import: text paste/upload, preview, save `[i:10.1 se 10.6]`

**Stories**
- A: "Main Claude se bana text paste karun, to portal usay khoobsurat pages mein badal de, aur ghaltiyan line number ke sath bataye."

**AC**
- F11-AC1: Content tab mein paste ka khana aur `.txt` upload (UTF-8, ≤ 512 KB). PDF qabool nahin.
- F11-AC2: Save se pehle **preview**: kitne MCQ/mock/note/job mile, har ek visitor ko kaisa dikhega, ghaltiyan line number ke sath ("Line 14: sawal 3 mein sahih jawab par * nahin laga").
- F11-AC3: Ghalti wale hisse save nahin hote; sahih hisse save ho sakte hain.
- F11-AC4: Format intent 10.2 se 10.6 ke mutabiq: `# MCQ/# MOCK/# NOTE/# JOB`, `---`, `Naam: value`, chhote-bare harf ka farq nahin, khali lines ignore. Aik paste mein ≤ 500 cheezein.
- F11-AC5: MCQ: 2 se 5 options, sirf ek par `*`; mazmoon list mein se; Current Affairs par `Tareekh:` zaroori.
- F11-AC6: "Main ne yeh sawal jaanch liye hain" checkbox; tick na ho to `verified = 0` (visitors ko nahin dikhte).
- F11-AC7: Ek jaise sawal ki khabardari preview mein (P-07 manzoor: `q_hash` se).
- F11-AC8: Mock: `# MOCK` ... `# END MOCK`; mock ke sawal MCQs bank mein bhi.
- F11-AC9: Hadein: section 9.4 ki file-size/length table.
- F11-AC10: Import ke baad content bina deploy ke live (cache TTL ke andar).

### F12. Admin: content ka intizam `[i:10.1]`

**AC**
- F12-AC1: MCQs, mocks, notes ki list (search, mazmoon/verified filter, 50-50 ki pages).
- F12-AC2: Har cheez dekhna, badalna, chhupana/dikhana, mitana; MCQ par `verified` on/off.
- F12-AC3: Mock mitane par us ke MCQs bank mein rehte hain (mock se alag ho jate hain) (Sawal A-03).
- F12-AC4: Note ka slug title se banta hai, unique; edit karne par slug nahin badalta.
- F12-AC5: Mitaya gaya note/mock/job ka URL `410 Gone` (P-06 manzoor: `deleted_at`).
- F12-AC6: Galat sawal live ho jaye to ek tap par chhupane ka rasta (intent 22.4).

### F13. Rozana muft test `[i:10.7, 11.2]`

**Stories**
- V: "Roz 10 sawal, foran hara/surkh jawab, aur meri streak."

**AC**
- F13-AC1: `/daily-test` par aaj ke 10 sawal; sab visitors ke liye wohi (din badalta hai 00:00 Pakistan waqt par, Sawal A-06).
- F13-AC2: Sirf `verified = 1`, mazameen mila jula, pichhle 15 din ke sawal nahin; owner kisi din ke 10 "pin" kar sake (P-03 manzoor).
- F13-AC3: Har option bara card (ungli se dabne ke qabil, ≥ 44px). Dabate hi: sahih hara + tick, ghalat surkh + cross, sahih jawab bhi hara; tashreeh narmi se khulti hai. **Koi network call nahin, foran (< 100 ms).**
- F13-AC4: Progress bar "Sawal 4 / 10" aur chalta hua score. "Kam animation" wali phone setting ka ehtiram (`prefers-reduced-motion`).
- F13-AC5: Aakhir mein score card: score, streak, sab se kamzor mazmoon; buttons: WhatsApp par share, ghalat sawal dobara karein, "Kal phir aayein" + munasib paid pack ki peshkash.
- F13-AC6: Har sawal par bookmark nishan aur "Ghalti batayen" ka WhatsApp link (sawal ki id ke sath).
- F13-AC7: Test ke dauran koi ad nahin; `result` slot sirf score card ke neeche.
- F13-AC8: Streak aur score `history` mein, Pakistan ki tareekh ke hisab se.
- F13-AC9: `daily_test_start` aur `daily_test_complete` events.

### F14. Mazmoon-war practice `[i:11.2]`

**AC**
- F14-AC1: `/mcqs` par mazameen ke cards (sawalon ki ginti ke sath) aur packs ki peshkash.
- F14-AC2: `/mcqs/<mazmoon>` par 10-10 sawalon ke sets; "Agla set" `GET /api/mcqs?subject=&offset=` se.
- F14-AC3: Sirf `verified` sawal. Jawab/tashreeh ka behavior F13-AC3 jaisa.
- F14-AC4: Set mukammal par `practice_set_complete` event aur set ke baad `result` ad slot.

### F15. Muft mock tests `[i:10.4, 11.3]`

**AC**
- F15-AC1: `/mock-tests` par muft mocks ki list aur paid series ki peshkash.
- F15-AC2: Shuru screen: naam, sawalon ki ginti, waqt, usool.
- F15-AC3: Sawalon ki palette: hal shuda, baqi, "baad mein dekhein" alag rang **aur nishan** se; kisi number par jump.
- F15-AC4: Ulti ginti ka timer; aakhri 5 minute mein rang badle; waqt khatam par khud jama.
- F15-AC5: Jama se pehle tasdeeq ("3 sawal baqi hain. Phir bhi jama karein?").
- F15-AC6: Result: score, feesad, waqt, **mazmoon-war** result, har sawal ka jawab+tashreeh, kamzor mazmoon ke pack ki peshkash, share button.
- F15-AC7: Page band ho jaye to wapas aane par wahin se jari (browser mein, section 7.5).
- F15-AC8: Test ke dauran network ki zaroorat nahin: sab sawal page ke sath ek dafa aate hain (mock ≤ 100 sawal).
- F15-AC9: Chalte test mein ad nahin; `result` slot sirf result ke baad.

### F16. Muft notes `[i:10.5]`

**AC**
- F16-AC1: `/notes` mazmoon ke hisab se list; `/notes/<slug>` par note.
- F16-AC2: `Matn` ke `##`, `-`, `**` mehfooz HTML mein badlein; baqi sab escape (section 9.2).
- F16-AC3: `Khulasa` (≤ 155 harf) meta description banta hai.
- F16-AC4: Note ke neeche us mazmoon ke 5 MCQs ka chhota quiz aur munasib paid pack ki peshkash; mutalliqa notes.
- F16-AC5: `Article` aur `BreadcrumbList` schema.

### F17. Meri history (browser mein) `[i:11.4]`

**AC**
- F17-AC1: `/my-history`: rozana test ke scores, streak, mock results, bookmarks, "Mere orders" (order number + status ka link).
- F17-AC2: Sab `localStorage` mein; server par kuch nahin jata.
- F17-AC3: Hadein saaf likhi hon (phone/browser badalne ya data saaf karne par history nahin).
- F17-AC4: `localStorage` band/khali ho to portal phir bhi chale.
- F17-AC5: "Aap ke liye" (home par): kamzor mazmoon ke sawal, history se.
- F17-AC6: History ka schema versioned (section 7.5), 200 KB se zyada ho to purani entries chhant di jayen.

### F18. Jobs (visitor ki taraf) `[i:10.6, 13, 14.4]`

**Stories**
- V: "Main khuli jobs dekhun, documents aur apply ka tareeqa samjhun, aur chahun to GVS se apply karwa lun."

**AC**
- F18-AC1: `/jobs`: khuli jobs (ginti ke sath), idare ka filter, band jobs neeche.
- F18-AC2: `/jobs/<slug>`: ishtihar ki tasveer ya link, taleem, documents, tareeqa (number wari), akhri tareekh, official link, "GVS niji academy hai" ki wazahat.
- F18-AC3: `/jobs/ppsc`, `/jobs/fpsc`, `/jobs/nts`: idare ka asal content (300+ alfaz) aur us ki jobs. Yeh teen slugs `/jobs/<slug>` ke liye reserved.
- F18-AC4: Job "khuli" jab tak akhri tareekh ka din (Pakistan waqt, 23:59:59) khatam na ho (Sawal A-02). Uske baad: "Band ho chuka" mein, page par "Is post ki akhri tareekh guzar chuki hai" aur us idare ki khuli jobs, apply button band.
- F18-AC5: Akhri tareekh barhane par job dobara khul jaye.
- F18-AC6: `JobPosting` schema istemal nahin (GVS employer nahin).
- F18-AC7: `/apply-service` page: kya karte hain, documents, qeemat, sarkari fee ki wazahat.

### F19. Admin: Jobs tab `[i:10.6, 7.4]`

**AC**
- F19-AC1: Job text paste se ya khane bhar ke form se; dono ka nateeja ek jaisa.
- F19-AC2: Zaroori: Idara, Post, Akhri tareekh, Official link. `Hamari fee` khali ho to `default_job_fee`. `Apply service: Nahin` par apply button nahin.
- F19-AC3: Links sirf `https://`.
- F19-AC4: Tasveer lagayen: browser mein hi WebP mein chhoti (≤ 150 KB, lambi side ≤ 1200px); server 150 KB se bari rad kare; sirf `image/webp|jpeg|png`.
- F19-AC5: "Purani jobs" list; har ek par "Mitayen" aur "Sab purani mita dein" (tasdeeq ke sath).
- F19-AC6: Job mitane par us ki R2 tasveer bhi mit jaye.
- F19-AC7: Akhri tareekh ke 30 din baad tasveer khud mit jati hai (F24).

### F20. Job se apply ka order `[i:10.6, 9.3]`

**AC**
- F20-AC1: "Hum apply kar dein" job ka order item banata hai (`id: job-apply`, `jobId`), qeemat = job ki `our_fee`.
- F20-AC2: Order item mein job ka naam aur `documents` ka snapshot. WhatsApp message aur track page mein "Sarkari fee Rs. X alag, official challan par" aur documents ki list khud aaye.
- F20-AC3: Band job par order na ho (server check).

### F21. SEO `[i:14]`

**AC**
- F21-AC1: Har page ka alag title (≤ 60 harf, keyword pehle) aur description (≤ 155), ek H1, canonical.
- F21-AC2: On-demand pages ke title/description khud bante hain (intent 14.2).
- F21-AC3: `sitemap.xml`: static + on-demand pages; `/admin`, `/track`, `/my-history` aur band jobs nahin.
- F21-AC4: `robots.txt`: `/admin`, `/api` band; sitemap ka link.
- F21-AC5: JSON-LD intent 13 ke table ke mutabiq; Rich Results Test mein ghalti nahin.
- F21-AC6: Open Graph/Twitter card, 1200x630 image (job ki tasveer ho to wohi).
- F21-AC7: Mitaye gaye job/note ka URL `410`; URL badle to `301`.
- F21-AC8: Har page kam az kam 3 mutalliqa pages se jura; har static SEO page par 300+ alfaz ka asal content.
- F21-AC9: `lang="en"`; tasveerein WebP, `alt`, `width`/`height`.

### F22. House ads `[i:15]`

**AC**
- F22-AC1: Slots `top`, `inline`, `sidebar` (≥1024px), `bottom`, `result`, intent 15.1 ke sizes ke sath; chaurai-oonchai pehle se tay (CLS < 0.1).
- F22-AC2: Label "Ishtihar"; andar `house-ads.json` se ghoomte GVS ke apne ishtihar; `ads_provider` setting.
- F22-AC3: Order, track, admin, history, how-to-order, legal pages aur chalte quiz/mock mein koi ad nahin. Ek screen par ≤ 2 ad; ad aur button ke beech ≥ 24px.
- F22-AC4: `house_ad_click` event (slot id ke sath).

### F23. Analytics `[i:18]`

**AC**
- F23-AC1: Intent 18 ke saare events, sirf `analytics.ts` ke zariye.
- F23-AC2: Kisi event mein naam, phone, order ki raqam ya order number nahin (test).
- F23-AC3: Tool deferred load hota hai; load na ho to site pe asar nahin.
- F23-AC4: `/track` ke liye analytics ka `page_location` bina query (`?id=...`) ke jaye (FL-08).

### F24. Khud chalne wale kaam (maintenance) `[i:12.6]`

**AC**
- F24-AC1: `new` order jo `auto_cancel_hours` se purana ho → `cancelled`, wajah "Payment waqt par nahin aayi", event + notification.
- F24-AC2: Band jobs ki tasveer akhri tareekh ke `job_image_keep_days` baad R2 se mit jaye.
- F24-AC3: `complete`/`cancelled` orders ka naam, phone, `phone_last4` 90 din baad mit jayen.
- F24-AC4: Agle 7 din ke liye sawal kam hon to `low_mcq_bank` notification.
- F24-AC5: Purani `rate_limits` rows saaf.
- F24-AC6: Kaam kisi visitor/admin request par nahin chalte. **Cloudflare Cron Trigger** har 15 minute par ek `scheduled` handler chalata hai (P-04 manzoor); is se request ka kharcha aur takrao khatam. Free plan par cron trigger shamil hai.
- F24-AC7: Har kaam idempotent (do dafa chalne se nuqsan nahin).

### F25. Static aur qanooni pages `[i:13, 15.4]`

**AC**
- F25-AC1: `/about`, `/contact`, `/privacy`, `/terms`, `/how-to-order`, `/404` mukammal, aur sab par "GVS niji academy hai, sarkari idara nahin".
- F25-AC2: Privacy mein ads, cookies, analytics aur localStorage ka zikr.
- F25-AC3: Terms mein refund policy (intent 9.10, aakhri alfaz owner ke).
- F25-AC4: `/how-to-order` mein 4 qadam, payment, refund ka link, `HowTo` schema.
- F25-AC5: Kisi page par ad nahin.

### F26. Home screen par rakhna `[i:11.5]`

**AC**
- F26-AC1: `manifest.webmanifest` aur icons; "Home screen par rakhein" ka option.
- F26-AC2: Service worker nahin (Version 1 mein offline support scope mein nahin).

### F27. Version 2 ki tayyari (band) `[i:25.12]`

**AC**
- F27-AC1: `GET /api/agent/orders`, `GET /api/agent/notifications`, `POST /api/agent/orders/:id/complete`, `POST .../note` bane hon, `agent_enabled = false` par **404**.
- F27-AC2: `Authorization: Bearer <AGENT_API_KEY>` ki jaanch; database mein sirf key ka hash.
- F27-AC3: Agent "Paid" nahin kar sakta, qeemat nahin badal sakta, order nahin mita sakta.
- F27-AC4: Har agent request `agent_log` mein.
- F27-AC5: `fileHint` har product mein; order mein customer ki tafseel structured shakal mein.

### F28. Backup aur export `[i:12.10]`

**AC**
- F28-AC1: `GET /api/admin/export` orders ka CSV deta hai.
- F28-AC2: CSV mein jo cell `=`, `+`, `-`, `@` se shuru ho us ke aage `'` (spreadsheet formula injection se bachao).
- F28-AC3: Hafta war export ka tareeqa `README`/spec ke "Rozana operations" mein likha; poore database ka export (`wrangler d1 export`) owner ke computer se.

---

## 6. Screens ki list

Design (rang, fonts, layout) `design.md` mein; yahan sirf **kaun si screen hai aur us par kya kya aata hai**.

### 6.1 Har page ke sath aane wale hisse (shared components)

| Component | Kaam | Kahan nahin |
|---|---|---|
| `AnnouncementBar` | `announcement_text` (agar on) sab se upar | admin |
| `Header` | Logo, Jobs, Plans, "Order track karein", "Meri history", menu | admin |
| `CartBar` | Neeche chipki patti: cheezein, kul, "WhatsApp par order karein" | admin |
| `Footer` | About, Contact, Privacy, Terms, How-to-order, WhatsApp number, "GVS niji academy hai" | admin |
| `Breadcrumbs` | Andar ke pages par | home, 404 |
| `AdSlot` | Section 15 | order, track, admin, history, legal, how-to-order |
| `FAQ` | Jahan intent 13 mein likha | |
| `TrustStrip` | Qeemat saaf, "pehle namoona dekhein", 4 qadam, refund link, WhatsApp | har bechne wala page |

Har screen ki teen halatein: **loading**, **empty**, **error**. Har error ka paigham: kya ghalat hua + kaise theek ho (intent 27).

### 6.2 Visitor ki screens

| ID | URL | Is par kya aata hai (upar se neeche) | Data kahan se | Banta |
|---|---|---|---|---|
| S01 | `/` | H1 "Aap kon hain?", 4 darwaze, aaj ka test card, streak ki yaad dihani, taza jobs (3), mashhoor packs, order ke 4 qadam, FAQ, `bottom` ad | catalog.json; history; jobs (P-05) | Static + client |
| S02 | `/job-prep` | H1, aaj ka test card, 8 sub-links (test, MCQs, mocks, notes, past papers, current affairs, mock series, jobs) har ek ki ek line ki wazahat, 300+ alfaz ka content, FAQ, `top`+`bottom` ad | catalog.json | Static |
| S03 | `/vu` | Course code ka khana (validation), 4 packs ka muqabla (Quick/Smart/Complete/Topper: qeemat, kya shamil), namoone, FAQ, `top`+`bottom` ad | catalog.json | Static |
| S04 | `/board` | Class chunein (9th se 12th) | | Static |
| S05 | `/board/9th` ... `/board/12th` | Mazameen, paper kaise banta hai, order form (Class, mazmoon, chapters/units, kul number), qeemat, namoona | catalog.json | Static |
| S06 | `/career` | CV/cover letter, apply, interview ("Rabta karein"), links | | Static |
| S07 | `/career/cv` | Kya milega, kya bhejna hai, qeemat, order | | Static |
| S08 | `/apply-service` | Kya karte hain, documents, qeemat, sarkari fee ki wazahat, order, FAQ | | Static |
| S09 | `/sarkari-services` | Schemes ki list (`schemes.json`), "GVS niji madadgar hai" | schemes.json | Static |
| S10 | `/sarkari-services/<scheme>` | Ahliyat, documents, official link, fee, "form bharwayen", FAQ | schemes.json | Static |
| S11 | `/plans` | Saari qeematein darwaze ke hisab se | catalog.json | Static |
| S12 | `/past-papers` | Kis post ke papers, namoona, order (post/test ka naam likhna) | | Static |
| S13 | `/current-affairs` | Mahine ki list, namoona, order (mahina chunna) | | Static |
| S14 | `/mock-series` | Kaise chalti hai, schedule, qeemat, order (sirf naam+number) | | Static |
| S15 | `/mcqs` | Mazameen ke cards + sawalon ki ginti, packs | D1 | On-demand |
| S16 | `/mcqs/<mazmoon>` | 10 sawalon ka set (quiz UI), "Agla set", set ke baad `result` ad | D1, `/api/mcqs` | On-demand |
| S17 | `/daily-test` | Teen halatein: shuru (aaj ka test, streak), sawal+jawab+tashreeh (progress bar), score card (share, ghalat dobara, pack ki peshkash, `result` ad) | `/api/daily-test` | Static + client |
| S18 | `/mock-tests` | Muft mocks ki list (naam, sawal, waqt), paid series ki peshkash | D1 | On-demand |
| S19 | `/mock-tests/<slug>` | Teen halatein: shuru screen; sawal + palette + timer + "baad mein dekhein"; result (mazmoon-war, har sawal ki tashreeh, share) | D1 | On-demand |
| S20 | `/notes` | Mazmoon ke hisab se notes ki list | D1 | On-demand |
| S21 | `/notes/<slug>` | Note ka matn, 5 MCQs ka quiz, mutalliqa notes, pack ki peshkash, ad | D1 | On-demand |
| S22 | `/jobs` | Khuli jobs (ginti), idare ka filter, band jobs neeche | D1 | On-demand |
| S23 | `/jobs/ppsc`, `/jobs/fpsc`, `/jobs/nts` | Idara kya hai, form kaise bharein, test ka pattern, us ki jobs, FAQ | D1 | On-demand |
| S24 | `/jobs/<slug>` | Ishtihar ki tasveer/link, taleem, documents, tareeqa, akhri tareekh ki ulti ginti, official link, "Hum apply kar dein" (ya band ka paigham) | D1, R2 | On-demand |
| S25 | (sheet) Order form | Naam, WhatsApp number, cheezon ka khulasa, kul, "WhatsApp par order karein" | `/api/orders` | Client |
| S26 | (screen) Order ho gaya | Order number bara + copy, "WhatsApp par bhejein", copy-message button, fikr na karein ka paigham, track link | | Client |
| S27 | `/track` | Order number + aakhri 4 hindse; nateeja: darja, timer, note, payment ke qadam, "Dobara order karein" | `/api/track` | Static + client |
| S28 | `/my-history` | Rozana scores, streak, mock results, bookmarks, "Mere orders", hadein ki wazahat | localStorage | Static + client |
| S29 | `/how-to-order` | 4 qadam, payment, refund policy ka link | | Static |
| S30-33 | `/about`, `/contact`, `/privacy`, `/terms` | Intent 15.4, 9.10 | | Static |
| S34 | `/404` | Darwazon ke links | | Static |

### 6.3 Admin ki screens (`/admin`, Preact app, sirf phone-first)

| ID | Screen | Is par kya aata hai |
|---|---|---|
| A01 | Login | Password ka khana, ghalti/rok ka paigham |
| A02 | Orders | Din ka khulasa; filter chips; search; order cards ki list |
| A03 | Order card | Number, naam, number, cheezein+tafseel, kul, umar, darja, timer, "WhatsApp khola", "Rabta hua"; buttons Paid/Pending/Complete/Cancel; "Khud rabta karein"; do note ke khane |
| A03a | Paid ka dialog | Hisab shuda wada, badalne ka khana, tasdeeq |
| A03b | Cancel ka dialog | Wajah ka khana (customer ko dikhegi) |
| A04 | Notifications | Naye upar; link; "Parh liya"; "Sab parh liye" |
| A05 | Content | Paste/`.txt` upload; MCQs, Mocks, Notes ki lists (search, filter, edit, chhupana, mitana, `verified`) |
| A06 | Content preview | Mile hue ginti, har cheez ka visitor wala rup, ghaltiyan line number ke sath, "jaanch liye" checkbox, "Sahih hisse save karein" |
| A07 | Jobs | Text/form se job, tasveer lagayen, khuli jobs ki list, "Purani jobs" (Mitayen, Sab purani mita dein) |
| A08 | Settings | Section 5, F10 ke saare khane |
| A09 | Daily pins | Kisi din ke 10 sawal chunna (P-03 manzoor) |
| A10 | Export | Orders ka CSV |

Upar ghanti ka nishan aur tabs (Orders, Notifications, Content, Jobs, Settings) har admin screen par.

### 6.4 Route manifest (machine-readable)

<!-- ROUTES:BEGIN -->
```
PAGE /
PAGE /job-prep
PAGE /vu
PAGE /board
PAGE /board/9th
PAGE /board/10th
PAGE /board/11th
PAGE /board/12th
PAGE /career
PAGE /career/cv
PAGE /apply-service
PAGE /sarkari-services
PAGE /sarkari-services/[scheme]
PAGE /plans
PAGE /past-papers
PAGE /current-affairs
PAGE /mock-series
PAGE /mcqs
PAGE /mcqs/[subject]
PAGE /daily-test
PAGE /mock-tests
PAGE /mock-tests/[slug]
PAGE /notes
PAGE /notes/[slug]
PAGE /jobs
PAGE /jobs/ppsc
PAGE /jobs/fpsc
PAGE /jobs/nts
PAGE /jobs/[slug]
PAGE /track
PAGE /my-history
PAGE /how-to-order
PAGE /about
PAGE /contact
PAGE /privacy
PAGE /terms
PAGE /404
PAGE /admin
ENDPOINT /sitemap.xml
```
<!-- ROUTES:END -->

`/job-prep` Q-01 (Option A) ke manzoor hone se shamil hai.

---

## 7. Data models

### 7.1 Entity relationships (ER)

```
orders 1 ──< order_events      (order_events.order_id → orders.id)
orders 1 ──< notifications     (notifications.order_id → orders.id, NULL ho sakta hai)
orders 1 ──< agent_log         (agent_log.order_id → orders.id, NULL ho sakta hai)
mocks  1 ──< mcqs              (mcqs.mock_id → mocks.id, NULL = sirf bank ka sawal)
jobs   1 ··< orders            (logical: items_json[].jobId, FK nahin; snapshot)
mcqs   1 ··< daily_pins        (logical: mcq_ids_json, FK nahin)
catalog.json (file) ··< orders (logical: items_json[].id, FK nahin; snapshot)

Alag khadi tables: settings, order_counter, rate_limits
```

`──<` = asal foreign key; `··<` = tarkeebi hawala (JSON mein, qeemat/naam ka snapshot taake baad mein catalog badalne se purane order na badlein).

### 7.2 Tables (intent 12.5 ke mutabiq; naye columns "Delta" mein)

Tamam waqt `TEXT` ISO-8601 UTC. `id` jahan `INTEGER` hai wahan `PRIMARY KEY AUTOINCREMENT`.

**orders**

| Column | Type | Constraint | Note |
|---|---|---|---|
| `id` | TEXT | PK | `GVS-2611-0042` |
| `name` | TEXT | NOT NULL | 2 se 60 harf; 90 din baad `''` |
| `phone` | TEXT | NOT NULL | `923XXXXXXXXX`; 90 din baad `''` |
| `phone_last4` | TEXT | NOT NULL | Tracking ke liye; 90 din baad `''` |
| `items_json` | TEXT | NOT NULL | `[{id, name, price, fields:{}, jobId?, jobTitle?, govtFee?, documents?:[]}]` |
| `total` | INTEGER | NOT NULL, ≥ 0 | Rupay |
| `status` | TEXT | NOT NULL, CHECK in (`new`,`paid`,`pending`,`complete`,`cancelled`) | |
| `due_at` | TEXT | NULL | `paid` par bharta hai |
| `whatsapp_opened_at` | TEXT | NULL | |
| `contacted` | INTEGER | NOT NULL DEFAULT 0 | 0/1 |
| `public_note`, `admin_note`, `cancel_reason` | TEXT | NULL | |
| `completed_by` | TEXT | NULL, CHECK in (`admin`,`agent`) | |
| `created_at`, `paid_at`, `completed_at`, `updated_at` | TEXT | `created_at`/`updated_at` NOT NULL | |

**order_events:** `id` INT PK; `order_id` TEXT NOT NULL → `orders.id`; `from_status` TEXT NULL; `to_status` TEXT NOT NULL; `by` TEXT CHECK in (`admin`,`system`,`agent`); `at` TEXT NOT NULL.

**order_counter:** `month` TEXT PK (`2611`); `last_number` INTEGER NOT NULL.

**notifications:** `id` INT PK; `type` TEXT CHECK in (`order_new`,`whatsapp_opened`,`status_changed`,`auto_cancelled`,`low_mcq_bank`); `order_id` TEXT NULL → `orders.id`; `message` TEXT NOT NULL; `created_at` TEXT NOT NULL; `read_at` TEXT NULL.

**settings:** `key` TEXT PK; `value` TEXT NOT NULL (JSON-encoded).

**mcqs:** `id` INT PK; `subject` TEXT NOT NULL; `question` TEXT NOT NULL; `options_json` TEXT NOT NULL (2 se 5 strings); `answer_index` INTEGER NOT NULL CHECK 0..4; `explanation` TEXT NULL; `difficulty` TEXT NULL CHECK in (`Aasan`,`Darmiyana`,`Mushkil`); `as_of_date` TEXT NULL (Current Affairs par zaroori); `verified` INTEGER NOT NULL DEFAULT 0; `mock_id` INTEGER NULL → `mocks.id` ON DELETE SET NULL; `created_at` TEXT NOT NULL.

**mocks:** `id` INT PK; `slug` TEXT NOT NULL UNIQUE; `name` TEXT NOT NULL; `minutes` INTEGER NOT NULL (1 se 300); `summary` TEXT NULL; `visible` INTEGER NOT NULL DEFAULT 1; `created_at` TEXT NOT NULL.

**notes:** `id` INT PK; `slug` TEXT NOT NULL UNIQUE; `title`, `subject` TEXT NOT NULL; `summary` TEXT NULL (≤ 155); `body_md` TEXT NOT NULL; `visible` INTEGER NOT NULL DEFAULT 1; `created_at`, `updated_at` TEXT NOT NULL.

**jobs:** `id` INT PK; `slug` TEXT NOT NULL UNIQUE; `org`, `post` TEXT NOT NULL; `city`, `education` TEXT NULL; `last_date` TEXT NOT NULL (`YYYY-MM-DD`); `official_url` TEXT NOT NULL; `ad_url` TEXT NULL; `image_key` TEXT NULL (R2); `govt_fee` INTEGER NULL; `our_fee` INTEGER NULL (NULL = `default_job_fee`); `apply_service` INTEGER NOT NULL DEFAULT 1; `documents_json`, `steps_json` TEXT NOT NULL DEFAULT `'[]'`; `visible` INTEGER NOT NULL DEFAULT 1; `created_at`, `updated_at` TEXT NOT NULL.

**daily_pins:** `date` TEXT PK (`YYYY-MM-DD`); `mcq_ids_json` TEXT NOT NULL (10 ids).

**agent_log (V2 ke liye, abhi khali):** `id` INT PK; `action` TEXT NOT NULL; `order_id` TEXT NULL → `orders.id`; `at` TEXT NOT NULL.

**rate_limits:** `key` TEXT PK (hash); `window_start` TEXT NOT NULL; `count` INTEGER NOT NULL. Key mein kabhi asal phone/IP nahin, sirf `SHA-256(secret + value)`.

### 7.3 Indexes

Intent ke: `orders(status, created_at)`, `orders(phone)`, `mcqs(subject, verified)`, `jobs(last_date)`, `notifications(read_at, created_at)`.
Zaroori plumbing (neeche Delta mein): unique `slug` (mocks, notes, jobs), `order_events(order_id)`, `mcqs(mock_id)`, `rate_limits(window_start)`.

### 7.4 Delta: intent 12.5 se spec ka farq (sab manzoor: P-03, P-06, P-07, P-12)

| ID | Tabdeeli | Wajah | Agar na manzoor ho |
|---|---|---|---|
| D1 | `daily_pins.source` TEXT (`pin`/`auto`) NOT NULL DEFAULT `'pin'` | Intent ka "pichhle 15 din ke sawal na hon" aur "sab ke liye wohi 10" tabhi mumkin hai jab auto-chune hue din bhi mehfooz hon | Sirf owner ke pin kiye din mehfooz; 15 din ka rule pakka nahin |
| D2 | `deleted_at` TEXT NULL (jobs, notes, mocks) | Intent ka "mitaya gaya URL `410 Gone`": hard delete ke baad pata nahin chalta ke URL kabhi tha | Mitaya gaya URL `404` |
| D3 | `mcqs.q_hash` TEXT + index | "Ek jaisa sawal pehle se hai" ki khabardari; baghair hash ke har sawal par poori table scan (FX-02) | Duplicate ki khabardari nahin |
| D4 | Unique `slug`, `order_events(order_id)`, `mcqs(mock_id)`, `rate_limits(window_start)` index | Sahi chalne aur reads kam rakhne ke liye | Slug takrao ka khatra; reads zyada |

### 7.5 Browser mein data (`localStorage`), intent 11.4

Ek hi key `gvs.v1`, JSON, `v` field ke sath (aage migration ke liye). `cart` alag key `gvs.cart.v1`.

```json
{
  "v": 1,
  "streak": { "count": 5, "lastDate": "2026-11-16" },
  "daily": { "2026-11-16": { "score": 8, "total": 10, "wrongIds": [12, 40] } },
  "mocks": { "ppsc-educator-mock-1": { "score": 18, "total": 25, "bySubject": { "English": [4, 10] }, "at": "2026-11-16T10:00:00Z" } },
  "mockProgress": { "slug": "ppsc-educator-mock-1", "answers": {}, "flagged": [], "remainingMs": 600000, "savedAt": "..." },
  "bookmarks": [12, 40],
  "weakSubjects": { "English": 3 },
  "orders": [ { "id": "GVS-2611-0042", "last4": "5266", "at": "2026-11-16T10:00:00Z" } ]
}
```

Hadein: 200 KB se zyada ho to sab se purani entries chhant dein; `orders` ≤ 20; `bookmarks` ≤ 500. Tareekhein Asia/Karachi ke hisab se.

### 7.6 Migration ka usool

`migrations/0001_init.sql` mein upar ke saare tables aur indexes (D1-D4 sirf manzoori ke baad). Aainda har tabdeeli nayi file `0002_...sql`. **Lagoo ho chuki migration file kabhi edit nahin hoti.** Production par migration owner ki manzoori se, aur us se pehle backup (intent 12.9).

`0001` ke sath seed: settings ki shuru ki values (intent 12.4).

---

## 8. API aur server actions

### 8.1 Aam usool

- Format: JSON. Kamyabi `{ "ok": true, ... }`. Nakami `{ "ok": false, "error": { "code": "...", "message": "..." } }`; `message` Roman Urdu mein, visitor ko dikhane ke qabil.
- Har input server par Valibot se check; **SQL sirf parameterized (`?`) statements**; kahin string jor kar SQL nahin.
- Har endpoint ka body size cap: public ≤ 16 KB, admin content import ≤ 600 KB, tasveer ≤ 150 KB.
- HTTP codes: 200, 400 (jaanch), 401 (admin login), 403 (Origin ghalat), 404, 410, 413, 429 (had), 503 (D1 hadd/kharabi).
- Har `POST` par `Origin` header sirf apni site ka; admin par `Content-Type: application/json`.
- `GET /api/*` jis mein koi bhi raaz ho, `Cache-Control: no-store`.

### 8.2 Public endpoints

| ID | Method, path | Kaam | Ahem usool |
|---|---|---|---|
| E01 | `GET /api/settings` | WhatsApp number, JazzCash/Easypaisa, kaam ke auqaat, elaan, `orders_open`, mazameen | Koi raaz nahin. `s-maxage=60` |
| E02 | `POST /api/orders` | Naya order | Body: `name`, `phone`, `items:[{id, fields, jobId?}]`, `turnstileToken` (P-09). Jawab: `id`, `total`, `whatsappUrl`, `trackUrl`. Section 8.5 |
| E03 | `POST /api/orders/:id/whatsapp-opened` | "WhatsApp par bhejein" ka record | Body mein `last4`; sirf pehli dafa; notification |
| E04 | `GET /api/track?id=&last4=` | Order ka darja | Ghalat par ek hi "Order nahin mila"; phone nahin; `no-store`; rate limit |
| E05 | `GET /api/daily-test` | Aaj ke 10 sawal (jawab ke sath) | `s-maxage=300`; sirf `verified` |
| E06 | `GET /api/mcqs?subject=&offset=` | Practice ka agla set (10) | Sirf `verified`; `offset` ≤ 10,000 |
| E07 | `GET /api/jobs/latest` | Home ke liye 3 taza khuli jobs | **P-05 (manzoor)**; `s-maxage=300` |
| E08 | `GET /sitemap.xml` | Static + on-demand URLs | On-demand, `s-maxage=3600` |

Jobs/notes/mocks/mcqs ke pages SSR hain (alag API nahin).

### 8.3 Admin endpoints (sab par session cookie; baghair us ke 401)

| ID | Method, path | Kaam |
|---|---|---|
| E10 | `POST /api/admin/login`, `POST /api/admin/logout` | Password ki jaanch; cookie lagana/hatana |
| E11 | `GET /api/admin/orders?status=&q=&waOpened=&offset=` | Orders ki list + din ka khulasa (50 ek page) |
| E12 | `POST /api/admin/orders/:id/status` | Body: `status?`, `dueAt?`, `cancelReason?`. Darja badlo ya sirf wada badlo (A-08). `paid` par `due_at`; event + notification |
| E13 | `POST /api/admin/orders/:id/note` | Public ya andaruni note |
| E14 | `POST /api/admin/orders/:id/contacted` | "Rabta hua" on/off |
| E15 | `GET /api/admin/notifications?since=&unread=`, `POST /api/admin/notifications/read` | List aur parh liya (ids ya sab) |
| E16 | `POST /api/admin/content/preview` | Text bhejo, parser ka nateeja + ghaltiyan (kuch save nahin). **P-02 manzoor: yeh endpoint ab nahin banega**; preview browser mein `parser.ts` se chalta hai |
| E17 | `POST /api/admin/content/import` | Sahih hissa save (chhote tukron mein, 8.5) |
| E18 | `GET/POST /api/admin/mcqs`, `DELETE /api/admin/mcqs/:id` | Dekhna, banana/badalna (`verified` samet), mitana |
| E19 | `GET/POST /api/admin/mocks`, `DELETE /api/admin/mocks/:id` | Dekhna, chhupana, mitana |
| E20 | `GET/POST /api/admin/notes`, `DELETE /api/admin/notes/:id` | Dekhna, badalna, chhupana, mitana |
| E21 | `GET/POST /api/admin/jobs`, `DELETE /api/admin/jobs/:id`, `POST /api/admin/jobs/delete-old` | Jobs; "Sab purani mita dein" (tasdeeq ke sath) |
| E22 | `POST /api/admin/jobs/:id/image` | Tasveer R2 mein; 150 KB se bari rad; qism ki jaanch |
| E23 | `POST /api/admin/daily-pins`, `DELETE /api/admin/daily-pins/:date` | Kisi din ke sawal pin (P-03 manzoor) |
| E24 | `GET/POST /api/admin/settings` | Settings, har value ki jaanch ke sath |
| E25 | `GET /api/admin/export` | Orders ka CSV |

### 8.4 Agent endpoints (Version 2; Version 1 mein `agent_enabled=false` par 404)

| ID | Method, path | Kaam |
|---|---|---|
| E30 | `GET /api/agent/orders?status=paid` | Paid, na-mukammal orders: id, cheezein, tafseel, `fileHint`, naam, number |
| E31 | `GET /api/agent/notifications?since=` | Naye notifications |
| E32 | `POST /api/agent/orders/:id/complete` | Complete (`completed_by=agent`), note ke sath |
| E33 | `POST /api/agent/orders/:id/note` | Admin note |

Sab par `Authorization: Bearer <AGENT_API_KEY>`; sirf hash database mein; agent `paid` nahin kar sakta.

### 8.5 Server actions (HTTP ke bina ki zimmedariyan)

| ID | Action | Tafseel |
|---|---|---|
| SA1 | **Order number** | Mahina `YYMM` (Asia/Karachi). Ek atomic batch: `INSERT INTO order_counter(month,last_number) VALUES(?,1) ON CONFLICT(month) DO UPDATE SET last_number=last_number+1`, phir order `id` usi counter se `printf('%04d')` ke sath insert. Do orders ka ek number kabhi nahin |
| SA2 | **Qeemat ka hisab** | `catalog.json` se; `job-apply` ke liye job ki `our_fee` ya `default_job_fee`; `total` = jama. Browser ki qeemat ignore |
| SA3 | **WhatsApp URL** | `https://wa.me/<923...>?text=<encodeURIComponent(message)>`, message intent 9.3 ka template, `settings.whatsapp_number` se |
| SA4 | **Wada (`due_at`)** | `timer.ts` `addWorkingMinutes(paid_at, max(minutes), workStart, workEnd, 'Asia/Karachi')`; minutes = settings override, warna catalog, warna `default_delivery_minutes` |
| SA5 | **Rate limit** | Table 9.3. `rate_limits` mein hash key; D1 ki writes bachane ke liye jahan mumkin ho pehle read |
| SA6 | **Notification banana** | Har order create, whatsapp-opened, status badalna, auto-cancel, `low_mcq_bank` |
| SA7 | **Order event** | Har darje ki tabdeeli `order_events` mein (`by`: admin/system/agent) |
| SA8 | **Rozana 10 sawal** | Sirf `verified`; mazameen mila jula; pichhle 15 din ke nahin; seed = Pakistan ki tareekh; pin ho to wohi. Natija `daily_pins` mein (D1) |
| SA9 | **Maintenance** | F24 ke 5 kaam; **Cron Trigger** har 15 minute (`scheduled` handler, `wrangler` mein `triggers.crons`), request par nahin (P-04 manzoor) |
| SA10 | **Cache saaf** | Content badalne par mutalliqa URLs ke liye `caches.default.delete`; best-effort |
| SA11 | **Sitemap** | Static URLs (`seo.json`) + `jobs`/`notes`/`mocks` (khuli, `visible`, `deleted_at IS NULL`) + mazameen |
| SA12 | **Parser** | `parser.ts` (shared): text → items + ghaltiyan (line number), section 8.7 |
| SA13 | **CSV export** | Formula-injection se bachao (F28-AC2) |
| SA14 | **Image cleanup** | R2 se tasveer mitana jab job mite ya 30 din guzren |
| SA15 | **Data purge** | 90 din baad `name`, `phone`, `phone_last4` khali |

### 8.6 Order ke darjon ki ijazat shuda tabdeeliyan (admin)

| Se → Tak | Ijazat | Note |
|---|---|---|
| `new` → `paid` | Haan | `paid_at`, `due_at` set |
| `paid` → `pending` | Haan | |
| `paid` → `complete` | Haan | Seedha |
| `pending` → `complete` | Haan | `completed_at` set |
| `new`/`paid`/`pending` → `cancelled` | Haan | `cancel_reason` zaroori |
| `complete` → `cancelled` | **Nahin** | Intent 9.4 |
| Ek darja peeche (maslan `complete` → `pending`, `paid` → `new`) | Haan (ghalti theek karne ke liye) | `complete` se peeche jane par `completed_at` saaf; `paid` se `new` par `paid_at`/`due_at` saaf |
| Baqi sab | Nahin | |

Sirf owner/admin `paid` kar sakta hai; agent (V2) kabhi nahin.

### 8.7 Content text ka parser (summary; format intent 10.2 se 10.6)

- Input: UTF-8 text. Output: `{ items: [...], errors: [{line, message}] }`.
- Items ki aqsam: `MCQ`, `MOCK` (aur us ke andar `MCQ`), `NOTE`, `JOB`.
- Har cheez ka validation:

| Cheez | Zaroori | Had |
|---|---|---|
| MCQ | `Mazmoon` (list mein se), `Sawal`, 2 se 5 options, ek par `*` | Sawal ≤ 500 harf; option ≤ 200; `Tashreeh` ≤ 1000 |
| Current Affairs MCQ | `Tareekh: YYYY-MM-DD` bhi | |
| MOCK | `Naam`, `Waqt` (1 se 300 minute), kam az kam 1 MCQ | ≤ 100 sawal; `Khulasa` ≤ 300 |
| NOTE | `Unwan`, `Mazmoon`, `Khulasa`, `Matn` | `Khulasa` ≤ 155; `Matn` ≤ 20,000 harf |
| JOB | `Idara`, `Post`, `Akhri tareekh`, `Official link` | `Documents` ≤ 20 lines, `Tareeqa` ≤ 20 qadam; links `https://` |

- Ek paste mein ≤ 500 cheezein; ziada par error "500 se zyada cheezein; hisson mein bhejein."
- Error ka paigham line number ke sath, Roman Urdu mein.
- Import ke waqt client chhote tukron (sawal 25-25) mein `POST` karta hai (progress bar), taake free tier ki CPU/query hadein na tootein (FX-03). Tukre ka size tajarbe se tay hoga.

### 8.8 API manifest (machine-readable)

<!-- API:BEGIN -->
```
API GET /api/settings
API POST /api/orders
API POST /api/orders/[id]/whatsapp-opened
API GET /api/track
API GET /api/daily-test
API GET /api/mcqs
API GET /api/jobs/latest
API POST /api/admin/login
API POST /api/admin/logout
API GET /api/admin/orders
API POST /api/admin/orders/[id]/status
API POST /api/admin/orders/[id]/note
API POST /api/admin/orders/[id]/contacted
API GET /api/admin/notifications
API POST /api/admin/notifications/read
API POST /api/admin/content/import
API GET /api/admin/mcqs
API POST /api/admin/mcqs
API DELETE /api/admin/mcqs/[id]
API GET /api/admin/mocks
API POST /api/admin/mocks
API DELETE /api/admin/mocks/[id]
API GET /api/admin/notes
API POST /api/admin/notes
API DELETE /api/admin/notes/[id]
API GET /api/admin/jobs
API POST /api/admin/jobs
API DELETE /api/admin/jobs/[id]
API POST /api/admin/jobs/delete-old
API POST /api/admin/jobs/[id]/image
API POST /api/admin/daily-pins
API DELETE /api/admin/daily-pins/[date]
API GET /api/admin/settings
API POST /api/admin/settings
API GET /api/admin/export
API GET /api/agent/orders
API GET /api/agent/notifications
API POST /api/agent/orders/[id]/complete
API POST /api/agent/orders/[id]/note
```
<!-- API:END -->

**Manifest ki haalat:** P-03 (daily-pins) aur P-05 (`jobs/latest`) manzoor hone se shamil hain. `E16 preview` P-02 ki wajah se hata diya gaya (preview browser mein chalta hai); `E17 import` har tukre ko `parser.ts` se dobara jaanchta hai.

---

## 9. Non-functional zaroorat

### 9.1 Raftar aur wazan (budgets; har budget ka test/measure hai)

| Naap | Hadd | Kaise naapein |
|---|---|---|
| Click/tap par feedback | **< 100 ms** (quiz ka jawab, cart, buttons: bina network) | Haath se + Lighthouse INP |
| LCP (mobile, slow 4G) | < 2.5 s | Lighthouse |
| INP | < 200 ms | Lighthouse/CrUX |
| CLS | < 0.1 (ads samet) | Lighthouse |
| Static page TTFB | < 200 ms (edge) | Lighthouse/WebPageTest |
| On-demand page (cache hit/miss) | p95 < 150 ms / < 500 ms | Workers logs |
| API p95 | < 300 ms (reads) / < 600 ms (writes) | Workers logs |
| Home par JavaScript | ≤ 100 KB gzip kul | Build report |
| Quiz/mock page ka island | ≤ 60 KB gzip | Build report |
| Admin bundle | ≤ 150 KB gzip, sirf `/admin` par load | Build report |
| CSS | ≤ 30 KB gzip har page | Build report |
| Page ka kul wazan | < 500 KB | Lighthouse |
| Har tasveer | WebP, ≤ 100 KB (namoona), lazy | Build check |
| Lighthouse (mobile) | Performance, SEO, Accessibility, Best Practices har ek ≥ 90 | Lighthouse |

**Raftar ke tareeqe (lazmi):** islands sirf wahan (`client:visible`/`client:idle`); prefetch `tap`; font system/ek subset; critical CSS inline; analytics deferred; koi `localStorage` parhna render ko na roke (pehle HTML, phir history se personalize); quiz/mock ka sara data ek dafa aaye, phir sab kuch memory mein (network ke baghair).

### 9.2 Security

| Hissa | Zaroorat |
|---|---|
| Qeemat | Hamesha server hisab kare (SA2) |
| Input | Har input server par Valibot se; naam, phone, course code ka pattern, cheezon ki ginti, field lengths (9.4) |
| SQL | Sirf prepared statements (`?`); `LIKE` search ke wildcard escape |
| Output (XSS) | Customer ka likha, admin ka content, job/notes ka text hamesha escape. Preact default escape; `dangerouslySetInnerHTML` sirf `markdown.ts` ke natije par, jo sirf `h2, h3, p, ul, li, strong, em, a` banata hai, links sirf `https://`, `rel="noopener nofollow"` |
| Admin cookie | `HttpOnly; Secure; SameSite=Strict; Path=/`, signed (HMAC-SHA256, `SESSION_SECRET`), 7 din. Logout par saaf; asal revoke ke liye `SESSION_SECRET` badlein |
| Password | `ADMIN_PASSWORD` secret; constant-time compare; kam az kam 12 harf (owner ki zimmedari, Settings par likha) |
| CSRF | `SameSite=Strict` + `Origin` check + sirf `application/json` |
| Headers | `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera/mic/geo band), `frame-ancestors 'none'`, aur **CSP** jo sirf apni site, analytics aur Turnstile (`challenges.cloudflare.com`) ke domains ko ijazat de (Astro ki CSP support istemal karein; jahan inline script chahiye wahan hash, `unsafe-inline` nahin) |
| Secrets | `ADMIN_PASSWORD`, `SESSION_SECRET`, `AGENT_API_KEY`, `TURNSTILE_SECRET` Cloudflare mein; `.env*` `.gitignore` mein; logs mein kabhi nahin |
| Admin ke samne Access | **Cloudflare Access** (P-08): `/admin` aur `/api/admin/*` par email OTP; password phir bhi lazmi (do tahein). Agent endpoints (V2) isse bahar, bearer key se |
| Spam | **Turnstile** (P-09) order form par, server par `siteverify`; `TURNSTILE_SECRET` Cloudflare secret; fail hone par F05 rasta |
| Upload | Sirf `image/webp`, `image/jpeg`, `image/png`; server par size (≤ 150 KB) aur magic bytes ki jaanch; file ka naam server banata hai (user ka naam nahin) |
| CSV | Formula injection se bachao (F28-AC2) |
| Track | Generic "Order nahin mila"; `no-store`; rate limit (9.3) |
| Agent key | Sirf hash; Version 1 mein 404 |
| Dependencies | Kam se kam; `npm audit` har deploy se pehle; lock file commit |
| Logs | `console.log` mein naam, phone, password, cookie kabhi nahin |

### 9.3 Rate limits (A-04: shuru ki values, tajarbe se badli ja sakti hain)

| Amal | Key | Hadd | Muddat | Hadd par |
|---|---|---|---|---|
| Naya order | Phone ka hash | **5** (intent 7.4) | 1 ghanta | 429: "Is number se bohat orders aa chuke hain, thori der baad koshish karein." |
| Naya order | IP ka hash | 20 | 1 ghanta | 429 |
| Track: ghalat koshish | Order id + IP hash | 5 | 15 minute | 429 "Thori der baad koshish karein" |
| Track: bohat requests | IP hash | 30 | 10 minute | 429 |
| Admin login: ghalat | IP hash | **5** (intent 9.6) | 15 minute ki rok | 429, bachay hue minute ke sath |
| Content import | Admin session | Hadd nahin (sirf admin) | | |

**D1 writes bachane ka usool:** kamyab track requests aur normal reads D1 mein counter nahin barhate; sirf **ghalat koshishein**, order creation aur login ki ghaltiyan likhi jati hain. Aam IP-wise nigrani ke liye Cloudflare ki free rate-limit rule bhi lagayi ja sakti hai (owner ki ijazat se).

### 9.4 File, size aur length ki hadein

| Cheez | Hadd | Kahan lagu |
|---|---|---|
| Job ki tasveer | **≤ 150 KB** (server par hard); lambi side ≤ 1200 px; WebP | Browser resize + `E22` |
| Namoone ki tasveer (static) | ≤ 100 KB, WebP | Build check |
| Share/OG image | 1200x630, ≤ 100 KB | Build check |
| `.txt` upload | ≤ 512 KB, UTF-8 | Content tab |
| Content paste/import body | ≤ 600 KB, ≤ 500 cheezein | Content tab + `E17` |
| MCQ | Sawal ≤ 500 harf, option ≤ 200, tashreeh ≤ 1000, 2 se 5 options | Parser |
| Mock | ≤ 100 sawal, `Waqt` 1 se 300 minute | Parser |
| Note | `Matn` ≤ 20,000 harf, `Khulasa` ≤ 155 | Parser |
| Job | Documents ≤ 20, qadam ≤ 20 | Parser |
| Order | Cheezein ≤ 10, naam 2 se 60, har field ≤ 100 harf, `items_json` ≤ 8 KB | `E02` |
| Notes (order par) | Public/andaruni note ≤ 500 harf, cancel wajah ≤ 200 | `E12`, `E13` |
| Elaan | ≤ 160 harf | Settings |
| Public request body | ≤ 16 KB | Sab public POST |
| `localStorage` | ≤ 200 KB (purani entries chhant dein) | `history.ts` |
| D1 database | Free 500 MB; yeh text data barson mein bhi nahin bharta | Nigrani |

### 9.5 Privacy aur data

- Server par sirf naam aur WhatsApp number; analytics mein kabhi nahin (F23-AC2).
- `complete`/`cancelled` ke 90 din baad naam/phone/last4 saaf (SA15).
- CNIC aur documents portal par kabhi nahin; sirf WhatsApp par (intent 28.5).
- CSV export mein phone numbers hote hain: owner ke Google Drive mein 2-step verification zaroori (FL-05).
- Privacy page mein saaf likha ho: kya jama hota hai, kitni der, kis liye.

### 9.6 Dastiyabi aur nigrani

- **Free-tier ki nigrani:** owner hafte mein ek dafa Cloudflare dashboard par Workers requests aur D1 reads/writes dekhe (section 4.3). 70% se oopar jaye to Workers Paid par jane ka faisla (FX-01).
- D1 ya Worker ki kharabi par saaf 503 + F05 ka WhatsApp rasta.
- `Workers Logs` on; unmein koi personal data nahin (9.2).
- Status page: Cloudflare ka (intent 22.4).
- Backup: intent 12.10 (Time Travel + hafta war CSV aur DB export).

### 9.7 Accessibility

Lighthouse Accessibility ≥ 90; rang ka farq WCAG AA; sahih/ghalat sirf rang se nahin, **nishan se bhi**; har form field ka label; keyboard se chalne ke qabil; `prefers-reduced-motion`; button ≥ 44px; `lang="en"`.

### 9.8 Devices

Android Chrome aur Samsung Internet (pichhle 3 saal), iPhone Safari (iOS 15+), desktop Chrome/Edge/Firefox; 360px se 1440px. Kamzor internet: static content bina JS ke parha ja sake; quiz aur cart JS se.

---

## 10. Test ka mansooba

### 10.1 Khudkar tests (`npm run test`)

| Test | Kya jaanche | Guard |
|---|---|---|
| `timer.test.ts` | Intent 7.3 ki teeno misalein; ghalat/barabar `workEnd`; do din par phailne wale waqt | Golden |
| `parser.test.ts` | Har format (MCQ/MOCK/NOTE/JOB); har ghalti line number ke sath; hadein (9.4) | |
| `phone.test.ts` | `03...`, `+92...`, dashes; 923 shakal; last4 | |
| `price.test.ts` | Total, job apply fee, `default_job_fee` | |
| `catalog.golden.test.ts` | Saari qeematein/ids intent 7.2 ke barabar | **Golden** |
| `settings.golden.test.ts` | Seed ki values: number `03404905266`, 09:00 se 22:00, 120 minute, 48 ghante, 300 | **Golden** |
| `banned-words.test.ts` | "guarantee", "100%", "pakki naukri", "sab se behtareen" kisi page/data mein nahin | |
| `markdown.test.ts` | Script/HTML escape; sirf ijazat wale tags; `javascript:` link rad | |
| `csv.test.ts` | Formula injection | |
| `orders.test.ts` (D1) | Order banta hai; number unique; server qeemat; rate limit; job band par rad | |
| `status.test.ts` (D1) | Section 8.6 ki har ijazat/rok; event + notification | |
| `track.test.ts` (D1) | Ghalat last4 par generic jawab; phone nahin; 5 ghalat par rok | |
| `admin-auth.test.ts` | 401 baghair cookie; 5 ghalat par rok; cookie flags | |
| `maintenance.test.ts` (D1) | F24 ke 5 kaam idempotent | |
| `agent.test.ts` | `agent_enabled=false` par 404; `paid` nahin kar sakta | |
| `queries.cost.test.ts` | Har list query `meta.rows_read` ki hadd ke andar (index istemal) | Free-tier guard |
| `no-pii-analytics.test.ts` | Events mein naam/phone/order number nahin | |
| `scope.test` (`check-scope`) | Code ke pages/APIs spec ki manifest se milte hain | **Scope guard** |

### 10.2 Haath ki jaanch

Intent section 20 ki poori checklist preview link par (har item ko neeche ki AC IDs se milaya jata hai: order/track = F04 se F06, admin = F07 se F12, visitor = F13 se F17, SEO/ads = F21 se F23, qanooni = F25, V2 tayyari = F27).

---

## 11. Build ki tarteeb aur "mukammal" ki shart

Intent section 19 ke 19 qadam **bina tabdeeli** ke. Har qadam ke sath: kin features ka hissa, aur "mukammal" ki shart. **Ek waqt mein ek qadam**; qadam ke aakhir mein owner ki "haan" ke baghair agla shuru nahin (section 13.2).

| # | Qadam | Features | Mukammal ki shart |
|---|---|---|---|
| 0 | GitHub repo, `CLAUDE.md`, `.claude/settings.json`, `check-scope`, golden tests, `PROGRESS.md`, `design.md` | Guardrails (13) | `npm run check:scope` aur golden tests chalte hain; owner ne protected files confirm kiye |
| 1 | Astro, Workers adapter, Tailwind, folders, Base layout, Header, Footer | Shared | `npm run build` aur `dev` chalte hain; bundle report maujood |
| 2 | `catalog.json`, `seo.json`, ProductCard, AdSlot, FAQ | F02, F22 | `catalog.golden` pass |
| 3 | Home aur 4 darwazon ke static pages | F01, F02 | S01, S02, S03 se S14 browse hote hain |
| 4 | Cart aur order form (bina backend) | F03, F04 (UI) | F03-AC1 se AC7 |
| 5 | D1, `0001_init.sql`, `/api/settings`, `/api/orders`, `whatsapp-opened`, notifications, Turnstile ki jaanch (P-09) | F04, F05 | `orders.test`; local D1 par poora rasta |
| 6 | `timer.ts` + tests, `/api/track`, `/track` | F06 | `timer.test`, `track.test`; 7.3 ki misalein |
| 7 | Admin login, Orders, Notifications | F07, F08, F09 | `admin-auth.test`, `status.test` |
| 8 | Admin Settings | F10 | F10-AC1 se AC7 |
| 9 | `parser.ts` + tests, Content tab | F11, F12 | `parser.test`; preview/import chalte hain |
| 10 | Quiz components, daily-test, mcqs, `history.ts`, my-history | F13, F14, F17 | F13-AC3 par < 100 ms |
| 11 | Mock test UI | F15 | F15-AC1 se AC9 |
| 12 | Notes | F16 | `markdown.test` |
| 13 | Jobs tab, jobs pages, job se apply | F18, F19, F20 | F18-AC4 (khuli/band), F19-AC4 (150 KB) |
| 14 | Baqi static pages | F25, F02 | Saari pages 404 ke baghair |
| 15 | SEO, house ads, analytics, manifest | F21, F22, F23, F26 | Rich Results Test; `no-pii-analytics` |
| 16 | V2 ki tayyari (band) | F27 | `agent.test` |
| 17 | Preview par intent 20 ki poori jaanch; content daalna | Sab | Lighthouse ≥ 90; checklist poori |
| 18 | Production deploy, domain, Cloudflare Access (P-08), Turnstile keys (P-09), Search Console, pehla backup | F28 | Owner ki manzoori (section 13.3) |

F24 (maintenance) qadam 5 se 7 ke beech, jab orders/notifications tayyar hon (Cron Trigger, P-04 manzoor).

**`PROGRESS.md` ka namoona (P-10):**

```md
# Progress (sirf tick; tafseel spec.md section 11 mein)
- [ ] 0 Repo, CLAUDE.md, settings, check-scope, golden tests, design.md
- [ ] 1 Astro + Workers + Tailwind + layout
- [ ] 2 catalog, seo, components
- [ ] 3 Home, /job-prep, darwazon ke static pages
- [ ] 4 Cart aur order form
- [ ] 5 D1, orders API, notifications, Turnstile
- [ ] 6 timer, track
- [ ] 7 Admin login, Orders, Notifications
- [ ] 8 Admin Settings
- [ ] 9 parser, Content tab
- [ ] 10 Daily test, practice, history
- [ ] 11 Mock tests
- [ ] 12 Notes
- [ ] 13 Jobs
- [ ] 14 Baqi static pages
- [ ] 15 SEO, ads, analytics, manifest
- [ ] 16 V2 tayyari (band)
- [ ] 17 Preview par poori jaanch, content
- [ ] 18 Production deploy, Access, backup
```

---

## 12. Flags

Yahan sirf wo cheezein hain jo **khatarnak, mehngi ya gair zaroori** lagi. Har flag ke sath: kya, kyun, spec ne kya kiya, aur owner ka kaam. "Ijazat" wale flags section 14 ke proposals se jure hain.

### 12.1 Khatarnak (security, data, bharosa)

| ID | Kya | Kyun khatarnak | Spec ka intezam | Baqi khatra / owner ka kaam |
|---|---|---|---|---|
| FL-01 | Order track: `GVS-YYMM-NNNN` ek ke baad ek aata hai (andaza lagana asaan) aur sirf 4 hindse (10,000 imkan) | Koi bhi order ka status dekhne ki koshish kar sakta hai | Generic "Order nahin mila", 5 ghalat par 15 minute rok (order id + IP), phone kabhi wapas nahin, `no-store` (F06) | Sirf status/timer dikhta hai, phone/naam nahin. Qabil-e-qabool |
| FL-02 | Admin: ek hi password, 2-step verification nahin; lockout sirf IP par (aksar mobile internet par bohat se log ek IP share karte hain) | Password guess ho to saare orders ka data khulta hai | Mazboot password (12+ harf), 5 ghalat par rok, signed cookie (F07) | **P-08 manzoor:** Cloudflare Access Qadam 18 par (F07-AC6). Password kisi ke sath share na karein |
| FL-03 | Free tier ki **hard hadein**: D1 queries hadd par **fail** (1 Sept 2026 se), Workers 100,000 requests/din | Site ka database wala hissa ruk jaye ga; **orders save nahin honge** | F05 ka WhatsApp seedha rasta; zyada pages static; caching; nigrani (9.6) | Hafta war usage dekhein; 70% par Workers Paid ($5/mahina) ka faisla |
| FL-04 | Cache saaf karna sirf usi data-center mein hota hai | Galat MCQ "chhupane" ke baad bhi kuch visitors ko 5 minute tak dikh sakta hai | TTL chhota (300 s; daily-test par bhi 300 s) | Zaroorat ho to aakhri lamha: TTL 60 s kar dein (Workers requests barhen ge) |
| FL-05 | Weekly CSV export (naam+phone) owner ke Google Drive mein | Drive hack ho to customers ke numbers leak | CSV mein formula-injection se bachao | Google account par 2-step verification; Drive file kisi se share na karein; purane exports mitayein |
| FL-06 | Intent ka "alag cron nahin, har `GET` par chhote kaam" (12.6) | Har request par extra queries (kharcha), do requests ek hi kaam do dafa kar sakti hain, aur 10 ms CPU ki hadd mein R2 delete jaise kaam | Throttle (10 minute) aur idempotent kaam (F24) | **P-04:** Cloudflare Cron Trigger (free) behtar |
| FL-07 | Content import mein ek "jaanch liye" checkbox poori paste par | 500 sawal ek tick se `verified` ho sakte hain (ghalat jawab = aitmad ka nuqsan) | Preview mein har sawal; ghalti wale save nahin | AI se bane sawal chhote hisson (jaise 25-50) mein check karke daalein (owner ki zimmedari, intent 10.1) |
| FL-08 | `/track?id=...` ka URL analytics (GA4) mein `page_location` ke tor par chala jata hai | Order number analytics mein pohanch jaye ga, jo intent 18 ke khilaf hai | `analytics.ts` `/track` ka query hata kar bheje (F23-AC4) | Test (`no-pii-analytics`) |
| FL-09 | Claude Code ka production par ghalti se deploy/migration/secrets/files mitana | Live site ya data ka nuqsan | Section 13: deny rules, loop, zero-trust list | Owner khud `main` merge aur migration chalaye |
| FL-10 | Job tasveeron ke liye R2 custom domain domain ke Cloudflare DNS par hone ki shart rakhta hai (`.pk` registrar se nameserver badalna tasdeeq karein) | Domain na ho to tasveerein Worker se guzrengi (har view = 1 request) | Dev mein `/img/*` Worker route; production mein `img.<domain>` (P-11) | Domain ka intezam (Q-03) |
| FL-11 | Adapter v13 ne Pages support hata diya (intent mein Pages) | Purane tareeqe par scaffold karne se build toot sakta hai | **P-01 (manzoor)**: Workers par scaffold | Sirf Workers ke qawaid par chalna |
| FL-12 | Cloudflare Access (P-08) sirf wahan hifazat deta hai jahan policy lagi ho | Agar sirf `/admin` par lage aur `/api/admin/*` par nahin, to API seedha khuli reh jaye gi; aur agent endpoints (V2) Access ke andar band ho jayenge | F07-AC6: dono paths par policy; agent endpoints bahar | Qadam 18 par policy ki jaanch (bina login ke `/api/admin/orders` 401/Access page de) |
| FL-13 | Turnstile ek bahari service par nirbhar hai (P-09) | Uski kharabi ya script ka load na hona order rok sakta hai | Fail hone par F05 ka seedha WhatsApp rasta; script sirf order form par lazy-load | Aam din par ek test order |

### 12.2 Mehnge (paisa, quota, waqt)

| ID | Kya | Kharcha | Spec ka intezam | Owner ka kaam |
|---|---|---|---|---|
| FX-01 | Har on-demand page aur har API call = 1 Workers request (free: 100,000/din) | 20,000 visitors/din ke aas paas free tier ruk sakti hai | Static default; Worker cache; `settings` 10 minute client cache; track polling chhupe tab par band; `daily-test` cache | Usage dekhein; zaroorat par Paid plan |
| FX-02 | D1 reads/writes (free: 5M reads, 100K writes/din) | `rate_limits` ki har likhai, "duplicate sawal" scan, bina index queries, `OFFSET` pages, har request par maintenance | Index; D3 hash; sirf ghalat koshishon par counter; throttle; `queries.cost.test` | Naye features ke sath query ka kharcha dekhein |
| FX-03 | Free plan par har request ka CPU sirf **10 ms** | 500 sawal ka parse, bara CSV, bara mock ka SSR, sitemap `Error 1102` de sakte hain | Parse browser mein (P-02), import 25-25 ke tukron mein, sitemap cache, CSV export page-wise, mock ≤ 100 sawal | Bara kaam chhote hisson mein |
| FX-04 | GA4 ka script | Wazan LCP/JS budget kha sakta hai (andaza: kai dozen KB) | Deferred load lazmi; Cloudflare Web Analytics sasta rasta tha (events nahin) | GA4 chuna gaya (Q-02) |
| FX-05 | Launch ka content: 150 verified MCQs, 2-3 mocks, 5-10 notes, 5+ jobs, har pack ka namoona, ~25 static pages par 300+ alfaz | Sab se bara kharcha **owner ka waqt** hai, paise ka nahin | Qadam 17 par; filler/faltu content nahin | Content ka mansooba pehle se |
| FX-06 | Light **aur** dark theme dono | Design aur jaanch dugni | Sirf CSS variables (alag stylesheet nahin) | design.md mein pehle se tay |
| FX-07 | Workers Paid ($5/mahina) agar hadein paar hon | Haqeeqi kharcha | Section 4.2 | Faisla owner ka |

### 12.3 Gair zaroori (is size/stage ke liye)

| ID | Kya | Faisla |
|---|---|---|
| FU-01 | ORM (Prisma/Drizzle), Redux/state library, UI kit (MUI), Storybook, Playwright | **Nahin.** Raw SQL ek `db.ts` mein; Vitest kaafi |
| FU-02 | Service worker / offline mode, push notifications (visitor ke liye) | **Nahin** (intent scope se bahar) |
| FU-03 | WebSocket/Durable Objects/real-time | **Nahin.** 60 second ka polling kaafi |
| FU-04 | Bhaari animation (Lottie, confetti library, Framer Motion) "shabash" ke liye | **Nahin.** Sirf chhota CSS asar |
| FU-05 | Do analytics tools ek sath | **Nahin.** Ek tool |
| FU-06 | Version 2 ki tayyari (agent endpoints, `agent_log`, `fileHint`) abhi bana lena | Intent ne tay kiya, is liye **rakha** hai, lekin bilkul chhota; gair istemal code ki hifazat 404 se. Owner chahe to V2 shuru hone tak mo'akhar kar sakta hai |
| FU-07 | `/jobs/ppsc`, `/jobs/fpsc`, `/jobs/nts` ke pages | Intent mein hain, lekin **sirf asal content** (300+ alfaz) ke sath; filler se SEO ko nuqsan |
| FU-08 | Daily pins ki alag admin screen (A09) | P-03 manzoor hone se shamil (A09) |

---

## 13. Claude Code ke liye hifazati "loops" (VS Code mein)

Maqsad: Claude Code `intent.md` ke scope se bahar na jaye, aapki files ko na chhere, aur har qadam aap ki nigrani mein ho. Teen tah ki hifazat hai: **(1) likhi hui hidayat, (2) mashini rok (permissions), (3) khudkar jaanch (tests aur scope check).**

### 13.1 Mehfooz files

| File/folder | Qaida | Kaise lagu |
|---|---|---|
| `intent.md` | **Kabhi edit nahin** | `deny` rule |
| `spec.md`, `design.md` | Sirf owner ki ijazat se | `ask` rule |
| `CLAUDE.md`, `.claude/settings.json` | Sirf owner ki ijazat se | `ask` rule |
| `migrations/*.sql` jo lagoo ho chuki | Kabhi edit nahin; sirf nayi file | `ask` + review |
| `src/data/catalog.json` | Qeematein/ids sirf owner ki ijazat se | `ask` + golden test |
| `tests/golden/*` | Test ko kamzor karna mana | `ask` rule |
| `.env*`, secrets | Parhna/likhna mana | `deny` |
| `package.json`, lock file | Nayi dependency sirf allowlist (13.6) ya ijazat se | `ask` + `check:scope` |
| `public/ads.txt` | Khali rahe (AdSense tak) | Review |
| `PROGRESS.md` | Sirf qadam ka tick aur ek line ka note; baqi kuch nahin | Review |

### 13.2 Har qadam ka 6-marhale ka loop

Claude Code **har qadam** (section 11) isi tarteeb se chalaye. Koi marhala chhodna mana.

| # | Marhala | Kya karna hai | Rukna kab hai |
|---|---|---|---|
| 1 | **PARHO** | `CLAUDE.md`, `intent.md`, spec ka sirf us qadam ka hissa aur uski AC IDs | Agar qadam ki koi shart (jaise Q-01) abhi tay nahin |
| 2 | **PLAN** | Paanch line ka plan: kin files banengi/badlengi, kin AC IDs ko pura karega, kya **bahar** hai | **Owner ki "haan" ka intezar.** Baghair "haan" code nahin |
| 3 | **BANAO** | Sirf plan ki files; sirf `src/`, `tests/`, `migrations/` (nayi file), `public/` | Plan se bahar file ki zaroorat ho to ruk kar poochhe |
| 4 | **JAANCHO** | `npm run typecheck`, `npm run test`, `npm run build`, `npm run check:scope` | Do dafa fail ho (13.9) |
| 5 | **SCOPE CHECK** | `git diff --stat` plan se milao; nayi dependency/table/route/endpoint ki jaanch | Koi bhi anjan cheez mile to revert ya poochhe |
| 6 | **REPORT** | Roman Urdu mein: kya bana, har AC pass/fail, badli hui files ki list, agla qadam; `PROGRESS.md` mein sirf us qadam ka tick. Phir **ruk jaye**, agla qadam khud shuru na kare | Hamesha |

### 13.3 Baghair pooche **mana** (intent 0.3 ke mutabiq)

- Production par deploy (`wrangler deploy`, dashboard se deploy)
- Remote/live database par koi bhi tabdeeli (`wrangler d1 migrations apply --remote`, `wrangler d1 execute --remote`)
- `git push`, branch merge, force-push, history badalna
- Secrets/environment variables banana ya badalna (`wrangler secret ...`)
- Files ya folder mitana (`rm`, `git clean`, `git reset --hard`)
- Nayi dependency, nayi table/column, nayi route/endpoint, nayi screen/feature

### 13.4 Baghair pooche **theek**

Files parhna; `src/`, `tests/` mein code likhna (plan ke andar); local `dev`, `test`, `build`, `typecheck`, `check:scope` chalana; local D1 par migration.

### 13.5 Change request ka tareeqa (scope se bahar ki cheez)

Agar Claude ko lage ke kuch spec/intent mein kam hai ya behtar ho sakta hai, wo code nahin likhe; yeh likhe aur ruk jaye:

```
CHANGE REQUEST
Kya chahiye: ...
Kyun (intent/spec ka kaun sa hissa takra raha hai): ...
Asar: nayi files / tables / endpoints / dependencies / kharcha
Aasan alternative (agar ho): ...
Meri sifarish: ...
Aap ka jawab: "haan" / "nahin" / "badal ke"
```

"Haan" milne par pehle `spec.md` mein tabdeeli aur `intent.md` section 32 ki sifarish (owner khud likhta hai), phir code.

### 13.6 Khudkar scope check: `npm run check:scope`

Qadam 0 mein banane ke liye (owner ki ijazat se). `scripts/check-scope.mjs` yeh teen jaanch karta hai aur fail ho to build/commit rok deta hai:

1. **Routes:** `src/pages/**` se banne wale har page/endpoint `ROUTES` aur `API` manifest (section 6.4, 8.8) mein hona chahiye. Manifest se bahar ka koi bhi naya route = fail.
2. **Dependencies:** `package.json` ki har dependency neeche ki allowlist mein. Bahar ki = fail.
3. **Tables:** `migrations/*.sql` ke har `CREATE TABLE` ka naam neeche ki list mein. Anjan table = fail.

<!-- DEPS:BEGIN -->
```
astro
@astrojs/cloudflare
@astrojs/preact
@astrojs/check
preact
tailwindcss
@tailwindcss/vite
valibot
typescript
wrangler
@cloudflare/workers-types
vitest
@cloudflare/vitest-pool-workers
```
<!-- DEPS:END -->

<!-- TABLES:BEGIN -->
```
orders
order_events
order_counter
notifications
settings
mcqs
mocks
notes
jobs
daily_pins
agent_log
rate_limits
```
<!-- TABLES:END -->

Allowlist badalna = owner ki ijazat se spec ki tabdeeli.

### 13.7 Golden aur hifazati tests

Yeh tests owner ke tay kiye hue faislon ko pakar kar rakhte hain; agar Claude kisi qeemat/waqt/number ko chupke se badal de to test toot jata hai (section 10.1): `catalog.golden`, `settings.golden`, `timer` ki 3 misalein, `banned-words`, `no-pii-analytics`, `queries.cost`.

### 13.8 Trace ka usool

- Har nayi file ke sar par ek line: `// spec: F08, E12` (kaun si feature/endpoint/screen).
- Commit message: `step 7: F08-AC1, F08-AC4`.
- Jis code ke sath koi spec ID nahin, wo scope se bahar maana jaye ga.

### 13.9 "Do dafa fail" ka qaida (anant loop se bachao)

Koi test, build ya check **do dafa** mukhtalif tareeqon se fix karne par bhi fail ho to Claude ruk kar batae: kya fail hua, kya try kiya, kya shak hai. **Mana:** test ko kamzor karna, golden test badalna, spec/intent badalna, ya check ko band karna taake pass ho jaye.

### 13.10 Maswida: `CLAUDE.md` (Qadam 0 mein, owner ki ijazat se)

```md
# GVS Academy Portal: Claude ke liye hidayat

1. Kaam se pehle parho: intent.md, spec.md (sirf apne qadam ka hissa), design.md, aur yeh file.
2. Roman Urdu mein samjhao. Ek waqt mein sirf ek qadam (spec.md section 11).
3. intent.md ko kabhi edit nahin karna. spec.md aur design.md sirf owner ki ijazat se.
4. Jo spec.md mein nahin wo nahin banana. Nayi cheez ho to CHANGE REQUEST (spec.md 13.5) likho aur ruk jao.
5. Har qadam ka loop (spec.md 13.2): PARHO, PLAN ("haan" ka intezar), BANAO, JAANCHO, SCOPE CHECK, REPORT, phir ruk jao.
6. Bina pooche mana: deploy, remote DB migration, git push, secrets, files mitana, nayi dependency/table/endpoint/page.
7. Bina pooche theek: files parhna, src/ aur tests/ mein code, local dev/test/build/check:scope.
8. Do dafa fail ho to ruk kar batao. Test ya golden test kamzor nahin karna.
9. Har file ke sar par "// spec: <ID>"; commit message "step N: F08-AC1, ...".
10. Visitor ke alfaz Roman Urdu mein, chhote jumle (intent section 27). "guarantee", "pakki naukri", "100%" jaise alfaz nahin.
11. Customer ka naam/phone logs ya analytics mein kabhi nahin.
12. Har qadam ke REPORT par PROGRESS.md mein sirf us qadam ka tick lagao.
```

### 13.11 Maswida: `.claude/settings.json` (mashini rok)

Sintax Claude Code ke `/permissions` se tasdeeq kar lein (version ke sath format badal sakta hai):

```json
{
  "permissions": {
    "deny": [
      "Edit(intent.md)",
      "Write(intent.md)",
      "Read(.env*)",
      "Edit(.env*)",
      "Write(.env*)",
      "Bash(git push:*)",
      "Bash(git reset --hard:*)",
      "Bash(git clean:*)",
      "Bash(rm -rf:*)",
      "Bash(wrangler deploy:*)",
      "Bash(npx wrangler deploy:*)",
      "Bash(wrangler secret:*)",
      "Bash(npx wrangler secret:*)",
      "Bash(wrangler d1 migrations apply:*--remote*)",
      "Bash(wrangler d1 execute:*--remote*)"
    ],
    "ask": [
      "Edit(spec.md)",
      "Write(spec.md)",
      "Edit(design.md)",
      "Edit(CLAUDE.md)",
      "Edit(.claude/settings.json)",
      "Edit(src/data/catalog.json)",
      "Edit(migrations/**)",
      "Write(migrations/**)",
      "Edit(tests/golden/**)",
      "Edit(package.json)",
      "Bash(npm install:*)",
      "Bash(npm i:*)",
      "Bash(git commit:*)"
    ]
  }
}
```

---

## 14. Proposals (intent se bahar ya intent se thori alag; **sab ke liye owner ki ijazat chahiye**)

**Saare manzoor (16 Nov 2026):** P-01 se P-12. Meri sifarish aakhri column mein.

| ID | Kya | Kyun | Asar | Sifarish |
|---|---|---|---|---|
| P-01 | Deploy **Cloudflare Workers** (static assets ke sath) par, Pages par nahin | Astro adapter v13 ne Pages support hata diya; Cloudflare bhi naye projects ke liye Workers kehta hai | Wohi Cloudflare, wohi free tier; deploy `wrangler`/Workers Builds se | **MANZOOR (16 Nov)** |
| P-02 | Content ka parse/preview **browser mein** (shared `parser.ts`); server sirf tukron mein save | Free plan ki 10 ms CPU hadd (FX-03) | `E16` ikhtiyari ho jata hai; UI wohi | **MANZOOR (16 Nov)** |
| P-03 | D1: `daily_pins.source` (`pin`/`auto`); A09 screen; `E23` | 15 din ka no-repeat aur "sab ke liye wohi 10" ke liye auto-chune din bhi mehfooz karne parte hain | 1 column, 1 screen, 2 endpoints | **MANZOOR (16 Nov)** |
| P-04 | Maintenance (F24) ke liye **Cloudflare Cron Trigger** (har 15 minute), request par nahin | Request par chalna: kharcha, takrao, CPU hadd (FL-06) | 1 `scheduled` handler; free | **MANZOOR (16 Nov)** |
| P-05 | `GET /api/jobs/latest` (cached 5 min) Home ke "taza jobs" ke liye | Intent mein Home par 3 taza jobs hain lekin us ka endpoint nahin | 1 endpoint | **MANZOOR (16 Nov)** |
| P-06 | D2: `deleted_at` (jobs, notes, mocks) taake `410 Gone` mumkin ho | Intent 14.3 ka 410 baghair tombstone ke nahin ho sakta | 3 columns | **MANZOOR (16 Nov)** |
| P-07 | D3: `mcqs.q_hash` + index duplicate pakadne ke liye | Baghair is ke har sawal par poori table scan (FX-02) | 1 column, 1 index | **MANZOOR (16 Nov)** |
| P-08 | Cloudflare **Access** `/admin` ke samne (email OTP) | Admin ek password par hai (FL-02) | Free (chhoti team); login mein ek qadam zyada | **MANZOOR (16 Nov)** |
| P-09 | Order form par **Cloudflare Turnstile** (spam rokne ke liye) | Jaali orders (intent 23) | Free; thora JS | **MANZOOR (16 Nov)** |
| P-10 | `PROGRESS.md` (qadam war checklist, sirf tick) | Ek jagah dikhe kaun sa qadam hua | 1 file | **MANZOOR (16 Nov)** |
| P-11 | R2 ke liye `img.<domain>` custom domain | Tasveerein Worker requests na khayen (FL-10) | Domain DNS Cloudflare par | **MANZOOR (Q-03)** |
| P-12 | D4: unique `slug` + 3 plumbing indexes | Takrao aur reads se bachao | Sirf SQL | **MANZOOR (16 Nov)** |

---

## 15. Sawal aur assumptions

### 15.1 Sawal (jawab mil chuke, 16 Nov 2026)

| ID | Sawal | Jawab |
|---|---|---|
| Q-01 | Darwaza 1 aur 4 ka landing | **Option A:** naya static page `/job-prep` (F01-AC8, S02); darwaza 4 home par do sub-links (Career Desk, Sarkari Services) |
| Q-02 | Analytics tool | **GA4**, deferred load; `/track` ka query analytics se hataya jaye (F23-AC4) |
| Q-03 | Domain aur tasveerein | **Domain Cloudflare DNS par** laya jaye ga; tasveerein `img.<domain>` (R2) se. Owner ka kaam: domain tay karna aur `.pk` registrar se nameserver badalna tasdeeq karna (Qadam 18 se pehle) |

### 15.2 Assumptions (maine default le liye; ghalat hon to batayen)

| ID | Assumption |
|---|---|
| A-01 | "Aaj ki kamai" = wo orders jin ka `paid_at` aaj (Pakistan waqt) ho, aur status `paid`/`pending`/`complete` ho |
| A-02 | Job akhri tareekh ke din ki raat 23:59:59 (Pakistan) tak khuli rehti hai |
| A-03 | Mock mitane par us ke MCQs bank mein rehte hain (`mock_id` khali) |
| A-04 | Rate limits ki values section 9.3 ki table ke mutabiq (order 5/ghanta/number aur 20/ghanta/IP, track 30/10 minute, login 5/15 minute) |
| A-05 | Product-wise waqt ki Settings catalog ke `deliveryMinutes` par ghalib (intent 12.3) |
| A-06 | Rozana test ka din 00:00 Pakistan waqt par badalta hai |
| A-07 | Phone input mein `03XX-XXXXXXX`, `+92`, spaces bardasht; store `923XXXXXXXXX` |
| A-08 | Wada badalne ke liye `E12` mein `dueAt` ki ijazat (alag endpoint nahin) |
| A-09 | Import ke tukre ka shuru ka size 25 sawal; tajarbe se badle ga |
| A-10 | Order kamyab hone par cart khali hota hai |
| A-11 | Mazmoon ka URL slug mazmoon ke naam se: `general-knowledge`, `pakistan-studies`, `islamiat`, `english`, `everyday-science`, `current-affairs`, `computer`, `urdu`, `maths` |
| A-12 | Reserved job slugs: `ppsc`, `fpsc`, `nts` |

### 15.3 Intent ke khule faislay (spec ko nahin rokte, sirf yaad dihani; intent 29.1)

JazzCash/Easypaisa details (Qadam 6), rang/logo (Qadam 0), domain ka naam (Qadam 18; DNS Cloudflare par, Q-03), shehar/pata (Qadam 14), refund policy ke aakhri alfaz (Qadam 14), interview ki qeemat, Sarkari Services ki shuru ki schemes (Qadam 14), muft namoone (Qadam 14), launch ka content (Qadam 17).

---

## 16. Intent se spec tak (kuch chhuta to nahin)

| Intent hissa | Spec mein kahan |
|---|---|
| 1 se 6 (maqsad, scope, visitors, research, pabandiyan) | 0, 2 |
| 7 (number, rates, waqt) | F02, F04, F06, 8.5 (SA4), 10.1 golden tests |
| 8 (portal ke hisse) | F01, F02, S01 se S14 |
| 9 (order, tracking, admin) | F03 se F10, 8.6 |
| 10 (muft content, jobs) | F11 se F16, F18 se F20, 8.7 |
| 11 (visitor ka tajurba, history) | F13 se F17, 7.5 |
| 12 (technical) | 3, 4, 7, 8, 9.2 |
| 13 (pages) | 6.2, 6.4 |
| 14 (SEO) | F21 |
| 15 (ads) | F22 |
| 16 (design usool) | 9.1, 9.7 (rang/screens design.md mein) |
| 17 (non-functional) | 9 |
| 18 (analytics) | F23 |
| 19 (build tarteeb) | 11 |
| 20 (jaanch) | 10.2 |
| 21 se 24 (launch, operations, khatre, kirdar) | 12 (flags), 9.6; baqi operational, spec ka kaam nahin |
| 25 (Version 2) | F27 (sirf tayyari) |
| 26 (Version 3) | Scope se bahar |
| 27, 28 (zaban, usool) | F02-AC7, F13, 9.5, 13.10 |

---

## 17. Spec ki tabdeeliyon ka record

| Version | Tareekh | Tabdeeli |
|---|---|---|
| 0.1 | 16 Nov 2026 | Pehla maswida `intent.md` v1.0 se |
| 0.3 | 16 Nov 2026 | P-02 se P-10 aur P-12 manzoor: preview browser mein (E16 hata), daily-pins (D1, A09, E23), Cron Trigger, `GET /api/jobs/latest`, soft delete, `q_hash`, Cloudflare Access (F07-AC6), Turnstile (F04-AC11), `PROGRESS.md`, plumbing indexes; routes/API manifest aur FL-12, FL-13 |
| 0.2 | 16 Nov 2026 | Owner ke jawab: P-01 (Workers), P-11 (R2 custom domain), Q-01 (`/job-prep` page, F01-AC8, S02, routes), Q-02 (GA4), Q-03 (domain Cloudflare DNS par) |

*Khatam. Saare proposals manzoor; agla qadam: Qadam 0.*
