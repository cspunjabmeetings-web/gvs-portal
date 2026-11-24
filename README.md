# GVS Academy Portal: chalane ka tareeqa

spec: F28-AC3 (hafta war backup ka tareeqa), intent 12.10 (backup), intent 22 (rozana operations).
Sab commands VS Code ke terminal (PowerShell) mein, project ke folder se. Har command alag chalayen.

> Hamesha yaad rakhen: **asal database aur asal site par sirf asal kaam.** Aazmaish `npm run dev` (local) par.

---

## 1. Hafta war backup (har hafte, maslan Itwaar)

Dono kaam karein, aur files apne **Google Drive** mein ek folder (maslan `GVS Backup`) mein rakhen.
Google account par **2-step verification** zaroor on ho, kyun ke in files mein customers ke number hain (spec FL-05).

### 1a. Orders ka CSV (2 minute)

1. Admin kholen → **Orders** tab → **⬇ Saare orders CSV**.
2. File `gvs-orders-YYYY-MM-DD.csv` download hogi. Excel ya Google Sheets mein seedhi khulti hai.
3. Drive mein upload karein.

### 1b. Poore database ka export (5 minute)

```
npx wrangler d1 export gvs --remote --output gvs-backup.sql
```

- Is se `gvs-backup.sql` file banegi (saare sawal, notes, jobs, orders, settings).
- Drive mein upload karne se pehle naam mein tareekh likh dein, maslan `gvs-backup-2026-11-29.sql`.
- Phir computer se yeh file mita dein (Drive mein mehfooz hai).

### 1c. Content ki asal files

`gvs-content` folder (MCQs, mocks, notes ki `.txt` files) bhi Drive mein rakhen. Zaroorat par dobara import ho sakti hain.

---

## 2. Ghalti se kuch mit jaye: Time Travel (Cloudflare ka apna backup)

Cloudflare D1 khud pichhle dinon ka record rakhta hai (muddat plan ke mutabiq; launch par dashboard mein tasdeeq karein).

**Khud restore na karein.** Pehle Claude ko batayen ke kya, kab hua. Restore poore database ko purane waqt par le jata hai,
us ke baad ke saare naye orders bhi chale jate hain. Sirf jaankari ke liye:

```
npx wrangler d1 time-travel info gvs
```

---

## 3. Site update (deploy)

Code ki har tabdeeli ke baad (Claude batayega kab), **naye terminal** mein:

```
$env:SITE_URL="https://gvsacademy.online"; $env:PUBLIC_TURNSTILE_SITE_KEY="0x4AAAAAAGLeKz2o6KZEhAeG"; $env:PUBLIC_IMG_BASE="https://img.gvsacademy.online"; npm run build
```
```
npx wrangler deploy
```
```
exit
```

- Asal site: https://gvsacademy.online · tasveerein: https://img.gvsacademy.online
- `npm run verify` ke foran baad deploy **na** karein: verify build ko localhost ke address se banata hai. Hamesha upar wali build line pehle.
- Deploy ke baad terminal band (`exit`), warna isi terminal mein local `npm run dev` par asal Turnstile key lag jati hai.

---

## 4. Aam kaam

| Kaam | Kahan |
|---|---|
| Naye MCQs / mock / notes | Admin → Content → Naya content → **.txt file chunein** (paste nahin) → checkbox sirf parh kar → Save |
| Content banana | claude.ai par skill `gvs-portal-content` |
| Nayi job | Admin → Jobs → Nayi job → "Text paste karein" (sirf asal ishtihar se) → baad mein list se "Tasveer" |
| Rozana test ke sawal khud chunna | Admin → Content → Rozana pin |
| Elaan (patti) | Admin → Settings → Elaan |
| Orders band / chalu | Admin → Settings → "Orders le rahe hain" |
| JazzCash number (jab account bane) | Admin → Settings → Payment → JazzCash number + naam → Save |
| Namoone (launch ke baad) | Har pack ke ek page ki tasveer Claude ko dein → "Namoona dekhein" button lagega |

### Admin password badalna

```
npx wrangler secret put ADMIN_PASSWORD
```

Command bilkul yahi likhen. Naya password **sirf** "Enter a secret value" par likhen (12+ harf), kahin aur nahin.

---

## 5. Local par aazmaish

```
npm run dev
```

- Site: http://localhost:4321, admin: http://localhost:4321/admin (password `.dev.vars` mein, sirf local).
- Local database alag hai; yahan kuch bhi try karein, asal site par asar nahin.
- Band karne ke liye: **Ctrl + C**.

---

## 6. Developer ke liye

- Hidayat aur poori tareekh: `CLAUDE.md`. Requirements: `intent.md`, `spec.md`. Design: `design.md`. Tarteeb: `PROGRESS.md`.
- Sab jaanchein ek sath: `npm run verify` (scope, typecheck, build, tests, bundle).
- Har qadam apni branch par; PR; GitHub Actions CI hara hone par merge.
