# Snovko

AI učna platforma za starše osnovnošolcev (1.–9. razred). Starš uredi naročnino, otrok naloži šolsko snov
(fotografija zvezka, PDF, Word ali besedilo) in dobi razlago, kartončke in kviz. Starš spremlja napredek.

- **frontend/** — React + Vite, teče na http://localhost:5173
- **backend/** — Node.js + Express + SQLite (`better-sqlite3`), teče na http://localhost:4000

## Zahteve

- Node.js 22 ali novejši
- Anthropic API ključ (za generiranje gradiv)
- Stripe račun v testnem načinu in [Stripe CLI](https://docs.stripe.com/stripe-cli) (samo za plačila)

## 1. Namestitev

```bash
cd backend && npm install
cd ../frontend && npm install
```

## 2. Nastavitve (`.env`)

V korenu projekta skopiraj primer in izpolni vrednosti:

```bash
cp .env.example .env
```

| Spremenljivka | Obvezna | Opis |
|---|---|---|
| `ANTHROPIC_API_KEY` | da | ključ s https://console.anthropic.com/settings/keys |
| `JWT_SECRET` | da | naključen niz, npr. `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `STRIPE_SECRET_KEY` | za plačila | testni ključ `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | za plačila | `whsec_...`, izpiše ga `stripe listen` (glej spodaj) |
| `STRIPE_PRICE_BASIC`, `STRIPE_PRICE_STANDARD`, `STRIPE_PRICE_FAMILY` | za plačila | ustvari jih skripta (glej spodaj) |
| `FRONTEND_URL` | ne | privzeto `http://localhost:5173` |
| `PORT` | ne | privzeto `4000` |

`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` in `SENDGRID_API_KEY` so pripravljeni za prijavo z Googlom in večerne
e-maile, ki še nista implementirana.

## 3. Zagon

V dveh terminalih:

```bash
cd backend && node server.js
```

```bash
cd frontend && npm run dev
```

Odpri http://localhost:5173. Baza `backend/db/snovko.db` se ob prvem zagonu ustvari sama iz `backend/db/schema.sql`.

## 4. Stripe (plačila)

1. Ustvari tri mesečne cene (Basic 9,90 €, Standard 14,90 €, Družina 19,90 €). Skripta jih ustvari v tvojem
   Stripe računu in ID-je sama zapiše v `.env`; večkratni zagon jih ne podvoji:

   ```bash
   cd backend && node scripts/create-stripe-prices.js
   ```

2. Preusmeri Stripe dogodke na lokalni backend in izpisani `whsec_...` vpiši v `STRIPE_WEBHOOK_SECRET`:

   ```bash
   stripe listen --forward-to localhost:4000/api/stripe/webhook
   ```

3. Restartaj backend. Na strani **Naročnina** izberi paket; za testno plačilo uporabi kartico `4242 4242 4242 4242`.

Naročnina ima 7 dni brezplačnega preizkusa. Webhook ob dogodku `invoice.paid` (prvo plačilo in vsaka mesečna
obnova) nastavi kredite: Basic 100, Standard 500, Družina 500. Ob preklicu naročnine se paket odstrani.

### Brez Stripe

Za lokalno testiranje lahko staršu kredite dodaš ročno:

```bash
cd backend && node scripts/add-credits.js stars@primer.si 100 basic
```

## 5. Kako preizkusiti celoten potek

1. **Registracija starša** na `/register` (»Sem starš«) → samodejno odpre onboarding.
2. **Onboarding**: ime in razred otroka, predmeti. Na zadnjem koraku se pokaže **koda za otroka** (6 znakov).
3. **Krediti**: izberi paket na `/subscription` ali uporabi `scripts/add-credits.js`.
4. **Otrok** v drugem brskalniku (ali po odjavi starša) na `/register` izbere »Sem učenec« in vpiše kodo.
   Kodo lahko vpiše tudi kasneje na svoji strani.
5. **Otrok naloži snov** na `/child` → po ~20 sekundah se odpre `/results/:id` z izpiskom, kartončki in kvizom.
   Vsaka generacija porabi 2 kredita staršu.
6. **Pregled rešenega lista**: otrok na `/child` izbere »Preglej rešen list« in naloži fotografijo. Po ~30–40
   sekundah se odpre `/checks/:id` s kljukicami, križci in pripisanimi rešitvami na fotografiji ter seznamom nalog
   z razlagami. Stane 2 kredita; če na fotografiji ni nalog, se krediti ne odštejejo.
7. **Starš** na `/dashboard` vidi aktivnost zadnjih 7 dni, odstotek pravilnih odgovorov, najšibkejše teme,
   kredite in zadnjo aktivnost (tudi pregledane liste).

## Krediti in paketi

| Paket | Cena | Krediti / mesec | Otroci |
|---|---|---|---|
| Basic | 9,90 € | 100 (50 gradiv) | 1 |
| Standard | 14,90 € | 500 (250 gradiv) | 1 |
| Družina | 19,90 € | 500 (250 gradiv) | do 3 |

Ena generacija (izpisek + kartončki + kviz) = 2 kredita. Krediti se odštejejo šele, ko je gradivo uspešno ustvarjeno.

## API

| Metoda | Pot | Kdo |
|---|---|---|
| POST | `/api/auth/register` | vsi (`email`, `password`, `name`, `role`, pri otroku neobvezno `access_code`) |
| POST | `/api/auth/login` | vsi |
| GET | `/api/auth/me` | prijavljeni |
| GET / POST | `/api/children` | starš (seznam / dodaj otroka: `name`, `grade`, `subjects`) |
| POST | `/api/children/link` | otrok (`code`) |
| POST | `/api/generate` | starš ali otrok; `multipart/form-data` z `file` ali JSON s `text`, plus `subject` (starš še `child_id`) |
| GET | `/api/generations/:id` | starš ali otrok |
| POST | `/api/generations/:id/quiz-results` | starš ali otrok (`score`, `total`) |
| POST | `/api/checks` | starš ali otrok; `multipart/form-data` s fotografijo `file` (JPG/PNG) in `subject` |
| GET | `/api/checks/:id` in `/api/checks/:id/image` | starš ali otrok |
| GET | `/api/dashboard/child` | otrok (starš s `?child_id=`) |
| GET | `/api/dashboard/parent` | starš (neobvezno `?child_id=`) |
| POST | `/api/stripe/create-subscription` | starš (`plan`: `basic`, `standard`, `family`) |
| POST | `/api/stripe/webhook` | Stripe |

## Opombe

- Fotografije (JPG/PNG) prebere Claude neposredno, zato deluje tudi rokopis iz zvezka. PDF prebere `pdf-parse`,
  DOCX pa `mammoth`. Brskalnik velike fotografije pred pošiljanjem pomanjša.
- Modeli: gradiva ustvarja `claude-haiku-4-5`, rešene liste pregleduje `claude-opus-5` (natančnejše branje rokopisa
  in postavitev oznak, a dražje in počasneje). Model za pregled je v `backend/services/worksheet.js`.
  Pregled ima vklopljen samodejni rezervni model (`fallbacks: "default"`), če Opus 5 zahtevo zavrne.
- Fotografije pregledanih listov se shranijo v `backend/uploads/checks/` in so dostopne samo staršu in otroku.
- Ob spremembi `schema.sql` obstoječa baza ne dobi novih stolpcev. Med razvojem ustavi backend in izbriši
  `backend/db/snovko.db*`, da se ustvari na novo.
- Še ni implementirano: prijava z Googlom, večerni e-mail staršu, video razlage (gumb pokaže »kmalu«),
  dokup kreditov in Stripe portal za preklic naročnine.
