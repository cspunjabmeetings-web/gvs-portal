# GVS Academy Portal: Intent

| | |
|---|---|
| **Document** | intent.md (product ka bunyadi document) |
| **Version** | 1.0 (final compile) |
| **Tareekh** | 16 November 2026 |
| **Owner** | GVS Academy |
| **Haalat** | Version 1 ki development ke liye manzoor |

---

## Fehrist

**Hissa A: Bunyad**
0. Is document ko kaise istemal karein
1. Khulasa
2. Maqsad aur kamyabi ke paimane
3. Scope: Version 1 mein kya hai, kya nahin
4. Portal kis ke liye hai
5. Research se nikle faislay
6. Mafrooze aur pabandiyan

**Hissa B: Product (Version 1)**
7. Tay shuda values (number, rates, waqt)
8. Portal ke hisse
9. Order, tracking aur admin
10. Muft content aur jobs (admin se, text format mein)
11. Visitor ka tajurba (UI aur history)

**Hissa C: Technical (Version 1)**
12. Technical spec
13. Pages ki poori list
14. SEO
15. Ad ki jagahein
16. Design ke usool
17. Non-functional zaroorat (raftar, security, waghera)
18. Analytics aur naap tol

**Hissa D: Delivery aur chalana**
19. Build ki tarteeb
20. Mukammal hone ki jaanch
21. Launch ka mansooba
22. Rozana operations
23. Khatre aur un ka hal
24. Kirdar aur zimmedariyan

**Hissa E: Aage ke versions**
25. Version 2: PSID aur automation
26. Version 3: advance balance aur account

**Hissa F: Usool aur hawale**
27. Zaban aur lehja
28. Usool (yeh nahin tootein ge)
29. Khule aur tay shuda faislay
30. Istilahat
31. Sources
32. Tabdeeliyon ka record

---

# Hissa A: Bunyad

## 0. Is document ko kaise istemal karein

### 0.1 Yeh document kya hai

Yeh portal ka **"kyun aur kya"** hai: kis ke liye, kya banega, kin usoolon par, aur kis tarteeb se. Code ki tafseel (har function, har component) is ke baad bannay wali `spec.md` mein jaye gi, aur rang, fonts aur screens `design.md` mein.

### 0.2 Sach ka darja

1. Owner ki taza hidayat
2. `intent.md` (yeh document)
3. `spec.md` aur `design.md`
4. Code

Jahan code aur yeh document takrayen, wahan yeh document sahih hai, jab tak owner khud tabdeeli na kare. Har tabdeeli section 32 mein darj ho aur version number barhe.

### 0.3 VS Code mein kaam ka tareeqa

- Project folder ki jar mein yeh files hon:
  - `CLAUDE.md`: Claude ke liye mukhtasar hidayat: "Pehle intent.md, spec.md, design.md parho. Roman Urdu mein samjhao. Ek waqt mein ek qadam."
  - `intent.md`: yeh document.
  - `spec.md`: is document se bani technical tafseel aur kaam ki list (section 19 ke qadmon ke mutabiq).
  - `design.md`: rang, fonts, components aur screens (section 16 ke usool par).
- Claude ko ek waqt mein ek qadam dein (section 19). Har qadam ke baad chala kar dekhein, phir agla.
- **Owner ki manzoori ke baghair na hon:** production par deploy, live database mein tabdeeli (migration), files mitana, GitHub par push, secrets badalna.
- **Bina pooche ho sakte hain:** files parhna, `src/` mein code likhna, local par `dev`, `test` aur `build` chalana.

## 1. Khulasa

GVS Academy (WhatsApp Business aur Facebook page pehle se maujood) ke liye ek mobile-first web portal, jo teen kaam karta hai:

1. **Traffic laata hai:** rozana muft MCQs test, muft mock tests, notes aur sarkari jobs.
2. **Bechta hai:** VU packs, MCQs packs, past papers, board papers, CV aur apply services, khuli rate list ke sath.
3. **Order WhatsApp tak pohanchata hai:** bina sign up ke order, WhatsApp par tayyar message, order tracking aur timer, aur owner ke liye mobile admin panel.

Ek jumle mein: **"Ek portal, har student: tayyari bhi, form bhi, kaam bhi."**

| Version | Kya banega | Payment kaise |
|---|---|---|
| **1 (abhi)** | Poora portal, WhatsApp order, tracking aur timer, admin panel (orders, notifications, content, jobs, settings), muft MCQs, mock tests aur notes, SEO, ad ki jagahein, Version 2 ki tayyari | WhatsApp par JazzCash/Easypaisa; owner haath se "Paid" karta hai |
| **2** | Har order ka PSID (1Bill voucher); WaSender aur Claude agent se automation | PSID se payment par order khud "Paid"; file khud WhatsApp par |
| **3** | Advance balance (1Bill Top-up), student account, history har device par, GVS Pass | Balance bharein aur us se khareedein |

## 2. Maqsad aur kamyabi ke paimane

### 2.1 Maqsad

1. GVS Academy ko ek pakki, qabil-e-aitmad online pehchan dena.
2. Muft content se rozana aane wale visitors banana (traffic), jo baad mein AdSense ki kamai ka zariya bhi bane.
3. Paid orders ko asaan, saaf aur trackable banana.
4. Owner ka rozana kaam halka karna (admin panel, aur Version 2 mein automation).

### 2.2 Kamyabi ke paimane (KPIs)

**Pehle 30 din sirf naap kar "baseline" banayein** (shuruati figures). Phir har paimane ka mahana hadaf owner tay kare. Yeh research se andaza lagane ke bajaye asal data par faisla hai.

| Paimana | Kaise naapein | Hadaf |
|---|---|---|
| Rozana visitors | Analytics | Baseline ke baad |
| Rozana test mukammal karne wale | `daily_test_complete` event | Baseline ke baad |
| Wapas aane wale visitors (7 din mein) | Analytics | Baseline ke baad |
| Orders har hafte | Admin panel | Baseline ke baad |
| Order se WhatsApp tak (`whatsapp_opened` / `order_created`) | Analytics + admin | Baseline ke baad |
| Paid orders ka hissa (`paid` / kul orders) | Admin panel | Baseline ke baad |
| **Waqt par delivery** (wade se pehle `complete`) | Admin panel | **95% ya zyada** (yeh owner ke ikhtiyar mein hai, is liye pehle din se) |
| Mobile PageSpeed (Performance, SEO) | Lighthouse | **90 ya zyada** |
| Search Console impressions aur clicks | Search Console | Baseline ke baad |

### 2.3 Hafta war jaiza

Har hafte 15 minute: upar ke paimane, sab se zyada bikne wali cheezein, kaun se orders cancel hue aur kyun, aur kaun sa muft content sab se zyada chala. Isi se agle hafte ka content aur ishtihar tay ho.

## 3. Scope: Version 1 mein kya hai, kya nahin

**Version 1 mein hai:**

- Home aur chaar darwaze; saare product aur service pages; rate list
- Order list (cart), naam aur number se order, WhatsApp tayyar message
- Order tracking (order number + aakhri 4 hindse), darje aur timer
- Admin panel: Orders, Notifications, Content, Jobs, Settings
- Rozana muft test, mazmoon-war practice, muft mock tests, muft notes, bookmarks aur history (browser mein)
- Jobs: admin se post, documents khud WhatsApp message mein, akhri tareekh ke baad band
- SEO (static aur database dono pages), sitemap, schema
- Ad ki jagahein, GVS ke apne ishtihar ke sath
- About, Contact, Privacy, Terms, Order kaise karein
- Version 2 ki tayyari: notifications, band agent endpoints, files ke naam ka usool

**Version 1 mein nahin (jaan boojh kar):**

- Customer ka sign up ya login (Version 3)
- Online payment gateway ya PSID (Version 2)
- Paid files portal par upload ya download (sab WhatsApp par)
- WhatsApp ke khud-ba-khud messages, WaSender (Version 2)
- Advance balance, GVS Pass (Version 3)
- AdSense (traffic aur content ke baad)
- Admin se qeemat badalna (catalog file se; section 12.3)
- Har VU course code ka alag page (sirf asal content wale baad mein; section 14.4)
- Interview tayyari aur law/commerce notes ka order (qeemat tay hone tak)
- Urdu script (Nastaliq) ka version; sirf Roman Urdu aur English
- Mobile app (portal hi mobile par app jaisa chale)

## 4. Portal kis ke liye hai

| Visitor | Wo kya dhoondta hai | GVS use kya deta hai |
|---|---|---|
| Job ki tayyari karne wala (PPSC, FPSC, NTS) | MCQs, past papers, ishtihar, apply ka tareeqa | Rozana muft test, muft mock tests, notes, MCQs packs, paid apply service |
| VU student | Course code ke notes, midterm aur final ki tayyari | Quick, Smart, Complete, Topper packs |
| School/college student (9th se 12th), teacher, academy | Test papers, guess papers | Board pattern ke papers |
| Aam shehri | Sarkari scheme ya form mein madad | Form bharwana, documents ki rehnumai |
| Job-seeker | CV, cover letter, interview | Career Desk services |

Visitor zyada tar naujawan hai, mobile par hai, aur aksar dehi ilaqe se hai. Is liye zaban Roman Urdu, jumle chhote, aur page halka.

## 5. Research se nikle faislay

Tafseeli figures aur sources "GVS Academy Market Research Result Sheet" mein hain.

| Natija | Saboot | Portal par faisla |
|---|---|---|
| Sab se bari talab sarkari jobs aur test tayyari ki hai | PPSC ko 2024 mein 762,392 applications milin | Pehla darwaza "Job ki tayyari"; home par rozana MCQ test |
| Asal rukawat aitmad hai, payment nahin | 91% logon ne 6 mahine mein online khareedari nahin ki; online buyers mein 60% cash on delivery | Muft namoona, order tracking, likhi hui policy, koi sign up nahin |
| Wallet aam hai | JazzCash 21 million aur Easypaisa 18 million mahana users | Card gateway nahin; JazzCash, Easypaisa, Raast |
| Karobar WhatsApp par hota hai | WhatsApp accounts mein business ka hissa 21.7% (ek tajziye ke mutabiq) | Checkout nahin, tayyar message ke sath WhatsApp order |
| Website traffic Facebook se aata hai | Social referral ka 87% Facebook se | Har page share ke qabil, saaf title aur tasveer ke sath |
| Muft MCQs har jagah hain | testpoint.pk par taqreeban 520,000 visits mahana | Muft content ki UI muqabil sites se behtar ho; bechna hai waqt ki bachat aur done-for-you kaam |
| VU ka maidan nisbatan khula hai | 200,000+ students; bare edtech players entry tests par hain | Course code se order portal ki khaas pehchan |

Priority tarteeb (result sheet ke score ke mutabiq): paid apply service, sarkari schemes mein madad, VU packs, competitive exam packs, phir baqi.

## 6. Mafrooze aur pabandiyan

**Mafrooze (jo hum sach maan kar chal rahe hain; ghalat niklein to plan badle):**

- Zyada tar visitors Android phone aur Chrome par hain.
- Customer WhatsApp par baat aur JazzCash/Easypaisa se payment ke liye tayyar hai.
- Owner har order 1 se 2 ghante mein de sakta hai (kaam ke auqaat mein).
- Owner ke paas packs banane ka nizam pehle se hai (maujooda Claude skills, maslan VU packs aur board papers ke liye).
- Shuru mein orders itne hain ke owner akela sambhal sake.

**Pabandiyan:**

- **Kharcha kam se kam:** free ya sasti hosting; server par sirf text data.
- **Ek developer:** owner khud, VS Code mein Claude ke sath. Is liye saada, kam hisson wala nizam.
- **Number abhi zaati hai:** GVS ke naam ki SIM aane tak; is liye number admin se badalne ke qabil.
- **NTN aur business account abhi nahin:** is liye online gateway Version 2 mein.
- **Content owner ki tasdeeq ke baghair live nahin.**

---

# Hissa B: Product (Version 1)

## 7. Tay shuda values (number, rates, waqt)

### 7.1 WhatsApp number

- Abhi ka number: **03404905266**
- Link ke liye international shakal: **923404905266** (`https://wa.me/923404905266`)
- GVS Academy ke naam ki nayi SIM aane par number **admin panel ki Settings** se badla jaye ga. Is liye number code mein kahin hard-code nahin hoga; hamesha settings se parha jaye ga (section 12.4).

### 7.2 Rate list (Version 1)

Yeh rates research sheet ke "Revenue Model" se hain aur owner ne manzoor kiye hain.

| Code (id) | Product / Service | Darwaza | Qeemat (Rs) | Note |
|---|---|---|---|---|
| `mcq-pack` | MCQs pack (ek mazmoon) | Job ki tayyari | 250 | Customer mazmoon chunta hai |
| `past-papers` | Solved past papers (ek post / ek test) | Job ki tayyari | 400 | Customer post ya test ka naam likhta hai |
| `current-affairs` | Mahana current affairs PDF | Job ki tayyari | 120 | Customer mahina chunta hai |
| `mock-series` | Mock test series (mahana) | Job ki tayyari | 700 | WhatsApp group mein shamil kiya jata hai; customer se sirf naam aur number |
| `vu-quick` | VU Quick pack | VU Corner | 250 | Course code zaroori |
| `vu-smart` | VU Smart pack | VU Corner | 350 | Course code zaroori |
| `vu-complete` | VU Complete pack | VU Corner | 450 | Course code zaroori |
| `vu-topper` | VU Topper pack | VU Corner | 550 | Course code zaroori |
| `board-paper` | Board test paper (9th se 12th) | Board Classes | 300 | Class, mazmoon, chapters/units, kul number |
| `cv-cover` | CV + cover letter | Career Desk | 500 | |
| `job-apply` | Online job apply service | Career Desk / Jobs | 300 | Kisi job post se aaye to fee us post ki "Hamari fee" (section 10.6). Sarkari fee alag, official challan par |
| `scheme-help` | Sarkari scheme / form mein madad | Sarkari Services | 300 | Sarkari fee alag, official challan par |

Wazahat:

- Research sheet mein "VU pack (ausat) Rs. 400" tha. Chaar packs ki qeematein (250, 350, 450, 550) isi ausat ke gird hain. Owner badalna chahe to sirf catalog file badle (section 12.3).
- **Interview tayyari** ki qeemat abhi tay nahin. Version 1 mein yeh service "Rabta karein" ke sath dikhe, bina qeemat ke, aur order list mein na jaye.
- **Law aur commerce notes** Version 1 ki rate list mein nahin.
- Har qeemat ke sath likha ho: "Qeemat mein sarkari fee shamil nahin" jahan lagu ho (`job-apply`, `scheme-help`).

### 7.3 Delivery ka waqt (timer)

Owner har order 1 se 2 ghante mein de sakta hai. Faisla:

- **Wada 2 ghante ka**, har product ke liye. Kam wada kar ke zyada dena aitmad banata hai; 1 ghante mein milne par customer khush hota hai, 2 ghante ke wade par 2.5 ghante lagna naraz karta hai.
- **Kaam ke auqaat:** subah 9:00 se raat 10:00 tak, Pakistan ka waqt (Asia/Karachi), hafte ke saton din.
- Timer sirf kaam ke auqaat mein chalta hai. Misalein:
  - 3:00 PM par Paid → wada 5:00 PM.
  - 9:30 PM par Paid → 30 minute aaj, 90 minute kal → wada kal 10:30 AM.
  - 11:00 PM par Paid → kal 9:00 AM se ginti → wada kal 11:00 AM.
- `mock-series` mein "deliver" ka matlab WhatsApp group mein shamil karna aur pehla test bhejna hai; wada wohi 2 ghante.
- Jin services mein customer ke documents chahiye (`job-apply`, `scheme-help`, `cv-cover`): owner "Paid" tab dabaye jab **payment aur zaroori documents dono** mil jayen.
- Kaam ke auqaat, default waqt (120 minute) aur har product ka waqt admin Settings se badla ja sake.

### 7.4 Baqi tay values

| Cheez | Value |
|---|---|
| Order number ki shakal | `GVS-YYMM-NNNN`, maslan `GVS-2611-0042` |
| Bina payment order ka khud cancel | 48 ghante baad |
| Ek order mein zyada se zyada cheezein | 10 |
| Ek mobile number se naye orders ki had | 5 orders har ghante |
| Job post ki tasveer ka zyada se zyada size | 150 KB (portal upload se pehle khud chhota karta hai) |
| Band job ki tasveer khud mitne ka waqt | Akhri tareekh ke 30 din baad |
| Purane orders se naam aur number mitana | `complete`/`cancelled` ke 90 din baad |
| Time zone | Asia/Karachi |
| Currency | PKR, sirf poore rupay |

## 8. Portal ke hisse

Home page ek sawal poochta hai: **"Aap kon hain?"** aur chaar darwaze dikhata hai.

1. **Job ki tayyari.** Rozana 10 MCQs, muft mock tests, mazmoon-war practice, muft notes, MCQs packs, solved past papers, mahana current affairs, paid mock test series.
2. **VU Corner.** Course code likhein (maslan CS101), chaar packs mein se chunein: Quick, Smart, Complete, Topper. Har pack mein kya hai, saaf likha ho, aur muft namoona.
3. **Board Classes.** Class, mazmoon aur chapters chun kar test paper ka order. Students ke sath teachers aur academies ke liye bhi.
4. **Kaam karwana hai.** Do hisse:
   - *Career Desk:* CV, cover letter, online job apply, interview tayyari.
   - *Sarkari Services:* scheme aur form mein madad, ahliyat aur documents ki list, official link.

In ke ilawa:

- **Jobs.** Owner ke post kiye hue official ishtihar: tasveer ya official link, documents, tareeqa, akhri tareekh ki ulti ginti, aur "Hum apply kar dein" (section 10.6).
- **Plans.** Saari qeematein ek jagah.
- **Order track karein.** Order number se status aur timer.
- **Meri history.** Visitor ke tests, streak aur bookmarks (us ke browser se).

## 9. Order, tracking aur admin

### 9.1 Faisla: sign up ya login nahin

Version 1 mein customer ko account banane ki zaroorat nahin. Wajah:

- Research ke mutabiq asal rukawat aitmad hai. Har izafi qadam (password, OTP, form) order chhorne ki wajah banta hai.
- Customer ki pehchan us ka WhatsApp number hai; baat cheet aur payment wahin hoti hai.
- Kam data rakhna mehfooz bhi hai aur sasta bhi (usool 5).

Muft tests aur bookmarks ki history visitor ke browser mein rehti hai (section 11.4). Account Version 3 mein aaye ga.

### 9.2 Customer ke qadam

1. Customer product page par zaroori cheezein bharta hai (maslan VU course code, ya board paper ki class aur mazmoon) aur "Order list mein daalein" dabata hai. Mock test series jaisi cheezon mein kuch bharna nahin parta.
2. Order list (cart) har page par neeche ek patti mein dikhti hai: cheezon ki ginti aur kul raqam. Yeh browser mein mehfooz rehti hai.
3. "WhatsApp par order karein" dabane par ek chhota form khulta hai, sirf do cheezein:
   - Naam
   - WhatsApp number (03XX-XXXXXXX)
4. **Order WhatsApp khulne se pehle server par mehfooz hota hai.** Customer WhatsApp tak na bhi aaye, to us ka naam, number aur order admin panel mein maujood hota hai, aur owner khud rabta kar sakta hai (9.7).
5. Server qeemat khud catalog se hisab karta hai (browser ki bheji qeemat par bharosa nahin) aur order number wapas deta hai.
6. Screen par order number bara dikhta hai, copy button ke sath, aur "WhatsApp par bhejein" ka bara button. Dabane par WhatsApp tayyar message ke sath khulta hai (9.3), aur portal record karta hai ke button daba.
7. Payment WhatsApp par JazzCash ya Easypaisa se; customer screenshot bhejta hai.
8. Customer "Order track karein" par order number aur apne number ke aakhri 4 hindse daal kar status dekhta hai. WhatsApp message ke link mein order number pehle se bhara hota hai.

Agar WhatsApp na khule (maslan desktop par WhatsApp nahin), to screen par number aur message dono copy karne ke button hon, aur likha ho: "Fikr na karein, aap ka order hamare paas aa gaya hai. Hum jald aap se WhatsApp par rabta karenge."

**Agar server jawab na de** (internet ya server ki kharabi): ghalti ka saaf paigham, aur "WhatsApp par seedha order bhejein" ka button jo bina order number ke wohi message bheje. Order kabhi zaya na ho.

### 9.3 WhatsApp message ka template

```
Assalam o Alaikum GVS Academy,
Mera order: GVS-2611-0042

1. VU Smart pack (CS101) - Rs. 350
2. MCQs pack (Pakistan Studies) - Rs. 250

Kul: Rs. 600
Naam: Ali Raza

Order track karein: https://<domain>/track?id=GVS-2611-0042
```

- Cheezon ke sath customer ki bhari hui tafseel (course code, mazmoon, class) ho.
- Job apply order mein us job ki **required documents ki list khud** message mein aaye (section 10.6).
- Message mein customer ka phone number na likha jaye; WhatsApp khud dikhata hai.

### 9.4 Order ke darje (status)

| Darja (code) | Kab | Customer ko kya dikhta hai |
|---|---|---|
| Order mila (`new`) | Customer ne order banaya | "Payment ka intezar hai." Payment ke qadam: JazzCash/Easypaisa number, raqam, aur "screenshot WhatsApp par bhejein". Documents wali services mein documents ki list bhi |
| Paid (`paid`) | Owner ne payment (aur zaroori documents) dekh kar tick kiya | Hara nishan "Payment mil gayi" aur ulti ginti ka timer: "Aap ka order taqreeban 1 ghanta 20 minute mein mil jaye ga" |
| Pending / kaam jari (`pending`) | Owner ne kaam shuru kiya | Timer chalta rehta hai; owner ka note (agar ho) |
| Complete (`complete`) | File ya kaam WhatsApp par bhej diya | "Order mukammal. File aap ke WhatsApp par bhej di gayi hai." Neeche "Dobara order karein" |
| Cancel (`cancelled`) | Owner ne cancel kiya, ya 48 ghante payment na aayi | "Order cancel ho gaya" aur wajah |

Darjon ke usool:

- Aam rasta: `new → paid → pending → complete`. Owner `paid` se seedha `complete` bhi kar sake.
- `cancelled` kisi bhi darje se ho sakta hai, siwaye `complete` ke.
- Owner ghalti theek karne ke liye ek darja peeche bhi le ja sake.
- **"Paid" sirf owner karta hai**, Version 1 mein bhi aur Version 2 ke agent ke sath bhi (25.12). Payment ki tasdeeq insaan ki zimmedari hai, aur woh wallet app mein asal raqam dekh kar hoti hai, sirf screenshot se nahin (section 22.2).
- Har tabdeeli ka waqt record ho (order ki history) aur ek notification bane (12.5).

Timer ke usool:

- Timer `paid` hone ke waqt se chale, section 7.3 ke kaam ke auqaat ke hisab se.
- Order mein kai cheezein hon to un mein se sab se lamba waqt liya jaye.
- Owner har order ka wada (`due_at`) haath se badal sake.
- Waqt guzar jaye aur order complete na ho, to manfi ginti nahin; likha aaye: "Thori der ho gayi hai, hum aap se WhatsApp par rabte mein hain."
- Track page har 60 second baad status khud dobara le.

### 9.5 Files portal par nahin

Paid files (packs, papers) portal ke server par upload nahin hongi. Wajah server ka kharcha aur storage hai. Har paid file WhatsApp par bheji jaye gi; portal sirf order ka record aur darja rakhta hai.

Portal par sirf yeh halki cheezein rehti hain: muft content ka text (section 10), job posts ki chhoti tasveerein (150 KB tak, 30 din baad khud mitne wali), aur muft namoone ki 2-3 tasveerein.

Paid files owner ke apne computer ke folder mein rahein, section 25.13 ke naam ke usool ke mutabiq.

### 9.6 Admin panel: aam baatein

- Pata: `/admin` (search engines ke liye band: `noindex`, aur robots.txt mein bhi).
- Sirf GVS ke liye, password ke sath. Ghalat password par 5 koshishon ke baad 15 minute ki rok.
- Mobile par chale, kyun ke zyada kaam phone se hoga. Bare, ungli se dabne wale button.
- Tabs: **Orders**, **Notifications**, **Content**, **Jobs**, **Settings**.
- Upar ghanti ka nishan, na-parhi notifications ki ginti ke sath. Admin panel khula ho to har 60 second baad naye orders check kare, aur naye order par halki awaz aur browser notification de (agar owner ne ijazat di ho).

### 9.7 Orders tab

- Upar din ka khulasa: aaj ke naye orders, paid, mukammal, aur aaj ki kamai (sirf `paid`, `pending`, `complete` ki raqam).
- Filter: Naye, **WhatsApp nahin khola**, Paid, Pending, Complete, Cancel, Sab. Search: order number, naam, ya phone ke hindse.
- Har order card par: order number, naam, poora WhatsApp number, cheezein aur tafseel, kul raqam, kitni der pehle aaya, darja, timer, aur do nishan:
  - **WhatsApp khola:** haan / nahin. (Customer ne "WhatsApp par bhejein" dabaya. Is se yeh pakka nahin ke message bheja bhi, lekin "nahin" wale orders ko pehle dekhna chahiye.)
  - **Rabta hua:** owner khud tick karta hai jab customer se baat ho jaye.
- Har card par button: **Paid**, **Pending**, **Complete**, **Cancel**. Ek tap.
  - "Paid" par chhoti tasdeeq: hisab shuda wada dikhe (maslan "Wada: aaj 5:00 PM"), zaroorat ho to badlein, phir tasdeeq.
  - "Cancel" par wajah likhne ki jagah (customer ko dikhegi).
- **Khud rabta karein** button: customer ka WhatsApp chat tayyar message ke sath khule. Darje ke hisab se message:
  - `new` aur WhatsApp nahin khola: "Assalam o Alaikum Ali, aap ne GVS Academy par order GVS-2611-0042 (Rs. 600) diya tha. Payment ke liye JazzCash/Easypaisa: ... Koi sawal ho to isi chat par poochein."
  - `complete`: "Aap ka order GVS-2611-0042 mukammal ho gaya hai. Shukriya!"
- Har order par note likhne ki jagah (customer ko dikhane ya sirf andaruni, do alag khane).

### 9.8 Notifications tab

- Har naya order, har "WhatsApp khola", har darje ki tabdeeli, aur khud cancel hone wale orders yahan ek list mein, naye upar.
- Har notification par order ka link aur "Parh liya" ka nishan; "Sab parh liye" ka button.
- Yehi notifications Version 2 mein Claude agent bhi parhega (25.12).

### 9.9 Settings tab

- WhatsApp number (11 hindse, `03` se shuru; ghalat ho to mehfooz na ho).
- JazzCash aur Easypaisa account number aur account title.
- Kaam ke auqaat (shuru aur khatam).
- Default delivery waqt (minute) aur har product ka waqt.
- Bina payment order ka khud cancel (ghante).
- Site par upar patti ka elaan (maslan "Eid par 3 din order band"), on/off.
- Orders lena band karne ka switch (chhutti ke liye): on ho to order button ki jagah elaan dikhe; jin ki order list mein cheezein hain wo mehfooz rahein.
- Admin password badalne ka tareeqa (Cloudflare secret; spec.md mein qadam).
- Agent (Version 2): on/off aur API key banana/badalna. Version 1 mein dikhe lekin band rahe.

### 9.10 Customer ka cancel aur refund (tajweez, owner ke alfaz baqi)

- Customer portal par khud cancel nahin karta; WhatsApp par kehta hai, owner admin se cancel karta hai.
- **Tajweez shuda refund policy** (Terms page ke liye; owner aakhri alfaz tay kare):
  - Payment ke baad aur kaam shuru hone se pehle cancel: poori raqam wapas.
  - Ghalat ya adhoori file mili: sahih file muft, ya poori raqam wapas.
  - Wade ke 24 ghante baad bhi order na mila: customer chahe to poori raqam wapas.
  - Digital file mil jane ke baad "pasand nahin aayi": refund nahin, kyun ke file wapas nahin hoti; is liye har pack ka muft namoona pehle dikhaya jata hai.
  - Sarkari fee (challan) GVS wapas nahin kar sakta; woh sarkari idare ke usool par hai.
- Admin mein refund ke liye: order `cancelled`, wajah "Refund kiya", aur admin note mein raqam aur tareeqa.

## 10. Muft content aur jobs (admin se, text format mein)

### 10.1 Faisla

- Owner muft content (MCQs, mock tests, notes, jobs) **sirf text** mein daalta hai: admin ke **Content** ya **Jobs** tab mein text paste kare, ya `.txt` file upload kare. PDF upload nahin hota.
- Text sirf owner ke liye hai. **Visitor ko text, star ya format kabhi nahin dikhta**; portal is text ko khoobsurat, interactive pages mein badalta hai (section 11).
- Save se pehle portal **preview** dikhata hai: kitne sawal/notes/jobs mile, har ek visitor ko kaisa dikhega, aur ghaltiyan line number ke sath, maslan "Line 14: sawal 3 mein sahih jawab par * nahin laga". Ghalti wale hisse save nahin hote; sahih hisse save ho sakte hain.
- Owner Claude se kahe "is format mein PPSC Pakistan Studies ke 50 MCQs bana do", phir jaanch kar paste kare. **Har sawal ki tasdeeq owner ki zimmedari hai.**
- Content database mein text ki shakal mein rehta hai; naya content daalte hi bina dobara deploy ke live hota hai (section 12.1).
- Admin se har cheez dekhi, chhupayi, badli aur mitayi ja sake.

### 10.2 Format ke aam usool

- Har cheez `# QISM` se shuru hoti hai: `# MCQ`, `# MOCK`, `# NOTE`, `# JOB`.
- Har cheez ke baad ek line par `---`.
- Har field `Naam: value` ki shakal mein. Bare chhote harf ka farq nahin.
- Ek file ya paste mein kai cheezein ho sakti hain.
- Khali lines ki parwah nahin.
- Ek paste mein zyada se zyada 500 cheezein (bari cheezein hisson mein).

### 10.3 MCQ ka format

```
# MCQ
Mazmoon: Pakistan Studies
Sawal: Qarardad-e-Pakistan kis saal manzoor hui?
A) 1930
B) 1940*
C) 1947
D) 1956
Tashreeh: 23 March 1940 ko Lahore mein manzoor hui.
Mushkil: Aasan
---
```

- **Mazmoon:** in mein se ek: General Knowledge, Pakistan Studies, Islamiat, English, Everyday Science, Current Affairs, Computer, Urdu, Maths. (Admin Settings se list badal sake.)
- **Options:** 2 se 5 (A se E). **Sahih jawab ke aakhir mein `*`**, sirf ek par.
- **Tashreeh:** ikhtiyari lekin behtar; jawab ke baad visitor ko dikhti hai.
- **Mushkil:** ikhtiyari: Aasan, Darmiyana, Mushkil.
- **Current Affairs** ke sawal par `Tareekh: 2026-11-16` zaroori, taake purana sawal pehchana ja sake.
- Import ke waqt ek checkbox: "Main ne yeh sawal jaanch liye hain." Tick na ho to sawal `verified = false` mein jaate hain aur visitors ko nahin dikhte.
- Ek jaisa sawal pehle se maujood ho to preview mein khabardari.

### 10.4 Mock test ka format

```
# MOCK
Naam: PPSC Educator Mock Test 1
Waqt: 30 minute
Khulasa: PPSC Educator ke pattern par 25 sawal, mazmoon-war result ke sath.
---
# MCQ
Mazmoon: Pakistan Studies
Sawal: ...
A) ...
B) ...*
---
# MCQ
...
---
# END MOCK
```

- Mock ke sawal MCQs bank mein bhi jaate hain (practice mein dikhte hain).
- Owner mock ko chhupa sake ya mita sake.
- Yeh **muft** mock tests portal par chalte hain. Paid mock test series (`mock-series`) WhatsApp par jati hai.

### 10.5 Muft notes ka format

```
# NOTE
Unwan: Pakistan ke Aain ki Tareekh (1956, 1962, 1973)
Mazmoon: Pakistan Studies
Khulasa: Teeno aain kab bane, kis ne banaye, aur in ki ahem baatein. PPSC aur FPSC ke liye.
Matn:
## 1956 ka Aain
- 23 March 1956 ko nafiz hua
- ...
## 1962 ka Aain
...
---
```

- `Matn:` ke baad saada text: `##` heading, `-` list, `**mota**` alfaz.
- **Khulasa** page ki meta description banta hai (155 harf tak), is liye keyword ke sath likhein.
- Har note ka apna page aur URL: `/notes/<unwan-se-bana-slug>`.
- Note ke neeche khud: us mazmoon ke 5 MCQs ka chhota quiz, aur munasib paid pack ki peshkash.

### 10.6 Job post ka format (Jobs tab)

```
# JOB
Idara: PPSC
Post: Educator (BPS-14)
Shehar: Punjab bhar
Taleem: BA / BSc, 2nd division
Akhri tareekh: 2026-12-05
Official link: https://ppsc.gop.pk/...
Ishtihar link: https://drive.google.com/...
Sarkari fee: 700
Hamari fee: 300
Apply service: Haan
Documents:
- CNIC dono taraf ki tasveer
- Matric aur Inter ki degree
- Domicile
- Passport size tasveer
Tareeqa:
1. ppsc.gop.pk par account banayen
2. Online form bharein
3. Challan jama karwayen
---
```

- **Zaroori fields:** Idara, Post, Akhri tareekh, Official link.
- **Ishtihar ke teen tareeqe:**
  1. **Ishtihar link:** PPSC ki site, Google Drive ya kahin aur rakhi ishtihar ka link. Bari ishtihar ke liye yehi behtar.
  2. **Tasveer:** Jobs tab mein "Tasveer lagayen" ka button. Portal tasveer ko upload se pehle browser mein hi chhota kar ke WebP (150 KB tak) bana deta hai.
  3. Dono.
- **Hamari fee:** khali chhorein to default 300.
- **Apply service: Nahin** ho to "Hum apply kar dein" ka button na dikhe.
- **Documents** ki list job page par bhi dikhti hai, aur customer jab is job par "Hum apply kar dein" dabata hai to **khud uske WhatsApp message aur track page mein aa jati hai**:

```
Assalam o Alaikum GVS Academy,
Mera order: GVS-2611-0057

1. Online apply: PPSC Educator (BPS-14) - Rs. 300
   (Sarkari fee Rs. 700 alag, official challan par)

Yeh documents is chat par bhej raha hoon:
- CNIC dono taraf ki tasveer
- Matric aur Inter ki degree
- Domicile
- Passport size tasveer

Kul: Rs. 300
Naam: Ali Raza
Order track karein: https://<domain>/track?id=GVS-2611-0057
```

- **Tareeqa** job page par number wari qadam ke tor par dikhta hai (khud apply karne walon ke liye; SEO ke liye bhi acha content).
- Job post admin form se bhi ban sake (yehi fields, khane bhar kar). Dono ka nateeja ek jaisa.

**Akhri tareekh ke baad:**

- Job khud "Band ho chuka" mein chali jati hai: listing mein neeche, page par "Is post ki akhri tareekh guzar chuki hai" aur us idare ki khuli jobs ke links. Apply button band.
- Us ki tasveer akhri tareekh ke **30 din baad khud mit jati hai**.
- Jobs tab mein **"Purani jobs"** ki list: har ek par "Mitayen", aur "Sab purani mita dein" ka button (tasdeeq ke sath).
- Akhri tareekh barh jaye (aksar hota hai) to owner tareekh badal de; job dobara khul jaye.

### 10.7 Rozana test ke sawal

- Har din ke 10 sawal portal khud chunta hai: sirf `verified = true` sawal, mazameen mila jula kar, aur jo sawal pichhle 15 din mein aa chuka ho wo nahin.
- Pakistan ki tareekh par din badalta hai; us din sab visitors ke liye wohi 10 sawal.
- Owner chahe to kisi din ke 10 sawal khud chun sake ("Pin karein").
- Bank mein sawal kam par jayen (agle 7 din ke liye na hon) to admin mein khabardari.

## 11. Visitor ka tajurba (UI aur history)

### 11.1 Faisla

Muft content ki UI **attractive aur tez** ho, muqabil MCQs sites se behtar. Maqsad: visitor zyada waqt guzare, baar baar aaye, aur doston ko bheje. Is se traffic barhta hai, paid orders aate hain, aur baad mein AdSense ki kamai hoti hai. Rang aur unique color scheme design ke marhale mein tay honge (section 16).

### 11.2 MCQs aur rozana test

- **Har option ek bara card**, ungli se dabane ke qabil. Saada radio button ya star nahin.
- Jawab dete hi: sahih card hara (tick ke sath), ghalat card surkh (cross ke sath), aur sahih jawab bhi hara ho jata hai. Neeche tashreeh narmi se khulti hai.
- Upar **progress bar** ("Sawal 4 / 10") aur chal raha score.
- Halki animation (sahih par chhota sa "shabash" ka asar), lekin phone ki "kam animation" setting ka ehtiram.
- **Rozana streak:** "Aap 5 din se lagatar test de rahe hain". Aaj ka test na diya ho to home par yaad dihani.
- Aakhir mein **score card**: score, streak, aur "Aap ka sab se kamzor mazmoon: English". Button:
  - "WhatsApp par share karein" (score aur portal ke link ke sath)
  - "Ghalat sawal dobara karein"
  - "Kal phir aayein" aur munasib paid pack ki peshkash
- **Bookmark:** har sawal par nishan; "Meri history" mein sab.
- **Mazmoon-war practice** (`/mcqs/<mazmoon>`): 10-10 sawalon ke set, "Agla set" ke sath.

### 11.3 Muft mock test

- Shuru se pehle screen: naam, sawalon ki ginti, waqt, aur usool.
- **Sawalon ki palette:** 1 se N tak number; hal shuda, baqi, aur "baad mein dekhein" wale alag rangon (aur nishanon) mein. Kisi bhi number par dab kar wahan ja sakein.
- **Ulti ginti ka timer**; aakhri 5 minute mein rang badle. Waqt khatam hone par test khud jama.
- Jama karne se pehle tasdeeq: "3 sawal baqi hain. Phir bhi jama karein?"
- **Result:** kul score, feesad, waqt kitna laga, **mazmoon-war result** ("Pakistan Studies 8/10, English 4/10"), har sawal ka jawab tashreeh ke sath, aur kamzor mazmoon ke pack ki peshkash. Share ka button.
- Test ke beech page band ho jaye to wapas aane par wahin se jari (browser mein mehfooz).

### 11.4 History bina login ke (localStorage)

- Visitor ki history (rozana test ke scores, streak, mock test ke result, bookmarks, adhoora mock test, order list, us ke apne orders ke number) **usi ke browser mein** mehfooz hoti hai (`localStorage`). Server par nahin jati.
- Wohi phone aur wohi browser ho to agle din bhi sab kuch maujood. "Meri history" par "Mere orders" bhi, taake order number yaad na rakhna pare.
- Hadein ("Meri history" page par saaf likha ho):
  - Phone ya browser badalne par purani history wahan nahin hogi.
  - Browser ka data saaf karne ya incognito mode mein history mit jati hai.
- Faida: login ki rukawat nahin, server ka kharcha nahin, privacy mehfooz.
- localStorage band ya khali ho sakta hai; portal phir bhi chale, sirf history yaad na rahe.
- Version 3 mein login aane par, pehli dafa login karte waqt browser ki history account mein chali jaye gi.

### 11.5 Engagement ke doosre usool

- Har test aur note ke aakhir mein agla qadam: "Agla set", "Mutalliqa note", "Aaj ka test".
- Home par "Aap ke liye": visitor ke kamzor mazmoon ke sawal (browser history se).
- Kahin bhi zabardasti ka pop-up nahin; ad ke paas button nahin (section 15).
- Portal ko phone ki home screen par "app" ki tarah rakhne ka option (web app manifest aur icon), taake wapas aana asaan ho.

---

# Hissa C: Technical (Version 1)

## 12. Technical spec

Yeh hissa VS Code mein Claude ke liye hai, taake har session ek hi naqshe par kaam kare. Is ki mazeed tafseel `spec.md` mein bane gi.

### 12.1 Tech stack

| Hissa | Choice | Kyun |
|---|---|---|
| Framework | **Astro**, Cloudflare adapter ke sath, `static` output aur chand pages on-demand | Aam pages pehle se HTML: tez, sasta, SEO ke liye behtareen. Admin se aane wala content (jobs, notes, practice, mock tests) on-demand banta hai, taake bina deploy ke live ho |
| Styling | **Tailwind CSS** | Owner ki manzoori. Sirf istemal hone wali CSS page mein jati hai. Rang design ke marhale mein CSS variables se |
| Interactive hisse | Astro islands, chhota vanilla JS ya Preact | Quiz, mock test, cart, tracking, admin. Bhaari framework zaroori nahin |
| Hosting | **Cloudflare Pages** | Free tier, apna domain, tez CDN |
| Backend API | Astro API routes / Cloudflare Pages Functions | Usi project mein, alag server nahin |
| Database | **Cloudflare D1** (SQLite) | Free tier kaafi; sirf text data |
| Tasveerein | **Cloudflare R2** | Job posts aur namoonon ki chhoti tasveerein |
| Secrets | Cloudflare environment variables | Admin password, session key, agent key code mein nahin |
| Code ka ghar | **GitHub** (private repo) | Har tabdeeli ka record; Cloudflare khud deploy karta hai |

On-demand pages par cache (maslan 5 minute), taake har visitor par database na chale. Admin se content badalne par us page ka cache saaf ho.

Free tier ki hadein (Cloudflare Workers ki rozana requests, D1 ki reads/writes, R2 ka storage) shuru ke liye kaafi hain; launch se pehle Cloudflare ki taza hadein dekh lein aur traffic barhne par jaiza lein.

Doosra rasta (agar Cloudflare na ho): Vercel ya Netlify aur Supabase.

### 12.2 Folder structure

```
gvs-portal/
├── CLAUDE.md                 # Claude ke liye mukhtasar hidayat (0.3)
├── intent.md                 # Yeh document
├── spec.md                   # Technical tafseel aur kaam ki list
├── design.md                 # Rang, fonts, components, screens
├── astro.config.mjs          # Astro, Cloudflare adapter, Tailwind, sitemap
├── tailwind.config.mjs
├── package.json
├── wrangler.toml             # D1 aur R2 bindings
├── migrations/
│   └── 0001_init.sql         # Database tables (12.5)
├── src/
│   ├── data/
│   │   ├── catalog.json      # Products aur rates (12.3)
│   │   ├── schemes.json      # Sarkari schemes ki maloomat
│   │   ├── seo.json          # Static pages ke title, description
│   │   └── house-ads.json    # GVS ke apne ishtihar (15.2)
│   ├── lib/
│   │   ├── timer.ts          # Kaam ke auqaat wala hisab (12.7)
│   │   ├── phone.ts          # Number ki jaanch aur 92 wali shakal
│   │   ├── cart.ts           # Order list (browser)
│   │   ├── history.ts        # Visitor ki history (11.4)
│   │   ├── parser.ts         # Content ka text format (10.2 se 10.6)
│   │   ├── markdown.ts       # Notes ke Matn ko mehfooz HTML banana
│   │   ├── notify.ts         # Notifications (12.5)
│   │   └── analytics.ts      # Events (18)
│   ├── components/           # Header, Footer, AdSlot, ProductCard, CartBar, FAQ,
│   │                         # QuizCard, MockPalette, Timer, ScoreCard, JobCard...
│   ├── layouts/
│   │   └── Base.astro        # Har page ka dhancha, meta tags, schema
│   └── pages/
│       ├── ...               # Har URL ka page (section 13)
│       └── api/              # Backend endpoints (12.6)
├── tests/                    # timer, parser, phone, order ki qeemat ke tests
└── public/
    ├── robots.txt
    ├── ads.txt               # Abhi khali
    ├── manifest.webmanifest  # Home screen par rakhne ke liye
    └── images/
```

`catalog.json`, `timer.ts` aur `parser.ts` frontend aur backend dono istemal karein, taake qeemat, waqt aur format ka hisab ek hi jagah se ho.

### 12.3 Catalog file

```json
{
  "id": "vu-smart",
  "name": "VU Smart pack",
  "door": "vu",
  "price": 350,
  "deliveryMinutes": 120,
  "needsDocuments": false,
  "fields": [
    { "key": "courseCode", "label": "Course code", "type": "text", "required": true,
      "pattern": "^[A-Za-z]{2,4}[0-9]{3}[A-Za-z]?$", "example": "CS101" }
  ],
  "includes": ["Har lecture ka khulasa", "Ahem MCQs", "Past papers ke sawal"],
  "sample": "/images/samples/vu-smart.webp",
  "fileHint": "VU/{courseCode}/Smart.pdf",
  "active": true
}
```

- `fields` batata hai order se pehle customer se kya poochna hai. `mock-series` ke `fields` khali hain.
- `fileHint` batata hai ke owner ke folder mein file kahan hogi (25.13). Jo cheezein har order par nayi banti hain (board paper, CV, apply) un ka `fileHint` khali.
- `active: false` wala product na dikhe, na order ho.
- Qeemat badalne ke liye yeh file badal kar dobara deploy. Job apply ki fee job post se aati hai (10.6).
- Admin Settings ka product-wise waqt `deliveryMinutes` par ghalib hai.

### 12.4 Settings (database mein, admin se badlein)

| Key | Shuru ki value |
|---|---|
| `whatsapp_number` | `03404905266` |
| `jazzcash_number`, `jazzcash_title` | tay hona baqi |
| `easypaisa_number`, `easypaisa_title` | tay hona baqi |
| `work_start` | `09:00` |
| `work_end` | `22:00` |
| `default_delivery_minutes` | `120` |
| `delivery_overrides` | `{}` (product id → minute) |
| `auto_cancel_hours` | `48` |
| `default_job_fee` | `300` |
| `job_image_keep_days` | `30` |
| `subjects` | Mazameen ki list (10.3) |
| `announcement_text`, `announcement_on` | khali, off |
| `orders_open` | `true` |
| `ads_provider` | `house` |
| `agent_enabled` | `false` (Version 2) |

Frontend WhatsApp number hamesha `/api/settings` se le; build ke waqt ki value sirf fallback.

### 12.5 Database (D1) tables

**orders**

| Column | Type | Note |
|---|---|---|
| `id` | TEXT primary key | `GVS-2611-0042` |
| `name` | TEXT | 2 se 60 harf |
| `phone` | TEXT | `923XXXXXXXXX` shakal |
| `phone_last4` | TEXT | Tracking ki jaanch ke liye |
| `items_json` | TEXT | Cheezein: id, naam, qeemat, customer ki tafseel, job id, documents |
| `total` | INTEGER | Rupay, server ne hisab kiya |
| `status` | TEXT | `new`, `paid`, `pending`, `complete`, `cancelled` |
| `due_at` | TEXT (ISO) | Wada; `paid` par bharta hai |
| `whatsapp_opened_at` | TEXT (ISO) | Customer ne "WhatsApp par bhejein" kab dabaya |
| `contacted` | INTEGER (0/1) | Owner ne "Rabta hua" tick kiya |
| `public_note` | TEXT | Customer ko dikhe |
| `admin_note` | TEXT | Sirf admin |
| `cancel_reason` | TEXT | |
| `completed_by` | TEXT | `admin` ya `agent` (Version 2) |
| `created_at`, `paid_at`, `completed_at`, `updated_at` | TEXT (ISO) | |

**order_events**: `id`, `order_id`, `from_status`, `to_status`, `by` (`admin`, `system`, `agent`), `at`.

**order_counter**: `month` (`2611`), `last_number`.

**notifications**: `id`, `type` (`order_new`, `whatsapp_opened`, `status_changed`, `auto_cancelled`, `low_mcq_bank`), `order_id`, `message`, `created_at`, `read_at`.

**settings**: `key`, `value`.

**mcqs**: `id`, `subject`, `question`, `options_json`, `answer_index`, `explanation`, `difficulty`, `as_of_date`, `verified` (0/1), `mock_id`, `created_at`.

**mocks**: `id`, `slug`, `name`, `minutes`, `summary`, `visible` (0/1), `created_at`.

**notes**: `id`, `slug`, `title`, `subject`, `summary`, `body_md`, `visible` (0/1), `created_at`, `updated_at`.

**jobs**: `id`, `slug`, `org`, `post`, `city`, `education`, `last_date`, `official_url`, `ad_url`, `image_key` (R2), `govt_fee`, `our_fee`, `apply_service` (0/1), `documents_json`, `steps_json`, `visible` (0/1), `created_at`, `updated_at`.

**daily_pins**: `date`, `mcq_ids_json`.

**agent_log** (Version 2 ke liye, abhi khali): `id`, `action`, `order_id`, `at`.

**rate_limits**: `key` (phone ya IP ka hash), `window_start`, `count`.

Index: `orders(status, created_at)`, `orders(phone)`, `mcqs(subject, verified)`, `jobs(last_date)`, `notifications(read_at, created_at)`.

Database ki har tabdeeli nayi migration file se (`0002_...sql`), purani file kabhi nahin badalti.

### 12.6 API endpoints

**Public**

| Method aur path | Kaam | Ahem usool |
|---|---|---|
| `GET /api/settings` | WhatsApp number, payment accounts, kaam ke auqaat, elaan, `orders_open` | Koi raaz ki cheez nahin |
| `POST /api/orders` | Naya order | Body: `name`, `phone`, `items: [{id, fields, jobId?}]`. Server: number ki jaanch, product `active`, `fields` ki jaanch, qeemat catalog se (job apply ki fee job se), job band na ho, zyada se zyada 10 cheezein, rate limit, `orders_open`. Notification bane. Jawab: `id`, `total`, `whatsappUrl`, `trackUrl` |
| `POST /api/orders/:id/whatsapp-opened` | "WhatsApp par bhejein" ka record | Body mein `last4`; sirf pehli dafa; notification |
| `GET /api/track?id=…&last4=…` | Order ka darja | `last4` na mile to sirf "Order nahin mila". Jawab mein phone number nahin. Har IP par had |
| `GET /api/daily-test` | Aaj ke 10 sawal | Jawab ke sath (mashq hai, imtihan nahin) |
| `GET /api/mcqs?subject=&offset=` | Practice ke sets | Sirf `verified` |

Jobs, notes aur mock tests ke pages on-demand database se bante hain.

**Admin** (sab par session cookie zaroori)

| Method aur path | Kaam |
|---|---|
| `POST /api/admin/login`, `/logout` | Password ki jaanch, HttpOnly session cookie (7 din) |
| `GET /api/admin/orders?status=&q=&waOpened=` | Orders ki list aur din ka khulasa |
| `POST /api/admin/orders/:id/status` | Darja badlo; `paid` par `due_at`; event aur notification |
| `POST /api/admin/orders/:id/note` | Public ya admin note |
| `POST /api/admin/orders/:id/contacted` | "Rabta hua" on/off |
| `GET /api/admin/notifications`, `POST .../read` | Notifications |
| `POST /api/admin/content/preview` | Text bhejo, parser ka nateeja aur ghaltiyan wapas (kuch save nahin) |
| `POST /api/admin/content/import` | Sahih hissa save |
| `GET/POST/DELETE /api/admin/mcqs`, `/mocks`, `/notes` | Dekhna, badalna, chhupana, mitana, `verified` |
| `GET/POST/DELETE /api/admin/jobs` | Jobs; "Sab purani mita dein" |
| `POST /api/admin/jobs/:id/image` | Tasveer R2 mein (server 150 KB se bari rad kare) |
| `POST /api/admin/daily-pins` | Kisi din ke sawal pin |
| `GET/POST /api/admin/settings` | Settings, har value ki jaanch ke sath |
| `GET /api/admin/export` | Orders ka CSV (hisab aur backup ke liye) |

**Agent (Version 2, Version 1 mein band)**: section 25.12.

**Khud chalne wale kaam:** alag cron ki zaroorat nahin. Har `GET /api/admin/orders` aur `GET /api/track` par pehle chhoti queries chalein:

- `new` darje ke purane orders (`auto_cancel_hours` se zyada) ko `cancelled`, wajah "Payment waqt par nahin aayi", aur notification.
- Akhri tareekh ke `job_image_keep_days` din baad jobs ki tasveerein R2 se mitana.
- 90 din purane `complete`/`cancelled` orders se naam aur phone mitana.
- Rozana test ke agle 7 din ke liye sawal kam hon to `low_mcq_bank` notification.

### 12.7 Timer ka hisab (`timer.ts`)

Function: `addWorkingMinutes(start, minutes, workStart, workEnd, timeZone)`

1. `start` ko Asia/Karachi waqt mein lo.
2. Agar `start` kaam ke auqaat se pehle hai, to aaj ke `workStart` par le jao; baad mein hai, to kal ke `workStart` par.
3. Aaj ke `workEnd` tak jitne minute bache, un se minute kam karo.
4. Minute baqi hon to agle din ke `workStart` se jari rakho.
5. Nateeja UTC ISO string mein wapas.

Section 7.3 ki teen misalein is function ke test cases hain. Track page par baqi waqt `due_at - abhi` hai.

### 12.8 Security aur data

- Qeemat hamesha server hisab kare.
- Har input ki jaanch server par: naam, phone, course code ka pattern, cheezon ki ginti.
- HTML mein customer ka likha text aur admin ka content hamesha escape ho. Notes ka Markdown sirf ijazat wale tags mein badle; links sirf `https`.
- Secrets Cloudflare mein: `ADMIN_PASSWORD`, `SESSION_SECRET`, `AGENT_API_KEY`. Code ya GitHub mein kabhi nahin. `.env` files `.gitignore` mein.
- Admin cookie: `HttpOnly`, `Secure`, `SameSite=Strict`.
- Track ke jawab mein poora phone number nahin.
- Tasveer upload sirf `image/webp`, `image/jpeg`, `image/png`; server par size aur qism ki dobara jaanch.

### 12.9 Mahol (environments) aur deploy

| Mahol | Kahan | Kis liye |
|---|---|---|
| **Local** | Owner ka computer, `npm run dev`, local D1 | Banana aur test karna |
| **Preview** | GitHub ki har branch par Cloudflare ka alag link | Live se pehle phone par dekhna |
| **Production** | `main` branch, asal domain | Asli visitors |

- Production par deploy sirf `main` mein merge se; is se pehle preview link par section 20 ki mutalliqa jaanch.
- Production database ki migration owner ki manzoori se, aur us se pehle backup.

### 12.10 Backup

- Cloudflare D1 ka point-in-time restore (Time Travel) istemal karein; is ki muddat plan ke hisab se hai, launch se pehle tasdeeq karein.
- **Hafta war:** admin se orders ka CSV export, aur poore database ka export, owner ke Google Drive mein.
- Muft content (MCQs, notes) ki asal text files bhi owner ke paas mehfooz rahein; zaroorat par dobara import ho sakti hain.

## 13. Pages ki poori list

Har page par: ek H1, title aur meta description (section 14), breadcrumbs, FAQ jahan likha ho, aur ad ki jagahein (section 15) jahan likha ho. **Static** = build par bana, **On-demand** = database se, cache ke sath.

| URL | Page | Ahem content | Banta | Ad | Schema |
|---|---|---|---|---|---|
| `/` | Home | "Aap kon hain?" chaar darwaze, aaj ka muft test, streak ki yaad dihani, taza jobs (3), mashhoor packs, order ke 4 qadam, FAQ | Static (+ client) | Neeche 1 | EducationalOrganization, WebSite |
| `/jobs` | Jobs | Khuli jobs (ginti ke sath), band jobs neeche, idare ka filter | On-demand | Haan | BreadcrumbList |
| `/jobs/<slug>` | Ek job | Ishtihar ki tasveer ya link, taleem, documents, tareeqa, akhri tareekh, official link, "Hum apply kar dein" | On-demand | Haan | BreadcrumbList |
| `/jobs/ppsc`, `/jobs/fpsc`, `/jobs/nts` | Idare ka page | Idara kya hai, form kaise bharein, test ka pattern, us idare ki jobs | On-demand | Haan | FAQPage |
| `/apply-service` | Online apply service | Kya karte hain, documents, qeemat, sarkari fee ki wazahat, order | Static | Nahin | Service, FAQPage |
| `/daily-test` | Rozana muft test | Aaj ke 10 sawal (11.2) | Static (+ client) | Test ke baad | |
| `/mcqs` | MCQs hub | Mazameen ke cards, sawalon ki ginti, packs | On-demand | Haan | |
| `/mcqs/<mazmoon>` | Mazmoon ki practice | 10-10 ke sets, quiz UI | On-demand | Set ke baad | FAQPage |
| `/mock-tests` | Mock tests | Muft mock tests ki list, paid series ki peshkash | On-demand | Haan | |
| `/mock-tests/<slug>` | Ek mock test | Section 11.3 | On-demand | Result ke baad | |
| `/notes` | Muft notes | Mazmoon ke hisab se list | On-demand | Haan | |
| `/notes/<slug>` | Ek note | Matn, chhota quiz, mutalliqa notes, pack ki peshkash | On-demand | Haan | Article, BreadcrumbList |
| `/my-history` | Meri history | Scores, streak, mock results, bookmarks, mere orders; hadein ki wazahat | Static (+ client) | Nahin | noindex |
| `/past-papers` | Solved past papers | Kis kis post ke papers, namoona, order | Static | Haan | Product |
| `/current-affairs` | Mahana current affairs | Mahine ki list, namoona, order | Static | Haan | Product |
| `/mock-series` | Paid mock test series | Kaise chalti hai, schedule, qeemat, order (sirf naam aur number) | Static | Nahin | Product |
| `/vu` | VU Corner | Course code ka khana, chaar packs ka muqabla, namoone, FAQ | Static | Haan | Product (4 offers), FAQPage |
| `/board` | Board Classes | Class chunein | Static | Haan | |
| `/board/9th` … `/board/12th` | Class ka page | Mazameen, paper kaise banta hai, order form | Static | Haan | Product |
| `/career` | Career Desk | CV, cover letter, apply, interview | Static | Haan | Service |
| `/career/cv` | CV + cover letter | Kya milega, kya bhejna hai, qeemat, order | Static | Nahin | Service |
| `/sarkari-services` | Sarkari Services | Schemes ki list, "GVS niji madadgar hai" | Static | Haan | |
| `/sarkari-services/<scheme>` | Scheme ka page | Ahliyat, documents, official link, fee, "form bharwayen" | Static | Haan | FAQPage |
| `/plans` | Rate list | Saare products aur qeematein | Static | Nahin | |
| `/track` | Order track karein | Order number + aakhri 4 hindse, status, timer | Static (+ client) | **Nahin** | noindex |
| `/how-to-order` | Order kaise karein | 4 qadam, payment, refund policy ka link | Static | Nahin | HowTo |
| `/about`, `/contact`, `/privacy`, `/terms` | Maloomat aur qanooni pages | Section 15.4, 9.10 | Static | Nahin | |
| `/admin` | Admin panel | Section 9.6 se 9.9, aur 10 | Client app | **Nahin** | noindex |
| `/404` | Page nahin mila | Darwazon ke links | Static | Nahin | |

Sarkari Services mein shuru ki schemes owner chune; har scheme ka page tab bane jab us ki official maloomat tasdeeq ho jaye.

## 14. SEO

Portal sirf developer ki nazar se nahin, SEO ki nazar se bhi banaya jaye.

### 14.1 Keywords se pages

| Cluster | Misal keywords | Page / URL |
|---|---|---|
| Sarkari jobs aur commissions | ppsc jobs, fpsc jobs, nts jobs, ppsc apply online, roll number slip | /jobs, /jobs/<slug>, /jobs/ppsc, /apply-service |
| Test tayyari MCQs | ppsc past papers, general knowledge mcqs, pak study mcqs, islamiat mcqs, nts test preparation | /mcqs, /mcqs/<mazmoon>, /mock-tests, /past-papers |
| Rozana test | daily mcqs test, online mcqs test | /daily-test |
| Muft notes | pak study notes, constitution of pakistan notes | /notes/<slug> |
| VU | vu handouts, vu past papers, cs101 midterm, vu mcqs | /vu |
| Board classes | 9th class test paper, 10th class guess paper, bise | /board/9th … /board/12th |
| Sarkari schemes | punjab scheme apply online, e-khidmat, maryam ki dastak | /sarkari-services, /sarkari-services/<scheme> |
| CV aur career | cv format, cv maker, cover letter, interview questions | /career, /career/cv |

### 14.2 Har page ke liye

- **Title:** asal keyword pehle, brand aakhir mein, 60 harfon ke andar. Misal: "PPSC Educator Jobs 2026: Last Date, Documents | GVS Academy".
- **Meta description:** faida aur amal ki dawat, 155 harfon ke andar.
- **On-demand pages ke title aur description khud bane:** job se "<Idara> <Post> Jobs <saal>: Last Date <tareekh>, Documents | GVS Academy"; note se Unwan aur Khulasa; mock se Naam aur Khulasa.
- **Ek H1**, keyword se shuru. Neeche H2/H3 tarteeb se.
- **Zaban:** heading English keyword mein, tehreer Roman Urdu mein. `lang="en"`, kyun ke Roman Urdu Latin harfon mein hai.
- **Andaruni links:** har page kam az kam 3 mutalliqa pages se jure.
- **Tasveerein:** WebP, sahih naam, alt text, `width` aur `height`.
- **Content:** har static SEO page par kam az kam 300 alfaz ka asal content, FAQ ke ilawa.

### 14.3 Technical SEO

- `sitemap.xml` mein static aur on-demand dono pages; `/admin`, `/track`, `/my-history` nahin. Band jobs sitemap se nikal jayen.
- `robots.txt`: `/admin` aur `/api` band; sitemap ka link.
- Har page ka canonical URL; URL chhote, lowercase, English, aakhir mein slash ki ek hi aadat.
- Structured data (JSON-LD), section 13 ke table ke mutabiq.
- Open Graph aur Twitter card: title, description aur 1200x630 share image (job ki tasveer ho to wohi).
- Core Web Vitals: LCP 2.5 second se kam, CLS 0.1 se kam, INP 200 ms se kam.
- Google Search Console aur analytics shuru se; launch par sitemap jama karein.
- Mitaye gaye job ya note ka URL `410 Gone` de; URL badle to `301` redirect.

### 14.4 SEO ki ehtiyaat

- **Har page asal aur alag ho.** Sirf naam badal kar ek jaise pages kamzor content hain. Isi liye Version 1 mein VU ka ek hi mazboot page hai. Job post mein bhi Tareeqa aur Documents bharna zaroori hai, sirf tasveer kaafi nahin.
- **Keyword ki bharmaar nahin.**
- **Sarkari ya doosre brand ka dhoka nahin.** "PPSC official" jaise alfaz ya sarkari logo nahin; har jagah wazeh ho ke GVS niji academy hai.
- **Jobs sirf official ishtihar se,** official link ke sath. JobPosting schema istemal na karein, kyun ke GVS khud employer nahin.

## 15. Ad ki jagahein (AdSense se pehle)

Shuru mein AdSense nahin hoga. Jagahein abhi se rakhi jayen, aur filhal wahan **GVS Academy ke apne ishtihar** (house ads) lagen.

### 15.1 Jagahein

| Jagah (slot id) | Kahan | Size |
|---|---|---|
| `top` | Heading ke neeche | Mobile 320x100, desktop 728x90 |
| `inline` | Lambe content mein teesre hisse ke baad | Responsive, 250px oonchai |
| `sidebar` | Sirf desktop (1024px se chauri screen) | 300x250 |
| `bottom` | Content ke aakhir, footer se pehle | Responsive, 250px oonchai |
| `result` | Quiz ya mock test ke result ke neeche | Responsive, 250px oonchai |

"Ad: Haan" wale pages par `top` aur `bottom`; lambe pages par `inline` bhi; desktop par `sidebar`. **Quiz aur mock test chalte hue koi ad nahin**; sirf result ke baad.

### 15.2 `AdSlot` component

- Har slot ki chaurai aur oonchai pehle se tay, taake ad aane par page na hile.
- Upar chhota label "Ishtihar".
- Abhi andar house ad, `src/data/house-ads.json` se, ghoomte hue. Misalein:
  - "VU Midterm Packs: Rs. 250 se shuru. Muft namoona dekhein" → `/vu`
  - "PPSC form? Hum apply kar dein. Rs. 300" → `/apply-service`
  - "Rozana 10 muft MCQs. Aaj ka test dein" → `/daily-test`
  - "CV + cover letter Rs. 500, 2 ghante mein" → `/career/cv`
- Baad mein AdSense ka code sirf is component mein aayega; setting `ads_provider: "house" | "adsense"`.

### 15.3 Usool

- **Order, tracking, payment, admin, history, how-to-order aur legal pages par koi ad nahin.**
- Ad kabhi button ya quiz ke option ke bilkul sath na ho (kam az kam 24px faasla).
- Ek screen par do se zyada ad nahin.

### 15.4 AdSense ki tayyari

Version 1 mein hi bane: Privacy Policy (ads, cookies, analytics aur localStorage ke zikr ke sath), About, Contact, Terms (refund policy ke sath, 9.10), asal content, aur `public/ads.txt` (abhi khali).

Wazahat: AdSense ishtihar site par Google ka code aur ads.txt file laga kar chalte hain. Backlinks SEO ki cheez hain (doosri sites se aap ki site ke links), un se ad nahin lagte.

## 16. Design ke usool

Tafseeli design (rang, fonts, screens) `design.md` mein bane ga; yeh us ke usool hain.

- **Rang aur unique color scheme design ke marhale mein tay honge.** Saare rang Tailwind config aur CSS variables mein ek jagah. Muqabil MCQs sites jaisa aam neela-safaid look nahin; GVS ki apni pehchan.
- **Mobile pehle.** 360px chauri screen se design shuru; 400px par har cheez saaf.
- **Halka.** Har page ka JavaScript kam; bhaari tasveerein nahin.
- **Light aur dark** dono theme, phone ki setting ke mutabiq.
- **Quiz aur mock test ki UI** section 11 ke mutabiq. Yeh portal ka sab se zyada dekha jane wala hissa hai, is liye design mein sab se zyada tawajjo yahan.
- **Aitmad ke nishan** har bechne wale page par: qeemat saaf, "pehle namoona dekhein", order ke 4 qadam, refund policy ka link, WhatsApp number.
- **Har cheez ungli se dabne ke qabil:** button kam az kam 44px ooncha.
- **Accessibility:** rangon mein kaafi farq; sahih/ghalat sirf rang se nahin, nishan se bhi; form ke har khane ka label; keyboard se chalne ke qabil.
- **SaaS-level:** dukaan ka poster nahin, kaam karne wala tool; har cheez ki qeemat samne, "rate ke liye inbox karein" nahin.
- **Design ke liye screens ki list** (design.md mein banengi): Home, darwaze ka page, product page, cart aur order form, order ho gaya, track, rozana test (sawal, jawab, score card), mock test (shuru, sawal + palette, result), note, job list, job page, admin (orders, order card, notifications, content preview, jobs form, settings).

## 17. Non-functional zaroorat

| Pehlu | Zaroorat |
|---|---|
| **Raftar** | Mobile par LCP 2.5 second se kam; home par pehli dafa JavaScript 100 KB (gzip) se kam; page ka kul wazan 500 KB se kam |
| **Devices** | Android Chrome aur Samsung Internet (pichhle 3 saal ke versions), iPhone Safari (iOS 15+), desktop Chrome/Edge/Firefox. 360px se 1440px chaurai |
| **Kamzor internet** | Har page bina JavaScript ke bhi parha ja sake (static content); quiz aur cart JavaScript se. Tasveerein `lazy` |
| **Dastiyabi** | Cloudflare par; API ki kharabi mein WhatsApp par seedha order ka rasta (9.2) |
| **Security** | Section 12.8 |
| **Privacy** | Server par sirf naam aur number; analytics mein naam ya number kabhi nahin; 90 din baad mitana |
| **Accessibility** | Lighthouse Accessibility 90 ya zyada; rangon ka farq WCAG AA |
| **Zaban** | Roman Urdu + English; tareekh aur waqt Pakistani andaz mein (maslan "5 Dec 2026, 5:00 PM") |
| **Kharcha** | Shuru mein hosting free tier mein; kharcha sirf domain ka |
| **Dekh bhaal** | Har cheez admin se ya ek JSON file se badle; code chhone ki zaroorat kam se kam |

## 18. Analytics aur naap tol

- **Tool:** Google Analytics 4 (events ke liye) ya Cloudflare Web Analytics (sirf visits ke liye). Events ke liye GA4 behtar. Privacy Policy mein zikr.
- **Analytics mein kabhi naam, phone ya order ki raqam ke sath shanakht nahin.**

| Event | Kab |
|---|---|
| `view_product` | Product page khula |
| `add_to_cart` | Order list mein daala |
| `open_order_form` | "WhatsApp par order karein" dabaya |
| `order_created` | Server ne order banaya |
| `whatsapp_opened` | "WhatsApp par bhejein" dabaya |
| `track_view` | Track page par order dekha |
| `daily_test_start` / `daily_test_complete` | Rozana test |
| `practice_set_complete` | Mazmoon ka set mukammal |
| `mock_start` / `mock_submit` | Mock test |
| `share_click` | Score card ya page share |
| `job_view` / `job_apply_click` | Job page aur apply button |
| `house_ad_click` | GVS ke apne ishtihar par click (slot id ke sath) |

Inhi se section 2.2 ke paimane bante hain, aur "kahan log ruk jaate hain" (funnel) dikhta hai: `view_product → add_to_cart → open_order_form → order_created → whatsapp_opened → paid`.

---

# Hissa D: Delivery aur chalana

## 19. Build ki tarteeb

VS Code mein Claude ko ek waqt mein ek qadam dein. Har qadam ke baad chala kar dekhein, phir agla. Har qadam ki tafseel `spec.md` mein.

| # | Qadam | Nateeja |
|---|---|---|
| 0 | GitHub repo, `CLAUDE.md`, `spec.md`, `design.md` (rang aur screens ka faisla) | Kaam ka naqsha tayyar |
| 1 | Astro project, Cloudflare adapter, Tailwind, folder structure (12.2), Base layout, Header, Footer | Khali site chalti hai |
| 2 | `catalog.json`, `seo.json`, basic components (ProductCard, AdSlot, FAQ) | Components tayyar |
| 3 | Home aur chaar darwazon ke static pages (content ke sath) | Site browse hoti hai |
| 4 | Order list (cart) aur order ka form (abhi bina backend) | Cart chalta hai |
| 5 | D1 database, `0001_init.sql`, `/api/settings`, `/api/orders`, `whatsapp-opened`, notifications | Order database mein, WhatsApp tayyar message ke sath |
| 6 | `timer.ts` aur tests, `/api/track`, `/track` page | Customer status aur timer dekhta hai |
| 7 | Admin login, Orders tab, Notifications tab | Owner phone se orders chalata hai |
| 8 | Admin Settings | Number aur auqaat admin se badlein |
| 9 | `parser.ts` aur tests, Content tab (paste, `.txt`, preview, import) | Owner text se content daalta hai |
| 10 | Quiz components, `/daily-test`, `/mcqs`, `/mcqs/<mazmoon>`, `history.ts`, `/my-history` | Rozana test aur practice |
| 11 | Mock test UI, `/mock-tests`, `/mock-tests/<slug>` | Muft mock tests |
| 12 | Notes: `/notes`, `/notes/<slug>` | Muft notes |
| 13 | Jobs tab (text aur form, R2 tasveer, purani jobs), `/jobs`, `/jobs/<slug>`, job se apply order | Jobs aur documents message mein |
| 14 | Baqi static pages: VU, Board, Career, Sarkari, Plans, mock-series, legal, how-to-order, 404 | Saare pages mukammal |
| 15 | SEO: sitemap, robots, schema, Open Graph, canonical; house ads; analytics events (18); manifest | SEO aur naap tol tayyar |
| 16 | Version 2 ki tayyari: agent endpoints (band), `fileHint`, `agent_log` | Version 2 ka darwaza tayyar |
| 17 | Preview par section 20 ki poori jaanch; content daalna (21.1) | Launch ke qabil |
| 18 | Production deploy, domain, Search Console, backup ka pehla export | Site live |

## 20. Mukammal hone ki jaanch

**Order aur tracking**

- [ ] Product chunne se le kar WhatsApp khulne tak ka poora rasta mobile par chalta hai.
- [ ] Customer WhatsApp na khole tab bhi order admin mein maujood hai, "WhatsApp nahin khola" filter mein.
- [ ] API band ho to "WhatsApp par seedha order" ka rasta kaam karta hai.
- [ ] "Khud rabta karein" sahih message ke sath customer ka chat kholta hai.
- [ ] WhatsApp message mein order number, cheezein, tafseel, kul raqam aur tracking link sahih; job apply mein documents ki list bhi.
- [ ] Browser se qeemat badal kar bhejne par bhi server sahih qeemat lagata hai.
- [ ] Ghalat phone number par saaf ghalti ka paigham.
- [ ] Track page ghalat aakhri 4 hindson par order ki maloomat nahin deta.
- [ ] Timer 7.3 ki teeno misalon mein sahih wada dikhata hai.
- [ ] 48 ghante purana `new` order khud cancel hota hai.
- [ ] "Orders band" switch par order button ki jagah elaan.

**Admin aur content**

- [ ] Ghalat password par 5 koshishon ke baad rok.
- [ ] Phone par har button aasani se dabta hai; naye order par ghanti ki ginti barhti hai.
- [ ] WhatsApp number Settings se badalne par poori site naya number istemal karti hai.
- [ ] MCQ, mock, note aur job ka text format sahih import hota hai; ghalat text par line number ke sath ghalti.
- [ ] `verified = false` sawal visitors ko nahin dikhte.
- [ ] Job ki tasveer 150 KB se kam ho kar upload hoti hai; akhri tareekh ke baad job "Band" aur 30 din baad tasveer khud mit jati hai.
- [ ] "Sab purani mita dein" aur orders ka CSV export kaam karte hain.

**Visitor ka tajurba**

- [ ] Quiz mein foran hara/surkh jawab (nishan ke sath) aur tashreeh; progress bar; score card share hota hai.
- [ ] Streak aur "Mere orders" agle din bhi yaad (usi browser mein).
- [ ] Mock test mein palette, timer, "baad mein dekhein", mazmoon-war result; page band kar ke kholne par test wahin se jari.
- [ ] localStorage band ho tab bhi quiz chalta hai.

**SEO, raftar aur ads**

- [ ] Har page ka alag title aur description; job aur note pages ke title khud bante hain.
- [ ] sitemap.xml mein naye jobs aur notes khud aate hain; `/admin`, `/track`, `/my-history` nahin.
- [ ] Rich Results Test mein schema ki koi ghalti nahin.
- [ ] Mobile Lighthouse: Performance, SEO aur Accessibility 90 se upar.
- [ ] Ad box aane par page nahin hilta (CLS 0.1 se kam).
- [ ] Order, track, admin, history aur legal pages par, aur chalte quiz mein, koi ad nahin.
- [ ] Analytics events (18) aa rahe hain; un mein naam ya number nahin.

**Content, qanooni aur Version 2 ki tayyari**

- [ ] Har MCQ owner ka jaancha hua; koi sawal copy kiya hua nahin.
- [ ] Har sarkari service aur job par official link aur "GVS niji academy hai".
- [ ] Kahin "guarantee" ya "pakki naukri" jaise alfaz nahin.
- [ ] Privacy, Terms (refund policy ke sath), About, Contact mukammal.
- [ ] Agent endpoints `agent_enabled = false` par band (404).
- [ ] Backup ka pehla export ho chuka.

## 21. Launch ka mansooba

### 21.1 Launch se pehle (kam az kam content)

- 150 jaanche hue MCQs (har mazmoon ke kam az kam 25), taake 15 din tak rozana test na dohraye
- 2-3 muft mock tests
- 5-10 muft notes (sab se zyada search hone wale topics)
- Khuli jobs ke taza ishtihar (kam az kam 5)
- Har pack ka muft namoona
- JazzCash/Easypaisa details, refund policy ke alfaz, About/Contact ki maloomat

### 21.2 Launch (pehla hafta, "soft launch")

- Pehle apne students aur jaanne walon ko link bhejein; un se 3 sawal poochein: kya mushkil laga, kya acha laga, kya kami thi.
- WhatsApp channel aur Facebook page par rozana test ka link.
- Google Search Console mein sitemap jama karein.
- Har order ke baad dekhein ke poora rasta theek chala.

### 21.3 Pehle 30 din

- Rozana: test ka link channel aur page par; nayi jobs.
- Hafta war: section 2.3 ka jaiza; feedback se chhoti tabdeeliyan.
- 30 din baad: section 2.2 ke baseline figures likhein aur agle mahine ke hadaf tay karein.

### 21.4 AdSense ki darkhwast

Tab jab: kaafi asal content ho (dasiyon mufeed pages), saare qanooni pages mukammal hon, aur traffic lagatar aa raha ho. Google ki darkhwast ke waqt ki taza sharaait dekh lein.

## 22. Rozana operations

### 22.1 Owner ka rozana mamool

| Waqt | Kaam |
|---|---|
| Subah 9:00 | Admin kholen: raat ke orders, notifications, "WhatsApp nahin khola" wale orders ko "Khud rabta karein" |
| Din bhar | Payment tasdeeq (22.2) → "Paid" → kaam → file WhatsApp par → "Complete" |
| Din mein ek dafa | Nayi jobs post; band hone wali jobs dekhein |
| Raat 9:30 | Pending orders ka jaiza; jo raat mein mukammal na hon un ke customer ko note |
| Hafta war | 25+ naye MCQs, 1 note; 15 minute KPI jaiza (2.3); backup export (12.10) |
| Mahana | 1 naya mock test; current affairs ke sawal aur PDF; purane current affairs sawal check |

### 22.2 Payment ki tasdeeq

- **Sirf screenshot par bharosa nahin.** Jaali screenshot aam hain. JazzCash/Easypaisa app mein asal aamad dekhein: raqam, waqt, aur bhejne wale ka number ya naam.
- Raqam kam ho to "Paid" na karein; customer ko baqi raqam ka bataein.
- Shak ho to customer se transaction ID maangein.

### 22.3 Packs ki tayyari

- Owner ke maujooda Claude skills (VU packs, board papers, MCQs notes waghera) se files tayyar hoti hain.
- Bar bar bikne wali files pehle se bana kar section 25.13 ke naam ke usool par rakhein; is se delivery tez hogi aur Version 2 ki automation aasan.

### 22.4 Agar kuch kharab ho

| Masla | Kya karein |
|---|---|
| Site nahin khul rahi | Cloudflare ka status page dekhein; WhatsApp channel par elaan; orders WhatsApp par seedha |
| Admin login nahin ho raha | 15 minute ki rok to nahin; phir bhi na ho to Cloudflare mein password secret dekhein |
| Ghalti se order "Complete" ho gaya | Admin se darja wapas karein |
| Galat sawal live ho gaya | Admin mein us sawal ko chhupayein ya theek karein |
| WhatsApp number band ho gaya | Settings se naya number; channel aur page par elaan |
| Database ki ghalti | Backup se wapas (12.10); Claude se VS Code mein madad |

## 23. Khatre aur un ka hal

| Khatra | Asar | Imkan | Hal |
|---|---|---|---|
| Jaali payment screenshot | Nuqsan | Darmiyana | Wallet app mein asal aamad dekh kar hi "Paid" (22.2) |
| Jaali ya mazaq ke orders | Admin mein bheer | Darmiyana | Rate limit, 48 ghante mein khud cancel, "WhatsApp nahin khola" filter |
| Orders zyada, owner akela | 2 ghante ka wada toot jaye | Kam (shuru mein) | Settings se delivery waqt barhayen; "Orders band" switch; Version 2 automation |
| Ghalat MCQ jawab | Aitmad ko nuqsan | Darmiyana | "Jaanch liye" checkbox, sirf verified live, visitor ke liye "Ghalti batayen" ka link (WhatsApp) |
| Copy shuda content ka ilzam | Qanooni aur SEO nuqsan | Kam | Sirf apna likha material (usool 1) |
| Sarkari idare ka dhoka samjha jaye | Aitmad aur qanooni masla | Kam | Har jagah "GVS niji academy hai", official links, sarkari logo nahin |
| WhatsApp number band/ban | Orders ruk jayen | Kam (V1), zyada (WaSender ke sath) | Number admin se badlein; WaSender alag number par (25.14) |
| AdSense manzoor na ho | Ad ki kamai nahin | Darmiyana | Asal content, qanooni pages, house ads chalte rahein |
| Free tier ki had | Site sust ya band | Kam (shuru mein) | Hadein launch se pehle dekhein; traffic barhne par sasta paid plan |
| Database ka data zaya | Orders ka record gum | Kam | Time Travel aur hafta war export (12.10) |
| Admin password chori | Data aur orders ko khatra | Kam | Mazboot password, rok, secrets sirf Cloudflare mein, zaroorat par badlein |
| Google update se traffic gire | Visitors kam | Darmiyana | WhatsApp channel aur Facebook se seedha traffic; asal content |

## 24. Kirdar aur zimmedariyan

| Kirdar | Kaun | Zimmedari |
|---|---|---|
| **Owner / faisla saaz** | GVS Academy owner | Faisle, qeematein, payment ki tasdeeq, content ki tasdeeq, delivery, deploy ki manzoori |
| **Developer** | Owner, VS Code mein Claude ke sath | Code, tests, `spec.md`, `design.md`, deploy |
| **Content checker** (ikhtiyari) | Koi teacher | MCQs aur notes ki tasdeeq |
| **Agent** (Version 2) | Claude agent | Paid orders ki file dhoondna aur bhejna, note likhna; "Paid" nahin |

---

# Hissa E: Aage ke versions

## 25. Version 2: PSID aur automation

Version 2 ke do hisse hain: **A. PSID (1Bill voucher)** se payment, aur **B. WaSender aur Claude agent** se automation. Neeche ki maloomat November 2026 ki web research se hai; har cheez dobara tasdeeq karein. Yeh qanooni ya maali mashwara nahin; zaroorat ho to wakeel se documents clear karwayen.

### A. PSID (1Bill voucher)

### 25.1 Yeh hai kya

- **1Bill** 1LINK ki bill payment service hai. 1LINK wohi company hai jo Pakistan ka ATM aur IBFT network chalati hai.
- Har biller ko ek **prefix** milta hai jo customer ke bill number ke aage lagta hai. Customer bank ya wallet app mein yeh number daalta hai, app khud biller aur raqam dhoond leta hai.
- 1Bill ki do qismein hain:
  - **Invoice/Voucher:** raqam pehle se tay. Yeh Version 2 hai.
  - **Top-up:** raqam customer khud chunta hai. Yeh Version 3 hai.
- **PSID** e-Pay Punjab (sarkari) ka naam hai, jahan shehri 17 hindson ka PSID bana kar kisi bhi bank se ada karta hai. Private billers mein isay consumer number ya voucher number kehte hain. Portal par "PSID / Payment ID" likh sakte hain.

### 25.2 Customer ke liye kaisa dikhe ga

1. Customer portal par order karta hai.
2. Order ke sath ek **Payment ID (PSID)** banta hai, raqam ke sath.
3. Customer JazzCash, Easypaisa ya kisi bhi bank app mein: Bill Payment → 1Bill → Invoice/Voucher → Payment ID → raqam ki tasdeeq → ada.
4. Payment hote hi aggregator portal ko ittila deta hai, aur order **khud "Paid"** ho jata hai; timer shuru.
5. Screenshot bhejne ki zaroorat khatam.

WhatsApp wala tareeqa bhi sath chalta rahe. PSID payment ki tasdeeq aggregator karta hai, is liye us waqt order khud "Paid" ho sakta hai; screenshot wali payment par "Paid" hamesha owner hi karega.

### 25.3 Kya aam karobar le sakta hai

Haan. 1LINK ki biller list mein sirf sarkari idare nahin: August 2025 ki list mein 1,901 education aur 268 e-commerce billers the, aur un mein chhoti academies bhi shamil hain.

Lekin chhota karobar **seedha 1LINK ke paas nahin jata.** Banks aur aggregators "master biller" hote hain aur apne neeche merchants ko jagah dete hain. GVS ko kisi aggregator ke zariye aana hoga.

### 25.4 Aggregators (jin se baat karni hai)

| Aggregator | Kya karta hai | Note |
|---|---|---|
| **PayPro** | 1Bill voucher aur payment gateway. Wallets (Easypaisa, JazzCash, SadaPay, NayaPay), cards aur OTC (TCS, Meezan waghera) | Sole proprietor ke sath kaam karta hai; business account zaroori. Bank Alfalah account ki tajweez deta hai |
| **Kuickpay** | Digital voucher; bank apps aur 1Bill par "KuickPay" naam se | Bank of Khyber aur JS Bank ke sath 1LINK par billers ko jaldi onboard karne ke agreements |
| **Doosre gateways** | PayFast, Safepay, JazzCash aur Easypaisa ke apne merchant gateways | Zyada tar checkout gateway; poochna hoga ke 1Bill voucher dete hain ya nahin |

### 25.5 Pehli sharaait (pre-requirements)

1. **NTN** (FBR ka National Tax Number), proprietor ke naam par ya karobar ke naam par.
2. **Business / merchant bank account**, "GVS Academy" ke naam par ya proprietor ke naam par. Personal account aam tor par qabool nahin.
3. **Chalti website** SSL (https) ke sath, jis par services, qeematein, refund policy, privacy policy aur rabte ki maloomat saaf hon. Version 1 yeh sab de deta hai.
4. **Karobar ka pata** aur us ka saboot.
5. **Proprietor ka CNIC.**
6. Zaroorat ho to karobar ki registration (sole proprietor ke liye aksar NTN hi kaafi).

### 25.6 Documents ki list

PayPro ki website ke mutabiq integration ke liye:

- Business details: karobar ka naam, website, pata, CNIC
- Business account details: bank ka naam, branch code, branch ka naam aur pata, account title, account number
- Business Account Maintenance Certificate (bank se)
- NTN number

PayFast ki partner guide (sole proprietor) mein milte julte documents: karobar ki registration ka saboot (NTN waghera), karobar ka pata, aur account maintenance certificate.

Har aggregator ki list thori mukhtalif ho sakti hai; mulaqat se pehle taza list mangwa lein.

### 25.7 Qadam ba qadam tareeqa

1. **NTN banwayen** (agar nahin hai): FBR ke IRIS portal par.
2. **Business bank account kholen**, NTN ke sath. Bank se "Account Maintenance Certificate" lein.
3. **Website tayyar rakhein**: Version 1 live ho, refund aur privacy policy ke sath.
4. **2-3 aggregators se rabta karein** (PayPro, Kuickpay, aur ek aur). Sab se 25.8 ke sawal poochein.
5. **Muqabla karein**: fee, settlement ka waqt, support.
6. **Application aur documents jama karein**, agreement par dastakhat.
7. **Verification**: aggregator documents aur website check karta hai; 1LINK par prefix milta hai.
8. **Test (sandbox) keys**; developer portal ko jorta hai: order par voucher banana, aur payment ki ittila (webhook) par order khud "Paid".
9. **Test payments**: chhoti raqam se har app (JazzCash, Easypaisa, 2-3 banks) mein.
10. **Live keys** lein aur portal par chalu karein.

### 25.8 Aggregator se poochne wale sawal

- 1Bill Invoice/Voucher ki fee kitni hai: feesad ya fixed? Kam se kam fee?
- Setup fee, saalana fee ya mahana fee hai?
- Paisa account mein kitne din mein aata hai (settlement)?
- Voucher kitni der valid rehta hai? Muddat hum tay kar sakte hain?
- Payment ki ittila turant milti hai (webhook)? API documentation aur sandbox milta hai?
- Kaun kaun si apps aur banks mein voucher chalta hai?
- Refund kaise hota hai?
- Sole proprietor ke liye poori document list kya hai?
- Baad mein Top-up (Version 3) bhi isi agreement mein mil sakta hai?

### 25.9 Kharche ka andaza

- Aam gateways har transaction par 2 se 3.5 feesad lete hain. Ek source ke mutabiq PayFast ki setup fee Rs. 20,000 aur wallet par 2.2% hai; doosre sources setup fee zero batate hain. 1Bill voucher ka rate alag ho sakta hai.
- PayPro ke mutabiq charges karobar ke hajam ke hisab se tay hote hain. Pakka rate sirf quote se milega.
- Chhote packs (Rs. 120-300) par fixed fee bhaari par sakti hai; feesad aur fixed dono poochein.

### 25.10 Portal mein PSID ki tabdeeliyan

- `orders` mein naye columns: `payment_method` (`whatsapp` / `psid`), `psid`, `psid_expires_at`, `paid_via_webhook`.
- Naya endpoint: `POST /api/payments/webhook`, aggregator ke signature ki jaanch ke sath. Sahih ittila par order `paid`, `due_at`, event aur notification.
- Order par "PSID se ada karein" ka option, Payment ID bari aur copy button ke sath.
- Har app ke liye mukhtasar tasveeri hidayat.
- Admin mein dikhe ke payment PSID se aayi ya WhatsApp se.
- Voucher ki muddat guzarne par order khud cancel.
- Version 1 ka haath se "Paid" wala tareeqa bhi chalta rahe.

### B. WaSender aur Claude agent se automation

### 25.11 Kya hoga

Owner ka khayal: order ka zyada kaam khud-ba-khud ho, aur owner sirf payment confirm kare.

1. Customer order karta hai → portal mein order aur notification.
2. **WaSender** (WhatsApp API, owner pehle bulk messaging ke liye istemal kar chuke hain) ke zariye customer ko khud confirmation message: order number, raqam, payment ka tareeqa.
3. Customer WhatsApp par payment ka screenshot bhejta hai → WaSender ka **webhook** portal ko batata hai → portal message mein order number dhoond kar notification banata hai: "GVS-2611-0042: payment ka screenshot aaya".
4. **Owner payment check kar ke "Paid" karta hai** (22.2).
5. **Claude agent** (owner ka paid Claude, owner ke computer ke folder ki ijazat ke sath) agent endpoint dekhta hai: naya `paid` order.
6. Agent order ki tafseel aur `fileHint` se owner ke folder mein file dhoondta hai (25.13).
   - File mil gayi → WaSender se customer ko bhejta hai → order `complete` (by `agent`) aur note "File bhej di gayi".
   - File nahin mili → order `pending`, admin note "File nahin mili, owner tayyar kare", aur owner ko notification.
7. Har qadam order ki history aur `agent_log` mein.

### 25.12 Version 1 mein tayyari (abhi se ban jaye)

Section 19, qadam 16:

1. **Notifications table aur screen** (9.8, 12.5).
2. **Agent endpoints**, `agent_enabled = false` par band (404):

| Method aur path | Kaam |
|---|---|
| `GET /api/agent/orders?status=paid` | Paid orders jo complete nahin hue: id, cheezein, tafseel, `fileHint`, customer ka naam aur number |
| `GET /api/agent/notifications?since=` | Naye notifications |
| `POST /api/agent/orders/:id/complete` | Order complete, `completed_by = agent`, note ke sath |
| `POST /api/agent/orders/:id/note` | Admin note likhna |

   - Har request par `Authorization: Bearer <AGENT_API_KEY>`. Key admin Settings se banti aur badalti hai; database mein sirf us ka hash.
   - **Agent "Paid" nahin kar sakta**, na qeemat badal sakta hai, na order mita sakta hai.
   - Har agent request `agent_log` mein.
3. **`fileHint`** har product mein (12.3), aur order mein customer ki tafseel structured shakal mein, taake file ka rasta khud ban sake.

### 25.13 Files ke naam ka usool (owner ab se shuru kare)

Owner ke computer par ek folder, maslan `GVS-Files/`:

| Product | File ka rasta |
|---|---|
| VU packs | `VU/<COURSECODE>/Quick.pdf`, `Smart.pdf`, `Complete.pdf`, `Topper.pdf` (maslan `VU/CS101/Smart.pdf`) |
| MCQs pack | `MCQs/<Mazmoon>.pdf` (maslan `MCQs/Pakistan-Studies.pdf`) |
| Solved past papers | `Past-Papers/<Idara>-<Post>.pdf` (maslan `Past-Papers/PPSC-Educator.pdf`) |
| Current affairs | `Current-Affairs/<YYYY-MM>.pdf` (maslan `Current-Affairs/2026-11.pdf`) |
| Board paper, CV, apply, scheme | Har order par naya; agent nahin bhejta, owner tayyar karta hai |

Usool: course code bare harfon mein, alfaz ke beech `-`, khali jagah nahin.

### 25.14 WaSender ki ehtiyaat

- WaSender WhatsApp ki **official API nahin**. Aise tools se number **ban** hone ka khatra hota hai, khaas tor par zyada ya bina ijazat messages par.
- Is liye: GVS ke asal business number ke bajaye **alag number** par chalayen, ya kam messages se shuru karein.
- Sirf unhi customers ko message jinhone khud order kiya.
- Official rasta **WhatsApp Business Platform (Cloud API)** hai (Meta ka), apni fee aur sharaait ke sath; Version 2 se pehle dono ka muqabla karein.
- WaSender ki API key aur webhook secret Cloudflare secrets mein; webhook par secret ki jaanch.
- Claude agent ko sirf `GVS-Files/` folder ki ijazat, poore computer ki nahin.

## 26. Version 3: advance balance (1Bill Top-up) aur account

### 26.1 Kya hoga

- Customer apne account ka Top-up number kisi bhi bank ya wallet app mein daal kar **apni marzi ki raqam** jama kare.
- Raqam GVS account mein balance ke tor par dikhe; isi se koi bhi service ya pack khareede.
- Mahana GVS Pass (mock tests, current affairs, alerts) bhi balance se kat sake.
- History (tests, bookmarks, orders) har device par.

### 26.2 Is ke liye zaroori

- **Student account (sign up / login)**: WhatsApp number par OTP behtar, password kam.
- Pehli dafa login par browser ki history (11.4) account mein.
- Har lain den ka hisab (ledger): kab jama, kis cheez par kharch, baqi kitna. Balance kabhi seedha edit nahin, sirf ledger ki entries se.
- Version 1 aur 2 ke orders bhi us number se jur jayen.

### 26.3 Qanooni ehtiyaat (pehle tasdeeq)

- Customer ka paisa apne paas rakhna **e-money** ke qareeb aa jata hai, jis ke liye State Bank ka licence hota hai.
- Mehfooz shakal: balance **sirf GVS ki services par kharch ho**: na nikala ja sake, na kisi aur ko bheja ja sake, na us par munafa.
- Aggregator se likhwa kar poochein ke Top-up is shakal mein jaiz hai; zaroorat ho to wakeel se documents check karwayen.
- Kuch apps mein Top-up ka option sab banks mein nahin hota (maslan IBA ke FAQ mein 1Bill Topup sirf teen banks ke liye likha hai).

---

# Hissa F: Usool aur hawale

## 27. Zaban aur lehja

- Roman Urdu, jahan zaroorat ho English istilahat (MCQs, pack, order). SEO headings English keyword ke sath (section 14).
- Chhote jumle. Ek jumle mein ek baat.
- Button wohi kahe jo wo karta hai: "Namoona dekhein", "Order list mein daalein", "WhatsApp par bhejein", "Order track karein", "Aaj ka test dein", "Hum apply kar dein".
- Ghalti ka paigham bataye kya ghalat hua aur kaise theek ho: "Number 11 hindson ka hona chahiye, maslan 03001234567."
- Quiz mein hosla afzai: "Shabash!", "Koi baat nahin, tashreeh parhein." Taana ya sharmindgi wala lehja nahin.
- Mubalgha nahin. "100% guarantee", "pakki naukri", "sab se behtareen" jaise alfaz kabhi nahin.

## 28. Usool (yeh nahin tootein ge)

1. **Sirf apna material.** Kisi academy ke notes ya chhapi kitabon ke scan nahin bikenge. Past papers apne hal aur apni tashreeh ke sath. MCQs aur muft notes GVS ke apne likhe (ya owner ke jaanche hue).
2. **Naukri ya pass hone ka wada nahin.** PPSC 2024 mein taqreeban 1% applicants recommend hue; GVS tayyari aur sahih form bechta hai, nateeja nahin.
3. **Sarkari kaam mein wazahat.** GVS niji madadgar hai, sarkari idara nahin. Sarkari fee alag hai aur official challan par jati hai. Har service aur job ke sath official link.
4. **Jaali cheez nahin.** Farzi reviews, farzi student ginti, farzi scores ya farzi ishtihar nahin. Jobs sirf official ishtihar se.
5. **Logon ka data kam se kam.** Server par sirf naam aur WhatsApp number; tests ki history visitor ke browser mein. CNIC aur documents sirf WhatsApp par, usi kaam ke liye, aur kaam ke baad hata diye jayen. Portal par 90 din baad naam aur number mita diye jayen.
6. **Payment ki tasdeeq insaan kare.** Screenshot wali payment par "Paid" sirf owner karta hai, wallet app mein asal aamad dekh kar; agent ya automation nahin.
7. **Wada wohi jo pura ho sake.** Delivery ka waqt, qeemat aur policy jo portal par likhi hai, wohi asal mein ho.

## 29. Khule aur tay shuda faislay

### 29.1 Khule faislay

| Faisla | Kab tak zaroori | Kis ke liye |
|---|---|---|
| JazzCash aur Easypaisa ke account number aur title | Qadam 6 (track page) | Payment ke qadam |
| Rang, logo aur color scheme | Qadam 0 (`design.md`) | Poora design |
| Domain (gvsacademy.pk ya gvsacademy.com) | Qadam 18 (deploy) | Live site |
| Academy ka shehar aur pata | Qadam 14 | About, Contact, schema |
| Refund policy ke aakhri alfaz (tajweez 9.10) | Qadam 14 | Terms page |
| Interview tayyari ki qeemat | Jab bhi | Career Desk |
| Sarkari Services ki shuru ki schemes | Qadam 14 | Scheme pages |
| Muft namoone (har pack ke 2-3 safhe) | Qadam 14 | Product pages |
| Launch ka content (21.1) | Qadam 17 | Launch |
| Analytics tool (GA4 ya Cloudflare) | Qadam 15 | Naap tol |
| Version 2: NTN, business account, aggregator, WaSender ya official API | Version 2 se pehle | PSID aur automation |

### 29.2 Tay shuda faislay

| Faisla | Section |
|---|---|
| Rates | 7.2 |
| WhatsApp number 03404905266, admin se badalne ke qabil | 7.1 |
| Delivery wada 2 ghante, kaam ke auqaat 9 se 10 | 7.3 |
| Customer ka sign up nahin (Version 1) | 9.1 |
| Order WhatsApp se pehle server par save | 9.2 |
| Paid files portal par nahin, WhatsApp par | 9.5 |
| Muft content sirf text format mein, admin se | 10 |
| Attractive quiz aur mock UI; history browser mein | 11 |
| Astro, Tailwind, Cloudflare (Pages, D1, R2) | 12.1 |
| VU ka ek page, course-war pages baad mein | 14.4 |
| House ads ab, AdSense baad mein | 15 |
| WaSender aur Claude agent Version 2 mein; "Paid" hamesha insaan | 25.B, 28 |

## 30. Istilahat

| Lafz | Matlab |
|---|---|
| **Astro** | Website banane ka framework jo pages pehle se HTML bana deta hai |
| **Tailwind CSS** | Design (rang, faasla, size) ke liye tayyar classes ka nizam |
| **Cloudflare Pages** | Website ki hosting; GitHub se khud deploy |
| **D1** | Cloudflare ka database (SQLite) |
| **R2** | Cloudflare ka file storage (tasveerein) |
| **API / endpoint** | Server ka darwaza jahan se page data mangta ya bhejta hai |
| **Static / On-demand page** | Build par pehle se bana page / har request par database se bana page |
| **Cache** | Bana hua page kuch der yaad rakhna, taake har dafa dobara na bane |
| **localStorage** | Visitor ke browser ki chhoti jagah jahan portal history rakhta hai |
| **Migration** | Database ki tabdeeli ki file, tarteeb se chalne wali |
| **Secret / environment variable** | Password ya key jo code ke bahar, hosting par mehfooz rehti hai |
| **Webhook** | Doosri service ka hamein khud ittila dena ("payment ho gayi") |
| **Slug** | URL mein page ka naam, maslan `ppsc-educator-2026` |
| **Schema (JSON-LD)** | Google ko page ke baare mein saaf maloomat dene ka code |
| **CLS / LCP / INP** | Page ke hilne, khulne aur jawab dene ki raftar ke paimane |
| **KPI** | Kamyabi naapne ka paimana |
| **Funnel** | Visitor ke qadmon ki tarteeb, jahan dikhta hai log kahan rukte hain |
| **1Bill / PSID** | 1LINK ki bill payment / payment ka number (section 25.1) |
| **Aggregator** | Company jo chhote karobar ko payment nizam se jorti hai |
| **Agent** | Claude jo ijazat ke sath khud kaam karta hai (Version 2) |

## 31. Sources

**Market research:** "GVS Academy Market Research Result Sheet" (Sources tab).

**Version 2 aur 3:**

- 1Bill ka tareeqa aur Invoice/Top-up ka farq: https://pakera.pk/1bill-payment-pakistan-invoice-voucher-prefix-list/
- 1LINK biller list, August 2025: https://1link.net.pk/assets/documents/Biller_List_Aug_2025.pdf
- UBL aur 1LINK bill aggregator agreement: https://www.ubldirect.com/corporate/UBLTimesv35/UBLand1LINKSignBill.aspx
- e-Pay Punjab aur PSID: https://apps.apple.com/iq/app/epay-punjab/id1465068821
- PayPro: documents, sole proprietor, wallets: https://paypro.com.pk/gateway/
- PayPro 1Bill se payment ka tareeqa: https://billing.paypro.com.pk/how-it-works/
- Kuickpay, Bank of Khyber aur 1LINK: https://pakobserver.net/bok-partners-with-1link-and-kuickpay-to-simplify-online-biller-onboarding/
- JS Bank, Kuickpay aur 1LINK: https://news.cxoforum.global/startups/js-bank-kuickpay-and-1link-partner-to-simplify-biller-integration-on-1bill
- PayFast partner guide (documents): https://www.scribd.com/document/830160195/Partner-Guide99
- Gateways ki fees: https://www.smart.houseofpakistan.com/payment-gateway-in-pakistan/ aur https://www.buzzinteractive.co/blog/payment-gateways-in-pakistan
- Gateways ke aam documents: https://digiteazy.com/payment-gateway-pakistan/
- IBA, 1Bill Topup wale banks: https://www.iba.edu.pk/faqsinternetbanking.php

## 32. Tabdeeliyon ka record

| Version | Tareekh | Tabdeeli |
|---|---|---|
| 0.1 | 15 Nov 2026 | Pehla intent: maqsad, visitors, research ke faislay, portal ke hisse, usool |
| 0.2 | 16 Nov 2026 | Version 2 (PSID) aur Version 3 (Top-up) ki research; order tracking, SEO aur ad ki jagahein |
| 0.3 | 16 Nov 2026 | Tay shuda values (number, rates, 2 ghante ka wada); VS Code ke liye technical spec, pages, build ki tarteeb |
| 0.4 | 16 Nov 2026 | Admin data capture, text format content, jobs, visitor UI aur history, Tailwind, WaSender aur Claude agent (Version 2) |
| 1.0 | 16 Nov 2026 | Final compile: nayi tarteeb (hisse A se F); KPIs, scope, mafrooze, refund policy ki tajweez, API ki kharabi mein rasta, non-functional zaroorat, analytics events, mahol aur backup, launch ka mansooba, rozana operations, payment ki tasdeeq, khatre, kirdar, istilahat, khule faislay ki list |

Aainda har tabdeeli yahan nayi line ke sath, aur upar ka version number barhe.
