// Korrel: een spikkel- of stippeltextuur van echte vectorstippen, met een verloop van dicht naar ijl.
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
const tussen = (r, a, b) => a + (b - a) * r();
const kies = (r, lijst) => lijst[Math.floor(r() * lijst.length) % lijst.length];

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
/** Helderheid 0 (zwart) tot 1 (wit). */
function helderheid(hex) {
  const [r, g, b] = hexNaarRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}
/** Een kleur voor Vexel: CMYK in een CMYK-document, anders hex. */
const kleurVoor = (hex, cmyk) => (cmyk ? { cmyk: hexNaarCmyk(hex) } : { hex: String(hex).toLowerCase() });
const kleurCss = (k) => (!k ? null : k.hex ? k.hex : cmykNaarHex(k.cmyk));

// ---- geometrie --------------------------------------------------------------

const BOOG = 0.5522847498; // handvatlengte voor een kwartcirkel als bezier

/** Een cirkel als subpad met vier punten; `andersom` draait de richting om (voor gaten). */
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

/** Maakt van losse punten een vloeiende gesloten kromme (Catmull-Rom als bezier). */
function gladGesloten(punten, spanning = 1) {
  const n = punten.length;
  return punten.map((p, i) => {
    const a = punten[(i - 1 + n) % n];
    const b = punten[(i + 1) % n];
    const dx = ((b.x - a.x) / 6) * spanning;
    const dy = ((b.y - a.y) / 6) * spanning;
    return { x: p.x, y: p.y, in: { x: p.x - dx, y: p.y - dy }, uit: { x: p.x + dx, y: p.y + dy } };
  });
}

/** Zelfde voor een open kromme: de uiteinden krijgen een handvat in hun eigen richting. */
function gladOpen(punten, spanning = 1) {
  const n = punten.length;
  return punten.map((p, i) => {
    const a = punten[Math.max(0, i - 1)];
    const b = punten[Math.min(n - 1, i + 1)];
    const f = i === 0 || i === n - 1 ? 3 : 6;
    const dx = ((b.x - a.x) / f) * spanning;
    const dy = ((b.y - a.y) / f) * spanning;
    return { x: p.x, y: p.y, in: { x: p.x - dx, y: p.y - dy }, uit: { x: p.x + dx, y: p.y + dy } };
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
        g.rotate((v.draai * Math.PI) / 180);
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
      g.fill(pad);
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
 * vel: optioneel het tekengebied, als wit vel met schaduw; daarbuiten wordt niets getekend.
 */
function tekenVoorbeeld(doek, { kader, vormen, vel = null, marge = 16, ondergrond = null, draai = null, minLijn = 0 }) {
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
    g.beginPath();
    g.rect(vel.x, vel.y, vel.b, vel.h);
    g.clip();
  }
  if (draai && draai.graden) {
    g.translate(draai.cx, draai.cy);
    g.rotate((draai.graden * Math.PI) / 180);
    g.translate(-draai.cx, -draai.cy);
  }
  tekenVormen(g, vormen, minLijn / f);
  g.restore();
  return { f, ox, oy };
}

// ---- het venster ------------------------------------------------------------

const STIJL = `
  .venster { display: grid; grid-template-columns: auto 1fr; gap: 16px; align-items: start; }
  .venster .links { display: grid; gap: 8px; }
  .venster .rechts { display: grid; gap: 0; min-width: 0; }
  .venster .rij { margin: 0 0 7px; min-height: 26px; }
  .venster .label { min-width: 84px; }
  .venster .kop { margin: 6px 0 8px; font-size: 10.5px; letter-spacing: 0.06em; text-transform: uppercase;
    color: var(--tekst-zacht); opacity: 0.75; }
  .venster .kop:first-child { margin-top: 0; }
  .venster input[type=range] { flex: 1; min-width: 0; margin: 0; }
  .venster output { min-width: 38px; text-align: right; font-variant-numeric: tabular-nums; }
  .venster .eenheid { min-width: 22px; }
  .stalen { display: flex; gap: 6px; flex: 1; }
  .stalen input[type=color] { width: 26px; height: 26px; padding: 0; border: 1px solid var(--lijn);
    border-radius: 6px; background: none; cursor: pointer; flex: none; }
  .stalen input[type=color]::-webkit-color-swatch-wrapper { padding: 2px; }
  .stalen input[type=color]::-webkit-color-swatch { border: none; border-radius: 4px; }
  .samenvatting { margin: 0; min-height: 17px; }
  .samenvatting.fout { color: var(--rood, #ff6b6b); }
  .onderbalk { display: flex; align-items: center; gap: 8px; margin-top: 12px; }
  .onderbalk .samenvatting { flex: 1; }
  .variant { display: flex; gap: 6px; align-items: center; }
  .variant .veld { width: 74px; flex: none; }
  .variant .knop { flex: 1; }
  .vink { display: flex; align-items: center; gap: 6px; color: var(--tekst); }
`;

/** Een rij met een label links en de velden rechts. */
function rij(labelTekst, ...inhoud) {
  const velden = inhoud.filter((el) => el && ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(el.tagName));
  const tag = velden.length === 1 ? 'label' : 'div';
  return maak(tag, { klasse: 'rij' }, maak('span', { klasse: 'label', tekst: labelTekst }), ...inhoud);
}

function getalVeld(waarde, min, max, stap) {
  return maak('input', { klasse: 'veld', type: 'number', value: waarde, min, max, step: stap, inputmode: 'decimal' });
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
  return { invoer, uitkomst, delen: [invoer, uitkomst] };
}

function vinkje(tekst, aan) {
  const invoer = maak('input', { type: 'checkbox' });
  invoer.checked = !!aan;
  return { invoer, blok: maak('label', { klasse: 'vink' }, invoer, maak('span', { tekst })) };
}

/**
 * Paletkeuze: een keuzelijst met paletten en een rij kleurvakjes die je zelf kunt aanpassen.
 * paletten: { sleutel: { naam, kleuren: [hex, ...] } }
 */
function paletKiezer(paletten, sleutel, eigenKleuren, aantal, bijWijziging) {
  const opties = Object.entries(paletten).map(([s, p]) => [s, p.naam]).concat([['eigen', 'Eigen kleuren']]);
  const keuze = keuzeVeld(opties, sleutel);
  const stalen = maak('div', { klasse: 'stalen' });
  const vakjes = [];
  const startKleuren = keuze.value === 'eigen' && Array.isArray(eigenKleuren) ? eigenKleuren : paletten[keuze.value].kleuren;
  for (let i = 0; i < aantal; i++) {
    const vak = maak('input', { type: 'color', value: geldigHex(startKleuren[i]) ? startKleuren[i] : '#888888', title: `Kleur ${i + 1}` });
    vak.addEventListener('input', () => {
      keuze.value = 'eigen';
      bijWijziging();
    });
    vakjes.push(vak);
    stalen.append(vak);
  }
  keuze.addEventListener('change', () => {
    const p = paletten[keuze.value];
    if (p) p.kleuren.forEach((k, i) => { if (vakjes[i]) vakjes[i].value = k; });
    bijWijziging();
  });
  return {
    keuze,
    stalen,
    kleuren: () => vakjes.map((v) => v.value),
    sleutel: () => keuze.value,
  };
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
async function maakInVexel(venster, vormen, { instellingen, melding, opties, naMaak }) {
  const t = telVormen(vormen);
  if (t.n > 5000 || t.p > 50000) {
    vexel.melding(`Dat is te veel in één keer (${getal(t.n, 0)} vormen, ${getal(t.p, 0)} punten). Kies minder of grotere elementen.`, 'let');
    return;
  }
  venster.maakKnop.disabled = true;
  try {
    const ids = await vexel.maak(vormen, opties);
    if (naMaak) await naMaak(ids);
    await vexel.bewaar('instellingen', instellingen);
    vexel.melding(melding, 'ok');
    vexel.sluit();
  } catch (fout) {
    venster.maakKnop.disabled = false;
    vexel.melding(fout && fout.message ? fout.message : 'Dat lukte niet. Probeer het nog eens.', 'fout');
  }
}

/** Het tekengebied als kader in pt; met `afloopMm` erbij, of null voor de afloop van het document. */
function tekengebiedKader(doc, afloopMm = 0) {
  const a = afloopMm === null && doc.afloop ? doc.afloop : null;
  if (a) return { x: -a.links, y: -a.boven, b: doc.tekengebied.b + a.links + a.rechts, h: doc.tekengebied.h + a.boven + a.onder };
  const m = vexel.mm(afloopMm === null ? 3 : afloopMm);
  return { x: -m, y: -m, b: doc.tekengebied.b + 2 * m, h: doc.tekengebied.h + 2 * m };
}

/** Kent Vexel de afloop van het document? Dan is een eigen veld niet nodig. */
const heeftAfloop = (doc) => !!(doc.afloop && ['boven', 'rechts', 'onder', 'links'].every((k) => Number.isFinite(doc.afloop[k])));
/** De afloop om te gebruiken: die van het document, of de waarde uit het veld. */
const afloopVoor = (doc, mm) => (heeftAfloop(doc) ? null : mm);

/** Het omsluitende kader van een selectie, of null. */
function selectieKader(items) {
  const k = (items || []).map((o) => o.kader).filter((q) => q && q.b > 0 && q.h > 0);
  if (!k.length) return null;
  const x = Math.min(...k.map((q) => q.x));
  const y = Math.min(...k.map((q) => q.y));
  return { x, y, b: Math.max(...k.map((q) => q.x + q.b)) - x, h: Math.max(...k.map((q) => q.y + q.h)) - y };
}

const mmVan = (pt) => getal(pt * PT_NAAR_MM, 0);

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
  return { x: x0, y: y0, b: x1 - x0, h: y1 - y0 };
}

// ---- instellingen ------------------------------------------------------------

const STANDAARD = {
  doel: 'tekengebied', afloop: 3, dichtheid: 16, min: 0.3, max: 0.9, richting: 'onder', verloop: 85,
  vorm: 'korrel', zaad: 2024, palet: 'inkt', kleuren: null,
};

const RICHTINGEN = [
  ['geen', 'Geen verloop (gelijkmatig)'],
  ['onder', 'Dicht onder, ijl boven'],
  ['boven', 'Dicht boven, ijl onder'],
  ['links', 'Dicht links, ijl rechts'],
  ['rechts', 'Dicht rechts, ijl links'],
  ['schuin', 'Dicht linksonder, ijl rechtsboven'],
  ['midden', 'Dicht in het midden'],
  ['rand', 'Dicht aan de rand'],
];

const PALETTEN = {
  inkt: { naam: 'Zwart', kleuren: ['#1b1b1b'] },
  blauw: { naam: 'Drukblauw', kleuren: ['#0078bf'] },
  roze: { naam: 'Fluorroze', kleuren: ['#ff48b0'] },
  rood: { naam: 'Warm rood', kleuren: ['#e8452c'] },
  groen: { naam: 'Groen', kleuren: ['#00a95c'] },
  wit: { naam: 'Wit (op een donker vlak)', kleuren: ['#ffffff'] },
};

const MAX_STIPPEN = 12000; // 4 punten per stip: past binnen 50 000 punten per keer

// ---- de stippen -----------------------------------------------------------------

/** Hoe dicht het is op plek (u, v) in het vak (0 tot 1): 1 is vol, 0 is leeg. */
function dichtheidOp(w, u, v) {
  const sterk = w.verloop / 100;
  let t;
  switch (w.richting) {
    case 'onder': t = 1 - v; break;
    case 'boven': t = v; break;
    case 'links': t = u; break;
    case 'rechts': t = 1 - u; break;
    case 'schuin': t = (u + (1 - v)) / 2; break;
    case 'midden': t = Math.min(1, Math.hypot(u - 0.5, v - 0.5) / 0.62); break;
    case 'rand': t = 1 - Math.min(1, Math.hypot(u - 0.5, v - 0.5) / 0.62); break;
    default: return 1;
  }
  // zacht verlopen: eerst langzaam, dan sneller ijl
  const f = 1 - t * t * (3 - 2 * t);
  return 1 - sterk + sterk * f;
}

/** Een stip als subpad: rond of als onregelmatige korrel. */
function stip(r, cx, cy, straal, korrelig) {
  if (!korrelig) return cirkelSubpad(cx, cy, straal);
  const draai = r() * Math.PI * 2;
  const punten = [];
  for (let i = 0; i < 4; i++) {
    const a = draai + (i * Math.PI) / 2 + (r() - 0.5) * 0.7;
    const s = straal * (0.72 + 0.5 * r());
    punten.push({ x: cx + Math.cos(a) * s, y: cy + Math.sin(a) * s });
  }
  return { gesloten: true, punten: gladGesloten(punten, 1.25) };
}

/**
 * Plaatst de stippen: een fijn raster met per cel één kandidaat op een willekeurige plek
 * (gelijkmatiger dan puur toeval), die blijft staan met de kans uit het verloop.
 */
function bouwKorrel(w, vak, cmyk) {
  const r = willekeur(w.zaad);
  const cm2 = (vak.b * PT_NAAR_MM * vak.h * PT_NAAR_MM) / 100;
  let gemiddeld = 0;
  for (let j = 0; j < 20; j++) for (let i = 0; i < 20; i++) gemiddeld += dichtheidOp(w, (i + 0.5) / 20, (j + 0.5) / 20) / 400;
  const verwacht = cm2 * w.dichtheid * gemiddeld;
  const beperkt = verwacht > MAX_STIPPEN;
  const factor = beperkt ? MAX_STIPPEN / verwacht : 1;
  const kandidaten = Math.max(1, cm2 * w.dichtheid * factor);
  const cel = Math.sqrt((vak.b * vak.h) / kandidaten);
  const kol = Math.max(1, Math.ceil(vak.b / cel));
  const rij = Math.max(1, Math.ceil(vak.h / cel));
  const rMin = vexel.mm(Math.min(w.min, w.max)) / 2;
  const rMax = vexel.mm(Math.max(w.min, w.max)) / 2;
  const subpaden = [];
  for (let j = 0; j < rij && subpaden.length < MAX_STIPPEN; j++) {
    for (let i = 0; i < kol && subpaden.length < MAX_STIPPEN; i++) {
      const u = (i + r()) / kol;
      const v = (j + r()) / rij;
      const kans = dichtheidOp(w, u, v);
      const grootte = r();
      if (r() >= kans) continue;
      // in het ijle deel worden de stippen ook iets kleiner
      const straal = rMin + (rMax - rMin) * grootte * (0.55 + 0.45 * kans);
      const x = vak.x + u * vak.b;
      const y = vak.y + v * vak.h;
      if (x - straal < vak.x || y - straal < vak.y || x + straal > vak.x + vak.b || y + straal > vak.y + vak.h) continue;
      subpaden.push(stip(r, x, y, straal, w.vorm === 'korrel'));
    }
  }
  if (!subpaden.length) return { fout: 'Er komen zo geen stippen: kies een hogere dichtheid of minder verloop.', aantal: 0, beperkt };
  const kleur = kleurVoor(w.kleuren[0], cmyk);
  const stukken = inStukken(subpaden).map((stuk, i, alle) => ({
    soort: 'pad', naam: alle.length > 1 ? `Stippen ${i + 1}` : 'Stippen', subpaden: stuk, vulling: kleur, lijn: null, lijndikte: 0,
  }));
  const naam = `Korrel · ${getal(subpaden.length, 0)} stippen`;
  return { vormen: [stukken.length === 1 ? { ...stukken[0], naam } : { soort: 'groep', naam, kinderen: stukken }], aantal: subpaden.length, beperkt };
}

// ---- het venster ------------------------------------------------------------

async function toonVenster() {
  const doc = await vexel.document();
  const cmyk = doc.kleurruimte === 'cmyk';
  const w0 = { ...STANDAARD, ...((await vexel.haal('instellingen')) || {}) };
  if (!PALETTEN[w0.palet] && w0.palet !== 'eigen') w0.palet = STANDAARD.palet;
  let selectie = null;
  try {
    selectie = selectieKader(await vexel.selectie());
  } catch (fout) {
    selectie = null;
  }

  const plan = planner(() => teken());
  const doek = maakDoek(250, 250);
  const detail = maakDoek(250, 74);
  const variant = variantKiezer(w0.zaad, 'Nieuwe korrel', plan);
  const doel = keuzeVeld([['tekengebied', 'Het tekengebied'], ['selectie', 'De selectie (kader)']], selectie ? 'selectie' : 'tekengebied');
  if (!selectie) doel.querySelector('option[value=selectie]').disabled = true;
  const afloop = getalVeld(w0.afloop, 0, 20, 0.5);
  const dichtheid = schuif(w0.dichtheid, 1, 60, 1, (n) => `${n}/cm²`);
  const min = getalVeld(w0.min, 0.05, 10, 0.05);
  const max = getalVeld(w0.max, 0.05, 10, 0.05);
  const richting = keuzeVeld(RICHTINGEN, w0.richting);
  const verloop = schuif(w0.verloop, 0, 100, 5, (n) => `${n}%`);
  const vorm = keuzeVeld([['korrel', 'Korrelig (onregelmatig)'], ['rond', 'Rond']], w0.vorm);
  const palet = paletKiezer(PALETTEN, w0.palet, w0.kleuren, 1, plan);
  palet.stalen.style.flex = 'none';
  min.style.width = max.style.width = '64px';
  min.style.flex = max.style.flex = 'none';

  const afloopRij = rij('Afloop', afloop, eenheid('mm'));
  if (heeftAfloop(doc)) afloopRij.style.display = 'none';
  const verloopRij = rij('Sterkte', ...verloop.delen);
  const venster = bouwVenster({
    maakTekst: 'Korrel maken',
    links: [doek, detail, variant.blok],
    rechts: [
      maak('div', { klasse: 'kop', tekst: 'Stippen' }),
      rij('Dichtheid', ...dichtheid.delen),
      rij('Stipgrootte', min, eenheid('tot'), max, eenheid('mm')),
      rij('Vorm', vorm),
      maak('div', { klasse: 'kop', tekst: 'Verloop' }),
      rij('Richting', richting),
      verloopRij,
      maak('div', { klasse: 'kop', tekst: 'Plaats en kleur' }),
      rij('Vullen', doel),
      afloopRij,
      rij('Kleur', palet.keuze, palet.stalen),
    ],
  });

  const waarden = () => ({
    doel: doel.value === 'selectie' && selectie ? 'selectie' : 'tekengebied',
    afloop: begrens(leesGetal(afloop, 3), 0, 20),
    dichtheid: begrens(leesGetal(dichtheid.invoer, 16), 1, 60),
    min: begrens(leesGetal(min, 0.3), 0.05, 10),
    max: begrens(leesGetal(max, 0.9), 0.05, 10),
    richting: richting.value,
    verloop: begrens(leesGetal(verloop.invoer, 85), 0, 100),
    vorm: vorm.value,
    zaad: variant.waarde(),
    palet: palet.sleutel(),
    kleuren: palet.kleuren(),
  });
  const vakVoor = (w) => (w.doel === 'selectie' ? selectie : tekengebiedKader(doc, afloopVoor(doc, w.afloop)));

  function teken() {
    const w = waarden();
    verloop.invoer.disabled = w.richting === 'geen';
    verloopRij.style.opacity = w.richting === 'geen' ? '0.4' : '1';
    afloop.disabled = w.doel === 'selectie';
    afloopRij.style.opacity = w.doel === 'selectie' ? '0.4' : '1';
    const vak = vakVoor(w);
    const uit = bouwKorrel(w, vak, false);
    const vel = tekengebiedKader(doc);
    const licht = helderheid(w.kleuren[0]) > 0.8;
    // een witte korrel tonen we op een donker vel, anders zie je niets
    const vormen = licht && uit.vormen ? [{ soort: 'rechthoek', x: vak.x, y: vak.y, b: vak.b, h: vak.h, vulling: { hex: '#2b2d33' } }, ...uit.vormen] : uit.vormen;
    tekenVoorbeeld(doek, { kader: vel, vel, vormen: vormen || [], marge: 12 });
    // een strook van 60 mm breed op ongeveer ware grootte, uit het midden van het vlak
    const strook = vexel.mm(60);
    const hoog = (strook * 74) / 250;
    tekenVoorbeeld(detail, { kader: { x: vak.x + vak.b / 2 - strook / 2, y: vak.y + vak.h / 2 - hoog / 2, b: strook, h: hoog }, vel, vormen: vormen || [], marge: 0 });
    const waar = w.doel === 'selectie' ? 'in de selectie' : 'over het tekengebied';
    const tekst = `${getal(uit.aantal, 0)} stippen ${waar}${uit.beperkt ? `, beperkt tot het maximum van ${getal(MAX_STIPPEN, 0)}` : ''}.`;
    toonStatus(venster, doc, tekst, uit.fout);
  }

  venster.formulier.addEventListener('input', plan);
  venster.formulier.addEventListener('change', plan);
  venster.formulier.addEventListener('submit', (gebeurtenis) => {
    gebeurtenis.preventDefault();
    const w = waarden();
    const uit = bouwKorrel(w, vakVoor(w), cmyk);
    if (uit.fout) {
      vexel.melding(uit.fout, 'let');
      return;
    }
    const extra = uit.beperkt ? ` (beperkt tot ${getal(MAX_STIPPEN, 0)}; kies grotere stippen of een kleiner vlak voor meer dichtheid)` : '';
    maakInVexel(venster, uit.vormen, { instellingen: w, melding: `Korrel gemaakt: ${getal(uit.aantal, 0)} stippen${extra}.` });
  });

  teken();
  variant.knop.focus();
}

vexel.opCommando('maken', toonVenster);
