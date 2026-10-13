// Sierrand: decoratieve kaders en hoekornamenten voor uitnodigingen, menukaarten en certificaten.
// Eigen werk van GuusLab, MIT-licentie. De ornamenten zijn eigen ontwerpen, opgebouwd uit spiralen.
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
  stijl: 'krul', doel: 'tekengebied', marge: 10, tussenruimte: 2.5, hoek: 22, lijndikte: 0.75,
  midden: true, palet: 'zwart', kleuren: null,
};

const STIJLEN = [
  ['krul', 'Krullen'],
  ['deco', 'Art deco'],
  ['ingesneden', 'Ingesneden hoeken'],
  ['dubbel', 'Dubbel kader'],
  ['driedubbel', 'Driedubbel kader'],
];

const PALETTEN = {
  zwart: { naam: 'Zwart', kleuren: ['#1a1a1a'] },
  goud: { naam: 'Oud goud', kleuren: ['#b08a3e'] },
  blauw: { naam: 'Nachtblauw', kleuren: ['#1d2f5c'] },
  bordeaux: { naam: 'Bordeaux', kleuren: ['#7a1f33'] },
  groen: { naam: 'Flessengroen', kleuren: ['#1f4d3a'] },
};

const HOEKEN = [
  { naam: 'linksboven', sx: 1, sy: 1 },
  { naam: 'rechtsboven', sx: -1, sy: 1 },
  { naam: 'rechtsonder', sx: -1, sy: -1 },
  { naam: 'linksonder', sx: 1, sy: -1 },
];

// ---- bouwstenen ----------------------------------------------------------------

const rechthoekSubpad = (x, y, b, h) => ({ gesloten: true, punten: [{ x, y }, { x: x + b, y }, { x: x + b, y: y + h }, { x, y: y + h }] });

/** Punten op een spiraal: van straal r0 naar r1, vanaf `hoek0` over `zwaai` radialen. */
function spiraal(cx, cy, r0, r1, hoek0, zwaai, stappen) {
  const punten = [];
  for (let i = 0; i <= stappen; i++) {
    const t = i / stappen;
    const r = r0 + (r1 - r0) * t;
    const a = hoek0 + zwaai * t;
    punten.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return punten;
}

/** Een blaadje (druppel) van punt `a` naar punt `b`, `breedte` als deel van de lengte. */
function blad(a, b, breedte) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const nx = -dy * breedte;
  const ny = dx * breedte;
  const m = { x: a.x + dx * 0.6, y: a.y + dy * 0.6 };
  return {
    gesloten: true,
    punten: [
      { x: a.x, y: a.y, in: { x: a.x + dx * 0.25 - nx * 0.4, y: a.y + dy * 0.25 - ny * 0.4 }, uit: { x: a.x + dx * 0.25 + nx * 0.4, y: a.y + dy * 0.25 + ny * 0.4 } },
      { x: m.x + nx, y: m.y + ny, in: { x: m.x + nx - dx * 0.25, y: m.y + ny - dy * 0.25 }, uit: { x: m.x + nx + dx * 0.25, y: m.y + ny + dy * 0.25 } },
      { x: b.x, y: b.y, in: { x: b.x + nx * 0.55, y: b.y + ny * 0.55 }, uit: { x: b.x - nx * 0.55, y: b.y - ny * 0.55 } },
      { x: m.x - nx, y: m.y - ny, in: { x: m.x - nx + dx * 0.25, y: m.y - ny + dy * 0.25 }, uit: { x: m.x - nx - dx * 0.25, y: m.y - ny - dy * 0.25 } },
    ],
  };
}

const ruit = (cx, cy, rx, ry) => ({ gesloten: true, punten: [{ x: cx, y: cy - ry }, { x: cx + rx, y: cy }, { x: cx, y: cy + ry }, { x: cx - rx, y: cy }] });

/** Een punt op een bezierstuk tussen a en b. */
function opBezier(a, b, t) {
  const c1 = a.uit || a;
  const c2 = b.in || b;
  const u = 1 - t;
  return {
    x: u * u * u * a.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * b.x,
    y: u * u * u * a.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * b.y,
  };
}

/**
 * Een zwierige penstreek: de lijn door `punten` als gevuld vlak dat dikker en dunner wordt,
 * zoals met een spitse pen getekend. `profiel(t)` geeft de dikte (0 tot 1) langs de lijn.
 */
function zwier(punten, dik, profiel) {
  const glad = gladOpen(punten, 1);
  const lijn = [glad[0]];
  for (let i = 1; i < glad.length; i++) for (let k = 1; k <= 4; k++) lijn.push(opBezier(glad[i - 1], glad[i], k / 4));
  const n = lijn.length;
  const links = [];
  const rechts = [];
  for (let j = 0; j < n; j++) {
    const a = lijn[Math.max(0, j - 1)];
    const b = lijn[Math.min(n - 1, j + 1)];
    const lengte = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const half = (dik * Math.max(0.06, profiel(j / (n - 1)))) / 2;
    const nx = (-(b.y - a.y) / lengte) * half;
    const ny = ((b.x - a.x) / lengte) * half;
    links.push({ x: lijn[j].x + nx, y: lijn[j].y + ny });
    rechts.push({ x: lijn[j].x - nx, y: lijn[j].y - ny });
  }
  return { gesloten: true, punten: gladGesloten(links.concat(rechts.reverse()), 1) };
}

// dun bij de aanzet, vol in het midden, spits uitlopend in de krul
const ARM = (t) => (t < 0.3 ? 0.35 + 0.65 * Math.sin((t / 0.3) * (Math.PI / 2)) : 0.1 + 0.9 * Math.pow(1 - (t - 0.3) / 0.7, 1.4));

/**
 * Een rank: een lijn waarvan de kromming geleidelijk toeneemt, zodat hij vanzelf oprolt
 * tot een spiraal (zoals een plantenrank). Begint in (x, y) met richting `hoek` (radialen),
 * kromming loopt van k0 naar k1 (per eenheid lengte; positief is met de klok mee).
 */
function rank(x, y, hoek, lengte, k0, k1, macht = 2.2, stappen = 26) {
  const punten = [{ x, y }];
  const fijn = stappen * 8;
  const ds = lengte / fijn;
  let a = hoek;
  for (let i = 1; i <= fijn; i++) {
    const t = (i - 0.5) / fijn;
    a += (k0 + (k1 - k0) * Math.pow(t, macht)) * ds;
    x += Math.cos(a) * ds;
    y += Math.sin(a) * ds;
    if (i % 8 === 0) punten.push({ x, y });
  }
  return punten;
}

const spiegelDiagonaal = (punten) => punten.map((p) => ({ x: p.y, y: p.x }));
const spiegelX = (punten) => punten.map((p) => ({ x: -p.x, y: p.y }));

/**
 * Het krul-hoekornament in een vak van ongeveer s × s, met de hoek op (0, 0) en de randen langs +x en +y:
 * langs elke rand een rank die eerst naar de rand buigt en dan naar binnen oprolt, met een kleinere
 * tegenrank, een druppel op de diagonaal en een ruitje in de hoek.
 */
function krulHoek(s, dik) {
  const hoofd = rank(0.15 * s, 0.15 * s, 0.42, 1.1 * s, -2.7 / s, 30 / s, 2.4);
  const tegen = rank(0.31 * s, 0.235 * s, 0.25, 0.34 * s, 2 / s, -36 / s, 2, 14);
  return {
    lijnen: [],
    vlakken: [
      zwier(hoofd, dik, ARM), zwier(spiegelDiagonaal(hoofd), dik, ARM),
      zwier(tegen, dik * 0.62, ARM), zwier(spiegelDiagonaal(tegen), dik * 0.62, ARM),
      blad({ x: 0.19 * s, y: 0.19 * s }, { x: 0.42 * s, y: 0.42 * s }, 0.16),
      ruit(0.06 * s, 0.06 * s, 0.035 * s, 0.035 * s),
    ],
  };
}

/** Het middenornament, symmetrisch rond (0, 0), hangend onder een lijn (y omlaag). */
function krulMidden(s, dik) {
  const rechts = rank(0.03 * s, 0.07 * s, 0.5, 0.95 * s, -3.2 / s, 30 / s, 2.4);
  const tegen = rank(0.2 * s, 0.155 * s, 0.25, 0.32 * s, 2 / s, -36 / s, 2, 14);
  return {
    lijnen: [],
    vlakken: [
      zwier(rechts, dik, ARM), zwier(spiegelX(rechts), dik, ARM),
      zwier(tegen, dik * 0.6, ARM), zwier(spiegelX(tegen), dik * 0.6, ARM),
      ruit(0, 0.04 * s, 0.032 * s, 0.04 * s),
      blad({ x: 0, y: 0.1 * s }, { x: 0, y: 0.34 * s }, 0.18),
    ],
  };
}

/** Een taartpunt van een cirkel, met een echte boog (bezier) aan de buitenkant. */
function taartpunt(cx, cy, r, a0, a1) {
  const k = (4 / 3) * Math.tan((a1 - a0) / 4) * r;
  const p0 = { x: cx + Math.cos(a0) * r, y: cy + Math.sin(a0) * r };
  const p1 = { x: cx + Math.cos(a1) * r, y: cy + Math.sin(a1) * r };
  return {
    gesloten: true,
    punten: [
      { x: cx, y: cy },
      { x: p0.x, y: p0.y, uit: { x: p0.x - Math.sin(a0) * k, y: p0.y + Math.cos(a0) * k } },
      { x: p1.x, y: p1.y, in: { x: p1.x + Math.sin(a1) * k, y: p1.y - Math.cos(a1) * k } },
    ],
  };
}

/** Een zonnewaaier: om en om gevulde taartpunten tussen twee hoeken. */
function waaier(cx, cy, r, a0, a1, delen) {
  const stap = (a1 - a0) / delen;
  const uit = [];
  for (let i = 0; i < delen; i += 2) uit.push(taartpunt(cx, cy, r, a0 + i * stap, a0 + (i + 1) * stap));
  return uit;
}

/** Een kaderlijn met getrapte (art-deco) hoeken: twee treden van elk a / 2. */
function getraptSubpad(x, y, b, h, a) {
  const t = a / 2;
  const hoek = (hx, hy, sx, sy) => [
    { x: hx, y: hy + sy * a }, { x: hx + sx * t, y: hy + sy * a }, { x: hx + sx * t, y: hy + sy * t },
    { x: hx + sx * a, y: hy + sy * t }, { x: hx + sx * a, y: hy },
  ];
  const lb = hoek(x, y, 1, 1);
  const rb = hoek(x + b, y, -1, 1).reverse();
  const ro = hoek(x + b, y + h, -1, -1);
  const lo = hoek(x, y + h, 1, -1).reverse();
  return { gesloten: true, punten: lb.concat(rb, ro, lo) };
}

/** Art-deco-hoek: een zonnewaaier in de inham. Hoek op (0, 0) = hoek van de binnenste lijn. */
function decoHoek(s) {
  return { lijnen: [], vlakken: waaier(0, 0, 0.26 * s, 0, Math.PI / 2, 7) };
}

function decoMidden(s) {
  return {
    lijnen: [
      { gesloten: false, punten: [{ x: -0.75 * s, y: 0 }, { x: -0.3 * s, y: 0 }] },
      { gesloten: false, punten: [{ x: 0.3 * s, y: 0 }, { x: 0.75 * s, y: 0 }] },
      { gesloten: false, punten: [{ x: -0.55 * s, y: 0.07 * s }, { x: -0.3 * s, y: 0.07 * s }] },
      { gesloten: false, punten: [{ x: 0.3 * s, y: 0.07 * s }, { x: 0.55 * s, y: 0.07 * s }] },
    ],
    vlakken: waaier(0, -0.02 * s, 0.24 * s, 0, Math.PI, 9).concat([ruit(0, 0.32 * s, 0.04 * s, 0.05 * s)]),
  };
}

/** Rechthoek met ingesneden (holle) hoeken van straal r. */
function ingesnedenSubpad(x, y, b, h, r) {
  const k = r * BOOG;
  return {
    gesloten: true,
    punten: [
      { x: x + r, y, in: { x: x + r, y: y + k } },
      { x: x + b - r, y, uit: { x: x + b - r, y: y + k } },
      { x: x + b, y: y + r, in: { x: x + b - k, y: y + r } },
      { x: x + b, y: y + h - r, uit: { x: x + b - k, y: y + h - r } },
      { x: x + b - r, y: y + h, in: { x: x + b - r, y: y + h - k } },
      { x: x + r, y: y + h, uit: { x: x + r, y: y + h - k } },
      { x, y: y + h - r, in: { x: x + k, y: y + h - r } },
      { x, y: y + r, uit: { x: x + k, y: y + r } },
    ],
  };
}

// ---- het kader -----------------------------------------------------------------

/** Bouwt de rand binnen `vak` (pt). Geeft { vormen } of { fout }. */
function bouwRand(w, vak, cmyk) {
  const marge = vexel.mm(w.marge);
  const g = vexel.mm(w.tussenruimte);
  const s = vexel.mm(w.hoek);
  const L = w.lijndikte;
  const x = vak.x + marge;
  const y = vak.y + marge;
  const b = vak.b - 2 * marge;
  const h = vak.h - 2 * marge;
  const nodig = w.stijl === 'dubbel' || w.stijl === 'driedubbel' ? 4 * g + 4 : 2 * s + 4 * g;
  if (!(b > nodig) || !(h > nodig)) return { fout: 'Dat past niet: kies een kleinere marge, tussenruimte of hoek.' };

  const kleur = kleurVoor(w.kleuren[0], cmyk);
  const lijn = (naam, subpaden, dikte) => ({ soort: 'pad', naam, subpaden, vulling: null, lijn: kleur, lijndikte: dikte, lijneinde: 'round', lijnhoek: 'miter' });
  const vlak = (naam, subpaden) => ({ soort: 'pad', naam, subpaden, vulling: kleur, lijn: null, lijndikte: 0 });
  const kaders = [];
  let binnenste = g; // afstand van de buitenste tot de binnenste lijn
  let hoekPunt = { x, y, b, h };
  let hoek = null;
  let midden = null;

  if (w.stijl === 'driedubbel') {
    kaders.push(lijn('Kader buiten', [rechthoekSubpad(x, y, b, h)], L * 0.6));
    kaders.push(lijn('Kader midden', [rechthoekSubpad(x + g, y + g, b - 2 * g, h - 2 * g)], L * 2.4));
    kaders.push(lijn('Kader binnen', [rechthoekSubpad(x + 2 * g, y + 2 * g, b - 4 * g, h - 4 * g)], L * 0.6));
    binnenste = 2 * g;
  } else if (w.stijl === 'ingesneden') {
    const r = s * 0.42;
    kaders.push(lijn('Kader buiten', [ingesnedenSubpad(x, y, b, h, r)], L * 1.6));
    kaders.push(lijn('Kader binnen', [ingesnedenSubpad(x + g, y + g, b - 2 * g, h - 2 * g, r)], L * 0.6));
    hoek = { lijnen: [], vlakken: [ruit(r * 0.32, r * 0.32, r * 0.16, r * 0.16)] };
    midden = decoMidden(s * 0.7);
  } else if (w.stijl === 'deco') {
    const a = s * 0.62;
    kaders.push(lijn('Kader buiten', [rechthoekSubpad(x, y, b, h)], L * 1.6));
    kaders.push(lijn('Kader binnen', [getraptSubpad(x + g, y + g, b - 2 * g, h - 2 * g, a)], L * 0.6));
    kaders.push(lijn('Kader binnenste', [getraptSubpad(x + 1.8 * g, y + 1.8 * g, b - 3.6 * g, h - 3.6 * g, a)], L * 0.6));
    hoek = decoHoek(s);
    midden = decoMidden(s * 0.8);
    hoekPunt = { x: x + g * 1.35, y: y + g * 1.35, b: b - 2.7 * g, h: h - 2.7 * g };
    binnenste = 1.8 * g;
  } else {
    kaders.push(lijn('Kader buiten', [rechthoekSubpad(x, y, b, h)], w.stijl === 'krul' ? L * 1.3 : L * 1.6));
    kaders.push(lijn('Kader binnen', [rechthoekSubpad(x + g, y + g, b - 2 * g, h - 2 * g)], L * 0.6));
    if (w.stijl === 'krul') {
      const dik = s * 0.034 + L * 0.6;
      hoek = krulHoek(s, dik);
      midden = krulMidden(s * 1.1, dik);
      hoekPunt = { x: x + g * 1.6, y: y + g * 1.6, b: b - 3.2 * g, h: h - 3.2 * g };
    }
  }

  const ornamenten = [];
  if (hoek) {
    for (const c of HOEKEN) {
      const ox = c.sx > 0 ? hoekPunt.x : hoekPunt.x + hoekPunt.b;
      const oy = c.sy > 0 ? hoekPunt.y : hoekPunt.y + hoekPunt.h;
      const plaats = (sp) => zetOm(sp, (p) => ({ x: ox + c.sx * p.x, y: oy + c.sy * p.y }));
      const delen = [];
      if (hoek.lijnen.length) delen.push(lijn('Lijnen', plaats(hoek.lijnen), L * 0.6));
      if (hoek.vlakken.length) delen.push(vlak('Vlakken', plaats(hoek.vlakken)));
      ornamenten.push({ soort: 'groep', naam: `Hoek ${c.naam}`, kinderen: delen });
    }
  }
  if (midden && w.midden) {
    const mx = x + b / 2;
    const ruimte = binnenste + (w.stijl === 'krul' ? g * 0.6 : g * 0.9);
    for (const kant of [{ naam: 'boven', y: y + ruimte, sy: 1 }, { naam: 'onder', y: y + h - ruimte, sy: -1 }]) {
      const plaats = (sp) => zetOm(sp, (p) => ({ x: mx + p.x, y: kant.y + kant.sy * p.y }));
      const delen = [];
      if (midden.lijnen.length) delen.push(lijn('Lijnen', plaats(midden.lijnen), L * 0.6));
      if (midden.vlakken.length) delen.push(vlak('Vlakken', plaats(midden.vlakken)));
      ornamenten.push({ soort: 'groep', naam: `Ornament ${kant.naam}`, kinderen: delen });
    }
  }
  const kinderen = kaders.concat(ornamenten.length ? [{ soort: 'groep', naam: 'Ornamenten', kinderen: ornamenten }] : []);
  const naam = STIJLEN.find(([k]) => k === w.stijl)[1];
  return { vormen: [{ soort: 'groep', naam: `Sierrand · ${naam.toLowerCase()}`, kinderen }], binnen: { x, y, b, h } };
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
  const doek = maakDoek(250, 300);
  const detail = maakDoek(250, 120);
  const stijl = keuzeVeld(STIJLEN, w0.stijl);
  const doel = keuzeVeld([['tekengebied', 'Het tekengebied'], ['selectie', 'De selectie']], selectie ? 'selectie' : 'tekengebied');
  if (!selectie) doel.querySelector('option[value=selectie]').disabled = true;
  const marge = getalVeld(w0.marge, -100, 500, 0.5);
  const tussenruimte = getalVeld(w0.tussenruimte, 0.5, 50, 0.5);
  const hoek = getalVeld(w0.hoek, 4, 200, 1);
  const lijndikte = getalVeld(w0.lijndikte, 0.1, 10, 0.05);
  const midden = vinkje('Ornament boven en onder', w0.midden);
  const palet = paletKiezer(PALETTEN, w0.palet, w0.kleuren, 1, plan);

  const venster = bouwVenster({
    maakTekst: 'Rand maken',
    links: [doek, detail],
    rechts: [
      maak('div', { klasse: 'kop', tekst: 'Rand' }),
      rij('Stijl', stijl),
      rij('Langs', doel),
      rij('Marge', marge, eenheid('mm')),
      rij('Tussenruimte', tussenruimte, eenheid('mm')),
      rij('Hoekgrootte', hoek, eenheid('mm')),
      rij('Lijndikte', lijndikte, eenheid('pt')),
      rij('', midden.blok),
      maak('div', { klasse: 'kop', tekst: 'Kleur' }),
      rij('Kleur', palet.keuze, palet.stalen),
      maak('p', { klasse: 'uitleg', stijl: { margin: '8px 0 0' }, tekst: 'Onder het voorbeeld zie je de hoek linksboven op ware verhouding.' }),
    ],
  });
  palet.stalen.style.flex = 'none';

  const waarden = () => ({
    stijl: stijl.value,
    doel: doel.value === 'selectie' && selectie ? 'selectie' : 'tekengebied',
    marge: begrens(leesGetal(marge, 10), -100, 500),
    tussenruimte: begrens(leesGetal(tussenruimte, 2.5), 0.5, 50),
    hoek: begrens(leesGetal(hoek, 22), 4, 200),
    lijndikte: begrens(leesGetal(lijndikte, 0.75), 0.1, 10),
    midden: midden.invoer.checked,
    palet: palet.sleutel(),
    kleuren: palet.kleuren(),
  });
  const vakVoor = (w) => (w.doel === 'selectie' ? selectie : tekengebiedKader(doc));

  function teken() {
    const w = waarden();
    const vak = vakVoor(w);
    const uit = bouwRand(w, vak, false);
    const vel = tekengebiedKader(doc);
    const toon = w.doel === 'selectie' ? { x: Math.min(vel.x, vak.x), y: Math.min(vel.y, vak.y) } : vel;
    if (w.doel === 'selectie') {
      toon.b = Math.max(vel.x + vel.b, vak.x + vak.b) - toon.x;
      toon.h = Math.max(vel.y + vel.h, vak.y + vak.h) - toon.y;
    }
    tekenVoorbeeld(doek, { kader: toon, vel, vormen: uit.vormen || [], marge: 14, minLijn: 0.6 });
    const zoom = vexel.mm(w.marge) + vexel.mm(w.hoek) * 1.6 + vexel.mm(w.tussenruimte) * 2;
    const hoogte = zoom * (120 / 250);
    tekenVoorbeeld(detail, {
      kader: { x: vak.x - zoom * 0.04, y: vak.y - zoom * 0.04, b: zoom * 2, h: hoogte * 2 }, vel, vormen: uit.vormen || [], marge: 0, minLijn: 0.8,
    });
    midden.invoer.disabled = w.stijl === 'dubbel' || w.stijl === 'driedubbel';
    const waar = w.doel === 'selectie' ? `langs de selectie (${mmVan(vak.b)} × ${mmVan(vak.h)} mm)` : 'langs het tekengebied';
    toonStatus(venster, doc, uit.binnen ? `Kader van ${mmVan(uit.binnen.b)} × ${mmVan(uit.binnen.h)} mm ${waar}.` : '', uit.fout);
  }

  venster.formulier.addEventListener('input', plan);
  venster.formulier.addEventListener('change', plan);
  venster.formulier.addEventListener('submit', (gebeurtenis) => {
    gebeurtenis.preventDefault();
    const w = waarden();
    const uit = bouwRand(w, vakVoor(w), cmyk);
    if (uit.fout) {
      vexel.melding(uit.fout, 'let');
      return;
    }
    maakInVexel(venster, uit.vormen, { instellingen: w, melding: 'Sierrand gemaakt.' });
  });

  teken();
  stijl.focus();
}

vexel.opCommando('maken', toonVenster);
