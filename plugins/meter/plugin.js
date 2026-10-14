// Meter en voortgang: ringen, halve meters met naald en voortgangsbalken uit een lijst "Label: 72".
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

/** Een tekstvak met label en uitleg eronder. */
function tekstVak(labelTekst, waarde, uitleg, hoogte = 110, plaatshouder = '') {
  const veld = maak('textarea', {
    klasse: 'veld', spellcheck: 'false', placeholder: plaatshouder,
    stijl: { height: `${hoogte}px`, padding: '6px 8px', resize: 'vertical', lineHeight: '1.4', fontFamily: 'inherit', tabSize: '4' },
  });
  veld.value = waarde;
  // Tab in het tekstvak voegt een tab in (voor inspringen), in plaats van naar het volgende veld te gaan.
  veld.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab' || e.shiftKey || !veld.dataset.tab) return;
    e.preventDefault();
    const a = veld.selectionStart, b = veld.selectionEnd;
    veld.value = veld.value.slice(0, a) + '\t' + veld.value.slice(b);
    veld.selectionStart = veld.selectionEnd = a + 1;
    veld.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const blok = maak('label', { stijl: { display: 'grid', gap: '4px' } },
    maak('span', { klasse: 'label', tekst: labelTekst }), veld,
    uitleg ? maak('span', { klasse: 'uitleg', tekst: uitleg }) : null);
  return { blok, veld };
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

/** Knoppenrij met Annuleren en de hoofdknop. Extra knoppen (gewone .knop) mogen ervoor. */
function knoppenRij(hoofdTekst, ...extra) {
  const hoofd = maak('button', { klasse: 'knop primair', type: 'submit', tekst: hoofdTekst });
  const annuleer = maak('button', { klasse: 'knop', type: 'button', tekst: 'Annuleren', bijClick: () => vexel.sluit() });
  const rij = maak('div', { klasse: 'knoppen', stijl: { marginTop: '0' } }, ...extra, annuleer, hoofd);
  return { rij, hoofd };
}

// ---- kleuren ----------------------------------------------------------------

/** Bij een CMYK-kleur de bedoelde schermkleur, voor een eerlijkere voorvertoning. */
const SCHERMKLEUR = new Map();

/** Een kleur: in een CMYK-document CMYK, anders hex. */
function kleur(cmyk, hex, isCmyk) {
  if (!isCmyk) return { hex };
  const c = cmyk.map((v) => Math.round(begrens(v, 0, 100) * 10) / 10);
  SCHERMKLEUR.set(c.join(','), hex);
  return { cmyk: c };
}

/** CMYK naar een hex-benadering, voor de voorvertoning. */
function cmykNaarHex([c, m, y, k]) {
  const f = (a) => Math.round(255 * (1 - a / 100) * (1 - k / 100)).toString(16).padStart(2, '0');
  return `#${f(c)}${f(m)}${f(y)}`;
}
const hexVan = (k) => (!k ? null : k.hex || SCHERMKLEUR.get(k.cmyk.join(',')) || cmykNaarHex(k.cmyk));

function hexNaarRgb(hex) {
  const h = String(hex).replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) || 0);
}
const rgbNaarHex = (rgb) => `#${rgb.map((v) => Math.round(begrens(v, 0, 255)).toString(16).padStart(2, '0')).join('')}`;

/** Meng een kleur met wit: t = 0 is de kleur zelf, t = 1 is wit. */
function lichter(k, t) {
  return {
    naam: k.naam,
    cmyk: k.cmyk.map((v) => v * (1 - t)),
    hex: rgbNaarHex(hexNaarRgb(k.hex).map((v) => v + (255 - v) * t)),
  };
}

/** Kleurreeksen: per niveau of per tak de volgende kleur. */
const PALETTEN = {
  fris: {
    naam: 'Fris',
    kleuren: [
      { cmyk: [90, 45, 0, 0], hex: '#1f6fd1' }, { cmyk: [75, 0, 45, 0], hex: '#14a38b' },
      { cmyk: [0, 50, 95, 0], hex: '#f08a1c' }, { cmyk: [0, 85, 70, 0], hex: '#e2453c' },
      { cmyk: [60, 80, 0, 0], hex: '#7a4bc2' }, { cmyk: [45, 0, 95, 0], hex: '#7fb93a' },
      { cmyk: [0, 70, 5, 0], hex: '#e0559a' }, { cmyk: [80, 10, 10, 0], hex: '#1aa3c8' },
    ],
  },
  zakelijk: {
    naam: 'Zakelijk',
    kleuren: [
      { cmyk: [100, 75, 20, 20], hex: '#1d3d6e' }, { cmyk: [85, 45, 10, 0], hex: '#2f6fae' },
      { cmyk: [60, 20, 5, 0], hex: '#5f9fd0' }, { cmyk: [35, 10, 0, 0], hex: '#9cc4e6' },
      { cmyk: [0, 45, 90, 0], hex: '#ef9a2e' }, { cmyk: [55, 40, 35, 15], hex: '#6f7880' },
      { cmyk: [80, 30, 50, 15], hex: '#2f7a72' }, { cmyk: [20, 15, 10, 0], hex: '#c9ccd3' },
    ],
  },
  aarde: {
    naam: 'Aarde',
    kleuren: [
      { cmyk: [70, 30, 80, 20], hex: '#4f7a3f' }, { cmyk: [10, 50, 85, 10], hex: '#c2783a' },
      { cmyk: [30, 75, 70, 25], hex: '#8f4639' }, { cmyk: [15, 20, 70, 5], hex: '#c9b056' },
      { cmyk: [60, 35, 45, 20], hex: '#5f7670' }, { cmyk: [35, 50, 60, 30], hex: '#86664e' },
      { cmyk: [45, 10, 50, 0], hex: '#93bd8b' }, { cmyk: [5, 30, 45, 0], hex: '#efb88d' },
    ],
  },
  pastel: {
    naam: 'Pastel',
    kleuren: [
      { cmyk: [40, 10, 0, 0], hex: '#93c3ec' }, { cmyk: [35, 0, 30, 0], hex: '#a2d8bd' },
      { cmyk: [0, 25, 45, 0], hex: '#f8c290' }, { cmyk: [0, 40, 25, 0], hex: '#f2a6a8' },
      { cmyk: [25, 35, 0, 0], hex: '#bba7dd' }, { cmyk: [15, 0, 50, 0], hex: '#d6e79a' },
      { cmyk: [0, 35, 0, 0], hex: '#f2b0d2' }, { cmyk: [35, 0, 10, 0], hex: '#9fdbe6' },
    ],
  },
  mono: {
    naam: 'Eén kleur',
    kleuren: [
      { cmyk: [100, 60, 0, 10], hex: '#0f5aa8' }, { cmyk: [80, 45, 0, 5], hex: '#3a78c0' },
      { cmyk: [60, 30, 0, 0], hex: '#6596d4' }, { cmyk: [42, 20, 0, 0], hex: '#93b6e2' },
      { cmyk: [28, 12, 0, 0], hex: '#b8cff0' }, { cmyk: [18, 8, 0, 0], hex: '#d2e1f6' },
    ],
  },
  grijs: {
    naam: 'Grijs',
    kleuren: [
      { cmyk: [0, 0, 0, 85], hex: '#3b3b3b' }, { cmyk: [0, 0, 0, 65], hex: '#6b6b6b' },
      { cmyk: [0, 0, 0, 45], hex: '#9a9a9a' }, { cmyk: [0, 0, 0, 30], hex: '#bdbdbd' },
      { cmyk: [0, 0, 0, 18], hex: '#d6d6d6' },
    ],
  },
};
const paletOpties = () => Object.entries(PALETTEN).map(([s, p]) => [s, p.naam]);
/** Kleur nummer i uit een palet (gaat rond als er meer nodig zijn). */
function paletKleur(sleutel, i) {
  const p = (PALETTEN[sleutel] || PALETTEN.fris).kleuren;
  return p[((i % p.length) + p.length) % p.length];
}
/** Witte of donkere tekst, wat het best leesbaar is op deze achtergrond. */
function tekstOp(k) {
  const [r, g, b] = hexNaarRgb(k.hex);
  const l = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return l < 0.6 ? { cmyk: [0, 0, 0, 0], hex: '#ffffff' } : { cmyk: [0, 0, 0, 90], hex: '#262626' };
}

// ---- tekst meten en afbreken (Inter, geschat, liever iets te breed) -----------------

const SMAL = new Set([..."iIl.,:;'!|j()[]{}ft"]);
const HALF = new Set([...'rsJ1-"/']);
const BREED = new Set([...'mwMW@%']);
const RUIM = new Set([...'ABCDEGHKNOQRUVXY&#0234567890']);

/** Geschatte breedte van een tekst in em (Inter, normaal gewicht). */
function emBreedte(tekst) {
  let som = 0;
  for (const t of String(tekst)) {
    if (t === ' ') som += 0.28;
    else if (SMAL.has(t)) som += 0.3;
    else if (HALF.has(t)) som += 0.42;
    else if (BREED.has(t)) som += 0.88;
    else if (RUIM.has(t)) som += 0.68;
    else if (t >= 'A' && t <= 'Z') som += 0.64;
    else som += 0.57;
  }
  return som;
}

/** Breedte in pt bij een lettergrootte en gewicht (vet is breder). */
const tekstBreedte = (tekst, grootte, gewicht = 400) => emBreedte(tekst) * grootte * (1 + Math.max(0, gewicht - 400) / 300 * 0.07);

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

/** Breek af in zo gelijk mogelijke regels, hooguit `max` stuks, binnen `breedte`. */
function breekNetjes(tekst, breedte, grootte, gewicht = 400) {
  const regels = breekAf(tekst, breedte, grootte, gewicht);
  if (regels.length < 2) return regels;
  // probeer smaller af te breken met hetzelfde aantal regels: dat oogt rustiger
  let beste = regels;
  for (let b = breedte * 0.95; b > breedte * 0.45; b *= 0.95) {
    const r = breekAf(tekst, b, grootte, gewicht);
    if (r.length > regels.length) break;
    beste = r;
  }
  return beste;
}
const langsteRegel = (regels, grootte, gewicht) => Math.max(0, ...regels.map((r) => tekstBreedte(r, grootte, gewicht)));

// ---- geometrie: bogen, afgeronde rechthoeken, paden -------------------------------

const TAU = Math.PI * 2;
const afstand = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const rond = (n) => Math.round(n * 1000) / 1000;

/**
 * Een boog als padpunten met handvatten (ellips met middelpunt cx, cy), van hoek a0 naar a1 (radialen;
 * 0 is rechts, positief is met de klok mee omdat y omlaag gaat). Stukken van hooguit 90 graden.
 */
function boog(cx, cy, rx, ry, a0, a1) {
  const n = Math.max(1, Math.ceil(Math.abs(a1 - a0) / (Math.PI / 2) - 1e-9));
  const stap = (a1 - a0) / n;
  const k = (4 / 3) * Math.tan(stap / 4);
  const punten = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + stap * i, c = Math.cos(a), s = Math.sin(a);
    const p = { x: cx + rx * c, y: cy + ry * s };
    if (i > 0) p.in = { x: p.x + k * rx * s, y: p.y - k * ry * c };
    if (i < n) p.uit = { x: p.x - k * rx * s, y: p.y + k * ry * c };
    punten.push(p);
  }
  return punten;
}

/** Voeg punten achter een lijst; valt het eerste nieuwe punt samen met het laatste, dan worden ze één punt. */
function plak(lijst, nieuw) {
  for (const p of nieuw) {
    const vorige = lijst[lijst.length - 1];
    if (vorige && Math.abs(vorige.x - p.x) < 1e-6 && Math.abs(vorige.y - p.y) < 1e-6) {
      if (p.uit) vorige.uit = p.uit;
      if (p.in && !vorige.in) vorige.in = p.in;
    } else lijst.push({ ...p });
  }
  return lijst;
}

/** Sluit een puntenlijst: valt het laatste punt samen met het eerste, dan gaat het handvat naar het eerste. */
function sluitPunten(lijst) {
  const a = lijst[0], z = lijst[lijst.length - 1];
  if (lijst.length > 2 && Math.abs(a.x - z.x) < 1e-6 && Math.abs(a.y - z.y) < 1e-6) {
    if (z.in) a.in = z.in;
    lijst.pop();
  }
  return lijst;
}

/** Een rechthoek met afgeronde hoeken als subpad. */
function rondeRechthoek(x, y, b, h, r) {
  r = Math.max(0, Math.min(r, b / 2, h / 2));
  if (r < 0.01) return { gesloten: true, punten: [{ x, y }, { x: x + b, y }, { x: x + b, y: y + h }, { x, y: y + h }] };
  const p = [];
  plak(p, boog(x + b - r, y + r, r, r, -Math.PI / 2, 0));
  plak(p, boog(x + b - r, y + h - r, r, r, 0, Math.PI / 2));
  plak(p, boog(x + r, y + h - r, r, r, Math.PI / 2, Math.PI));
  plak(p, boog(x + r, y + r, r, r, Math.PI, Math.PI * 1.5));
  return { gesloten: true, punten: sluitPunten(p) };
}

/** Een cirkel of ellips als subpad (vier bogen). */
const ellipsSubpad = (cx, cy, rx, ry) => ({ gesloten: true, punten: sluitPunten(boog(cx, cy, rx, ry, 0, TAU)) });

/** Afronden van alle getallen in een vorm (kleiner document, nette waarden). */
function rondAf(v) {
  if (Array.isArray(v)) return v.map(rondAf);
  if (v && typeof v === 'object') {
    const u = {};
    for (const [s, w] of Object.entries(v)) u[s] = typeof w === 'number' && s !== 'gewicht' ? rond(w) : rondAf(w);
    return u;
  }
  return v;
}

/** Tel vormen en punten (voor de grenzen van maak). */
function tel(vormen, t = { n: 0, p: 0 }) {
  for (const v of vormen) {
    t.n++;
    if (v.kinderen) tel(v.kinderen, t);
    if (v.subpaden) for (const s of v.subpaden) t.p += s.punten.length;
  }
  return t;
}

/** Het kader om een lijst vormen (tekst geschat). */
function kaderVan(vormen) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const neem = (x, y) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
  const loop = (lijst) => {
    for (const v of lijst) {
      const d = v.lijn ? (v.lijndikte || 1) / 2 : 0;
      if (v.kinderen) loop(v.kinderen);
      else if (v.soort === 'rechthoek') { neem(v.x - d, v.y - d); neem(v.x + v.b + d, v.y + v.h + d); }
      else if (v.soort === 'ellips') { neem(v.cx - v.rx - d, v.cy - v.ry - d); neem(v.cx + v.rx + d, v.cy + v.ry + d); }
      else if (v.soort === 'tekst') {
        const regels = v.inhoud.split('\n');
        const b = langsteRegel(regels, v.grootte, v.gewicht || 400);
        const xa = v.uitlijning === 'midden' ? v.x - b / 2 : v.uitlijning === 'rechts' ? v.x - b : v.x;
        const ra = v.regelafstand || v.grootte * 1.2;
        neem(xa, v.y - v.grootte * 0.8); neem(xa + b, v.y + (regels.length - 1) * ra + v.grootte * 0.25);
      } else if (v.subpaden) {
        for (const s of v.subpaden) for (const p of s.punten) {
          neem(p.x - d, p.y - d); neem(p.x + d, p.y + d);
          if (p.in) neem(p.in.x, p.in.y);
          if (p.uit) neem(p.uit.x, p.uit.y);
        }
      }
    }
  };
  loop(vormen);
  if (!Number.isFinite(x0)) return { x: 0, y: 0, b: 0, h: 0 };
  return { x: x0, y: y0, b: x1 - x0, h: y1 - y0 };
}

/** Schaal (om 0,0) en verschuif een lijst vormen; maten, letters en lijndiktes schalen mee. */
function transformeerVormen(vormen, s, dx, dy) {
  const p = (q) => (q ? { x: q.x * s + dx, y: q.y * s + dy } : undefined);
  return vormen.map((v) => {
    const u = { ...v };
    if (v.kinderen) u.kinderen = transformeerVormen(v.kinderen, s, dx, dy);
    if (typeof v.lijndikte === 'number') u.lijndikte = v.lijndikte * s;
    if (Array.isArray(v.streep)) u.streep = v.streep.map((n) => n * s);
    if (v.soort === 'rechthoek') Object.assign(u, { x: v.x * s + dx, y: v.y * s + dy, b: v.b * s, h: v.h * s });
    if (v.soort === 'ellips') Object.assign(u, { cx: v.cx * s + dx, cy: v.cy * s + dy, rx: v.rx * s, ry: v.ry * s });
    if (v.soort === 'tekst') {
      Object.assign(u, { x: v.x * s + dx, y: v.y * s + dy, grootte: v.grootte * s });
      if (v.regelafstand) u.regelafstand = v.regelafstand * s;
    }
    if (v.subpaden) {
      u.subpaden = v.subpaden.map((sp) => ({
        gesloten: sp.gesloten,
        punten: sp.punten.map((q) => {
          const n = p(q);
          if (q.in) n.in = p(q.in);
          if (q.uit) n.uit = p(q.uit);
          return n;
        }),
      }));
    }
    return u;
  });
}

/**
 * Zet een ontwerp midden op het tekengebied. Past het niet binnen de marge, dan wordt het verkleind.
 * Geeft { vormen, schaal, kader } terug.
 */
function zetOpTekengebied(vormen, doc, margePt) {
  const k = kaderVan(vormen);
  const T = doc.tekengebied;
  const ruimB = Math.max(10, T.b - 2 * margePt), ruimH = Math.max(10, T.h - 2 * margePt);
  const s = Math.min(1, ruimB / Math.max(k.b, 1e-6), ruimH / Math.max(k.h, 1e-6));
  const dx = T.b / 2 - (k.x + k.b / 2) * s, dy = T.h / 2 - (k.y + k.h / 2) * s;
  const nieuw = transformeerVormen(vormen, s, dx, dy);
  return { vormen: nieuw, schaal: s, kader: { x: k.x * s + dx, y: k.y * s + dy, b: k.b * s, h: k.h * s } };
}

// ---- voorvertoning op canvas --------------------------------------------------------

function padOpDoek(g, subpaden) {
  for (const sp of subpaden) {
    const n = sp.punten.length;
    sp.punten.forEach((p, i) => {
      if (i === 0) { g.moveTo(p.x, p.y); return; }
      const a = sp.punten[i - 1];
      if (a.uit || p.in) { const c1 = a.uit || a, c2 = p.in || p; g.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, p.x, p.y); } else g.lineTo(p.x, p.y);
    });
    if (sp.gesloten && n > 1) {
      const a = sp.punten[n - 1], p = sp.punten[0];
      if (a.uit || p.in) { const c1 = a.uit || a, c2 = p.in || p; g.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, p.x, p.y); }
      g.closePath();
    }
  }
}

function tekenVormen(g, vormen) {
  for (const v of vormen) {
    if (v.zichtbaar === false) continue;
    if (v.soort === 'groep') { tekenVormen(g, v.kinderen); continue; }
    const vul = hexVan(v.vulling);
    const lijn = hexVan(v.lijn);
    g.save();
    g.globalAlpha = v.dekking === undefined ? 1 : v.dekking;
    g.lineWidth = v.lijndikte || 1;
    g.lineCap = v.lijneinde || 'butt';
    g.lineJoin = v.lijnhoek || 'miter';
    g.setLineDash(v.streep || []);
    if (v.soort === 'tekst') {
      g.fillStyle = vul || '#000';
      g.font = `${v.gewicht || 400} ${v.grootte}px Inter, system-ui, sans-serif`;
      g.textAlign = { midden: 'center', rechts: 'right' }[v.uitlijning] || 'left';
      g.textBaseline = 'alphabetic';
      if (v.draai) { g.translate(v.x, v.y); g.rotate(v.draai * Math.PI / 180); g.translate(-v.x, -v.y); }
      v.inhoud.split('\n').forEach((r, i) => g.fillText(r, v.x, v.y + i * (v.regelafstand || v.grootte * 1.2)));
      g.restore();
      continue;
    }
    g.beginPath();
    if (v.soort === 'ellips') g.ellipse(v.cx, v.cy, v.rx, v.ry, 0, 0, TAU);
    else if (v.soort === 'rechthoek') g.rect(v.x, v.y, v.b, v.h);
    else padOpDoek(g, v.subpaden);
    if (vul) { g.fillStyle = vul; g.fill(v.vulregel === 'evenodd' ? 'evenodd' : 'nonzero'); }
    if (lijn && v.lijndikte !== 0) { g.strokeStyle = lijn; g.stroke(); }
    g.restore();
  }
}

/** Teken de vormen op het canvas, ingezoomd op het kader, met het witte tekengebied eronder. */
function tekenVoorbeeld(doek, doc, vormen, kader) {
  const { g, b, h } = bereidDoek(doek);
  const T = doc.tekengebied;
  const k0 = kader || { x: 0, y: 0, b: T.b, h: T.h };
  const rand = Math.max(k0.b, k0.h) * 0.04 + 4;
  const k = { x: k0.x - rand, y: k0.y - rand, b: k0.b + 2 * rand, h: k0.h + 2 * rand };
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
  if (vormen) {
    g.translate(ox, oy);
    g.scale(s, s);
    tekenVormen(g, vormen);
  }
  g.restore();
}

// ---- het venster: vaste opbouw ------------------------------------------------------

/**
 * Bouwt het venster. opzet: { standaard, velden(w0, doc) → { blokken, waarden, focus }, bouw(w, doc, cmyk) →
 * { vormen, fout, samenvatting, waarschuwingen }, knop, melding(uitkomst), marge(w) in mm, voorbeeldHoogte }.
 */
async function startVenster(opzet) {
  const doc = await vexel.document();
  const cmyk = doc.kleurruimte === 'cmyk';
  let bewaard = null;
  try { bewaard = await vexel.haal('instellingen'); } catch (fout) { bewaard = null; }
  const w0 = { ...opzet.standaard, ...(bewaard && typeof bewaard === 'object' ? bewaard : {}) };
  const ui = await opzet.velden(w0, doc);

  const doek = maak('canvas', { 'aria-hidden': 'true', stijl: { width: '100%', height: `${opzet.voorbeeldHoogte || 190}px`, display: 'block' } });
  const samenvatting = maak('p', { klasse: 'uitleg', 'aria-live': 'polite', stijl: { margin: '0', minHeight: '30px' } });
  const { rij, hoofd } = knoppenRij(opzet.knop, ...(ui.extraKnoppen || []));
  const formulier = maak('form', { stijl: { display: 'grid', gap: '10px', padding: '0' } },
    ...ui.blokken,
    maak('div', { stijl: { background: 'var(--bg-2)', border: '1px solid var(--lijn)', borderRadius: '6px', padding: '6px' } }, doek),
    samenvatting,
    rij);
  document.body.append(formulier);

  let uitkomst = null;
  function teken() {
    const w = ui.waarden();
    try {
      uitkomst = opzet.bouw(w, doc, cmyk);
    } catch (fout) {
      uitkomst = { fout: `Dit lukte niet: ${fout && fout.message ? fout.message : fout}. Probeer andere invoer.` };
    }
    if (uitkomst.vormen && !uitkomst.fout) {
      const t = tel(uitkomst.vormen);
      if (t.n > 5000 || t.p > 50000) uitkomst.fout = `Dit worden te veel vormen (${t.n}) of punten (${t.p}); maak het kleiner.`;
      else {
        const geplaatst = zetOpTekengebied(uitkomst.vormen, doc, vexel.mm(opzet.marge ? opzet.marge(w) : 10));
        uitkomst.vormen = rondAf(geplaatst.vormen);
        uitkomst.kader = geplaatst.kader;
        uitkomst.schaal = geplaatst.schaal;
      }
    }
    hoofd.disabled = Boolean(uitkomst.fout) || doc.alleenLezen;
    samenvatting.className = 'uitleg';
    samenvatting.style.color = '';
    if (doc.alleenLezen) samenvatting.textContent = 'Dit document is alleen-lezen: je kunt hier niets toevoegen.';
    else if (uitkomst.fout) { samenvatting.textContent = uitkomst.fout; samenvatting.style.color = '#ff8a7a'; }
    else {
      const extra = [...(uitkomst.waarschuwingen || [])];
      if (uitkomst.schaal < 0.95) {
        extra.push(`Verkleind tot ${Math.round(uitkomst.schaal * 100)}% om op het tekengebied te passen.`);
        if (uitkomst.kleinsteLetter && uitkomst.kleinsteLetter * uitkomst.schaal < 6) extra.push('De tekst wordt dan erg klein.');
      }
      samenvatting.textContent = [uitkomst.samenvatting, ...extra].filter(Boolean).join(' ');
    }
    tekenVoorbeeld(doek, doc, uitkomst.fout ? null : uitkomst.vormen, uitkomst.fout ? null : uitkomst.kader);
  }

  let gepland = false;
  const plan = () => { if (!gepland) { gepland = true; requestAnimationFrame(() => { gepland = false; teken(); }); } };
  formulier.addEventListener('input', plan);
  formulier.addEventListener('change', plan);
  formulier.addEventListener('submit', async (gebeurtenis) => {
    gebeurtenis.preventDefault();
    teken();
    if (doc.alleenLezen) return vexel.melding('Dit document is alleen-lezen: je kunt hier niets toevoegen.', 'let');
    if (!uitkomst || uitkomst.fout) return vexel.melding(uitkomst ? uitkomst.fout : 'Er is nog niets om te maken.', 'let');
    try { await vexel.bewaar('instellingen', ui.waarden()); } catch (fout) { /* onthouden is niet nodig om te tekenen */ }
    hoofd.disabled = true;
    try {
      await vexel.maak(uitkomst.vormen);
      vexel.melding(opzet.melding(uitkomst), 'ok');
      vexel.sluit();
    } catch (fout) {
      hoofd.disabled = false;
      vexel.melding(fout && fout.message ? fout.message : 'Het kon niet worden gemaakt.', 'fout');
    }
  });
  if (ui.bijStart) ui.bijStart(plan);
  teken();
  if (ui.focus) { ui.focus.focus(); if (ui.focus.setSelectionRange) ui.focus.setSelectionRange(0, 0); ui.focus.scrollTop = 0; }
}

// ---- invoer lezen ----------------------------------------------------------------------

/** Een getal zoals mensen het typen: 72, 72%, 7,5, 1.234,5 of 1 234. Geeft null als het geen getal is. */
function leesWaarde(tekst) {
  let t = String(tekst).replace(/[%€$\s]/g, '').replace(/[a-zA-Z]+$/, '');
  if (!t) return null;
  if (t.includes('.') && t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (t.includes(',')) t = t.replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  const n = Number(t);
  return t !== '' && Number.isFinite(n) ? n : null;
}

/** Regels "Label: 72" (ook ; tab | of =, of "Label: 36/50") naar rijen. */
function leesRijen(invoer) {
  const rijen = [], fout = [];
  String(invoer).split(/\r?\n/).forEach((ruw, nr) => {
    const regel = ruw.trim();
    if (!regel) return;
    const m = regel.match(/^(.*?)[\s]*[:;\t|=][\s]*([^:;\t|=]*)$/);
    let label = '', deel = regel;
    if (m) { label = m[1].trim(); deel = m[2].trim(); }
    const breuk = deel.match(/^(.+?)\s*(?:\/|van)\s*(.+)$/);
    if (breuk) {
      const a = leesWaarde(breuk[1]), b = leesWaarde(breuk[2]);
      if (a === null || b === null || b <= 0) { fout.push(nr + 1); return; }
      rijen.push({ label, waarde: a, max: b, breuk: true });
      return;
    }
    const w = leesWaarde(deel);
    if (w === null) { fout.push(nr + 1); return; }
    rijen.push({ label, waarde: w, procent: /%/.test(deel) });
  });
  return { rijen, fout };
}

// ---- instellingen --------------------------------------------------------------------------

const VOORBEELD = [
  'Klanttevredenheid: 86',
  'Op tijd geleverd: 94',
  'Hergebruikt papier: 72',
  'Groene stroom: 58',
].join('\n');

const STANDAARD = {
  soort: 'ring', tekst: VOORBEELD, palet: 'fris', perRij: true, min: 0, max: 100, eenheid: '%',
  breedte: 45, dikte: 6, grootte: 9, uiteinden: 'rond', spoor: 'tint', kolommen: 'auto', labels: 'boven',
  stappen: 5, zones: false, naald: true,
};

const SOORTEN = [['ring', 'Ringen'], ['meter', 'Halve meters'], ['balk', 'Voortgangsbalken']];
const ZONES = [
  { tot: 0.6, cmyk: [75, 0, 90, 0], hex: '#3fae49' },
  { tot: 0.85, cmyk: [0, 35, 95, 0], hex: '#f5a623' },
  { tot: 1, cmyk: [0, 90, 85, 0], hex: '#e2392f' },
];

// ---- bouwen -------------------------------------------------------------------------------------

function kleurenVoor(w, cmyk, i) {
  const basis = paletKleur(w.palet, w.perRij ? i : 0);
  const spoor = w.spoor === 'grijs' ? { cmyk: [0, 0, 0, 12], hex: '#e3e3e3' } : lichter({ ...basis, naam: '' }, 0.8);
  return {
    accent: kleur(basis.cmyk, basis.hex, cmyk),
    spoor: kleur(spoor.cmyk, spoor.hex, cmyk),
    titel: kleur([0, 0, 0, 90], '#262626', cmyk),
    tekst: kleur([0, 0, 0, 65], '#5a5a5a', cmyk),
    naald: kleur([0, 0, 0, 85], '#333333', cmyk),
    wit: kleur([0, 0, 0, 0], '#ffffff', cmyk),
  };
}

/** Fractie (0..1) en de tekst die bij een rij hoort. */
function meetRij(r, w) {
  const min = r.breuk ? 0 : w.min, max = r.breuk ? r.max : w.max;
  const ruw = (r.waarde - min) / (max - min);
  const fractie = begrens(ruw, 0, 1);
  const tekst = r.breuk ? `${nl(r.waarde, 2)}/${nl(r.max, 2)}` : `${nl(r.waarde, 2)}${w.eenheid}`;
  return { fractie, tekst, buiten: ruw < -1e-9 || ruw > 1 + 1e-9 };
}

/** Een open boog als lijn (voor spoor en voortgang). */
function boogLijn(naam, r, a0, a1, d, k, rondEind) {
  return {
    soort: 'pad', naam, subpaden: [{ gesloten: false, punten: boog(0, 0, r, r, a0, a1) }],
    vulling: null, lijn: k, lijndikte: d, lijneinde: rondEind ? 'round' : 'butt',
  };
}

/** Schuif een vorm (in een lijst) op. */
const schuif = (vormen, dx, dy) => transformeerVormen(vormen, 1, dx, dy);

function bouwRing(r, w, k, maat, getalGrootte) {
  const R = maat / 2, d = Math.min(w.dik, R * 0.6), rm = R - d / 2;
  const { fractie, tekst } = meetRij(r, w);
  const rond = w.uiteinden === 'rond';
  const kinderen = [{ soort: 'ellips', naam: 'Spoor', cx: 0, cy: 0, rx: rm, ry: rm, vulling: null, lijn: k.spoor, lijndikte: d }];
  if (fractie > 0.0005) {
    const a0 = -Math.PI / 2, a1 = a0 + TAU * Math.min(fractie, 0.99999);
    kinderen.push(boogLijn('Voortgang', rm, a0, a1, d, k.accent, rond && fractie < 0.9999));
  }
  kinderen.push({
    soort: 'tekst', naam: 'Waarde', x: 0, y: getalGrootte * 0.36, inhoud: tekst, grootte: getalGrootte,
    gewicht: 700, uitlijning: 'midden', vulling: k.titel, lijn: null,
  });
  return kinderen;
}

function bouwMeter(r, w, k, maat, getalGrootte) {
  const R = maat / 2, d = Math.min(w.dik, R * 0.4), rm = R - d / 2;
  const { fractie, tekst } = meetRij(r, w);
  const rond = w.uiteinden === 'rond';
  const kinderen = [];
  if (w.zones) {
    let van = 0;
    const zones = ZONES.map((z, i) => {
      const a0 = Math.PI + van * Math.PI, a1 = Math.PI + z.tot * Math.PI;
      van = z.tot;
      return boogLijn(['Groen', 'Oranje', 'Rood'][i], rm, a0, a1, d, kleur(z.cmyk, z.hex, w.cmyk), false);
    });
    kinderen.push({ soort: 'groep', naam: 'Kleurzones', kinderen: zones });
  } else {
    kinderen.push(boogLijn('Spoor', rm, Math.PI, TAU, d, k.spoor, rond));
    if (fractie > 0.0005) kinderen.push(boogLijn('Voortgang', rm, Math.PI, Math.PI + fractie * Math.PI, d, k.accent, rond));
  }
  // schaalverdeling: grote streepjes met getallen, kleine ertussen
  const n = Math.round(w.stappen);
  const binnen = R - d - Math.max(2, R * 0.05);
  const groot = Math.max(3, R * 0.1), klein = groot * 0.55;
  const letter = begrens(R * 0.09, 5, 14);
  const streepjes = [], getallen = [];
  const sub = n <= 6 ? 4 : n <= 10 ? 2 : 1;
  for (let i = 0; i <= n * sub; i++) {
    const a = Math.PI + (i / (n * sub)) * Math.PI, c = Math.cos(a), s = Math.sin(a);
    const lang = i % sub === 0 ? groot : klein;
    streepjes.push({ gesloten: false, punten: [{ x: binnen * c, y: binnen * s }, { x: (binnen - lang) * c, y: (binnen - lang) * s }] });
    if (i % sub === 0) {
      const waarde = w.min + (w.max - w.min) * (i / (n * sub));
      const rl = binnen - groot - letter * 1.1;
      getallen.push({
        soort: 'tekst', naam: 'Schaalgetal', x: rl * c, y: rl * s + letter * 0.36, inhoud: nl(waarde, 1), grootte: letter,
        uitlijning: 'midden', vulling: k.tekst, lijn: null,
      });
    }
  }
  if (r.breuk) getallen.length = 0;
  kinderen.push({
    soort: 'groep', naam: 'Schaal', kinderen: [
      { soort: 'pad', naam: 'Streepjes', subpaden: streepjes, vulling: null, lijn: k.tekst, lijndikte: Math.max(0.5, R * 0.012), lijneinde: 'round' },
      ...getallen,
    ],
  });
  // naald: taps, met een rond einde om het draaipunt
  const naaldR = Math.max(1.6, R * 0.05);
  if (w.naald) {
    const a = Math.PI + fractie * Math.PI, c = Math.cos(a), s = Math.sin(a);
    const lengte = binnen - groot * 0.3;
    const pt = { x: lengte * c, y: lengte * s };
    const half = naaldR * 0.9;
    const punten = [pt];
    plak(punten, boog(0, 0, half, half, a + Math.PI / 2, a + Math.PI * 1.5));
    kinderen.push({
      soort: 'groep', naam: 'Naald', kinderen: [
        { soort: 'pad', naam: 'Wijzer', subpaden: [{ gesloten: true, punten }], vulling: k.naald, lijn: null },
        { soort: 'ellips', naam: 'As', cx: 0, cy: 0, rx: naaldR * 1.5, ry: naaldR * 1.5, vulling: k.naald, lijn: null },
        { soort: 'ellips', naam: 'Asdop', cx: 0, cy: 0, rx: naaldR * 0.6, ry: naaldR * 0.6, vulling: k.wit, lijn: null },
      ],
    });
  }
  kinderen.push({
    soort: 'tekst', naam: 'Waarde', x: 0, y: (w.naald ? naaldR * 1.5 + getalGrootte * 0.3 : 0) + getalGrootte * 0.9, inhoud: tekst,
    grootte: getalGrootte, gewicht: 700, uitlijning: 'midden', vulling: k.titel, lijn: null,
  });
  return kinderen;
}

function bouwRingenOfMeters(rijen, w, cmyk, doc) {
  const isRing = w.soort === 'ring';
  const maat = vexel.mm(w.breedte);
  const R = maat / 2;
  // één lettergrootte voor alle getallen, zo groot als in de kleinste ruimte past
  const teksten = rijen.map((r) => meetRij(r, w).tekst);
  const binnenB = isRing ? (R - Math.min(w.dik, R * 0.6)) * 2 * 0.78 : R * 1.5;
  const getalGrootte = Math.max(4, Math.min(isRing ? R * 0.42 : R * 0.3, ...teksten.map((t) => binnenB / Math.max(0.5, emBreedte(t) * 1.07))));
  const n = rijen.length;
  const letter = w.grootte;
  // labels onder het item: afbreken op de breedte van een vak
  const vakB = maat + Math.max(vexel.mm(6), maat * 0.18);
  // automatisch: zoveel naast elkaar als op het tekengebied past, en de rijen zo gelijk mogelijk
  const past = Math.max(1, Math.floor((doc.tekengebied.b - vexel.mm(20)) / vakB));
  let kol = w.kolommen === 'auto' ? Math.min(n, past) : Math.min(n, Number(w.kolommen) || 3);
  if (w.kolommen === 'auto') kol = Math.ceil(n / Math.ceil(n / kol));
  const labelRegels = rijen.map((r) => (r.label ? breekNetjes(r.label, vakB - 4, letter, 600) : []));
  const maxRegels = Math.max(0, ...labelRegels.map((l) => l.length));
  const itemH = isRing ? maat : R + (w.naald ? R * 0.075 + getalGrootte * 0.3 : 0) + getalGrootte * 1.2;
  const labelH = maxRegels ? letter * 0.6 + maxRegels * letter * 1.25 : 0;
  const vakH = itemH + labelH + Math.max(vexel.mm(6), maat * 0.14);
  const items = [];
  rijen.forEach((r, i) => {
    const k = { ...kleurenVoor(w, cmyk, i) };
    const kolom = i % kol, rij = Math.floor(i / kol);
    // laatste rij centreren als hij niet vol is
    const inRij = Math.min(kol, n - rij * kol);
    const cx = (kolom + (kol - inRij) / 2) * vakB + vakB / 2;
    const y0 = rij * vakH;
    const cy = isRing ? y0 + R : y0 + R;
    const kinderen = isRing ? bouwRing(r, w, k, maat, getalGrootte) : bouwMeter(r, { ...w, cmyk }, k, maat, getalGrootte);
    const regels = labelRegels[i];
    if (regels.length) {
      kinderen.push({
        soort: 'tekst', naam: 'Label', x: 0, y: itemH - (isRing ? R : R) + letter * 0.6 + letter * 0.95, inhoud: regels.join('\n'),
        grootte: letter, gewicht: 600, regelafstand: letter * 1.25, uitlijning: 'midden', vulling: k.titel, lijn: null,
      });
    }
    const naam = `${isRing ? 'Ring' : 'Meter'} · ${r.label || meetRij(r, w).tekst}`.slice(0, 100);
    items.push({ soort: 'groep', naam, kinderen: schuif(kinderen, cx, cy) });
  });
  return { items, kleinste: Math.min(letter, getalGrootte) };
}

function bouwBalken(rijen, w, cmyk) {
  const B = vexel.mm(w.breedte), d = w.dik, letter = w.grootte;
  const rond = w.uiteinden === 'rond';
  const teksten = rijen.map((r) => meetRij(r, w).tekst);
  const waardeB = langsteRegel(teksten, letter, 700) * 1.08;
  const links = w.labels === 'links';
  const labelB = links ? Math.min(B * 0.45, langsteRegel(rijen.map((r) => r.label), letter, 400) * 1.08) : 0;
  const gat = letter * 0.8;
  const balkX = links && labelB ? labelB + gat : 0;
  const balkB = links ? Math.max(d * 2, B - balkX - gat - waardeB) : B;
  const items = [];
  let y = 0;
  rijen.forEach((r, i) => {
    const k = kleurenVoor(w, cmyk, i);
    const { fractie, tekst } = meetRij(r, w);
    const kinderen = [];
    let balkY;
    if (links) {
      const rijH = Math.max(d, letter * 1.3);
      balkY = y + (rijH - d) / 2;
      const midden = balkY + d / 2 + letter * 0.36;
      const regels = r.label ? breekAf(r.label, labelB, letter, 400) : [];
      if (regels.length) {
        kinderen.push({
          soort: 'tekst', naam: 'Label', x: labelB, y: midden - (regels.length - 1) * letter * 0.6, inhoud: regels.join('\n'), grootte: letter,
          regelafstand: letter * 1.2, uitlijning: 'rechts', vulling: k.titel, lijn: null,
        });
      }
      kinderen.push({
        soort: 'tekst', naam: 'Waarde', x: balkX + balkB + gat, y: midden, inhoud: tekst, grootte: letter, gewicht: 700,
        vulling: k.titel, lijn: null,
      });
      y += Math.max(rijH, regels.length * letter * 1.2) + Math.max(d * 0.9, letter * 0.9);
    } else {
      const regels = r.label ? breekAf(r.label, Math.max(letter * 4, B - waardeB - gat), letter, 600) : [];
      const basis = y + letter * 0.95;
      if (regels.length) {
        kinderen.push({
          soort: 'tekst', naam: 'Label', x: 0, y: basis, inhoud: regels.join('\n'), grootte: letter, gewicht: 600,
          regelafstand: letter * 1.2, vulling: k.titel, lijn: null,
        });
      }
      kinderen.push({
        soort: 'tekst', naam: 'Waarde', x: B, y: basis + Math.max(0, regels.length - 1) * letter * 1.2, inhoud: tekst, grootte: letter,
        gewicht: 700, uitlijning: 'rechts', vulling: k.accent, lijn: null,
      });
      balkY = basis + Math.max(0, regels.length - 1) * letter * 1.2 + letter * 0.55;
      y = balkY + d + Math.max(letter * 1.1, d);
    }
    const r0 = rond ? d / 2 : 0;
    kinderen.unshift({ soort: 'pad', naam: 'Spoor', subpaden: [rondeRechthoek(balkX, balkY, balkB, d, r0)], vulling: k.spoor, lijn: null });
    if (fractie > 0.0005) {
      const vb = balkB * fractie;
      kinderen.splice(1, 0, { soort: 'pad', naam: 'Voortgang', subpaden: [rondeRechthoek(balkX, balkY, vb, d, r0)], vulling: k.accent, lijn: null });
    }
    items.push({ soort: 'groep', naam: `Balk · ${r.label || tekst}`.slice(0, 100), kinderen });
  });
  return { items, kleinste: letter };
}

function bouw(w, doc, cmyk) {
  const { rijen, fout } = leesRijen(w.tekst);
  if (fout.length) return { fout: `Regel ${fout.slice(0, 3).join(', ')} heeft geen geldig getal. Schrijf bijvoorbeeld "Omzet: 72" of "Taken: 18/24".` };
  if (!rijen.length) return { fout: 'Typ minstens één regel, bijvoorbeeld "Klanttevredenheid: 86".' };
  if (rijen.length > 60) return { fout: `Dat zijn ${rijen.length} regels; hooguit 60 tegelijk.` };
  if (!(w.max > w.min)) return { fout: 'Het maximum moet groter zijn dan het minimum.' };
  const { items, kleinste } = w.soort === 'balk' ? bouwBalken(rijen, w, cmyk) : bouwRingenOfMeters(rijen, w, cmyk, doc);
  const naam = { ring: 'Ringen', meter: 'Meters', balk: 'Voortgangsbalken' }[w.soort];
  const buiten = rijen.filter((r) => meetRij(r, w).buiten).length;
  const waarschuwingen = buiten ? [`${buiten} ${buiten === 1 ? 'waarde valt' : 'waarden vallen'} buiten ${nl(w.min)}–${nl(w.max)} en ${buiten === 1 ? 'staat' : 'staan'} op de rand.`] : [];
  const wat = { ring: ['ring', 'ringen'], meter: ['meter', 'meters'], balk: ['balk', 'balken'] }[w.soort];
  const maat = w.soort === 'balk' ? `${nl(w.breedte)} mm breed` : `${nl(w.breedte)} mm doorsnede`;
  return {
    vormen: [{ soort: 'groep', naam, kinderen: items }],
    samenvatting: `${rijen.length} ${rijen.length === 1 ? wat[0] : wat[1]} van ${maat}, ${nl(w.dikte)} mm dik.`,
    waarschuwingen, kleinsteLetter: kleinste, aantal: rijen.length, wat,
  };
}

// ---- het venster --------------------------------------------------------------------------------

vexel.opCommando('maken', () => startVenster({
  standaard: STANDAARD,
  knop: 'Maken',
  voorbeeldHoogte: 200,
  marge: () => 10,
  melding: (u) => `${u.aantal} ${u.aantal === 1 ? u.wat[0] : u.wat[1]} gemaakt.`,
  bouw: (w, doc, cmyk) => bouw({ ...w, dik: vexel.mm(w.dikte) }, doc, cmyk),
  velden(w0) {
    const soort = keuzeVeld(SOORTEN, w0.soort);
    const palet = keuzeVeld(paletOpties(), w0.palet);
    const perRij = vinkje('Elke regel een eigen kleur', w0.perRij);
    const invoer = tekstVak('Waarden', w0.tekst, 'Eén per regel: label: waarde (72, 72%, 7,5 of 18/24).', 96, 'Omzet: 72');
    const min = getalVeld(w0.min, -1e6, 1e6, 'any');
    const max = getalVeld(w0.max, -1e6, 1e6, 'any');
    const eenheid = maak('input', { klasse: 'veld', type: 'text', value: w0.eenheid, maxlength: 12 });
    const breedte = getalVeld(w0.breedte, 10, 1000, 1);
    const dikte = getalVeld(w0.dikte, 0.5, 100, 0.5);
    const grootte = getalVeld(w0.grootte, 4, 72, 0.5);
    const uiteinden = keuzeVeld([['rond', 'Rond'], ['recht', 'Recht']], w0.uiteinden);
    const spoor = keuzeVeld([['tint', 'Lichte tint'], ['grijs', 'Lichtgrijs']], w0.spoor);
    const kol = keuzeVeld([['auto', 'Automatisch'], ['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5'], ['6', '6']], w0.kolommen);
    const labels = keuzeVeld([['boven', 'Boven de balk'], ['links', 'Links ervan']], w0.labels);
    const stappen = getalVeld(w0.stappen, 2, 12, 1);
    const zones = vinkje('Kleurzones', w0.zones);
    const naald = vinkje('Naald', w0.naald);
    const breedteLabel = metLabel('Doorsnede', breedte, 'mm');
    const kolBlok = metLabel('Kolommen', kol);
    const labelsBlok = metLabel('Labels', labels);
    const meterRij = kolommen(3, metLabel('Schaalstappen', stappen),
      maak('div', { stijl: { gridColumn: 'span 2', display: 'flex', gap: '14px', flexWrap: 'wrap', paddingBottom: '6px' } }, zones.blok, naald.blok));
    const kolomPlek = maak('div', { stijl: { display: 'grid', minWidth: '0' } }, kolBlok, labelsBlok);
    const pasAan = () => {
      const s = soort.value;
      breedteLabel.querySelector('.label').textContent = s === 'balk' ? 'Breedte' : 'Doorsnede';
      kolBlok.style.display = s === 'balk' ? 'none' : 'grid';
      labelsBlok.style.display = s === 'balk' ? 'grid' : 'none';
      meterRij.style.display = s === 'meter' ? 'grid' : 'none';
      // een redelijke maat als je van soort wisselt
      const b = leesGetal(breedte, 45);
      if (s === 'balk' && b < 60) breedte.value = 120;
      if (s !== 'balk' && b >= 100) breedte.value = 45;
    };
    soort.addEventListener('change', pasAan);
    pasAan();
    return {
      blokken: [
        kolommen(3, metLabel('Soort', soort), metLabel('Kleuren', palet), maak('div', { stijl: { paddingBottom: '6px' } }, perRij.blok)),
        invoer.blok,
        kolommen(3, metLabel('Minimum', min), metLabel('Maximum', max), metLabel('Eenheid', eenheid)),
        kolommen(3, breedteLabel, metLabel('Dikte', dikte, 'mm'), metLabel('Letter', grootte, 'pt')),
        kolommen(3, metLabel('Uiteinden', uiteinden), metLabel('Spoor', spoor), kolomPlek),
        meterRij,
      ],
      focus: invoer.veld,
      waarden: () => ({
        soort: soort.value, tekst: invoer.veld.value.slice(0, 20000), palet: palet.value, perRij: perRij.invoer.checked,
        min: leesGetal(min, 0), max: leesGetal(max, 100), eenheid: eenheid.value.slice(0, 12),
        breedte: begrens(leesGetal(breedte, 45), 10, 1000), dikte: begrens(leesGetal(dikte, 6), 0.5, 100),
        grootte: begrens(leesGetal(grootte, 9), 4, 72), uiteinden: uiteinden.value, spoor: spoor.value,
        kolommen: kol.value, labels: labels.value, stappen: begrens(Math.round(leesGetal(stappen, 5)), 2, 12),
        zones: zones.invoer.checked, naald: naald.invoer.checked,
      }),
    };
  },
}));
