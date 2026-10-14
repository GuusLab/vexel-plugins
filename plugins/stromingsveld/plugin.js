// Stromingsveld: lijnen die een vloeiend ruisveld volgen, gelijk verdeeld, taps of als lijn.
// Eigen werk van GuusLab, MIT-licentie.
'use strict';

// ---- venster-hulpjes -------------------------------------------------------

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
  return Number.isFinite(n) && String(veld.value).trim() !== '' ? n : terugval;
};
const begrens = (n, min, max) => Math.min(max, Math.max(min, n));
const getal = (n, cijfers = 1) => n.toLocaleString('nl-NL', { maximumFractionDigits: cijfers });

function getalVeld(waarde, min, max, stap, naam) {
  const veld = maak('input', { klasse: 'veld', type: 'number', value: waarde, min, max, step: stap, inputmode: 'decimal' });
  if (naam) veld.setAttribute('aria-label', naam);
  return veld;
}

const sleutelVan = (opties, waarde) => (Object.prototype.hasOwnProperty.call(opties, waarde) ? waarde : Object.keys(opties)[0]);
function keuzeVeld(opties, waarde) {
  const veld = maak('select', { klasse: 'veld' },
    ...Object.entries(opties).map(([sleutel, tekst]) => maak('option', { value: sleutel, tekst })));
  veld.value = sleutelVan(opties, waarde);
  return veld;
}

/** Een rij met een label links en een of meer velden (met eenheid) rechts. */
function regel(label, ...velden) {
  const rij = maak('label', { klasse: 'rij', stijl: { margin: '0', minWidth: '0' } },
    maak('span', { klasse: 'label', tekst: label, stijl: { minWidth: '78px' } }));
  for (const v of velden) {
    if (typeof v === 'string') rij.append(maak('span', { klasse: 'uitleg', tekst: v, stijl: { flex: 'none', minWidth: '20px' } }));
    else {
      if (v.classList && v.classList.contains('veld')) Object.assign(v.style, { flex: '1', minWidth: '0', width: '100%' });
      rij.append(v);
    }
  }
  return rij;
}
const twee = (...rijen) => maak('div', { stijl: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 14px' } }, ...rijen);

// ---- kleur ----------------------------------------------------------------
// Een eenvoudige omrekening zonder kleurprofiel, alleen voor het voorbeeld en RGB-documenten.

const rgbVanCmyk = ([c, m, y, k]) => {
  const z = 1 - k / 100;
  return [255 * (1 - c / 100) * z, 255 * (1 - m / 100) * z, 255 * (1 - y / 100) * z].map(Math.round);
};
const hexVanRgb = (rgb) => '#' + rgb.map((n) => begrens(Math.round(n), 0, 255).toString(16).padStart(2, '0')).join('');
const kleurCss = (kleur) => (!kleur ? 'transparent' : kleur.hex || hexVanRgb(rgbVanCmyk(kleur.cmyk)));
const alsKleur = (cmykWaarden, cmyk) => (cmyk ? { cmyk: cmykWaarden.slice() } : { hex: hexVanRgb(rgbVanCmyk(cmykWaarden)) });

// ---- willekeur en ruis ----------------------------------------------------

function willekeur(zaad) {
  let a = (zaad >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Simplexruis in twee richtingen, eigen uitwerking: het vlak wordt in driehoeken verdeeld,
 * elke hoek krijgt een willekeurige richting en draagt bij met een zacht aflopend gewicht.
 * Geeft ongeveer -1 tot 1.
 */
function maakSimplex(zaad) {
  const kans = willekeur(zaad);
  const perm = new Uint8Array(512);
  const volgorde = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(kans() * (i + 1));
    [volgorde[i], volgorde[j]] = [volgorde[j], volgorde[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = volgorde[i & 255];
  const hoeken = Array.from({ length: 16 }, (_, i) => [Math.cos((i * Math.PI) / 8), Math.sin((i * Math.PI) / 8)]);
  const SCHEEF = (Math.sqrt(3) - 1) / 2;
  const RECHT = (3 - Math.sqrt(3)) / 6;
  const bijdrage = (gi, x, y) => {
    const t = 0.5 - x * x - y * y;
    if (t <= 0) return 0;
    const g = hoeken[gi & 15];
    return t * t * t * t * (g[0] * x + g[1] * y);
  };
  return (x, y) => {
    const s = (x + y) * SCHEEF;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);
    const t = (i + j) * RECHT;
    const x0 = x - (i - t);
    const y0 = y - (j - t);
    const i1 = x0 > y0 ? 1 : 0;
    const j1 = 1 - i1;
    const x1 = x0 - i1 + RECHT;
    const y1 = y0 - j1 + RECHT;
    const x2 = x0 - 1 + 2 * RECHT;
    const y2 = y0 - 1 + 2 * RECHT;
    const ii = i & 255;
    const jj = j & 255;
    const n = bijdrage(perm[ii + perm[jj]], x0, y0)
      + bijdrage(perm[ii + i1 + perm[jj + j1]], x1, y1)
      + bijdrage(perm[ii + 1 + perm[jj + 1]], x2, y2);
    return 70 * n;
  };
}

/** Een paar lagen ruis op elkaar (grof plus fijner), van ongeveer -1 tot 1. */
function maakVeldRuis(zaad, lagen) {
  const ruis = maakSimplex(zaad);
  return (x, y) => {
    let som = 0;
    let gewicht = 0;
    let f = 1;
    let a = 1;
    for (let l = 0; l < lagen; l++) {
      som += a * ruis(x * f + l * 19.3, y * f - l * 7.7);
      gewicht += a;
      f *= 2.03;
      a *= 0.45;
    }
    return som / gewicht;
  };
}

// ---- krommen --------------------------------------------------------------

/** Een vloeiende open kromme door de punten (handvatten volgens Catmull-Rom). */
function kromme(punten) {
  const n = punten.length;
  return punten.map((p, i) => {
    const vorige = punten[Math.max(0, i - 1)];
    const volgende = punten[Math.min(n - 1, i + 1)];
    const deler = i === 0 || i === n - 1 ? 3 : 6;
    const tx = (volgende.x - vorige.x) / deler;
    const ty = (volgende.y - vorige.y) / deler;
    const q = { x: rond(p.x), y: rond(p.y) };
    if (i > 0) q.in = { x: rond(p.x - tx), y: rond(p.y - ty) };
    if (i < n - 1) q.uit = { x: rond(p.x + tx), y: rond(p.y + ty) };
    return q;
  });
}
const rond = (n) => Math.round(n * 100) / 100;

/** Dezelfde kromme achterstevoren: in en uit wisselen. */
const omgekeerd = (k) => k.slice().reverse().map((p) => {
  const q = { x: p.x, y: p.y };
  if (p.uit) q.in = p.uit;
  if (p.in) q.uit = p.in;
  return q;
});

// ---- tellen en voorbeeld ----------------------------------------------------

function tel(vormen) {
  let aantal = 0;
  let punten = 0;
  const loop = (v) => {
    aantal++;
    if (v.kinderen) v.kinderen.forEach(loop);
    if (v.subpaden) for (const s of v.subpaden) punten += s.punten.length;
    if (v.soort === 'ellips' || v.soort === 'rechthoek') punten += 4;
  };
  vormen.forEach(loop);
  return { vormen: aantal, punten };
}
const GRENS = { vormen: 5000, punten: 50000, subpaden: 1000 };

function padVanSubpaden(subpaden, sx, ox, oy) {
  const p = new Path2D();
  for (const s of subpaden) {
    const n = s.punten.length;
    if (!n) continue;
    const X = (q) => ox + q.x * sx;
    const Y = (q) => oy + q.y * sx;
    p.moveTo(X(s.punten[0]), Y(s.punten[0]));
    const eind = s.gesloten ? n : n - 1;
    for (let i = 1; i <= eind; i++) {
      const a = s.punten[i - 1];
      const b = s.punten[i % n];
      if (a.uit || b.in) {
        const c1 = a.uit || a;
        const c2 = b.in || b;
        p.bezierCurveTo(X(c1), Y(c1), X(c2), Y(c2), X(b), Y(b));
      } else p.lineTo(X(b), Y(b));
    }
    if (s.gesloten) p.closePath();
  }
  return p;
}

/** Tekent het tekengebied met de vormen erop, passend in het canvas; `zicht` in pt. */
function tekenVoorbeeld(doek, doc, vormen, zicht) {
  const schaal = devicePixelRatio || 1;
  const kader = doek.getBoundingClientRect();
  doek.width = Math.max(1, Math.round(kader.width * schaal));
  doek.height = Math.max(1, Math.round(kader.height * schaal));
  const g = doek.getContext('2d');
  g.setTransform(schaal, 0, 0, schaal, 0, 0);
  g.fillStyle = vexel.thema.bg2;
  g.fillRect(0, 0, kader.width, kader.height);
  const tg = doc.tekengebied;
  const z = zicht || { x: 0, y: 0, b: tg.b, h: tg.h };
  const marge = 10;
  const sx = Math.min((kader.width - 2 * marge) / z.b, (kader.height - 2 * marge) / z.h);
  const ox = (kader.width - z.b * sx) / 2 - z.x * sx;
  const oy = (kader.height - z.h * sx) / 2 - z.y * sx;
  g.fillStyle = '#ffffff';
  g.fillRect(ox, oy, tg.b * sx, tg.h * sx);
  const loop = (v) => {
    if (v.soort === 'groep') return v.kinderen.forEach(loop);
    let p;
    if (v.soort === 'pad') p = padVanSubpaden(v.subpaden, sx, ox, oy);
    else if (v.soort === 'rechthoek') {
      p = new Path2D();
      p.rect(ox + v.x * sx, oy + v.y * sx, v.b * sx, v.h * sx);
    } else return;
    g.globalAlpha = v.dekking === undefined ? 1 : v.dekking;
    if (v.vulling) {
      g.fillStyle = kleurCss(v.vulling);
      g.fill(p);
    }
    if (v.lijn && v.lijndikte > 0) {
      g.strokeStyle = kleurCss(v.lijn);
      const breedte = v.lijndikte * sx;
      g.lineWidth = Math.max(0.5, breedte);
      if (breedte < 0.5) g.globalAlpha *= Math.max(0.2, breedte / 0.5);
      g.lineJoin = 'round';
      g.lineCap = v.lijneinde === 'round' ? 'round' : 'butt';
      g.stroke(p);
    }
    g.globalAlpha = 1;
  };
  vormen.forEach(loop);
  g.strokeStyle = vexel.thema.accent;
  g.globalAlpha = 0.9;
  g.lineWidth = 1;
  g.setLineDash([3, 3]);
  g.strokeRect(ox + 0.5, oy + 0.5, tg.b * sx - 1, tg.h * sx - 1);
  g.setLineDash([]);
  g.globalAlpha = 1;
}

// ---- paletten -------------------------------------------------------------
// Alles in CMYK; in een RGB-document wordt het omgerekend.

const PALETTEN = {
  gloed: { naam: 'Gloed', achtergrond: [85, 75, 45, 65],
    kleuren: [[0, 75, 70, 0], [0, 45, 90, 0], [0, 15, 75, 0], [0, 55, 20, 0], [0, 8, 20, 0]] },
  oceaan: { naam: 'Oceaan', achtergrond: [100, 65, 30, 45],
    kleuren: [[75, 0, 30, 0], [45, 0, 15, 0], [20, 0, 5, 0], [0, 5, 20, 0], [85, 30, 20, 10]] },
  papier: { naam: 'Inkt op papier', achtergrond: [0, 3, 10, 2],
    kleuren: [[70, 60, 50, 85], [65, 50, 40, 60], [0, 80, 75, 5]] },
  bos: { naam: 'Bos', achtergrond: [80, 40, 70, 60],
    kleuren: [[50, 0, 60, 10], [30, 0, 70, 0], [10, 0, 45, 0], [0, 25, 70, 0], [70, 15, 75, 25]] },
  pastel: { naam: 'Pastel', achtergrond: [0, 4, 8, 0],
    kleuren: [[40, 0, 15, 0], [0, 35, 15, 0], [0, 15, 45, 0], [30, 25, 0, 0], [55, 10, 35, 0]] },
  neon: { naam: 'Neon', achtergrond: [75, 85, 40, 70],
    kleuren: [[60, 0, 0, 0], [0, 85, 0, 0], [0, 0, 90, 0], [40, 0, 80, 0], [55, 70, 0, 0]] },
  zwartwit: { naam: 'Zwart-wit', achtergrond: [0, 0, 0, 100], kleuren: [[0, 0, 0, 0], [0, 0, 0, 25]] },
};

// ---- het veld -------------------------------------------------------------

const WEERGAVEN = { taps: 'Taps (beide uiteinden)', penseel: 'Penseelstreek', lijnen: 'Lijnen' };
const KLEURWIJZEN = { vlakken: 'Per lijn, in vlakken', langs: 'Wisselend langs de lijn', afwisselend: 'Willekeurig per lijn' };

const STANDAARD = {
  gebied: 'afloop', weergave: 'taps', afstand: 3.2, dikte: 60, lengte: 140, minLengte: 10, schaal: 85, kronkel: 70,
  richting: 30, lagen: 2, palet: 'gloed', kleurwijze: 'vlakken', achtergrond: true, achteraan: true, zaad: 4711,
};

/**
 * Rekent de stroomlijnen uit in `vak` (pt). Elke lijn volgt de richting van het veld vanuit een
 * startpunt, naar voren en naar achteren, tot hij te dicht bij een andere lijn komt, het vak
 * verlaat of zijn maximale lengte heeft. Startpunten liggen in een verschoven raster en worden in
 * willekeurige volgorde geprobeerd; een punt dat te dicht bij een bestaande lijn ligt, valt af.
 */
function stroomlijnen(w, vak) {
  const ds = vexel.mm(w.afstand);
  const stap = ds * 0.3;
  const toets = ds * 0.55;
  const schaal = vexel.mm(w.schaal);
  const ruis = maakVeldRuis(w.zaad, w.lagen);
  const basis = (w.richting * Math.PI) / 180;
  const zwaai = (w.kronkel / 100) * Math.PI * 1.6;
  const hoek = (x, y) => basis + zwaai * ruis(x / schaal, y / schaal);
  const maxStappen = Math.max(4, Math.round(vexel.mm(w.lengte) / stap));
  const minPunten = Math.max(3, Math.round(vexel.mm(w.minLengte) / stap));

  // Een rooster van vakjes zo groot als de afstand, met de punten van alle lijnen.
  const cel = ds;
  const kol = Math.max(1, Math.ceil(vak.b / cel) + 1);
  const rijen = Math.max(1, Math.ceil(vak.h / cel) + 1);
  const rooster = new Map();
  const sleutel = (cx, cy) => cy * kol + cx;
  const voegToe = (p) => {
    const k = sleutel(Math.floor((p.x - vak.x) / cel), Math.floor((p.y - vak.y) / cel));
    const lijst = rooster.get(k);
    if (lijst) lijst.push(p);
    else rooster.set(k, [p]);
  };
  const vrij = (x, y, d) => {
    const cx = Math.floor((x - vak.x) / cel);
    const cy = Math.floor((y - vak.y) / cel);
    const d2 = d * d;
    for (let j = cy - 1; j <= cy + 1; j++) {
      if (j < 0 || j >= rijen) continue;
      for (let i = cx - 1; i <= cx + 1; i++) {
        if (i < 0 || i >= kol) continue;
        const lijst = rooster.get(sleutel(i, j));
        if (!lijst) continue;
        for (const q of lijst) if ((q.x - x) ** 2 + (q.y - y) ** 2 < d2) return false;
      }
    }
    return true;
  };
  const binnen = (x, y) => x >= vak.x && x <= vak.x + vak.b && y >= vak.y && y <= vak.y + vak.h;

  /** Volgt het veld vanaf (x, y) in één richting; geeft de punten zonder het startpunt. */
  const volg = (x, y, teken, eigen, max) => {
    const uit = [];
    let px = x;
    let py = y;
    for (let s = 0; s < max; s++) {
      const a1 = hoek(px, py);
      const mx = px + Math.cos(a1) * stap * 0.5 * teken;
      const my = py + Math.sin(a1) * stap * 0.5 * teken;
      const a2 = hoek(mx, my);
      const nx = px + Math.cos(a2) * stap * teken;
      const ny = py + Math.sin(a2) * stap * teken;
      if (!binnen(nx, ny) || !vrij(nx, ny, toets)) break;
      // Niet in een kringetje terug naar zichzelf.
      let botst = false;
      for (let i = 0; i < eigen.length - 6; i++) {
        const q = eigen[i];
        if ((q.x - nx) ** 2 + (q.y - ny) ** 2 < toets * toets) {
          botst = true;
          break;
        }
      }
      if (botst) break;
      px = nx;
      py = ny;
      const p = { x: px, y: py };
      uit.push(p);
      eigen.push(p);
    }
    return uit;
  };

  // Startpunten: een verschoven raster, in willekeurige volgorde.
  const kans = willekeur(w.zaad * 31 + 7);
  const starts = [];
  for (let y = vak.y + ds * 0.5; y < vak.y + vak.h; y += ds) {
    for (let x = vak.x + ds * 0.5; x < vak.x + vak.b; x += ds) {
      starts.push({ x: x + (kans() - 0.5) * ds * 0.8, y: y + (kans() - 0.5) * ds * 0.8 });
    }
  }
  for (let i = starts.length - 1; i > 0; i--) {
    const j = Math.floor(kans() * (i + 1));
    [starts[i], starts[j]] = [starts[j], starts[i]];
  }

  const lijnen = [];
  let totaalStappen = 0;
  for (const s of starts) {
    if (!binnen(s.x, s.y) || !vrij(s.x, s.y, ds * 0.95)) continue;
    const eigen = [{ x: s.x, y: s.y }];
    const voor = volg(s.x, s.y, 1, eigen, Math.ceil(maxStappen / 2));
    const achter = volg(s.x, s.y, -1, eigen.slice().reverse(), maxStappen - voor.length);
    const lijn = [...achter.reverse(), { x: s.x, y: s.y }, ...voor];
    totaalStappen += lijn.length;
    if (lijn.length < minPunten) continue;
    lijn.forEach(voegToe);
    lijnen.push(lijn);
    if (totaalStappen > 4e6) break;
  }
  return { lijnen, stap, ds };
}

/** Elke zoveelste punt houden (begin en eind blijven), zodat de kromme weinig punten heeft. */
function dunUit(lijn, elke) {
  const uit = [];
  for (let i = 0; i < lijn.length; i += elke) uit.push(lijn[i]);
  const laatste = lijn[lijn.length - 1];
  if (uit[uit.length - 1] !== laatste) {
    if (uit.length > 1 && (lijn.length - 1) % elke < elke / 2) uit[uit.length - 1] = laatste;
    else uit.push(laatste);
  }
  return uit;
}

/** De dikte langs de lijn, van 0 tot 1, op relatieve plek t (0 = begin, 1 = eind). */
function profiel(weergave, t) {
  if (weergave === 'penseel') return Math.pow(1 - t, 0.65) * Math.min(1, t * 7 + 0.25);
  return Math.pow(Math.sin(Math.PI * begrens(t, 0, 1)), 0.55);
}

/** Een taps lint rond de punten: links heen, rechts terug, als gesloten subpad. */
function lint(punten, breedtes) {
  const n = punten.length;
  const links = [];
  const rechts = [];
  for (let i = 0; i < n; i++) {
    const a = punten[Math.max(0, i - 1)];
    const b = punten[Math.min(n - 1, i + 1)];
    let tx = b.x - a.x;
    let ty = b.y - a.y;
    const l = Math.hypot(tx, ty) || 1;
    tx /= l;
    ty /= l;
    const h = breedtes[i] / 2;
    links.push({ x: punten[i].x - ty * h, y: punten[i].y + tx * h });
    rechts.push({ x: punten[i].x + ty * h, y: punten[i].y - tx * h });
  }
  const kl = kromme(links);
  const kr = omgekeerd(kromme(rechts));
  // Een punt van nul breedte delen links en rechts: niet dubbel opnemen.
  if (breedtes[n - 1] < 0.02) kr.shift();
  if (breedtes[0] < 0.02) kr.pop();
  return { gesloten: true, punten: [...kl, ...kr] };
}

/** Alle vormen; `vak` is het gebied in pt. */
function maakVeld(w, vak, cmyk) {
  const { lijnen, stap, ds } = stroomlijnen(w, vak);
  const palet = PALETTEN[w.palet] || PALETTEN.gloed;
  const kleuren = palet.kleuren;
  const elke = Math.max(2, Math.round(begrens(vexel.mm(w.schaal) / 14, ds * 0.9, vexel.mm(7)) / stap));
  const dikte = (ds * w.dikte) / 100;
  const kleurRuis = maakVeldRuis(w.zaad + 101, 2);
  const kleurSchaal = vexel.mm(w.schaal) * 1.3;
  const kans = willekeur(w.zaad * 7 + 3);
  const kleurOp = (p) => {
    const v = (kleurRuis(p.x / kleurSchaal, p.y / kleurSchaal) + 1) / 2;
    return begrens(Math.floor(begrens((v - 0.5) * 1.5 + 0.5, 0, 0.9999) * kleuren.length), 0, kleuren.length - 1);
  };
  // Per kleur een lijst subpaden.
  const perKleur = kleuren.map(() => []);
  const stukken = [];
  for (const lijn of lijnen) {
    const punten = dunUit(lijn, elke);
    if (punten.length < 2) continue;
    const lengte = lijn.length * stap;
    // Korte lijnen zijn wat dunner, zodat ze niet als vlekjes ogen.
    const dik = dikte * Math.pow(begrens(lengte / (ds * 10), 0.35, 1), 0.5);
    const t = punten.map((_, i) => i / (punten.length - 1));
    let indelingen;
    if (w.kleurwijze === 'langs') {
      // Knippen waar het kleurveld een andere kleur geeft (stukken van minstens drie punten).
      indelingen = [];
      let begin = 0;
      let huidig = kleurOp(punten[0]);
      for (let i = 1; i < punten.length; i++) {
        const k = kleurOp(punten[i]);
        if (k !== huidig && i - begin >= 2 && punten.length - i >= 2) {
          indelingen.push({ van: begin, tot: i, kleur: huidig });
          begin = i;
          huidig = k;
        }
      }
      indelingen.push({ van: begin, tot: punten.length - 1, kleur: huidig });
    } else {
      const k = w.kleurwijze === 'afwisselend' ? Math.floor(kans() * kleuren.length) : kleurOp(punten[punten.length >> 1]);
      indelingen = [{ van: 0, tot: punten.length - 1, kleur: k }];
    }
    for (const d of indelingen) {
      const deel = punten.slice(d.van, d.tot + 1);
      if (w.weergave === 'lijnen') {
        perKleur[d.kleur].push({ gesloten: false, punten: kromme(deel) });
      } else {
        const breedtes = deel.map((_, i) => dik * profiel(w.weergave, t[d.van + i]));
        perKleur[d.kleur].push(lint(deel, breedtes));
      }
      stukken.push(1);
    }
  }
  const kinderen = [];
  if (w.achtergrond) {
    kinderen.push({ soort: 'rechthoek', naam: 'Achtergrond', x: rond(vak.x), y: rond(vak.y), b: rond(vak.b), h: rond(vak.h),
      vulling: alsKleur(palet.achtergrond, cmyk), lijn: null, lijndikte: 0 });
  }
  const lijnenGroep = [];
  perKleur.forEach((subpaden, k) => {
    for (let i = 0; i < subpaden.length; i += GRENS.subpaden) {
      const deel = subpaden.slice(i, i + GRENS.subpaden);
      const naam = `Kleur ${k + 1}` + (subpaden.length > GRENS.subpaden ? ` (${i / GRENS.subpaden + 1})` : '');
      const kleur = alsKleur(kleuren[k], cmyk);
      if (w.weergave === 'lijnen') {
        lijnenGroep.push({ soort: 'pad', naam, subpaden: deel, vulling: null, lijn: kleur,
          lijndikte: rond(Math.max(0.1, dikte * 0.7)), lijneinde: 'round', lijnhoek: 'round' });
      } else {
        lijnenGroep.push({ soort: 'pad', naam, subpaden: deel, vulling: kleur, lijn: null, lijndikte: 0 });
      }
    }
  });
  kinderen.push({ soort: 'groep', naam: 'Lijnen', kinderen: lijnenGroep });
  return { vormen: [{ soort: 'groep', naam: 'Stromingsveld', kinderen }], lijnen: lijnen.length, stukken: stukken.length };
}

// ---- het venster ----------------------------------------------------------

async function toonVenster() {
  const doc = await vexel.document();
  const cmyk = doc.kleurruimte === 'cmyk';
  const opgeslagen = await vexel.haal('instellingen');
  const w0 = { ...STANDAARD, ...(opgeslagen || {}) };
  let selectie = [];
  try {
    selectie = await vexel.selectie();
  } catch (fout) {
    selectie = [];
  }

  const velden = {
    gebied: keuzeVeld({ afloop: 'Tekengebied met afloop', tekengebied: 'Tekengebied', selectie: 'Selectie (het kader)' }, w0.gebied),
    weergave: keuzeVeld(WEERGAVEN, w0.weergave),
    afstand: getalVeld(w0.afstand, 0.8, 40, 0.1),
    dikte: getalVeld(w0.dikte, 5, 100, 5),
    lengte: getalVeld(w0.lengte, 5, 2000, 5),
    minLengte: getalVeld(w0.minLengte, 0, 500, 1),
    schaal: getalVeld(w0.schaal, 5, 2000, 5),
    kronkel: getalVeld(w0.kronkel, 0, 100, 5),
    richting: getalVeld(w0.richting, -360, 360, 5),
    lagen: keuzeVeld({ 1: 'Rustig', 2: 'Natuurlijk', 3: 'Onrustig' }, String(w0.lagen)),
    palet: keuzeVeld(Object.fromEntries(Object.entries(PALETTEN).map(([k, v]) => [k, v.naam])), w0.palet),
    kleurwijze: keuzeVeld(KLEURWIJZEN, w0.kleurwijze),
    zaad: getalVeld(w0.zaad, 1, 999999, 1),
  };
  const achtergrond = maak('input', { type: 'checkbox' });
  achtergrond.checked = w0.achtergrond !== false;
  const achteraan = maak('input', { type: 'checkbox' });
  achteraan.checked = w0.achteraan !== false;
  const stalen = maak('span', { 'aria-hidden': 'true', stijl: { display: 'flex', gap: '2px', flex: 'none' } });
  const anders = maak('button', { klasse: 'knop', type: 'button', tekst: 'Anders', title: 'Een ander zaadje: hetzelfde soort veld, andere lijnen',
    stijl: { flex: 'none' },
    bijClick: () => {
      velden.zaad.value = String(1 + Math.floor(Math.random() * 999998));
      plan();
    } });

  const doek = maak('canvas', { 'aria-hidden': 'true', stijl: { width: '100%', height: '230px', borderRadius: '6px' } });
  const samenvatting = maak('p', { klasse: 'uitleg', 'aria-live': 'polite', stijl: { margin: '0', minHeight: '30px' } });
  const maakKnop = maak('button', { klasse: 'knop primair', type: 'submit', tekst: 'Stromingsveld maken' });
  const annuleer = maak('button', { klasse: 'knop', type: 'button', tekst: 'Annuleren', bijClick: () => vexel.sluit() });
  const vinkje = (vak, tekst) => maak('label', { klasse: 'rij', stijl: { margin: '0', gap: '6px' } }, vak, maak('span', { tekst }));

  const achteraanRij = vinkje(achteraan, 'Achteraan in de laag');
  const formulier = maak('form', { stijl: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '8px' } },
    doek,
    regel('Vullen', velden.gebied),
    regel('Weergave', velden.weergave),
    twee(regel('Afstand', velden.afstand, 'mm'), regel('Dikte', velden.dikte, '%')),
    twee(regel('Max. lengte', velden.lengte, 'mm'), regel('Min. lengte', velden.minLengte, 'mm')),
    twee(regel('Golfmaat', velden.schaal, 'mm'), regel('Kronkel', velden.kronkel, '%')),
    twee(regel('Richting', velden.richting, '°'), regel('Stroming', velden.lagen)),
    regel('Palet', velden.palet, stalen),
    regel('Kleuren', velden.kleurwijze),
    regel('Zaadje', velden.zaad, anders),
    maak('div', { klasse: 'rij', stijl: { margin: '0', gap: '18px' } }, vinkje(achtergrond, 'Achtergrondvlak'), achteraanRij),
    samenvatting,
    maak('div', { klasse: 'knoppen', stijl: { marginTop: '0' } }, annuleer, maakKnop),
  );
  document.body.append(formulier);

  const waarden = () => ({
    gebied: velden.gebied.value,
    weergave: velden.weergave.value,
    afstand: begrens(leesGetal(velden.afstand, STANDAARD.afstand), 0.8, 40),
    dikte: begrens(leesGetal(velden.dikte, STANDAARD.dikte), 5, 100),
    lengte: begrens(leesGetal(velden.lengte, STANDAARD.lengte), 5, 2000),
    minLengte: begrens(leesGetal(velden.minLengte, STANDAARD.minLengte), 0, 500),
    schaal: begrens(leesGetal(velden.schaal, STANDAARD.schaal), 5, 2000),
    kronkel: begrens(leesGetal(velden.kronkel, STANDAARD.kronkel), 0, 100),
    richting: begrens(leesGetal(velden.richting, STANDAARD.richting), -360, 360),
    lagen: Number(velden.lagen.value) || 2,
    palet: velden.palet.value,
    kleurwijze: velden.kleurwijze.value,
    achtergrond: achtergrond.checked,
    achteraan: achteraan.checked,
    zaad: Math.round(begrens(leesGetal(velden.zaad, 1), 1, 999999)),
  });

  const gebiedVan = (w, items) => {
    const tg = doc.tekengebied;
    if (w.gebied === 'tekengebied') return { x: 0, y: 0, b: tg.b, h: tg.h };
    if (w.gebied === 'afloop') {
      const a = doc.afloop || { boven: 0, rechts: 0, onder: 0, links: 0 };
      return { x: -a.links, y: -a.boven, b: tg.b + a.links + a.rechts, h: tg.h + a.boven + a.onder };
    }
    if (!items.length) return { fout: 'Er is niets geselecteerd. Selecteer een vorm, of kies "Tekengebied" bij Vullen.' };
    const x0 = Math.min(...items.map((o) => o.kader.x));
    const y0 = Math.min(...items.map((o) => o.kader.y));
    const x1 = Math.max(...items.map((o) => o.kader.x + o.kader.b));
    const y1 = Math.max(...items.map((o) => o.kader.y + o.kader.h));
    if (!(x1 - x0 > 5) || !(y1 - y0 > 5)) return { fout: 'De selectie is te klein om te vullen.' };
    return { x: x0, y: y0, b: x1 - x0, h: y1 - y0 };
  };

  function bouw(w, items) {
    const gebied = gebiedVan(w, items);
    if (gebied.fout) return gebied;
    const ruwAantal = (gebied.b * gebied.h) / (vexel.mm(w.afstand) ** 2);
    if (ruwAantal > 60000) {
      return { fout: `De afstand is te klein voor dit gebied. Kies een afstand van minstens ${getal(Math.sqrt((gebied.b * gebied.h) / 60000) / vexel.mm(1) + 0.05, 1)} mm.`, gebied };
    }
    const uitkomst = maakVeld(w, gebied, cmyk);
    const t = tel(uitkomst.vormen);
    if (!uitkomst.lijnen) return { fout: 'Er past geen enkele lijn. Kies een kleinere minimale lengte of afstand.', gebied };
    if (t.punten > GRENS.punten || t.vormen > GRENS.vormen) {
      return { fout: `Te veel punten (${getal(t.punten, 0)}, hooguit 50.000). Kies een grotere afstand of een grotere golfmaat.`, gebied };
    }
    return { ...uitkomst, gebied, punten: t.punten };
  }

  let gepland = false;
  function teken() {
    gepland = false;
    const w = waarden();
    achteraanRij.style.visibility = w.gebied === 'selectie' ? 'hidden' : '';
    const palet = PALETTEN[w.palet] || PALETTEN.gloed;
    stalen.replaceChildren(...[palet.achtergrond, ...palet.kleuren].map((c, i) => maak('span', { stijl: {
      width: i ? '10px' : '14px', height: '18px', borderRadius: '3px', border: '1px solid var(--lijn)', background: kleurCss({ cmyk: c }) } })));
    const uitkomst = bouw(w, selectie);
    const g = uitkomst.gebied;
    const zicht = !g ? null : {
      x: Math.min(0, g.x), y: Math.min(0, g.y),
      b: Math.max(doc.tekengebied.b, g.x + g.b) - Math.min(0, g.x),
      h: Math.max(doc.tekengebied.h, g.y + g.h) - Math.min(0, g.y),
    };
    tekenVoorbeeld(doek, doc, uitkomst.vormen || [], zicht);
    maakKnop.disabled = Boolean(uitkomst.fout) || doc.alleenLezen;
    samenvatting.classList.toggle('fout', Boolean(uitkomst.fout) || doc.alleenLezen);
    if (doc.alleenLezen) samenvatting.textContent = 'Dit document is alleen-lezen: je kunt hier niets aan toevoegen.';
    else if (uitkomst.fout) samenvatting.textContent = uitkomst.fout;
    else {
      const kleuren = (PALETTEN[w.palet] || PALETTEN.gloed).kleuren.length;
      samenvatting.textContent = `${getal(uitkomst.lijnen, 0)} lijnen op ${getal(w.afstand)} mm afstand, `
        + `in ${kleuren} kleuren (${getal(uitkomst.punten, 0)} punten, ${getal(g.b / vexel.mm(1), 0)} × ${getal(g.h / vexel.mm(1), 0)} mm).`;
    }
  }
  function plan() {
    if (!gepland) {
      gepland = true;
      requestAnimationFrame(teken);
    }
  }

  formulier.addEventListener('input', plan);
  formulier.addEventListener('change', plan);
  formulier.addEventListener('submit', async (gebeurtenis) => {
    gebeurtenis.preventDefault();
    const w = waarden();
    maakKnop.disabled = true;
    try {
      const items = w.gebied === 'selectie' ? await vexel.selectie() : [];
      const uitkomst = bouw(w, items);
      if (uitkomst.fout) {
        vexel.melding(uitkomst.fout, 'let');
        maakKnop.disabled = false;
        return;
      }
      // In de selectie komt het veld bovenop de vorm, anders zou de vorm het afdekken.
      await vexel.maak(uitkomst.vormen, w.achteraan && w.gebied !== 'selectie' ? { achteraan: true } : undefined);
      await vexel.bewaar('instellingen', w);
      vexel.melding(`Stromingsveld gemaakt: ${getal(uitkomst.lijnen, 0)} lijnen.`, 'ok');
      vexel.sluit();
    } catch (fout) {
      maakKnop.disabled = false;
      vexel.melding(fout && fout.message ? fout.message : 'Het stromingsveld kon niet worden gemaakt.', 'fout');
    }
  });

  if (velden.gebied.value === 'selectie' && !selectie.length) velden.gebied.value = 'afloop';
  else if (selectie.length && !opgeslagen) velden.gebied.value = 'selectie';
  teken();
  velden.afstand.focus();
  velden.afstand.select();
}

vexel.opCommando('maken', toonVenster);
