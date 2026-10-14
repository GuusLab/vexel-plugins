// Perspectiefraster (1, 2 of 3 verdwijnpunten) en een plat pad op een perspectiefvlak zetten.
// Eigen werk van GuusLab, MIT-licentie.
'use strict';

// ---- algemene hulpjes -------------------------------------------------------

function maak(tag, opties = {}, ...kinderen) {
  const el = document.createElement(tag);
  for (const [sleutel, waarde] of Object.entries(opties)) {
    if (sleutel === 'klasse') el.className = waarde;
    else if (sleutel === 'tekst') el.textContent = waarde;
    else if (sleutel === 'stijl') Object.assign(el.style, waarde);
    else if (sleutel.startsWith('bij')) el.addEventListener(sleutel.slice(3).toLowerCase(), waarde);
    else el.setAttribute(sleutel, String(waarde));
  }
  for (const kind of kinderen) if (kind) el.append(kind);
  return el;
}

const leesGetal = (veld, terugval) => {
  const n = Number(String(veld.value).replace(',', '.'));
  return Number.isFinite(n) ? n : terugval;
};
const begrens = (n, min, max) => Math.min(max, Math.max(min, n));
const getal = (n, cijfers = 1) => n.toLocaleString('nl-NL', { maximumFractionDigits: cijfers });
const css = (naam, terugval) => getComputedStyle(document.documentElement).getPropertyValue(naam).trim() || terugval;
const PT_NAAR_MM = 25.4 / 72;
const mmVan = (pt, cijfers = 0) => getal(pt * PT_NAAR_MM, cijfers);
const graden = (g) => (g * Math.PI) / 180;

// ---- willekeur met een zaadje ----------------------------------------------

/** Een reproduceerbare reeks getallen tussen 0 en 1 (mulberry32). */
function willekeur(zaad) {
  let a = (Math.floor(zaad) >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const nieuwZaad = () => 1 + Math.floor(Math.random() * 99998);

// ---- kleuren ----------------------------------------------------------------

function hexNaarRgb(hex) {
  const h = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  const n = h ? parseInt(h[1], 16) : 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const rgbNaarHex = (r, g, b) => '#' + [r, g, b].map((v) => Math.round(begrens(v, 0, 255)).toString(16).padStart(2, '0')).join('');
const geldigHex = (hex) => /^#[0-9a-f]{6}$/i.test(String(hex || ''));

/** Eenvoudige omrekening naar CMYK (procenten), goed genoeg als startpunt voor drukwerk. */
function hexNaarCmyk(hex) {
  const [r, g, b] = hexNaarRgb(hex).map((v) => v / 255);
  const k = 1 - Math.max(r, g, b);
  if (k >= 0.999) return [0, 0, 0, 100];
  const c = (1 - r - k) / (1 - k);
  const m = (1 - g - k) / (1 - k);
  const y = (1 - b - k) / (1 - k);
  return [c, m, y, k].map((v) => Math.round(begrens(v * 100, 0, 100)));
}
function cmykNaarHex(cmyk) {
  const [c, m, y, k] = cmyk.map((v) => v / 100);
  return rgbNaarHex(255 * (1 - c) * (1 - k), 255 * (1 - m) * (1 - k), 255 * (1 - y) * (1 - k));
}
function mengHex(a, b, t) {
  const p = hexNaarRgb(a);
  const q = hexNaarRgb(b);
  return rgbNaarHex(p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t);
}
const lichter = (hex, t) => mengHex(hex, '#ffffff', t);
const donkerder = (hex, t) => mengHex(hex, '#000000', t);
/** Helderheid 0 (zwart) tot 1 (wit). */
function helderheid(hex) {
  const [r, g, b] = hexNaarRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}
/** Een kleur voor Vexel: CMYK in een CMYK-document, anders hex. */
const kleurVoor = (hex, cmyk) => (cmyk ? { cmyk: hexNaarCmyk(hex) } : { hex: String(hex).toLowerCase() });
const kleurCss = (k) => (!k ? null : k.hex ? k.hex : k.cmyk ? cmykNaarHex(k.cmyk) : '#888888');

// ---- geometrie --------------------------------------------------------------

const BOOG = 0.5522847498; // handvatlengte voor een kwartcirkel als bezier

/** Een ellips als subpad met vier punten, met de klok mee (y omlaag). */
function cirkelSubpad(cx, cy, rx, ry = rx, andersom = false) {
  const ox = rx * BOOG;
  const oy = ry * BOOG;
  const punten = [
    { x: cx + rx, y: cy, in: { x: cx + rx, y: cy - oy }, uit: { x: cx + rx, y: cy + oy } },
    { x: cx, y: cy + ry, in: { x: cx + ox, y: cy + ry }, uit: { x: cx - ox, y: cy + ry } },
    { x: cx - rx, y: cy, in: { x: cx - rx, y: cy + oy }, uit: { x: cx - rx, y: cy - oy } },
    { x: cx, y: cy - ry, in: { x: cx - ox, y: cy - ry }, uit: { x: cx + ox, y: cy - ry } },
  ];
  return { gesloten: true, punten: andersom ? keerOm(punten) : punten };
}

/** Keert de richting van een rij punten om (in en uit wisselen mee). */
function keerOm(punten) {
  return punten.slice().reverse().map((p) => {
    const q = { x: p.x, y: p.y };
    if (p.uit) q.in = p.uit;
    if (p.in) q.uit = p.in;
    return q;
  });
}

/** Past een functie toe op elk punt en handvat van een lijst subpaden. */
function zetOm(subpaden, f) {
  return subpaden.map((sp) => ({
    gesloten: sp.gesloten,
    punten: sp.punten.map((p) => {
      const q = f(p);
      if (p.in) q.in = f(p.in);
      if (p.uit) q.uit = f(p.uit);
      return q;
    }),
  }));
}

/** Draaien (graden, met de klok mee) en verschuiven, als functie op een punt. */
function draaiVerschuif(hoekGraden, dx, dy, cx = 0, cy = 0) {
  const c = Math.cos(graden(hoekGraden));
  const s = Math.sin(graden(hoekGraden));
  return (p) => ({ x: cx + (p.x - cx) * c - (p.y - cy) * s + dx, y: cy + (p.x - cx) * s + (p.y - cy) * c + dy });
}

/** Rondt alle coördinaten af op 0,01 pt: kleinere bestanden, geen zichtbaar verschil. */
function rond(subpaden) {
  const r = (v) => Math.round(v * 100) / 100;
  return zetOm(subpaden, (p) => ({ x: r(p.x), y: r(p.y) }));
}

/**
 * Bouwt een gesloten omtrek uit stukken. Elk stuk is een rij punten die vloeiend
 * (Catmull-Rom) verbonden wordt, of recht als `recht` aan staat. Tussen twee stukken
 * is een scherpe hoek; het laatste punt van een stuk is het eerste van het volgende.
 */
function omtrekUitStukken(stukken, gesloten = true) {
  const uit = [];
  stukken.forEach((stuk) => {
    const pt = stuk.punten;
    const n = pt.length;
    pt.forEach((p, i) => {
      const q = { x: p.x, y: p.y };
      if (!stuk.recht && n > 2) {
        const a = pt[Math.max(0, i - 1)];
        const b = pt[Math.min(n - 1, i + 1)];
        const dx = (b.x - a.x) / 6;
        const dy = (b.y - a.y) / 6;
        if (i > 0) q.in = { x: p.x - dx * (i === n - 1 ? 2 : 1), y: p.y - dy * (i === n - 1 ? 2 : 1) };
        if (i < n - 1) q.uit = { x: p.x + dx * (i === 0 ? 2 : 1), y: p.y + dy * (i === 0 ? 2 : 1) };
      }
      const vorige = uit[uit.length - 1];
      if (i === 0 && vorige && Math.hypot(vorige.x - q.x, vorige.y - q.y) < 1e-6) {
        if (q.uit) vorige.uit = q.uit;
        return;
      }
      uit.push(q);
    });
  });
  if (gesloten && uit.length > 1) {
    const a = uit[0];
    const z = uit[uit.length - 1];
    if (Math.hypot(a.x - z.x, a.y - z.y) < 1e-6) {
      if (z.in) a.in = z.in;
      uit.pop();
    }
  }
  return { gesloten, punten: uit };
}

/** Telt vormen en punten zoals Vexel dat doet. */
function telVormen(vormen) {
  const t = { n: 0, p: 0, subpaden: 0 };
  const loop = (v) => {
    t.n += 1;
    if (v.soort === 'groep') v.kinderen.forEach(loop);
    if (v.soort === 'pad') {
      t.subpaden = Math.max(t.subpaden, v.subpaden.length);
      for (const sp of v.subpaden) t.p += sp.punten.length;
    }
  };
  vormen.forEach(loop);
  return t;
}

/** Verdeelt subpaden over paden van hooguit `max` subpaden (Vexel kent een grens per pad). */
function inStukken(subpaden, max = 1000) {
  const stukken = [];
  for (let i = 0; i < subpaden.length; i += max) stukken.push(subpaden.slice(i, i + max));
  return stukken;
}

/** Het kader van subpaden, inclusief de bolling van de bezierkrommen. */
function kaderVan(subpaden) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  const neem = (x, y) => {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  };
  for (const sp of subpaden) {
    const pt = sp.punten;
    if (!pt.length) continue;
    const eind = sp.gesloten ? pt.length : pt.length - 1;
    neem(pt[0].x, pt[0].y);
    for (let i = 1; i <= eind; i++) {
      const a = pt[i - 1];
      const b = pt[i % pt.length];
      const c1 = a.uit || a;
      const c2 = b.in || b;
      for (let s = 1; s <= 8; s++) {
        const t = s / 8;
        const u = 1 - t;
        neem(u * u * u * a.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * b.x,
          u * u * u * a.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * b.y);
      }
    }
  }
  if (!Number.isFinite(x0)) return null;
  return { x: x0, y: y0, b: x1 - x0, h: y1 - y0 };
}

/** Het kader van een lijst vormen (paden, ellipsen, rechthoeken, groepen; tekst ruw geschat). */
function kaderVanVormen(vormen) {
  const k = [];
  const loop = (v) => {
    if (v.soort === 'groep') v.kinderen.forEach(loop);
    else if (v.soort === 'pad') k.push(kaderVan(v.subpaden));
    else if (v.soort === 'rechthoek') k.push({ x: v.x, y: v.y, b: v.b, h: v.h });
    else if (v.soort === 'ellips') k.push({ x: v.cx - v.rx, y: v.cy - v.ry, b: 2 * v.rx, h: 2 * v.ry });
    else if (v.soort === 'tekst') k.push({ x: v.x - v.grootte, y: v.y - v.grootte, b: 2 * v.grootte, h: 1.3 * v.grootte });
  };
  vormen.forEach(loop);
  return verenigKaders(k);
}

function verenigKaders(lijst) {
  const k = lijst.filter((q) => q && Number.isFinite(q.x));
  if (!k.length) return null;
  const x = Math.min(...k.map((q) => q.x));
  const y = Math.min(...k.map((q) => q.y));
  return { x, y, b: Math.max(...k.map((q) => q.x + q.b)) - x, h: Math.max(...k.map((q) => q.y + q.h)) - y };
}

/** Het omsluitende kader van een selectie, of null. */
function selectieKader(items) {
  return verenigKaders((items || []).map((o) => o.kader).filter((q) => q && q.b >= 0 && q.h >= 0));
}

// ---- tekst meten --------------------------------------------------------------

let meetDoek = null;
/** Breedte van een regel tekst in pt bij een gegeven grootte en gewicht (geschat met het venster-lettertype). */
function tekstBreedte(regel, grootte, gewicht = 400, letterafstand = 0) {
  if (!meetDoek) meetDoek = document.createElement('canvas').getContext('2d');
  meetDoek.font = `${gewicht} 100px Inter, system-ui, -apple-system, sans-serif`;
  const b = meetDoek.measureText(regel).width / 100;
  return (b + ([...regel].length * letterafstand) / 1000) * grootte;
}

// ---- tekenen op een canvas (dezelfde vormen als in Vexel) ------------------

function padVan(v) {
  const p = new Path2D();
  if (v.soort === 'rechthoek') p.rect(v.x, v.y, v.b, v.h);
  else if (v.soort === 'ellips') p.ellipse(v.cx, v.cy, v.rx, v.ry, 0, 0, Math.PI * 2);
  else if (v.soort === 'pad') {
    for (const sp of v.subpaden) {
      const pt = sp.punten;
      if (!pt.length) continue;
      p.moveTo(pt[0].x, pt[0].y);
      const eind = sp.gesloten ? pt.length : pt.length - 1;
      for (let i = 1; i <= eind; i++) {
        const a = pt[i - 1];
        const b = pt[i % pt.length];
        const c1 = a.uit || a;
        const c2 = b.in || b;
        p.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, b.x, b.y);
      }
      if (sp.gesloten) p.closePath();
    }
  }
  return p;
}

function tekenVormen(g, vormen, minLijn = 0) {
  for (const v of vormen) {
    if (v.zichtbaar === false) continue;
    if (v.soort === 'groep') {
      tekenVormen(g, v.kinderen, minLijn);
      continue;
    }
    g.globalAlpha = v.dekking === undefined ? 1 : v.dekking;
    if (v.soort === 'tekst') {
      const grootte = v.grootte || 12;
      g.font = `${v.gewicht || 400} ${grootte}px Inter, system-ui, -apple-system, sans-serif`;
      g.textAlign = { midden: 'center', rechts: 'right' }[v.uitlijning] || 'left';
      g.textBaseline = 'alphabetic';
      if ('letterSpacing' in g) g.letterSpacing = `${((v.letterafstand || 0) / 1000) * grootte}px`;
      g.fillStyle = kleurCss(v.vulling) || '#000000';
      g.save();
      if (v.draai) {
        g.translate(v.x, v.y);
        g.rotate(graden(v.draai));
        g.translate(-v.x, -v.y);
      }
      String(v.inhoud).split('\n').forEach((regel, i) => g.fillText(regel, v.x, v.y + i * (v.regelafstand || grootte * 1.2)));
      g.restore();
      if ('letterSpacing' in g) g.letterSpacing = '0px';
      continue;
    }
    const pad = padVan(v);
    const vulling = kleurCss(v.vulling);
    const lijn = kleurCss(v.lijn);
    if (vulling) {
      g.fillStyle = vulling;
      g.fill(pad, v.vulregel === 'evenodd' ? 'evenodd' : 'nonzero');
    }
    if (lijn && v.lijndikte > 0) {
      g.strokeStyle = lijn;
      g.lineWidth = Math.max(v.lijndikte, minLijn);
      g.lineCap = v.lijneinde || 'butt';
      g.lineJoin = v.lijnhoek || 'miter';
      g.setLineDash(v.streep || []);
      g.stroke(pad);
      g.setLineDash([]);
    }
  }
  g.globalAlpha = 1;
}

/** Een canvas met de juiste resolutie voor scherpe lijnen. */
function maakDoek(breedte, hoogte) {
  const doek = maak('canvas', {
    'aria-hidden': 'true',
    stijl: { width: `${breedte}px`, height: `${hoogte}px`, display: 'block', borderRadius: '8px', flex: 'none' },
  });
  const schaal = Math.max(1, Math.min(3, devicePixelRatio || 1));
  doek.width = Math.round(breedte * schaal);
  doek.height = Math.round(hoogte * schaal);
  doek.maat = { b: breedte, h: hoogte, schaal };
  return doek;
}

/**
 * Tekent vormen geschaald in het canvas.
 * kader: het deel van de tekening dat in beeld moet (pt).
 * vel: optioneel het tekengebied, als wit vel met schaduw.
 * onder/boven: extra tekenfuncties (g, f) voor en na de vormen, in pt-coördinaten.
 */
function tekenVoorbeeld(doek, { kader, vormen, vel = null, marge = 16, ondergrond = null, minLijn = 0, onder = null, boven = null, knip = false }) {
  const { b, h, schaal } = doek.maat;
  const g = doek.getContext('2d');
  g.setTransform(schaal, 0, 0, schaal, 0, 0);
  g.clearRect(0, 0, b, h);
  g.fillStyle = ondergrond || css('--bg-2', '#24262c');
  g.fillRect(0, 0, b, h);
  if (!kader || !(kader.b > 0) || !(kader.h > 0)) return null;
  const f = Math.min((b - 2 * marge) / kader.b, (h - 2 * marge) / kader.h);
  const ox = (b - kader.b * f) / 2 - kader.x * f;
  const oy = (h - kader.h * f) / 2 - kader.y * f;
  g.save();
  g.setTransform(schaal * f, 0, 0, schaal * f, schaal * ox, schaal * oy);
  if (vel) {
    g.save();
    g.shadowColor = 'rgba(0, 0, 0, 0.35)';
    g.shadowBlur = 14 * schaal;
    g.shadowOffsetY = 3 * schaal;
    g.fillStyle = '#ffffff';
    g.fillRect(vel.x, vel.y, vel.b, vel.h);
    g.restore();
    if (knip) {
      g.beginPath();
      g.rect(vel.x, vel.y, vel.b, vel.h);
      g.clip();
    }
  }
  if (onder) onder(g, f);
  tekenVormen(g, vormen, minLijn / f);
  if (boven) boven(g, f);
  g.restore();
  return { f, ox, oy };
}

// ---- het venster ------------------------------------------------------------

const STIJL = `
  .venster { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 16px; align-items: start; }
  .venster .links { display: grid; gap: 8px; }
  .venster .rechts { display: grid; gap: 0; min-width: 0; }
  .venster .rij { margin: 0 0 7px; min-height: 26px; }
  .venster .label { min-width: 92px; }
  .venster .kop { margin: 6px 0 8px; font-size: 10.5px; letter-spacing: 0.06em; text-transform: uppercase;
    color: var(--tekst-zacht); opacity: 0.75; }
  .venster .kop:first-child { margin-top: 0; }
  .venster input[type=range] { flex: 1 1 0; width: 0; min-width: 0; margin: 0; }
  .venster .rechts > * { min-width: 0; }
  .venster .rij > .veld { min-width: 0; }
  .venster .rij > select.veld, .venster .rij > textarea.veld, .venster .rij > input[type=text].veld { flex: 1 1 0; width: 0; }
  .venster output { min-width: 40px; text-align: right; font-variant-numeric: tabular-nums; }
  .venster .eenheid { min-width: 22px; }
  .venster .veld.kort { width: 64px; flex: none; }
  .venster .tussen { color: var(--tekst-zacht); }
  .stalen { display: flex; gap: 6px; flex: 1; align-items: center; }
  .stalen input[type=color] { width: 26px; height: 26px; padding: 0; border: 1px solid var(--lijn);
    border-radius: 6px; background: none; cursor: pointer; flex: none; }
  .stalen input[type=color]::-webkit-color-swatch-wrapper { padding: 2px; }
  .stalen input[type=color]::-webkit-color-swatch { border: none; border-radius: 4px; }
  .samenvatting { margin: 0; min-height: 17px; }
  .samenvatting.fout { color: var(--rood, #ff6b6b); }
  .onderbalk { display: flex; align-items: center; gap: 8px; margin-top: 12px; }
  .onderbalk .samenvatting { flex: 1; }
  .variant { display: flex; gap: 6px; align-items: center; flex: 1; }
  .variant .veld { width: 74px; flex: none; }
  .vink { display: flex; align-items: center; gap: 6px; color: var(--tekst); }
  .soorten { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; }
  .soorten button { min-width: 0; height: 46px; padding: 3px; border: 1px solid var(--lijn); border-radius: 7px;
    background: var(--bg-2); cursor: pointer; display: grid; place-items: center; }
  .soorten button[aria-pressed=true] { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent) inset; }
  .soorten canvas { pointer-events: none; }
`;

/** Een rij met een label links en de velden rechts. */
function rij(labelTekst, ...inhoud) {
  const velden = inhoud.filter((el) => el && ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(el.tagName));
  const tag = velden.length === 1 ? 'label' : 'div';
  return maak(tag, { klasse: 'rij' }, maak('span', { klasse: 'label', tekst: labelTekst }), ...inhoud);
}

function getalVeld(waarde, min, max, stap, kort = false) {
  return maak('input', { klasse: kort ? 'veld kort' : 'veld', type: 'number', value: waarde, min, max, step: stap, inputmode: 'decimal' });
}

function eenheid(tekst) {
  return maak('span', { klasse: 'uitleg eenheid', tekst });
}

function keuzeVeld(opties, waarde) {
  const veld = maak('select', { klasse: 'veld' }, ...opties.map(([w, t]) => maak('option', { value: w, tekst: t })));
  veld.value = opties.some(([w]) => w === waarde) ? waarde : opties[0][0];
  return veld;
}

/** Een schuif met de waarde ernaast; `opmaak` maakt van het getal een tekst. */
function schuif(waarde, min, max, stap, opmaak = (n) => getal(n)) {
  const invoer = maak('input', { type: 'range', min, max, step: stap, value: waarde });
  const uitkomst = maak('output', { klasse: 'uitleg' });
  const toon = () => {
    uitkomst.textContent = opmaak(Number(invoer.value));
  };
  invoer.addEventListener('input', toon);
  invoer.addEventListener('change', toon);
  toon();
  return { invoer, uitkomst, delen: [invoer, uitkomst], zet: (w) => { invoer.value = String(w); toon(); } };
}

function vinkje(tekst, aan) {
  const invoer = maak('input', { type: 'checkbox' });
  invoer.checked = !!aan;
  return { invoer, blok: maak('label', { klasse: 'vink' }, invoer, maak('span', { tekst })) };
}

function kleurVak(waarde, titel) {
  return maak('input', { type: 'color', value: geldigHex(waarde) ? waarde : '#888888', title: titel });
}

/**
 * Een rij knoppen met een klein plaatje per soort. `tekenIcoon(g, sleutel, b, h)` tekent het plaatje.
 * Geeft { blok, waarde(), zet(w) }.
 */
function soortKiezer(soorten, waarde, tekenIcoon, bijWijziging, kolommen = 4) {
  const blok = maak('div', { klasse: 'soorten', role: 'group', stijl: { gridTemplateColumns: `repeat(${kolommen}, minmax(0, 1fr))` } });
  let gekozen = soorten.some(([s]) => s === waarde) ? waarde : soorten[0][0];
  const knoppen = soorten.map(([sleutel, titel]) => {
    const doek = maakDoek(40, 32);
    const knop = maak('button', { type: 'button', title: titel, 'aria-label': titel, 'aria-pressed': String(sleutel === gekozen) }, doek);
    knop.addEventListener('click', () => {
      gekozen = sleutel;
      knoppen.forEach((k) => k.knop.setAttribute('aria-pressed', String(k.sleutel === gekozen)));
      bijWijziging();
    });
    blok.append(knop);
    return { knop, doek, sleutel };
  });
  const tekenAlle = () => {
    for (const { doek, sleutel } of knoppen) {
      const g = doek.getContext('2d');
      const s = doek.maat.schaal;
      g.setTransform(s, 0, 0, s, 0, 0);
      g.clearRect(0, 0, 40, 32);
      tekenIcoon(g, sleutel, 40, 32);
    }
  };
  tekenAlle();
  return { blok, waarde: () => gekozen, tekenAlle };
}

/** Variant-veld met een knop die een nieuw zaadje kiest. */
function variantKiezer(zaad, knopTekst, bijWijziging) {
  const veld = maak('input', { klasse: 'veld', type: 'number', min: 1, max: 99999, step: 1, value: zaad, title: 'Variant (zaadje)' });
  const knop = maak('button', { klasse: 'knop', type: 'button', tekst: knopTekst });
  knop.addEventListener('click', () => {
    veld.value = String(nieuwZaad());
    bijWijziging();
  });
  return { veld, knop, blok: maak('div', { klasse: 'variant' }, veld, knop), waarde: () => Math.round(begrens(leesGetal(veld, 1), 1, 99999)) };
}

/**
 * Bouwt het standaardvenster: links het voorbeeld (en wat eronder hoort), rechts de velden,
 * onderaan de samenvatting en de knoppen.
 */
function bouwVenster({ links, rechts, maakTekst }) {
  document.head.append(maak('style', { tekst: STIJL }));
  const samenvatting = maak('p', { klasse: 'uitleg samenvatting', 'aria-live': 'polite' });
  const maakKnop = maak('button', { klasse: 'knop primair', type: 'submit', tekst: maakTekst });
  const annuleer = maak('button', { klasse: 'knop', type: 'button', tekst: 'Annuleren', bijClick: () => vexel.sluit() });
  const formulier = maak('form', { novalidate: '' },
    maak('div', { klasse: 'venster' },
      maak('div', { klasse: 'links' }, ...links),
      maak('div', { klasse: 'rechts' }, ...rechts)),
    maak('div', { klasse: 'onderbalk' }, samenvatting, annuleer, maakKnop));
  document.body.append(formulier);
  return { formulier, samenvatting, maakKnop };
}

/** Roept `teken` hooguit één keer per beeldje aan. */
function planner(teken) {
  let gepland = false;
  return () => {
    if (gepland) return;
    gepland = true;
    requestAnimationFrame(() => {
      gepland = false;
      teken();
    });
  };
}

/** Zet de samenvatting en schakelt de maakknop, met een duidelijke reden als het niet kan. */
function toonStatus(venster, doc, tekst, fout) {
  const { samenvatting, maakKnop } = venster;
  const reden = doc.alleenLezen ? 'Dit document is alleen-lezen: maak een kopie om hierin te tekenen.' : fout;
  samenvatting.textContent = reden || tekst;
  samenvatting.classList.toggle('fout', !!reden);
  maakKnop.disabled = !!reden;
}

/** Maakt de vormen in Vexel, bewaart de instellingen en sluit het venster. */
async function maakInVexel(venster, vormen, { instellingen, sleutel = 'instellingen', melding, opties }) {
  const t = telVormen(vormen);
  if (t.n > 5000 || t.p > 50000) {
    vexel.melding(`Dat is te veel in één keer (${getal(t.n, 0)} vormen, ${getal(t.p, 0)} punten). Kies minder of grotere elementen.`, 'let');
    return;
  }
  venster.maakKnop.disabled = true;
  try {
    await vexel.maak(vormen, opties);
    await vexel.bewaar(sleutel, instellingen);
    vexel.melding(melding, 'ok');
    vexel.sluit();
  } catch (fout) {
    venster.maakKnop.disabled = false;
    vexel.melding(fout && fout.message ? fout.message : 'Dat lukte niet. Probeer het nog eens.', 'fout');
  }
}

/** Leest de selectie zonder te struikelen als het recht ontbreekt of er iets misgaat. */
async function leesSelectie() {
  try {
    return (await vexel.selectie()) || [];
  } catch (fout) {
    return [];
  }
}

// ---- gedeelde instellingen ---------------------------------------------------------------

/** Standaardwaarden in procenten van het tekengebied, zodat ze op elk formaat goed uitkomen. */
function standaardRaster(doc) {
  const B = vexel.naarMm(doc.tekengebied.b);
  const H = vexel.naarMm(doc.tekengebied.h);
  const r = (n) => Math.round(n);
  return {
    soort: 2, horizon: r(H * 0.42), vp1: r(-B * 0.25), vp2: r(B * 1.25), vp3: r(H * 1.9), vpMidden: r(B / 2),
    stralen: 24, verticalen: 12, diepte: 8, dikte: 0.1, dekking: 80,
    kleur1: '#ff7b7b', kleur2: '#5aa2ff', kleur3: '#3fbf7f', kleurHorizon: '#ff9f1c',
  };
}

/** De verdwijnpunten in pt. */
function verdwijnpunten(w) {
  const y = vexel.mm(w.horizon);
  if (w.soort === 1) return [{ x: vexel.mm(w.vpMidden), y }];
  const vps = [{ x: vexel.mm(w.vp1), y }, { x: vexel.mm(w.vp2), y }];
  if (w.soort === 3) vps.push({ x: (vps[0].x + vps[1].x) / 2, y: vexel.mm(w.vp3) });
  return vps;
}

/** Snijdt de straal p + t·v (t ≥ 0) bij met de rechthoek [0, B] × [0, H]. */
function knipStraal(p, v, B, H) {
  let t0 = 0;
  let t1 = Infinity;
  const randen = [[-v.x, p.x], [v.x, B - p.x], [-v.y, p.y], [v.y, H - p.y]];
  for (const [q, r] of randen) {
    if (Math.abs(q) < 1e-12) {
      if (r < 0) return null;
      continue;
    }
    const t = r / q;
    if (q < 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
  }
  if (!(t1 > t0) || !Number.isFinite(t1)) return null;
  const r2 = (n) => Math.round(n * 100) / 100;
  return [{ x: r2(p.x + v.x * t0), y: r2(p.y + v.y * t0) }, { x: r2(p.x + v.x * t1), y: r2(p.y + v.y * t1) }];
}

/** Stralen vanuit een verdwijnpunt, gelijk verdeeld over de hoek waaronder het vel te zien is. */
function stralen(vp, n, B, H) {
  const binnen = vp.x > 0 && vp.x < B && vp.y > 0 && vp.y < H;
  let a0;
  let a1;
  if (binnen) {
    a0 = 0;
    a1 = Math.PI * 2 * (1 - 1 / n);
  } else {
    const midden = Math.atan2(H / 2 - vp.y, B / 2 - vp.x);
    const rel = [[0, 0], [B, 0], [0, H], [B, H]].map(([x, y]) => {
      let a = Math.atan2(y - vp.y, x - vp.x) - midden;
      while (a > Math.PI) a -= Math.PI * 2;
      while (a < -Math.PI) a += Math.PI * 2;
      return a;
    });
    const lo = Math.min(...rel);
    const hi = Math.max(...rel);
    // net binnen de hoeken, zodat er geen lijntje precies over een hoekpunt loopt
    const stap = (hi - lo) / n;
    a0 = midden + lo + stap / 2;
    a1 = midden + hi - stap / 2;
  }
  const lijnen = [];
  for (let i = 0; i < n; i++) {
    const a = n === 1 ? (a0 + a1) / 2 : a0 + ((a1 - a0) * i) / (n - 1);
    const stuk = knipStraal(vp, { x: Math.cos(a), y: Math.sin(a) }, B, H);
    if (stuk) lijnen.push({ gesloten: false, punten: stuk });
  }
  return lijnen;
}

function bouwRaster(w, B, H, cmyk) {
  const vps = verdwijnpunten(w);
  const stijl = (hex, dikte = 1) => ({ vulling: null, lijn: kleurVoor(hex, cmyk), lijndikte: vexel.mm(w.dikte) * dikte, dekking: w.dekking / 100 });
  const kinderen = [];
  const hy = vexel.mm(w.horizon);
  const kleuren = [w.kleur1, w.kleur2, w.kleur3];
  vps.forEach((vp, i) => {
    const lijnen = stralen(vp, w.stralen, B, H);
    if (lijnen.length) kinderen.push({ soort: 'pad', naam: `Stralen verdwijnpunt ${i + 1}`, subpaden: lijnen, ...stijl(kleuren[i]) });
  });
  if (w.soort === 2 && w.verticalen > 0) {
    const lijnen = [];
    for (let i = 1; i <= w.verticalen; i++) {
      const x = Math.round(((B * i) / (w.verticalen + 1)) * 100) / 100;
      lijnen.push({ gesloten: false, punten: [{ x, y: 0 }, { x, y: H }] });
    }
    kinderen.push({ soort: 'pad', naam: 'Verticalen', subpaden: lijnen, ...stijl(w.kleur3) });
  }
  if (w.soort === 1 && w.diepte > 0 && hy < H) {
    // dieptelijnen op de vloer: dichter bij elkaar naar de horizon toe
    const lijnen = [];
    const onder = H - Math.max(0, hy);
    for (let k = 0; k < w.diepte; k++) {
      const y = Math.max(0, hy) + onder / (1 + k * 0.45);
      if (y > 0 && y < H) lijnen.push({ gesloten: false, punten: [{ x: 0, y: Math.round(y * 100) / 100 }, { x: B, y: Math.round(y * 100) / 100 }] });
    }
    if (lijnen.length) kinderen.push({ soort: 'pad', naam: 'Dieptelijnen', subpaden: lijnen, ...stijl(w.kleur2) });
  }
  if (hy > 0 && hy < H) {
    kinderen.push({ soort: 'pad', naam: 'Horizon', subpaden: [{ gesloten: false, punten: [{ x: 0, y: hy }, { x: B, y: hy }] }], ...stijl(w.kleurHorizon, 2.5) });
  }
  const merken = [];
  vps.forEach((vp) => {
    if (vp.x < 0 || vp.x > B || vp.y < 0 || vp.y > H) return;
    const r = vexel.mm(1.6);
    merken.push(cirkelSubpad(vp.x, vp.y, r));
    merken.push({ gesloten: false, punten: [{ x: vp.x - r * 2, y: vp.y }, { x: vp.x + r * 2, y: vp.y }] });
    merken.push({ gesloten: false, punten: [{ x: vp.x, y: vp.y - r * 2 }, { x: vp.x, y: vp.y + r * 2 }] });
  });
  if (merken.length) kinderen.push({ soort: 'pad', naam: 'Verdwijnpunten', subpaden: rond(merken), ...stijl(w.kleurHorizon, 2.5), dekking: 1 });
  return kinderen;
}

// ---- tekenen van het overzicht (vel met verdwijnpunten erbuiten) ---------------------------

/** Een kader dat het vel en de verdwijnpunten toont, maar niet eindeloos ver uitzoomt. */
function overzichtKader(B, H, vps) {
  const max = Math.max(B, H) * 1.4;
  const xs = [0, B, ...vps.map((v) => begrens(v.x, -max, B + max))];
  const ys = [0, H, ...vps.map((v) => begrens(v.y, -max, H + max))];
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, b: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

function tekenVps(g, vps, f, kleur) {
  for (const vp of vps) {
    g.fillStyle = kleur;
    g.beginPath();
    g.arc(vp.x, vp.y, 3.2 / f, 0, Math.PI * 2);
    g.fill();
  }
}

// ---- venster: perspectiefraster ---------------------------------------------------------

async function toonRaster() {
  const doc = await vexel.document();
  const cmyk = doc.kleurruimte === 'cmyk';
  const B = doc.tekengebied.b;
  const H = doc.tekengebied.h;
  const w0 = { ...standaardRaster(doc), ...((await vexel.haal('raster')) || {}) };

  const plan = planner(() => teken());
  const doek = maakDoek(270, 290);
  const soort = keuzeVeld([['1', '1 verdwijnpunt'], ['2', '2 verdwijnpunten'], ['3', '3 verdwijnpunten']], String(w0.soort));
  const horizon = getalVeld(w0.horizon, -5000, 5000, 1, true);
  const vpMidden = getalVeld(w0.vpMidden, -5000, 5000, 1, true);
  const vp1 = getalVeld(w0.vp1, -5000, 5000, 1, true);
  const vp2 = getalVeld(w0.vp2, -5000, 5000, 1, true);
  const vp3 = getalVeld(w0.vp3, -5000, 5000, 1, true);
  const aantal = schuif(w0.stralen, 6, 72, 2, (n) => String(n));
  const verticalen = schuif(w0.verticalen, 0, 40, 1, (n) => String(n));
  const diepte = schuif(w0.diepte, 0, 20, 1, (n) => String(n));
  const dikte = getalVeld(w0.dikte, 0.02, 2, 0.02, true);
  const dekking = schuif(w0.dekking, 10, 100, 5, (n) => `${n}%`);
  const kleur1 = kleurVak(w0.kleur1, 'Verdwijnpunt 1');
  const kleur2 = kleurVak(w0.kleur2, 'Verdwijnpunt 2');
  const kleur3 = kleurVak(w0.kleur3, 'Verdwijnpunt 3 en verticalen');
  const kleurH = kleurVak(w0.kleurHorizon, 'Horizon');

  const rijen = {
    midden: rij('Verdwijnpunt', vpMidden, eenheid('mm')),
    twee: rij('Punt 1 · punt 2', vp1, maak('span', { klasse: 'tussen', tekst: '·' }), vp2, eenheid('mm')),
    drie: rij('Punt 3 (hoogte)', vp3, eenheid('mm')),
    verticalen: rij('Verticalen', ...verticalen.delen),
    diepte: rij('Dieptelijnen', ...diepte.delen),
  };
  const venster = bouwVenster({
    maakTekst: 'Raster maken',
    links: [doek],
    rechts: [
      maak('div', { klasse: 'kop', tekst: 'Perspectief' }),
      rij('Soort', soort),
      rij('Horizon', horizon, eenheid('mm'), maak('span', { klasse: 'uitleg', tekst: 'vanaf boven' })),
      rijen.midden, rijen.twee, rijen.drie,
      maak('p', { klasse: 'uitleg', stijl: { margin: '-2px 0 8px' }, tekst: 'Posities vanaf de linkerbovenhoek; buiten het tekengebied mag.' }),
      maak('div', { klasse: 'kop', tekst: 'Lijnen' }),
      rij('Stralen per punt', ...aantal.delen),
      rijen.verticalen, rijen.diepte,
      rij('Dikte · dekking', dikte, eenheid('mm'), ...dekking.delen),
      rij('Kleuren', maak('div', { klasse: 'stalen' }, kleur1, kleur2, kleur3, kleurH)),
    ],
  });
  const waarden = () => ({
    soort: Number(soort.value) || 2,
    horizon: begrens(leesGetal(horizon, 120), -5000, 5000),
    vpMidden: begrens(leesGetal(vpMidden, 105), -5000, 5000),
    vp1: begrens(leesGetal(vp1, -50), -5000, 5000),
    vp2: begrens(leesGetal(vp2, 260), -5000, 5000),
    vp3: begrens(leesGetal(vp3, 560), -5000, 5000),
    stralen: Math.round(begrens(leesGetal(aantal.invoer, 24), 6, 72)),
    verticalen: Math.round(begrens(leesGetal(verticalen.invoer, 12), 0, 40)),
    diepte: Math.round(begrens(leesGetal(diepte.invoer, 8), 0, 20)),
    dikte: begrens(leesGetal(dikte, 0.1), 0.02, 2),
    dekking: begrens(leesGetal(dekking.invoer, 80), 10, 100),
    kleur1: kleur1.value, kleur2: kleur2.value, kleur3: kleur3.value, kleurHorizon: kleurH.value,
  });
  function teken() {
    const w = waarden();
    rijen.midden.style.display = rijen.diepte.style.display = w.soort === 1 ? '' : 'none';
    rijen.twee.style.display = w.soort === 1 ? 'none' : '';
    rijen.drie.style.display = w.soort === 3 ? '' : 'none';
    rijen.verticalen.style.display = w.soort === 2 ? '' : 'none';
    const vps = verdwijnpunten(w);
    let fout = null;
    if (w.soort > 1 && Math.abs(vps[0].x - vps[1].x) < vexel.mm(5)) fout = 'Zet de twee verdwijnpunten verder uit elkaar.';
    if (w.soort === 3 && Math.abs(vps[2].y - vps[0].y) < vexel.mm(5)) fout = 'Het derde verdwijnpunt moet ver boven of onder de horizon liggen.';
    const vormen = fout ? [] : bouwRaster(w, B, H, false);
    tekenVoorbeeld(doek, {
      kader: overzichtKader(B, H, vps), vel: { x: 0, y: 0, b: B, h: H }, vormen, ondergrond: '#cfd5df', marge: 14, minLijn: 0.6,
      boven: (g, f) => tekenVps(g, vps, f, w.kleurHorizon),
    });
    const n = vormen.reduce((s, v) => s + v.subpaden.length, 0);
    toonStatus(venster, doc, `${n} hulplijnen, ${w.soort}-punts perspectief, achteraan in de groep "Perspectiefraster".`, fout);
  }
  venster.formulier.addEventListener('input', plan);
  venster.formulier.addEventListener('change', plan);
  venster.formulier.addEventListener('submit', (gebeurtenis) => {
    gebeurtenis.preventDefault();
    if (venster.maakKnop.disabled) return;
    const w = waarden();
    const vormen = [{ soort: 'groep', naam: 'Perspectiefraster', kinderen: bouwRaster(w, B, H, cmyk) }];
    maakInVexel(venster, vormen, { instellingen: w, sleutel: 'raster', opties: { achteraan: true }, melding: 'Perspectiefraster gemaakt (achteraan).' });
  });
  teken();
}

// ---- projectieve vervorming ---------------------------------------------------------------

/** De afbeelding van het eenheidsvierkant op een vierhoek q[0..3] (linksboven, rechtsboven, rechtsonder, linksonder). */
function homografie(q) {
  const [p0, p1, p2, p3] = q;
  const sx = p0.x - p1.x + p2.x - p3.x;
  const sy = p0.y - p1.y + p2.y - p3.y;
  let a;
  let b;
  let d;
  let e;
  let g = 0;
  let h = 0;
  if (Math.abs(sx) < 1e-9 && Math.abs(sy) < 1e-9) {
    a = p1.x - p0.x; b = p3.x - p0.x; d = p1.y - p0.y; e = p3.y - p0.y;
  } else {
    const dx1 = p1.x - p2.x;
    const dx2 = p3.x - p2.x;
    const dy1 = p1.y - p2.y;
    const dy2 = p3.y - p2.y;
    const noemer = dx1 * dy2 - dx2 * dy1;
    g = (sx * dy2 - dx2 * sy) / noemer;
    h = (dx1 * sy - sx * dy1) / noemer;
    a = p1.x - p0.x + g * p1.x; b = p3.x - p0.x + h * p3.x;
    d = p1.y - p0.y + g * p1.y; e = p3.y - p0.y + h * p3.y;
  }
  const c = p0.x;
  const f = p0.y;
  return (u, v) => {
    const w = g * u + h * v + 1;
    return { x: (a * u + b * v + c) / w, y: (d * u + e * v + f) / w };
  };
}

function snijLijnen(p, q, r, s) {
  const d = (q.x - p.x) * (s.y - r.y) - (q.y - p.y) * (s.x - r.x);
  if (Math.abs(d) < 1e-9) return null;
  const t = ((r.x - p.x) * (s.y - r.y) - (r.y - p.y) * (s.x - r.x)) / d;
  return { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t };
}

/** De vierhoek waarop het kader k terechtkomt, of { fout }. */
function doelVierhoek(w, k) {
  const vps = verdwijnpunten(w);
  const lerp = (p, q, t) => ({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
  const f = w.dieptePct / 100;
  if (w.vlak === 'wand1' || w.vlak === 'wand2') {
    const V = vps[w.vlak === 'wand2' && vps[1] ? 1 : 0];
    const links = V.x < k.x + k.b / 2;
    const xn = links ? k.x + k.b : k.x;
    const afstand = Math.abs(xn - V.x);
    if (afstand < 1) return { fout: 'Het verdwijnpunt ligt precies op de rand van je selectie; schuif het wat op.' };
    const t = begrens((f * k.b) / afstand, 0.01, 0.95);
    const Nb = { x: xn, y: k.y };
    const No = { x: xn, y: k.y + k.h };
    const Fb = lerp(Nb, V, t);
    const Fo = lerp(No, V, t);
    return { q: links ? [Fb, Nb, No, Fo] : [Nb, Fb, Fo, No], vps: [V] };
  }
  if (w.soort === 1 || w.vlak === 'vloer1') {
    const V = vps[0];
    const boven = V.y < k.y + k.h / 2;
    const yn = boven ? k.y + k.h : k.y;
    const afstand = Math.abs(yn - V.y);
    if (afstand < 1) return { fout: 'De horizon loopt precies langs je selectie; schuif hem wat op.' };
    const t = begrens((f * k.h) / afstand, 0.01, 0.95);
    const Nl = { x: k.x, y: yn };
    const Nr = { x: k.x + k.b, y: yn };
    const Fl = lerp(Nl, V, t);
    const Fr = lerp(Nr, V, t);
    return { q: boven ? [Fl, Fr, Nr, Nl] : [Nl, Nr, Fr, Fl], vps: [V] };
  }
  // vloer of plafond tussen twee verdwijnpunten: het voorste hoekpunt midden onder de selectie
  const [V1, V2] = vps;
  const boven = V1.y < k.y + k.h / 2;
  const N = { x: k.x + k.b / 2, y: boven ? k.y + k.h : k.y };
  const s1 = begrens((f * k.b * 0.75) / Math.max(1, Math.hypot(V1.x - N.x, V1.y - N.y)), 0.01, 0.9);
  const s2 = begrens((f * k.h * 0.75) / Math.max(1, Math.hypot(V2.x - N.x, V2.y - N.y)), 0.01, 0.9);
  const A = lerp(N, V1, s1);
  const Bp = lerp(N, V2, s2);
  const F = snijLijnen(A, V2, Bp, V1);
  if (!F) return { fout: 'Met deze verdwijnpunten lukt dat vlak niet; zet ze verder uit elkaar.' };
  return { q: boven ? [F, Bp, N, A] : [A, N, Bp, F], vps: [V1, V2] };
}

/** Knipt een bezierstuk in n gelijke delen (de Casteljau). */
function deelStuk(a, c1, c2, b, n) {
  const uit = [];
  let rest = [a, c1, c2, b];
  for (let i = n; i > 1; i--) {
    const t = 1 / i;
    const [p0, p1, p2, p3] = rest;
    const l = (p, q) => ({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
    const ab = l(p0, p1);
    const bc = l(p1, p2);
    const cd = l(p2, p3);
    const abc = l(ab, bc);
    const bcd = l(bc, cd);
    const m = l(abc, bcd);
    uit.push([p0, ab, abc, m]);
    rest = [m, bcd, cd, p3];
  }
  uit.push(rest);
  return uit;
}

/** Zet subpaden om met de vervorming; krommen worden eerst in stukjes geknipt, rechte lijnen blijven recht. */
function vervormSubpaden(subpaden, map) {
  return subpaden.map((sp) => {
    const pt = sp.punten;
    const n = pt.length;
    const uit = [];
    const eind = sp.gesloten ? n : n - 1;
    uit.push({ ...map(pt[0]) });
    for (let i = 1; i <= eind; i++) {
      const a = pt[i - 1];
      const b = pt[i % n];
      const recht = !a.uit && !b.in;
      const laatste = sp.gesloten && i === n;
      if (recht) {
        if (!laatste) uit.push({ ...map(b) });
        continue;
      }
      const stukken = deelStuk(a, a.uit || a, b.in || b, b, 4);
      stukken.forEach(([, c1, c2, p], j) => {
        uit[uit.length - 1].uit = map(c1);
        if (laatste && j === stukken.length - 1) {
          uit[0].in = map(c2);
        } else {
          uit.push({ ...map(p), in: map(c2) });
        }
      });
    }
    return { gesloten: sp.gesloten, punten: uit };
  });
}

/** Neemt een kleur uit de selectie over voor maak(); voor het voorbeeld alleen als hex. */
function kleurKopie(k, cmyk, echt) {
  if (!k) return null;
  const hex = k.hex || (k.cmyk ? cmykNaarHex(k.cmyk) : '#000000');
  if (!echt) return { hex };
  if (k.registratie) return { registratie: true };
  if (k.steunkleur) {
    const uit = { steunkleur: { naam: String(k.steunkleur.naam || k.steunkleur), cmyk: k.cmyk || hexNaarCmyk(hex) } };
    if (typeof k.tint === 'number') uit.tint = k.tint;
    return uit;
  }
  if (k.cmyk && (cmyk || !k.hex)) return { cmyk: k.cmyk.slice(0, 4) };
  return { hex };
}

const VLAKKEN = [
  ['wand1', 'Wand naar verdwijnpunt 1'],
  ['wand2', 'Wand naar verdwijnpunt 2'],
  ['vloer1', 'Vloer of plafond naar verdwijnpunt 1'],
  ['vloer', 'Vloer of plafond tussen beide punten'],
];

// ---- venster: vlak in perspectief ---------------------------------------------------------

async function toonVlak() {
  const doc = await vexel.document();
  const cmyk = doc.kleurruimte === 'cmyk';
  const B = doc.tekengebied.b;
  const H = doc.tekengebied.h;
  const alle = await leesSelectie();
  const paden = alle.filter((o) => (o.soort === 'pad' || o.soort === 'samengesteld') && Array.isArray(o.subpaden) && o.subpaden.length);
  const overgeslagen = alle.length - paden.length;
  const k = selectieKader(paden);
  const raster = { ...standaardRaster(doc), ...((await vexel.haal('raster')) || {}) };
  const w0 = { vlak: 'wand1', dieptePct: 100, ...((await vexel.haal('vlak')) || {}) };

  const plan = planner(() => teken());
  const doek = maakDoek(270, 290);
  const soort = keuzeVeld([['1', '1 verdwijnpunt'], ['2', '2 verdwijnpunten']], String(raster.soort === 1 ? 1 : 2));
  const vlak = keuzeVeld(VLAKKEN, w0.vlak);
  const diepte = schuif(w0.dieptePct, 10, 300, 5, (n) => `${n}%`);
  const horizon = getalVeld(raster.horizon, -5000, 5000, 1, true);
  const vpMidden = getalVeld(raster.vpMidden, -5000, 5000, 1, true);
  const vp1 = getalVeld(raster.vp1, -5000, 5000, 1, true);
  const vp2 = getalVeld(raster.vp2, -5000, 5000, 1, true);
  const rijen = {
    midden: rij('Verdwijnpunt', vpMidden, eenheid('mm')),
    twee: rij('Punt 1 · punt 2', vp1, maak('span', { klasse: 'tussen', tekst: '·' }), vp2, eenheid('mm')),
  };
  const venster = bouwVenster({
    maakTekst: 'In perspectief zetten',
    links: [doek],
    rechts: [
      maak('div', { klasse: 'kop', tekst: 'Vlak' }),
      rij('Op', vlak),
      rij('Diepte', ...diepte.delen),
      maak('p', { klasse: 'uitleg', stijl: { margin: '-2px 0 8px' },
        tekst: 'De rand die het verst van het verdwijnpunt ligt blijft staan; de rest wijkt naar achteren. Het origineel blijft bewaard.' }),
      maak('div', { klasse: 'kop', tekst: 'Verdwijnpunten' }),
      rij('Soort', soort),
      rij('Horizon', horizon, eenheid('mm'), maak('span', { klasse: 'uitleg', tekst: 'vanaf boven' })),
      rijen.midden, rijen.twee,
      maak('p', { klasse: 'uitleg', tekst: 'Dezelfde punten als in Perspectiefraster; ze worden samen onthouden.' }),
    ],
  });
  const waarden = () => ({
    ...raster,
    soort: Number(soort.value) || 2,
    vlak: vlak.value,
    dieptePct: begrens(leesGetal(diepte.invoer, 100), 10, 300),
    horizon: begrens(leesGetal(horizon, raster.horizon), -5000, 5000),
    vpMidden: begrens(leesGetal(vpMidden, raster.vpMidden), -5000, 5000),
    vp1: begrens(leesGetal(vp1, raster.vp1), -5000, 5000),
    vp2: begrens(leesGetal(vp2, raster.vp2), -5000, 5000),
  });

  function bouw(w, metKleur) {
    const doel = doelVierhoek(w, k);
    if (doel.fout) return doel;
    const H2 = homografie(doel.q);
    const map = (p) => {
      const q = H2((p.x - k.x) / (k.b || 1), (p.y - k.y) / (k.h || 1));
      return { x: Math.round(q.x * 100) / 100, y: Math.round(q.y * 100) / 100 };
    };
    const vormen = paden.map((o) => {
      const v = {
        soort: 'pad', naam: `${o.naam || 'Pad'} in perspectief`.slice(0, 100), subpaden: vervormSubpaden(o.subpaden, map),
        vulling: kleurKopie(o.vulling, cmyk, metKleur),
        lijn: kleurKopie(o.lijn, cmyk, metKleur),
        lijndikte: o.lijndikte || 0,
      };
      if (o.vulregel) v.vulregel = o.vulregel;
      if (typeof o.dekking === 'number' && o.dekking < 1) v.dekking = o.dekking;
      return v;
    });
    return { vormen, doel };
  }

  function teken() {
    const w = waarden();
    rijen.midden.style.display = w.soort === 1 ? '' : 'none';
    rijen.twee.style.display = w.soort === 1 ? 'none' : '';
    [...vlak.options].forEach((o) => { o.disabled = w.soort === 1 && (o.value === 'wand2' || o.value === 'vloer'); });
    if (w.soort === 1 && (vlak.value === 'wand2' || vlak.value === 'vloer')) vlak.value = vlak.value === 'wand2' ? 'wand1' : 'vloer1';
    w.vlak = vlak.value;
    let fout = null;
    if (!paden.length) {
      fout = alle.length
        ? 'Alleen paden kunnen in perspectief. Zet tekst of een groep eerst om naar paden.'
        : 'Selecteer eerst een of meer platte paden (bijvoorbeeld een logo of een raster).';
    }
    const vps = verdwijnpunten(w);
    const uit = fout ? null : bouw(w, false);
    if (uit && uit.fout) fout = uit.fout;
    const vormen = uit && !uit.fout ? uit.vormen : [];
    const origineel = paden.map((o) => ({ soort: 'pad', subpaden: o.subpaden, vulling: null, lijn: { hex: '#8a94a6' }, lijndikte: 0.6, streep: [2, 2], vulregel: o.vulregel }));
    tekenVoorbeeld(doek, {
      kader: overzichtKader(B, H, vps), vel: { x: 0, y: 0, b: B, h: H }, vormen: [...origineel, ...vormen], ondergrond: '#cfd5df', marge: 14, minLijn: 0.6,
      onder: (g, f) => {
        g.strokeStyle = 'rgba(255, 159, 28, 0.9)';
        g.lineWidth = 1 / f;
        const hy = vexel.mm(w.horizon);
        g.beginPath();
        g.moveTo(-B * 3, hy);
        g.lineTo(B * 4, hy);
        g.stroke();
        if (uit && uit.doel && uit.doel.q) {
          g.strokeStyle = 'rgba(90, 162, 255, 0.55)';
          g.setLineDash([3 / f, 3 / f]);
          for (const V of uit.doel.vps) {
            for (const p of uit.doel.q) {
              g.beginPath();
              g.moveTo(p.x, p.y);
              g.lineTo(V.x, V.y);
              g.stroke();
            }
          }
          g.setLineDash([]);
        }
      },
      boven: (g, f) => tekenVps(g, vps, f, '#ff9f1c'),
    });
    const tekst = `${paden.length} ${paden.length === 1 ? 'pad' : 'paden'} op het vlak gezet${overgeslagen ? `, ${overgeslagen} ander object overgeslagen` : ''}.`;
    toonStatus(venster, doc, tekst.replace('ander object', overgeslagen === 1 ? 'ander object' : 'andere objecten'), fout);
  }
  venster.formulier.addEventListener('input', plan);
  venster.formulier.addEventListener('change', plan);
  venster.formulier.addEventListener('submit', async (gebeurtenis) => {
    gebeurtenis.preventDefault();
    if (venster.maakKnop.disabled) return;
    const w = waarden();
    w.vlak = vlak.value;
    const uit = bouw(w, true);
    if (uit.fout) return vexel.melding(uit.fout, 'let');
    const vormen = uit.vormen.length === 1 ? uit.vormen : [{ soort: 'groep', naam: 'In perspectief', kinderen: uit.vormen }];
    // een raster met 3 punten blijft 3 punten; hier kies je alleen tussen 1 en 2
    const soortRaster = raster.soort === 3 && w.soort === 2 ? 3 : w.soort;
    await vexel.bewaar('raster', { ...raster, soort: soortRaster, horizon: w.horizon, vpMidden: w.vpMidden, vp1: w.vp1, vp2: w.vp2 });
    maakInVexel(venster, vormen, { instellingen: { vlak: w.vlak, dieptePct: w.dieptePct }, sleutel: 'vlak', melding: 'In perspectief gezet; het origineel staat er nog.' });
  });
  teken();
}

vexel.opCommando('raster', toonRaster);
vexel.opCommando('vlak', toonVlak);
