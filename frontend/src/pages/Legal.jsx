import { Link } from 'react-router-dom';
import '../styles/legal.css';

const UPDATED = '25. september 2026';

// Besedilo je izhodišče, ne pravni nasvet — pred pravim zagonom naj ga pregleda pravnik,
// ker gre za obdelavo podatkov mladoletnih oseb
const TERMS = [
  {
    title: 'Kaj je Snovko',
    body: [
      'Snovko je spletna storitev, ki iz šolske snovi samodejno pripravi razlago, kartončke, kviz in učni list. Namenjena je staršem osnovnošolcev, ki otroku pomagajo pri učenju.',
      'Gradiva pripravi umetna inteligenca. Kljub skrbni pripravi so napake mogoče — gradivo je pripomoček pri učenju in ne nadomešča učitelja, učbenika ali šolske razlage. Priporočamo, da starš vsebino pregleda.',
    ],
  },
  {
    title: 'Račun',
    body: [
      'Račun odpre starš ali skrbnik, ki je polnoleten. Otrok dobi svoj dostop prek kode, ki jo ustvari starš.',
      'Za varovanje gesla odgovarjate sami. Če sumite zlorabo, geslo nemudoma zamenjajte.',
      'Račun lahko kadarkoli izbrišete. Z izbrisom se odstranijo tudi vsa gradiva in podatki o napredku.',
    ],
  },
  {
    title: 'Naročnina in krediti',
    body: [
      'Storitev deluje na kredite. Vsaka priprava gradiva, pregled rešenega lista ali učni list porabi določeno število kreditov, ki je navedeno ob dejanju.',
      'Naročnina se obnavlja mesečno. Prekličete jo lahko kadarkoli; velja do konca že plačanega obdobja, neizrabljeni krediti pa se ob koncu obdobja ne prenesejo.',
      'Cene so navedene v evrih in vključujejo DDV.',
    ],
  },
  {
    title: 'Pravica do odstopa',
    body: [
      'Kot potrošnik imate pravico do odstopa od pogodbe v 14 dneh brez navedbe razloga. Ker gre za digitalno vsebino, ki je na voljo takoj, se s pričetkom uporabe strinjate, da se storitev začne izvajati pred iztekom odstopnega roka.',
      'Za odstop nam pišite na e-naslov podpore.',
    ],
  },
  {
    title: 'Kaj ni dovoljeno',
    body: [
      'Storitve ni dovoljeno uporabljati za nalaganje vsebin, do katerih nimate pravic, ali za karkoli nezakonitega.',
      'Samodejno množično pošiljanje zahtev ali poskusi obhoda omejitev lahko vodijo do začasne ali trajne ukinitve računa.',
    ],
  },
  {
    title: 'Odgovornost',
    body: [
      'Storitev je na voljo takšna, kot je. Prizadevamo si za neprekinjeno delovanje, a ga ne moremo zagotoviti.',
      'Naša odgovornost je omejena na znesek, ki ste ga za storitev plačali v zadnjih treh mesecih, razen kadar zakon določa drugače.',
    ],
  },
];

const PRIVACY = [
  {
    title: 'Kdo obdeluje podatke',
    body: [
      'Upravljavec osebnih podatkov je ponudnik storitve Snovko. Za vsa vprašanja glede zasebnosti nam pišite na e-naslov podpore.',
    ],
  },
  {
    title: 'Kateri podatki se obdelujejo',
    body: [
      'Podatki starša: ime, e-naslov, zgoščeno geslo, podatki o naročnini in plačilih.',
      'Podatki otroka: ime (lahko je tudi vzdevek) in razred. Ne zbiramo otrokovega e-naslova, razen če starš otroku ustvari ločen dostop — takrat je potreben e-naslov za prijavo.',
      'Vsebina učenja: naložena snov (fotografija, dokument ali besedilo), pripravljena gradiva, rezultati kvizov in pregledani učni listi.',
      'Tehnični podatki: čas dostopa in osnovni dnevniki strežnika, potrebni za delovanje in varnost.',
    ],
  },
  {
    title: 'Zakaj jih obdelujemo',
    body: [
      'Za izvajanje storitve, ki ste jo naročili (pravna podlaga: izvajanje pogodbe).',
      'Za obračun naročnine (pravna podlaga: izvajanje pogodbe in zakonske obveznosti).',
      'Za varnost storitve in preprečevanje zlorab (pravna podlaga: zakoniti interes).',
    ],
  },
  {
    title: 'Podatki otrok',
    body: [
      'Račun odpre starš ali skrbnik, ki s tem privoli v obdelavo otrokovih podatkov. Otrokovih podatkov ne uporabljamo za oglaševanje in jih ne prodajamo.',
      'Priporočamo, da za otroka uporabite le ime ali vzdevek, ne pa polnega imena in priimka.',
    ],
  },
  {
    title: 'Komu se podatki posredujejo',
    body: [
      'Anthropic (ZDA) — za pripravo gradiv se vsebina naložene snovi posreduje modelu Claude. Vsebina se ne uporablja za učenje modelov.',
      'Stripe — obdelava plačil. Podatkov o kartici nikoli ne vidimo in jih ne hranimo.',
      'Ponudnika gostovanja (Render, Vercel) — tehnično izvajanje storitve.',
      'Prenosi zunaj EU potekajo na podlagi standardnih pogodbenih klavzul.',
    ],
  },
  {
    title: 'Kako dolgo hranimo podatke',
    body: [
      'Podatke računa hranimo, dokler je račun aktiven. Po izbrisu računa se podatki odstranijo v 30 dneh.',
      'Računovodske podatke o plačilih hranimo toliko časa, kolikor zahteva davčna zakonodaja.',
    ],
  },
  {
    title: 'Vaše pravice',
    body: [
      'Kadarkoli lahko zahtevate dostop do svojih podatkov, popravek, izbris, omejitev obdelave ali prenos podatkov.',
      'Če menite, da podatke obdelujemo nezakonito, se lahko pritožite Informacijskemu pooblaščencu RS.',
    ],
  },
  {
    title: 'Piškotki',
    body: [
      'Uporabljamo samo tehnično nujno shrambo v brskalniku, ki ohranja vašo prijavo. Ne uporabljamo oglaševalskih ali sledilnih piškotkov.',
    ],
  },
];

function LegalPage({ kicker, title, sections }) {
  return (
    <main className="page page-narrow legal-page">
      <p className="kicker">{kicker} →</p>
      <h1>{title}</h1>
      <p className="legal-updated">Zadnja sprememba: {UPDATED}</p>

      {sections.map(section => (
        <section key={section.title} className="legal-section">
          <h2>{section.title}</h2>
          {section.body.map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
        </section>
      ))}

      <p className="legal-back">
        <Link to="/">← nazaj na domačo stran</Link>
      </p>
    </main>
  );
}

export function Terms() {
  return <LegalPage kicker="pogoji uporabe" title="Pogoji uporabe" sections={TERMS} />;
}

export function Privacy() {
  return <LegalPage kicker="zasebnost" title="Izjava o zasebnosti" sections={PRIVACY} />;
}
