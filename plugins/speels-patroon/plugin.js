// Speels patroon: een speels patroon in jaren-80-stijl met kronkels, driehoekjes, stippen en zigzagjes.
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
  grootte: 16, dichtheid: 85, vrij: 0, afloop: 3, achtergrond: true, zaad: 1985, palet: 'klassiek', kleuren: null,
  motieven: ['kronkel', 'driehoek', 'stippen', 'streepjes', 'cirkel', 'zigzag', 'kruis', 'stip'],
};

const MOTIEVEN = [
  ['kronkel', 'Kronkels', 'Kronkel'], ['driehoek', 'Driehoekjes', 'Driehoekje'], ['stippen', 'Stippenraster', 'Stippenraster'],
  ['streepjes', 'Streepjes', 'Streepjes'], ['cirkel', 'Cirkels', 'Cirkel'], ['zigzag', 'Zigzagjes', 'Zigzagje'],
  ['kruis', 'Kruisjes', 'Kruisje'], ['stip', 'Stippen', 'Stip'],
];

// kleur 1 = achtergrond, 2 tot en met 6 = de motieven
const PALETTEN = {
  klassiek: { naam: 'Jaren tachtig', kleuren: ['#fdf3e7', '#ff5fa2', '#ffcf3f', '#2ec4d6', '#1b1b1b', '#7b61ff'] },
  pastel: { naam: 'Pastel', kleuren: ['#fff8f0', '#f497b6', '#7cc6e8', '#fcd06b', '#8fd49b', '#b39ddb'] },
  primair: { naam: 'Primair', kleuren: ['#ffffff', '#e63946', '#1d3557', '#f4c20d', '#2a9d8f', '#111111'] },
  neon: { naam: 'Neon op zwart', kleuren: ['#121212', '#ff2e88', '#00f5d4', '#fee440', '#9b5de5', '#ffffff'] },
  zacht: { naam: 'Zand en zee', kleuren: ['#f4ead9', '#e76f51', '#264653', '#e9c46a', '#2a9d8f', '#f4a261'] },
};

// ---- verdeling zonder overlap (Poisson-schijven) -----------------------------------

/** Punten in een rechthoek die minstens `d` uit elkaar liggen (methode van Bridson). */
function poisson(r, b, h, d, max = 4000) {
  const cel = d / Math.SQRT2;
  const kol = Math.ceil(b / cel);
  const rij = Math.ceil(h / cel);
  const rooster = new Array(kol * rij).fill(-1);
  const punten = [];
  const actief = [];
  const voegToe = (p) => {
    punten.push(p);
    actief.push(p);
    rooster[Math.floor(p.y / cel) * kol + Math.floor(p.x / cel)] = punten.length - 1;
  };
  const vrij = (p) => {
    const ci = Math.floor(p.x / cel);
    const cj = Math.floor(p.y / cel);
    for (let j = Math.max(0, cj - 2); j <= Math.min(rij - 1, cj + 2); j++) {
      for (let i = Math.max(0, ci - 2); i <= Math.min(kol - 1, ci + 2); i++) {
        const k = rooster[j * kol + i];
        if (k >= 0 && Math.hypot(punten[k].x - p.x, punten[k].y - p.y) < d) return false;
      }
    }
    return true;
  };
  voegToe({ x: r() * b, y: r() * h });
  while (actief.length && punten.length < max) {
    const i = Math.floor(r() * actief.length);
    const basis = actief[i];
    let gevonden = false;
    for (let poging = 0; poging < 30; poging++) {
      const hoek = r() * Math.PI * 2;
      const afstand = d * (1 + r());
      const p = { x: basis.x + Math.cos(hoek) * afstand, y: basis.y + Math.sin(hoek) * afstand };
      if (p.x < 0 || p.y < 0 || p.x >= b || p.y >= h || !vrij(p)) continue;
      voegToe(p);
      gevonden = true;
      break;
    }
    if (!gevonden) actief.splice(i, 1);
  }
  return punten;
}

// ---- de motieven ---------------------------------------------------------------------
// Elk motief past in een cirkel met straal 0,5 rond (0, 0) en wordt daarna geschaald en gedraaid.

function motief(soort, r) {
  const lijn = (punten, glad = false) => ({ gesloten: false, punten: glad ? gladOpen(punten, 1) : punten });
  switch (soort) {
    case 'kronkel': {
      const punten = [];
      for (let i = 0; i <= 12; i++) {
        const t = i / 12;
        punten.push({ x: -0.45 + 0.9 * t, y: Math.sin(t * Math.PI * 3) * 0.13 });
      }
      return { lijnen: [lijn(punten, true)], dikte: 0.1 };
    }
    case 'zigzag': {
      const punten = [];
      for (let i = 0; i <= 6; i++) punten.push({ x: -0.45 + 0.15 * i, y: i % 2 ? -0.12 : 0.12 });
      return { lijnen: [lijn(punten)], dikte: 0.09 };
    }
    case 'streepjes':
      return { lijnen: [-0.2, 0, 0.2].map((y) => lijn([{ x: -0.36, y }, { x: 0.36, y }])), dikte: 0.08 };
    case 'kruis':
      return { lijnen: [lijn([{ x: -0.26, y: 0 }, { x: 0.26, y: 0 }]), lijn([{ x: 0, y: -0.26 }, { x: 0, y: 0.26 }])], dikte: 0.11 };
    case 'cirkel':
      return r() < 0.5
        ? { lijnen: [cirkelSubpad(0, 0, 0.34)], dikte: 0.09 }
        : { vlakken: [{ gesloten: true, punten: [
          { x: 0.38, y: 0.1, uit: { x: 0.38, y: -0.11 } },
          { x: 0, y: -0.28, in: { x: 0.21, y: -0.28 }, uit: { x: -0.21, y: -0.28 } },
          { x: -0.38, y: 0.1, in: { x: -0.38, y: -0.11 } },
        ] }] };
    case 'driehoek': {
      const punten = [0, 1, 2].map((i) => ({ x: Math.sin((i * 2 * Math.PI) / 3) * 0.42, y: -Math.cos((i * 2 * Math.PI) / 3) * 0.42 + 0.07 }));
      return r() < 0.6 ? { vlakken: [{ gesloten: true, punten }] } : { lijnen: [{ gesloten: true, punten }], dikte: 0.08 };
    }
    case 'stippen': {
      const vlakken = [];
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) vlakken.push(cirkelSubpad(i * 0.24, j * 0.24, 0.065));
      return { vlakken };
    }
    default:
      return { vlakken: [cirkelSubpad(0, 0, 0.2)] };
  }
}

function bouwPatroon(w, vak, cmyk) {
  const S = vexel.mm(w.grootte);
  const r = willekeur(w.zaad);
  const tussen = S * (1.12 + 1.5 * (1 - w.dichtheid / 100));
  const kleuren = w.kleuren.slice(1);
  const soorten = MOTIEVEN.map(([k]) => k).filter((k) => w.motieven.includes(k));
  if (!soorten.length) return { fout: 'Kies minstens één motief.' };
  const punten = poisson(r, vak.b, vak.h, tussen);
  const mx = vak.b / 2;
  const my = vak.h / 2;
  const vrij = w.vrij / 100;
  const groepen = new Map(soorten.map((k) => [k, []]));
  let aantal = 0;
  let laatsteKleur = -1;
  for (const p of punten) {
    const schaal = S * (0.85 + 0.25 * r());
    const rand = schaal * 0.5;
    if (p.x < rand || p.y < rand || p.x > vak.b - rand || p.y > vak.h - rand) continue;
    if (vrij > 0) {
      const dx = (p.x - mx) / (mx * vrij);
      const dy = (p.y - my) / (my * vrij);
      if (dx * dx + dy * dy < 1) continue;
    }
    const soort = kies(r, soorten);
    const m = motief(soort, r);
    const hoek = r() * Math.PI * 2;
    const c = Math.cos(hoek);
    const s = Math.sin(hoek);
    const plaats = (sp) => zetOm(sp, (q) => ({ x: vak.x + p.x + (q.x * c - q.y * s) * schaal, y: vak.y + p.y + (q.x * s + q.y * c) * schaal }));
    let ki = Math.floor(r() * kleuren.length);
    if (ki === laatsteKleur) ki = (ki + 1) % kleuren.length;
    laatsteKleur = ki;
    const kleur = kleurVoor(kleuren[ki], cmyk);
    const naam = MOTIEVEN.find(([k]) => k === soort)[2];
    if (m.lijnen) {
      groepen.get(soort).push({ soort: 'pad', naam, subpaden: plaats(m.lijnen), vulling: null, lijn: kleur,
        lijndikte: m.dikte * schaal, lijneinde: 'round', lijnhoek: 'round' });
    } else {
      groepen.get(soort).push({ soort: 'pad', naam, subpaden: plaats(m.vlakken), vulling: kleur, lijn: null, lijndikte: 0 });
    }
    aantal++;
  }
  const kinderen = [];
  if (w.achtergrond) {
    kinderen.push({ soort: 'rechthoek', naam: 'Achtergrond', x: vak.x, y: vak.y, b: vak.b, h: vak.h, vulling: kleurVoor(w.kleuren[0], cmyk), lijn: null, lijndikte: 0 });
  }
  for (const [soort, lijst] of groepen) {
    if (lijst.length) kinderen.push({ soort: 'groep', naam: `${MOTIEVEN.find(([k]) => k === soort)[1]} (${lijst.length})`, kinderen: lijst });
  }
  if (!aantal) return { fout: 'Er past niets: kies kleinere motieven of minder vrije ruimte.' };
  return { vormen: [{ soort: 'groep', naam: `Speels patroon (${aantal})`, kinderen }], aantal };
}

// ---- het venster ------------------------------------------------------------

async function toonVenster() {
  const doc = await vexel.document();
  const cmyk = doc.kleurruimte === 'cmyk';
  const w0 = { ...STANDAARD, ...((await vexel.haal('instellingen')) || {}) };
  if (!PALETTEN[w0.palet] && w0.palet !== 'eigen') w0.palet = STANDAARD.palet;
  if (!Array.isArray(w0.motieven)) w0.motieven = STANDAARD.motieven;

  const plan = planner(() => teken());
  const doek = maakDoek(250, 330);
  const variant = variantKiezer(w0.zaad, 'Nieuw patroon', plan);
  const grootte = getalVeld(w0.grootte, 3, 200, 1);
  const dichtheid = schuif(w0.dichtheid, 0, 100, 5, (n) => `${n}%`);
  const vrij = schuif(w0.vrij, 0, 80, 5, (n) => (n ? `${n}%` : 'geen'));
  const afloop = getalVeld(w0.afloop, 0, 20, 0.5);
  const achtergrond = vinkje('Achtergrond vullen', w0.achtergrond);
  const palet = paletKiezer(PALETTEN, w0.palet, w0.kleuren, 6, plan);

  const keuzes = MOTIEVEN.map(([k, t]) => {
    const v = maak('input', { type: 'checkbox', value: k });
    v.checked = w0.motieven.includes(k);
    return { k, v, blok: maak('label', { klasse: 'chip' }, v, maak('span', { tekst: t })) };
  });
  document.head.append(maak('style', { tekst: `
    .chips { display: flex; flex-wrap: wrap; gap: 5px; margin: 0 0 8px; }
    .chip { display: inline-flex; align-items: center; height: 24px; padding: 0 9px; border: 1px solid var(--lijn);
      border-radius: 12px; cursor: pointer; color: var(--tekst-zacht); font-size: 11.5px; user-select: none; }
    .chip input { position: absolute; opacity: 0; pointer-events: none; }
    .chip:has(input:checked) { border-color: var(--accent); color: var(--tekst); background: var(--bg-2); }
    .chip:has(input:focus-visible) { outline: 2px solid var(--accent); outline-offset: 1px; }
  ` }));

  const afloopRij = rij('Afloop', afloop, eenheid('mm'));
  if (heeftAfloop(doc)) afloopRij.style.display = 'none';
  const venster = bouwVenster({
    maakTekst: 'Patroon maken',
    links: [doek, variant.blok],
    rechts: [
      maak('div', { klasse: 'kop', tekst: 'Motieven' }),
      maak('div', { klasse: 'chips' }, ...keuzes.map((q) => q.blok)),
      rij('Grootte', grootte, eenheid('mm')),
      rij('Dichtheid', ...dichtheid.delen),
      rij('Vrij midden', ...vrij.delen),
      afloopRij,
      maak('div', { klasse: 'kop', tekst: 'Kleur' }),
      rij('Palet', palet.keuze),
      rij('Vlak · motief', palet.stalen),
      rij('', achtergrond.blok),
    ],
  });

  const waarden = () => ({
    grootte: begrens(leesGetal(grootte, 14), 3, 200),
    dichtheid: begrens(leesGetal(dichtheid.invoer, 55), 0, 100),
    vrij: begrens(leesGetal(vrij.invoer, 0), 0, 80),
    afloop: begrens(leesGetal(afloop, 3), 0, 20),
    achtergrond: achtergrond.invoer.checked,
    motieven: keuzes.filter((q) => q.v.checked).map((q) => q.k),
    zaad: variant.waarde(),
    palet: palet.sleutel(),
    kleuren: palet.kleuren(),
  });

  function teken() {
    const w = waarden();
    const uit = bouwPatroon(w, tekengebiedKader(doc, afloopVoor(doc, w.afloop)), false);
    const vel = tekengebiedKader(doc);
    tekenVoorbeeld(doek, { kader: vel, vel, vormen: uit.vormen || [], marge: 14, minLijn: 0.5 });
    const t = uit.vormen ? telVormen(uit.vormen) : null;
    const fout = uit.fout || (t && (t.n > 5000 || t.p > 50000) ? 'Dat zijn te veel motieven: kies een lagere dichtheid of grotere motieven.' : null);
    toonStatus(venster, doc, uit.aantal ? `${uit.aantal} motieven van ongeveer ${getal(w.grootte, 1)} mm, zonder overlap.` : '', fout);
  }

  venster.formulier.addEventListener('input', plan);
  venster.formulier.addEventListener('change', plan);
  venster.formulier.addEventListener('submit', (gebeurtenis) => {
    gebeurtenis.preventDefault();
    const w = waarden();
    const uit = bouwPatroon(w, tekengebiedKader(doc, afloopVoor(doc, w.afloop)), cmyk);
    if (uit.fout) {
      vexel.melding(uit.fout, 'let');
      return;
    }
    maakInVexel(venster, uit.vormen, { opties: { achteraan: true }, instellingen: w, melding: `Speels patroon gemaakt: ${uit.aantal} motieven.` });
  });

  teken();
  variant.knop.focus();
}

vexel.opCommando('maken', toonVenster);
