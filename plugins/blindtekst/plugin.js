// Blindtekst: Nederlandse opvultekst (of lorem ipsum) als net afgebroken tekstblok.
// Eigen werk, MIT-licentie (zie de README van deze repo).
'use strict';

// ---- hulpjes voor het venster ----------------------------------------------

function maak(tag, opties = {}, ...kinderen) {
  const el = document.createElement(tag);
  for (const [sleutel, waarde] of Object.entries(opties)) {
    if (waarde === undefined || waarde === null || waarde === false) continue;
    if (sleutel === 'klasse') el.className = waarde;
    else if (sleutel === 'tekst') el.textContent = waarde;
    else if (sleutel === 'stijl') Object.assign(el.style, waarde);
    else if (sleutel.startsWith('bij')) el.addEventListener(sleutel.slice(3).toLowerCase(), waarde);
    else el.setAttribute(sleutel, waarde === true ? '' : String(waarde));
  }
  for (const kind of kinderen) if (kind) el.append(kind);
  return el;
}

function getalVeld(waarde, min, max, stap) {
  return maak('input', { klasse: 'veld', type: 'number', value: waarde, min, max, step: stap, inputmode: 'decimal' });
}

function keuzeVeld(opties, waarde) {
  const veld = maak('select', { klasse: 'veld' }, ...opties.map(([w, t]) => maak('option', { value: w, tekst: t })));
  veld.value = opties.some(([w]) => w === waarde) ? waarde : opties[0][0];
  return veld;
}

function vinkje(tekst, aan) {
  const invoer = maak('input', { type: 'checkbox' });
  invoer.checked = Boolean(aan);
  const blok = maak('label', { stijl: { display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', minWidth: '0' } },
    invoer, maak('span', { tekst }));
  return { blok, invoer };
}

/** Label boven een veld, met optioneel een eenheid erachter. */
function metLabel(labelTekst, veld, eenheid) {
  veld.style.flex = '1';
  veld.style.minWidth = '0';
  const regel = maak('div', { stijl: { display: 'flex', alignItems: 'center', gap: '6px' } }, veld);
  if (eenheid) regel.append(maak('span', { klasse: 'uitleg', tekst: eenheid }));
  return maak('label', { stijl: { display: 'grid', gap: '4px', minWidth: '0' } },
    maak('span', { klasse: 'label', tekst: labelTekst, stijl: { minWidth: '0' } }), regel);
}

/** Een raster van n gelijke kolommen. */
const kolommen = (n, ...kinderen) =>
  maak('div', { stijl: { display: 'grid', gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, gap: '10px', alignItems: 'end' } }, ...kinderen);

const leesGetal = (veld, terugval) => {
  const n = Number(String(veld.value).trim().replace(',', '.'));
  return String(veld.value).trim() !== '' && Number.isFinite(n) ? n : terugval;
};
const begrens = (n, min, max) => Math.min(max, Math.max(min, n));
const css = (naam, terugval) => getComputedStyle(document.documentElement).getPropertyValue(naam).trim() || terugval;
const nl = (n, cijfers = 1) => n.toLocaleString('nl-NL', { maximumFractionDigits: cijfers });
const naarMm = (pt) => pt / vexel.mm(1);

/** Canvas op de juiste pixeldichtheid; geeft { g, b, h } terug. */
function bereidDoek(doek) {
  const schaal = devicePixelRatio || 1;
  const kader = doek.getBoundingClientRect();
  doek.width = Math.max(1, Math.round(kader.width * schaal));
  doek.height = Math.max(1, Math.round(kader.height * schaal));
  const g = doek.getContext('2d');
  g.setTransform(schaal, 0, 0, schaal, 0, 0);
  g.clearRect(0, 0, kader.width, kader.height);
  return { g, b: kader.width, h: kader.height };
}

// ---- kleuren ----------------------------------------------------------------

/** Een kleur als { cmyk, hex }: in een CMYK-document CMYK, anders hex. */
const kleur = (cmyk, hex, isCmyk) => (isCmyk ? { cmyk } : { hex });

/** CMYK naar een hex-benadering, voor de voorvertoning. */
function cmykNaarHex([c, m, y, k]) {
  const f = (a) => Math.round(255 * (1 - a / 100) * (1 - k / 100)).toString(16).padStart(2, '0');
  return `#${f(c)}${f(m)}${f(y)}`;
}

// ---- tekst meten en afbreken (Inter, geschat) ---------------------------------

const SMAL = new Set([..."iIl.,:;'!|j()[]{}ft"]);
const HALF = new Set([...'rsJ1-"/']);
const BREED = new Set([...'mwMW@%']);
const RUIM = new Set([...'ABCDEGHKNOQRUVXY&#0234567890']);

/** Geschatte breedte van een tekst in em (Inter, normaal gewicht). */
function emBreedte(tekst) {
  let som = 0;
  for (const t of tekst) {
    if (t === ' ') som += 0.28;
    else if (SMAL.has(t)) som += 0.28;
    else if (HALF.has(t)) som += 0.4;
    else if (BREED.has(t)) som += 0.86;
    else if (RUIM.has(t)) som += 0.66;
    else if (t >= 'A' && t <= 'Z') som += 0.62;
    else som += 0.55;
  }
  return som;
}

/** Breedte in pt bij een lettergrootte en gewicht (vet is iets breder). */
const tekstBreedte = (tekst, grootte, gewicht = 400) => emBreedte(tekst) * grootte * (1 + Math.max(0, gewicht - 400) / 300 * 0.06);

/** Breek een tekst af in regels die binnen `breedte` pt passen. */
function breekAf(tekst, breedte, grootte, gewicht = 400) {
  const regels = [];
  for (const alinea of String(tekst).split('\n')) {
    let regel = '';
    for (const woord of alinea.split(/\s+/).filter(Boolean)) {
      const proef = regel ? `${regel} ${woord}` : woord;
      if (!regel || tekstBreedte(proef, grootte, gewicht) <= breedte) regel = proef;
      else { regels.push(regel); regel = woord; }
    }
    regels.push(regel);
  }
  return regels;
}

// ---- willekeur met zaadje -------------------------------------------------------

function willekeur(zaad) {
  let a = (zaad >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- het venster: vaste opbouw ------------------------------------------------------

/** Knoppenrij met Annuleren en de hoofdknop. Extra knoppen (gewone .knop) mogen ervoor. */
function knoppenRij(hoofdTekst, ...extra) {
  const hoofd = maak('button', { klasse: 'knop primair', type: 'submit', tekst: hoofdTekst });
  const annuleer = maak('button', { klasse: 'knop', type: 'button', tekst: 'Annuleren', bijClick: () => vexel.sluit() });
  const rij = maak('div', { klasse: 'knoppen', stijl: { marginTop: '0' } }, ...extra, annuleer, hoofd);
  return { rij, hoofd };
}

// ---- de tekst --------------------------------------------------------------
// Eigen, verzonnen zinsdelen. Elk deel is een hoofdzin, zodat je ze met een
// voegwoord als en, maar, want of dus aan elkaar kunt rijgen.

const ZINSDELEN = [
  'de bakker op de hoek opent zijn winkel al ruim voor zonsopgang',
  'het water in de haven ligt er vanochtend opvallend stil bij',
  'de nieuwe bibliotheek trekt elke week meer bezoekers',
  'in het voorjaar bloeien de bermen langs de dijk geel en paars',
  'onze buren hebben de oude schuur omgebouwd tot een atelier',
  'de trein naar het noorden vertrekt vandaag van spoor zeven',
  'een goed plan begint meestal met een eenvoudige schets',
  'de markt op zaterdag is het hart van het dorp',
  'het museum toont deze maand werk van jonge ontwerpers',
  'de wind draait in de loop van de middag naar het westen',
  'wie vroeg opstaat, heeft de stad nog even voor zichzelf',
  'de koffie in het café aan het plein is werkelijk uitstekend',
  'de fietsenmaker repareert alles wat twee wielen heeft',
  'een rustige bladspiegel maakt een tekst prettig om te lezen',
  'de drukker controleert elke proef met een kritisch oog',
  'het papier voelt stevig aan en heeft een mooie, matte glans',
  'de vergadering duurt langer dan iedereen had verwacht',
  'het festival trekt bezoekers uit het hele land',
  'de kinderen bouwen een hut van takken aan de rand van het bos',
  'een kleine aanpassing kan een groot verschil maken',
  'de veerboot vaart elk half uur naar de overkant',
  'het oude stadhuis krijgt binnenkort een nieuwe bestemming',
  'de tuin achter het huis staat vol met kruiden en bessen',
  'de redactie zoekt nog verhalen over vroeger',
  'de lichten van de brug weerspiegelen in het donkere water',
  'een stevige wandeling langs het strand doet altijd goed',
  'de bus rijdt in het weekend een andere route',
  'de kaasboer geeft op vrijdag een stukje te proeven',
  'het nieuwe seizoen begint met een feestelijke opening',
  'de molen draait weer sinds de wieken zijn hersteld',
  'de bewoners hebben samen een moestuin aangelegd',
  'het boek leest als een trein en verveelt geen moment',
  'de leraar vertelt met zichtbaar plezier over de sterren',
  'een heldere kop trekt de lezer meteen de tekst in',
  'het regent al de hele ochtend zachtjes op het dak',
  'de schilder werkt het liefst bij het eerste daglicht',
  'de wijk rond het station is de laatste jaren flink veranderd',
  'de folder ligt vanaf maandag bij alle verkooppunten',
  'het koor repeteert elke dinsdagavond in de oude kerk',
  'de zon breekt eindelijk door boven de polder',
  'de bezorger komt meestal net na de middag langs',
  'een goede foto zegt vaak meer dan een lange uitleg',
  'het restaurant serveert alleen groenten uit de streek',
  'de jaarmarkt valt dit jaar op de laatste zaterdag van september',
  'de kustlijn verandert met elke storm een klein beetje',
  'de vrijwilligers zetten de stoelen al ruim op tijd klaar',
  'het pakket is netjes ingepakt en op tijd aangekomen',
  'de nieuwe huisstijl oogt fris, rustig en herkenbaar',
  'de kat ligt de hele middag te slapen in de vensterbank',
  'het pad slingert tussen de duinen door naar zee',
  'de werkplaats ruikt naar hout, lijm en verse verf',
  'de opbrengst gaat dit jaar naar de speeltuin in de buurt',
  'een duidelijke planning voorkomt veel gedoe achteraf',
  'de klok op de toren loopt al jaren een paar minuten voor',
  'de boer haalt het hooi binnen voordat het gaat regenen',
  'het theater speelt deze winter een klassiek stuk',
  'de brug gaat elk uur open voor de schepen',
  'de nieuwsbrief verschijnt voortaan één keer per maand',
  'het park is in de zomer een geliefde plek om te picknicken',
  'de ontwerper kiest bewust voor veel witruimte',
  'de oogst valt dit najaar ruimer uit dan gedacht',
  'de vuurtoren is in de zomer op woensdag te bezoeken',
  'het concert in de tuin trekt honderden luisteraars',
  'de buurtwinkel bezorgt de boodschappen nu ook aan huis',
  'de oude foto’s geven een mooi beeld van het dorp van vroeger',
  'de sneeuw blijft maar een paar uur liggen',
  'het team werkt deze week aan een nieuwe brochure',
  'een goede letter maakt een tekst rustig en helder',
  'de gemeente plant langs de kade honderd nieuwe bomen',
  'de visser vertrekt bij het eerste licht naar zee',
  'het programma voor het najaar staat vanaf vandaag online',
  'de bloemen op de markt komen rechtstreeks van de kwekerij',
  'de wandelroute voert langs drie oude boerderijen',
  'de jongste bezoekers mogen zelf een poster ontwerpen',
  'het licht valt in de herfst schuin door de ramen',
  'de school viert dit jaar haar honderdste verjaardag',
  'de schaatsers wachten al weken op een flinke vorst',
  'de collectie groeit elk jaar met een paar bijzondere stukken',
  'het ontbijt wordt geserveerd tot half elf',
  'de lezers sturen elke maand weer prachtige verhalen in',
];

const VOEGWOORDEN = ['en', 'en', 'en', 'maar'];

const KOPPEN = [
  'Een nieuwe kijk op de stad', 'Alles over het voorjaar', 'Even voorstellen', 'Wat we samen bereikten',
  'Nieuws uit de buurt', 'Een dag aan de kust', 'Plannen voor het nieuwe seizoen', 'Zo werken wij',
  'Van schets tot drukwerk', 'Terug naar het begin', 'Op pad met de redactie', 'Het verhaal achter de molen',
  'Kort nieuws', 'Een bijzonder jaar', 'Welkom in de werkplaats', 'Onze aanpak',
];

const LOREM_BEGIN = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.';
const LOREM_WOORDEN = ('lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna '
  + 'aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure '
  + 'in reprehenderit voluptate velit esse cillum fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa '
  + 'qui officia deserunt mollit anim id est laborum').split(' ');
const LOREM_KOPPEN = ['Lorem ipsum dolor', 'Consectetur adipiscing', 'Sed do eiusmod', 'Ut enim ad minim', 'Duis aute irure'];

const hoofdletter = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** Maakt een tekstgenerator voor één taal met een eigen zaadje. */
function generator(taal, zaad) {
  const kans = willekeur(zaad);
  const kies = (lijst) => lijst[Math.floor(kans() * lijst.length)];
  // trek zinsdelen zonder terugleggen, zodat ze niet snel herhalen
  let stapel = [];
  const trek = () => {
    if (!stapel.length) {
      stapel = ZINSDELEN.map((_, i) => i);
      for (let i = stapel.length - 1; i > 0; i--) {
        const j = Math.floor(kans() * (i + 1));
        [stapel[i], stapel[j]] = [stapel[j], stapel[i]];
      }
    }
    return ZINSDELEN[stapel.pop()];
  };
  let eersteLorem = taal === 'lorem';

  function nederlandseZin() {
    let zin = trek();
    if (kans() < 0.4) zin += `, ${kies(VOEGWOORDEN)} ${trek()}`;
    return `${hoofdletter(zin)}.`;
  }

  function loremZin() {
    if (eersteLorem) { eersteLorem = false; return LOREM_BEGIN; }
    const n = 6 + Math.floor(kans() * 11);
    const woorden = [];
    while (woorden.length < n) {
      const woord = kies(LOREM_WOORDEN);
      if (woord !== woorden[woorden.length - 1]) woorden.push(woord);
    }
    if (n > 9 && kans() < 0.6) woorden[3 + Math.floor(kans() * (n - 6))] += ',';
    return `${hoofdletter(woorden.join(' '))}.`;
  }

  return {
    zin: taal === 'lorem' ? loremZin : nederlandseZin,
    kop: () => kies(taal === 'lorem' ? LOREM_KOPPEN : KOPPEN),
    zinnenPerAlinea: () => 3 + Math.floor(kans() * 3),
  };
}

const woordenIn = (s) => s.split(/\s+/).filter(Boolean).length;
const VEILIG = 0.97; // breek iets eerder af: de breedte is een schatting

/** Kapt een rij zinnen af op precies `max` woorden en sluit af met een punt. */
function kapAfOpWoorden(zinnen, max) {
  const uit = [];
  let teller = 0;
  for (const zin of zinnen) {
    const woorden = zin.split(/\s+/).filter(Boolean);
    if (teller + woorden.length <= max) { uit.push(zin); teller += woorden.length; continue; }
    const rest = woorden.slice(0, max - teller).join(' ').replace(/[,.]+$/, '');
    if (rest) uit.push(`${rest}.`);
    break;
  }
  return uit;
}

/** Een vaste voorraad zinnen en alinea-indeling, zodat meer of minder tekst steeds hetzelfde begint. */
function voorraad(w, aantalZinnen) {
  const gen = generator(w.taal, w.zaad);
  const kop = gen.kop();
  const zinnen = [];
  const grenzen = [];
  let tot = 0;
  while (zinnen.length < aantalZinnen) {
    const n = gen.zinnenPerAlinea();
    for (let k = 0; k < n; k++) zinnen.push(gen.zin());
    tot += n;
    grenzen.push(tot);
  }
  return { kop, zinnen, grenzen };
}

/** Bundelt de eerste `n` zinnen tot alinea's volgens de vaste indeling. */
function bundel(v, n) {
  const alineas = [];
  let begin = 0;
  for (const grens of v.grenzen) {
    if (begin >= n) break;
    alineas.push(v.zinnen.slice(begin, Math.min(grens, n)).join(' '));
    begin = grens;
  }
  return alineas;
}

/**
 * De hele tekst: { kop, alineas: [string] }. Bij 'vullen' kiest `past(tekst)`
 * het grootste aantal zinnen dat nog in de ruimte past.
 */
function maakTekst(w, past) {
  if (w.eenheid === 'alineas') {
    const v = voorraad(w, w.aantal * 5);
    return { kop: w.kop ? v.kop : null, alineas: bundel(v, v.grenzen[w.aantal - 1]) };
  }
  if (w.eenheid === 'vullen') {
    const v = voorraad(w, 600);
    const tekst = (n) => ({ kop: w.kop ? v.kop : null, alineas: bundel(v, n) });
    let laag = 1;
    let hoog = v.zinnen.length;
    if (!past(tekst(1))) return tekst(1);
    while (laag < hoog) {
      const midden = Math.ceil((laag + hoog) / 2);
      if (past(tekst(midden))) laag = midden;
      else hoog = midden - 1;
    }
    return tekst(laag);
  }
  // zinnen of woorden (elke zin heeft minstens zes woorden, dus dit is genoeg)
  const nodig = w.eenheid === 'zinnen' ? w.aantal : Math.ceil(w.aantal / 6) + 2;
  const v = voorraad(w, nodig);
  const zinnen = w.eenheid === 'zinnen' ? v.zinnen.slice(0, w.aantal) : kapAfOpWoorden(v.zinnen, w.aantal);
  return { kop: w.kop ? v.kop : null, alineas: bundel({ ...v, zinnen }, zinnen.length) };
}

// ---- opmaak: regels en posities -------------------------------------------------

/** Rekent alle regels en hun basislijnen uit, in pt vanaf linksboven van het blok. */
function zetTekst(tekst, w, breedte) {
  const kopGrootte = Math.round(w.grootte * 1.6 * 2) / 2;
  const kopRegel = kopGrootte * 1.2;
  const blokken = [];
  let y = 0;
  if (tekst.kop) {
    const regels = breekAf(tekst.kop, breedte * VEILIG, kopGrootte, 700);
    blokken.push({ soort: 'kop', regels, grootte: kopGrootte, regelafstand: kopRegel, basis: y + kopGrootte * 0.95 });
    y += regels.length * kopRegel + w.grootte * 0.6;
  }
  tekst.alineas.forEach((alinea, i) => {
    if (i > 0) y += w.alineaWit;
    const regels = breekAf(alinea, breedte * VEILIG, w.grootte, 400);
    blokken.push({ soort: 'alinea', regels, grootte: w.grootte, regelafstand: w.regelafstand, basis: y + w.grootte * 0.95 });
    y += (regels.length - 1) * w.regelafstand + w.grootte * 1.2;
  });
  return { blokken, hoogte: y, breedte };
}

// ---- het venster ------------------------------------------------------------------

const STANDAARD = {
  taal: 'nl', eenheid: 'alineas', aantal: 3, kop: true, grootte: 10, regelafstand: 14, autoRegel: true,
  breedte: 120, plaats: 'midden', losseRegels: false, uitlijning: 'links', zaad: 1, binnenSel: 3, margeMidden: 20,
};

async function toonVenster() {
  const doc = await vexel.document();
  let selectie = [];
  try { selectie = await vexel.selectie(); } catch (fout) { selectie = []; }
  const doelVorm = selectie.find((o) => o.kader && o.kader.b > vexel.mm(5) && o.kader.h > 1) || null;
  const w0 = { ...STANDAARD, ...((await vexel.haal('instellingen')) || {}) };
  if (!doelVorm && w0.plaats === 'selectie') w0.plaats = 'midden';
  if (doelVorm && !(await vexel.haal('instellingen'))) w0.plaats = 'selectie';
  const isCmyk = doc.kleurruimte === 'cmyk';

  const taal = keuzeVeld([['nl', 'Nederlands (eigen zinnen)'], ['lorem', 'Latijn (lorem ipsum)']], w0.taal);
  const eenheid = keuzeVeld([['alineas', 'alinea’s'.replace('’', '’')], ['zinnen', 'zinnen'], ['woorden', 'woorden'], ['vullen', 'tot het vol is']], w0.eenheid);
  const aantal = getalVeld(w0.aantal, 1, 2000, 1);
  const kop = vinkje('Met kop', w0.kop);
  const grootte = getalVeld(w0.grootte, 4, 72, 0.5);
  const regelafstand = getalVeld(w0.regelafstand, 4, 120, 0.5);
  const autoRegel = vinkje('Auto', w0.autoRegel);
  const breedte = getalVeld(w0.breedte, 10, 2000, 1);
  const plaats = keuzeVeld([
    ['selectie', doelVorm ? 'In de selectie' : 'In de selectie (niets geselecteerd)'],
    ['midden', 'Midden op het tekengebied'],
  ], w0.plaats);
  plaats.options[0].disabled = !doelVorm;
  const uitlijning = keuzeVeld([['links', 'Links'], ['midden', 'Gecentreerd'], ['rechts', 'Rechts']], w0.uitlijning);
  const losseRegels = vinkje('Elke regel apart', w0.losseRegels);
  const zaad = getalVeld(w0.zaad, 1, 99999, 1);
  const marges = { selectie: w0.binnenSel, midden: w0.margeMidden };
  const marge = getalVeld(marges[w0.plaats], 0, 200, 0.5);
  let margeVoor = w0.plaats;

  const doek = maak('canvas', { 'aria-hidden': 'true', stijl: { width: '100%', height: '120px' } });
  const samenvatting = maak('p', { klasse: 'uitleg', 'aria-live': 'polite', stijl: { margin: '0', minHeight: '17px' } });
  const ander = maak('button', { klasse: 'knop', type: 'button', tekst: 'Variëren', title: 'Andere zinnen: kies een nieuw zaadje', stijl: { whiteSpace: 'nowrap' } });
  const { rij: knoppen, hoofd } = knoppenRij('Plaatsen');
  autoRegel.blok.title = 'Regelafstand automatisch: 1,4 × de lettergrootte';

  const formulier = maak('form', { stijl: { display: 'grid', gap: '10px' } },
    kolommen(3, maak('div', { stijl: { gridColumn: 'span 2', minWidth: '0' } }, metLabel('Tekst', taal)), metLabel('Zaadje', zaad)),
    kolommen(3, metLabel('Aantal', aantal), metLabel('Eenheid', eenheid), maak('div', { stijl: { justifySelf: 'end', minWidth: '0' } }, ander)),
    kolommen(3, metLabel('Grootte', grootte, 'pt'), metLabel('Regelafstand', regelafstand, 'pt'),
      maak('div', { stijl: { paddingBottom: '5px', whiteSpace: 'nowrap' } }, autoRegel.blok)),
    kolommen(3, metLabel('Breedte', breedte, 'mm'), maak('div', { stijl: { gridColumn: 'span 2', minWidth: '0' } }, metLabel('Uitlijning', uitlijning))),
    kolommen(3, maak('div', { stijl: { gridColumn: 'span 2', minWidth: '0' } }, metLabel('Plaats', plaats)), metLabel('Marge', marge, 'mm')),
    maak('div', { stijl: { display: 'flex', gap: '16px', flexWrap: 'wrap' } }, kop.blok, losseRegels.blok),
    doek,
    samenvatting,
    knoppen,
  );
  document.head.append(maak('style', { tekst: 'label, label > div { min-width: 0; } select.veld { width: 100%; }' }));
  document.body.append(formulier);

  const waarden = () => {
    const g = begrens(leesGetal(grootte, 10), 4, 72);
    const automatisch = autoRegel.invoer.checked;
    const regel = automatisch ? Math.round(g * 1.4 * 2) / 2 : begrens(leesGetal(regelafstand, g * 1.4), 4, 120);
    const soort = eenheid.value;
    const max = { alineas: 50, zinnen: 400, woorden: 5000 }[soort];
    return {
      taal: taal.value,
      eenheid: soort,
      aantal: Math.round(begrens(leesGetal(aantal, 3), 1, max)),
      kop: kop.invoer.checked,
      grootte: g,
      regelafstand: regel,
      autoRegel: automatisch,
      alineaWit: Math.round(regel * 0.5 * 2) / 2,
      breedte: begrens(leesGetal(breedte, 120), 10, 2000),
      plaats: plaats.value === 'selectie' && doelVorm ? 'selectie' : 'midden',
      uitlijning: uitlijning.value,
      losseRegels: losseRegels.invoer.checked,
      binnen: begrens(leesGetal(marge, 0), 0, 200),
      binnenSel: plaats.value === 'selectie' ? begrens(leesGetal(marge, 3), 0, 200) : marges.selectie,
      margeMidden: plaats.value === 'midden' ? begrens(leesGetal(marge, 20), 0, 200) : marges.midden,
      zaad: Math.round(begrens(leesGetal(zaad, 1), 1, 99999)),
    };
  };

  /** Het blok in pt op het tekengebied: { x, y, b, ruimte } (ruimte = beschikbare hoogte of null). */
  function plek(w, hoogte) {
    const tg = doc.tekengebied;
    if (w.plaats === 'selectie') {
      const k = doelVorm.kader;
      const m = Math.min(vexel.mm(w.binnen), k.b / 4, k.h / 4);
      return { x: k.x + m, y: k.y + m, b: k.b - 2 * m, ruimte: k.h - 2 * m };
    }
    const b = Math.min(vexel.mm(w.breedte), tg.b);
    const ruimte = Math.max(vexel.mm(10), tg.h - 2 * vexel.mm(w.binnen));
    return { x: (tg.b - b) / 2, y: Math.max(0, (tg.h - hoogte) / 2), b, ruimte };
  }

  function bereken() {
    const w = waarden();
    const vak = plek(w, 0);
    const tekst = maakTekst(w, (t) => zetTekst(t, w, vak.b).hoogte <= vak.ruimte);
    const zet = zetTekst(tekst, w, vak.b);
    return { w, tekst, zet, plek: plek(w, zet.hoogte) };
  }

  function teken() {
    if (plaats.value !== margeVoor) {
      marges[margeVoor] = begrens(leesGetal(marge, marges[margeVoor]), 0, 200);
      margeVoor = plaats.value;
      marge.value = String(marges[margeVoor]);
    }
    marge.title = plaats.value === 'selectie' ? 'Ruimte tussen de rand van de selectie en de tekst' : 'Ruimte boven en onder (telt bij ‘tot het vol is’)';
    aantal.disabled = eenheid.value === 'vullen';
    regelafstand.disabled = autoRegel.invoer.checked;
    breedte.disabled = plaats.value === 'selectie';
    if (autoRegel.invoer.checked) regelafstand.value = String(waarden().regelafstand);
    const { w, tekst, zet, plek: p } = bereken();
    if (w.plaats === 'selectie') breedte.value = String(Math.round(naarMm(p.b)));

    const regels = zet.blokken.reduce((s, b) => s + b.regels.length, 0);
    const woorden = tekst.alineas.reduce((s, a) => s + woordenIn(a), 0);
    const teHoog = zet.hoogte > p.ruimte + 0.5;
    const delen = [
      `${tekst.alineas.length} ${tekst.alineas.length === 1 ? 'alinea' : 'alinea’s'}`,
      `${woorden} woorden`, `${regels} regels`,
      `${nl(naarMm(p.b), 0)} × ${nl(naarMm(zet.hoogte), 0)} mm`,
    ];
    if (doc.alleenLezen) {
      samenvatting.textContent = 'Dit document is alleen-lezen; je kunt hier niets plaatsen.';
      samenvatting.className = 'uitleg fout';
    } else if (teHoog) {
      samenvatting.textContent = `${delen.join(' · ')}. Te hoog voor de ${nl(naarMm(p.ruimte), 0)} mm ruimte: kies minder tekst of ‘tot het vol is’.`;
      samenvatting.className = 'uitleg fout';
    } else {
      samenvatting.textContent = `${delen.join(' · ')}.`;
      samenvatting.className = 'uitleg';
    }
    hoofd.disabled = doc.alleenLezen;

    // voorvertoning: het tekengebied met het blok erop, en de echte regels
    const { g, b, h } = bereidDoek(doek);
    const tg = doc.tekengebied;
    const s = Math.min((b - 8) / tg.b, (h - 8) / tg.h);
    const ox = (b - tg.b * s) / 2;
    const oy = (h - tg.h * s) / 2;
    g.fillStyle = '#ffffff';
    g.fillRect(ox, oy, tg.b * s, tg.h * s);
    if (w.plaats === 'selectie') {
      const k = doelVorm.kader;
      g.strokeStyle = css('--accent', '#5aa2ff');
      g.setLineDash([3, 2]);
      g.strokeRect(ox + k.x * s + 0.5, oy + k.y * s + 0.5, k.b * s, k.h * s);
      g.setLineDash([]);
    }
    g.save();
    g.beginPath();
    g.rect(ox, oy, tg.b * s, tg.h * s);
    g.clip();
    g.fillStyle = '#1a1a1a';
    g.textBaseline = 'alphabetic';
    g.textAlign = { links: 'left', midden: 'center', rechts: 'right' }[w.uitlijning];
    const ax = w.uitlijning === 'links' ? p.x : w.uitlijning === 'midden' ? p.x + p.b / 2 : p.x + p.b;
    for (const blok of zet.blokken) {
      g.font = `${blok.soort === 'kop' ? 700 : 400} ${blok.grootte * s}px Inter, system-ui, sans-serif`;
      blok.regels.forEach((r, i) => {
        if (r) g.fillText(r, ox + ax * s, oy + (p.y + blok.basis + i * blok.regelafstand) * s);
      });
    }
    g.restore();
  }

  function vormen(uitkomst) {
    const { w, zet, plek: p } = uitkomst;
    const zwart = kleur([0, 0, 0, 100], '#1a1a1a', isCmyk);
    const ax = w.uitlijning === 'links' ? p.x : w.uitlijning === 'midden' ? p.x + p.b / 2 : p.x + p.b;
    const basis = { soort: 'tekst', x: ax, uitlijning: w.uitlijning, vulling: zwart, lijn: null };
    let nummer = 0;
    const kinderen = zet.blokken.map((blok) => {
      const naam = blok.soort === 'kop' ? 'Kop' : `Alinea ${++nummer}`;
      const stijl = { grootte: blok.grootte, gewicht: blok.soort === 'kop' ? 700 : 400 };
      if (w.losseRegels) {
        const regels = blok.regels.map((r, i) => (r ? {
          ...basis, ...stijl, naam: `Regel ${i + 1}`, y: p.y + blok.basis + i * blok.regelafstand, inhoud: r,
        } : null)).filter(Boolean);
        return regels.length === 1 ? { ...regels[0], naam } : { soort: 'groep', naam, kinderen: regels };
      }
      return { ...basis, ...stijl, naam, y: p.y + blok.basis, inhoud: blok.regels.join('\n'), regelafstand: blok.regelafstand };
    });
    return [{ soort: 'groep', naam: tekstNaam(w), kinderen }];
  }

  const tekstNaam = (w) => (w.taal === 'lorem' ? 'Blindtekst (lorem ipsum)' : 'Blindtekst');

  formulier.addEventListener('input', teken);
  formulier.addEventListener('change', teken);
  ander.addEventListener('click', () => {
    zaad.value = String((waarden().zaad % 99999) + 1);
    teken();
  });
  formulier.addEventListener('submit', async (gebeurtenis) => {
    gebeurtenis.preventDefault();
    if (doc.alleenLezen) return vexel.melding('Dit document is alleen-lezen; open een kopie om tekst te plaatsen.', 'let');
    const uitkomst = bereken();
    const lijst = vormen(uitkomst);
    hoofd.disabled = true;
    try {
      await vexel.bewaar('instellingen', uitkomst.w);
    } catch (fout) { /* instellingen onthouden is fijn, maar niet nodig */ }
    try {
      await vexel.maak(lijst);
    } catch (fout) {
      hoofd.disabled = false;
      return vexel.melding(fout && fout.message ? fout.message : 'De tekst kon niet worden geplaatst.', 'fout');
    }
    const woorden = uitkomst.tekst.alineas.reduce((s, a) => s + woordenIn(a), 0);
    const teHoog = uitkomst.zet.hoogte > uitkomst.plek.ruimte + 0.5;
    vexel.melding(`Blindtekst geplaatst: ${woorden} woorden${teHoog ? ', maar hij loopt buiten de ruimte' : ''}.`, teHoog ? 'let' : 'ok');
    vexel.sluit();
  });

  teken();
  aantal.focus();
  aantal.select();
}

vexel.opCommando('maken', toonVenster);
