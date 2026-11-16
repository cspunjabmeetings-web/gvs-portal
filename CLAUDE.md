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
- **Commands:** `npm run test`, `npm run check:scope` (Qadam 1 ke baad `dev`, `build`, `typecheck` bhi).
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
