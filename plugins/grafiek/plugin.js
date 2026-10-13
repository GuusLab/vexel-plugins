// Grafiek: staaf-, lijn-, taart- en donutdiagrammen uit getypte of geplakte gegevens.
// Eigen werk, MIT-licentie (zie de README van deze repo).
'use strict';

const VOORBEELD = 'Maand; 2025; 2026\nJan; 12; 15\nFeb; 18; 21\nMrt; 25; 24\nApr; 22; 30\nMei; 30; 34\nJun; 27; 38';

const STANDAARD = {
  gegevens: VOORBEELD, soort: 'staaf', palet: 'helder', breedte: 120, hoogte: 80, letter: 8,
  titel: '', eenheid: '', raster: true, waarden: false, legenda: true,
};

const SOORTEN = [
  ['staaf', 'Staven, verticaal'],
  ['staafH', 'Staven, horizontaal'],
  ['gestapeld', 'Gestapelde staven, verticaal'],
  ['gestapeldH', 'Gestapelde staven, horizontaal'],
  ['lijn', 'Lijndiagram'],
  ['taart', 'Taartdiagram'],
  ['donut', 'Donutdiagram'],
];
const SOORTNAAM = {
  staaf: 'Staafdiagram', staafH: 'Staafdiagram', gestapeld: 'Gestapeld staafdiagram', gestapeldH: 'Gestapeld staafdiagram',
  lijn: 'Lijndiagram', taart: 'Taartdiagram', donut: 'Donutdiagram',
};

// Paletten: elke kleur in CMYK (voor drukwerk) en als hex (voor scherm en RGB-documenten).
const PALETTEN = {
  helder: { naam: 'Helder', kleuren: [
    [[90, 45, 0, 0], '#1f6fd1'], [[0, 55, 95, 0], '#f28a1e'], [[65, 0, 85, 0], '#4fae4a'], [[0, 85, 65, 0], '#e2424a'],
    [[55, 75, 0, 0], '#7b52b3'], [[0, 20, 95, 0], '#f7cb2d'], [[70, 0, 25, 10], '#2a9d9c'], [[0, 60, 10, 0], '#e57aa6']] },
  zacht: { naam: 'Zacht', kleuren: [
    [[45, 15, 0, 0], '#8ab8e6'], [[0, 30, 50, 0], '#f6bd8a'], [[35, 0, 45, 0], '#a9d39a'], [[0, 45, 30, 0], '#f19c94'],
    [[30, 40, 0, 0], '#b7a3d6'], [[0, 10, 55, 0], '#fbe089'], [[40, 0, 15, 5], '#8fcac7'], [[0, 30, 5, 0], '#f3b0cc']] },
  zee: { naam: 'Blauwtinten', kleuren: [
    [[100, 70, 0, 25], '#0b3d7a'], [[90, 45, 0, 0], '#1f6fd1'], [[70, 20, 0, 0], '#3f98dd'], [[45, 8, 0, 0], '#78bce8'],
    [[28, 3, 0, 0], '#a9d5f1'], [[14, 0, 0, 0], '#d4eaf7']] },
  aarde: { naam: 'Aarde', kleuren: [
    [[0, 70, 90, 25], '#a8432a'], [[0, 40, 85, 5], '#e0942e'], [[45, 20, 85, 15], '#879a45'], [[25, 40, 55, 45], '#6f5a45'],
    [[0, 18, 45, 8], '#e8c98d'], [[55, 30, 50, 35], '#5a6a5c']] },
  grijs: { naam: 'Grijstinten', kleuren: [
    [[0, 0, 0, 85], '#333333'], [[0, 0, 0, 68], '#5c5c5c'], [[0, 0, 0, 52], '#868686'], [[0, 0, 0, 38], '#a5a5a5'],
    [[0, 0, 0, 24], '#c3c3c3'], [[0, 0, 0, 12], '#dddddd']] },
};

const MAX_CATEGORIEEN = 200;
const MAX_REEKSEN = 12;

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

const leesGetal = (veld, terugval) => {
  const n = Number(String(veld.value).trim().replace(',', '.'));
  return String(veld.value).trim() !== '' && Number.isFinite(n) ? n : terugval;
};
const begrens = (n, min, max) => Math.min(max, Math.max(min, n));
const css = (naam, terugval) => getComputedStyle(document.documentElement).getPropertyValue(naam).trim() || terugval;
const nl = (n, cijfers = 1) => n.toLocaleString('nl-NL', { maximumFractionDigits: cijfers });

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

function cmykNaarHex([c, m, y, k]) {
  const f = (a) => Math.round(255 * (1 - a / 100) * (1 - k / 100)).toString(16).padStart(2, '0');
  return `#${f(c)}${f(m)}${f(y)}`;
}

// Schermkleur bij een CMYK-kleur, voor de voorvertoning.
const SCHERM = new Map();

/** Maakt kleuren voor dit document: CMYK in een CMYK-document, anders hex.
 *  Neemt een CMYK-lijst (grijzen) of een paletkleur { cmyk, hex }. */
function kleurMaker(isCmyk) {
  return (k) => {
    const cmyk = (Array.isArray(k) ? k : k.cmyk).map((v) => Math.round(v));
    const hex = Array.isArray(k) ? cmykNaarHex(k) : k.hex;
    if (!isCmyk) return { hex };
    SCHERM.set(cmyk.join(), hex);
    return { cmyk };
  };
}

const mengWit = (hex, f) => '#' + [1, 3, 5].map((i) => {
  const v = parseInt(hex.slice(i, i + 2), 16);
  return Math.round(255 - (255 - v) * f).toString(16).padStart(2, '0');
}).join('');

/** De n-de paletkleur; na het palet volgen lichtere tinten van dezelfde kleuren. */
function paletKleur(palet, i) {
  const [cmyk, hex] = palet[i % palet.length];
  const ronde = Math.floor(i / palet.length);
  if (!ronde) return { cmyk, hex };
  const f = Math.max(0.25, 1 - 0.35 * ronde);
  return { cmyk: cmyk.map((v) => v * f), hex: mengWit(hex, f) };
}

/** Licht genoeg voor donkere tekst erop? */
function isLicht(kleur) {
  const hex = kleur.hex;
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62;
}

// ---- tekst meten (Inter, geschat) ---------------------------------------------

const SMAL = new Set([..."iIl.,:;'!|j()[]{}ft"]);
const HALF = new Set([...'rsJ-"/']);
const BREED = new Set([...'mwMW@%']);
const RUIM = new Set([...'ABCDEGHKNOQRUVXY&#']);

function emBreedte(tekst) {
  let som = 0;
  for (const t of tekst) {
    if (t === ' ' || SMAL.has(t)) som += 0.28;
    else if (HALF.has(t)) som += 0.4;
    else if (BREED.has(t)) som += 0.86;
    else if (t >= '0' && t <= '9') som += 0.6;
    else if (RUIM.has(t)) som += 0.68;
    else if (t >= 'A' && t <= 'Z') som += 0.62;
    else som += 0.55;
  }
  return som;
}
const tekstBreedte = (tekst, grootte, gewicht = 400) => emBreedte(tekst) * grootte * (1 + Math.max(0, gewicht - 400) / 300 * 0.06);

/** Kort een tekst in met … tot hij in `breedte` pt past. */
function kortAf(tekst, breedte, grootte, gewicht = 400) {
  if (tekstBreedte(tekst, grootte, gewicht) <= breedte) return tekst;
  let t = tekst;
  while (t.length > 1 && tekstBreedte(t + '…', grootte, gewicht) > breedte) t = t.slice(0, -1);
  return t.trimEnd() + '…';
}

/** Breek een label af in hooguit `max` regels van `breedte` pt (ook na een koppelteken);
 *  de laatste regel wordt zo nodig ingekort. Geeft { regels, ingekort }. */
function labelRegels(tekst, breedte, grootte, max) {
  const stukken = tekst.split(/\s+/).filter(Boolean).flatMap((w) => w.split(/(?<=-)(?=.)/));
  const regels = [];
  let regel = '';
  for (const stuk of stukken) {
    const proef = !regel ? stuk : regel.endsWith('-') ? regel + stuk : `${regel} ${stuk}`;
    if (!regel || tekstBreedte(proef, grootte) <= breedte) regel = proef;
    else { regels.push(regel); regel = stuk; }
  }
  if (regel) regels.push(regel);
  if (regels.length > max) {
    const rest = regels.slice(max - 1).join(' ');
    regels.length = max - 1;
    regels.push(rest);
  }
  const uit = regels.map((r) => kortAf(r, breedte, grootte));
  return { regels: uit, ingekort: uit.some((r, i) => r !== regels[i]) };
}

/** Kies een lettergrootte (f tot 0,75 f) waarbij alle labels zonder inkorten passen. */
function pasLabels(labels, breedte, f) {
  let beste = null;
  for (const g of [f, f * 0.88, f * 0.75]) {
    const uit = labels.map((c) => labelRegels(c, breedte, g, 3));
    beste = { grootte: g, regels: uit.map((u) => u.regels), ingekort: uit.some((u) => u.ingekort) };
    if (!beste.ingekort) break;
  }
  return beste;
}

// ---- gegevens lezen ------------------------------------------------------------

/** Leest een getal als 12, 12,5, 1.250, 1.250,75, 1,250.75, -3 of 45%. Geeft NaN als het geen getal is. */
function leesWaarde(ruw) {
  let s = String(ruw).replace(/[\s€$£%]/g, '').replace(/^\+/, '');
  if (s === '') return { leeg: true };
  if (/^\(.*\)$/.test(s)) s = '-' + s.slice(1, -1);
  const punt = s.lastIndexOf('.'), komma = s.lastIndexOf(',');
  let decimalen = 0;
  if (punt >= 0 && komma >= 0) {
    const dec = punt > komma ? '.' : ',';
    const duizend = dec === '.' ? ',' : '.';
    s = s.split(duizend).join('').replace(dec, '.');
  } else if (komma >= 0) {
    s = /^-?\d{1,3}(,\d{3}){2,}$/.test(s) ? s.split(',').join('') : s.replace(',', '.');
  } else if (punt >= 0 && /^-?\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.split('.').join('');
  }
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(s)) return { getal: NaN };
  const d = s.indexOf('.');
  if (d >= 0) decimalen = s.length - d - 1;
  return { getal: Number(s), decimalen };
}

/** Kiest het scheidingsteken: tab, dan puntkomma, dan komma; anders de laatste spatie. */
function kiesScheiding(regels) {
  if (regels.some((r) => r.includes('\t'))) return '\t';
  if (regels.some((r) => r.includes(';'))) return ';';
  if (regels.some((r) => r.includes('|'))) return '|';
  if (regels.some((r) => r.includes(','))) return ',';
  return null;
}

function splitsRegel(regel, scheiding) {
  if (scheiding) return regel.split(scheiding).map((c) => c.trim());
  const m = regel.match(/^(.*\S)\s+(\S+)$/);
  return m ? [m[1], m[2]] : [regel.trim()];
}

/** Leest de gegevens. Geeft { categorieen, reeksen, decimalen } of { fout }. */
function leesGegevens(tekst) {
  const regels = String(tekst).split(/\r?\n/).map((r) => r.replace(/\s+$/, ''))
    .filter((r) => r.trim() && !r.trim().startsWith('#'))
    .map((r) => (r.startsWith('\t') ? r : r.trim()));
  if (!regels.length) return { fout: 'Typ of plak eerst gegevens: per regel een label en een waarde, zoals “Jan; 12”.' };
  const scheiding = kiesScheiding(regels);
  let rijen = regels.map((r) => splitsRegel(r, scheiding));

  // Een kopregel: alles na de eerste cel is tekst (geen getal).
  let koppen = null;
  const eerste = rijen[0];
  if (eerste.length >= 2 && isKopregel(eerste, rijen.slice(1))) {
    koppen = eerste;
    rijen = rijen.slice(1);
  }
  if (!rijen.length) return { fout: 'Er staat alleen een kopregel. Zet onder de kopregel per regel een label en de waarden.' };
  if (rijen.length > MAX_CATEGORIEEN) return { fout: `Dat zijn ${rijen.length} regels; een grafiek kan er hooguit ${MAX_CATEGORIEEN} aan.` };

  const aantal = Math.max(1, koppen ? koppen.length - 1 : Math.max(...rijen.map((r) => r.length - 1)));
  if (aantal > MAX_REEKSEN) return { fout: `Dat zijn ${aantal} reeksen; gebruik er hooguit ${MAX_REEKSEN}.` };
  const reeksen = Array.from({ length: aantal }, (_, i) => ({
    naam: (koppen && koppen[i + 1]) || (aantal === 1 ? 'Waarde' : `Reeks ${i + 1}`),
    waarden: [],
  }));
  const categorieen = [];
  let decimalen = 0;
  for (let r = 0; r < rijen.length; r++) {
    const cellen = rijen[r];
    const nummer = r + 1 + (koppen ? 1 : 0);
    let label = cellen[0];
    let waardeCellen = cellen.slice(1);
    if (cellen.length === 1) {
      const enkel = leesWaarde(cellen[0]);
      if (enkel.leeg || Number.isNaN(enkel.getal)) {
        return { fout: `Regel ${nummer} (“${kortTekst(cellen[0])}”) heeft geen waarde. Zet er een puntkomma en een getal achter, zoals “Jan; 12”.` };
      }
      label = String(r + 1);
      waardeCellen = [cellen[0]];
    }
    categorieen.push(label);
    for (let i = 0; i < aantal; i++) {
      const cel = waardeCellen[i] === undefined ? '' : waardeCellen[i];
      const w = leesWaarde(cel);
      if (w.leeg) { reeksen[i].waarden.push(0); continue; }
      if (Number.isNaN(w.getal)) {
        return { fout: `Regel ${nummer}: “${kortTekst(cel)}” is geen getal. Schrijf bijvoorbeeld 12, 12,5 of 1.250.` };
      }
      decimalen = Math.max(decimalen, Math.min(2, w.decimalen));
      reeksen[i].waarden.push(w.getal);
    }
  }
  return { categorieen, reeksen, decimalen, kopLabel: koppen ? koppen[0] : '' };
}

/** Is de eerste regel een kopregel? Ja als de waarden tekst zijn, de eerste cel leeg is,
 *  of als het allemaal jaartallen zijn terwijl de regels eronder geen jaartallen zijn. */
function isKopregel(eerste, rest) {
  const waarden = eerste.slice(1);
  if (waarden.every((c) => c !== '' && Number.isNaN(leesWaarde(c).getal))) return true;
  if (!rest.length) return false;
  const jaar = (c) => /^(1[89]|2[01])[0-9]{2}$/.test(c);
  if (eerste[0] === '' && waarden.every((c) => c !== '')) return true;
  if (waarden.every(jaar) && Number.isNaN(leesWaarde(eerste[0]).getal)) {
    return rest.some((r) => r.slice(1).some((c) => c !== '' && !jaar(c)));
  }
  return false;
}

const kortTekst = (t) => (t.length > 24 ? t.slice(0, 23) + '…' : t);

// ---- de schaal --------------------------------------------------------------------

/** Een mooie schaal met stappen van 1, 2, 2,5 of 5 × 10ⁿ die 0 en alle waarden omvat. */
function mooieSchaal(min, max, doel) {
  let lo = Math.min(0, min), hi = Math.max(0, max);
  if (hi - lo < 1e-12) hi = lo + 1;
  const ruw = (hi - lo) / Math.max(1, doel);
  const orde = Math.pow(10, Math.floor(Math.log10(ruw)));
  const n = ruw / orde;
  const stap = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * orde;
  const van = Math.floor(lo / stap + 1e-9) * stap;
  const tot = Math.ceil(hi / stap - 1e-9) * stap;
  const aantal = Math.round((tot - van) / stap);
  const streepjes = [];
  for (let i = 0; i <= aantal; i++) streepjes.push(Number((van + i * stap).toPrecision(12)));
  const decimalen = Math.max(0, Math.min(6, -Math.floor(Math.log10(stap) + 1e-9) + (stap / orde === 2.5 ? 1 : 0)));
  return { van, tot, stap, streepjes, decimalen };
}

// ---- de grafiek bouwen (in pt, linksboven is 0,0) -----------------------------------

function boogPunten(cx, cy, r, a0, a1) {
  const delen = Math.max(1, Math.ceil(Math.abs(a1 - a0) / (Math.PI / 2) - 1e-9));
  const d = (a1 - a0) / delen;
  const k = (4 / 3) * Math.tan(d / 4) * r;
  const punten = [];
  for (let i = 0; i <= delen; i++) {
    const a = a0 + i * d;
    const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
    const tx = -Math.sin(a) * k, ty = Math.cos(a) * k;
    const p = { x, y };
    if (i > 0) p.in = { x: x - tx, y: y - ty };
    if (i < delen) p.uit = { x: x + tx, y: y + ty };
    punten.push(p);
  }
  return punten;
}

/** Een hele cirkel als gesloten reeks van vier punten met handvatten. */
function cirkelPunten(cx, cy, r) {
  const vol = boogPunten(cx, cy, r, -Math.PI / 2, Math.PI * 1.5);
  const punten = vol.slice(0, -1);
  punten[0] = { ...punten[0], in: vol[vol.length - 1].in };
  return punten;
}

const omgekeerd = (punten) => punten.slice().reverse().map((p) => {
  const q = { x: p.x, y: p.y };
  if (p.uit) q.in = p.uit;
  if (p.in) q.uit = p.in;
  return q;
});

function bouwGrafiek(gegevens, w, isCmyk) {
  const K = kleurMaker(isCmyk);
  const palet = (PALETTEN[w.palet] || PALETTEN.helder).kleuren;
  const W = vexel.mm(w.breedte), H = vexel.mm(w.hoogte), f = w.letter;
  const donker = K([0, 0, 0, 85]);
  const zacht = K([0, 0, 0, 60]);
  const as = K([0, 0, 0, 70]);
  const rasterKleur = K([0, 0, 0, 15]);
  const wit = K([0, 0, 0, 0]);
  const { categorieen, reeksen } = gegevens;
  const n = categorieen.length;
  const eenheid = w.eenheid.trim();
  const decimalen = gegevens.decimalen;
  const metEenheid = (t) => (eenheid ? (eenheid === '%' ? `${t}%` : `${t} ${eenheid}`) : t);
  const waardeTekst = (v) => metEenheid(nl(v, decimalen));

  const tekst = (x, y, inhoud, extra = {}) => ({ soort: 'tekst', x, y, inhoud, grootte: f, vulling: donker, lijn: null, ...extra });
  const lijnstuk = (x1, y1, x2, y2, kleur, dikte, naam) => ({
    soort: 'pad', naam, subpaden: [{ gesloten: false, punten: [{ x: x1, y: y1 }, { x: x2, y: y2 }] }],
    vulling: null, lijn: kleur, lijndikte: dikte, lijneinde: 'butt',
  });
  const groep = (naam, kinderen) => (kinderen.length ? [{ soort: 'groep', naam, kinderen }] : []);

  const delen = [];
  let boven = 0;
  if (w.titel.trim()) {
    const ft = f * 1.5;
    delen.push(tekst(0, ft * 0.95, kortAf(w.titel.trim(), W, ft, 700), { grootte: ft, gewicht: 700, naam: 'Titel' }));
    boven = ft * 1.6;
  }
  const isTaart = w.soort === 'taart' || w.soort === 'donut';
  const reeksKleur = (i) => paletKleur(palet, i);

  // -- de legenda (onderaan, of rechts bij een taart als er plek is)
  function legenda(items, x0, y0, breedte, onder) {
    const vak = f * 0.85, tussen = f * 0.45, ruimte = f * 1.4, regelH = f * 1.6;
    const kinderen = [];
    let x = 0, y = 0;
    for (const it of items) {
      const tb = tekstBreedte(it.naam, f);
      const iw = vak + tussen + tb;
      if (onder && x > 0 && x + iw > breedte) { x = 0; y += regelH; }
      const ix = x0 + x, iy = y0 + y;
      const merk = it.lijn
        ? [lijnstuk(ix, iy + regelH / 2 - f * 0.1, ix + vak * 1.4, iy + regelH / 2 - f * 0.1, K(it.kleur), Math.max(1, f * 0.18), 'Lijn')]
        : [{ soort: 'rechthoek', naam: 'Kleur', x: ix, y: iy + (regelH - vak) / 2 - f * 0.1, b: vak, h: vak, vulling: K(it.kleur), lijn: null }];
      const tx = ix + (it.lijn ? vak * 1.4 : vak) + tussen;
      kinderen.push({ soort: 'groep', naam: it.naam.slice(0, 100), kinderen: [...merk, tekst(tx, iy + regelH / 2 + f * 0.26, it.naam, { naam: 'Naam' })] });
      if (onder) x += iw + (it.lijn ? vak * 0.4 : 0) + ruimte;
      else y += regelH;
    }
    return { vormen: groep('Legenda', kinderen), hoogte: y + regelH };
  }
  function legendaHoogte(items, breedte) {
    let x = 0, regels = 1;
    for (const it of items) {
      const iw = f * 0.85 + f * 0.45 + tekstBreedte(it.naam, f) + (it.lijn ? f * 0.75 : 0);
      if (x > 0 && x + iw > breedte) { x = 0; regels++; }
      x += iw + f * 1.4;
    }
    return regels * f * 1.6;
  }

  if (isTaart) return bouwTaart();
  return bouwAssen();

  function bouwTaart() {
    const waarden = reeksen[0].waarden;
    if (waarden.some((v) => v < 0)) return { fout: 'Een taartdiagram kan geen negatieve waarden tonen. Kies staven, of maak de waarden positief.' };
    const totaal = waarden.reduce((a, b) => a + b, 0);
    if (!(totaal > 0)) return { fout: 'Alle waarden zijn 0; dan valt er niets te verdelen.' };
    const items = categorieen.map((c, i) => ({ naam: c, kleur: reeksKleur(i) })).filter((_, i) => waarden[i] > 0);
    const beschikbaarH = H - boven;
    let legendaRechts = false, legW = 0;
    if (w.legenda) {
      legW = Math.max(...items.map((it) => f * 0.85 + f * 0.45 + tekstBreedte(it.naam, f)));
      legendaRechts = W - legW - f * 2 >= beschikbaarH * 0.75 && items.length * f * 1.6 <= beschikbaarH;
    }
    const legH = w.legenda && !legendaRechts ? legendaHoogte(items, W) + f * 0.8 : 0;
    const vlakB = legendaRechts ? W - legW - f * 2 : W;
    const vlakH = beschikbaarH - legH;
    const R = Math.min(vlakB, vlakH) / 2;
    if (!(R > f * 2)) return { fout: 'Daar past de taart niet in: maak de grafiek groter of de letters kleiner.' };
    const opzij = legendaRechts ? (W - (2 * R + f * 2 + legW)) / 2 : 0;
    const cx = legendaRechts ? opzij + R : W / 2, cy = boven + vlakH / 2;
    const r0 = w.soort === 'donut' ? R * 0.58 : 0;
    const stukken = [], labels = [];
    let a = -Math.PI / 2;
    waarden.forEach((v, i) => {
      if (!(v > 0)) return;
      const hoek = (v / totaal) * Math.PI * 2;
      const kleurCmyk = reeksKleur(i);
      const naam = `${categorieen[i]}: ${waardeTekst(v)}`.slice(0, 100);
      let subpaden;
      if (hoek >= Math.PI * 2 - 1e-9) {
        subpaden = [{ gesloten: true, punten: cirkelPunten(cx, cy, R) }];
        if (r0) subpaden.push({ gesloten: true, punten: omgekeerd(cirkelPunten(cx, cy, r0)) });
      } else {
        const buiten = boogPunten(cx, cy, R, a, a + hoek);
        const punten = r0 ? [...buiten, ...omgekeerd(boogPunten(cx, cy, r0, a, a + hoek))] : [{ x: cx, y: cy }, ...buiten];
        subpaden = [{ gesloten: true, punten }];
      }
      stukken.push({ soort: 'pad', naam, subpaden, vulling: K(kleurCmyk), lijn: wit, lijndikte: Math.max(0.5, R / 90), lijnhoek: 'round' });
      if (w.waarden && hoek > 0.32) {
        const m = a + hoek / 2, rl = r0 ? (R + r0) / 2 : R * 0.64;
        const pct = (v / totaal) * 100;
        labels.push(tekst(cx + rl * Math.cos(m), cy + rl * Math.sin(m) + f * 0.34, `${nl(pct, pct < 10 ? 1 : 0)}%`, {
          uitlijning: 'midden', gewicht: 600, vulling: isLicht(kleurCmyk) ? donker : wit, naam: categorieen[i].slice(0, 100),
        }));
      }
      a += hoek;
    });
    if (w.waarden && r0 > f * 2.5) {
      const ft = Math.min(f * 2, r0 * 0.45);
      labels.push(tekst(cx, cy + ft * 0.3, waardeTekst(totaal), { grootte: ft, gewicht: 700, uitlijning: 'midden', naam: 'Totaal' }));
      labels.push(tekst(cx, cy + ft * 0.3 + f * 1.4, 'totaal', { uitlijning: 'midden', vulling: zacht, naam: 'Totaal (label)' }));
    }
    delen.push(...groep('Taartpunten', stukken), ...groep('Waarden', labels));
    if (w.legenda) {
      const leg = legendaRechts
        ? legenda(items, opzij + 2 * R + f * 2, cy - (items.length * f * 1.6) / 2, legW, false)
        : legenda(items, 0, H - legH + f * 0.8, W, true);
      delen.push(...leg.vormen);
    }
    return klaar(`${stukken.length} ${stukken.length === 1 ? 'punt' : 'punten'}`);
  }

  function bouwAssen() {
    const liggend = w.soort === 'staafH' || w.soort === 'gestapeldH';
    const gestapeld = w.soort === 'gestapeld' || w.soort === 'gestapeldH';
    const isLijn = w.soort === 'lijn';
    const k = reeksen.length;
    let ingekort = false;

    // bereik
    let min = Infinity, max = -Infinity;
    for (let c = 0; c < n; c++) {
      if (gestapeld) {
        let pos = 0, neg = 0;
        for (const r of reeksen) { if (r.waarden[c] >= 0) pos += r.waarden[c]; else neg += r.waarden[c]; }
        min = Math.min(min, neg); max = Math.max(max, pos);
      } else {
        for (const r of reeksen) { min = Math.min(min, r.waarden[c]); max = Math.max(max, r.waarden[c]); }
      }
    }
    const items = reeksen.map((r, i) => ({ naam: r.naam, kleur: reeksKleur(i), lijn: isLijn }));
    const toonLegenda = w.legenda && k > 1;
    const legH = toonLegenda ? legendaHoogte(items, W) + f * 0.6 : 0;
    const asLengte = liggend ? W * 0.7 : H - boven - legH;
    const schaal = mooieSchaal(min, max, begrens(Math.round(asLengte / (liggend ? f * 7 : f * 3.6)), 2, 10));
    const schaalTekst = (v) => metEenheid(nl(v, schaal.decimalen));
    const fs = f * 0.9;

    const raster = [], assen = [], schaalLabels = [], catLabels = [], waardeLabels = [], reeksGroepen = reeksen.map(() => []);
    const plotBoven = boven + (!liggend && w.waarden ? f * 1.1 : f * 0.5);

    if (!liggend) {
      const linksB = Math.max(...schaal.streepjes.map((t) => tekstBreedte(schaalTekst(t), fs))) + f * 0.7;
      const x0 = linksB, x1 = W;
      const band = (x1 - x0) / n;
      const pas = pasLabels(categorieen, band * 0.94, f);
      const catRegels = pas.regels, fc = pas.grootte;
      ingekort = pas.ingekort;
      const regelsMax = Math.max(...catRegels.map((r) => r.length));
      const y1 = H - legH - (regelsMax * fc * 1.2 + f * 0.55);
      const y0 = plotBoven;
      if (!(y1 - y0 > f * 3) || !(band > 1)) return { fout: 'Te weinig ruimte voor de grafiek: maak hem groter of de letters kleiner.' };
      const yVan = (v) => y1 - ((v - schaal.van) / (schaal.tot - schaal.van)) * (y1 - y0);
      for (const t of schaal.streepjes) {
        const y = yVan(t);
        if (w.raster && Math.abs(t) > 1e-12) raster.push(lijnstuk(x0, y, x1, y, rasterKleur, 0.35, `Rasterlijn ${nl(t, schaal.decimalen)}`));
        schaalLabels.push(tekst(x0 - f * 0.5, y + fs * 0.36, schaalTekst(t), { grootte: fs, uitlijning: 'rechts', vulling: zacht, naam: schaalTekst(t) }));
      }
      assen.push(lijnstuk(x0, y0 - f * 0.3, x0, y1, as, 0.5, 'Waarde-as'));
      assen.push(lijnstuk(x0, yVan(0), x1, yVan(0), as, 0.6, 'Nullijn'));
      categorieen.forEach((c, i) => {
        catLabels.push(tekst(x0 + band * (i + 0.5), y1 + f * 0.4 + fc * 0.85, catRegels[i].join('\n'), {
          grootte: fc, uitlijning: 'midden', regelafstand: fc * 1.2, naam: c.slice(0, 100),
        }));
      });

      if (isLijn) {
        const xs = categorieen.map((_, i) => x0 + band * (i + 0.5));
        const punten = n <= 60;
        reeksen.forEach((r, j) => {
          const kl = K(reeksKleur(j));
          const pts = r.waarden.map((v, i) => ({ x: xs[i], y: yVan(v) }));
          if (n > 1) {
            reeksGroepen[j].push({
              soort: 'pad', naam: 'Lijn', subpaden: [{ gesloten: false, punten: pts }],
              vulling: null, lijn: kl, lijndikte: Math.max(1, f * 0.19), lijnhoek: 'round', lijneinde: 'round',
            });
          }
          if (punten || n === 1) {
            pts.forEach((p, i) => reeksGroepen[j].push({
              soort: 'ellips', naam: `${categorieen[i]}: ${waardeTekst(r.waarden[i])}`.slice(0, 100),
              cx: p.x, cy: p.y, rx: f * 0.3, ry: f * 0.3, vulling: kl, lijn: wit, lijndikte: 0.75,
            }));
          }
          if (w.waarden) {
            pts.forEach((p, i) => waardeLabels.push(tekst(p.x, p.y - f * 0.6, waardeTekst(r.waarden[i]), { grootte: fs, uitlijning: 'midden', naam: `${r.naam}: ${categorieen[i]}`.slice(0, 100) })));
          }
        });
      } else {
        const groepB = band * (k > 1 && !gestapeld ? 0.78 : 0.62);
        const staafB = gestapeld ? groepB : groepB / k;
        const binnen = gestapeld || k === 1 ? 0 : Math.min(staafB * 0.12, f * 0.25);
        categorieen.forEach((c, i) => {
          const gx = x0 + band * i + (band - groepB) / 2;
          let pos = 0, neg = 0;
          reeksen.forEach((r, j) => {
            const v = r.waarden[i];
            let a, b;
            if (gestapeld) {
              if (v >= 0) { a = pos; b = pos + v; pos = b; } else { a = neg + v; b = neg; neg = a; }
            } else { a = Math.min(0, v); b = Math.max(0, v); }
            const x = gestapeld ? gx : gx + j * staafB + binnen / 2;
            const sb = staafB - binnen;
            const ya = yVan(b), yb = yVan(a);
            const kc = reeksKleur(j);
            if (yb - ya > 0.01) {
              reeksGroepen[j].push({ soort: 'rechthoek', naam: `${c}: ${waardeTekst(v)}`.slice(0, 100), x, y: ya, b: sb, h: yb - ya, vulling: K(kc), lijn: null });
            }
            if (w.waarden) {
              const t = waardeTekst(v);
              if (gestapeld) {
                if (yb - ya > fs * 1.3 && tekstBreedte(t, fs) < sb * 0.95) {
                  waardeLabels.push(tekst(x + sb / 2, (ya + yb) / 2 + fs * 0.36, t, { grootte: fs, uitlijning: 'midden', vulling: isLicht(kc) ? donker : wit, naam: `${r.naam}: ${c}`.slice(0, 100) }));
                }
              } else if (tekstBreedte(t, fs) < staafB * 1.6 || k === 1) {
                const y = v >= 0 ? ya - f * 0.35 : yb + fs * 1.05;
                waardeLabels.push(tekst(x + sb / 2, y, t, { grootte: fs, uitlijning: 'midden', naam: `${r.naam}: ${c}`.slice(0, 100) }));
              }
            }
          });
          if (w.waarden && gestapeld && k > 1) {
            waardeLabels.push(tekst(gx + groepB / 2, yVan(pos) - f * 0.35, waardeTekst(pos + neg), { grootte: fs, gewicht: 600, uitlijning: 'midden', naam: `Totaal ${c}`.slice(0, 100) }));
          }
        });
      }
    } else {
      // liggend: categorieën links, waarden onderaan
      const labelsB = Math.min(W * 0.32, Math.max(...categorieen.map((c) => tekstBreedte(c, f))));
      const x0 = labelsB + f * 0.7;
      let rechts = f * 0.5 + tekstBreedte(schaalTekst(schaal.tot), fs) / 2;
      if (w.waarden) {
        const breedst = Math.max(...categorieen.map((_, i) => tekstBreedte(waardeTekst(gestapeld
          ? reeksen.reduce((s, r) => s + r.waarden[i], 0) : Math.max(...reeksen.map((r) => r.waarden[i]))), fs, gestapeld ? 600 : 400)));
        rechts = Math.max(rechts, breedst + f * 0.6);
      }
      const x1 = W - rechts;
      const y0 = plotBoven;
      const y1 = H - legH - f * 1.7;
      const band = (y1 - y0) / n;
      if (!(x1 - x0 > f * 4) || !(band > 1)) return { fout: 'Te weinig ruimte voor de grafiek: maak hem groter of de letters kleiner.' };
      const xVan = (v) => x0 + ((v - schaal.van) / (schaal.tot - schaal.van)) * (x1 - x0);
      for (const t of schaal.streepjes) {
        const x = xVan(t);
        if (w.raster && Math.abs(t) > 1e-12) raster.push(lijnstuk(x, y0, x, y1, rasterKleur, 0.35, `Rasterlijn ${nl(t, schaal.decimalen)}`));
        schaalLabels.push(tekst(x, y1 + f * 1.3, schaalTekst(t), { grootte: fs, uitlijning: 'midden', vulling: zacht, naam: schaalTekst(t) }));
      }
      assen.push(lijnstuk(x0, y1, x1, y1, as, 0.5, 'Waarde-as'));
      assen.push(lijnstuk(xVan(0), y0, xVan(0), y1, as, 0.6, 'Nullijn'));
      const groepH = band * (k > 1 && !gestapeld ? 0.78 : 0.62);
      const staafH = gestapeld ? groepH : groepH / k;
      const binnen = gestapeld || k === 1 ? 0 : Math.min(staafH * 0.12, f * 0.25);
      categorieen.forEach((c, i) => {
        const gy = y0 + band * i + (band - groepH) / 2;
        const kort = kortAf(c, labelsB, f);
        if (kort !== c) ingekort = true;
        catLabels.push(tekst(x0 - f * 0.6, y0 + band * (i + 0.5) + f * 0.36, kort, { uitlijning: 'rechts', naam: c.slice(0, 100) }));
        let pos = 0, neg = 0;
        reeksen.forEach((r, j) => {
          const v = r.waarden[i];
          let a, b;
          if (gestapeld) {
            if (v >= 0) { a = pos; b = pos + v; pos = b; } else { a = neg + v; b = neg; neg = a; }
          } else { a = Math.min(0, v); b = Math.max(0, v); }
          const y = gestapeld ? gy : gy + j * staafH + binnen / 2;
          const sh = staafH - binnen;
          const xa = xVan(a), xb = xVan(b);
          const kc = reeksKleur(j);
          if (xb - xa > 0.01) {
            reeksGroepen[j].push({ soort: 'rechthoek', naam: `${c}: ${waardeTekst(v)}`.slice(0, 100), x: xa, y, b: xb - xa, h: sh, vulling: K(kc), lijn: null });
          }
          if (w.waarden) {
            const t = waardeTekst(v);
            if (gestapeld) {
              if (xb - xa > tekstBreedte(t, fs) + f * 0.6 && sh > fs * 1.1) {
                waardeLabels.push(tekst((xa + xb) / 2, y + sh / 2 + fs * 0.36, t, { grootte: fs, uitlijning: 'midden', vulling: isLicht(kc) ? donker : wit, naam: `${r.naam}: ${c}`.slice(0, 100) }));
              }
            } else if (sh > fs * 0.8) {
              const x = v >= 0 ? xb + f * 0.4 : xa - f * 0.4;
              waardeLabels.push(tekst(x, y + sh / 2 + fs * 0.36, t, { grootte: fs, uitlijning: v >= 0 ? 'links' : 'rechts', naam: `${r.naam}: ${c}`.slice(0, 100) }));
            }
          }
        });
        if (w.waarden && gestapeld && k > 1) {
          waardeLabels.push(tekst(xVan(pos) + f * 0.4, gy + groepH / 2 + fs * 0.36, waardeTekst(pos + neg), { grootte: fs, gewicht: 600, naam: `Totaal ${c}`.slice(0, 100) }));
        }
      });
    }

    const reeksVormen = k > 1
      ? reeksen.flatMap((r, j) => groep(`Reeks: ${r.naam}`.slice(0, 100), reeksGroepen[j]))
      : reeksGroepen[0];
    delen.push(
      ...groep('Rasterlijnen', raster),
      ...groep(isLijn ? 'Lijnen' : 'Staven', reeksVormen),
      ...groep('Assen', assen),
      ...groep('Schaal', schaalLabels),
      ...groep('Categorieën', catLabels),
      ...groep('Waarden', waardeLabels),
    );
    if (toonLegenda) delen.push(...legenda(items, 0, H - legH + f * 0.6, W, true).vormen);
    const stappen = `schaal ${schaalTekst(schaal.van)} tot ${schaalTekst(schaal.tot)} in stappen van ${nl(schaal.stap, schaal.decimalen)}`;
    return klaar(stappen, ingekort ? 'Labels ingekort: maak de grafiek breder of kies liggende staven.' : '');
  }

  function klaar(extra, waarschuwing = '') {
    const naam = (w.titel.trim() ? `${SOORTNAAM[w.soort]}: ${w.titel.trim()}` : SOORTNAAM[w.soort]).slice(0, 100);
    const vormen = [{ soort: 'groep', naam, kinderen: delen }];
    return { vormen, W, H, extra, waarschuwing, aantal: telVormen(vormen) };
  }
}

function telVormen(vormen) {
  let n = 0, p = 0;
  const loop = (v) => { n++; if (v.kinderen) v.kinderen.forEach(loop); if (v.subpaden) v.subpaden.forEach((s) => { p += s.punten.length; }); };
  vormen.forEach(loop);
  return { vormen: n, punten: p };
}

function verschuif(v, dx, dy) {
  const p = (q) => ({ ...q, x: q.x + dx, y: q.y + dy });
  if (v.soort === 'groep') return { ...v, kinderen: v.kinderen.map((k) => verschuif(k, dx, dy)) };
  if (v.soort === 'ellips') return { ...v, cx: v.cx + dx, cy: v.cy + dy };
  if (v.soort === 'pad') {
    return { ...v, subpaden: v.subpaden.map((s) => ({ ...s, punten: s.punten.map((q) => {
      const r = p(q);
      if (q.in) r.in = p(q.in);
      if (q.uit) r.uit = p(q.uit);
      return r;
    }) })) };
  }
  return { ...v, x: v.x + dx, y: v.y + dy };
}

// ---- voorvertoning ------------------------------------------------------------------

const kleurCss = (k) => (!k ? null : k.hex || SCHERM.get(k.cmyk.join()) || cmykNaarHex(k.cmyk));

function tekenVorm(g, v) {
  if (v.soort === 'groep') { v.kinderen.forEach((k) => tekenVorm(g, k)); return; }
  if (v.soort === 'tekst') {
    g.fillStyle = kleurCss(v.vulling) || '#000';
    g.font = `${v.gewicht || 400} ${v.grootte}px Inter, system-ui, sans-serif`;
    g.textAlign = { midden: 'center', rechts: 'right' }[v.uitlijning] || 'left';
    v.inhoud.split('\n').forEach((r, i) => g.fillText(r, v.x, v.y + i * (v.regelafstand || v.grootte * 1.2)));
    return;
  }
  g.beginPath();
  if (v.soort === 'rechthoek') g.rect(v.x, v.y, v.b, v.h);
  else if (v.soort === 'ellips') g.ellipse(v.cx, v.cy, v.rx, v.ry, 0, 0, Math.PI * 2);
  else {
    for (const s of v.subpaden) {
      const pts = s.punten;
      g.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i <= (s.gesloten ? pts.length : pts.length - 1); i++) {
        const a = pts[i - 1], b = pts[i % pts.length];
        const c1 = a.uit || a, c2 = b.in || b;
        g.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, b.x, b.y);
      }
      if (s.gesloten) g.closePath();
    }
  }
  const vul = kleurCss(v.vulling), lijn = kleurCss(v.lijn);
  if (vul) { g.fillStyle = vul; g.fill(); }
  if (lijn && v.lijndikte) {
    g.strokeStyle = lijn; g.lineWidth = v.lijndikte;
    g.lineJoin = v.lijnhoek === 'round' ? 'round' : 'miter';
    g.lineCap = v.lijneinde === 'round' ? 'round' : 'butt';
    g.stroke();
  }
}

// ---- het venster ----------------------------------------------------------------------

async function toonVenster() {
  const doc = await vexel.document();
  const isCmyk = doc.kleurruimte === 'cmyk';
  const w0 = { ...STANDAARD, ...((await vexel.haal('instellingen')) || {}) };

  const gegevens = maak('textarea', {
    klasse: 'veld', rows: 7, spellcheck: 'false',
    placeholder: 'Per regel een label en een waarde, bijvoorbeeld:\nJan; 12\nFeb; 18\n\n'
      + 'Meer reeksen? Begin met een kopregel: Maand; 2025; 2026',
    stijl: {
      height: '106px', padding: '6px 8px', resize: 'vertical',
      fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '11px', lineHeight: '1.45',
    },
  });
  gegevens.value = w0.gegevens;
  const soort = keuzeVeld(SOORTEN, w0.soort);
  const palet = keuzeVeld(Object.entries(PALETTEN).map(([s, p]) => [s, p.naam]), w0.palet);
  const breedte = getalVeld(w0.breedte, 20, 1000, 1);
  const hoogte = getalVeld(w0.hoogte, 20, 1000, 1);
  const letter = getalVeld(w0.letter, 4, 48, 0.5);
  const titel = maak('input', { klasse: 'veld', type: 'text', value: w0.titel, placeholder: 'Geen titel', maxlength: 80 });
  const eenheid = maak('input', { klasse: 'veld', type: 'text', value: w0.eenheid, placeholder: 'bijv. %', maxlength: 12 });
  const raster = vinkje('Rasterlijnen', w0.raster);
  const waarden = vinkje('Waarden tonen', w0.waarden);
  const legendaV = vinkje('Legenda', w0.legenda);
  const doek = maak('canvas', { 'aria-hidden': 'true', stijl: { width: '100%', height: '180px', display: 'block' } });
  const samenvatting = maak('p', { klasse: 'uitleg', 'aria-live': 'polite', stijl: { margin: '0', minHeight: '32px' } });
  const hoofd = maak('button', { klasse: 'knop primair', type: 'submit', tekst: 'Grafiek maken' });
  const annuleer = maak('button', { klasse: 'knop', type: 'button', tekst: 'Annuleren', bijClick: () => vexel.sluit() });
  const voorbeeldKnop = maak('button', { klasse: 'knop', type: 'button', tekst: 'Voorbeeldgegevens', stijl: { marginRight: 'auto' } });

  const raster3 = (...k) => maak('div', { stijl: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px' } }, ...k);
  gegevens.style.width = '100%';
  const formulier = maak('form', { stijl: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '10px' } },
    maak('label', { stijl: { display: 'grid', gap: '4px' } },
      maak('span', { stijl: { display: 'flex', justifyContent: 'space-between', gap: '8px' } },
        maak('span', { klasse: 'label', tekst: 'Gegevens' }),
        maak('span', { klasse: 'uitleg', tekst: 'label; waarde · tab of komma mag ook' })),
      gegevens),
    maak('div', { stijl: { display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '10px' } },
      metLabel('Soort', soort), metLabel('Kleuren', palet)),
    raster3(metLabel('Breedte', breedte, 'mm'), metLabel('Hoogte', hoogte, 'mm'), metLabel('Letter', letter, 'pt')),
    maak('div', { stijl: { display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' } },
      metLabel('Titel', titel), metLabel('Eenheid', eenheid)),
    maak('div', { stijl: { display: 'flex', gap: '16px', flexWrap: 'wrap' } }, raster.blok, waarden.blok, legendaV.blok),
    maak('div', { stijl: { background: 'var(--bg-2)', border: '1px solid var(--lijn)', borderRadius: '6px', padding: '6px' } }, doek),
    samenvatting,
    maak('div', { klasse: 'knoppen', stijl: { marginTop: '0' } }, voorbeeldKnop, annuleer, hoofd),
  );
  document.body.append(formulier);

  voorbeeldKnop.addEventListener('click', () => {
    gegevens.value = soort.value === 'taart' || soort.value === 'donut'
      ? 'Papier; 42\nInkt; 23\nEnergie; 15\nTransport; 12\nOverig; 8'
      : VOORBEELD;
    bijwerken();
  });

  const instellingen = () => ({
    gegevens: gegevens.value,
    soort: soort.value,
    palet: palet.value,
    breedte: begrens(leesGetal(breedte, 120), 20, 1000),
    hoogte: begrens(leesGetal(hoogte, 80), 20, 1000),
    letter: begrens(leesGetal(letter, 8), 4, 48),
    titel: titel.value,
    eenheid: eenheid.value,
    raster: raster.invoer.checked,
    waarden: waarden.invoer.checked,
    legenda: legendaV.invoer.checked,
  });

  function bereken() {
    const w = instellingen();
    const data = leesGegevens(w.gegevens);
    if (data.fout) return { w, fout: data.fout };
    const uit = bouwGrafiek(data, w, isCmyk);
    if (uit.fout) return { w, fout: uit.fout };
    if (uit.aantal.vormen > 5000 || uit.aantal.punten > 50000) {
      return { w, fout: `Dat worden ${uit.aantal.vormen} vormen; hooguit 5000 kan. Gebruik minder regels of zet de waarden uit.` };
    }
    return { w, data, uit };
  }

  function tekenVoorbeeld(r) {
    const { g, b, h } = bereidDoek(doek);
    if (!r.uit) {
      g.fillStyle = css('--tekst-zacht', '#999');
      g.font = '12px Inter, system-ui, sans-serif';
      g.textAlign = 'center';
      g.fillText('Geen voorbeeld', b / 2, h / 2 + 4);
      return;
    }
    const { W, H } = r.uit;
    const rand = 8;
    const s = Math.min((b - 2 * rand) / W, (h - 2 * rand) / H);
    const ox = (b - W * s) / 2, oy = (h - H * s) / 2;
    const marge = 5;
    g.fillStyle = '#ffffff';
    g.fillRect(ox - marge, oy - marge, W * s + 2 * marge, H * s + 2 * marge);
    g.save();
    g.translate(ox, oy);
    g.scale(s, s);
    r.uit.vormen.forEach((v) => tekenVorm(g, v));
    g.restore();
  }

  function bijwerken() {
    const r = bereken();
    const isTaart = r.w.soort === 'taart' || r.w.soort === 'donut';
    raster.blok.style.opacity = isTaart ? '0.45' : '1';
    raster.invoer.disabled = isTaart;
    if (r.fout) {
      samenvatting.textContent = r.fout;
      samenvatting.className = 'uitleg fout';
    } else {
      const { categorieen, reeksen } = r.data;
      const delen = [`${SOORTNAAM[r.w.soort]} van ${nl(r.w.breedte)} × ${nl(r.w.hoogte)} mm`,
        `${categorieen.length} ${categorieen.length === 1 ? 'categorie' : 'categorieën'}`];
      if (isTaart) {
        if (reeksen.length > 1) delen.push(`alleen de eerste reeks (${reeksen[0].naam})`);
      } else delen.push(`${reeksen.length} ${reeksen.length === 1 ? 'reeks' : 'reeksen'}`);
      samenvatting.textContent = `${delen.join(', ')}; ${r.uit.extra}.${r.uit.waarschuwing ? ' ' + r.uit.waarschuwing : ''}`;
      samenvatting.className = 'uitleg';
    }
    if (doc.alleenLezen) {
      samenvatting.textContent = 'Dit document is alleen-lezen; je kunt hier geen grafiek maken.';
      samenvatting.className = 'uitleg fout';
    }
    hoofd.disabled = Boolean(r.fout) || doc.alleenLezen;
    tekenVoorbeeld(r);
  }

  let gepland = false;
  const plan = () => {
    if (gepland) return;
    gepland = true;
    requestAnimationFrame(() => { gepland = false; bijwerken(); });
  };
  formulier.addEventListener('input', plan);
  formulier.addEventListener('change', plan);
  formulier.addEventListener('submit', async (e) => {
    e.preventDefault();
    const r = bereken();
    if (r.fout) { vexel.melding(r.fout, 'let'); return; }
    if (doc.alleenLezen) { vexel.melding('Dit document is alleen-lezen.', 'let'); return; }
    try {
      const bewaar = r.w.gegevens.length > 30000 ? { ...r.w, gegevens: STANDAARD.gegevens } : r.w;
      await vexel.bewaar('instellingen', bewaar);
    } catch (fout) {
      // Instellingen onthouden is fijn maar niet nodig.
    }
    const dx = (doc.tekengebied.b - r.uit.W) / 2;
    const dy = (doc.tekengebied.h - r.uit.H) / 2;
    hoofd.disabled = true;
    try {
      await vexel.maak(r.uit.vormen.map((v) => verschuif(v, dx, dy)));
      vexel.melding(`${SOORTNAAM[r.w.soort]} gemaakt (${nl(r.w.breedte)} × ${nl(r.w.hoogte)} mm).`, 'ok');
      vexel.sluit();
    } catch (fout) {
      hoofd.disabled = false;
      vexel.melding(fout && fout.message ? fout.message : 'De grafiek kon niet worden gemaakt.', 'fout');
    }
  });

  bijwerken();
  gegevens.focus();
}

vexel.opCommando('maken', toonVenster);
