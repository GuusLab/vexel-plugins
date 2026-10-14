// Tekstballonnen: spraak, gedachte, schreeuw, fluister en rechthoekig, met de staart in één pad.
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

// ---- krommen als losse stukken (voor het knippen van de omtrek) --------------

/** Zet een gesloten subpad om in stukken { a, c1, c2, b }; rechte stukken krijgen recht: true. */
function stukkenVan(sp) {
  const pt = sp.punten;
  return pt.map((a, i) => {
    const b = pt[(i + 1) % pt.length];
    const recht = !a.uit && !b.in;
    return { a: { x: a.x, y: a.y }, c1: a.uit || { x: a.x, y: a.y }, c2: b.in || { x: b.x, y: b.y }, b: { x: b.x, y: b.y }, recht };
  });
}

function punt(s, t) {
  const u = 1 - t;
  return {
    x: u * u * u * s.a.x + 3 * u * u * t * s.c1.x + 3 * u * t * t * s.c2.x + t * t * t * s.b.x,
    y: u * u * u * s.a.y + 3 * u * u * t * s.c1.y + 3 * u * t * t * s.c2.y + t * t * t * s.b.y,
  };
}

/** Knipt een stuk bij t in twee (de Casteljau). */
function splits(s, t) {
  const l = (p, q) => ({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
  const ab = l(s.a, s.c1);
  const bc = l(s.c1, s.c2);
  const cd = l(s.c2, s.b);
  const abc = l(ab, bc);
  const bcd = l(bc, cd);
  const m = l(abc, bcd);
  return [
    { a: s.a, c1: ab, c2: abc, b: m, recht: s.recht },
    { a: m, c1: bcd, c2: cd, b: s.b, recht: s.recht },
  ];
}

/** Een tabel van booglengte per stuk, om een plek op de omtrek te vinden. */
function lengteTabel(stukken) {
  let totaal = 0;
  const tabel = stukken.map((s) => {
    const rij = [0];
    let vorige = s.a;
    let l = 0;
    for (let i = 1; i <= 24; i++) {
      const p = punt(s, i / 24);
      l += Math.hypot(p.x - vorige.x, p.y - vorige.y);
      rij.push(l);
      vorige = p;
    }
    const uit = { begin: totaal, lengte: l, rij };
    totaal += l;
    return uit;
  });
  return { tabel, totaal };
}

/** Van een plek u (booglengte) naar { i, t }. */
function plekOp(lt, u) {
  const L = lt.totaal;
  let v = ((u % L) + L) % L;
  for (let i = 0; i < lt.tabel.length; i++) {
    const r = lt.tabel[i];
    if (v <= r.begin + r.lengte || i === lt.tabel.length - 1) {
      const d = begrens(v - r.begin, 0, r.lengte);
      let k = 1;
      while (k < 24 && r.rij[k] < d) k++;
      const a = r.rij[k - 1];
      const b = r.rij[k];
      const t = (k - 1 + (b > a ? (d - a) / (b - a) : 0)) / 24;
      return { i, t: begrens(t, 0, 1) };
    }
  }
  return { i: 0, t: 0 };
}

/** De stukken van de omtrek tussen u0 en u0 + lengte (met de klok mee, ook over het begin heen). */
function deelVan(stukken, lt, u0, lengte) {
  const a = plekOp(lt, u0);
  const b = plekOp(lt, u0 + lengte);
  const uit = [];
  const n = stukken.length;
  let i = a.i;
  let t0 = a.t;
  for (let stap = 0; stap <= n; stap++) {
    const laatste = i === b.i && (stap > 0 || b.t > t0);
    const t1 = laatste ? b.t : 1;
    let s = stukken[i];
    if (t1 < 1) s = splits(s, t1)[0];
    if (t0 > 0) s = splits(s, t1 > 0 ? t0 / t1 : 0)[1];
    if (t1 - t0 > 1e-6) uit.push(s);
    if (laatste) break;
    i = (i + 1) % n;
    t0 = 0;
  }
  return uit;
}

/** Zet een open reeks stukken om in padpunten (zonder het laatste eindpunt). */
function puntenVan(stukken) {
  const punten = [];
  stukken.forEach((s, k) => {
    const p = { x: s.a.x, y: s.a.y };
    if (!s.recht) p.uit = { x: s.c1.x, y: s.c1.y };
    if (k > 0 && !stukken[k - 1].recht) p.in = { x: stukken[k - 1].c2.x, y: stukken[k - 1].c2.y };
    punten.push(p);
  });
  const z = stukken[stukken.length - 1];
  const eind = { x: z.b.x, y: z.b.y };
  if (!z.recht) eind.in = { x: z.c2.x, y: z.c2.y };
  punten.push(eind);
  return punten;
}

// ---- de ballonvormen -----------------------------------------------------------

const SOORTEN = [
  ['spraak', 'Spraak (ovaal)'],
  ['gedachte', 'Gedachte (wolkje met bolletjes)'],
  ['schreeuw', 'Schreeuw (gekarteld)'],
  ['fluister', 'Fluister (stippellijn)'],
  ['rechthoek', 'Rechthoekig met afgeronde hoeken'],
];

const STANDAARD = {
  soort: 'spraak', maatSoort: 'tekst', b: 70, h: 40, afronding: 40,
  tekst: 'Wat een goed idee!', grootte: 14, gewicht: 600,
  richting: 120, lengte: 14, breedte: 9, kromming: 25,
  vulling: '#ffffff', lijn: '#1d1d1f', tekstKleur: '#1d1d1f', lijndikte: 0.5, zaad: 7,
};

/** Afgeronde rechthoek als subpad, met de klok mee, beginnend linksboven. */
function rechthoekSubpad(cx, cy, b, h, r) {
  const x0 = cx - b / 2;
  const y0 = cy - h / 2;
  const x1 = cx + b / 2;
  const y1 = cy + h / 2;
  r = Math.min(r, b / 2, h / 2);
  if (r < 0.01) return { gesloten: true, punten: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }] };
  const k = r * BOOG;
  return {
    gesloten: true,
    punten: [
      { x: x0 + r, y: y0, in: { x: x0 + r - k, y: y0 } },
      { x: x1 - r, y: y0, uit: { x: x1 - r + k, y: y0 } },
      { x: x1, y: y0 + r, in: { x: x1, y: y0 + r - k } },
      { x: x1, y: y1 - r, uit: { x: x1, y: y1 - r + k } },
      { x: x1 - r, y: y1, in: { x: x1 - r + k, y: y1 } },
      { x: x0 + r, y: y1, uit: { x: x0 + r - k, y: y1 } },
      { x: x0, y: y1 - r, in: { x: x0, y: y1 - r + k } },
      { x: x0, y: y0 + r, uit: { x: x0, y: y0 + r - k } },
    ],
  };
}

/** Wolk: bolletjes langs een ellips, met scherpe inkepingen ertussen. */
function wolkSubpad(cx, cy, rx, ry, r) {
  const omtrek = Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)));
  const n = Math.round(begrens(omtrek / (Math.min(rx, ry) * 0.62), 7, 22));
  const hoeken = [];
  for (let i = 0; i < n; i++) hoeken.push(((i + (r() - 0.5) * 0.35) / n) * Math.PI * 2 - Math.PI / 2);
  const basis = hoeken.map((a) => ({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry }));
  const punten = basis.map((p) => ({ x: p.x, y: p.y }));
  for (let i = 0; i < n; i++) {
    const a = basis[i];
    const b = basis[(i + 1) % n];
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const l = Math.hypot(vx, vy);
    // naar buiten: loodrecht op de koorde, weg van het midden
    let nx = vy / l;
    let ny = -vx / l;
    if (((a.x + b.x) / 2 - cx) * nx + ((a.y + b.y) / 2 - cy) * ny < 0) { nx = -nx; ny = -ny; }
    const hoog = l * (0.5 + r() * 0.16) / 0.75;
    punten[i].uit = { x: a.x + nx * hoog - vx * 0.12, y: a.y + ny * hoog - vy * 0.12 };
    punten[(i + 1) % n].in = { x: b.x + nx * hoog + vx * 0.12, y: b.y + ny * hoog + vy * 0.12 };
  }
  return { gesloten: true, punten };
}

/** Gekartelde schreeuwrand: punten op de ellips, met daartussen punten die naar buiten steken. */
function schreeuwSubpad(cx, cy, rx, ry, r) {
  const omtrek = Math.PI * (rx + ry);
  const n = Math.round(begrens(omtrek / (Math.min(rx, ry) * 0.38), 12, 40));
  const piek = Math.min(rx, ry) * 0.3;
  const punten = [];
  for (let i = 0; i < 2 * n; i++) {
    const a = ((i + (r() - 0.5) * 0.45) / (2 * n)) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(a) * rx;
    const y = Math.sin(a) * ry;
    // de normaal van de ellips in dit punt
    const nx = x / (rx * rx);
    const ny = y / (ry * ry);
    const nl = Math.hypot(nx, ny) || 1;
    const d = i % 2 ? -piek * (0.05 + r() * 0.12) : piek * (0.65 + r() * 0.7);
    punten.push({ x: cx + x + (nx / nl) * d, y: cy + y + (ny / nl) * d });
  }
  return { gesloten: true, punten };
}

/** De afmetingen van de tekst in pt: { b, h, regels }. */
function tekstMaat(w) {
  const regels = w.tekst.split('\n').map((r) => r.trim()).filter(Boolean);
  if (!regels.length) return null;
  const regelafstand = w.grootte * 1.25;
  const b = Math.max(...regels.map((r) => tekstBreedte(r, w.grootte, w.gewicht)));
  return { b, h: (regels.length - 1) * regelafstand + w.grootte * 0.95, regels, regelafstand };
}

/** De buitenmaat van de ballon: om de binnenruimte (tekst of selectie) heen, of de vaste maat. */
function maten(w, binnen) {
  if (binnen) {
    const p = w.maatSoort === 'selectie' ? vexel.mm(3) : w.grootte * 0.7;
    const a = binnen.b / 2 + p;
    const b = binnen.h / 2 + p;
    if (w.soort === 'rechthoek') return { b: 2 * a, h: 2 * b };
    // de kleinste ovaal met een prettige verhouding waar het vak precies in past
    const verhouding = begrens(b / a, 0.56, 1.4);
    const rx = Math.sqrt(a * a + (b / verhouding) * (b / verhouding));
    const extra = w.soort === 'schreeuw' ? 1.22 : w.soort === 'gedachte' ? 1.2 : 1;
    return { b: 2 * rx * extra, h: 2 * rx * verhouding * extra };
  }
  return { b: vexel.mm(w.b), h: vexel.mm(w.h) };
}

/**
 * Bouwt de ballon rond (cx, cy). Geeft { subpaden, punt: de staartpunt } terug.
 * De staart wordt in de omtrek gezet, zodat de ballon één doorlopende vorm is.
 */
function ballonVorm(w, cx, cy, B, H) {
  const r = willekeur(w.zaad);
  const rx = B / 2;
  const ry = H / 2;
  let basis;
  if (w.soort === 'rechthoek') basis = rechthoekSubpad(cx, cy, B, H, (Math.min(B, H) / 2) * (w.afronding / 100));
  else if (w.soort === 'gedachte') basis = wolkSubpad(cx, cy, rx * 0.86, ry * 0.84, r);
  else if (w.soort === 'schreeuw') basis = schreeuwSubpad(cx, cy, rx * 0.8, ry * 0.8, r);
  else basis = cirkelSubpad(cx, cy, rx, ry);

  const hoek = graden(w.richting);
  const richting = { x: Math.cos(hoek), y: Math.sin(hoek) };
  const lengte = vexel.mm(w.lengte);
  const breedte = vexel.mm(w.breedte);
  if (lengte <= 0.01 || breedte <= 0.01) return { subpaden: [basis], punt: null };

  // waar de staart de omtrek raakt: het punt dat het best in de gekozen richting ligt
  const stukken = stukkenVan(basis);
  const lt = lengteTabel(stukken);
  let beste = { u: 0, score: -Infinity, p: null };
  const proeven = 360;
  for (let i = 0; i < proeven; i++) {
    const u = (i / proeven) * lt.totaal;
    const q = plekOp(lt, u);
    const p = punt(stukken[q.i], q.t);
    const dx = (p.x - cx) / rx;
    const dy = (p.y - cy) / ry;
    const l = Math.hypot(dx, dy) || 1;
    const hoekScore = (dx * richting.x + dy * richting.y) / l;
    // bij wolk en schreeuw: het verste punt binnen een smalle hoek, zodat de staart buiten de bobbels begint
    const score = w.soort === 'gedachte' && hoekScore > 0.985 ? 2 + ((p.x - cx) * richting.x + (p.y - cy) * richting.y) / rx : hoekScore;
    if (score > beste.score) beste = { u, score, p };
  }
  const voet = beste.p;
  let afstand = Math.hypot(voet.x - cx, voet.y - cy);
  if (w.soort === 'gedachte' || w.soort === 'schreeuw') {
    // begin buiten de bobbels of pieken: het verste punt van de omtrek rond deze richting
    for (let i = 0; i < proeven; i++) {
      const q = plekOp(lt, (i / proeven) * lt.totaal);
      const p = punt(stukken[q.i], q.t);
      const dx = p.x - cx;
      const dy = p.y - cy;
      const l = Math.hypot(dx, dy) || 1;
      if ((dx * richting.x + dy * richting.y) / l > 0.97) afstand = Math.max(afstand, (dx * richting.x + dy * richting.y));
    }
  }
  const tip = { x: cx + richting.x * (afstand + lengte), y: cy + richting.y * (afstand + lengte) };

  if (w.soort === 'gedachte') {
    // bolletjes in plaats van een staart, steeds kleiner naar de punt
    const delen = [0.5, 0.33, 0.2];
    const ruimte = (afstand + lengte) - Math.hypot(voet.x - cx, voet.y - cy);
    const schaal = Math.min(breedte * 0.62, (ruimte * 0.8) / (2 * (delen[0] + delen[1] + delen[2]) + 0.4) / delen[0] * delen[0]);
    let d = Math.hypot(voet.x - cx, voet.y - cy) + ruimte * 0.12;
    const bollen = delen.map((f) => {
      const rb = schaal * f * 2;
      d += rb;
      const bol = cirkelSubpad(cx + richting.x * d, cy + richting.y * d, rb, rb * 0.88);
      d += rb + ruimte * 0.06;
      return bol;
    });
    return { subpaden: [basis, ...bollen], punt: tip };
  }

  // de opening voor de staart: zo ver langs de omtrek dat hij dwars op de richting de halve breedte haalt
  const dwars = { x: -richting.y, y: richting.x };
  const zoek = (teken) => {
    const stap = lt.totaal / 1440;
    for (let d = stap; d < lt.totaal * 0.3; d += stap) {
      const q = plekOp(lt, beste.u + teken * d);
      const p = punt(stukken[q.i], q.t);
      if (Math.abs((p.x - voet.x) * dwars.x + (p.y - voet.y) * dwars.y) >= breedte / 2) return d;
    }
    return lt.totaal * 0.3;
  };
  const voor = zoek(1);
  const achter = zoek(-1);
  const behouden = deelVan(stukken, lt, beste.u + voor, lt.totaal - voor - achter);
  const punten = puntenVan(behouden);
  const A = punten[punten.length - 1];
  const Bp = punten[0];
  // de staart: van A naar de punt en terug naar B, licht gebogen
  const m = { x: (A.x + Bp.x) / 2, y: (A.y + Bp.y) / 2 };
  const asx = tip.x - m.x;
  const asy = tip.y - m.y;
  const asl = Math.hypot(asx, asy) || 1;
  const nx = -asy / asl;
  const ny = asx / asl;
  const k = (w.kromming / 100) * asl * 0.45;
  const l = (p, q, t) => ({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
  const schuif = (p, f) => ({ x: p.x + nx * k * f, y: p.y + ny * k * f });
  if (w.soort === 'schreeuw') {
    // een gekartelde staart: aan elke kant een tand
    const hw = Math.hypot(A.x - Bp.x, A.y - Bp.y) / 2;
    const kant = (A.x - m.x) * nx + (A.y - m.y) * ny < 0 ? -1 : 1;
    const op = (f, o) => {
      const b = k * 4 * f * (1 - f);
      return { x: m.x + asx * f + nx * (kant * o * hw + b), y: m.y + asy * f + ny * (kant * o * hw + b) };
    };
    punten.push(op(0.4, 0.7), op(0.5, 0.22), { x: tip.x, y: tip.y }, op(0.66, -0.08), op(0.55, -0.62));
    return { subpaden: [{ gesloten: true, punten }], punt: tip };
  }
  A.uit = schuif(l(A, tip, 0.38), 0.9);
  const tipPunt = { x: tip.x, y: tip.y, in: schuif(l(A, tip, 0.78), 0.55), uit: schuif(l(tip, Bp, 0.22), 0.55) };
  Bp.in = schuif(l(tip, Bp, 0.62), 0.9);
  punten.push(tipPunt);
  return { subpaden: [{ gesloten: true, punten }], punt: tip };
}

/** Alle vormen: de ballon en eventueel de tekst, als één groep. */
function bouwVormen(w, plek, cmyk, metTekst) {
  const tm = metTekst ? tekstMaat(w) : null;
  const binnen = w.maatSoort === 'selectie' ? plek.binnen : w.maatSoort === 'tekst' ? tm : null;
  const maat = maten(w, binnen);
  const { subpaden } = ballonVorm(w, plek.cx, plek.cy, maat.b, maat.h);
  const lijndikte = vexel.mm(w.lijndikte);
  const ballon = {
    soort: 'pad', naam: 'Ballon', subpaden: rond(subpaden),
    vulling: w.vulling === 'geen' ? null : kleurVoor(w.vulling, cmyk),
    lijn: lijndikte > 0 ? kleurVoor(w.lijn, cmyk) : null, lijndikte, lijnhoek: 'round', lijneinde: 'round',
  };
  if (w.soort === 'fluister' && lijndikte > 0) ballon.streep = [lijndikte * 0.1, lijndikte * 2.6];
  const kort = tm ? tm.regels.join(' ').slice(0, 40) : '';
  if (!tm) return { vormen: [{ ...ballon, naam: 'Tekstballon' }], maat };
  const midden = plek.cy - (tm.regels.length - 1) * tm.regelafstand / 2 + w.grootte * 0.35;
  const tekst = {
    soort: 'tekst', naam: 'Tekst', x: plek.cx, y: midden, inhoud: tm.regels.join('\n'), grootte: w.grootte,
    gewicht: w.gewicht, uitlijning: 'midden', regelafstand: tm.regelafstand, vulling: kleurVoor(w.tekstKleur, cmyk), lijn: null,
  };
  return { vormen: [{ soort: 'groep', naam: `Tekstballon · ${kort}`, kinderen: [ballon, tekst] }], maat };
}

// ---- de plaatjes op de soortknoppen ------------------------------------------------

function tekenSoortIcoon(g, soort, b, h) {
  const w = { ...STANDAARD, soort, richting: 125, lengte: 2.6, breedte: 2.4, kromming: 20, zaad: 3, afronding: 45 };
  const vexelMm = vexel.mm;
  const { subpaden } = ballonVorm(w, b / 2 + 1, h / 2 - 3, vexelMm(9.2), vexelMm(6.4));
  const pad = padVan({ soort: 'pad', subpaden });
  g.fillStyle = '#f4f6fa';
  g.fill(pad);
  g.strokeStyle = css('--accent', '#5aa2ff');
  g.lineWidth = 1.3;
  g.lineJoin = 'round';
  g.setLineDash(soort === 'fluister' ? [1.6, 2.2] : []);
  g.stroke(pad);
  g.setLineDash([]);
}

// ---- het venster ------------------------------------------------------------

async function toonVenster() {
  const doc = await vexel.document();
  const cmyk = doc.kleurruimte === 'cmyk';
  const sel = (await leesSelectie()).filter((o) => o.kader);
  const selKader = selectieKader(sel);
  const w0 = { ...STANDAARD, ...((await vexel.haal('instellingen')) || {}) };
  if (w0.maatSoort === 'selectie' && !selKader) w0.maatSoort = 'tekst';

  const plan = planner(() => teken());
  const doek = maakDoek(260, 250);
  const soort = soortKiezer(SOORTEN, w0.soort, tekenSoortIcoon, plan, 5);
  const maatSoort = keuzeVeld([
    ['tekst', 'Passend om de tekst'],
    ['vast', 'Vaste maat'],
    ['selectie', selKader ? 'Om de selectie heen' : 'Om de selectie heen (niets geselecteerd)'],
  ], w0.maatSoort);
  const bVeld = getalVeld(w0.b, 5, 1000, 1, true);
  const hVeld = getalVeld(w0.h, 5, 1000, 1, true);
  const afronding = schuif(w0.afronding, 0, 100, 5, (n) => `${n}%`);
  const tekst = maak('textarea', { klasse: 'veld', rows: 2, maxlength: 400, spellcheck: 'false',
    stijl: { height: '48px', padding: '5px 8px', resize: 'none', lineHeight: '1.35', flex: '1' } });
  tekst.value = w0.tekst;
  const grootte = getalVeld(w0.grootte, 4, 200, 1, true);
  const gewicht = keuzeVeld([['400', 'Normaal'], ['600', 'Halfvet'], ['800', 'Vet']], String(w0.gewicht));
  const richting = schuif(w0.richting, -180, 180, 5, (n) => `${n}°`);
  const lengte = getalVeld(w0.lengte, 0, 500, 1, true);
  const breedte = getalVeld(w0.breedte, 1, 200, 0.5, true);
  const kromming = schuif(w0.kromming, -100, 100, 5, (n) => `${n}%`);
  const vulling = kleurVak(w0.vulling === 'geen' ? '#ffffff' : w0.vulling, 'Vulling');
  const geenVulling = vinkje('geen', w0.vulling === 'geen');
  const lijn = kleurVak(w0.lijn, 'Lijnkleur');
  const lijndikte = getalVeld(w0.lijndikte, 0, 10, 0.05, true);
  const tekstKleur = kleurVak(w0.tekstKleur, 'Tekstkleur');
  const variant = variantKiezer(w0.zaad, 'Andere vorm', plan);

  const maatRij = rij('Breedte × hoogte', bVeld, maak('span', { klasse: 'tussen', tekst: '×' }), hVeld, eenheid('mm'));
  const afrondingRij = rij('Hoeken', ...afronding.delen);
  const variantRij = rij('Variant', variant.blok);
  const venster = bouwVenster({
    maakTekst: 'Ballon maken',
    links: [doek, soort.blok],
    rechts: [
      maak('div', { klasse: 'kop', tekst: 'Ballon' }),
      rij('Maat', maatSoort),
      maatRij,
      afrondingRij,
      variantRij,
      maak('div', { klasse: 'kop', tekst: 'Staart' }),
      rij('Richting', ...richting.delen),
      rij('Lengte · breedte', lengte, maak('span', { klasse: 'tussen', tekst: '·' }), breedte, eenheid('mm')),
      rij('Kromming', ...kromming.delen),
      maak('div', { klasse: 'kop', tekst: 'Tekst en kleur' }),
      rij('Tekst', tekst),
      rij('Grootte', grootte, eenheid('pt'), gewicht, maak('div', { klasse: 'stalen', stijl: { flex: 'none' } }, tekstKleur)),
      rij('Vulling · lijn', maak('div', { klasse: 'stalen' }, vulling, geenVulling.blok, lijn, lijndikte, eenheid('mm'))),
    ],
  });

  const waarden = () => ({
    soort: soort.waarde(),
    maatSoort: maatSoort.value,
    b: begrens(leesGetal(bVeld, 70), 5, 1000),
    h: begrens(leesGetal(hVeld, 40), 5, 1000),
    afronding: begrens(leesGetal(afronding.invoer, 40), 0, 100),
    tekst: tekst.value.slice(0, 400),
    grootte: begrens(leesGetal(grootte, 14), 4, 200),
    gewicht: Number(gewicht.value) || 600,
    richting: begrens(leesGetal(richting.invoer, 120), -180, 180),
    lengte: begrens(leesGetal(lengte, 14), 0, 500),
    breedte: begrens(leesGetal(breedte, 9), 1, 200),
    kromming: begrens(leesGetal(kromming.invoer, 25), -100, 100),
    vulling: geenVulling.invoer.checked ? 'geen' : vulling.value,
    lijn: lijn.value,
    lijndikte: begrens(leesGetal(lijndikte, 0.5), 0, 10),
    tekstKleur: tekstKleur.value,
    zaad: variant.waarde(),
  });

  /** Waar de ballon komt: om de selectie, of midden op het tekengebied. */
  const plekVoor = (w) => {
    if (w.maatSoort === 'selectie' && selKader) {
      return { cx: selKader.x + selKader.b / 2, cy: selKader.y + selKader.h / 2, binnen: selKader };
    }
    return { cx: doc.tekengebied.b / 2, cy: doc.tekengebied.h / 2 };
  };

  function teken() {
    const w = waarden();
    maatRij.style.display = w.maatSoort === 'vast' ? '' : 'none';
    afrondingRij.style.display = w.soort === 'rechthoek' ? '' : 'none';
    variantRij.style.display = w.soort === 'gedachte' || w.soort === 'schreeuw' ? '' : 'none';
    let fout = null;
    const tm = tekstMaat(w);
    if (w.maatSoort === 'selectie' && !selKader) fout = 'Selecteer eerst iets om de ballon omheen te zetten, of kies een andere maat.';
    if (w.maatSoort === 'tekst' && !tm) fout = 'Typ een tekst, of kies een vaste maat voor een lege ballon.';
    const plek = plekVoor(w);
    const metTekst = w.maatSoort !== 'selectie';
    let uit = null;
    if (!fout) uit = bouwVormen(w, plek, false, metTekst);
    const vormen = uit ? uit.vormen : [];
    const k = kaderVanVormen(vormen);
    const r = k ? Math.max(k.b, k.h) * 0.6 : 1;
    const kader = k ? { x: k.x + k.b / 2 - r, y: k.y + k.h / 2 - r, b: 2 * r, h: 2 * r } : null;
    tekenVoorbeeld(doek, {
      kader, vormen, ondergrond: '#e9edf3', marge: 10, minLijn: 0.75,
      onder: (g) => {
        if (w.maatSoort !== 'selectie' || !selKader) return;
        g.fillStyle = 'rgba(90, 162, 255, 0.18)';
        g.strokeStyle = 'rgba(90, 162, 255, 0.9)';
        g.lineWidth = r / 160;
        g.fillRect(selKader.x, selKader.y, selKader.b, selKader.h);
        g.strokeRect(selKader.x, selKader.y, selKader.b, selKader.h);
      },
    });
    const naam = { spraak: 'Spraak', gedachte: 'Gedachte', schreeuw: 'Schreeuw', fluister: 'Fluister', rechthoek: 'Rechthoekige ' }[w.soort];
    const maatTekst = uit ? `${mmVan(uit.maat.b)} × ${mmVan(uit.maat.h)} mm` : '';
    const waar = w.maatSoort === 'selectie' ? 'om de selectie' : 'midden op het tekengebied';
    toonStatus(venster, doc, `${naam}ballon van ${maatTekst}, ${waar}.`, fout);
  }

  venster.formulier.addEventListener('input', plan);
  venster.formulier.addEventListener('change', plan);
  venster.formulier.addEventListener('submit', (gebeurtenis) => {
    gebeurtenis.preventDefault();
    const w = waarden();
    if (venster.maakKnop.disabled) return;
    const { vormen } = bouwVormen(w, plekVoor(w), cmyk, w.maatSoort !== 'selectie');
    const achter = w.maatSoort === 'selectie';
    maakInVexel(venster, vormen, {
      instellingen: w, opties: achter ? { achteraan: true } : undefined,
      melding: achter ? 'Tekstballon gemaakt, achteraan in de laag zodat je selectie zichtbaar blijft.' : 'Tekstballon gemaakt.',
    });
  });

  teken();
  tekst.focus();
}

vexel.opCommando('maken', toonVenster);
