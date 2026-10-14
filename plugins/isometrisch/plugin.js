// Isometrische blokken: kubussen, balken, trappen en cilinders uit een hoogteraster, plus hulpraster.
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

// ---- isometrische projectie -----------------------------------------------------------

const COS30 = Math.cos(Math.PI / 6);

/** Van wereld (x naar rechtsvoor, y naar linksvoor, z omhoog; in ribben) naar het vel (pt). */
function projectie(a, X0, Y0) {
  return (x, y, z) => ({ x: X0 + (x - y) * a * COS30, y: Y0 + ((x + y) * a) / 2 - z * a });
}

/** Leest het hoogteraster: regels met getallen; 0, punt of streepje is een leeg vak. */
function leesRaster(tekst) {
  const rijen = String(tekst).split('\n').map((r) => r.trim()).filter(Boolean)
    .map((r) => r.split(/[\s;]+/).filter(Boolean).map((t) => {
      if (t === '.' || t === '-' || t === '_') return 0;
      const n = Number(t.replace(',', '.'));
      return Number.isFinite(n) ? n : NaN;
    }));
  const fout = rijen.some((r) => r.some((n) => Number.isNaN(n)));
  const breed = rijen.reduce((m, r) => Math.max(m, r.length), 0);
  const raster = rijen.map((r) => Array.from({ length: breed }, (_, i) => begrens(r[i] || 0, 0, 40)));
  return { raster, rijen: raster.length, kolommen: breed, fout };
}

const VOORBEELDEN = [
  ['eigen', 'Eigen raster'],
  ['kubus', 'Kubus'],
  ['balk', 'Balk'],
  ['trap', 'Trap'],
  ['piramide', 'Piramide'],
  ['muur', 'Muur met toren'],
  ['stad', 'Stad (willekeurig)'],
];
const VOORBEELD_TEKST = {
  kubus: '1',
  balk: '1 1 1\n1 1 1',
  trap: '1 2 3 4\n1 2 3 4',
  piramide: '1 1 1 1 1\n1 2 2 2 1\n1 2 3 2 1\n1 2 2 2 1\n1 1 1 1 1',
  muur: '3 1 1 1 3\n1 . . . 1\n1 . . . 1\n3 1 1 1 3',
};

function stad(r) {
  const n = 6;
  const regels = [];
  for (let i = 0; i < n; i++) {
    const rij = [];
    for (let j = 0; j < n; j++) {
      const v = r();
      rij.push(v < 0.22 ? 0 : 1 + Math.floor(Math.pow(r(), 1.8) * 5));
    }
    regels.push(rij.join(' '));
  }
  return regels.join('\n');
}

// ---- de vormen -----------------------------------------------------------------

const STANDAARD = {
  voorbeeld: 'trap', raster: VOORBEELD_TEKST.trap, vorm: 'blok', ribbe: 12, hoogteStap: 100,
  kleur: '#3a7bd5', licht: 'links', randen: 'geen',
};

/** De drie tinten van één kleur: boven licht, de kant naar het licht middel, de andere kant donker. */
function tinten(hex, licht) {
  const boven = lichter(hex, 0.38);
  const midden = hex;
  const donker = donkerder(hex, 0.3);
  return licht === 'rechts' ? { boven, links: donker, rechts: midden } : { boven, links: midden, rechts: donker };
}

/** Een kwart ellips (iso-cirkel) tussen twee hoeken, als punten met handvatten. */
function isoBoog(P, cx, cy, z, r, a0, a1, stappen = 2) {
  const punten = [];
  const d = (a1 - a0) / stappen;
  const k = (4 / 3) * Math.tan(d / 4);
  for (let i = 0; i <= stappen; i++) {
    const a = a0 + d * i;
    const w = (x, y) => P(cx + x, cy + y, z);
    const p = w(Math.cos(a) * r, Math.sin(a) * r);
    const raak = { x: -Math.sin(a) * r * k, y: Math.cos(a) * r * k };
    const q = { x: p.x, y: p.y };
    if (i > 0) q.in = w(Math.cos(a) * r - raak.x, Math.sin(a) * r - raak.y);
    if (i < stappen) q.uit = w(Math.cos(a) * r + raak.x, Math.sin(a) * r + raak.y);
    punten.push(q);
  }
  return punten;
}

function bouwBlokken(w, X0, Y0, cmyk) {
  const { raster, rijen, kolommen } = leesRaster(w.raster);
  const a = vexel.mm(w.ribbe);
  const stap = w.hoogteStap / 100;
  const P = projectie(a, X0, Y0);
  const t = tinten(w.kleur, w.licht);
  const kleur = { boven: kleurVoor(t.boven, cmyk), links: kleurVoor(t.links, cmyk), rechts: kleurVoor(t.rechts, cmyk) };
  const lijn = w.randen === 'geen' ? null : kleurVoor(w.randen === 'wit' ? '#ffffff' : donkerder(w.kleur, 0.6), cmyk);
  const stijl = (kant) => ({ vulling: kleur[kant], lijn, lijndikte: lijn ? Math.max(0.25, a * 0.018) : 0, lijnhoek: 'round' });
  const vlak = (naam, kant, punten) => ({ soort: 'pad', naam, subpaden: rond([{ gesloten: true, punten }]), ...stijl(kant) });
  const h = (r, c) => (r >= 0 && c >= 0 && r < rijen && c < kolommen ? raster[r][c] * stap : 0);
  const kolomGroepen = [];
  // van achter naar voor: eerst de vakken met de kleinste r + c
  const volgorde = [];
  for (let r = 0; r < rijen; r++) for (let c = 0; c < kolommen; c++) if (raster[r][c] > 0) volgorde.push([r, c]);
  volgorde.sort((p, q) => p[0] + p[1] - (q[0] + q[1]) || p[0] - q[0]);
  for (const [r, c] of volgorde) {
    const hoogte = h(r, c);
    const kinderen = [];
    if (w.vorm === 'cilinder') {
      const cx = c + 0.5;
      const cy = r + 0.5;
      const R = 0.42;
      // de iso-cirkel heeft zijn uiterste punten links en rechts bij 135° en -45°, het voorste punt bij 45°
      const links = isoBoog(P, cx, cy, 0, R, Math.PI * 0.75, Math.PI * 0.25);
      const voorL = links[links.length - 1];
      const bovenLinks = isoBoog(P, cx, cy, hoogte, R, Math.PI * 0.25, Math.PI * 0.75);
      kinderen.push(vlak('Links', 'links', [
        { ...links[0], in: undefined }, ...links.slice(1, -1), { ...voorL, uit: undefined },
        { ...bovenLinks[0], in: undefined }, ...bovenLinks.slice(1, -1), { ...bovenLinks[bovenLinks.length - 1], uit: undefined },
      ].map(schoon)));
      const rechts = isoBoog(P, cx, cy, 0, R, Math.PI * 0.25, -Math.PI * 0.25);
      const bovenRechts = isoBoog(P, cx, cy, hoogte, R, -Math.PI * 0.25, Math.PI * 0.25);
      kinderen.push(vlak('Rechts', 'rechts', [
        { ...rechts[0], in: undefined }, ...rechts.slice(1, -1), { ...rechts[rechts.length - 1], uit: undefined },
        { ...bovenRechts[0], in: undefined }, ...bovenRechts.slice(1, -1), { ...bovenRechts[bovenRechts.length - 1], uit: undefined },
      ].map(schoon)));
      const deksel = isoBoog(P, cx, cy, hoogte, R, 0, Math.PI * 2, 4);
      deksel[0].in = deksel.pop().in;
      kinderen.push(vlak('Boven', 'boven', deksel.map(schoon)));
      kolomGroepen.push({ soort: 'groep', naam: `Cilinder ${r + 1},${c + 1}`, kinderen });
      continue;
    }
    const lagen = w.vorm === 'kubussen' ? Math.ceil(hoogte / stap - 1e-9) : 1;
    for (let l = 0; l < lagen; l++) {
      const z0 = w.vorm === 'kubussen' ? l * stap : 0;
      const z1 = w.vorm === 'kubussen' ? Math.min(hoogte, (l + 1) * stap) : hoogte;
      const hl = h(r + 1, c); // buur links-voor
      const hr = h(r, c + 1); // buur rechts-voor
      const delen = [];
      if (z1 > hl + 1e-9) {
        const za = Math.max(z0, hl);
        delen.push(vlak('Links', 'links', [P(c, r + 1, za), P(c + 1, r + 1, za), P(c + 1, r + 1, z1), P(c, r + 1, z1)]));
      }
      if (z1 > hr + 1e-9) {
        const za = Math.max(z0, hr);
        delen.push(vlak('Rechts', 'rechts', [P(c + 1, r + 1, za), P(c + 1, r, za), P(c + 1, r, z1), P(c + 1, r + 1, z1)]));
      }
      if (l === lagen - 1) delen.push(vlak('Boven', 'boven', [P(c, r, z1), P(c + 1, r, z1), P(c + 1, r + 1, z1), P(c, r + 1, z1)]));
      if (!delen.length) continue;
      if (w.vorm === 'kubussen' && lagen > 1) kinderen.push({ soort: 'groep', naam: `Kubus ${l + 1}`, kinderen: delen });
      else kinderen.push(...delen);
    }
    if (kinderen.length) kolomGroepen.push({ soort: 'groep', naam: `Vak ${r + 1},${c + 1}`, kinderen });
  }
  return kolomGroepen;
}

/** Haalt lege handvatten weg (undefined telt niet). */
function schoon(p) {
  const q = { x: p.x, y: p.y };
  if (p.in) q.in = p.in;
  if (p.uit) q.uit = p.uit;
  return q;
}

/** Het kader van het raster op het vel, om het netjes te centreren. */
function rasterKader(w) {
  const { raster, rijen, kolommen } = leesRaster(w.raster);
  const a = vexel.mm(w.ribbe);
  const stap = w.hoogteStap / 100;
  const P = projectie(a, 0, 0);
  const pts = [];
  for (let r = 0; r < rijen; r++) {
    for (let c = 0; c < kolommen; c++) {
      if (!raster[r][c]) continue;
      for (const [x, y] of [[c, r], [c + 1, r], [c, r + 1], [c + 1, r + 1]]) {
        pts.push(P(x, y, 0), P(x, y, raster[r][c] * stap));
      }
    }
  }
  if (!pts.length) return null;
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return { x: Math.min(...xs), y: Math.min(...ys), b: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}

/** Plaatst het geheel midden op het tekengebied, met de hoekpunten op het isometrisch hulpraster. */
function plaatsing(w, doc) {
  const k = rasterKader(w);
  if (!k) return null;
  const a = vexel.mm(w.ribbe);
  let X0 = doc.tekengebied.b / 2 - (k.x + k.b / 2);
  let Y0 = doc.tekengebied.h / 2 - (k.y + k.h / 2);
  const i = Math.round(X0 / (a * COS30));
  X0 = i * a * COS30;
  Y0 = Math.round((Y0 - ((((i % 2) + 2) % 2) * a) / 2) / a) * a + ((((i % 2) + 2) % 2) * a) / 2;
  return { X0, Y0, kader: { x: k.x + X0, y: k.y + Y0, b: k.b, h: k.h } };
}

// ---- venster: blokken ----------------------------------------------------------------

async function toonBlokken() {
  const doc = await vexel.document();
  const cmyk = doc.kleurruimte === 'cmyk';
  const w0 = { ...STANDAARD, ...((await vexel.haal('blokken')) || {}) };

  const plan = planner(() => teken());
  const doek = maakDoek(270, 270);
  const voorbeeld = keuzeVeld(VOORBEELDEN, w0.voorbeeld);
  const raster = maak('textarea', { klasse: 'veld', rows: 5, spellcheck: 'false', maxlength: 4000,
    stijl: { height: '96px', padding: '5px 8px', resize: 'none', lineHeight: '1.35', flex: '1', fontFamily: 'ui-monospace, Menlo, monospace' } });
  raster.value = w0.raster;
  const nieuw = maak('button', { klasse: 'knop', type: 'button', tekst: 'Andere stad' });
  const vorm = keuzeVeld([['blok', 'Massieve blokken'], ['kubussen', 'Losse kubussen'], ['cilinder', 'Cilinders']], w0.vorm);
  const ribbe = getalVeld(w0.ribbe, 1, 500, 0.5, true);
  const hoogteStap = schuif(w0.hoogteStap, 25, 300, 5, (n) => `${n}%`);
  const kleur = kleurVak(w0.kleur, 'Kleur');
  const licht = keuzeVeld([['links', 'Licht van links'], ['rechts', 'Licht van rechts']], w0.licht);
  const randen = keuzeVeld([['geen', 'Geen randen'], ['donker', 'Donkere randen'], ['wit', 'Witte randen']], w0.randen);
  const stalen = ['#3a7bd5', '#e4572e', '#2e9e6b', '#f2b134', '#8e5bd6', '#5d6470'].map((hex) => maak('button', {
    type: 'button', title: hex,
    stijl: { width: '18px', height: '18px', borderRadius: '50%', border: '1px solid var(--lijn)', background: hex, cursor: 'pointer', padding: '0' },
    bijClick: () => { kleur.value = hex; plan(); },
  }));

  const venster = bouwVenster({
    maakTekst: 'Blokken maken',
    links: [doek],
    rechts: [
      maak('div', { klasse: 'kop', tekst: 'Hoogteraster' }),
      rij('Voorbeeld', voorbeeld, nieuw),
      rij('Hoogtes', raster),
      maak('p', { klasse: 'uitleg', stijl: { margin: '-2px 0 8px' }, tekst: 'Eén regel per rij, een getal per vak (de hoogte in blokken). 0 of . is leeg.' }),
      maak('div', { klasse: 'kop', tekst: 'Vorm en kleur' }),
      rij('Vorm', vorm),
      rij('Ribbe', ribbe, eenheid('mm')),
      rij('Hoogte per stap', ...hoogteStap.delen),
      rij('Kleur', maak('div', { klasse: 'stalen' }, kleur, ...stalen)),
      rij('Tinten', licht, randen),
    ],
  });

  voorbeeld.addEventListener('change', () => {
    if (voorbeeld.value === 'stad') raster.value = stad(willekeur(nieuwZaad()));
    else if (VOORBEELD_TEKST[voorbeeld.value]) raster.value = VOORBEELD_TEKST[voorbeeld.value];
    plan();
  });
  raster.addEventListener('input', () => { voorbeeld.value = 'eigen'; });
  nieuw.addEventListener('click', () => {
    voorbeeld.value = 'stad';
    raster.value = stad(willekeur(nieuwZaad()));
    plan();
  });

  const waarden = () => ({
    voorbeeld: voorbeeld.value,
    raster: raster.value.slice(0, 4000),
    vorm: vorm.value,
    ribbe: begrens(leesGetal(ribbe, 12), 1, 500),
    hoogteStap: begrens(leesGetal(hoogteStap.invoer, 100), 25, 300),
    kleur: kleur.value,
    licht: licht.value,
    randen: randen.value,
  });

  function teken() {
    const w = waarden();
    nieuw.style.display = w.voorbeeld === 'stad' ? '' : 'none';
    const r = leesRaster(w.raster);
    let fout = null;
    if (r.fout) fout = 'Gebruik alleen getallen in het raster (bijvoorbeeld 0 1 2,5), gescheiden door spaties.';
    else if (r.rijen > 40 || r.kolommen > 40) fout = 'Het raster is te groot: hooguit 40 × 40 vakken.';
    else if (!r.raster.some((rij) => rij.some((n) => n > 0))) fout = 'Zet minstens één getal groter dan 0 in het raster.';
    const plek = fout ? null : plaatsing(w, doc);
    const vormen = plek ? bouwBlokken(w, plek.X0, plek.Y0, false) : [];
    const t = telVormen(vormen);
    if (!fout && (t.n > 5000 || t.p > 50000)) fout = `Dat worden ${getal(t.n, 0)} vormen; kies massieve blokken of een kleiner raster.`;
    let kader = plek ? plek.kader : null;
    if (kader) {
      const m = Math.max(kader.b, kader.h) * 0.56;
      kader = { x: kader.x + kader.b / 2 - m, y: kader.y + kader.h / 2 - m, b: 2 * m, h: 2 * m };
    }
    tekenVoorbeeld(doek, { kader, vormen, ondergrond: '#eef1f5', marge: 12 });
    const vakken = r.raster.reduce((s, rij) => s + rij.filter((n) => n > 0).length, 0);
    const tekst = plek ? `${vakken} ${vakken === 1 ? 'vak' : 'vakken'} op een raster van ${r.kolommen} × ${r.rijen}, ${mmVan(plek.kader.b)} × ${mmVan(plek.kader.h)} mm.` : '';
    toonStatus(venster, doc, tekst, fout);
  }

  venster.formulier.addEventListener('input', plan);
  venster.formulier.addEventListener('change', plan);
  venster.formulier.addEventListener('submit', (gebeurtenis) => {
    gebeurtenis.preventDefault();
    if (venster.maakKnop.disabled) return;
    const w = waarden();
    const plek = plaatsing(w, doc);
    if (!plek) return;
    const naam = { blok: 'Isometrische blokken', kubussen: 'Isometrische kubussen', cilinder: 'Isometrische cilinders' }[w.vorm];
    const vormen = [{ soort: 'groep', naam, kinderen: bouwBlokken(w, plek.X0, plek.Y0, cmyk) }];
    maakInVexel(venster, vormen, { instellingen: w, sleutel: 'blokken', melding: `${naam} gemaakt.` });
  });

  teken();
}

// ---- venster: hulpraster -------------------------------------------------------------

const RASTER_STANDAARD = { ribbe: 12, soort: 'lijnen', kleur: '#8fb8ff', dikte: 0.1, dekking: 70 };

/** Snijdt de lijn p + t·v bij met de rechthoek; geeft twee punten of null. */
function knipLijn(p, v, B, H) {
  let t0 = -Infinity;
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
  if (t0 >= t1) return null;
  return [{ x: p.x + v.x * t0, y: p.y + v.y * t0 }, { x: p.x + v.x * t1, y: p.y + v.y * t1 }];
}

function bouwHulpraster(w, B, H, cmyk) {
  const a = vexel.mm(w.ribbe);
  const stijl = { vulling: null, lijn: kleurVoor(w.kleur, cmyk), lijndikte: vexel.mm(w.dikte), dekking: w.dekking / 100 };
  const r2 = (p) => ({ x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100 });
  if (w.soort === 'stippen') {
    const subpaden = [];
    const rs = Math.max(0.35, vexel.mm(w.dikte) * 1.6);
    const n = Math.floor(B / (a * COS30));
    for (let i = 0; i <= n; i++) {
      const x = i * a * COS30;
      for (let y = (i % 2 ? a / 2 : 0); y <= H + 1e-6; y += a) subpaden.push(cirkelSubpad(x, y, rs));
    }
    return inStukken(subpaden).map((stuk, i) => ({ soort: 'pad', naam: `Stippen ${i + 1}`, subpaden: rond(stuk),
      vulling: kleurVoor(w.kleur, cmyk), lijn: null, dekking: w.dekking / 100 }));
  }
  const families = [
    { naam: 'Lijnen 30°', v: { x: COS30, y: 0.5 } },
    { naam: 'Lijnen 150°', v: { x: COS30, y: -0.5 } },
  ];
  const uit = [];
  for (const f of families) {
    const subpaden = [];
    // genoeg lijnen om het hele vel te dekken: snijpunten met de linkerrand
    const bereik = Math.ceil((H + B * 0.6) / a) + 1;
    for (let k = -bereik; k <= bereik; k++) {
      const stuk = knipLijn({ x: 0, y: k * a }, f.v, B, H);
      if (stuk) subpaden.push({ gesloten: false, punten: stuk.map(r2) });
    }
    inStukken(subpaden).forEach((s, i) => uit.push({ soort: 'pad', naam: i ? `${f.naam} (${i + 1})` : f.naam, subpaden: s, ...stijl }));
  }
  const verticalen = [];
  for (let x = 0; x <= B + 1e-6; x += a * COS30) verticalen.push({ gesloten: false, punten: [r2({ x, y: 0 }), r2({ x, y: H })] });
  inStukken(verticalen).forEach((s, i) => uit.push({ soort: 'pad', naam: i ? `Verticalen (${i + 1})` : 'Verticalen', subpaden: s, ...stijl }));
  return uit;
}

async function toonHulpraster() {
  const doc = await vexel.document();
  const cmyk = doc.kleurruimte === 'cmyk';
  const blok = (await vexel.haal('blokken')) || {};
  const w0 = { ...RASTER_STANDAARD, ribbe: blok.ribbe || RASTER_STANDAARD.ribbe, ...((await vexel.haal('hulpraster')) || {}) };
  const B = doc.tekengebied.b;
  const H = doc.tekengebied.h;

  const plan = planner(() => teken());
  const doek = maakDoek(220, 260);
  const soort = keuzeVeld([['lijnen', 'Lijnen'], ['stippen', 'Stippen']], w0.soort);
  const ribbe = getalVeld(w0.ribbe, 2, 200, 0.5, true);
  const kleur = kleurVak(w0.kleur, 'Kleur');
  const dikte = getalVeld(w0.dikte, 0.02, 2, 0.02, true);
  const dekking = schuif(w0.dekking, 10, 100, 5, (n) => `${n}%`);
  const venster = bouwVenster({
    maakTekst: 'Raster maken',
    links: [doek],
    rechts: [
      maak('div', { klasse: 'kop', tekst: 'Isometrisch hulpraster' }),
      rij('Soort', soort),
      rij('Ribbe', ribbe, eenheid('mm')),
      rij('Kleur', maak('div', { klasse: 'stalen' }, kleur)),
      rij('Lijndikte', dikte, eenheid('mm')),
      rij('Dekking', ...dekking.delen),
      maak('p', { klasse: 'uitleg', tekst: 'Het raster komt achteraan over het hele tekengebied. Met dezelfde ribbe vallen de hoeken van Isometrische blokken precies op het raster.' }),
    ],
  });
  const waarden = () => ({
    soort: soort.value,
    ribbe: begrens(leesGetal(ribbe, 12), 2, 200),
    kleur: kleur.value,
    dikte: begrens(leesGetal(dikte, 0.1), 0.02, 2),
    dekking: begrens(leesGetal(dekking.invoer, 70), 10, 100),
  });
  function teken() {
    const w = waarden();
    const vormen = bouwHulpraster(w, B, H, false);
    const t = telVormen(vormen);
    const fout = t.n > 5000 || t.p > 50000 ? 'Zo fijn wordt het te veel: kies een grotere ribbe.' : null;
    // voorbeeld: alleen een hoek van het vel, zodat je de lijnen goed ziet
    const zijde = Math.min(B, H, vexel.mm(w.ribbe) * 9);
    tekenVoorbeeld(doek, { kader: { x: 0, y: 0, b: zijde * 0.85, h: zijde }, vel: { x: 0, y: 0, b: B, h: H }, vormen, ondergrond: '#cfd5df', marge: 0, minLijn: 0.6, knip: true });
    const lijnen = vormen.reduce((s, v) => s + v.subpaden.length, 0);
    toonStatus(venster, doc, w.soort === 'stippen' ? `${getal(lijnen, 0)} stippen over het tekengebied.` : `${getal(lijnen, 0)} hulplijnen over het tekengebied.`, fout);
  }
  venster.formulier.addEventListener('input', plan);
  venster.formulier.addEventListener('change', plan);
  venster.formulier.addEventListener('submit', (gebeurtenis) => {
    gebeurtenis.preventDefault();
    if (venster.maakKnop.disabled) return;
    const w = waarden();
    const vormen = [{ soort: 'groep', naam: 'Isometrisch hulpraster', kinderen: bouwHulpraster(w, B, H, cmyk) }];
    maakInVexel(venster, vormen, { instellingen: w, sleutel: 'hulpraster', opties: { achteraan: true }, melding: 'Isometrisch hulpraster gemaakt (achteraan).' });
  });
  teken();
}

vexel.opCommando('blokken', toonBlokken);
vexel.opCommando('raster', toonHulpraster);
