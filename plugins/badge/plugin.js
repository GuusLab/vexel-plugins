// Badge: stickers en badges met gecentreerde tekst, zoals een prijsster of een rozet.
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
  vorm: 'ster', punten: 20, diepte: 14, binnenrand: 'stippel', maat: 50, kanteling: -8,
  tekst: 'NU\n-25%', tekstgrootte: 100, palet: 'rood', kleuren: null,
};

const VORMEN = [
  ['ster', 'Prijsster (scherpe punten)'],
  ['zon', 'Zonnebadge (golfrand)'],
  ['rozet', 'Rozet met lintjes'],
  ['cirkel', 'Cirkel met dubbele rand'],
  ['schild', 'Schild met dubbele rand'],
];

// kleur 1 = vorm, kleur 2 = tekst en rand, kleur 3 = accent (lintjes)
const PALETTEN = {
  rood: { naam: 'Rood en geel', kleuren: ['#e63946', '#ffffff', '#ffc94d'] },
  geel: { naam: 'Geel en zwart', kleuren: ['#ffd60a', '#141414', '#141414'] },
  groen: { naam: 'Groen en zand', kleuren: ['#1f7a6d', '#fdf6e3', '#e9c46a'] },
  goud: { naam: 'Zwart en goud', kleuren: ['#16161a', '#e8c26e', '#c99a3c'] },
  blauw: { naam: 'Blauw', kleuren: ['#2346d8', '#ffffff', '#ff5d73'] },
  roze: { naam: 'Roze', kleuren: ['#ff4f9a', '#ffffff', '#5b2bd6'] },
};

// ---- de vormen ---------------------------------------------------------------

/** De buitenrand rond (0, 0) met straal R. */
function buitenrand(w, R) {
  const d = w.diepte / 100;
  if (w.vorm === 'cirkel') return cirkelSubpad(0, 0, R);
  if (w.vorm === 'schild') return schildSubpad(R);
  const n = w.punten;
  const punten = [];
  for (let i = 0; i < 2 * n; i++) {
    const hoek = -Math.PI / 2 + (i * Math.PI) / n;
    const s = i % 2 ? R * (1 - d) : R;
    punten.push({ x: Math.cos(hoek) * s, y: Math.sin(hoek) * s });
  }
  return { gesloten: true, punten: w.vorm === 'ster' ? punten : gladGesloten(punten, 1) };
}

function schildSubpad(R, f = 1, dy = 0) {
  const a = 0.84 * R * f;
  const h = R * f;
  const y = (v) => v + dy;
  return {
    gesloten: true,
    punten: [
      { x: -a, y: y(-h) },
      { x: 0, y: y(-h * 0.92), in: { x: -a * 0.45, y: y(-h * 0.92) }, uit: { x: a * 0.45, y: y(-h * 0.92) } },
      { x: a, y: y(-h) },
      { x: a, y: y(0.05 * h), uit: { x: a, y: y(0.55 * h) } },
      { x: 0, y: y(h), in: { x: a * 0.5, y: y(0.82 * h) }, uit: { x: -a * 0.5, y: y(0.82 * h) } },
      { x: -a, y: y(0.05 * h), in: { x: -a, y: y(0.55 * h) } },
    ],
  };
}

/** Straal van het vlak binnen de rand, waar de tekst en de binnenrand in passen. */
function binnenStraal(w, R) {
  if (w.vorm === 'cirkel') return R * 0.9;
  if (w.vorm === 'schild') return R * 0.86;
  return R * (1 - w.diepte / 100) * (w.vorm === 'ster' ? 0.88 : 0.9);
}

function lintjes(R) {
  const lint = (kant) => {
    const c0 = { x: kant * 0.2 * R, y: 0.35 * R };
    const c1 = { x: kant * 0.6 * R, y: 1.72 * R };
    const lengte = Math.hypot(c1.x - c0.x, c1.y - c0.y);
    const ux = (c1.x - c0.x) / lengte;
    const uy = (c1.y - c0.y) / lengte;
    const nx = -uy * 0.2 * R;
    const ny = ux * 0.2 * R;
    const inkeping = { x: c1.x - ux * 0.24 * R, y: c1.y - uy * 0.24 * R };
    return {
      gesloten: true,
      punten: [
        { x: c0.x + nx, y: c0.y + ny }, { x: c1.x + nx, y: c1.y + ny }, inkeping,
        { x: c1.x - nx, y: c1.y - ny }, { x: c0.x - nx, y: c0.y - ny },
      ],
    };
  };
  return [lint(-1), lint(1)];
}

// geschatte breedte van een teken in em bij een zware letter
function tekenBreedte(t) {
  if (t === ' ') return 0.28;
  if (t === '%' || t === 'M' || t === 'W' || t === '€') return 0.86;
  if (t === 'I' || t === '!' || t === '.' || t === ',' || t === ':' || t === '1') return 0.42;
  if (t === '-' || t === '+') return 0.5;
  if (/[A-Z0-9]/.test(t)) return 0.68;
  return 0.58;
}
const regelBreedte = (regel) => [...regel].reduce((s, t) => s + tekenBreedte(t), 0);

/** Tekstregels zo groot mogelijk binnen een vierkant, kortere regels groter (tot 1,8 keer). */
function tekstRegels(regels, straal, schaal) {
  if (!regels.length) return [];
  const breed = straal * 1.42;
  const hoog = straal * 1.25;
  let maten = regels.map((r) => breed / Math.max(1.6, regelBreedte(r)));
  const kleinste = Math.min(...maten);
  maten = maten.map((m) => Math.min(m, kleinste * 1.8));
  const hoogte = (m) => m.reduce((s, g) => s + g * 0.73, 0) + (m.length - 1) * Math.min(...m) * 0.32;
  const f = Math.min(1, hoog / hoogte(maten)) * schaal;
  maten = maten.map((m) => m * f);
  let y = -hoogte(maten) / 2;
  return regels.map((regel, i) => {
    y += maten[i] * 0.73;
    const uit = { regel, grootte: maten[i], basislijn: y };
    y += Math.min(...maten) * 0.32;
    return uit;
  });
}

function bouwVormen(w, cx, cy, cmyk) {
  const R = vexel.mm(w.maat) / 2;
  const [kVorm, kTekst, kAccent] = w.kleuren;
  // alles draait om het midden van de badge; tekst krijgt dezelfde draai
  const hoek = (w.kanteling * Math.PI) / 180;
  const cos = Math.cos(hoek);
  const sin = Math.sin(hoek);
  const draai = (p) => ({ x: cx + p.x * cos - p.y * sin, y: cy + p.x * sin + p.y * cos });
  const plek = (sp) => zetOm([sp], draai)[0];
  const kinderen = [];
  if (w.vorm === 'rozet') {
    const [l1, l2] = lintjes(R).map(plek);
    kinderen.push({
      soort: 'groep',
      naam: 'Lintjes',
      kinderen: [
        { soort: 'pad', naam: 'Lint links', subpaden: [l1], vulling: kleurVoor(kAccent, cmyk), lijn: null, lijndikte: 0 },
        { soort: 'pad', naam: 'Lint rechts', subpaden: [l2], vulling: kleurVoor(mengHex(kAccent, '#000000', 0.18), cmyk), lijn: null, lijndikte: 0 },
      ],
    });
  }
  kinderen.push({ soort: 'pad', naam: 'Vorm', subpaden: [plek(buitenrand(w, R))], vulling: kleurVoor(kVorm, cmyk), lijn: null, lijndikte: 0 });

  const rb = binnenStraal(w, R);
  const dikte = Math.max(0.5, R * 0.022);
  const lijnStijl = { vulling: null, lijn: kleurVoor(kTekst, cmyk), lijndikte: dikte, lijneinde: 'round' };
  const dubbel = w.vorm === 'cirkel' || w.vorm === 'schild';
  const ring = (f) => plek(w.vorm === 'schild' ? schildSubpad(R, f, -0.02 * R) : cirkelSubpad(0, 0, rb * f));
  if (w.binnenrand !== 'geen') {
    const streep = w.binnenrand === 'stippel' ? { streep: [0, dikte * 2.6] } : {};
    const f1 = w.vorm === 'schild' ? 0.88 : 0.94;
    kinderen.push({ soort: 'pad', naam: 'Binnenrand', subpaden: [ring(f1)], ...lijnStijl, ...streep });
    if (dubbel) kinderen.push({ soort: 'pad', naam: 'Binnenrand 2', subpaden: [ring(f1 - 0.05)], ...lijnStijl, lijndikte: dikte * 0.5 });
  }

  const regels = w.tekst.split('\n').map((r) => r.trim()).filter(Boolean).slice(0, 4);
  const midden = w.vorm === 'schild' ? -0.08 * R : 0;
  const teksten = tekstRegels(regels, rb * (w.binnenrand === 'geen' ? 0.94 : 0.84), w.tekstgrootte / 100).map((t) => {
    const p = draai({ x: 0, y: midden + t.basislijn });
    const tekst = { soort: 'tekst', x: p.x, y: p.y, inhoud: t.regel, grootte: Math.max(1, t.grootte), gewicht: 800,
      uitlijning: 'midden', vulling: kleurVoor(kTekst, cmyk), lijn: null };
    if (w.kanteling) tekst.draai = w.kanteling;
    return tekst;
  });
  if (teksten.length === 1) kinderen.push({ ...teksten[0], naam: 'Tekst' });
  else if (teksten.length) kinderen.push({ soort: 'groep', naam: 'Tekst', kinderen: teksten });

  const kort = regels.join(' ').slice(0, 40);
  return [{ soort: 'groep', naam: kort ? `Badge · ${kort}` : 'Badge', kinderen }];
}

// ---- het venster ------------------------------------------------------------

async function toonVenster() {
  const doc = await vexel.document();
  const cmyk = doc.kleurruimte === 'cmyk';
  const w0 = { ...STANDAARD, ...((await vexel.haal('instellingen')) || {}) };
  if (!PALETTEN[w0.palet] && w0.palet !== 'eigen') w0.palet = STANDAARD.palet;

  const plan = planner(() => teken());
  const doek = maakDoek(250, 250);
  const vorm = keuzeVeld(VORMEN, w0.vorm);
  const punten = schuif(w0.punten, 6, 48, 1);
  const diepte = schuif(w0.diepte, 3, 40, 1, (n) => `${n}%`);
  const binnenrand = keuzeVeld([['stippel', 'Stippellijn'], ['lijn', 'Lijn'], ['geen', 'Geen']], w0.binnenrand);
  const maat = getalVeld(w0.maat, 5, 1000, 1);
  const kanteling = schuif(w0.kanteling, -30, 30, 1, (n) => `${n}°`);
  const tekst = maak('textarea', { klasse: 'veld', rows: 3, maxlength: 120, spellcheck: 'false',
    stijl: { height: '62px', padding: '5px 8px', resize: 'none', lineHeight: '1.35' } });
  tekst.value = w0.tekst;
  const tekstgrootte = schuif(w0.tekstgrootte, 40, 100, 5, (n) => `${n}%`);
  const palet = paletKiezer(PALETTEN, w0.palet, w0.kleuren, 3, plan);

  const puntenRij = rij('Punten', ...punten.delen);
  const diepteRij = rij('Diepte', ...diepte.delen);
  const venster = bouwVenster({
    maakTekst: 'Badge maken',
    links: [doek, maak('p', { klasse: 'uitleg', stijl: { margin: '0' }, tekst: 'Enter in de tekst maakt een nieuwe regel.' })],
    rechts: [
      maak('div', { klasse: 'kop', tekst: 'Vorm' }),
      rij('Soort', vorm),
      puntenRij,
      diepteRij,
      rij('Binnenrand', binnenrand),
      rij('Breedte', maat, eenheid('mm')),
      rij('Kanteling', ...kanteling.delen),
      maak('div', { klasse: 'kop', tekst: 'Tekst en kleur' }),
      rij('Tekst', tekst),
      rij('Tekstgrootte', ...tekstgrootte.delen),
      rij('Palet', palet.keuze),
      rij('Vorm · tekst · lint', palet.stalen),
    ],
  });

  const waarden = () => ({
    vorm: vorm.value,
    punten: Math.round(begrens(leesGetal(punten.invoer, 20), 6, 48)),
    diepte: begrens(leesGetal(diepte.invoer, 14), 3, 40),
    binnenrand: binnenrand.value,
    maat: begrens(leesGetal(maat, 50), 5, 1000),
    kanteling: begrens(leesGetal(kanteling.invoer, 0), -30, 30),
    tekst: tekst.value.slice(0, 120),
    tekstgrootte: begrens(leesGetal(tekstgrootte.invoer, 100), 40, 100),
    palet: palet.sleutel(),
    kleuren: palet.kleuren(),
  });

  function teken() {
    const w = waarden();
    const gekarteld = w.vorm === 'ster' || w.vorm === 'zon' || w.vorm === 'rozet';
    puntenRij.style.opacity = diepteRij.style.opacity = gekarteld ? '1' : '0.4';
    punten.invoer.disabled = diepte.invoer.disabled = !gekarteld;
    const vormen = bouwVormen(w, 0, 0, false);
    const k = kaderVan(vormen[0].kinderen.filter((v) => v.soort !== 'tekst' && v.soort !== 'groep' || v.naam === 'Lintjes')
      .flatMap((v) => (v.soort === 'groep' ? v.kinderen : [v])).flatMap((v) => v.subpaden || []));
    const r = Math.max(k.b, k.h) * 0.62;
    const cx = k.x + k.b / 2;
    const cy = k.y + k.h / 2;
    tekenVoorbeeld(doek, {
      kader: { x: cx - r, y: cy - r, b: 2 * r, h: 2 * r }, vormen, ondergrond: '#f4f2ee', marge: 12,
    });
    const regels = w.tekst.split('\n').filter((x) => x.trim()).length;
    const fout = regels > 4 ? 'Hooguit 4 regels tekst: haal er een paar weg.' : null;
    const wat = { ster: 'Prijsster', zon: 'Zonnebadge', rozet: 'Rozet', cirkel: 'Cirkelbadge', schild: 'Schild' }[w.vorm];
    toonStatus(venster, doc, `${wat} van ${getal(w.maat, 1)} mm met ${regels || 'geen'} ${regels === 1 ? 'regel' : 'regels'} tekst, als één groep.`, fout);
  }

  venster.formulier.addEventListener('input', plan);
  venster.formulier.addEventListener('change', plan);
  venster.formulier.addEventListener('submit', (gebeurtenis) => {
    gebeurtenis.preventDefault();
    const w = waarden();
    const vormen = bouwVormen(w, doc.tekengebied.b / 2, doc.tekengebied.h / 2, cmyk);
    maakInVexel(venster, vormen, {
      instellingen: w,
      melding: 'Badge gemaakt.',
    });
  });

  teken();
  tekst.focus();
}

vexel.opCommando('maken', toonVenster);
