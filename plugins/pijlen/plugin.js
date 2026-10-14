// Pijlen: verzorgde pijlvormen als gevulde paden, ook als verbinding tussen twee objecten.
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

// ---- de baan van een pijl ------------------------------------------------------------

/** Een lijn van punten met de afstand langs de lijn. */
function metLengte(punten) {
  let s = 0;
  return punten.map((p, i) => {
    if (i > 0) s += Math.hypot(p.x - punten[i - 1].x, p.y - punten[i - 1].y);
    return { x: p.x, y: p.y, s };
  });
}

/** Het punt en de richting op afstand s langs de baan. */
function opBaan(baan, s) {
  const L = baan[baan.length - 1].s;
  s = begrens(s, 0, L);
  let i = 1;
  while (i < baan.length - 1 && baan[i].s < s) i++;
  const a = baan[i - 1];
  const b = baan[i];
  const t = b.s > a.s ? (s - a.s) / (b.s - a.s) : 0;
  const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, tx: (b.x - a.x) / l, ty: (b.y - a.y) / l };
}

/** Rechte baan van (0, 0) naar (L, 0). */
const rechteBaan = (L) => metLengte([{ x: 0, y: 0 }, { x: L, y: 0 }]);

/** Cirkelboog van (0, 0) naar (L, 0) die `bolling` (pt) naar boven uitsteekt. */
function boogBaan(L, bolling, n = 40) {
  if (Math.abs(bolling) < 0.01) return rechteBaan(L);
  const R = (L * L) / (8 * Math.abs(bolling)) + Math.abs(bolling) / 2;
  const teken = bolling > 0 ? -1 : 1; // y omlaag: bolling naar boven is negatieve y
  const cy = -teken * (R - Math.abs(bolling));
  const a0 = Math.atan2(0 - cy, 0 - L / 2);
  const a1 = Math.atan2(0 - cy, L - L / 2);
  const punten = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    punten.push({ x: L / 2 + Math.cos(a) * R, y: cy + Math.sin(a) * R });
  }
  return metLengte(punten);
}

// ---- de omtrek van een pijl ----------------------------------------------------------

/**
 * Bouwt de omtrek van een gevulde pijl langs een baan.
 * o: { dikte(f) of getal, kopB, kopL, dubbel, inkeping, kopKromming, scheef }
 */
function pijlOmtrek(baan, o) {
  const L = baan[baan.length - 1].s;
  const kopL = Math.min(o.kopL, L * (o.dubbel ? 0.4 : 0.6));
  const s0 = o.dubbel ? kopL : 0;
  const s1 = L - kopL;
  const dikte = typeof o.dikte === 'function' ? o.dikte : () => o.dikte;
  // de schacht: genoeg punten om een boog glad te volgen
  const n = baan.length <= 2 ? 1 : Math.max(4, Math.min(48, Math.round(baan.length * ((s1 - s0) / L))));
  const links = [];
  const rechts = [];
  for (let i = 0; i <= n; i++) {
    const s = s0 + ((s1 - s0) * i) / n;
    const p = opBaan(baan, s);
    // richting: gemiddeld over een klein stukje, zodat de rand vloeiend blijft
    const v = opBaan(baan, Math.max(0, s - 1));
    const w = opBaan(baan, Math.min(L, s + 1));
    const tl = Math.hypot(w.x - v.x, w.y - v.y) || 1;
    const nx = -(w.y - v.y) / tl;
    const ny = (w.x - v.x) / tl;
    const d = dikte(s / L) / 2;
    links.push({ x: p.x + nx * d, y: p.y + ny * d });
    rechts.push({ x: p.x - nx * d, y: p.y - ny * d });
  }
  const kop = (sBasis, sPunt, f = 1) => {
    const basis = opBaan(baan, sBasis);
    const punt = opBaan(baan, sPunt);
    const ax = punt.x - basis.x;
    const ay = punt.y - basis.y;
    const al = Math.hypot(ax, ay) || 1;
    const nx = -ay / al;
    const ny = ax / al;
    const b = (o.kopB / 2) * f;
    const sch = o.scheef || [1, 1];
    return {
      l: { x: basis.x + nx * b * sch[0] - (ax / al) * (o.terug || 0), y: basis.y + ny * b * sch[0] - (ay / al) * (o.terug || 0) },
      r: { x: basis.x - nx * b * sch[1] - (ax / al) * (o.terug || 0), y: basis.y - ny * b * sch[1] - (ay / al) * (o.terug || 0) },
      punt: { x: punt.x, y: punt.y },
    };
  };
  const eind = kop(s1, L);
  const stukken = [
    { punten: links },
    { punten: [links[links.length - 1], eind.l, eind.punt, eind.r, rechts[rechts.length - 1]], recht: true },
    { punten: rechts.slice().reverse() },
  ];
  if (o.dubbel) {
    const begin = kop(s0, 0);
    // bij het begin wijst de kop de andere kant op: links en rechts wisselen
    stukken.push({ punten: [rechts[0], begin.l, begin.punt, begin.r, links[0]], recht: true });
  } else if (o.inkeping) {
    const p = opBaan(baan, Math.min(o.inkeping, s1 * 0.5));
    stukken.push({ punten: [rechts[0], { x: p.x, y: p.y }, links[0]], recht: true });
  } else {
    stukken.push({ punten: [rechts[0], links[0]], recht: true });
  }
  return omtrekUitStukken(stukken);
}

// ---- instellingen ------------------------------------------------------------

const SOORTEN = [
  ['recht', 'Recht'],
  ['gebogen', 'Gebogen (boog)'],
  ['dubbel', 'Dubbel (twee punten)'],
  ['rond', 'Rond (cirkelpijl)'],
  ['ubocht', 'U-bocht'],
  ['hand', 'Handgetekend'],
  ['blok', 'Blokpijl met inkeping'],
  ['chevron', 'Chevron-rij'],
];

const STANDAARD = {
  soort: 'recht', lengte: 60, dikte: 5, kopB: 2.8, kopL: 2.2, richting: 0, kromming: 35, boog: 290, aantal: 3,
  vervagen: true, plaats: 'midden', tussenruimte: 2, kleur: '#1f6feb', lijn: false, lijnKleur: '#0b1b33', zaad: 11,
};

/** Bouwt de pijl in een eigen assenstelsel: staart in (0, 0), richting +x. Geeft een lijst vormen. */
function pijlLokaal(w, L, cmyk) {
  const dikte = vexel.mm(w.dikte);
  const kopB = dikte * w.kopB;
  const kopL = dikte * w.kopL;
  const stijl = {
    vulling: kleurVoor(w.kleur, cmyk),
    lijn: w.lijn ? kleurVoor(w.lijnKleur, cmyk) : null,
    lijndikte: w.lijn ? Math.max(0.5, dikte * 0.08) : 0,
    lijnhoek: 'round',
  };
  const pad = (subpad, naam) => ({ soort: 'pad', naam, subpaden: rond([subpad]), ...stijl });
  switch (w.soort) {
    case 'gebogen':
      return [pad(pijlOmtrek(boogBaan(L, (L * w.kromming) / 200), { dikte, kopB, kopL }), 'Pijl')];
    case 'dubbel':
      return [pad(pijlOmtrek(rechteBaan(L), { dikte, kopB, kopL, dubbel: true }), 'Dubbele pijl')];
    case 'rond': {
      const R = Math.max(dikte, L / 2 - kopB / 2);
      const sweep = graden(w.boog);
      const a0 = -Math.PI / 2 - sweep / 2 + Math.PI;
      const punten = [];
      for (let i = 0; i <= 64; i++) {
        const a = a0 + (sweep * i) / 64;
        punten.push({ x: L / 2 + Math.cos(a) * R, y: Math.sin(a) * R });
      }
      return [pad(pijlOmtrek(metLengte(punten), { dikte, kopB, kopL }), 'Cirkelpijl')];
    }
    case 'ubocht': {
      const r = Math.max(dikte * 1.2, L * 0.2);
      const recht1 = L - r;
      const punten = [{ x: 0, y: 0 }, { x: recht1, y: 0 }];
      for (let i = 1; i <= 32; i++) {
        const a = -Math.PI / 2 + (Math.PI * i) / 32;
        punten.push({ x: recht1 + Math.cos(a) * r, y: r + Math.sin(a) * r });
      }
      punten.push({ x: recht1 - Math.max(kopL * 1.6, recht1 * 0.55), y: 2 * r });
      return [pad(pijlOmtrek(metLengte(punten), { dikte, kopB, kopL }), 'U-bocht')];
    }
    case 'hand': {
      const r = willekeur(w.zaad);
      const golf = [r(), r(), r()].map((v) => (v - 0.5) * 2);
      const bolling = (r() - 0.5) * L * 0.12;
      const punten = [];
      for (let i = 0; i <= 40; i++) {
        const t = i / 40;
        const y = -Math.sin(Math.PI * t) * bolling + Math.sin(t * Math.PI * 2 + golf[0] * 3) * dikte * 0.18 * golf[1]
          + Math.sin(t * Math.PI * 5 + golf[2] * 2) * dikte * 0.08;
        punten.push({ x: t * L, y });
      }
      return [pad(pijlOmtrek(metLengte(punten), {
        dikte: (t) => dikte * (0.35 + 0.65 * Math.min(1, t * 1.6)) * (0.92 + 0.08 * Math.sin(t * 17 + golf[0] * 5)),
        kopB: kopB * (0.95 + r() * 0.15), kopL: kopL * (0.9 + r() * 0.2), scheef: [0.82 + r() * 0.3, 0.82 + r() * 0.3], terug: kopL * 0.18,
      }), 'Handgetekende pijl')];
    }
    case 'blok': {
      const d = dikte * 2;
      return [pad(pijlOmtrek(rechteBaan(L), { dikte: d, kopB: d * Math.max(1.3, w.kopB * 0.62), kopL: d * Math.max(0.5, w.kopL * 0.42), inkeping: d * 0.55 }), 'Blokpijl')];
    }
    case 'chevron': {
      const n = w.aantal;
      const H = kopB;
      const hc = Math.min(H * 0.5, kopL * 0.5);
      const tc = Math.max(dikte * 0.4, (L - hc) / (n + 0.5 * (n - 1)));
      const stap = tc * 1.5;
      const vormen = [];
      for (let i = 0; i < n; i++) {
        const x = i * stap;
        const sp = { gesloten: true, punten: [
          { x, y: -H / 2 }, { x: x + tc, y: -H / 2 }, { x: x + tc + hc, y: 0 },
          { x: x + tc, y: H / 2 }, { x, y: H / 2 }, { x: x + hc, y: 0 },
        ] };
        const v = pad(sp, `Chevron ${i + 1}`);
        if (w.vervagen && n > 1) v.dekking = Math.round((0.3 + (0.7 * i) / (n - 1)) * 100) / 100;
        vormen.push(v);
      }
      return [{ soort: 'groep', naam: 'Chevrons', kinderen: vormen }];
    }
    default:
      return [pad(pijlOmtrek(rechteBaan(L), { dikte, kopB, kopL }), 'Pijl')];
  }
}

/** Zet vormen om met een functie op elk punt (alleen paden en groepen). */
function zetVormenOm(vormen, f) {
  return vormen.map((v) => (v.soort === 'groep'
    ? { ...v, kinderen: zetVormenOm(v.kinderen, f) }
    : { ...v, subpaden: rond(zetOm(v.subpaden, f)) }));
}

/** Waar de lijn van het midden van kader k naar punt q de rand van k verlaat. */
function randPunt(k, van, naar) {
  const dx = naar.x - van.x;
  const dy = naar.y - van.y;
  const tx = dx ? (k.b / 2) / Math.abs(dx) : Infinity;
  const ty = dy ? (k.h / 2) / Math.abs(dy) : Infinity;
  const t = Math.min(tx, ty, 1);
  return { x: van.x + dx * t, y: van.y + dy * t };
}

/** Zelfde, maar langs de echte omtrek als het object een pad is (een cirkel of ster bijvoorbeeld). */
function randPuntVorm(o, van, naar) {
  const terug = randPunt(o.kader, van, naar);
  if (!o.subpaden || !o.subpaden.length) return terug;
  const dx = naar.x - van.x;
  const dy = naar.y - van.y;
  let beste = -1;
  for (const sp of o.subpaden) {
    const pt = sp.punten;
    if (!pt || pt.length < 2) continue;
    const lijn = [];
    const eind = sp.gesloten ? pt.length : pt.length - 1;
    lijn.push(pt[0]);
    for (let i = 1; i <= eind; i++) {
      const a = pt[i - 1];
      const b = pt[i % pt.length];
      const c1 = a.uit || a;
      const c2 = b.in || b;
      for (let k = 1; k <= 16; k++) {
        const t = k / 16;
        const u = 1 - t;
        lijn.push({
          x: u * u * u * a.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * b.x,
          y: u * u * u * a.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * b.y,
        });
      }
    }
    for (let i = 1; i < lijn.length; i++) {
      const p = lijn[i - 1];
      const q = lijn[i];
      const ex = q.x - p.x;
      const ey = q.y - p.y;
      const noemer = dx * ey - dy * ex;
      if (Math.abs(noemer) < 1e-9) continue;
      const t = ((p.x - van.x) * ey - (p.y - van.y) * ex) / noemer;
      const u = ((p.x - van.x) * dy - (p.y - van.y) * dx) / noemer;
      if (t >= 0 && t <= 1 && u >= 0 && u <= 1 && t > beste) beste = t;
    }
  }
  return beste >= 0 ? { x: van.x + dx * beste, y: van.y + dy * beste } : terug;
}

/** De vormen op hun plek: midden op het tekengebied, of tussen twee objecten. */
function bouwVormen(w, doc, paar, cmyk) {
  if (w.plaats === 'verbinden' && paar) {
    const [A, B] = paar.map((o) => o.kader);
    const ca = { x: A.x + A.b / 2, y: A.y + A.h / 2 };
    const cb = { x: B.x + B.b / 2, y: B.y + B.h / 2 };
    const pa = randPuntVorm(paar[0], ca, cb);
    const pb = randPuntVorm(paar[1], cb, ca);
    const lengte = Math.hypot(pb.x - pa.x, pb.y - pa.y);
    const gat = vexel.mm(w.tussenruimte);
    const L = lengte - 2 * gat;
    if (L < vexel.mm(2)) return { fout: 'De twee objecten liggen te dicht op elkaar (of overlappen) voor een pijl ertussen.' };
    const hoek = Math.atan2(pb.y - pa.y, pb.x - pa.x);
    const ux = Math.cos(hoek);
    const uy = Math.sin(hoek);
    const start = { x: pa.x + ux * gat, y: pa.y + uy * gat };
    const soort = w.soort === 'rond' || w.soort === 'ubocht' ? 'gebogen' : w.soort;
    const lokaal = pijlLokaal({ ...w, soort }, L, cmyk);
    const vormen = zetVormenOm(lokaal, (p) => ({ x: start.x + p.x * ux - p.y * uy, y: start.y + p.x * uy + p.y * ux }));
    return { vormen: naamGroep(vormen, 'Verbindingspijl'), lengte: L };
  }
  const L = vexel.mm(w.lengte);
  const lokaal = pijlLokaal(w, L, cmyk);
  const k = kaderVanVormen(lokaal);
  const mx = k.x + k.b / 2;
  const my = k.y + k.h / 2;
  const cx = doc.tekengebied.b / 2;
  const cy = doc.tekengebied.h / 2;
  const f = draaiVerschuif(w.richting, cx - mx, cy - my, mx, my);
  return { vormen: naamGroep(zetVormenOm(lokaal, f), null), lengte: L };
}

function naamGroep(vormen, naam) {
  if (!naam) return vormen;
  return vormen.map((v) => ({ ...v, naam: v.soort === 'groep' ? `${naam} (chevrons)` : naam }));
}

// ---- de plaatjes op de soortknoppen ------------------------------------------------

function tekenSoortIcoon(g, soort, b, h) {
  const w = { ...STANDAARD, soort, dikte: 1.1, kopB: 2.8, kopL: 2.2, lengte: 11, kromming: 45, boog: 290, aantal: 3, zaad: 5, vervagen: true };
  const vormen = pijlLokaal(w, vexel.mm(w.lengte), false);
  const kleur = css('--accent', '#5aa2ff');
  const kleuren = (lijst) => lijst.map((v) => (v.soort === 'groep' ? { ...v, kinderen: kleuren(v.kinderen) } : { ...v, vulling: { hex: kleur } }));
  const k = kaderVanVormen(vormen);
  const f = Math.min((b - 10) / k.b, (h - 10) / k.h);
  g.save();
  g.translate(b / 2 - (k.x + k.b / 2) * f, h / 2 - (k.y + k.h / 2) * f);
  g.scale(f, f);
  tekenVormen(g, kleuren(vormen));
  g.restore();
}

// ---- het venster ------------------------------------------------------------

async function toonVenster() {
  const doc = await vexel.document();
  const cmyk = doc.kleurruimte === 'cmyk';
  const sel = (await leesSelectie()).filter((o) => o.kader);
  const paar = sel.length === 2 ? sel : null;
  const w0 = { ...STANDAARD, ...((await vexel.haal('instellingen')) || {}) };
  w0.plaats = paar ? 'verbinden' : 'midden';

  const plan = planner(() => teken());
  const doek = maakDoek(260, 220);
  const soort = soortKiezer(SOORTEN, w0.soort, tekenSoortIcoon, plan, 4);
  const plaats = keuzeVeld([
    ['midden', 'Midden op het tekengebied'],
    ['verbinden', paar ? 'Tussen de twee geselecteerde objecten' : 'Tussen twee objecten (selecteer er twee)'],
  ], w0.plaats);
  const lengte = getalVeld(w0.lengte, 5, 2000, 1, true);
  const richting = schuif(w0.richting, -180, 180, 5, (n) => `${n}°`);
  const tussenruimte = getalVeld(w0.tussenruimte, 0, 100, 0.5, true);
  const dikte = getalVeld(w0.dikte, 0.2, 200, 0.5, true);
  const kopB = schuif(w0.kopB, 1.2, 5, 0.1, (n) => `${getal(n)}×`);
  const kopL = schuif(w0.kopL, 0.6, 5, 0.1, (n) => `${getal(n)}×`);
  const kromming = schuif(w0.kromming, -100, 100, 5, (n) => `${n}%`);
  const boog = schuif(w0.boog, 90, 340, 5, (n) => `${n}°`);
  const aantal = getalVeld(w0.aantal, 1, 12, 1, true);
  const vervagen = vinkje('vervagend', w0.vervagen);
  const variant = variantKiezer(w0.zaad, 'Andere lijn', plan);
  const kleur = kleurVak(w0.kleur, 'Vulling');
  const lijn = vinkje('rand', w0.lijn);
  const lijnKleur = kleurVak(w0.lijnKleur, 'Randkleur');

  const rijen = {
    lengte: rij('Lengte', lengte, eenheid('mm')),
    richting: rij('Richting', ...richting.delen),
    tussen: rij('Tussenruimte', tussenruimte, eenheid('mm')),
    kromming: rij('Kromming', ...kromming.delen),
    boog: rij('Boog', ...boog.delen),
    aantal: rij('Aantal', aantal, vervagen.blok),
    variant: rij('Variant', variant.blok),
  };
  const venster = bouwVenster({
    maakTekst: 'Pijl maken',
    links: [doek, soort.blok],
    rechts: [
      maak('div', { klasse: 'kop', tekst: 'Plaats' }),
      rij('Waar', plaats),
      rijen.lengte, rijen.richting, rijen.tussen,
      maak('div', { klasse: 'kop', tekst: 'Vorm' }),
      rij('Dikte', dikte, eenheid('mm')),
      rij('Punt breedte', ...kopB.delen),
      rij('Punt lengte', ...kopL.delen),
      rijen.kromming, rijen.boog, rijen.aantal, rijen.variant,
      maak('div', { klasse: 'kop', tekst: 'Kleur' }),
      rij('Vulling · rand', maak('div', { klasse: 'stalen' }, kleur, lijn.blok, lijnKleur)),
    ],
  });

  const waarden = () => ({
    soort: soort.waarde(),
    plaats: plaats.value,
    lengte: begrens(leesGetal(lengte, 60), 5, 2000),
    richting: begrens(leesGetal(richting.invoer, 0), -180, 180),
    tussenruimte: begrens(leesGetal(tussenruimte, 2), 0, 100),
    dikte: begrens(leesGetal(dikte, 5), 0.2, 200),
    kopB: begrens(leesGetal(kopB.invoer, 2.8), 1.2, 5),
    kopL: begrens(leesGetal(kopL.invoer, 2.2), 0.6, 5),
    kromming: begrens(leesGetal(kromming.invoer, 35), -100, 100),
    boog: begrens(leesGetal(boog.invoer, 290), 90, 340),
    aantal: Math.round(begrens(leesGetal(aantal, 3), 1, 12)),
    vervagen: vervagen.invoer.checked,
    zaad: variant.waarde(),
    kleur: kleur.value,
    lijn: lijn.invoer.checked,
    lijnKleur: lijnKleur.value,
  });

  function teken() {
    const w = waarden();
    const s = w.soort;
    const verbinden = w.plaats === 'verbinden';
    rijen.lengte.style.display = rijen.richting.style.display = verbinden ? 'none' : '';
    rijen.tussen.style.display = verbinden ? '' : 'none';
    rijen.kromming.style.display = s === 'gebogen' || (verbinden && (s === 'rond' || s === 'ubocht')) ? '' : 'none';
    rijen.boog.style.display = s === 'rond' && !verbinden ? '' : 'none';
    rijen.aantal.style.display = s === 'chevron' ? '' : 'none';
    rijen.variant.style.display = s === 'hand' ? '' : 'none';
    let fout = null;
    let uit = null;
    if (verbinden && !paar) fout = 'Selecteer precies twee objecten om er een pijl tussen te zetten.';
    else {
      uit = bouwVormen(w, doc, paar, false);
      if (uit.fout) fout = uit.fout;
    }
    const vormen = uit && uit.vormen ? uit.vormen : [];
    let kader = kaderVanVormen(vormen);
    const extra = [];
    if (verbinden && paar) {
      kader = verenigKaders([kader, ...paar.map((o) => o.kader)]);
      for (const o of paar) {
        extra.push(o.subpaden
          ? { soort: 'pad', subpaden: o.subpaden, vulregel: o.vulregel, vulling: { hex: '#d9dee7' }, lijn: { hex: '#9aa4b5' }, lijndikte: 0.5 }
          : { soort: 'rechthoek', ...o.kader, vulling: { hex: '#d9dee7' }, lijn: { hex: '#9aa4b5' }, lijndikte: 0.5 });
      }
    }
    if (kader) {
      const r = Math.max(kader.b, kader.h * 1.18) * 0.56;
      kader = { x: kader.x + kader.b / 2 - r, y: kader.y + kader.h / 2 - r / 1.18, b: 2 * r, h: (2 * r) / 1.18 };
    }
    tekenVoorbeeld(doek, { kader, vormen: [...extra, ...vormen], ondergrond: '#eef1f5', marge: 12 });
    const naam = {
      recht: 'Rechte pijl', gebogen: 'Gebogen pijl', dubbel: 'Dubbele pijl', rond: 'Cirkelpijl', ubocht: 'U-bocht',
      hand: 'Handgetekende pijl', blok: 'Blokpijl', chevron: `Rij van ${w.aantal} chevrons`,
    }[s];
    const tekst = uit && !uit.fout ? `${naam} van ${mmVan(uit.lengte)} mm, ${mmVan(vexel.mm(w.dikte), 1)} mm dik${verbinden ? ', tussen de selectie' : ''}.` : '';
    toonStatus(venster, doc, tekst, fout);
  }

  venster.formulier.addEventListener('input', plan);
  venster.formulier.addEventListener('change', plan);
  venster.formulier.addEventListener('submit', (gebeurtenis) => {
    gebeurtenis.preventDefault();
    if (venster.maakKnop.disabled) return;
    const w = waarden();
    const uit = bouwVormen(w, doc, paar, cmyk);
    if (uit.fout) return vexel.melding(uit.fout, 'let');
    maakInVexel(venster, uit.vormen, { instellingen: w, melding: w.plaats === 'verbinden' ? 'Verbindingspijl gemaakt.' : 'Pijl gemaakt.' });
  });

  teken();
}

vexel.opCommando('maken', toonVenster);
