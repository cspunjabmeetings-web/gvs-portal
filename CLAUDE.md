# GVS Academy Portal: Claude ke liye hidayat

## Naya session shuru karte hi (pehle yeh)

1. Yeh poori file parho, khaas taur par neeche **"Development history"** ki aakhri entry.
2. `PROGRESS.md` dekho: kaun sa qadam mukammal, kaun sa agla.
3. Sirf agle qadam ka hissa `spec.md` section 11 aur us ki AC IDs se parho (poori spec har dafa nahin).
4. Owner ko Roman Urdu mein 2-3 line mein batao: "Pichhli dafa yahan ruke the, agla qadam yeh hai", phir PLAN (neeche qaida 5) aur "haan" ka intezar.

## Qawaid (spec.md 13.10)

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
13. Har qadam/session ke REPORT par neeche "Development history" mein **ek nayi entry** jodo (purani entries kabhi na badlo/mitao). Yeh owner ki hidayat hai (16 Nov 2026).
14. **Har feature/qadam ka plan lazmi owner se approve karwao** (owner ki hidayat, 16 Nov 2026). Plan mein "Approval ki sharait" zaroor hon (neeche template). Code tab hi approve hoga jab woh in sharait par pura utre. Ek waqt mein ek feature/qadam; har ek alag commit.
15. **GitHub push owner khud karta hai.** Har qadam ke REPORT ke aakhir mein owner ko copy-paste ke qabil git commands do (`git add`, `git commit -m "step N: ..."`, `git push`). Claude khud push nahin karta.

16. **Branch + PR + CI** (owner ka CHANGE REQUEST, 16 Nov 2026). Har qadam apni branch par (`step-N`; Claude local `git checkout -b step-N` kar sakta hai). Qadam ke aakhir mein `npm run verify` lazmi PASS. Owner branch push kare, GitHub par PR banaye (`.github/pull_request_template.md` khud bharta hai; Claude PR ka text bhar kar de), CI (`.github/workflows/ci.yml`, job `verify`) hara ✅ ho, owner haath ki checklist dekhe, phir **owner** GitHub par merge kare aur local mein `git checkout main` + `git pull`. Laal ❌ par merge mana.

### Plan ka template (har feature/qadam se pehle)

```
PLAN — Qadam N: <unwan>
Features / AC IDs: F.., F..-AC..
Files jo banengi/badlengi: ...
Kya BAHAR hai (is qadam mein nahin): ...
Approval ki sharait (owner inhi se code jaanchega):
  [ ] <AC ID>: <kya chala kar/dekh kar pata chale ga> (maslan: 360px par ..., test X pass)
  [ ] npm run test, check:scope (aur Qadam 1 ke baad build, typecheck) pass
  [ ] design.md ke rang/components ke mutabiq (jahan UI ho)
  [ ] Koi nayi dependency/route/table spec se bahar nahin
Owner ka jawab: "haan" / "nahin" / "badal ke"
```

REPORT mein har shart ke aage ✅/❌ aur saboot (test ka nateeja, page ka URL/screenshot ka tareeqa).

## Project ka khulasa (snapshot)

- **Kya:** GVS Academy ka mobile-first portal: muft MCQs/mock/notes/jobs (traffic), paid packs/services (rate list), WhatsApp order + tracking + timer, phone-first admin. Sirf Version 1 (intent section 3).
- **Stack (spec 3.1):** Astro 6.x (static default, on-demand sirf DB pages) + `@astrojs/cloudflare` v13 **Workers** (Pages nahin, P-01) + Tailwind 4 (Vite plugin) + Preact islands + Valibot (server) + TypeScript strict + Vitest (+ workers pool Qadam 5 se). D1 database, R2 tasveerein, GA4 deferred, Turnstile (order form), Cloudflare Access (admin, Qadam 18), Cron Trigger har 15 min (F24).
- **Dependency allowlist:** sirf spec.md 13.6 `DEPS` block. Routes/APIs/tables bhi manifest ke andar (`npm run check:scope`).
- **Design:** `design.md` — gehra hara (`--primary #0F5132`) + amber (`--accent #F2A20C`), light+dark CSS variables, system fonts.
- **Commands:** `npm run verify` (sab ek sath: test, check:scope, typecheck, build, report:bundle → PASS/FAIL), `npm run dev`, aur alag alag `test`, `check:scope`, `typecheck`, `build`, `report:bundle`.
- **Mehfooz files:** `.claude/settings.json` (deny, Bash + PowerShell dono: intent.md, .env/.dev.vars, push, deploy, secrets, remote D1, files mitana; ask, Edit + Write dono: spec/design/CLAUDE/settings/catalog/migrations/golden/package.json; npm install/add, pnpm, yarn, git commit).
- **Golden tests** `tests/golden/`: catalog (Qadam 2 se chalu), settings seed (Qadam 5), timer `addWorkingMinutes` (Qadam 6) — target file bante hi khud chalu hote hain (`describe.skipIf`). banned-words aur scope abhi se chalu.

## Development history

> Har entry ka format: **Tareekh — Qadam N: unwan** · Kya bana (AC IDs) · Files · Faislay/manzooriyan · Khule masail · Agla qadam.
> Nayi entry hamesha **neeche** jodo.

### 16 Nov 2026 — Qadam 0: Guardrails (repo, hidayat, checks, design)

- **Kya bana:** local git repo (`main`, koi remote nahin); `CLAUDE.md` (spec 13.10 + session-start + history); `.claude/settings.json` (spec 13.11 as-is); `PROGRESS.md` (spec 11 namoona); `design.md` v0.1; minimal `package.json` (scripts `test`, `check:scope`; devDeps pinned `vitest 5.1.0`, `typescript 7.0.2`); `vitest.config.ts`; `scripts/check-scope.mjs` (ROUTES/API/DEPS/TABLES manifests se jaanch); `tests/golden/` (catalog, settings, timer, banned-words, scope).
- **Jaanch:** `npm run check:scope` OK; `npm test` → 2 files pass (banned-words, scope; 5 tests), 3 skipped (catalog/settings/timer — un ki target files abhi nahin).
- **Faislay:** owner ne rang chuna: **gehra hara + amber**. Owner ki hidayat: CLAUDE.md mein development history rakhi jaye (qaida 13). Timer golden test spec 8.5 SA4 ka signature fix karta hai: `addWorkingMinutes(paidAt, minutes, workStart, workEnd, 'Asia/Karachi') => Date`. `no-pii-analytics` aur `queries.cost` tests apne qadam (15, 5) mein banenge.
- **Khule masail:** (1) Owner `.claude/settings.json` ke protected files aur `design.md` v0.1 ki tasdeeq kare — tab PROGRESS mein Qadam 0 tick. (2) GitHub private repo owner khud banaye/push kare (push Claude ke liye mana). (3) Pehla local commit `step 0: guardrails` owner ki ijazat se.
- **Agla qadam:** Qadam 1 — Astro + Workers adapter + Tailwind + folders + Base layout, Header, Footer (owner ki "haan" ke baad).
- **Mukammal (same din):** owner ne expert review ke baad "haan, laga do" kaha. settings.json: har Bash rok ki PowerShell copy (Remove-Item/del/rm bhi band), saari protected files par `Write(...)` ki ask bhi, `--remote` wali D1 rokein seedhi shakal mein (beech ka `*` nahin), `npm add`/pnpm/yarn par ask. design.md v0.2: dark primary `#237A4F` (AA), do-rang focus ring, tokens `src/styles/global.css`. PROGRESS mein Qadam 0 tick. **Owner ka kaam:** `/permissions` mein rules ki tasdeeq; GitHub repo bana kar push.
- **Izafa (same din):** owner ki nayi hidayat: har feature ka plan "Approval ki sharait" ke sath approve ho (qaida 14 + template); har feature alag; GitHub repo owner banaye ga aur push khud karega, Claude har qadam ke baad commands de ga (qaida 15).
- Owner ne Qadam 0 GitHub par push kar diya.

### 16 Nov 2026 — Qadam 1: Astro + Workers + Tailwind + layout (owner ne APPROVE kiya)

- **Kya bana:** `astro.config.mjs` (static, `@astrojs/cloudflare` Workers, Tailwind Vite plugin, prefetch `tap`, `PUBLIC_WHATSAPP_FALLBACK` via `astro:env`, `imageService: 'passthrough'`, `session: null` driver), `wrangler.toml`, `tsconfig.json` (strict), `src/styles/global.css` (design tokens), `src/layouts/Base.astro`, `src/components/{Header,Footer,Logo}.astro`, aarzi `src/pages/index.astro`, `scripts/bundle-report.mjs`, `public/images/logo.svg` + `logo-dark.svg`.
- **Jaanch:** build OK; typecheck 0 errors; tests 5 pass/16 skip; check:scope OK; bundle `/` JS 1.0 KB (prefetch), CSS 3.8 KB; dev server 200; 360px light/dark screenshots (iframe se) saaf.
- **Faislay (owner ki manzoori):** Astro **6.4.8** + adapter **13.7.0** (spec wala, Astro 7 nahin); **TypeScript 6.0.3** (`@astrojs/check` TS 7 nahin leta); `npm install-scripts approve workerd`; CHANGE REQUEST: `@rollup/wasm-node` (devDep alias `"rollup": "npm:@rollup/wasm-node@4.68.4"` + override `"$rollup"`) kyun ke **Windows Smart App Control native rollup block karta hai** (spec v0.3.1 DEPS); VC++ Redistributable x64 winget se install (workerd ko chahiye tha); Header safaid bg + asal logo (design.md v0.3).
- **Khud ke technical faislay:** override `vite: 7.3.8` (vite 7/8 do copies se build toot raha tha); adapter ka default **KV session band** (`sessionDrivers.null()`, spec mein KV nahin); `tests/` aur `scripts/` typecheck se bahar (Node types allowlist mein nahin; vitest inhein chalata hai); check-scope ab npm alias ka asal naam jaanchta hai; bundle-report `dist/client` parhta hai.
- **Mahol ke sabaq (agle session ke liye):** headless Edge ki kam se kam chaurai 504px hai — 360px jaanch ke liye iframe wrapper istemal karo. `package-lock.json` mein rollup entry ko wasm-node par haath se set kiya gaya tha; lock dobara banana ho to yeh dhyan rahe. `esbuild`/`sharp` ke install scripts approve nahin (zaroorat nahin pari).
- **Khule masail:** (1) **Qadam 5 ka khatra:** `@cloudflare/vitest-pool-workers` ko `vitest ^4` chahiye, hamare paas vitest 5.1.0 hai — Qadam 5 ke plan mein owner se faisla. (2) Header links (Jobs, Plans, ...) abhi 404 — apne qadmon mein banenge. (3) Owner bina-JS menu aur Tab focus ring khud dekh le.
- **Approval:** owner ne khud 5 khudkar jaanchein chala kar "sab ok" kaha, phir "Qadam 1 approve". PROGRESS tick. (Owner ke liye haath ki jaanch ka tareeqa: 5 npm commands + 2 "pehre-dar" tajurbe (banned word, nayi route) + browser checklist; owner command type karte waqt ghalti karta hai, is liye hamesha copy-paste ke qabil commands do.)
- Owner ne Qadam 1 push kar diya (main par).

### 16 Nov 2026 — CI setup (branch `ci-setup`)

- **Kyun:** owner ne poocha "sahi hone ka saboot kya hai, main khud kaise test karun". CHANGE REQUEST manzoor: verify + CI + branch/PR.
- **Kya bana:** `scripts/verify.mjs` + `npm run verify` (5 jaanchein, pehli ghalti par ruk kar PASS/FAIL table); `.github/workflows/ci.yml` (ubuntu, Node 26, `npm ci`, `npm run verify`, har push/PR); `.github/pull_request_template.md`; CLAUDE.md qaida 16; spec 3.2 mein izafa.
- **Jaanch:** local `npm run verify` → ✅ PASS. CI ka pehla nateeja GitHub par owner ke push ke baad.
- **Khatra:** lock file haath se patch shuda (rollup → wasm-node); `@rollup/wasm-node` ka Linux optional package (`@napi-rs/lzma-linux-x64-gnu`) lock mein nahin — CI fail ho to pehle yeh dekho.
- **Note:** GitHub Free par **private** repo mein branch protection/rulesets nahin milte (Pro chahiye) — is liye "laal par merge mana" owner ka apna usool hai, button band nahin hota.
- **Agla qadam:** owner `ci-setup` push + PR + CI hara → merge → Qadam 2 ka plan (`step-2` branch par).
- Owner ne PR #1 (ci-setup) merge kar diya.

### 16 Nov 2026 — Qadam 2: catalog, seo, ProductCard, AdSlot, FAQ (owner ne APPROVE kiya; PR #2 merged)

- **Kya bana:** `src/data/catalog.json` (13 products: intent 7.2 ke 12 + `interview-prep` `price: null`), `src/lib/catalog.ts` (types, `activeProducts`, `getProduct`, `isOrderable`, `formatPrice`, `fieldMessage`), `src/data/seo.json` (spec ROUTES ke 33 static pages), `src/data/house-ads.json` (intent 15.2 ke 4), `ProductCard.astro`, `AdSlot.astro` (5 slots, fixed size, random rotate script), `FAQ.astro` (`<details>`), aarzi Home mein 4 mashhoor packs + FAQ + bottom ad; tests `catalog.test.ts`, `seo.test.ts`; `check-scope.mjs` ab `readManifest()` export karta hai.
- **Catalog ke chhote faislay:** naya field `govtFeeExtra` (F02-AC4); `price: null` = sirf "Rabta karein" (F02-AC5); field types `text|select|month|number`; ghalti ka paigham `fieldMessage()` se banta hai (catalog mein alag `message` nahin); `sample: null` jab tak owner asal namoona na de ("Namoona dekhein" chhupa); "Order list mein daalein" disabled (Qadam 4).
- **Jaanch:** verify ✅ (21 pass, 13 skip; `catalog.golden` ab chalu aur pass), Home JS 1.3 KB / CSS 4.5 KB, 360px screenshot saaf.
- **Owner se tasdeeq baqi:** har pack ki `includes` list (maine maswida banaya; usool 7: wada wohi jo pura ho).
- **Agla qadam:** owner ki approval + includes ki tasdeeq → push `step-2` → PR → CI → merge → Qadam 3.
- **Natija:** owner ne includes list "theek" kahi aur Qadam 2 approve kiya; PR #2 merged (`2c6c34b`). **Sabaq:** owner ne pehli dafa merge se pehle `git checkout main` kar liya aur "merge ho gaya" kaha jab ke "Confirm merge" nahin dabaya tha — **owner ke "merged" kehne par hamesha `git fetch` + `git log origin/main` se tasdeeq karo** (gh CLI installed nahin; `git ls-remote origin` se PR refs dikhte hain).

### 16 Nov 2026 — Qadam 3 shuru (3 hisse)

- **Owner ka faisla:** Qadam 3 teen PRs mein: **3a** (`step-3a`: shared components DoorCard, TrustStrip, OrderSteps, Breadcrumbs, DailyTestCard + `/`, `/job-prep`, `/plans`), **3b** (`step-3b`: `/vu`, `/board`, `/board/9th..12th`), **3c** (`step-3c`: `/career`, `/career/cv`, `/apply-service`, `/past-papers`, `/current-affairs`, `/mock-series`, `/sarkari-services`). Har hissa alag REPORT/PR/approval. PROGRESS mein Qadam 3 ka tick sirf 3c ke baad.
- **Schemes:** abhi koi `/sarkari-services/<scheme>` page nahin; `schemes.json` khali; owner baad mein tasdeeq shuda schemes dega (intent 13).
- **Mazmoon:** 300+ alfaz Claude likhe ga, sirf aam rehnumai + "official ishtihar dekhein"; owner har hisse ke REPORT mein matn tasdeeq kare.
- **Bahar:** streak reminder (Qadam 10), Home taza jobs (Qadam 13), cart button band (Qadam 4), JSON-LD (Qadam 15).

### 16 Nov 2026 — Qadam 3a: shared components + `/`, `/job-prep`, `/plans` (branch `step-3a`, REPORT diya, approval baqi)

- **Kya bana:** `src/lib/phone.ts` (normalizeLocal, toIntl, toDisplay, last4, waLink) + `tests/phone.test.ts`; Footer/ProductCard ab phone.ts istemal karte hain; `catalog.ts` mein `productPage()` aur `DOOR_LABEL`; components `Breadcrumbs`, `DoorCard`, `DailyTestCard`, `OrderSteps`, `TrustStrip`; pages Home (4 darwaze, test card, packs, 4 qadam, "GVS kya karti hai", FAQ, bottom ad), `/job-prep` (8 links + qeemat catalog se, 300+ alfaz, FAQ, top+bottom ad), `/plans` (darwaze-war rate list, TrustStrip, koi ad nahin).
- **Naya test** `tests/pages.test.ts` (dist/client se): ek H1, title/description = seo.json, NO_ADS pages par ad nahin, SEO pages par 300+ alfaz (FAQ/ad ke baghair) aur 3+ andaruni links, max 3 ad slots. **verify ki tarteeb badli:** scope → typecheck → build → test → bundle.
- **Jaanch:** verify ✅ (33 pass); alfaz: `/` 519, `/job-prep` 346, `/plans` 343; JS 1.0-1.3 KB, CSS 4.8 KB; 360px screenshots saaf.
- **Owner ke liye flag:** TrustStrip "Pehle namoona dekhein" spec ki shart hai, lekin asal namoone abhi nahin — launch (Qadam 17) se pehle owner namoone de, warna yeh wada adhoora (usool 7).
- **Agla:** owner matn tasdeeq + approve → push `step-3a` → PR #3 → merge → `step-3b`.
- **Natija:** owner ne 3a merge kiya (PR #3, `a5e4fde`; git se tasdeeq).

### 16 Nov 2026 — Qadam 3b: `/vu`, `/board`, `/board/9th..12th` (branch `step-3b`, REPORT diya, approval baqi)

- **Kya bana:** `FieldInput.astro` (ProductCard se nikala hua khana); ProductCard ke naye props `preset` (hidden input + likha hua, maslan class) aur `sharedFields` (page par ek khana, card mein `data-shared-fields` — Qadam 4 ka cart isi se value lega); `/vu` (ek course code khana, includes se banti muqable ki table, 4 cards, 300+ alfaz, FAQ, top+bottom ad); `BoardClassPage.astro` (shared dhancha, har class ka matn slot se); `/board` aur 4 class pages, har ek ka alag matn aur mazameen.
- **Tests:** pages.test mein izafa: board class preset hidden input, `/vu` par `courseCode` sirf ek, 4 class pages ka Jaccard < 0.7 (intent 14.4). Test ne `/board` ke 285 alfaz pakde → paragraph joda.
- **Jaanch:** verify ✅ (51 pass); alfaz `/vu` 514, `/board` 327, class pages 343-361; har page 2 ads (top+bottom); 360px screenshots; "Class: 10th" ka space theek kiya (`{' '}`).
- **Note:** VU table 360px par apne box mein horizontal scroll hoti hai (page nahin) — jaan boojh kar.
- **Agla:** owner matn tasdeeq + approve → push `step-3b` → PR #4 → merge → `step-3c`.
