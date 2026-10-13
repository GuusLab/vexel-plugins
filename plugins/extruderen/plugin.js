// Extruderen: maak van gesloten paden een blok met diepte, met zijvlakken die
// donkerder worden naarmate ze van het licht af staan.
// Eigen werk, MIT-licentie (zie de README van deze repo).
'use strict';

const STANDAARD = { diepte: 8, richting: 45, licht: 'linksboven', schaduw: 45, vervang: false };
const LICHT = {
  linksboven: [-1, -1], boven: [0, -1], rechtsboven: [1, -1], rechts: [1, 0],
  rechtsonder: [1, 1], onder: [0, 1], linksonder: [-1, 1], links: [-1, 0],
};
const MAX_VORMEN = 5000;
const MAX_PUNTEN = 50000;

// ---- kleine hulpjes voor het venster ------------------------------------

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

function getalVeld(waarde, min, max, stap) {
  return maak('input', { klasse: 'veld', type: 'number', value: waarde, min, max, step: stap, inputmode: 'decimal' });
}

function veldMetLabel(labelTekst, veld, eenheid) {
  const regel = maak('div', { stijl: { display: 'flex', alignItems: 'center', gap: '6px' } }, veld);
  veld.style.flex = '1';
  veld.style.minWidth = '0';
  if (eenheid) regel.append(maak('span', { klasse: 'uitleg', tekst: eenheid }));
  return maak('label', { stijl: { display: 'grid', gap: '4px', minWidth: '0', alignContent: 'start' } }, maak('span', { klasse: 'label', tekst: labelTekst }), regel);
}

const leesGetal = (veld, terugval) => {
  const n = Number(String(veld.value).replace(',', '.'));
  return Number.isFinite(n) ? n : terugval;
};
const begrens = (n, min, max) => Math.min(max, Math.max(min, n));
const css = (naam, terugval) => getComputedStyle(document.documentElement).getPropertyValue(naam).trim() || terugval;
const RAD = Math.PI / 180;

// ---- kleur ---------------------------------------------------------------

function hexNaarRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const rgbNaarHex = (rgb) => '#' + rgb.map((v) => Math.round(begrens(v, 0, 255)).toString(16).padStart(2, '0')).join('');

/** Een kleur uit de selectie, altijd met hex (en cmyk als die er is), of null. */
function kleurVan(k) {
  if (!k) return null;
  const cmyk = Array.isArray(k.cmyk) && k.cmyk.length === 4 ? k.cmyk.map(Number) : null;
  let hex = hexNaarRgb(k.hex) ? k.hex.toLowerCase() : null;
  if (!hex && cmyk) hex = rgbNaarHex(cmyk.slice(0, 3).map((v) => 255 * (1 - v / 100) * (1 - cmyk[3] / 100)));
  return hex ? { cmyk, hex } : null;
}

/** Een donkerdere versie: in CMYK meer zwart, in RGB naar rato donkerder. */
function donkerder(kleur, a, cmykDoc) {
  const hex = rgbNaarHex(hexNaarRgb(kleur.hex).map((v) => v * (1 - a)));
  if (cmykDoc && kleur.cmyk) {
    const [c, m, y, k] = kleur.cmyk;
    return { naarVexel: { cmyk: [c, m, y, Math.round((k + (100 - k) * a) * 10) / 10] }, hex };
  }
  return { naarVexel: { hex }, hex };
}

/** Een kleur zoals hij naar Vexel gaat (CMYK in een CMYK-document). */
const alsVexel = (k, cmykDoc) => (!k ? null : cmykDoc && k.cmyk ? { cmyk: k.cmyk } : { hex: k.hex });

// ---- meetkunde ------------------------------------------------------------

/** Een kromme of lijn tussen twee punten van een subpad, als vier punten. */
function segmenten(sub) {
  const p = sub.punten;
  const uit = [];
  for (let i = 0; i < p.length; i++) {
    const a = p[i];
    const b = p[(i + 1) % p.length];
    if (i === p.length - 1 && !sub.gesloten) break;
    uit.push([a, a.uit || a, b.in || b, b]);
  }
  return uit;
}

const isRecht = ([a, c1, c2, b]) => c1.x === a.x && c1.y === a.y && c2.x === b.x && c2.y === b.y;
const bez = (a, b, c, d, t) => {
  const s = 1 - t;
  return s * s * s * a + 3 * s * s * t * b + 3 * s * t * t * c + t * t * t * d;
};

/** Een gesloten subpad als veelhoek: krommen in zoveel stukjes dat de afwijking
    kleiner is dan `tol` pt. */
function plat(sub, tol) {
  const uit = [];
  for (const s of segmenten(sub)) {
    const [a, c1, c2, b] = s;
    uit.push({ x: a.x, y: a.y });
    if (isRecht(s)) continue;
    const l = Math.max(Math.hypot(a.x - 2 * c1.x + c2.x, a.y - 2 * c1.y + c2.y), Math.hypot(c1.x - 2 * c2.x + b.x, c1.y - 2 * c2.y + b.y));
    const n = begrens(Math.ceil(Math.sqrt((0.75 * l) / tol)), 2, 200);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      uit.push({ x: bez(a.x, c1.x, c2.x, b.x, t), y: bez(a.y, c1.y, c2.y, b.y, t) });
    }
  }
  // dubbele punten weg (ook het laatste als dat gelijk is aan het eerste)
  const schoon = [];
  for (const q of uit) {
    const vorige = schoon[schoon.length - 1];
    if (!vorige || Math.hypot(q.x - vorige.x, q.y - vorige.y) > 1e-6) schoon.push(q);
  }
  while (schoon.length > 1 && Math.hypot(schoon[0].x - schoon[schoon.length - 1].x, schoon[0].y - schoon[schoon.length - 1].y) <= 1e-6) schoon.pop();
  return schoon;
}

/** Ligt punt q binnen de vorm (even-oneven over alle veelhoeken)? */
function binnen(q, veelhoeken) {
  let in_ = false;
  for (const v of veelhoeken) {
    for (let i = 0, j = v.length - 1; i < v.length; j = i++) {
      const a = v[i];
      const b = v[j];
      if ((a.y > q.y) !== (b.y > q.y) && q.x < ((b.x - a.x) * (q.y - a.y)) / (b.y - a.y) + a.x) in_ = !in_;
    }
  }
  return in_;
}

/** Is subpad gesloten (of komt het laatste punt op het eerste uit)? */
function isGesloten(sub) {
  if (!sub || !Array.isArray(sub.punten) || sub.punten.length < 2) return false;
  if (sub.gesloten) return true;
  const a = sub.punten[0];
  const b = sub.punten[sub.punten.length - 1];
  return Math.hypot(a.x - b.x, a.y - b.y) < 0.01;
}

/** De zijvlakken van één vorm, al in tekenvolgorde (achterste eerst). */
function zijvlakken(subpaden, v, licht, tol) {
  const veelhoeken = subpaden.map((s) => plat(s, tol)).filter((p) => p.length >= 3);
  const lengteV = Math.hypot(v.x, v.y);
  if (lengteV < 1e-9) return { vlakken: [], veelhoeken };
  const vx = v.x / lengteV;
  const vy = v.y / lengteV;
  const ux = -vy;
  const uy = vx;
  const vlakken = [];
  for (const p of veelhoeken) {
    for (let i = 0; i < p.length; i++) {
      const a = p[i];
      const b = p[(i + 1) % p.length];
      const ex = b.x - a.x;
      const ey = b.y - a.y;
      const l = Math.hypot(ex, ey);
      if (l < 1e-6) continue;
      // de normaal naar buiten: aan welke kant van de rand zit de vorm?
      let nx = -ey / l;
      let ny = ex / l;
      const eps = Math.min(0.01, l * 0.001);
      const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (binnen({ x: m.x + nx * eps, y: m.y + ny * eps }, veelhoeken)) { nx = -nx; ny = -ny; }
      // alleen de vlakken aan de kant waar de diepte naartoe gaat zijn te zien
      if (nx * vx + ny * vy <= 1e-9) continue;
      const ua = a.x * ux + a.y * uy;
      const ub = b.x * ux + b.y * uy;
      vlakken.push({ a, b, nx, ny, u0: Math.min(ua, ub), u1: Math.max(ua, ub), ua, ub,
        va: a.x * vx + a.y * vy, vb: b.x * vx + b.y * vy, licht: (nx * licht[0] + ny * licht[1]) });
    }
  }
  return { vlakken: tekenvolgorde(vlakken), veelhoeken };
}

/** Schilder-volgorde: van twee vlakken die elkaar (gezien langs de diepte)
    overlappen, staat het vlak dat verder in de dieperichting ligt vóór. Voor
    randen die elkaar niet kruisen is dat altijd eenduidig. */
function tekenvolgorde(vlakken) {
  const n = vlakken.length;
  const vOp = (f, u) => (Math.abs(f.ub - f.ua) < 1e-12 ? (f.va + f.vb) / 2 : f.va + ((u - f.ua) / (f.ub - f.ua)) * (f.vb - f.va));
  const na = Array.from({ length: n }, () => []);
  const binnenkomend = new Array(n).fill(0);
  const volgorde = vlakken.map((f, i) => i).sort((i, j) => vlakken[i].u0 - vlakken[j].u0);
  for (let x = 0; x < n; x++) {
    const i = volgorde[x];
    const f = vlakken[i];
    for (let y = x + 1; y < n; y++) {
      const j = volgorde[y];
      const g = vlakken[j];
      if (g.u0 >= f.u1 - 1e-7) break;
      const lo = Math.max(f.u0, g.u0);
      const hi = Math.min(f.u1, g.u1);
      if (hi - lo <= 1e-7) continue;
      const u = (lo + hi) / 2;
      const d = vOp(f, u) - vOp(g, u);
      if (Math.abs(d) < 1e-9) continue;
      // de achterste eerst tekenen
      if (d < 0) { na[i].push(j); binnenkomend[j]++; } else { na[j].push(i); binnenkomend[i]++; }
    }
  }
  const midden = (f) => (f.va + f.vb) / 2;
  const klaar = [];
  const rij = [];
  for (let i = 0; i < n; i++) if (!binnenkomend[i]) rij.push(i);
  const gedaan = new Array(n).fill(false);
  while (rij.length) {
    // bij keuze: het achterste eerst, dat maakt het ook voorspelbaar
    let beste = 0;
    for (let k = 1; k < rij.length; k++) if (midden(vlakken[rij[k]]) < midden(vlakken[rij[beste]])) beste = k;
    const i = rij.splice(beste, 1)[0];
    gedaan[i] = true;
    klaar.push(vlakken[i]);
    for (const j of na[i]) if (--binnenkomend[j] === 0) rij.push(j);
  }
  if (klaar.length < n) {
    // zou niet moeten gebeuren (alleen bij randen die elkaar kruisen): de rest op diepte
    const rest = vlakken.filter((f, i) => !gedaan[i]).sort((p, q) => midden(p) - midden(q));
    klaar.push(...rest);
  }
  return klaar;
}

const verschuif = (subpaden, v) => subpaden.map((s) => ({
  gesloten: true,
  punten: s.punten.map((q) => {
    const r = { x: q.x + v.x, y: q.y + v.y };
    if (q.in) r.in = { x: q.in.x + v.x, y: q.in.y + v.y };
    if (q.uit) r.uit = { x: q.uit.x + v.x, y: q.uit.y + v.y };
    return r;
  }),
}));

const kopie = (subpaden) => subpaden.map((s) => ({
  gesloten: true,
  punten: s.punten.map((q) => {
    const r = { x: q.x, y: q.y };
    if (q.in) r.in = { x: q.in.x, y: q.in.y };
    if (q.uit) r.uit = { x: q.uit.x, y: q.uit.y };
    return r;
  }),
}));

/** Draait een subpad om (punten achterstevoren, handvatten gewisseld). */
const omgedraaid = (s) => ({
  gesloten: true,
  punten: [...s.punten].reverse().map((q) => {
    const r = { x: q.x, y: q.y };
    if (q.uit) r.in = { x: q.uit.x, y: q.uit.y };
    if (q.in) r.uit = { x: q.in.x, y: q.in.y };
    return r;
  }),
});

const oppervlak = (v) => v.reduce((s, a, i) => {
  const b = v[(i + 1) % v.length];
  return s + a.x * b.y - b.x * a.y;
}, 0) / 2;

/** Zet de draairichting van elk subpad goed: buitenranden de ene kant op, gaten
    de andere (om en om naar hoe diep ze in elkaar liggen). Dan is een gat een
    gat, welke vulregel er ook geldt. */
function gelijkgericht(subpaden, tol) {
  const veelhoeken = subpaden.map((s) => plat(s, tol));
  return subpaden.map((s, i) => {
    const v = veelhoeken[i];
    if (v.length < 3) return kopie([s])[0];
    const a = v[0];
    const b = v[1];
    const q = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const anderen = veelhoeken.filter((w, j) => j !== i && w.length >= 3);
    let diepte = 0;
    for (const w of anderen) if (binnen(q, [w])) diepte++;
    const goed = (oppervlak(v) > 0) === (diepte % 2 === 0);
    return goed ? kopie([s])[0] : omgedraaid(s);
  });
}

// ---- het blok ---------------------------------------------------------------

function kanExtruderen(o) {
  if (o.soort !== 'pad' && o.soort !== 'samengesteld') return false;
  return Array.isArray(o.subpaden) && o.subpaden.length > 0 && o.subpaden.every(isGesloten)
    && o.subpaden.some((s) => s.punten.length >= 2);
}

/** Alles wat er getekend moet worden, per object. */
function bouwBlokken(objecten, w, cmykDoc, tol) {
  const v = { x: vexel.mm(w.diepte) * Math.cos(w.richting * RAD), y: vexel.mm(w.diepte) * Math.sin(w.richting * RAD) };
  const l = LICHT[w.licht] || LICHT.linksboven;
  const ll = Math.hypot(l[0], l[1]);
  const licht = [l[0] / ll, l[1] / ll];
  const sterkte = w.schaduw / 100;
  const blokken = [];
  let vormen = 0;
  let punten = 0;
  for (const o of objecten) {
    const basis = kleurVan(o.vulling) || kleurVan(o.lijn) || { hex: '#9aa3ad', cmyk: [10, 5, 0, 35] };
    const { vlakken } = zijvlakken(o.subpaden, v, licht, tol);
    const kleurOp = (f) => {
      // 0 = recht naar het licht, 1 = er recht vanaf; ook belichte zijkanten worden iets donkerder
      const t = (1 - f.licht) / 2;
      const a = Math.round(sterkte * (0.2 + 0.8 * t) * 100) / 100;
      return donkerder(basis, begrens(a, 0, 0.95), cmykDoc);
    };
    const zij = vlakken.map((f) => {
      const k = kleurOp(f);
      return {
        soort: 'pad', naam: 'Zijvlak',
        subpaden: [{ gesloten: true, punten: [{ x: f.a.x, y: f.a.y }, { x: f.b.x, y: f.b.y }, { x: f.b.x + v.x, y: f.b.y + v.y }, { x: f.a.x + v.x, y: f.a.y + v.y }] }],
        // een haarlijn in dezelfde kleur dicht de naadjes tussen de vlakken
        vulling: k.naarVexel, lijn: k.naarVexel, lijndikte: 0.25, lijnhoek: 'round', hex: k.hex,
      };
    });
    const donkerst = donkerder(basis, begrens(sterkte, 0, 0.95), cmykDoc);
    const vorm = gelijkgericht(o.subpaden, tol);
    const achter = { soort: 'pad', naam: 'Achterkant', subpaden: verschuif(vorm, v), vulling: donkerst.naarVexel, lijn: null, hex: donkerst.hex };
    const voor = {
      soort: 'pad', naam: 'Voorvlak', subpaden: vorm,
      // zonder vulling zou je door het blok heen kijken: dan vult de lijnkleur het voorvlak
      vulling: alsVexel(kleurVan(o.vulling) || basis, cmykDoc), lijn: alsVexel(kleurVan(o.lijn), cmykDoc),
      lijndikte: o.lijn ? o.lijndikte || 1 : 0, dekking: o.dekking == null ? 1 : o.dekking,
      hex: (kleurVan(o.vulling) || basis).hex, lijnHex: (kleurVan(o.lijn) || {}).hex || null,
    };
    const naam = `3D – ${o.naam || (o.soort === 'samengesteld' ? 'samengestelde vorm' : 'vorm')}`.slice(0, 100);
    vormen += zij.length + 4;
    punten += zij.length * 4 + o.subpaden.reduce((s, x) => s + x.punten.length, 0) * 2;
    blokken.push({ o, naam, achter, zij, voor });
  }
  return { blokken, vormen, punten, v };
}

/** Kies de nauwkeurigheid zo dat het binnen de grenzen blijft. */
function bouwBinnenGrenzen(objecten, w, cmykDoc) {
  let tol = 0.08;
  for (let poging = 0; poging < 8; poging++) {
    const r = bouwBlokken(objecten, w, cmykDoc, tol);
    if (r.vormen <= MAX_VORMEN && r.punten <= MAX_PUNTEN) return { ...r, tol };
    tol *= 2.5;
  }
  return null;
}

const zonderHex = ({ hex, lijnHex, ...rest }) => rest;

function alsVormen(blokken) {
  return blokken.map((b) => ({
    soort: 'groep', naam: b.naam,
    kinderen: [
      { soort: 'groep', naam: 'Zijvlakken', kinderen: [zonderHex(b.achter), ...b.zij.map(zonderHex)] },
      zonderHex(b.voor),
    ],
  }));
}

// ---- voorvertoning --------------------------------------------------------

function padOpCanvas(g, subpaden, X, Y) {
  g.beginPath();
  for (const s of subpaden) {
    if (!s.punten.length) continue;
    g.moveTo(X(s.punten[0].x), Y(s.punten[0].y));
    for (const seg of segmenten({ ...s, gesloten: true })) {
      const [, c1, c2, b] = seg;
      if (isRecht(seg)) g.lineTo(X(b.x), Y(b.y));
      else g.bezierCurveTo(X(c1.x), Y(c1.y), X(c2.x), Y(c2.y), X(b.x), Y(b.y));
    }
    g.closePath();
  }
}

function tekenVoorbeeld(canvas, uitkomst) {
  const schaal = devicePixelRatio || 1;
  const vak = canvas.getBoundingClientRect();
  canvas.width = Math.round(vak.width * schaal);
  canvas.height = Math.round(vak.height * schaal);
  const g = canvas.getContext('2d');
  g.setTransform(schaal, 0, 0, schaal, 0, 0);
  g.clearRect(0, 0, vak.width, vak.height);
  if (!uitkomst || !uitkomst.blokken.length) return;
  const pts = [];
  for (const b of uitkomst.blokken) {
    const k = b.o.kader;
    pts.push([k.x, k.y], [k.x + k.b, k.y + k.h], [k.x + uitkomst.v.x, k.y + uitkomst.v.y], [k.x + k.b + uitkomst.v.x, k.y + k.h + uitkomst.v.y]);
  }
  const x0 = Math.min(...pts.map((p) => p[0]));
  const y0 = Math.min(...pts.map((p) => p[1]));
  const x1 = Math.max(...pts.map((p) => p[0]));
  const y1 = Math.max(...pts.map((p) => p[1]));
  const s = Math.min((vak.width - 20) / Math.max(1, x1 - x0), (vak.height - 20) / Math.max(1, y1 - y0));
  const ox = (vak.width - (x1 - x0) * s) / 2 - x0 * s;
  const oy = (vak.height - (y1 - y0) * s) / 2 - y0 * s;
  const X = (x) => ox + x * s;
  const Y = (y) => oy + y * s;
  g.lineJoin = 'round';
  for (const b of uitkomst.blokken) {
    padOpCanvas(g, b.achter.subpaden, X, Y);
    g.fillStyle = b.achter.hex;
    g.fill('evenodd');
    for (const f of b.zij) {
      const q = f.subpaden[0].punten;
      g.beginPath();
      q.forEach((p, i) => (i ? g.lineTo(X(p.x), Y(p.y)) : g.moveTo(X(p.x), Y(p.y))));
      g.closePath();
      g.fillStyle = f.hex;
      g.strokeStyle = f.hex;
      g.lineWidth = 0.6;
      g.fill();
      g.stroke();
    }
    padOpCanvas(g, b.voor.subpaden, X, Y);
    g.globalAlpha = b.voor.dekking;
    if (b.voor.hex) { g.fillStyle = b.voor.hex; g.fill('evenodd'); }
    if (b.voor.lijnHex) { g.strokeStyle = b.voor.lijnHex; g.lineWidth = Math.max(0.5, b.voor.lijndikte * s); g.stroke(); }
    g.globalAlpha = 1;
  }
}

// ---- het venster ----------------------------------------------------------

async function toonVenster() {
  const doc = await vexel.document();
  const cmykDoc = doc.kleurruimte === 'cmyk';
  const w0 = { ...STANDAARD, ...((await vexel.haal('instellingen')) || {}) };
  let items = [];
  let leesFout = null;
  try {
    items = await vexel.selectie();
  } catch (fout) {
    leesFout = fout;
  }

  const diepte = getalVeld(w0.diepte, 0.1, 1000, 0.5);
  const richting = getalVeld(w0.richting, -360, 360, 5);
  const licht = maak('select', { klasse: 'veld' }, ...[
    ['linksboven', 'Linksboven'], ['boven', 'Boven'], ['rechtsboven', 'Rechtsboven'], ['rechts', 'Rechts'],
    ['rechtsonder', 'Rechtsonder'], ['onder', 'Onder'], ['linksonder', 'Linksonder'], ['links', 'Links'],
  ].map(([w, t]) => maak('option', { value: w, tekst: t })));
  licht.value = LICHT[w0.licht] ? w0.licht : 'linksboven';
  const schaduw = maak('input', { type: 'range', min: 0, max: 90, step: 1, value: w0.schaduw, stijl: { flex: '1 1 0', width: '0', minWidth: '0', margin: '0' } });
  const schaduwWaarde = maak('span', { klasse: 'uitleg', stijl: { minWidth: '34px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' } });
  const vervang = maak('input', { type: 'checkbox', stijl: { margin: '0' } });
  vervang.checked = Boolean(w0.vervang);

  const voorbeeld = maak('canvas', { 'aria-hidden': 'true', stijl: { width: '100%', height: '170px', display: 'block' } });
  const samenvatting = maak('p', { klasse: 'uitleg', 'aria-live': 'polite', stijl: { margin: '0', minHeight: '32px' } });
  const maakKnop = maak('button', { klasse: 'knop primair', type: 'submit', tekst: 'Extruderen' });
  const annuleer = maak('button', { klasse: 'knop', type: 'button', tekst: 'Annuleren', bijClick: () => vexel.sluit() });

  const twee = (...k) => maak('div', { stijl: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' } }, ...k);
  const formulier = maak('form', { stijl: { display: 'grid', gap: '10px', padding: '14px' } },
    twee(veldMetLabel('Diepte', diepte, 'mm'), veldMetLabel('Richting', richting, '°')),
    maak('p', { klasse: 'uitleg', stijl: { margin: '-4px 0 0' }, tekst: 'Richting: 0° is naar rechts, 90° naar beneden.' }),
    twee(veldMetLabel('Licht van', licht),
      maak('label', { stijl: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '4px', minWidth: '0', alignContent: 'start' } }, maak('span', { klasse: 'label', tekst: 'Schaduw' }),
        maak('div', { stijl: { display: 'flex', alignItems: 'center', gap: '6px', height: '26px' } }, schaduw, schaduwWaarde))),
    maak('label', { stijl: { display: 'flex', gap: '6px', alignItems: 'center' } }, vervang, maak('span', { tekst: 'Het origineel vervangen' })),
    maak('div', { stijl: { background: 'var(--bg-2)', border: '1px solid var(--lijn)', borderRadius: '6px', padding: '6px' } }, voorbeeld),
    samenvatting,
    maak('div', { klasse: 'knoppen', stijl: { marginTop: '0' } }, annuleer, maakKnop),
  );
  document.body.append(formulier);

  const waarden = () => ({
    diepte: begrens(leesGetal(diepte, 8), 0.1, 1000),
    richting: begrens(leesGetal(richting, 45), -360, 360),
    licht: licht.value,
    schaduw: begrens(leesGetal(schaduw, 45), 0, 90),
    vervang: vervang.checked,
  });

  const bruikbaar = () => items.filter(kanExtruderen);
  const overgeslagen = () => items.filter((o) => !kanExtruderen(o));

  function waaromNiet(o) {
    if (o.soort === 'tekst') return 'tekst';
    if (o.soort === 'groep') return 'een groep';
    if (o.soort === 'pad' || o.soort === 'samengesteld') return 'een open pad';
    return 'iets anders dan een pad';
  }

  function probleem(w) {
    if (leesFout) return 'De selectie kon niet worden gelezen: ' + leesFout.message;
    if (doc.alleenLezen) return 'Dit document is alleen-lezen.';
    if (!items.length) return 'Selecteer eerst een of meer gesloten vormen en open dit venster opnieuw.';
    if (!bruikbaar().length) {
      const soorten = [...new Set(overgeslagen().map(waaromNiet))].join(' en ');
      return `In de selectie zit geen gesloten vorm (wel ${soorten}). Maak van tekst eerst contouren, maak groepen los, of sluit het pad.`;
    }
    if (w.vervang && overgeslagen().length) {
      return 'Vervangen kan alleen als alles in de selectie een gesloten vorm is, anders gaat de rest ook weg. '
        + 'Zet "Het origineel vervangen" uit of selecteer alleen gesloten vormen.';
    }
    if (w.vervang && bruikbaar().reduce((s, o) => s + o.subpaden.reduce((t, x) => t + x.punten.length, 0), 0) > 45000) {
      return 'Deze vormen zijn te groot om te vervangen (bijna 50 000 punten). Zet "Het origineel vervangen" uit.';
    }
    return null;
  }

  let uitkomst = null;
  function werkBij() {
    const w = waarden();
    schaduwWaarde.textContent = `${Math.round(w.schaduw)}%`;
    const p = probleem(w);
    uitkomst = null;
    if (!p) uitkomst = bouwBinnenGrenzen(bruikbaar(), w, cmykDoc);
    if (p || !uitkomst) {
      samenvatting.textContent = p || 'Dat worden te veel vlakken (meer dan 5000 vormen of 50 000 punten). Selecteer minder of eenvoudiger vormen.';
      samenvatting.classList.add('fout');
      maakKnop.disabled = true;
      tekenVoorbeeld(voorbeeld, bruikbaar().length && !leesFout ? bouwBinnenGrenzen(bruikbaar(), { ...w, vervang: false }, cmykDoc) : null);
      return;
    }
    samenvatting.classList.remove('fout');
    maakKnop.disabled = false;
    const n = uitkomst.blokken.length;
    const vlakken = uitkomst.blokken.reduce((s, b) => s + b.zij.length, 0);
    let tekst = `${n} ${n === 1 ? 'blok' : 'blokken'} van ${String(w.diepte).replace('.', ',')} mm diep, met ${vlakken} zichtbare zijvlakken.`;
    const rest = overgeslagen();
    if (rest.length) tekst += ` ${rest.length} ${rest.length === 1 ? 'object slaat' : 'objecten slaan'} de plugin over (${[...new Set(rest.map(waaromNiet))].join(', ')}).`;
    if (uitkomst.tol > 0.1) tekst += ' Krommen zijn wat grover benaderd om binnen de grenzen te blijven.';
    samenvatting.textContent = tekst;
    tekenVoorbeeld(voorbeeld, uitkomst);
  }

  formulier.addEventListener('input', werkBij);
  formulier.addEventListener('change', werkBij);
  formulier.addEventListener('submit', async (gebeurtenis) => {
    gebeurtenis.preventDefault();
    const w = waarden();
    if (probleem(w)) return;
    maakKnop.disabled = true;
    try {
      const nu = await vexel.selectie();
      const zelfde = nu.length === items.length && nu.every((o) => items.some((v) => v.id === o.id));
      items = nu;
      if (!zelfde) {
        werkBij();
        vexel.melding('De selectie is veranderd. Bekijk het voorbeeld en klik nog eens op Extruderen.', 'let');
        return;
      }
      const r = bouwBinnenGrenzen(bruikbaar(), w, cmykDoc);
      if (!r) throw new Error('Dat worden te veel vlakken. Selecteer minder of eenvoudiger vormen.');
      await vexel.maak(alsVormen(r.blokken), w.vervang ? { vervangSelectie: true } : undefined);
      await vexel.bewaar('instellingen', w);
      vexel.melding(`${r.blokken.length} ${r.blokken.length === 1 ? 'blok' : 'blokken'} gemaakt.`, 'ok');
      vexel.sluit();
    } catch (fout) {
      vexel.melding(fout && fout.message ? fout.message : 'Extruderen lukte niet.', 'fout');
      werkBij();
    }
  });

  werkBij();
  diepte.focus();
  diepte.select();
}

vexel.opCommando('extruderen', toonVenster);
