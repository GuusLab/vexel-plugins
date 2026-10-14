// Gedachtekaart: een onderwerp in het midden met vloeiende, taps toelopende takken links en rechts.
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

/** Ingesprongen regels naar één boom; de eerste regel (of de enige zonder inspringing) is het midden. */
function leesBoom(invoer) {
  const ruweRegels = String(invoer).split(/\r?\n/).filter((r) => r.trim());
  const spatieStappen = ruweRegels.map((r) => r.match(/^ */)[0].length).filter((n) => n > 0);
  const eenheid = spatieStappen.length ? Math.min(...spatieStappen) : 2;
  const wortels = [], stapel = [];
  for (const ruw of ruweRegels) {
    const inspring = ruw.match(/^[ \t]*/)[0];
    const spaties = [...inspring].reduce((t, c) => t + (c === '\t' ? eenheid : 1), 0);
    const tekst = ruw.slice(inspring.length).replace(/^([-*•·]|\d+[.)])\s+/, '').trim();
    if (!tekst) continue;
    const diepte = Math.min(Math.round(spaties / eenheid), stapel.length);
    stapel.length = diepte;
    const knoop = { naam: tekst, kinderen: [], diepte };
    if (diepte === 0) wortels.push(knoop);
    else stapel[diepte - 1].kinderen.push(knoop);
    stapel.push(knoop);
  }
  if (wortels.length <= 1) return { midden: wortels[0] || null, los: 0 };
  // meer regels zonder inspringing: de eerste is het midden, de rest zijn hoofdtakken
  const [midden, ...rest] = wortels;
  const verlaag = (k, d) => { k.diepte = d; k.kinderen.forEach((c) => verlaag(c, d + 1)); };
  rest.forEach((k) => { verlaag(k, 1); midden.kinderen.push(k); });
  return { midden, los: rest.length };
}

// ---- instellingen --------------------------------------------------------------------------

const VOORBEELD = [
  'Nieuwe huisstijl',
  '  Logo',
  '    Beeldmerk',
  '    Woordmerk',
  '  Kleuren',
  '    Hoofdkleur',
  '    Steunkleuren',
  '  Letters',
  '    Koppen',
  '    Lopende tekst',
  '  Drukwerk',
  '    Visitekaartjes',
  '    Briefpapier',
  '    Folders',
  '  Online',
  '    Website',
  '    Sociale media',
].join('\n');

const STANDAARD = { tekst: VOORBEELD, palet: 'fris', grootte: 9, dikte: 7, midden: 'donker', tekstKleur: 'donker', ruimte: 100 };

// ---- vormen ------------------------------------------------------------------------------------

/** Punten op een kubische bocht. */
function bochtPunten(a, c1, c2, b, n) {
  const uit = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    uit.push({
      x: u * u * u * a.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * b.x,
      y: u * u * u * a.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * b.y,
    });
  }
  return uit;
}

/** Vloeiende handvatten door een rij punten (Catmull-Rom), voor een strak, glad pad. */
function glad(punten) {
  return punten.map((p, i) => {
    const a = punten[Math.max(0, i - 1)], b = punten[Math.min(punten.length - 1, i + 1)];
    const tx = (b.x - a.x) / 6, ty = (b.y - a.y) / 6;
    const q = { x: p.x, y: p.y };
    if (i > 0) q.in = { x: p.x - tx, y: p.y - ty };
    if (i < punten.length - 1) q.uit = { x: p.x + tx, y: p.y + ty };
    return q;
  });
}

/** Een taps toelopende tak langs een middellijn: van breedte w0 naar w1, met een rond eind. */
function tapseTak(middellijn, w0, w1) {
  const n = middellijn.length;
  const lengtes = [0];
  for (let i = 1; i < n; i++) lengtes.push(lengtes[i - 1] + afstand(middellijn[i], middellijn[i - 1]));
  const totaal = lengtes[n - 1] || 1;
  const links = [], rechts = [];
  middellijn.forEach((p, i) => {
    const a = middellijn[Math.max(0, i - 1)], b = middellijn[Math.min(n - 1, i + 1)];
    const d = afstand(a, b) || 1, nx = -(b.y - a.y) / d, ny = (b.x - a.x) / d;
    const t = lengtes[i] / totaal;
    const w = (w1 + (w0 - w1) * Math.pow(1 - t, 1.6)) / 2;
    links.push({ x: p.x + nx * w, y: p.y + ny * w });
    rechts.push({ x: p.x - nx * w, y: p.y - ny * w });
  });
  // rond eind: een halve cirkel om het laatste punt
  const z = middellijn[n - 1], v = middellijn[n - 2];
  const hoek = Math.atan2(z.y - v.y, z.x - v.x);
  const kap = boog(z.x, z.y, w1 / 2, w1 / 2, hoek + Math.PI / 2, hoek - Math.PI / 2);
  const punten = glad(links);
  punten[punten.length - 1].uit = undefined;
  plak(punten, kap);
  const terug = glad(rechts.reverse());
  terug[0].in = undefined;
  plak(punten, terug);
  return { gesloten: true, punten: punten.map((p) => { const q = { x: p.x, y: p.y }; if (p.in) q.in = p.in; if (p.uit) q.uit = p.uit; return q; }) };
}

// ---- bouwen ---------------------------------------------------------------------------------------

function bouw(w, doc, cmyk) {
  const { midden, los } = leesBoom(w.tekst);
  if (!midden) return { fout: 'Typ een onderwerp, en daaronder ingesprongen (tab of twee spaties) de takken.' };
  const alle = [];
  const loop = (k) => { alle.push(k); k.kinderen.forEach(loop); };
  loop(midden);
  if (alle.length > 300) return { fout: `Dat zijn ${alle.length} regels; hooguit 300 in één gedachtekaart.` };
  const s = w.grootte;
  const ruimte = w.ruimte / 100;
  const grootteVan = (d) => (d === 1 ? s * 1.1 : d === 2 ? s : s * 0.9);
  const gewichtVan = (d) => (d === 1 ? 700 : d === 2 ? 600 : 500);
  const maxB = s * 16;
  for (const k of alle) {
    if (k === midden) continue;
    const g = grootteVan(k.diepte);
    k.regels = breekNetjes(k.naam, maxB, g, gewichtVan(k.diepte));
    k.tb = langsteRegel(k.regels, g, gewichtVan(k.diepte)) * 1.08 + s * 0.5;
    k.hoogte = k.regels.length * g * 1.2 + s * 0.95 * ruimte + s * 0.3;
  }
  // hoogte van elke deelboom
  const hoogte = (k) => {
    if (!k.kinderen.length) return (k.sh = k.hoogte);
    const som = k.kinderen.reduce((t, c) => t + hoogte(c), 0);
    return (k.sh = Math.max(k.hoogte, som));
  };
  const takken = midden.kinderen;
  takken.forEach(hoogte);

  // verdeel de hoofdtakken over rechts en links (met de klok mee: eerst rechts van boven naar beneden)
  const totaal = takken.reduce((t, k) => t + k.sh, 0);
  const rechts = [], links = [];
  let som = 0;
  for (const k of takken) {
    if (som + k.sh / 2 <= totaal / 2 || !rechts.length) { rechts.push(k); som += k.sh; } else links.push(k);
  }
  links.reverse();

  // het midden
  const mg = s * 1.7;
  const middenRegels = breekNetjes(midden.naam, s * 14, mg, 700);
  const mtb = langsteRegel(middenRegels, mg, 700) * 1.08;
  const mth = mg * 0.74 + (middenRegels.length - 1) * mg * 1.2;
  const rx = Math.max(mtb / 2 + mg * 1.1, mg * 3), ry = Math.max(mth / 2 + mg * 0.95, mg * 1.4);

  const tussenTakken = s * 1.2 * ruimte;
  const plaatsKant = (lijst, kant) => {
    const hoog = lijst.reduce((t, k) => t + k.sh, 0) + tussenTakken * Math.max(0, lijst.length - 1);
    let y = -hoog / 2;
    const plaats = (k, y0, xAnker) => {
      k.kant = kant;
      k.y = y0 + k.sh / 2;
      if (k.kinderen.length) {
        let yy = y0 + (k.sh - k.kinderen.reduce((t, c) => t + c.sh, 0)) / 2;
        const x2 = xAnker + kant * (k.tb + s * 3.2);
        for (const c of k.kinderen) { plaats(c, yy, x2); yy += c.sh; }
        const eerste = k.kinderen[0], laatste = k.kinderen[k.kinderen.length - 1];
        k.y = (eerste.y + laatste.y) / 2;
      }
      k.x = xAnker;
    };
    for (const k of lijst) { plaats(k, y, kant * (rx + s * 4.5)); y += k.sh + tussenTakken; }
  };
  plaatsKant(rechts, 1);
  plaatsKant(links, -1);

  // kleuren
  const zwart = kleur([0, 0, 0, 90], '#262626', cmyk);
  const wit = kleur([0, 0, 0, 0], '#ffffff', cmyk);
  const groepen = [];
  const W0 = w.dikte;
  const dikteVan = (d) => W0 * Math.pow(0.45, d - 1);
  takken.forEach((hoofd, i) => {
    const basis = paletKleur(w.palet, i);
    const kl = kleur(basis.cmyk, basis.hex, cmyk);
    const subpaden = [], teksten = [];
    const teken = (k, van, w0) => {
      const kant = k.kant;
      const anker = { x: k.x, y: k.y };
      const eind = { x: k.x + kant * k.tb, y: k.y };
      const dx = Math.abs(anker.x - van.x);
      const bocht = bochtPunten(van, { x: van.x + kant * dx * 0.55, y: van.y }, { x: anker.x - kant * dx * 0.45, y: anker.y }, anker, 16);
      const lijn = [...bocht, { x: anker.x + kant * k.tb * 0.5, y: k.y }, eind];
      const w1 = Math.max(0.6, dikteVan(k.diepte + 1) * (k.kinderen.length ? 1 : 0.7));
      subpaden.push(tapseTak(lijn, w0, w1));
      const g = grootteVan(k.diepte);
      const tekstKleur = w.tekstKleur === 'tak' ? kl : zwart;
      teksten.push({
        soort: 'tekst', naam: k.naam.slice(0, 100), x: kant > 0 ? anker.x + s * 0.25 : anker.x - s * 0.25,
        y: k.y - w1 / 2 - s * 0.35 - (k.regels.length - 1) * g * 1.2, inhoud: k.regels.join('\n'), grootte: g, gewicht: gewichtVan(k.diepte),
        regelafstand: g * 1.2, uitlijning: kant > 0 ? 'links' : 'rechts', vulling: tekstKleur, lijn: null,
      });
      for (const c of k.kinderen) teken(c, eind, w1);
    };
    teken(hoofd, { x: hoofd.kant * rx * 0.35, y: 0 }, W0);
    groepen.push({
      soort: 'groep', naam: `Tak · ${hoofd.naam}`.slice(0, 100), kinderen: [
        { soort: 'pad', naam: 'Takken', subpaden, vulling: kl, lijn: null },
        { soort: 'groep', naam: 'Teksten', kinderen: teksten },
      ],
    });
  });
  const donker = w.midden === 'donker';
  const mk = donker ? kleur([70, 50, 30, 60], '#26323f', cmyk) : wit;
  groepen.push({
    soort: 'groep', naam: `Midden · ${midden.naam}`.slice(0, 100), kinderen: [
      { soort: 'pad', naam: 'Vorm', subpaden: [ellipsSubpad(0, 0, rx, ry)], vulling: mk, lijn: donker ? null : kleur([70, 50, 30, 60], '#26323f', cmyk),
        lijndikte: donker ? 0 : Math.max(1, s * 0.15) },
      {
        soort: 'tekst', naam: 'Onderwerp', x: 0, y: -mth / 2 + mg * 0.74, inhoud: middenRegels.join('\n'), grootte: mg, gewicht: 700,
        regelafstand: mg * 1.2, uitlijning: 'midden', vulling: donker ? wit : zwart, lijn: null,
      },
    ],
  });
  const waarschuwingen = [];
  if (!takken.length) waarschuwingen.push('Er zijn nog geen takken: spring regels in onder het onderwerp.');
  if (los) waarschuwingen.push(`${los} ${los === 1 ? 'regel stond' : 'regels stonden'} niet ingesprongen en ${los === 1 ? 'is een hoofdtak' : 'zijn hoofdtakken'} geworden.`);
  return {
    vormen: [{ soort: 'groep', naam: 'Gedachtekaart', kinderen: groepen }],
    samenvatting: `${takken.length} ${takken.length === 1 ? 'hoofdtak' : 'hoofdtakken'} (${rechts.length} rechts, ${links.length} links), ${alle.length - 1} takken in totaal.`,
    waarschuwingen, kleinsteLetter: s * 0.9, aantal: alle.length - 1,
  };
}

// ---- het venster --------------------------------------------------------------------------------

vexel.opCommando('maken', () => startVenster({
  standaard: STANDAARD,
  knop: 'Gedachtekaart maken',
  voorbeeldHoogte: 220,
  marge: () => 10,
  melding: (u) => `Gedachtekaart gemaakt met ${u.aantal} ${u.aantal === 1 ? 'tak' : 'takken'}.`,
  bouw,
  velden(w0) {
    const invoer = tekstVak('Onderwerp en takken', w0.tekst, 'Eerste regel: het onderwerp. Spring in (tab of twee spaties) voor takken en subtakken.',
      150, 'Onderwerp');
    invoer.veld.dataset.tab = '1';
    const palet = keuzeVeld(paletOpties(), w0.palet);
    const grootte = getalVeld(w0.grootte, 4, 48, 0.5);
    const dikte = getalVeld(w0.dikte, 1, 40, 0.5);
    const midden = keuzeVeld([['donker', 'Donker vlak'], ['licht', 'Wit met rand']], w0.midden);
    const tekstKleur = keuzeVeld([['donker', 'Donker'], ['tak', 'Kleur van de tak']], w0.tekstKleur);
    const ruimte = getalVeld(w0.ruimte, 50, 250, 10);
    return {
      blokken: [
        invoer.blok,
        kolommen(3, metLabel('Kleuren', palet), metLabel('Midden', midden), metLabel('Tekst', tekstKleur)),
        kolommen(3, metLabel('Letter', grootte, 'pt'), metLabel('Takdikte', dikte, 'pt'), metLabel('Ruimte tussen takken', ruimte, '%')),
      ],
      focus: invoer.veld,
      waarden: () => ({
        tekst: invoer.veld.value.slice(0, 30000), palet: palet.value, grootte: begrens(leesGetal(grootte, 10), 4, 48),
        dikte: begrens(leesGetal(dikte, 7), 1, 40), midden: midden.value, tekstKleur: tekstKleur.value,
        ruimte: begrens(leesGetal(ruimte, 100), 50, 250),
      }),
    };
  },
}));
