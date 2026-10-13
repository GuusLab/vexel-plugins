// Tabel: maak een verzorgde tabel uit geplakte tekst (tab, puntkomma of komma).
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

// ---- het venster: vaste opbouw ------------------------------------------------------

/** Knoppenrij met Annuleren en de hoofdknop. Extra knoppen (gewone .knop) mogen ervoor. */
function knoppenRij(hoofdTekst, ...extra) {
  const hoofd = maak('button', { klasse: 'knop primair', type: 'submit', tekst: hoofdTekst });
  const annuleer = maak('button', { klasse: 'knop', type: 'button', tekst: 'Annuleren', bijClick: () => vexel.sluit() });
  const rij = maak('div', { klasse: 'knoppen', stijl: { marginTop: '0' } }, ...extra, annuleer, hoofd);
  return { rij, hoofd };
}

// ---- instellingen ---------------------------------------------------------------

const VOORBEELD = [
  'Product\tAantal\tPrijs\tTotaal',
  'Visitekaartjes\t500\t€ 39,95\t€ 39,95',
  'Folder A5, 4/4\t2.500\t€ 0,12\t€ 300,00',
  'Poster A2\t25\t€ 8,50\t€ 212,50',
  'Briefpapier\t1.000\t€ 0,09\t€ 90,00',
].join('\n');

const STANDAARD = {
  gegevens: VOORBEELD, scheiding: 'auto', kop: true, zebra: true, breedte: 0, grootte: 9, marge: 2,
  kolombreedte: 'tekst', randen: 'horizontaal', kleur: 'antraciet', uitlijning: [],
};

const KLEUREN = {
  antraciet: { naam: 'Antraciet', cmyk: [0, 0, 0, 85], hex: '#3b3b3b' },
  blauw: { naam: 'Blauw', cmyk: [100, 60, 0, 10], hex: '#1f5fa8' },
  groen: { naam: 'Groen', cmyk: [80, 10, 70, 10], hex: '#2f8a5c' },
  rood: { naam: 'Rood', cmyk: [0, 85, 80, 5], hex: '#d6402f' },
  geen: { naam: 'Geen (alleen vet)', cmyk: null, hex: null },
};
const ZWART = { cmyk: [0, 0, 0, 100], hex: '#1a1a1a' };
const WIT = { cmyk: [0, 0, 0, 0], hex: '#ffffff' };
const STREEP = { cmyk: [0, 0, 0, 7], hex: '#eeeeee' };
const LIJN = { cmyk: [0, 0, 0, 60], hex: '#777777' };

const MAX_CELLEN = 3000;
const TAB = String.fromCharCode(9);

// ---- inlezen ----------------------------------------------------------------------

/** Kies de scheiding: tab, dan puntkomma, dan komma (zo blijft 12,5 heel). */
function herkenScheiding(regels) {
  if (regels.some((r) => r.includes(TAB))) return TAB;
  if (regels.some((r) => r.includes(';'))) return ';';
  if (regels.some((r) => r.includes(','))) return ',';
  return TAB;
}

/** Splits één regel; tekst tussen dubbele aanhalingstekens blijft heel. */
function splitsRegel(regel, scheiding) {
  const cellen = [];
  let cel = '';
  let binnen = false;
  for (let i = 0; i < regel.length; i++) {
    const t = regel[i];
    if (t === '"') {
      if (binnen && regel[i + 1] === '"') { cel += '"'; i++; } else binnen = !binnen;
    } else if (t === scheiding && !binnen) { cellen.push(cel); cel = ''; } else cel += t;
  }
  cellen.push(cel);
  return cellen.map((c) => c.trim());
}

function leesGegevens(tekst, keuze) {
  const regels = String(tekst).replace(/\r\n?/g, '\n').split('\n').filter((r) => r.trim() !== '');
  if (!regels.length) return { fout: 'Plak of typ eerst de gegevens: één rij per regel, met de cellen gescheiden door een tab, puntkomma of komma.' };
  const scheiding = keuze === 'auto' ? herkenScheiding(regels) : { tab: TAB, puntkomma: ';', komma: ',' }[keuze];
  const rijen = regels.map((r) => splitsRegel(r, scheiding));
  const n = Math.max(...rijen.map((r) => r.length));
  for (const r of rijen) while (r.length < n) r.push('');
  // lege kolommen aan het eind weghalen (bijvoorbeeld door een scheiding aan het eind van elke regel)
  let k = n;
  while (k > 1 && rijen.every((r) => r[k - 1] === '')) k--;
  for (const r of rijen) r.length = k;
  const naam = { [TAB]: 'tab', ';': 'puntkomma', ',': 'komma' }[scheiding];
  return { rijen, kolommen: k, scheiding: naam };
}

/** Is dit een getal (ook 1.234,5 · € 12,50 · 15% · -3)? */
function isGetal(cel) {
  const s = cel.replace(/[€$£%]|EUR/g, '').replace(/\s/g, '').replace('−', '-');
  return /^[-+]?\(?\d[\d.,]*\)?$/.test(s) && /\d/.test(s);
}

/** Uitlijning per kolom: wat de gebruiker koos, en 'auto' wordt rechts bij getallen. */
function bepaalUitlijning(rijen, kolommen, kop, gekozen) {
  const lijf = kop ? rijen.slice(1) : rijen;
  const uit = [];
  for (let k = 0; k < kolommen; k++) {
    const keuze = gekozen[k] || 'auto';
    if (keuze !== 'auto') { uit.push(keuze); continue; }
    const gevuld = lijf.map((r) => r[k]).filter((c) => c !== '');
    uit.push(gevuld.length && gevuld.every(isGetal) ? 'rechts' : 'links');
  }
  return uit;
}

// ---- de opmaak --------------------------------------------------------------------

/** Rekent de hele tabel uit in pt (vanaf 0,0). */
function zetTabel(data, w) {
  const { rijen, kolommen } = data;
  const grootte = w.grootte;
  const marge = vexel.mm(w.marge);
  const breedte = vexel.mm(w.breedte);
  const lh = grootte * 1.25;
  const gewichtVan = (r) => (w.kop && r === 0 ? 700 : 400);

  // natuurlijke breedte (hele cel op één regel) en minimale breedte (langste woord)
  const nat = new Array(kolommen).fill(0);
  const min = new Array(kolommen).fill(0);
  rijen.forEach((rij, r) => rij.forEach((cel, k) => {
    const g = gewichtVan(r);
    nat[k] = Math.max(nat[k], tekstBreedte(cel, grootte, g) + 2 * marge);
    for (const woord of cel.split(/\s+/)) min[k] = Math.max(min[k], tekstBreedte(woord, grootte, g) + 2 * marge);
  }));
  for (let k = 0; k < kolommen; k++) { nat[k] = Math.max(nat[k], 2 * marge + grootte); min[k] = Math.max(min[k], 2 * marge + grootte); }

  let bk;
  let krap = false;
  if (w.kolombreedte === 'gelijk') {
    bk = new Array(kolommen).fill(breedte / kolommen);
    krap = min.some((m) => m > breedte / kolommen + 0.01);
  } else {
    const somNat = nat.reduce((a, b) => a + b, 0);
    const somMin = min.reduce((a, b) => a + b, 0);
    if (somNat <= breedte) bk = nat.map((n) => n + (breedte - somNat) * (n / somNat));
    else if (somMin <= breedte) {
      // Waterpeil: smalle kolommen houden hun hele breedte, alleen de breedste kolommen worden afgebroken.
      const met = (peil) => nat.map((n, k) => Math.min(n, Math.max(min[k], peil)));
      let laag = 0;
      let hoog = Math.max(...nat);
      for (let i = 0; i < 50; i++) {
        const peil = (laag + hoog) / 2;
        if (met(peil).reduce((a, b) => a + b, 0) > breedte) hoog = peil; else laag = peil;
      }
      bk = met(laag);
      const over = breedte - bk.reduce((a, b) => a + b, 0);
      const somBk = bk.reduce((a, b) => a + b, 0);
      bk = bk.map((b) => b + over * (b / somBk));
    } else { bk = min.map((m) => m * (breedte / somMin)); krap = true; }
  }

  const xs = [0];
  for (const b of bk) xs.push(xs[xs.length - 1] + b);
  const regels = rijen.map((rij, r) => rij.map((cel, k) => (cel === '' ? [] : breekCel(cel, Math.max(1, bk[k] - 2 * marge), grootte, gewichtVan(r)))));
  const hoogtes = regels.map((rij) => Math.max(1, ...rij.map((c) => c.length)) * lh + 2 * marge);
  const ys = [0];
  for (const h of hoogtes) ys.push(ys[ys.length - 1] + h);
  return { bk, xs, ys, hoogtes, regels, lh, grootte, marge, breedte, hoogte: ys[ys.length - 1], krap, gewichtVan };
}

/** Zoals breekAf, maar een woord dat niet in de kolom past, wordt per letter afgebroken. */
function breekCel(tekst, breedte, grootte, gewicht) {
  const uit = [];
  for (const regel of breekAf(tekst, breedte, grootte, gewicht)) {
    if (tekstBreedte(regel, grootte, gewicht) <= breedte) { uit.push(regel); continue; }
    let stuk = '';
    for (const t of regel) {
      if (stuk && tekstBreedte(stuk + t, grootte, gewicht) > breedte) { uit.push(stuk); stuk = t.trim(); } else stuk += t;
    }
    if (stuk) uit.push(stuk);
  }
  return uit;
}

/** Eerste basislijn in een cel, zodat het tekstblok verticaal in het midden staat. */
function eersteBasislijn(z, r, aantal) {
  const midden = z.ys[r] + z.hoogtes[r] / 2;
  return midden - ((aantal - 1) * z.lh) / 2 + 0.36 * z.grootte;
}

function tekstX(z, k, uitlijning) {
  if (uitlijning === 'rechts') return z.xs[k + 1] - z.marge;
  if (uitlijning === 'midden') return (z.xs[k] + z.xs[k + 1]) / 2;
  return z.xs[k] + z.marge;
}

/** De vormen voor Vexel: groep "Tabel" met per rij een groep, en de lijnen apart. */
function bouwVormen(data, w, z, uitlijning, cmyk, ox, oy) {
  const kl = (k) => (k && k.cmyk ? (cmyk ? { cmyk: k.cmyk } : { hex: k.hex }) : null);
  const accent = KLEUREN[w.kleur] || KLEUREN.antraciet;
  const kopVlak = w.kop && accent.cmyk;
  const kinderen = [];
  const kopNamen = w.kop ? data.rijen[0] : [];

  data.rijen.forEach((rij, r) => {
    const isKop = w.kop && r === 0;
    const lijfIndex = w.kop ? r - 1 : r;
    const vormen = [];
    if (isKop && kopVlak) {
      vormen.push({ soort: 'rechthoek', naam: 'Kopvlak', x: ox, y: oy + z.ys[r], b: z.breedte, h: z.hoogtes[r], vulling: kl(accent), lijn: null });
    } else if (!isKop && w.zebra && lijfIndex % 2 === 1) {
      vormen.push({ soort: 'rechthoek', naam: 'Streep', x: ox, y: oy + z.ys[r], b: z.breedte, h: z.hoogtes[r], vulling: kl(STREEP), lijn: null });
    }
    rij.forEach((cel, k) => {
      const regels = z.regels[r][k];
      if (!regels.length) return;
      const naam = (isKop ? cel : (kopNamen[k] ? `${kopNamen[k]}: ${cel}` : cel)).slice(0, 100);
      const vorm = {
        soort: 'tekst', naam, x: ox + tekstX(z, k, uitlijning[k]), y: oy + eersteBasislijn(z, r, regels.length),
        inhoud: regels.join('\n').slice(0, 10000), grootte: z.grootte, regelafstand: z.lh,
        vulling: kl(isKop && kopVlak ? WIT : ZWART), lijn: null,
      };
      if (isKop) vorm.gewicht = 700;
      if (uitlijning[k] !== 'links') vorm.uitlijning = uitlijning[k];
      vormen.push(vorm);
    });
    const naam = isKop ? 'Kopregel' : `Rij ${lijfIndex + 1}`;
    if (vormen.length) kinderen.push({ soort: 'groep', naam, kinderen: vormen });
  });

  const lijn = (x1, y1, x2, y2) => ({ gesloten: false, punten: [{ x: ox + x1, y: oy + y1 }, { x: ox + x2, y: oy + y2 }] });
  const pad = (naam, subpaden, dikte) => ({ soort: 'pad', naam, subpaden, vulling: null, lijn: kl(LIJN), lijndikte: dikte, lijneinde: 'butt' });
  const b = z.breedte;
  const h = z.hoogte;
  const lijnen = [];
  if (w.randen === 'horizontaal') {
    const binnen = [];
    for (let r = 1; r < z.ys.length - 1; r++) if (!(w.kop && r === 1)) binnen.push(lijn(0, z.ys[r], b, z.ys[r]));
    const zwaar = [lijn(0, 0, b, 0), lijn(0, h, b, h)];
    if (w.kop && z.ys.length > 2) zwaar.push(lijn(0, z.ys[1], b, z.ys[1]));
    if (binnen.length) lijnen.push(pad('Rijlijnen', binnen, 0.25));
    lijnen.push(pad('Kop- en eindlijn', zwaar, 0.75));
  } else if (w.randen === 'raster') {
    const binnen = [];
    for (let r = 1; r < z.ys.length - 1; r++) binnen.push(lijn(0, z.ys[r], b, z.ys[r]));
    for (let k = 1; k < z.xs.length - 1; k++) binnen.push(lijn(z.xs[k], 0, z.xs[k], h));
    if (binnen.length) lijnen.push(pad('Rasterlijnen', binnen, 0.25));
    lijnen.push({ soort: 'rechthoek', naam: 'Buitenrand', x: ox, y: oy, b, h, vulling: null, lijn: kl(LIJN), lijndikte: 0.5 });
  }
  if (lijnen.length) kinderen.push({ soort: 'groep', naam: 'Randen', kinderen: lijnen });
  return { soort: 'groep', naam: 'Tabel', kinderen };
}

const telVormen = (v) => 1 + (v.kinderen ? v.kinderen.reduce((a, k) => a + telVormen(k), 0) : 0);

// ---- het venster ------------------------------------------------------------------

async function toonVenster() {
  const doc = await vexel.document();
  const cmyk = doc.kleurruimte === 'cmyk';
  const paginaMm = naarMm(doc.tekengebied.b);
  const standaardBreedte = Math.round(Math.max(20, Math.min(170, paginaMm - 30)));
  let opgeslagen = null;
  try { opgeslagen = await vexel.haal('instellingen'); } catch (e) { opgeslagen = null; }
  const w0 = { ...STANDAARD, ...(opgeslagen || {}) };
  if (!(w0.breedte > 0)) w0.breedte = standaardBreedte;

  const invoer = maak('textarea', {
    klasse: 'veld', rows: 6, spellcheck: 'false', placeholder: 'Plak hier je gegevens: één rij per regel, cellen gescheiden door tab, ; of ,',
    stijl: { height: '96px', padding: '6px 8px', resize: 'vertical', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '11px', lineHeight: '1.45', whiteSpace: 'pre', overflow: 'auto' },
  });
  invoer.value = w0.gegevens;
  const herkend = maak('p', { klasse: 'uitleg', stijl: { margin: '0' } });

  const scheiding = keuzeVeld([['auto', 'Zelf herkennen'], ['tab', 'Tab'], ['puntkomma', 'Puntkomma'], ['komma', 'Komma']], w0.scheiding);
  const kop = vinkje('Eerste regel is kop', w0.kop);
  const zebra = vinkje('Zebrastrepen', w0.zebra);
  const breedte = getalVeld(w0.breedte, 10, 2000, 1);
  const grootte = getalVeld(w0.grootte, 4, 72, 0.5);
  const marge = getalVeld(w0.marge, 0, 20, 0.5);
  const kolombreedte = keuzeVeld([['tekst', 'Op tekstlengte'], ['gelijk', 'Gelijk']], w0.kolombreedte);
  const randen = keuzeVeld([['geen', 'Geen'], ['horizontaal', 'Horizontaal'], ['raster', 'Raster']], w0.randen);
  const kleurVeld = keuzeVeld(Object.entries(KLEUREN).map(([s, k]) => [s, k.naam]), w0.kleur);

  const uitlijnVak = maak('div', { stijl: { display: 'flex', flexWrap: 'wrap', gap: '6px' } });
  let uitlijnVelden = [];
  let gekozenUitlijning = Array.isArray(w0.uitlijning) ? w0.uitlijning.slice(0, 50) : [];

  const doek = maak('canvas', { 'aria-hidden': 'true', stijl: { width: '100%', height: '130px', display: 'block' } });
  const samenvatting = maak('p', { klasse: 'uitleg', 'aria-live': 'polite', stijl: { margin: '0' } });
  const { rij: knoppen, hoofd } = knoppenRij('Tabel maken');

  const sectie = (titel, ...kinderen) => maak('div', { stijl: { display: 'grid', gap: '6px' } }, maak('span', { klasse: 'label', tekst: titel }), ...kinderen);
  const formulier = maak('form', { stijl: { display: 'grid', gap: '10px' } },
    sectie('Gegevens', invoer, herkend),
    kolommen(3, metLabel('Scheiding', scheiding), maak('div', { stijl: { paddingBottom: '5px' } }, kop.blok), maak('div', { stijl: { paddingBottom: '5px' } }, zebra.blok)),
    kolommen(3, metLabel('Totale breedte', breedte, 'mm'), metLabel('Letter', grootte, 'pt'), metLabel('Celmarge', marge, 'mm')),
    kolommen(3, metLabel('Kolombreedte', kolombreedte), metLabel('Randen', randen), metLabel('Kopkleur', kleurVeld)),
    sectie('Uitlijning per kolom', uitlijnVak),
    maak('div', { stijl: { background: 'var(--bg-2)', border: '1px solid var(--lijn)', borderRadius: '6px', padding: '8px' } }, doek),
    samenvatting,
    knoppen,
  );
  document.body.append(formulier);

  const waarden = () => ({
    gegevens: invoer.value,
    scheiding: scheiding.value,
    kop: kop.invoer.checked,
    zebra: zebra.invoer.checked,
    breedte: begrens(leesGetal(breedte, standaardBreedte), 10, 2000),
    grootte: begrens(leesGetal(grootte, 9), 4, 72),
    marge: begrens(leesGetal(marge, 2), 0, 20),
    kolombreedte: kolombreedte.value,
    randen: randen.value,
    kleur: kleurVeld.value,
    uitlijning: gekozenUitlijning,
  });

  /** De keuzelijstjes per kolom, opnieuw als het aantal kolommen of de kop verandert. */
  let uitlijnSleutel = '';
  function bouwUitlijning(data, w) {
    const kopNamen = w.kop ? data.rijen[0] : [];
    const sleutel = `${data.kolommen}|${kopNamen.join('|')}`;
    if (sleutel === uitlijnSleutel) return;
    // andere gegevens: de keuzes per kolom gelden niet meer
    if (uitlijnSleutel && uitlijnSleutel.split('|')[0] !== String(data.kolommen)) gekozenUitlijning = [];
    uitlijnSleutel = sleutel;
    uitlijnVak.replaceChildren();
    uitlijnVelden = [];
    const toon = Math.min(data.kolommen, 12);
    for (let k = 0; k < toon; k++) {
      const veld = keuzeVeld([['auto', 'Auto'], ['links', 'Links'], ['midden', 'Midden'], ['rechts', 'Rechts']], gekozenUitlijning[k] || 'auto');
      veld.style.height = '24px';
      veld.addEventListener('change', () => { gekozenUitlijning[k] = veld.value; });
      const titel = (kopNamen[k] || `Kolom ${k + 1}`).slice(0, 14);
      uitlijnVelden.push(veld);
      uitlijnVak.append(maak('label', { stijl: { display: 'grid', gap: '2px', width: '64px' } },
        maak('span', { klasse: 'uitleg', tekst: titel, title: kopNamen[k] || '', stijl: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }), veld));
    }
    if (data.kolommen > toon) uitlijnVak.append(maak('span', { klasse: 'uitleg', tekst: `Kolom ${toon + 1} en verder: automatisch.`, stijl: { alignSelf: 'end' } }));
  }

  function bereken() {
    const w = waarden();
    const data = leesGegevens(w.gegevens, w.scheiding);
    if (data.fout) return { w, fout: data.fout };
    if (w.kop && data.rijen.length < 2) return { w, data, fout: 'Er is alleen een kopregel. Voeg rijen toe, of zet "Eerste regel is kop" uit.' };
    if (data.rijen.length * data.kolommen > MAX_CELLEN) {
      return { w, data, fout: `Dat zijn ${data.rijen.length * data.kolommen} cellen; hooguit ${MAX_CELLEN} passen in één keer. Verdeel de gegevens over meer tabellen.` };
    }
    const uitlijning = bepaalUitlijning(data.rijen, data.kolommen, w.kop, w.uitlijning);
    const z = zetTabel(data, w);
    return { w, data, z, uitlijning };
  }

  function teken() {
    const u = bereken();
    if (u.data && !u.data.fout) {
      bouwUitlijning(u.data, u.w);
      const rijen = u.data.rijen.length - (u.w.kop ? 1 : 0);
      const herkendTekst = u.w.scheiding === 'auto' ? ' (herkend)' : '';
      const kolomTekst = `${u.data.kolommen} ${u.data.kolommen === 1 ? 'kolom' : 'kolommen'}`;
      herkend.textContent = `Scheiding: ${u.data.scheiding}${herkendTekst} · ${rijen} ${rijen === 1 ? 'rij' : 'rijen'}${u.w.kop ? ' + kop' : ''} · ${kolomTekst}`;
    } else {
      herkend.textContent = '';
      uitlijnVak.replaceChildren(maak('span', { klasse: 'uitleg', tekst: 'Komt zodra er gegevens zijn.' }));
      uitlijnSleutel = '-';
    }

    hoofd.disabled = Boolean(u.fout) || doc.alleenLezen;
    samenvatting.classList.toggle('fout', Boolean(u.fout));
    if (doc.alleenLezen) samenvatting.textContent = 'Dit document is alleen-lezen; je kunt hier geen tabel maken.';
    else if (u.fout) samenvatting.textContent = u.fout;
    else {
      const delen = [`Tabel van ${nl(u.w.breedte)} × ${nl(naarMm(u.z.hoogte))} mm.`];
      if (u.z.krap) delen.push('Let op: sommige woorden zijn breder dan hun kolom; maak de tabel breder of de letter kleiner.');
      else if (u.z.hoogte > doc.tekengebied.h - vexel.mm(30)) delen.push('Let op: de tabel is hoger dan het tekengebied.');
      else if (vexel.mm(u.w.breedte) > doc.tekengebied.b) delen.push('Let op: de tabel is breder dan het tekengebied.');
      samenvatting.textContent = delen.join(' ');
    }

    const { g, b, h } = bereidDoek(doek);
    if (!u.z) {
      g.fillStyle = css('--tekst-zacht', '#999');
      g.font = '11px Inter, system-ui, sans-serif';
      g.textAlign = 'center';
      g.fillText('Geen voorbeeld', b / 2, h / 2 + 4);
      return;
    }
    const z = u.z;
    const s = Math.min((b - 16) / z.breedte, (h - 16) / z.hoogte);
    const ox = (b - z.breedte * s) / 2;
    const oy = Math.max(8, (h - z.hoogte * s) / 2);
    g.fillStyle = '#ffffff';
    g.fillRect(ox - 6, oy - 6, z.breedte * s + 12, Math.min(h - 4, z.hoogte * s + 12));
    g.save();
    g.beginPath();
    g.rect(0, 0, b, h);
    g.clip();
    const vorm = bouwVormen(u.data, u.w, z, u.uitlijning, false, 0, 0);
    const tekenVorm = (v) => {
      if (v.soort === 'groep') return v.kinderen.forEach(tekenVorm);
      if (v.soort === 'rechthoek') {
        if (v.vulling) { g.fillStyle = v.vulling.hex; g.fillRect(ox + v.x * s, oy + v.y * s, v.b * s, v.h * s); }
        if (v.lijn) { g.strokeStyle = v.lijn.hex; g.lineWidth = Math.max(0.6, v.lijndikte * s); g.strokeRect(ox + v.x * s, oy + v.y * s, v.b * s, v.h * s); }
      } else if (v.soort === 'pad') {
        g.strokeStyle = v.lijn.hex;
        g.lineWidth = Math.max(0.5, v.lijndikte * s);
        g.beginPath();
        for (const sp of v.subpaden) { g.moveTo(ox + sp.punten[0].x * s, oy + sp.punten[0].y * s); g.lineTo(ox + sp.punten[1].x * s, oy + sp.punten[1].y * s); }
        g.stroke();
      } else if (v.soort === 'tekst') {
        g.fillStyle = v.vulling.hex;
        g.font = `${v.gewicht || 400} ${v.grootte * s}px Inter, system-ui, sans-serif`;
        g.textAlign = { midden: 'center', rechts: 'right' }[v.uitlijning] || 'left';
        v.inhoud.split('\n').forEach((r, i) => g.fillText(r, ox + v.x * s, oy + (v.y + i * v.regelafstand) * s));
      }
    };
    tekenVorm(vorm);
    g.restore();
  }

  let gepland = false;
  const plan = () => { if (!gepland) { gepland = true; requestAnimationFrame(() => { gepland = false; teken(); }); } };
  formulier.addEventListener('input', plan);
  formulier.addEventListener('change', plan);

  formulier.addEventListener('submit', async (gebeurtenis) => {
    gebeurtenis.preventDefault();
    if (doc.alleenLezen) return vexel.melding('Dit document is alleen-lezen.', 'let');
    const u = bereken();
    if (u.fout) return vexel.melding(u.fout, 'let');
    const ox = Math.max(0, (doc.tekengebied.b - u.z.breedte) / 2);
    const oy = vexel.mm(15);
    const vorm = bouwVormen(u.data, u.w, u.z, u.uitlijning, cmyk, ox, oy);
    if (telVormen(vorm) > 5000) return vexel.melding('Deze tabel heeft te veel onderdelen voor één keer. Verdeel de gegevens over meer tabellen.', 'let');

    try {
      const bewaren = { ...u.w };
      if (bewaren.gegevens.length > 40000) bewaren.gegevens = '';
      await vexel.bewaar('instellingen', bewaren);
    } catch (e) { /* de instellingen onthouden is fijn, maar niet nodig */ }

    hoofd.disabled = true;
    try {
      await vexel.maak([vorm]);
      const rijen = u.data.rijen.length - (u.w.kop ? 1 : 0);
      vexel.melding(`Tabel gemaakt: ${rijen} ${rijen === 1 ? 'rij' : 'rijen'} × ${u.data.kolommen} ${u.data.kolommen === 1 ? 'kolom' : 'kolommen'}.`, 'ok');
      vexel.sluit();
    } catch (fout) {
      hoofd.disabled = false;
      vexel.melding(fout && fout.message ? fout.message : 'De tabel kon niet worden gemaakt.', 'fout');
    }
  });

  teken();
  invoer.focus();
}

vexel.opCommando('maken', toonVenster);
