# GVS Academy Portal: design.md

| | |
|---|---|
| **Document** | design.md (rang, fonts, components, screens) |
| **Version** | 0.3 (owner ne manzoor kiya, 16 Nov 2026) |
| **Tareekh** | 16 November 2026 |
| **Source** | `intent.md` section 11, 15, 16, 17, 27; `spec.md` section 6, 9 |
| **Rang ka faisla** | Gehra hara + amber (owner ne 16 Nov 2026 ko chuna) |

Sach ka darja: owner → `intent.md` → `spec.md` → **yeh file** → code. Takrao ho to upar wala jeetta hai. Is file ki tabdeeli sirf owner ki ijazat se.

---

## 1. Usool (intent 16 ka khulasa)

1. **GVS ki apni pehchan:** gehra hara (aitmad, Pakistani pehchan) + amber (amal, streak, "aaj ka test"). Aam neela-safaid MCQ-site look nahin.
2. **Mobile pehle:** design 360px se shuru; 400px par sab saaf.
3. **Halka:** system fonts, inline SVG icons, koi image-heavy hero nahin.
4. **Light + dark:** phone ki setting (`prefers-color-scheme`) se; sirf CSS variables badalte hain (FX-06).
5. **Aitmad ke nishan** har bechne wale page par (`TrustStrip`).
6. **Ungli ke qabil:** har button/option ≥ 44px ooncha; tap targets ke beech ≥ 8px.
7. **Accessibility:** WCAG AA contrast; sahih/ghalat **rang + nishan** (✓ / ✕); har input ka label; keyboard focus saaf nazar aaye.
8. **SaaS-level tool**, dukaan ka poster nahin: qeemat samne, saaf grid, kam shor.

---

## 2. Rang (design tokens)

Saare rang **sirf** `src/styles/global.css` (Tailwind 4 ki lazmi CSS entry file; ek hi file, owner ki manzoori 16 Nov 2026) ke CSS variables mein; Tailwind 4 `@theme` inhi variables ko istemal kare. Component mein hex value likhna mana.

### 2.1 Light theme

| Token | Value | Istemal | Contrast (text par) |
|---|---|---|---|
| `--bg` | `#F7F8F4` | Page ka background | |
| `--surface` | `#FFFFFF` | Cards, sheets | |
| `--surface-2` | `#EEF3EC` | Halka hara tint (sections, chips) | |
| `--border` | `#D6DED5` | Card/input borders | |
| `--text` | `#15201A` | Aam matn | ~16:1 on surface |
| `--text-muted` | `#4A5A50` | Chhota/secondary matn | ~7:1 |
| `--primary` | `#0F5132` | Bara button, header, links | white text ~9.6:1 |
| `--primary-hover` | `#0A3D25` | Hover/pressed | |
| `--on-primary` | `#FFFFFF` | Primary par text | |
| `--primary-soft` | `#DCEBDF` | Selected chip, active tab bg | |
| `--accent` | `#F2A20C` | Amber: streak, "Aaj ka test", highlight | dark text `#1F1400` ~10:1 |
| `--on-accent` | `#1F1400` | Amber par text | |
| `--accent-text` | `#A0570A` | Amber rang ka matn white par | ~5:1 |
| `--correct` | `#15803D` | Sahih jawab border/icon | ~5:1 |
| `--correct-bg` | `#DCFCE7` | Sahih card ka bg | |
| `--wrong` | `#B91C1C` | Ghalat jawab border/icon, error | ~6.5:1 |
| `--wrong-bg` | `#FEE2E2` | Ghalat card ka bg | |
| `--warn` | `#B45309` | Timer aakhri 5 minute, "der ho gayi" | ~5:1 |
| `--focus` | `#F2A20C` | Focus ring ka bahari hissa | |
| `--focus-inner` | `var(--primary)` | Focus ring ka andaruni hissa | |

### 2.2 Dark theme

| Token | Value |
|---|---|
| `--bg` | `#0D1410` |
| `--surface` | `#151F19` |
| `--surface-2` | `#1C2921` |
| `--border` | `#2B3A31` |
| `--text` | `#E7EFE9` |
| `--text-muted` | `#A2B3A8` |
| `--primary` | `#237A4F` (button bg; white text ~5.3:1) |
| `--primary-hover` | `#1C6641` (hover gehra, halka nahin) |
| `--on-primary` | `#FFFFFF` |
| `--primary-soft` | `#1E3A2A` |
| `--accent` | `#FBBF24` |
| `--on-accent` | `#1F1400` |
| `--accent-text` | `#FCD34D` |
| `--correct` | `#4ADE80` |
| `--correct-bg` | `#12321F` |
| `--wrong` | `#F87171` |
| `--wrong-bg` | `#3A1515` |
| `--warn` | `#FBBF24` |
| `--focus` | `#FBBF24` |
| `--focus-inner` | `#E7EFE9` |

**Focus ring (dono theme):** do rang ka: andar 2px `--focus-inner`, bahar 2px `--focus`, yani `box-shadow: 0 0 0 2px var(--focus-inner), 0 0 0 4px var(--focus)`. Akela amber safaid par sirf ~2.1:1 hai (3:1 chahiye), is liye akela istemal mana.

**Note:** `--primary` (brand hara) aur `--correct` (quiz sahih) jaan boojh kar alag shade hain, aur sahih par hamesha ✓ nishan, ghalat par ✕ (rang-andhe visitors ke liye).

Qadam 1 mein contrast ki aakhri tasdeeq Lighthouse/axe se; koi value AA se kam nikle to sirf yahan badle (owner ki ijazat se).

---

## 3. Typography

| Cheez | Value |
|---|---|
| Font | System stack: `system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", Arial, sans-serif` (koi web font download nahin, LCP ke liye behtar) |
| Base | 16px, line-height 1.6 |
| Scale (mobile) | H1 28px/700, H2 22px/700, H3 18px/600, body 16px, small 14px |
| Scale (≥1024px) | H1 36px, H2 26px, H3 20px |
| Numbers | `font-variant-numeric: tabular-nums` (qeemat, timer, score) |
| Paragraph chaurai | ≤ 68ch |

Roman Urdu Latin harfon mein hai; Nastaliq Version 1 mein nahin.

---

## 4. Layout, spacing, shape

| Cheez | Value |
|---|---|
| Spacing scale | 4, 8, 12, 16, 24, 32, 48, 64 px |
| Page gutter | 16px (mobile), 24px (≥768), max-width 1120px |
| Breakpoints | `sm` 400, `md` 768, `lg` 1024 (sidebar ad), `xl` 1280 |
| Radius | 8px (inputs, chips), 12px (cards), 16px (sheets/dialogs), full (pills) |
| Shadow | Sirf `0 1px 2px rgb(0 0 0 / .06)` cards par; dark mein border |
| Touch | Button min-height 44px (primary 48px); option card min-height 56px |
| Motion | 150–200 ms ease-out; `prefers-reduced-motion: reduce` par sab animation band |
| Icons | Inline SVG, 20/24px, `currentColor` |

---

## 5. Components

Har component Astro (static) hai jab tak interactive na ho; interactive Preact island (spec 3.1).

| Component | Shakal / ahem baatein | Island? |
|---|---|---|
| `AnnouncementBar` | Amber patti (`--accent` bg, `--on-accent` text), 1 line, 160 harf | Nahin |
| `Header` | 60px, `--surface` (safaid) bg + neeche 3px `--primary` patti; asal logo (`/images/logo.svg`, dark mein `logo-dark.svg`) left; right: mobile par "☰ Menu" (`<details>`, bina JS), desktop (≥768) par Jobs, Plans, Order track karein, Meri history | Nahin (`<details>`) |
| `Logo` | `<picture>`: light `logo.svg` (navy #0B2D6B, hara #16A34A, sunehra #F59E0B); dark `logo-dark.svg` (navy ki jagah `#E7EFE9`). Header 44px, footer 56px ooncha | Nahin |
| `Footer` | `--surface-2`; About, Contact, Privacy, Terms, How-to-order, WhatsApp number, "GVS niji academy hai, sarkari idara nahin" | Nahin |
| `Breadcrumbs` | Chhota muted matn, `›` separator | Nahin |
| `DoorCard` | Home ke 4 darwaze: 2x2 grid (mobile 1 column 360px par, 2 column ≥400px), icon + title + 1 line, poora card clickable | Nahin |
| `ProductCard` | Naam, qeemat (bari, tabular), "includes" list (✓), "Namoona dekhein", fields, "Order list mein daalein" (primary). `job-apply`/`scheme-help` par "Qeemat mein sarkari fee shamil nahin" | Haan (add to cart) |
| `TrustStrip` | 4 chhote items ek row/2x2: "Qeemat saaf", "Pehle namoona dekhein", "Order ke 4 qadam", "Refund policy" + WhatsApp number | Nahin |
| `CartBar` | Neeche chipki 64px patti, `--surface` + upar border; "3 cheezein · Rs. 950" + "WhatsApp par order karein" (primary). Safe-area padding | Haan |
| `OrderSheet` | Neeche se khulne wali sheet (16px radius): Naam, WhatsApp number, cheezon ka khulasa, kul, button | Haan |
| `OrderSuccess` | Order number bara (28px, tabular) + copy, "WhatsApp par bhejein" (primary, 48px), copy-message, "Fikr na karein..." | Haan |
| `QuizCard` | Sawal (18px/600), options = bare cards (56px+, A/B/C label circle). Jawab par: sahih `--correct-bg` + ✓, ghalat `--wrong-bg` + ✕, tashreeh neeche slide (reduced-motion par seedha). Bookmark ☆ aur "Ghalti batayen" | Haan |
| `ProgressBar` | "Sawal 4 / 10" + 6px bar `--primary`, score right | Haan (QuizCard ka hissa) |
| `ScoreCard` | Bara score circle, streak 🔥 jaisa SVG amber mein, kamzor mazmoon, buttons: share, ghalat dobara, "Kal phir aayein" + pack | Haan |
| `MockPalette` | Number grid (40px squares): hal shuda = primary bg, baqi = border, "baad mein" = amber + ● nishan, current = focus ring | Haan |
| `Timer` | Tabular; aakhri 5 minute `--warn` rang + ⏱ nishan | Haan |
| `StatusBadge` | Pill: new (muted), paid (correct + ✓), pending (amber), complete (primary), cancelled (wrong) — har ek par text bhi | Nahin |
| `AdSlot` | Label "Ishtihar" (12px muted), fixed size: `top` 320x100 / desktop 728x90, `inline`/`bottom`/`result` 250px ooncha, `sidebar` 300x250 (≥1024). Button se ≥ 24px door | Nahin |
| `FAQ` | `<details>`/`<summary>` (bina JS ke chale) | Nahin |
| `JobCard` | Idara chip, post, shehar, akhri tareekh + "X din baqi" (amber jab ≤ 3), band par muted + "Band ho chuka" | Nahin |
| `EmptyState` / `ErrorState` | Icon + kya hua + kaise theek ho + ek button | Nahin |

### 5.1 Admin components (phone-first)

| Component | Ahem baatein |
|---|---|
| `AdminTabs` | Neeche tab bar (5 tabs: Orders, Notifications, Content, Jobs, Settings), 56px, icon + label |
| `Bell` | Header mein, na-parhi ginti amber badge |
| `OrderCardAdmin` | Upar number + StatusBadge; naam, poora number (tap = call/WhatsApp), cheezein, kul, umar, timer; "WhatsApp khola" haan/nahin chip; "Rabta hua" toggle; 4 buttons 2x2 grid (har ek 48px); "Khud rabta karein"; do note fields |
| `Dialog` | Paid (wada + badalne ka khana), Cancel (wajah zaroori). Bottom sheet mobile par |
| `ImportPreview` | Ginti chips, har cheez visitor wale rup mein, ghaltiyan `--wrong` list mein "Line 14: ..." |

---

## 6. Screens (intent 16 ki list; wireframes text mein)

Har screen ki teen halatein: **loading** (skeleton, fixed oonchai), **empty**, **error** (spec 6.1).

### 6.1 Home (S01)
```
[AnnouncementBar]
[Header]
H1 "Aap kon hain?"
[DoorCard Job ki tayyari] [DoorCard VU Corner]
[DoorCard Board Classes ] [DoorCard Kaam karwana hai → Career Desk | Sarkari Services]
[Aaj ka muft test — amber card, streak yaad dihani]
[Taza jobs x3]
[Mashhoor packs]   [Order ke 4 qadam]   [FAQ]
[AdSlot bottom]
[Footer]            [CartBar sticky]
```

### 6.2 Darwaze ka page (S02 /job-prep, S03 /vu ...)
H1 → short intro → sub-links/cards (har ek 1 line wazahat) → `top` ad → products → TrustStrip → 300+ alfaz content → FAQ → `bottom` ad.

### 6.3 Product page
Breadcrumbs → H1 + qeemat → includes → namoona (tasveer, width/height fixed) → fields + "Order list mein daalein" → TrustStrip → FAQ.

### 6.4 Cart aur order form / Order ho gaya (S25, S26)
CartBar tap → sheet: list (har line hatane ka ✕), kul, Naam, Number, button. Kamyabi → OrderSuccess screen (order number sab se bara cheez).

### 6.5 Track (S27)
2 fields (order number, aakhri 4 hindse) → nateeja card: StatusBadge, Timer, public note, darje ka matn, payment ke qadam (new), "Dobara order karein" (complete). Koi ad nahin.

### 6.6 Rozana test (S17)
- **Shuru:** "Aaj ka test" amber hero, streak, "Aaj ka test dein".
- **Sawal:** ProgressBar → QuizCard → "Agla sawal" (jawab ke baad hi enable). Koi ad nahin.
- **Score card:** ScoreCard → `result` ad neeche.

### 6.7 Mock test (S19)
- **Shuru:** naam, sawal, waqt, usool, "Shuru karein".
- **Sawal + palette:** upar Timer sticky; QuizCard (jawab foran nahin dikhta, sirf select); "Baad mein dekhein"; neeche palette (drawer mobile par).
- **Result:** score/feesad/waqt, mazmoon-war bars, har sawal ki tashreeh (accordion), pack ki peshkash, share, `result` ad.

### 6.8 Note (S21)
Breadcrumbs → H1 → khulasa → matn (≤68ch) → `inline` ad (teesre hisse ke baad) → 5 MCQs quiz → mutalliqa notes → pack → `bottom` ad.

### 6.9 Job list / job page (S22, S24)
List: filter chips (idare) → khuli JobCards → "Band ho chuki" section (muted). Page: tasveer/link, taleem, documents (✓ list), tareeqa (numbered), akhri tareekh ulti ginti, official link (bahar ka nishan ↗), "Hum apply kar dein" (primary) ya band ka paigham, "GVS niji academy hai".

### 6.10 Admin (A01–A10)
Login (ek field, bara button) → Orders (khulasa ke 4 tiles, filter chips horizontal scroll, search, OrderCardAdmin list) → Notifications → Content (paste area + upload, ImportPreview) → Jobs (form/paste, tasveer, purani jobs) → Settings (sections ke hisab se form, har field ka label + example). 360px par poora chale.

---

## 7. Lehja (intent 27)

- Roman Urdu, chhote jumle. Button wohi kahe jo karta hai ("Order list mein daalein", "WhatsApp par bhejein", "Aaj ka test dein").
- Ghalti ka paigham: kya ghalat + kaise theek ("Number 11 hindson ka hona chahiye, maslan 03001234567.").
- Quiz mein hosla afzai ("Shabash!", "Koi baat nahin, tashreeh parhein.").
- Mubalgha wale alfaz kabhi nahin (spec F02-AC7; `banned-words` test).
- Tareekh/waqt: "5 Dec 2026, 5:00 PM"; qeemat: "Rs. 350".

---

## 8. Tabdeeliyon ka record

| Version | Tareekh | Tabdeeli |
|---|---|---|
| 0.1 | 16 Nov 2026 | Pehla maswida (Qadam 0); rang: gehra hara + amber |
| 0.2 | 16 Nov 2026 | Dark primary `#237A4F`/hover `#1C6641` (AA fix); do-rang focus ring; tokens `src/styles/global.css` mein; theme sirf phone ki setting se (toggle nahin); logo abhi text, SVG owner de to |
| 0.3 | 16 Nov 2026 | Owner ka asal logo (navy + hara + sunehra) laga; dark variant; Header ka bg safaid (`--surface`) + 3px hari patti, taake navy logo saaf dikhe (owner ki manzoori) |
