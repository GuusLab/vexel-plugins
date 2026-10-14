// Stroomdiagram: van een tekstnotatie (Start -> Stap -> Vraag? -> ja: X; nee: Y) naar een net stroomschema.
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

const BEGIN_EIND = new Set(['start', 'begin', 'einde', 'eind', 'klaar', 'stop', 'gereed', 'afgerond', 'einde proces']);

/** Een naam met eventueel haakjes: (rond), [stap], <keuze>, /invoer/. */
function leesKnoopTekst(ruw) {
  let t = ruw.trim(), soort = null;
  const m = t.match(/^([([<{/])\s*(.*?)\s*([)\]>}/])$/);
  if (m) {
    t = m[2];
    soort = { '(': 'rond', '[': 'stap', '<': 'keuze', '{': 'keuze', '/': 'invoer' }[m[1]];
  }
  return { naam: t.replace(/\s+/g, ' '), soort };
}

/** De notatie naar knopen en pijlen. Elke regel is een keten: A -> B -> C; takken met "ja: X; nee: Y". */
function leesStroom(invoer) {
  const knopen = new Map(), pijlen = [], fouten = [];
  const knoop = (ruw) => {
    const { naam, soort } = leesKnoopTekst(ruw);
    if (!naam) return null;
    const sleutel = naam.toLowerCase();
    if (!knopen.has(sleutel)) knopen.set(sleutel, { sleutel, naam, soort: null, uit: [], in: [], volgorde: knopen.size });
    const k = knopen.get(sleutel);
    if (soort) k.soort = soort;
    return k;
  };
  String(invoer).split(/\r?\n/).forEach((ruw, nr) => {
    const regel = ruw.replace(/\s*(#|\/\/).*$/, '').trim();
    if (!regel) return;
    const delen = regel.split(/\s*(?:-->|->|→|=>)\s*/);
    let vorige = null;
    for (const [i, deel] of delen.entries()) {
      const doelen = [];
      for (const stuk of deel.split(/\s*;\s*/).filter(Boolean)) {
        let label = '', naam = stuk;
        const m = stuk.match(/^([^:()[\]<>/]{1,18}):\s*(.+)$/);
        if (m && i > 0) { label = m[1].trim(); naam = m[2]; }
        const k = knoop(naam);
        if (k) doelen.push({ k, label });
      }
      if (!doelen.length) { if (deel.trim() || i > 0) fouten.push(nr + 1); vorige = null; continue; }
      if (vorige) {
        for (const a of vorige) for (const b of doelen) {
          if (a.k === b.k) continue;
          if (pijlen.some((p) => p.van === a.k && p.naar === b.k)) continue;
          const p = { van: a.k, naar: b.k, label: b.label, nr: pijlen.length };
          pijlen.push(p); a.k.uit.push(p); b.k.in.push(p);
        }
      }
      vorige = doelen;
    }
  });
  for (const k of knopen.values()) {
    if (!k.soort) {
      if (/\?$/.test(k.naam)) k.soort = 'keuze';
      else if (BEGIN_EIND.has(k.sleutel)) k.soort = 'rond';
      else k.soort = 'stap';
    }
  }
  return { knopen: [...knopen.values()], pijlen, fouten };
}

// ---- instellingen --------------------------------------------------------------------------

const VOORBEELD = [
  'Start -> Bestelling ontvangen -> Op voorraad? -> ja: Inpakken; nee: Bijbestellen',
  'Bijbestellen -> Inpakken',
  'Inpakken -> Verzenden -> Einde',
].join('\n');

const STANDAARD = {
  tekst: VOORBEELD, stijl: 'tint', palet: 'fris', grootte: 9, maxBreedte: 38, lijndikte: 1, hoeken: 'rond',
};

// ---- vormen -------------------------------------------------------------------------------------

function vormVan(k, x, y, b, h, r) {
  if (k.soort === 'rond') return rondeRechthoek(x, y, b, h, h / 2);
  if (k.soort === 'keuze') {
    return { gesloten: true, punten: [{ x: x + b / 2, y }, { x: x + b, y: y + h / 2 }, { x: x + b / 2, y: y + h }, { x, y: y + h / 2 }] };
  }
  if (k.soort === 'invoer') {
    const sch = h * 0.3;
    return { gesloten: true, punten: [{ x: x + sch, y }, { x: x + b, y }, { x: x + b - sch, y: y + h }, { x, y: y + h }] };
  }
  return rondeRechthoek(x, y, b, h, r);
}

/** Een pijlpunt (gevulde driehoek) aan het eind van een lijn van a naar b. */
function pijlpunt(a, b, lengte) {
  const d = afstand(a, b) || 1, ux = (b.x - a.x) / d, uy = (b.y - a.y) / d;
  const breed = lengte * 0.42;
  return {
    gesloten: true,
    punten: [
      { x: b.x, y: b.y },
      { x: b.x - ux * lengte - uy * breed, y: b.y - uy * lengte + ux * breed },
      { x: b.x - ux * lengte * 0.82, y: b.y - uy * lengte * 0.82 },
      { x: b.x - ux * lengte + uy * breed, y: b.y - uy * lengte - ux * breed },
    ],
  };
}

/** Haakse lijn met afgeronde bochten. */
function bochtLijn(punten, r) {
  const schoon = punten.filter((p, i) => i === 0 || afstand(p, punten[i - 1]) > 0.01);
  // punten op één rechte lijn weglaten
  const recht = schoon.filter((p, i) => {
    if (i === 0 || i === schoon.length - 1) return true;
    const a = schoon[i - 1], b = schoon[i + 1];
    return Math.abs((p.x - a.x) * (b.y - p.y) - (p.y - a.y) * (b.x - p.x)) > 0.01;
  });
  const uit = [{ x: recht[0].x, y: recht[0].y }];
  for (let i = 1; i < recht.length - 1; i++) {
    const a = recht[i - 1], p = recht[i], b = recht[i + 1];
    const la = afstand(a, p), lb = afstand(p, b);
    const rr = Math.min(r, la / 2, lb / 2);
    if (rr < 0.05) { uit.push({ x: p.x, y: p.y }); continue; }
    const p1 = { x: p.x + (a.x - p.x) / la * rr, y: p.y + (a.y - p.y) / la * rr };
    const p2 = { x: p.x + (b.x - p.x) / lb * rr, y: p.y + (b.y - p.y) / lb * rr };
    p1.uit = { x: p1.x + (p.x - p1.x) * 0.5523, y: p1.y + (p.y - p1.y) * 0.5523 };
    p2.in = { x: p2.x + (p.x - p2.x) * 0.5523, y: p2.y + (p.y - p2.y) * 0.5523 };
    uit.push(p1, p2);
  }
  uit.push({ x: recht[recht.length - 1].x, y: recht[recht.length - 1].y });
  return uit;
}

// ---- indeling -------------------------------------------------------------------------------------

function deelIn(knopen, pijlen) {
  // 1. terugwijzende pijlen (lussen) vinden met diepte-eerst vanaf de beginpunten
  const status = new Map();
  const wortels = knopen.filter((k) => !k.in.length);
  const volgorde = [...wortels, ...knopen.filter((k) => k.in.length)];
  const bezoek = (k) => {
    status.set(k, 1);
    for (const p of k.uit) {
      const s = status.get(p.naar);
      if (s === 1) p.terug = true;
      else if (!s) bezoek(p.naar);
    }
    status.set(k, 2);
  };
  for (const k of volgorde) if (!status.get(k)) bezoek(k);
  // 2. rang: langste pad over de vooruitwijzende pijlen
  const rang = new Map();
  const rangVan = (k, pad = new Set()) => {
    if (rang.has(k)) return rang.get(k);
    pad.add(k);
    let r = 0;
    for (const p of k.in) if (!p.terug && !pad.has(p.van)) r = Math.max(r, rangVan(p.van, pad) + 1);
    pad.delete(k);
    rang.set(k, r);
    return r;
  };
  knopen.forEach((k) => { k.rang = rangVan(k); });
  // 3. kolom: de eerste tak gaat recht omlaag, volgende takken schuiven naar rechts
  const bezet = new Set();
  const plek = (r, c) => `${r}:${c}`;
  const opRang = [...knopen].sort((a, b) => a.rang - b.rang || a.volgorde - b.volgorde);
  for (const k of opRang) {
    let wens = 0;
    const ouder = k.in.filter((p) => !p.terug && p.van.kolom !== undefined).sort((a, b) => a.nr - b.nr)[0];
    if (ouder) {
      const takken = ouder.van.uit.filter((p) => !p.terug);
      wens = ouder.van.kolom + Math.max(0, takken.indexOf(ouder));
    }
    let c = wens;
    while (bezet.has(plek(k.rang, c))) c++;
    k.kolom = c;
    bezet.add(plek(k.rang, c));
  }
  return bezet;
}

// ---- bouwen ---------------------------------------------------------------------------------------

function bouw(w, doc, cmyk) {
  const { knopen, pijlen, fouten } = leesStroom(w.tekst);
  if (!knopen.length) return { fout: 'Typ een keten, bijvoorbeeld "Start -> Bestelling ontvangen -> Einde".' };
  if (knopen.length > 150) return { fout: `Dat zijn ${knopen.length} stappen; hooguit 150 in één stroomdiagram.` };
  const s = w.grootte, gew = 600;
  const maxB = vexel.mm(w.maxBreedte);
  const pad = s * 0.9;
  // 1. maat van elke vorm
  for (const k of knopen) {
    const breed = k.soort === 'keuze' ? maxB * 0.62 : maxB - 2 * pad;
    k.regels = breekNetjes(k.naam, breed, s, gew);
    const tb = langsteRegel(k.regels, s, gew) * 1.08;
    const th = s * 0.74 + (k.regels.length - 1) * s * 1.2;
    k.th = th;
    if (k.soort === 'keuze') {
      // een ruit om een tekstblok: twee keer zo breed en hoog als het blok (plus wat lucht)
      k.b = Math.max(s * 7, (tb + s * 0.8) * 1.85);
      k.h = Math.max(s * 4.2, (th + s * 0.9) * 1.95);
    } else {
      k.b = Math.max(s * 7, tb + 2 * pad + (k.soort === 'invoer' ? s * 1.6 : 0) + (k.soort === 'rond' ? s * 0.8 : 0));
      k.h = th + 2 * s * 0.8;
    }
  }
  deelIn(knopen, pijlen);
  // 2. rijen en kolommen
  const aantalRangen = Math.max(...knopen.map((k) => k.rang)) + 1;
  const aantalKolommen = Math.max(...knopen.map((k) => k.kolom)) + 1;
  const rijH = Array(aantalRangen).fill(0), kolB = Array(aantalKolommen).fill(0);
  for (const k of knopen) { rijH[k.rang] = Math.max(rijH[k.rang], k.h); kolB[k.kolom] = Math.max(kolB[k.kolom], k.b); }
  const gatY = s * 3.2, gatX = s * 4.2;
  const rijY = [0], kolX = [0];
  for (let i = 1; i < aantalRangen; i++) rijY[i] = rijY[i - 1] + rijH[i - 1] + gatY;
  for (let i = 1; i < aantalKolommen; i++) kolX[i] = kolX[i - 1] + kolB[i - 1] + gatX;
  const midX = (c) => kolX[c] + kolB[c] / 2;
  for (const k of knopen) {
    k.x = midX(k.kolom) - k.b / 2;
    k.y = rijY[k.rang] + (rijH[k.rang] - k.h) / 2;
    k.cx = k.x + k.b / 2; k.cy = k.y + k.h / 2;
  }
  const bezet = (r, c) => knopen.some((k) => k.rang === r && k.kolom === c);
  const vrijTussen = (c, r0, r1) => { for (let r = r0 + 1; r < r1; r++) if (bezet(r, c)) return false; return true; };
  const gatOnder = (r) => rijY[r] + rijH[r] + gatY / 2;
  const gatBoven = (r) => rijY[r] - gatY / 2;
  const baanRechts = (c) => kolX[c] + kolB[c] + gatX / 2;
  const links = Math.min(...knopen.map((k) => k.x));

  // 3. pijlen leggen
  const pijlLengte = Math.max(4, s * 0.6) * Math.max(0.8, Math.min(1.6, w.lijndikte));
  let terugLinks = 0, terugRechts = 0;
  const rechts = Math.max(...knopen.map((k) => k.x + k.b));
  const lijnen = [];
  for (const p of pijlen) {
    const a = p.van, b = p.naar;
    const takken = a.uit.filter((q) => !q.terug);
    const tak = takken.indexOf(p);
    let route, labelPlek;
    if (p.terug) {
      // terug omhoog: via een baan rechts of links van alles, aan de kant waar niets in de weg staat
      const vrij = (k, kant) => !knopen.some((q) => q.rang === k.rang && (kant > 0 ? q.kolom > k.kolom : q.kolom < k.kolom));
      const kant = vrij(a, 1) && vrij(b, 1) ? 1 : vrij(a, -1) && vrij(b, -1) ? -1 : vrij(a, 1) ? 1 : -1;
      const baan = kant > 0 ? terugRechts++ : terugLinks++;
      const lx = kant > 0 ? rechts + gatX * 0.55 * (baan + 1) : links - gatX * 0.55 * (baan + 1);
      const zij = (k) => ({ x: kant > 0 ? k.x + k.b - (k.soort === 'invoer' ? k.h * 0.15 : 0) : k.x + (k.soort === 'invoer' ? k.h * 0.15 : 0), y: k.cy });
      const begin = vrij(a, kant) ? [zij(a), { x: lx, y: a.cy }]
        : [{ x: a.cx, y: a.y + a.h }, { x: a.cx, y: gatOnder(a.rang) }, { x: lx, y: gatOnder(a.rang) }];
      const eind = vrij(b, kant) ? [{ x: lx, y: b.cy }, zij(b)]
        : [{ x: lx, y: gatBoven(b.rang) }, { x: b.cx, y: gatBoven(b.rang) }, { x: b.cx, y: b.y }];
      route = [...begin, ...eind];
      labelPlek = vrij(a, kant) ? { x: zij(a).x + kant * s * 0.5, y: a.cy - s * 0.45, uitlijning: kant > 0 ? 'links' : 'rechts' }
        : { x: a.cx + s * 0.45, y: a.y + a.h + s * 1.1 };
    } else if (a.soort === 'keuze' && tak > 0 && b.kolom > a.kolom && vrijTussen(b.kolom, a.rang - 1, b.rang)
      && !knopen.some((q) => q.rang === a.rang && q.kolom > a.kolom && q.kolom <= b.kolom)) {
      // tweede tak van een keuze: rechts de ruit uit, dan omlaag
      route = [{ x: a.x + a.b, y: a.cy }, { x: b.cx, y: a.cy }, { x: b.cx, y: b.y }];
      labelPlek = { x: b.cx + s * 0.45, y: a.cy + s * 1.5 };
    } else {
      const start = { x: a.cx, y: a.y + a.h };
      if (a.kolom === b.kolom && vrijTussen(a.kolom, a.rang, b.rang)) route = [start, { x: b.cx, y: b.y }];
      else if (vrijTussen(a.kolom, a.rang, b.rang)) route = [start, { x: a.cx, y: gatBoven(b.rang) }, { x: b.cx, y: gatBoven(b.rang) }, { x: b.cx, y: b.y }];
      else if (vrijTussen(b.kolom, a.rang, b.rang)) route = [start, { x: a.cx, y: gatOnder(a.rang) }, { x: b.cx, y: gatOnder(a.rang) }, { x: b.cx, y: b.y }];
      else {
        const lx = baanRechts(Math.max(a.kolom, b.kolom));
        route = [start, { x: a.cx, y: gatOnder(a.rang) }, { x: lx, y: gatOnder(a.rang) }, { x: lx, y: gatBoven(b.rang) },
          { x: b.cx, y: gatBoven(b.rang) }, { x: b.cx, y: b.y }];
      }
      labelPlek = { x: a.cx + s * 0.45, y: a.y + a.h + s * 1.1 };
    }
    // de lijn stopt waar de pijlpunt begint
    const eind = route[route.length - 1], voor = route[route.length - 2];
    const d = afstand(voor, eind) || 1;
    const kort = { x: eind.x - (eind.x - voor.x) / d * pijlLengte * 0.85, y: eind.y - (eind.y - voor.y) / d * pijlLengte * 0.85 };
    const lijnPunten = bochtLijn([...route.slice(0, -1), kort], w.hoeken === 'rond' ? s * 0.7 : 0);
    lijnen.push({ p, lijnPunten, punt: pijlpunt(voor, eind, pijlLengte), labelPlek });
  }

  // 4. kleuren
  const zwart = kleur([0, 0, 0, 90], '#262626', cmyk);
  const lijnKleur = kleur([0, 0, 0, 75], '#4a4a4a', cmyk);
  const wit = kleur([0, 0, 0, 0], '#ffffff', cmyk);
  const KLEURNR = { stap: 0, rond: 1, keuze: 2, invoer: 4 };
  const r = w.hoeken === 'rond' ? s * 0.6 : 0;
  const vormen = knopen.map((k) => {
    const basis = paletKleur(w.palet, KLEURNR[k.soort]);
    const accent = kleur(basis.cmyk, basis.hex, cmyk);
    let vul = accent, rand = null, tekst = kleur(tekstOp(basis).cmyk, tekstOp(basis).hex, cmyk);
    if (w.stijl === 'tint') { const t = lichter({ ...basis, naam: '' }, 0.8); vul = kleur(t.cmyk, t.hex, cmyk); rand = accent; tekst = zwart; }
    if (w.stijl === 'omlijnd') { vul = wit; rand = accent; tekst = zwart; }
    const naam = { stap: 'Stap', rond: k.in.length ? 'Einde' : 'Begin', keuze: 'Keuze', invoer: 'Invoer' }[k.soort];
    return {
      soort: 'groep', naam: `${naam} · ${k.naam}`.slice(0, 100), kinderen: [
        { soort: 'pad', naam: 'Vorm', subpaden: [vormVan(k, k.x, k.y, k.b, k.h, r)], vulling: vul, lijn: rand, lijndikte: rand ? Math.max(0.6, s * 0.1) : 0, lijnhoek: 'round' },
        {
          soort: 'tekst', naam: 'Tekst', x: k.cx, y: k.cy - k.th / 2 + s * 0.74, inhoud: k.regels.join('\n'), grootte: s, gewicht: gew,
          regelafstand: s * 1.2, uitlijning: 'midden', vulling: tekst, lijn: null,
        },
      ],
    };
  });
  const pijlVormen = lijnen.map(({ p, lijnPunten, punt, labelPlek }) => {
    const kinderen = [
      { soort: 'pad', naam: 'Lijn', subpaden: [{ gesloten: false, punten: lijnPunten }], vulling: null, lijn: lijnKleur, lijndikte: w.lijndikte, lijnhoek: 'round' },
      { soort: 'pad', naam: 'Pijlpunt', subpaden: [punt], vulling: lijnKleur, lijn: null },
    ];
    if (p.label) {
      kinderen.push({
        soort: 'tekst', naam: 'Label', x: labelPlek.x, y: labelPlek.y, inhoud: p.label, grootte: s * 0.88, gewicht: 600,
        uitlijning: labelPlek.uitlijning || 'links', vulling: lijnKleur, lijn: null,
      });
    }
    return { soort: 'groep', naam: `Pijl · ${p.van.naam} → ${p.naar.naam}`.slice(0, 100), kinderen };
  });
  const groep = [];
  if (pijlVormen.length) groep.push({ soort: 'groep', naam: 'Pijlen', kinderen: pijlVormen });
  groep.push({ soort: 'groep', naam: 'Vormen', kinderen: vormen });
  const waarschuwingen = [];
  if (fouten.length) waarschuwingen.push(`Regel ${fouten.slice(0, 3).join(', ')} heeft een lege stap (twee pijlen achter elkaar?).`);
  const lussen = pijlen.filter((p) => p.terug).length;
  return {
    vormen: [{ soort: 'groep', naam: 'Stroomdiagram', kinderen: groep }],
    samenvatting: `${knopen.length} ${knopen.length === 1 ? 'vorm' : 'vormen'} en ${pijlen.length} ${pijlen.length === 1 ? 'pijl' : 'pijlen'}`
      + `${lussen ? `, waarvan ${lussen} terug` : ''}.`,
    waarschuwingen, kleinsteLetter: s * 0.88, aantal: knopen.length,
  };
}

// ---- het venster --------------------------------------------------------------------------------

vexel.opCommando('maken', () => startVenster({
  standaard: STANDAARD,
  knop: 'Stroomdiagram maken',
  voorbeeldHoogte: 230,
  marge: () => 10,
  melding: (u) => `Stroomdiagram gemaakt met ${u.aantal} ${u.aantal === 1 ? 'vorm' : 'vormen'}.`,
  bouw,
  velden(w0) {
    const invoer = tekstVak('Stappen', w0.tekst,
      'Elke regel een keten met ->. Een naam met ? is een keuze; takken: ja: X; nee: Y. Dezelfde naam is dezelfde stap.', 104,
      'Start -> Stap -> Vraag? -> ja: X; nee: Y');
    const stijl = keuzeVeld([['tint', 'Lichte tint'], ['gevuld', 'Gevuld'], ['omlijnd', 'Omlijnd']], w0.stijl);
    const palet = keuzeVeld(paletOpties(), w0.palet);
    const hoeken = keuzeVeld([['rond', 'Rond'], ['recht', 'Recht']], w0.hoeken);
    const grootte = getalVeld(w0.grootte, 4, 48, 0.5);
    const maxBreedte = getalVeld(w0.maxBreedte, 15, 200, 1);
    const lijndikte = getalVeld(w0.lijndikte, 0.25, 10, 0.25);
    return {
      blokken: [
        invoer.blok,
        kolommen(3, metLabel('Stijl', stijl), metLabel('Kleuren', palet), metLabel('Hoeken', hoeken)),
        kolommen(3, metLabel('Letter', grootte, 'pt'), metLabel('Max. vakbreedte', maxBreedte, 'mm'), metLabel('Lijndikte', lijndikte, 'pt')),
        maak('p', { klasse: 'uitleg', stijl: { margin: '0' }, tekst: 'Vormen: (rond) begin of einde, [stap], <keuze>, /invoer/. Start en Einde worden vanzelf rond.' }),
      ],
      focus: invoer.veld,
      waarden: () => ({
        tekst: invoer.veld.value.slice(0, 30000), stijl: stijl.value, palet: palet.value, hoeken: hoeken.value,
        grootte: begrens(leesGetal(grootte, 9), 4, 48), maxBreedte: begrens(leesGetal(maxBreedte, 38), 15, 200),
        lijndikte: begrens(leesGetal(lijndikte, 1), 0.25, 10),
      }),
    };
  },
}));
