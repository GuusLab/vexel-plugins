// Venn-diagram: 2, 3 of 4 verzamelingen met de overlappen als eigen vlakken (echte doorsneden), en tekst per vlak.
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

// ---- ellipsen ----------------------------------------------------------------------------

/** Een (gedraaide) ellips: middelpunt, halve assen en draaihoek in radialen (met de klok mee). */
const ellips = (x, y, a, b, r = 0) => ({ x, y, a, b, r, c: Math.cos(r), s: Math.sin(r) });
const puntOp = (e, t) => {
  const u = e.a * Math.cos(t), v = e.b * Math.sin(t);
  return { x: e.x + u * e.c - v * e.s, y: e.y + u * e.s + v * e.c };
};
/** Negatief binnen de ellips, positief erbuiten. */
const waarde = (e, x, y) => {
  const dx = x - e.x, dy = y - e.y;
  const u = dx * e.c + dy * e.s, v = -dx * e.s + dy * e.c;
  return (u / e.a) ** 2 + (v / e.b) ** 2 - 1;
};
const lidmaatschap = (E, x, y, behalve = -1) => E.reduce((m, e, j) => (j !== behalve && waarde(e, x, y) < 0 ? m | (1 << j) : m), 0);

/** Snijpunten van ellips i met de andere, als parameters t op ellips i. */
function snijpunten(E, i) {
  const N = 1440, ts = [];
  for (let j = 0; j < E.length; j++) {
    if (j === i) continue;
    const f = (t) => { const p = puntOp(E[i], t); return waarde(E[j], p.x, p.y); };
    let t0 = 0, f0 = f(0);
    for (let k = 1; k <= N; k++) {
      const t1 = (k / N) * TAU, f1 = f(t1);
      if ((f0 < 0) !== (f1 < 0)) {
        let a = t0, b = t1, fa = f0;
        for (let n = 0; n < 50; n++) { const m = (a + b) / 2, fm = f(m); if ((fa < 0) === (fm < 0)) { a = m; fa = fm; } else b = m; }
        ts.push((a + b) / 2);
      }
      t0 = t1; f0 = f1;
    }
  }
  return ts.sort((a, b) => a - b);
}

/** Een stuk ellipsrand van t0 naar t1 als padpunten (bezier), gedraaid en verschoven. */
function randStuk(e, t0, t1) {
  return boog(0, 0, e.a, e.b, t0, t1).map((p) => {
    const z = (q) => ({ x: e.x + q.x * e.c - q.y * e.s, y: e.y + q.x * e.s + q.y * e.c });
    const n = z(p);
    if (p.in) n.in = z(p.in);
    if (p.uit) n.uit = z(p.uit);
    return n;
  });
}

/** Alle vlakken (elke combinatie van verzamelingen) als subpaden, met echte doorsneden. */
function vlakken(E) {
  const stukken = [];
  E.forEach((e, i) => {
    const ts = snijpunten(E, i);
    if (!ts.length) { stukken.push({ i, t0: 0, t1: TAU }); return; }
    ts.forEach((t, k) => stukken.push({ i, t0: t, t1: k + 1 < ts.length ? ts[k + 1] : ts[0] + TAU }));
  });
  for (const st of stukken) {
    const m = puntOp(E[st.i], (st.t0 + st.t1) / 2);
    st.ander = lidmaatschap(E, m.x, m.y, st.i);
    st.a = puntOp(E[st.i], st.t0); st.b = puntOp(E[st.i], st.t1);
  }
  const schaal = Math.max(...E.map((e) => e.a));
  const tol = schaal * 1e-5;
  const uit = new Map();
  for (let M = 1; M < 1 << E.length; M++) {
    const mijn = stukken.filter((st) => st.ander === (M & ~(1 << st.i)));
    const gebruikt = new Set(), subpaden = [];
    for (const begin of mijn) {
      if (gebruikt.has(begin)) continue;
      const punten = [];
      let st = begin, omgekeerd = false, veilig = 0;
      while (st && veilig++ < 200) {
        gebruikt.add(st);
        plak(punten, omgekeerd ? randStuk(E[st.i], st.t1, st.t0) : randStuk(E[st.i], st.t0, st.t1));
        const eind = omgekeerd ? st.a : st.b;
        if (afstand(eind, begin.a) < tol) break;
        let volgende = null;
        for (const q of mijn) {
          if (gebruikt.has(q)) continue;
          if (afstand(q.a, eind) < tol) { volgende = q; omgekeerd = false; break; }
          if (afstand(q.b, eind) < tol) { volgende = q; omgekeerd = true; break; }
        }
        st = volgende;
      }
      if (punten.length > 2) subpaden.push({ gesloten: true, punten: sluitPunten(punten) });
    }
    if (subpaden.length) uit.set(M, subpaden);
  }
  return uit;
}

/** Per vlak het punt dat het verst van de rand ligt (voor de tekst), en hoe ver dat is. */
function middens(E) {
  const k = kaderVan(E.map((e) => ({ soort: 'pad', subpaden: [{ punten: [0, 1, 2, 3].map((n) => puntOp(e, (n * Math.PI) / 2 + e.r)) }] })));
  const marge = Math.max(...E.map((e) => e.a)) * 1.2;
  const x0 = k.x + k.b / 2 - marge * 1.6, y0 = k.y + k.h / 2 - marge * 1.6;
  const N = 150, stap = (marge * 3.2) / N;
  const m = new Int32Array(N * N), d = new Float64Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) m[j * N + i] = lidmaatschap(E, x0 + (i + 0.5) * stap, y0 + (j + 0.5) * stap);
  // afstand tot de rand van het eigen vlak (twee keer langs, schuine stap telt als wortel 2)
  for (let n = 0; n < N * N; n++) d[n] = 1e9;
  const rand = (i, j) => i <= 0 || j <= 0 || i >= N - 1 || j >= N - 1;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const n = j * N + i;
    if (rand(i, j) || m[n - 1] !== m[n] || m[n + 1] !== m[n] || m[n - N] !== m[n] || m[n + N] !== m[n]) d[n] = 0.5;
  }
  const buren = [[-1, 0, 1], [0, -1, 1], [-1, -1, Math.SQRT2], [1, -1, Math.SQRT2]];
  for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) {
    const n = j * N + i;
    for (const [di, dj, w] of buren) d[n] = Math.min(d[n], d[n + dj * N + di] + w);
  }
  for (let j = N - 2; j > 0; j--) for (let i = N - 2; i > 0; i--) {
    const n = j * N + i;
    for (const [di, dj, w] of buren) d[n] = Math.min(d[n], d[n - dj * N - di] + w);
  }
  const uit = new Map();
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const n = j * N + i, M = m[n];
    if (!M) continue;
    const huidig = uit.get(M);
    if (!huidig || d[n] * stap > huidig.r + 1e-9) uit.set(M, { x: x0 + (i + 0.5) * stap, y: y0 + (j + 0.5) * stap, r: d[n] * stap });
  }
  return uit;
}

// ---- opstellingen ---------------------------------------------------------------------------------

function opstelling(n, R, overlap) {
  if (n === 2) {
    const d = 2 * R * (1 - overlap);
    return [ellips(-d / 2, 0, R, R), ellips(d / 2, 0, R, R)];
  }
  if (n === 3) {
    const d = 2 * R * (1 - overlap), h = (d * Math.sqrt(3)) / 2;
    return [ellips(-d / 2, -h / 3, R, R), ellips(d / 2, -h / 3, R, R), ellips(0, (2 * h) / 3, R, R)];
  }
  // vier gedraaide ellipsen: de klassieke opstelling waarin alle vijftien vlakken voorkomen
  const a = R, b = R * 0.5, th = (52 * Math.PI) / 180;
  return [
    ellips(-0.2 * a, -0.32 * a, a, b, th), ellips(0.03 * a, -0.62 * a, a, b, th),
    ellips(-0.03 * a, -0.62 * a, a, b, -th), ellips(0.2 * a, -0.32 * a, a, b, -th),
  ];
}

// ---- invoer lezen ----------------------------------------------------------------------

function leesTeksten(invoer, namen) {
  const teksten = new Map(), fouten = [];
  const alle = (1 << namen.length) - 1;
  String(invoer).split(/\r?\n/).forEach((ruw, nr) => {
    const regel = ruw.trim();
    if (!regel) return;
    const m = regel.match(/^([^:]+):\s*(.*)$/);
    if (!m) { fouten.push(nr + 1); return; }
    const sleutel = m[1].trim().toLowerCase();
    let M = 0;
    if (['alle', 'midden', 'allemaal', 'alles'].includes(sleutel)) M = alle;
    else {
      for (const stuk of sleutel.split(/\s*(?:\+|&|,|\sen\s|∩)\s*/)) {
        const i = /^\d+$/.test(stuk) ? Number(stuk) - 1 : namen.findIndex((nm) => nm.toLowerCase() === stuk);
        if (i < 0 || i >= namen.length) { M = -1; break; }
        M |= 1 << i;
      }
    }
    if (M <= 0) { fouten.push(nr + 1); return; }
    teksten.set(M, teksten.has(M) ? `${teksten.get(M)}\n${m[2].trim()}` : m[2].trim());
  });
  return { teksten, fouten };
}

// ---- instellingen --------------------------------------------------------------------------

const STANDAARD = {
  namen: 'Wat je goed kunt\nWat je graag doet\nWaar vraag naar is',
  teksten: '1+2: Passie\n1+3: Beroep\n2+3: Roeping\nalle: Jouw plek',
  palet: 'fris', menging: 'mengen', kracht: 55, randen: 'geen', maat: 70, overlap: 38, grootte: 10, namenPlek: 'buiten',
};

// ---- bouwen ---------------------------------------------------------------------------------------

function bouw(w, doc, cmyk) {
  const namen = w.namen.split(/\r?\n/).map((n) => n.trim()).filter(Boolean);
  if (namen.length < 2) return { fout: 'Typ twee, drie of vier namen van verzamelingen, één per regel.' };
  if (namen.length > 4) return { fout: `Dat zijn ${namen.length} namen; een Venn-diagram heeft er hier hooguit vier.` };
  const n = namen.length;
  const { teksten, fouten } = leesTeksten(w.teksten, namen);
  const R = vexel.mm(w.maat) / 2;
  const E = opstelling(n, R, w.overlap / 100);
  const vl = vlakken(E);
  const mid = middens(E);
  const s = w.grootte;

  // kleuren: elke verzameling een tint; in een overlap tellen de tinten op (als overdruk) of vermenigvuldigen (RGB)
  const t = 1 - w.kracht / 100;
  const tinten = namen.map((_, i) => lichter({ ...paletKleur(w.palet, i), naam: '' }, t));
  const volle = namen.map((_, i) => paletKleur(w.palet, i));
  const meng = (M) => {
    const leden = tinten.filter((_, i) => M & (1 << i));
    const c = [0, 1, 2, 3].map((k) => 100 * (1 - leden.reduce((p, l) => p * (1 - l.cmyk[k] / 100), 1)));
    const rgb = [0, 1, 2].map((k) => 255 * leden.reduce((p, l) => p * (hexNaarRgb(l.hex)[k] / 255), 1));
    return { cmyk: c, hex: rgbNaarHex(rgb) };
  };
  const naamVan = (M) => {
    const leden = namen.filter((_, i) => M & (1 << i));
    if (leden.length === n && n > 2) return 'Alle';
    return leden.length === 1 ? `Alleen ${leden[0]}` : leden.join(' + ');
  };

  const kinderen = [];
  const vlakVormen = [];
  if (w.menging === 'mengen') {
    for (const [M, subpaden] of [...vl.entries()].sort((a, b) => a[0] - b[0])) {
      const k = meng(M);
      vlakVormen.push({ soort: 'pad', naam: naamVan(M).slice(0, 100), subpaden, vulregel: 'evenodd', vulling: kleur(k.cmyk, k.hex, cmyk), lijn: null });
    }
    kinderen.push({ soort: 'groep', naam: 'Vlakken', kinderen: vlakVormen });
  } else {
    kinderen.push({
      soort: 'groep', naam: 'Verzamelingen', kinderen: E.map((e, i) => ({
        soort: 'pad', naam: namen[i].slice(0, 100), subpaden: [{ gesloten: true, punten: sluitPunten(randStuk(e, 0, TAU)) }],
        vulling: kleur(volle[i].cmyk, volle[i].hex, cmyk), dekking: Math.max(0.15, Math.min(0.9, w.kracht / 100 * 0.75)), lijn: null,
      })),
    });
  }
  if (w.randen !== 'geen') {
    kinderen.push({
      soort: 'groep', naam: 'Randen', kinderen: E.map((e, i) => ({
        soort: 'pad', naam: `Rand ${namen[i]}`.slice(0, 100), subpaden: [{ gesloten: true, punten: sluitPunten(randStuk(e, 0, TAU)) }],
        vulling: null, lijn: w.randen === 'wit' ? kleur([0, 0, 0, 0], '#ffffff', cmyk) : kleur(volle[i].cmyk, volle[i].hex, cmyk),
        lijndikte: Math.max(0.75, R * 0.012),
      })),
    });
  }

  // teksten per vlak, zo groot als erin past (tot 60% van de gekozen grootte)
  let krap = 0;
  const tekstVormen = [];
  const naamGrootte = s * 1.2;
  const binnenNamen = w.namenPlek === 'binnen';
  for (let M = 1; M < 1 << n; M++) {
    const enkel = (M & (M - 1)) === 0;
    const plek = mid.get(M);
    let inhoud = teksten.get(M) || '';
    const naamHier = binnenNamen && enkel ? namen[Math.log2(M)] : '';
    if ((!inhoud && !naamHier) || !plek) { if (inhoud) krap++; continue; }
    const achter = w.menging === 'mengen' ? meng(M) : { hex: '#ffffff', cmyk: [0, 0, 0, 0] };
    const kleurTekst = tekstOp(achter);
    let g = s, regels = [], naamRegels = [], hoog = 0;
    for (; g >= s * 0.6; g *= 0.92) {
      const breed = plek.r * 1.6;
      naamRegels = naamHier ? breekNetjes(naamHier, breed, g * 1.15, 700) : [];
      regels = inhoud ? breekNetjes(inhoud, breed, g, M === (1 << n) - 1 ? 700 : 500) : [];
      const b = Math.max(langsteRegel(naamRegels, g * 1.15, 700), langsteRegel(regels, g, 500) * 1.05);
      hoog = naamRegels.length * g * 1.15 * 1.2 + regels.length * g * 1.2;
      // past het blok binnen de cirkel om het midden?
      if (Math.hypot(b / 2, hoog / 2) <= plek.r * 0.98) break;
    }
    if (g < s * 0.6) { g = s * 0.6; krap++; }
    let y = plek.y - hoog / 2 + g * 0.95;
    if (naamRegels.length) {
      tekstVormen.push({
        soort: 'tekst', naam: `Naam ${naamHier}`.slice(0, 100), x: plek.x, y, inhoud: naamRegels.join('\n'), grootte: g * 1.15, gewicht: 700,
        regelafstand: g * 1.15 * 1.2, uitlijning: 'midden', vulling: kleur(kleurTekst.cmyk, kleurTekst.hex, cmyk), lijn: null,
      });
      y += naamRegels.length * g * 1.15 * 1.2;
    }
    if (regels.length) {
      tekstVormen.push({
        soort: 'tekst', naam: `Tekst ${naamVan(M)}`.slice(0, 100), x: plek.x, y, inhoud: regels.join('\n').slice(0, 10000), grootte: g,
        gewicht: M === (1 << n) - 1 ? 700 : 500, regelafstand: g * 1.2, uitlijning: 'midden', vulling: kleur(kleurTekst.cmyk, kleurTekst.hex, cmyk), lijn: null,
      });
    }
  }

  // namen buiten: bij twee en drie boven of onder elke cirkel, bij vier naar buiten vanaf het eigen vlak
  if (!binnenNamen) {
    const cx = E.reduce((t2, e) => t2 + e.x, 0) / n, cy = E.reduce((t2, e) => t2 + e.y, 0) / n;
    E.forEach((e, i) => {
      const regels = breekNetjes(namen[i], R * (n === 4 ? 1 : 1.5), naamGrootte, 700);
      const hoogte = regels.length * naamGrootte * 1.2;
      let x, y, uitlijning = 'midden';
      if (n === 4) {
        const p0 = mid.get(1 << i) || { x: e.x, y: e.y };
        let vx = p0.x - cx, vy = p0.y - cy;
        const l = Math.hypot(vx, vy) || 1; vx /= l; vy /= l;
        let p = { x: p0.x, y: p0.y };
        for (let k = 0; k < 400 && lidmaatschap(E, p.x, p.y); k++) p = { x: p.x + vx * R * 0.01, y: p.y + vy * R * 0.01 };
        const gat = naamGrootte * 0.6;
        if (Math.abs(vx) > Math.abs(vy) * 1.2) {
          uitlijning = vx < 0 ? 'rechts' : 'links';
          x = p.x + vx * gat; y = p.y - hoogte / 2 + naamGrootte * 0.85;
        } else {
          x = p.x; y = vy < 0 ? p.y - gat - hoogte + naamGrootte * 0.95 : p.y + gat + naamGrootte * 0.95;
        }
      } else {
        // het hoogste (of laagste) randpunt van de cirkel
        const omhoog = n === 3 ? e.y <= cy + 1e-6 : true;
        x = e.x;
        y = omhoog ? e.y - e.b - naamGrootte * 0.7 - hoogte + naamGrootte * 0.95 : e.y + e.b + naamGrootte * 0.7 + naamGrootte * 0.95;
      }
      const k = volle[i];
      tekstVormen.push({
        soort: 'tekst', naam: `Naam ${namen[i]}`.slice(0, 100), x, y, inhoud: regels.join('\n'), grootte: naamGrootte,
        gewicht: 700, regelafstand: naamGrootte * 1.2, uitlijning, vulling: kleur(k.cmyk, k.hex, cmyk), lijn: null,
      });
    });
  }
  if (tekstVormen.length) kinderen.push({ soort: 'groep', naam: 'Teksten', kinderen: tekstVormen });

  const waarschuwingen = [];
  if (fouten.length) waarschuwingen.push(`Regel ${fouten.slice(0, 3).join(', ')} van de teksten herken ik niet; schrijf bijvoorbeeld "1+2: tekst".`);
  if (krap) waarschuwingen.push(`${krap} ${krap === 1 ? 'tekst past' : 'teksten passen'} krap; maak ze korter of het diagram groter.`);
  return {
    vormen: [{ soort: 'groep', naam: 'Venn-diagram', kinderen }],
    samenvatting: `${n} verzamelingen, ${vl.size} vlakken, ${nl(w.maat)} mm ${n === 4 ? 'lang' : 'doorsnede'}.`,
    waarschuwingen, kleinsteLetter: s * 0.6, aantal: n,
  };
}

// ---- het venster --------------------------------------------------------------------------------

vexel.opCommando('maken', () => startVenster({
  standaard: STANDAARD,
  knop: 'Venn-diagram maken',
  voorbeeldHoogte: 220,
  marge: () => 10,
  melding: (u) => `Venn-diagram gemaakt met ${u.aantal} verzamelingen.`,
  bouw,
  velden(w0) {
    const namen = tekstVak('Verzamelingen', w0.namen, '', 76, 'Eén naam per regel (2 tot 4)');
    const teksten = tekstVak('Teksten in de vlakken', w0.teksten, 'Per regel: 1+2: tekst (nummers of namen), of alle: tekst voor het midden.', 62,
      '1+2: tekst');
    const palet = keuzeVeld(paletOpties(), w0.palet);
    const menging = keuzeVeld([['mengen', 'Overlap mengen'], ['doorzichtig', 'Doorzichtig']], w0.menging);
    const kracht = getalVeld(w0.kracht, 10, 100, 5);
    const randen = keuzeVeld([['geen', 'Geen'], ['kleur', 'In de kleur'], ['wit', 'Wit']], w0.randen);
    const maat = getalVeld(w0.maat, 10, 1000, 1);
    const overlap = getalVeld(w0.overlap, 15, 60, 1);
    const grootte = getalVeld(w0.grootte, 4, 72, 0.5);
    const namenPlek = keuzeVeld([['buiten', 'Buiten'], ['binnen', 'In het vlak']], w0.namenPlek);
    const overlapBlok = metLabel('Overlap', overlap, '%');
    const pasAan = () => { overlapBlok.style.visibility = namen.veld.value.split(/\n/).filter((r) => r.trim()).length >= 4 ? 'hidden' : 'visible'; };
    namen.veld.addEventListener('input', pasAan);
    pasAan();
    return {
      blokken: [
        namen.blok, teksten.blok,
        kolommen(3, metLabel('Kleuren', palet), metLabel('Weergave', menging), metLabel('Kleurkracht', kracht, '%')),
        kolommen(3, metLabel('Doorsnede', maat, 'mm'), overlapBlok, metLabel('Randen', randen)),
        kolommen(3, metLabel('Letter', grootte, 'pt'), metLabel('Namen', namenPlek), maak('span')),
      ],
      focus: namen.veld,
      waarden: () => ({
        namen: namen.veld.value.slice(0, 2000), teksten: teksten.veld.value.slice(0, 10000), palet: palet.value, menging: menging.value,
        kracht: begrens(leesGetal(kracht, 55), 10, 100), randen: randen.value, maat: begrens(leesGetal(maat, 70), 10, 1000),
        overlap: begrens(leesGetal(overlap, 38), 15, 60), grootte: begrens(leesGetal(grootte, 10), 4, 72), namenPlek: namenPlek.value,
      }),
    };
  },
}));
