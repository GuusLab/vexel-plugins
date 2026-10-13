// Tijdlijn: zet momenten (datum; titel; tekst) op een nette lijn, horizontaal of verticaal.
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
  const regel = maak('div', { stijl: { display: 'flex', alignItems: 'center', gap: '6px', minWidth: '0' } }, veld);
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
  '1998; Oprichting; Start in een garagebox met één tweedehands drukpers.',
  '2004; Eigen pand; Verhuizing naar het bedrijventerrein aan de rivier.',
  '2011; Digitaal drukken; Korte oplagen binnen een werkdag geleverd.',
  '2017; Duurzaam papier; Al het papier voortaan met keurmerk.',
  '2024; 25 jaar; Jubileum met klanten, leveranciers en medewerkers.',
].join('\n');

const STANDAARD = {
  tekst: VOORBEELD, richting: 'horizontaal', plaatsing: 'afwisselend', afstand: 'gelijk',
  accent: 'blauw', markering: 'cirkel', grootte: 9, blok: 42, marge: 15, sorteer: true, pijl: false,
};

const ACCENTEN = {
  blauw: { naam: 'Blauw', cmyk: [100, 55, 0, 0], hex: '#0f6bc4' },
  rood: { naam: 'Rood', cmyk: [0, 90, 80, 0], hex: '#e2382f' },
  groen: { naam: 'Groen', cmyk: [80, 0, 75, 5], hex: '#1a9a5c' },
  oranje: { naam: 'Oranje', cmyk: [0, 55, 100, 0], hex: '#f18a00' },
  paars: { naam: 'Paars', cmyk: [65, 90, 0, 0], hex: '#6d3a99' },
  petrol: { naam: 'Petrol', cmyk: [90, 20, 40, 15], hex: '#0f7f86' },
  zwart: { naam: 'Zwart', cmyk: [0, 0, 0, 100], hex: '#1a1a1a' },
};

const MAX_ITEMS = 300;

// ---- invoer lezen -------------------------------------------------------------------

const MAANDEN = [
  ['jan', 'januari', 'january'], ['feb', 'februari', 'february'], ['mrt', 'maart', 'mar', 'march'],
  ['apr', 'april'], ['mei', 'may'], ['jun', 'juni', 'june'], ['jul', 'juli', 'july'],
  ['aug', 'augustus', 'august'], ['sep', 'sept', 'september'], ['okt', 'oktober', 'oct', 'october'],
  ['nov', 'november'], ['dec', 'december'],
];

function maandNummer(woord) {
  const w = woord.toLowerCase().replace(/\.$/, '');
  const i = MAANDEN.findIndex((namen) => namen.includes(w));
  return i < 0 ? 0 : i + 1;
}

/** Een datum of jaar als getal (jaar met fractie), of null als het geen datum is. */
function leesDatum(tekst) {
  const t = tekst.trim();
  const dagJaar = (j, m, d) => j + (m - 1) / 12 + (d - 1) / 372;
  let m = t.match(/^(-?\d{1,4})$/);
  if (m) return Number(m[1]);
  m = t.match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?$/);
  if (m) return dagJaar(Number(m[1]), Number(m[2]), Number(m[3] || 1));
  m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (m) return dagJaar(Number(m[3]), Number(m[2]), Number(m[1]));
  m = t.match(/^(\d{1,2})[-/.](\d{4})$/);
  if (m) return dagJaar(Number(m[2]), Number(m[1]), 1);
  m = t.match(/^(?:(\d{1,2})\s+)?([a-zA-Z]+)\.?\s+(\d{4})$/);
  if (m && maandNummer(m[2])) return dagJaar(Number(m[3]), maandNummer(m[2]), Number(m[1] || 1));
  return null;
}

/** Regels "datum; titel; tekst" (ook tab of |) naar items. */
function leesItems(invoer) {
  const items = [];
  for (const ruw of String(invoer).split(/\r?\n/)) {
    const regel = ruw.trim();
    if (!regel) continue;
    const delen = regel.split(/\s*[;\t|]\s*/).map((d) => d.trim());
    if (delen.length === 1) items.push({ datum: '', titel: delen[0], tekst: '' });
    else items.push({ datum: delen[0], titel: delen[1] || '', tekst: delen.slice(2).filter(Boolean).join('; ') });
  }
  return items.filter((it) => it.datum || it.titel || it.tekst).map((it, i) => ({ ...it, nr: i, waarde: leesDatum(it.datum) }));
}

// ---- de opbouw ---------------------------------------------------------------------------

/** Maten van de tekst: datum, titel en tekst, met de basislijnen vanaf de bovenkant van het blok. */
function blokOpzet(item, breedte, w) {
  const s = w.grootte;
  const maat = { datum: s * 0.95, titel: s * 1.2, tekst: s };
  const delen = [];
  let y = 0;
  if (item.datum) {
    const regels = breekAf(item.datum, breedte, maat.datum, 700);
    const basis = y + maat.datum * 0.75;
    const rh = maat.datum * 1.25;
    delen.push({ soort: 'datum', regels, basis, grootte: maat.datum, rh });
    y = basis + rh * (regels.length - 1) + maat.datum * 0.3;
  }
  if (item.titel) {
    const regels = breekAf(item.titel, breedte, maat.titel, 700);
    const basis = y + maat.titel * (delen.length ? 0.95 : 0.75);
    const rh = maat.titel * 1.2;
    delen.push({ soort: 'titel', regels, basis, grootte: maat.titel, rh });
    y = basis + rh * (regels.length - 1) + maat.titel * 0.3;
  }
  if (item.tekst) {
    const regels = breekAf(item.tekst, breedte, maat.tekst, 400);
    const basis = y + maat.tekst * (delen.length ? 1.05 : 0.75);
    const rh = maat.tekst * 1.38;
    delen.push({ soort: 'tekst', regels, basis, grootte: maat.tekst, rh });
    y = basis + rh * (regels.length - 1) + maat.tekst * 0.3;
  }
  return { delen, hoogte: y, kopHoogte: delen.length ? delen[0].basis - delen[0].grootte * 0.36 : 0 };
}

/** Bouwt de vormen. Geeft { vormen, waarschuwingen, samenvatting } of { fout }. */
function bouwTijdlijn(doc, w, kleuren) {
  let items = leesItems(w.tekst);
  if (!items.length) return { fout: 'Typ een of meer regels, bijvoorbeeld: 1998; Oprichting; Start van het bedrijf.' };
  if (items.length > MAX_ITEMS) return { fout: `Dat zijn ${items.length} regels; een tijdlijn kan er hooguit ${MAX_ITEMS} hebben.` };
  const waarschuwingen = [];
  const allemaalDatum = items.every((it) => it.waarde !== null);
  if (w.sorteer && allemaalDatum) items = [...items].sort((a, b) => a.waarde - b.waarde || a.nr - b.nr);
  let naarTijd = w.afstand === 'tijd';
  if (naarTijd && !allemaalDatum) {
    const fout = items.find((it) => it.waarde === null);
    waarschuwingen.push(`"${fout.datum || fout.titel}" is geen datum; de afstand is daarom gelijk.`);
    naarTijd = false;
  }
  const min = Math.min(...items.map((it) => it.waarde));
  const max = Math.max(...items.map((it) => it.waarde));
  if (naarTijd && !(max > min)) naarTijd = false;
  if (naarTijd && items.some((it, i) => i && it.waarde < items[i - 1].waarde)) {
    items = [...items].sort((a, b) => a.waarde - b.waarde || a.nr - b.nr);
  }

  const { b: B, h: H } = doc.tekengebied;
  const marge = vexel.mm(w.marge);
  const n = items.length;
  const r = vexel.mm(w.markering === 'punt' ? 1.1 : 1.9);
  const pijl = w.pijl ? vexel.mm(3.2) : 0;
  const afwisselend = w.plaatsing === 'afwisselend';
  const lijnKleur = kleuren.lijn;
  const vormen = [];
  const verdeel = (a, e) => items.map((it, i) => {
    if (n === 1) return (a + e) / 2;
    if (naarTijd) return a + ((it.waarde - min) / (max - min)) * (e - a);
    return a + (i * (e - a)) / (n - 1);
  });
  const naamVan = (it) => [it.datum, it.titel].filter(Boolean).join(' · ').slice(0, 100) || 'Item';
  let samenvatting;
  let kader = null;

  if (w.richting === 'horizontaal') {
    let bb = vexel.mm(w.blok);
    const steel = vexel.mm(6);
    // bij gelijke afstand: versmal de blokken zelf als ze anders zouden overlappen
    if (!naarTijd && n > 1) {
      const stap = afwisselend ? Math.min(2, n - 1) : 1;
      const lengte = B - 2 * marge - pijl;
      const past = (stap * lengte - vexel.mm(2) * (n - 1)) / (n - 1 + stap);
      if (bb > past && past >= vexel.mm(12)) {
        bb = past;
        waarschuwingen.push(`De blokken zijn versmald tot ${nl(naarMm(bb), 0)} mm zodat ze niet overlappen.`);
      }
    }
    const a = marge + bb / 2;
    const e = B - marge - bb / 2 - pijl;
    if (n > 1 && !(e - a > 1)) return { fout: `Blokken van ${nl(w.blok)} mm passen niet naast elkaar: maak ze smaller of de marge kleiner.` };
    if (n === 1 && bb > B - 2 * marge) return { fout: 'Het blok is breder dan het tekengebied: maak het smaller of de marge kleiner.' };
    const xs = verdeel(a, e);
    const kant = (i) => (afwisselend ? (i % 2 ? 'onder' : 'boven') : 'boven');
    const opzet = items.map((it) => blokOpzet(it, bb, w));
    let boven = r, onder = r;
    opzet.forEach((o, i) => {
      if (kant(i) === 'boven') boven = Math.max(boven, steel + o.hoogte);
      else onder = Math.max(onder, steel + o.hoogte);
    });
    const ruimte = H - 2 * marge;
    if (boven + onder > ruimte) waarschuwingen.push('De tekst is hoger dan het tekengebied: kort de teksten in of maak de blokken breder.');
    const ly = marge + (ruimte - boven - onder) / 2 + boven;
    vormen.push(lijnVorm('Lijn', [{ x: marge, y: ly }, { x: B - marge - (pijl ? pijl * 0.6 : 0), y: ly }], lijnKleur, 1.2));
    if (pijl) vormen.push(pijlVorm(B - marge, ly, pijl, 'rechts', lijnKleur));
    let overlap = false;
    items.forEach((it, i) => {
      const x = xs[i];
      const o = opzet[i];
      const isBoven = kant(i) === 'boven';
      const stap = afwisselend ? 2 : 1;
      if (i >= stap && x - xs[i - stap] < bb + vexel.mm(1.5)) overlap = true;
      const blokBoven = isBoven ? ly - steel - o.hoogte : ly + steel;
      const kinderen = [];
      const s1 = isBoven ? ly - r - 1.5 : ly + r + 1.5;
      const s2 = isBoven ? ly - steel + 2 : ly + steel - 2;
      if (Math.abs(s2 - s1) > 1) kinderen.push(lijnVorm('Steel', [{ x, y: s1 }, { x, y: s2 }], lijnKleur, 0.6));
      kinderen.push(...tekstVormen(o, x, blokBoven, 'midden', kleuren));
      kinderen.push(markeringVorm(x, ly, r, w.markering, kleuren));
      vormen.push({ soort: 'groep', naam: naamVan(it), kinderen });
    });
    if (overlap) {
      waarschuwingen.push(`Sommige tekstblokken overlappen: maak ze smaller, ${afwisselend ? '' : 'kies afwisselend, '}gebruik minder momenten of zet de tijdlijn verticaal.`);
    }
    samenvatting = `${n} ${n === 1 ? 'moment' : 'momenten'} op een lijn van ${nl(naarMm(B - 2 * marge), 0)} mm, blokken van ${nl(naarMm(bb), 0)} mm.`;
    const k0 = Math.max(0, ly - boven - vexel.mm(6));
    kader = { x: 0, y: k0, b: B, h: Math.min(H, ly + onder + vexel.mm(6)) - k0 };
  } else {
    const steel = vexel.mm(5);
    const beschikbaar = afwisselend ? (B - 2 * marge) / 2 - steel - r : B - 2 * marge - steel - r;
    if (!(beschikbaar > vexel.mm(10))) return { fout: 'Er is te weinig ruimte naast de lijn: maak de marge kleiner.' };
    const bb = Math.min(vexel.mm(w.blok), beschikbaar);
    if (vexel.mm(w.blok) > beschikbaar + 0.5) waarschuwingen.push(`De blokken zijn ${nl(naarMm(bb), 0)} mm breed: meer past er niet naast de lijn.`);
    const lx = afwisselend ? B / 2 : (B - (r + steel + bb)) / 2 + r;
    const opzet = items.map((it) => blokOpzet(it, bb, w));
    const kop = Math.max(r, ...opzet.map((o) => o.kopHoogte));
    const staart = Math.max(...opzet.map((o) => o.hoogte - o.kopHoogte));
    const a = marge + kop;
    const e = H - marge - Math.max(r, staart) - pijl;
    if (n > 1 && !(e - a > 1)) return { fout: 'De teksten zijn te lang voor de hoogte: kort ze in of kies horizontaal.' };
    const ys = verdeel(a, e);
    const kant = (i) => (afwisselend ? (i % 2 ? 'rechts' : 'links') : 'rechts');
    vormen.push(lijnVorm('Lijn', [{ x: lx, y: marge }, { x: lx, y: H - marge - (pijl ? pijl * 0.6 : 0) }], lijnKleur, 1.2));
    if (pijl) vormen.push(pijlVorm(lx, H - marge, pijl, 'onder', lijnKleur));
    let overlap = false;
    items.forEach((it, i) => {
      const y = ys[i];
      const o = opzet[i];
      const links = kant(i) === 'links';
      const stap = afwisselend ? 2 : 1;
      if (i >= stap && y - ys[i - stap] < opzet[i - stap].hoogte + vexel.mm(1)) overlap = true;
      const kinderen = [];
      const s1 = links ? lx - r - 1.5 : lx + r + 1.5;
      const s2 = links ? lx - steel + 2 : lx + steel - 2;
      kinderen.push(lijnVorm('Steel', [{ x: s1, y }, { x: s2, y }], lijnKleur, 0.6));
      kinderen.push(...tekstVormen(o, links ? lx - steel : lx + steel, y - o.kopHoogte, links ? 'rechts' : 'links', kleuren));
      kinderen.push(markeringVorm(lx, y, r, w.markering, kleuren));
      vormen.push({ soort: 'groep', naam: naamVan(it), kinderen });
    });
    if (overlap) {
      waarschuwingen.push(`Sommige tekstblokken overlappen: kort de teksten in, ${afwisselend ? '' : 'kies afwisselend, '}verklein de letter of zet de tijdlijn horizontaal.`);
    }
    samenvatting = `${n} ${n === 1 ? 'moment' : 'momenten'} op een lijn van ${nl(naarMm(H - 2 * marge), 0)} mm, blokken van ${nl(naarMm(bb), 0)} mm.`;
  }
  return { vormen: [{ soort: 'groep', naam: 'Tijdlijn', kinderen: vormen }], waarschuwingen, samenvatting, kader };
}

function lijnVorm(naam, punten, kleurLijn, dikte) {
  return { soort: 'pad', naam, subpaden: [{ gesloten: false, punten }], vulling: null, lijn: kleurLijn, lijndikte: dikte, lijneinde: 'round' };
}

function pijlVorm(x, y, l, richting, vul) {
  const h = l * 0.55;
  const punten = richting === 'rechts'
    ? [{ x, y }, { x: x - l, y: y - h }, { x: x - l, y: y + h }]
    : [{ x, y }, { x: x + h, y: y - l }, { x: x - h, y: y - l }];
  return { soort: 'pad', naam: 'Pijl', subpaden: [{ gesloten: true, punten }], vulling: vul, lijn: null };
}

function markeringVorm(cx, cy, r, soort, k) {
  const basis = { soort: 'ellips', naam: 'Punt', cx, cy, rx: r, ry: r };
  if (soort === 'ring') return { ...basis, vulling: k.wit, lijn: k.accent, lijndikte: 1.4 };
  if (soort === 'punt') return { ...basis, vulling: k.accent, lijn: null };
  return { ...basis, vulling: k.accent, lijn: k.wit, lijndikte: 1.2 };
}

function tekstVormen(opzet, x, blokBoven, uitlijning, k) {
  const namen = { datum: 'Datum', titel: 'Titel', tekst: 'Tekst' };
  return opzet.delen.map((d) => ({
    soort: 'tekst', naam: namen[d.soort], x, y: blokBoven + d.basis,
    inhoud: d.regels.join('\n').slice(0, 10000), grootte: d.grootte, regelafstand: d.rh, uitlijning,
    gewicht: d.soort === 'tekst' ? 400 : 700,
    letterafstand: d.soort === 'datum' ? 20 : 0,
    vulling: d.soort === 'datum' ? k.accent : d.soort === 'titel' ? k.titel : k.tekst, lijn: null,
  }));
}

// ---- voorvertoning ---------------------------------------------------------------------------

const hexVan = (k) => (!k ? null : k.hex || cmykNaarHex(k.cmyk));

function tekenVormen(g, vormen) {
  for (const v of vormen) {
    if (v.soort === 'groep') { tekenVormen(g, v.kinderen); continue; }
    const vul = hexVan(v.vulling);
    const lijn = hexVan(v.lijn);
    g.lineWidth = v.lijndikte || 1;
    g.lineCap = 'round';
    if (v.soort === 'tekst') {
      g.fillStyle = vul || '#000';
      g.font = `${v.gewicht || 400} ${v.grootte}px Inter, system-ui, sans-serif`;
      g.textAlign = { midden: 'center', rechts: 'right' }[v.uitlijning] || 'left';
      g.textBaseline = 'alphabetic';
      v.inhoud.split('\n').forEach((r, i) => g.fillText(r, v.x, v.y + i * (v.regelafstand || v.grootte * 1.2)));
      continue;
    }
    g.beginPath();
    if (v.soort === 'ellips') g.ellipse(v.cx, v.cy, v.rx, v.ry, 0, 0, Math.PI * 2);
    else for (const sp of v.subpaden) {
      sp.punten.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
      if (sp.gesloten) g.closePath();
    }
    if (vul) { g.fillStyle = vul; g.fill(); }
    if (lijn) { g.strokeStyle = lijn; g.stroke(); }
  }
}

// ---- het venster ---------------------------------------------------------------------------------

async function toonVenster() {
  const doc = await vexel.document();
  const w0 = { ...STANDAARD, ...((await vexel.haal('instellingen')) || {}) };
  const cmyk = doc.kleurruimte === 'cmyk';

  const invoer = maak('textarea', {
    klasse: 'veld', rows: 6, spellcheck: 'false',
    placeholder: 'datum; titel; tekst (een moment per regel)',
    stijl: { height: '92px', padding: '6px 8px', resize: 'vertical', lineHeight: '1.4', fontFamily: 'inherit' },
  });
  invoer.value = w0.tekst;
  const richting = keuzeVeld([['horizontaal', 'Horizontaal'], ['verticaal', 'Verticaal']], w0.richting);
  const plaatsing = keuzeVeld([['afwisselend', 'Afwisselend'], ['een', 'Aan één kant']], w0.plaatsing);
  const afstand = keuzeVeld([['gelijk', 'Gelijk verdeeld'], ['tijd', 'Naar tijd']], w0.afstand);
  const accent = keuzeVeld(Object.entries(ACCENTEN).map(([s, a]) => [s, a.naam]), w0.accent);
  const markering = keuzeVeld([['cirkel', 'Cirkel'], ['ring', 'Ring'], ['punt', 'Punt']], w0.markering);
  const grootte = getalVeld(w0.grootte, 5, 40, 0.5);
  const blok = getalVeld(w0.blok, 10, 400, 1);
  const marge = getalVeld(w0.marge, 0, 200, 1);
  const sorteer = vinkje('Sorteer op datum', w0.sorteer);
  const pijl = vinkje('Pijl aan het eind', w0.pijl);

  const doek = maak('canvas', { 'aria-hidden': 'true', stijl: { width: '100%', height: '170px', display: 'block' } });
  const samenvatting = maak('p', { klasse: 'uitleg', 'aria-live': 'polite', stijl: { margin: '0', minHeight: '32px' } });
  const { rij, hoofd } = knoppenRij('Tijdlijn maken');

  const formulier = maak('form', { stijl: { display: 'grid', gap: '10px', padding: '0' } },
    maak('label', { stijl: { display: 'grid', gap: '4px' } },
      maak('span', { klasse: 'label', tekst: 'Momenten' }), invoer,
      maak('span', { klasse: 'uitleg', tekst: 'Eén per regel: datum of jaar; titel; tekst (de tekst mag je weglaten).' })),
    kolommen(3, metLabel('Richting', richting), metLabel('Tekstblokken', plaatsing), metLabel('Afstand', afstand)),
    kolommen(3, metLabel('Accentkleur', accent), metLabel('Markering', markering), metLabel('Letter', grootte, 'pt')),
    kolommen(3, metLabel('Blokbreedte', blok, 'mm'), metLabel('Marge', marge, 'mm'), maak('span')),
    maak('div', { stijl: { display: 'flex', gap: '18px', flexWrap: 'wrap' } }, sorteer.blok, pijl.blok),
    maak('div', { stijl: { background: 'var(--bg-2)', border: '1px solid var(--lijn)', borderRadius: '6px', padding: '6px' } }, doek),
    samenvatting,
    rij,
  );
  document.body.append(formulier);

  const waarden = () => ({
    tekst: invoer.value.slice(0, 30000),
    richting: richting.value,
    plaatsing: plaatsing.value,
    afstand: afstand.value,
    accent: accent.value,
    markering: markering.value,
    grootte: begrens(leesGetal(grootte, 9), 5, 40),
    blok: begrens(leesGetal(blok, 42), 10, 400),
    marge: begrens(leesGetal(marge, 15), 0, 200),
    sorteer: sorteer.invoer.checked,
    pijl: pijl.invoer.checked,
  });
  const kleurenVoor = (w) => {
    const a = ACCENTEN[w.accent] || ACCENTEN.blauw;
    return {
      accent: kleur(a.cmyk, a.hex, cmyk),
      lijn: kleur([0, 0, 0, 45], '#9a9a9a', cmyk),
      titel: kleur([0, 0, 0, 90], '#262626', cmyk),
      tekst: kleur([0, 0, 0, 70], '#555555', cmyk),
      wit: kleur([0, 0, 0, 0], '#ffffff', cmyk),
    };
  };

  let uitkomst = null;
  function teken() {
    const w = waarden();
    uitkomst = bouwTijdlijn(doc, w, kleurenVoor(w));
    hoofd.disabled = Boolean(uitkomst.fout) || doc.alleenLezen;
    samenvatting.className = 'uitleg';
    if (doc.alleenLezen) samenvatting.textContent = 'Dit document is alleen-lezen: je kunt hier niets toevoegen.';
    else if (uitkomst.fout) { samenvatting.textContent = uitkomst.fout; samenvatting.className = 'uitleg fout'; }
    else samenvatting.textContent = [uitkomst.samenvatting, ...uitkomst.waarschuwingen].join(' ');

    const { g, b, h } = bereidDoek(doek);
    const T = doc.tekengebied;
    // toon het deel van het tekengebied waar de tijdlijn staat (zo blijft de tekst leesbaar)
    const k = uitkomst.kader || { x: 0, y: 0, b: T.b, h: T.h };
    const s = Math.min((b - 8) / k.b, (h - 8) / k.h);
    const ox = (b - k.b * s) / 2 - k.x * s;
    const oy = (h - k.h * s) / 2 - k.y * s;
    g.save();
    g.beginPath();
    g.rect(4, 4, b - 8, h - 8);
    g.clip();
    g.fillStyle = '#ffffff';
    g.fillRect(ox, oy, T.b * s, T.h * s);
    g.strokeStyle = css('--lijn', '#3a3a42');
    g.strokeRect(ox - 0.5, oy - 0.5, T.b * s + 1, T.h * s + 1);
    g.restore();
    if (uitkomst.vormen) {
      g.save();
      g.beginPath();
      g.rect(Math.max(4, ox), Math.max(4, oy), Math.min(b - 8, T.b * s), Math.min(h - 8, T.h * s));
      g.clip();
      g.translate(ox, oy);
      g.scale(s, s);
      tekenVormen(g, uitkomst.vormen);
      g.restore();
    }
  }

  let gepland = false;
  const plan = () => { if (!gepland) { gepland = true; requestAnimationFrame(() => { gepland = false; teken(); }); } };
  formulier.addEventListener('input', plan);
  formulier.addEventListener('change', plan);
  formulier.addEventListener('submit', async (gebeurtenis) => {
    gebeurtenis.preventDefault();
    teken();
    if (doc.alleenLezen) return vexel.melding('Dit document is alleen-lezen.', 'let');
    if (!uitkomst || uitkomst.fout) return vexel.melding(uitkomst ? uitkomst.fout : 'Er is nog niets om te maken.', 'let');
    const w = waarden();
    try { await vexel.bewaar('instellingen', w); } catch (fout) { /* instellingen onthouden is niet nodig om te tekenen */ }
    hoofd.disabled = true;
    try {
      await vexel.maak(uitkomst.vormen);
      const n = uitkomst.vormen[0].kinderen.filter((k) => k.soort === 'groep').length;
      vexel.melding(`Tijdlijn gemaakt met ${n} ${n === 1 ? 'moment' : 'momenten'}.`, 'ok');
      vexel.sluit();
    } catch (fout) {
      hoofd.disabled = false;
      vexel.melding(fout && fout.message ? fout.message : 'De tijdlijn kon niet worden gemaakt.', 'fout');
    }
  });

  teken();
  invoer.focus();
  invoer.setSelectionRange(0, 0);
  invoer.scrollTop = 0;
}

vexel.opCommando('maken', toonVenster);
