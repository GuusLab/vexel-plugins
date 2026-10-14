// Voronoi-cellen: organische cellen met een voeg, afgeronde hoeken en Lloyd-relaxatie.
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

const rond = (n) => Math.round(n * 100) / 100;

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
      g.fill(p, v.vulregel === 'evenodd' ? 'evenodd' : 'nonzero');
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
// Alles in CMYK; in een RGB-document wordt het omgerekend. `achtergrond` is de kleur van de voeg.

const PALETTEN = {
  kiezels: { naam: 'Kiezels', achtergrond: [20, 25, 35, 55],
    kleuren: [[5, 10, 20, 5], [10, 20, 35, 15], [20, 30, 45, 30], [0, 15, 25, 0], [15, 15, 20, 25]] },
  lagune: { naam: 'Lagune', achtergrond: [0, 3, 10, 0],
    kleuren: [[100, 60, 20, 30], [85, 20, 30, 5], [60, 0, 25, 0], [30, 0, 15, 0]] },
  zonsondergang: { naam: 'Zonsondergang', achtergrond: [80, 85, 40, 60],
    kleuren: [[70, 90, 10, 10], [10, 85, 40, 0], [0, 60, 75, 0], [0, 25, 80, 0]] },
  giraffe: { naam: 'Giraffe', achtergrond: [0, 6, 18, 0],
    kleuren: [[20, 65, 90, 20], [15, 55, 85, 10], [25, 70, 95, 30], [10, 50, 80, 5]] },
  weefsel: { naam: 'Weefsel', achtergrond: [0, 20, 10, 0],
    kleuren: [[0, 75, 35, 0], [0, 60, 25, 0], [5, 85, 45, 10], [0, 45, 20, 0]] },
  mos: { naam: 'Mos', achtergrond: [75, 45, 75, 55],
    kleuren: [[60, 10, 80, 15], [40, 0, 70, 5], [20, 0, 60, 0], [70, 25, 85, 30]] },
  pastel: { naam: 'Pastel', achtergrond: [0, 0, 0, 0],
    kleuren: [[40, 0, 15, 0], [0, 35, 15, 0], [0, 15, 45, 0], [30, 25, 0, 0], [55, 10, 35, 0]] },
  inkt: { naam: 'Inkt', achtergrond: [0, 3, 10, 2], kleuren: [[70, 60, 50, 85], [60, 50, 45, 70]] },
};

const WEERGAVEN = { vlakken: 'Cellen met voeg', randen: 'Alleen de randen' };
const KLEURWIJZEN = { verloop: 'Verloop over het vlak', willekeurig: 'Willekeurig uit het palet' };
const RICHTINGEN = {
  geen: 'Overal even groot', onder: 'Naar onderen', boven: 'Naar boven', links: 'Naar links', rechts: 'Naar rechts',
  midden: 'Naar het midden', rand: 'Naar de rand',
};

const STANDAARD = {
  gebied: 'afloop', weergave: 'vlakken', celmaat: 11, regelmaat: 3, kleiner: 'onder', verschil: 2.5, voeg: 1.2, afronding: 80,
  palet: 'lagune', kleurwijze: 'verloop', hoek: 60, variatie: 25, achtergrond: true, achteraan: true, zaad: 1618,
};

// ---- meetkunde ------------------------------------------------------------

/** Knipt een veelhoek af op de halfruimte waar a·x + b·y ≤ c. */
function knipHalf(veelhoek, a, b, c) {
  const uit = [];
  const n = veelhoek.length;
  for (let i = 0; i < n; i++) {
    const p = veelhoek[i];
    const q = veelhoek[(i + 1) % n];
    const dp = a * p.x + b * p.y - c;
    const dq = a * q.x + b * q.y - c;
    if (dp <= 0) uit.push(p);
    if ((dp < 0 && dq > 0) || (dp > 0 && dq < 0)) {
      const t = dp / (dp - dq);
      uit.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
    }
  }
  return uit;
}

function oppervlak(veelhoek) {
  let s = 0;
  for (let i = 0, n = veelhoek.length; i < n; i++) {
    const p = veelhoek[i];
    const q = veelhoek[(i + 1) % n];
    s += p.x * q.y - q.x * p.y;
  }
  return s / 2;
}

/** Zwaartepunt; met `dichtheid` gewogen (per driehoek van een waaier vanuit het eerste punt). */
function zwaartepunt(veelhoek, dichtheid) {
  let sx = 0;
  let sy = 0;
  let sw = 0;
  const a = veelhoek[0];
  for (let i = 1; i < veelhoek.length - 1; i++) {
    const b = veelhoek[i];
    const c = veelhoek[i + 1];
    const opp = Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)) / 2;
    const mx = (a.x + b.x + c.x) / 3;
    const my = (a.y + b.y + c.y) / 3;
    const g = opp * (dichtheid ? dichtheid(mx, my) : 1);
    sx += mx * g;
    sy += my * g;
    sw += g;
  }
  return sw > 0 ? { x: sx / sw, y: sy / sw } : { x: a.x, y: a.y };
}

/** Ligt het punt binnen de veelhoeken (even-oneven-regel)? */
function binnenVorm(veelhoeken, x, y) {
  let binnen = false;
  for (const v of veelhoeken) {
    for (let i = 0, j = v.length - 1; i < v.length; j = i++) {
      const a = v[i];
      const b = v[j];
      if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) binnen = !binnen;
    }
  }
  return binnen;
}

/** Een subpad (met handvatten) als veelhoek met korte rechte stukjes. */
function vlakAf(subpad, stappen = 10) {
  const pt = subpad.punten;
  const n = pt.length;
  const uit = [];
  if (!n) return uit;
  for (let i = 0; i < n; i++) {
    const a = pt[i];
    const b = pt[(i + 1) % n];
    uit.push({ x: a.x, y: a.y });
    if (i === n - 1 && !subpad.gesloten) break;
    if (!a.uit && !b.in) continue;
    const c1 = a.uit || a;
    const c2 = b.in || b;
    for (let k = 1; k < stappen; k++) {
      const t = k / stappen;
      const u = 1 - t;
      uit.push({
        x: u * u * u * a.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * b.x,
        y: u * u * u * a.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * b.y,
      });
    }
  }
  return uit;
}

// ---- de cellen ------------------------------------------------------------

/**
 * De celmaat op een plek, van `celmaat` (groot) tot `celmaat / verschil` (klein),
 * afhankelijk van waar de cellen kleiner moeten worden.
 */
function maatVeld(w, vak) {
  const groot = vexel.mm(w.celmaat);
  const klein = groot / Math.max(1, w.verschil);
  if (w.kleiner === 'geen' || w.verschil <= 1) return () => groot;
  const mx = vak.x + vak.b / 2;
  const my = vak.y + vak.h / 2;
  const half = Math.hypot(vak.b, vak.h) / 2;
  const plek = {
    onder: (x, y) => (y - vak.y) / vak.h,
    boven: (x, y) => 1 - (y - vak.y) / vak.h,
    rechts: (x) => (x - vak.x) / vak.b,
    links: (x) => 1 - (x - vak.x) / vak.b,
    midden: (x, y) => 1 - Math.hypot(x - mx, y - my) / half,
    rand: (x, y) => Math.hypot(x - mx, y - my) / half,
  }[w.kleiner];
  return (x, y) => {
    const t = begrens(plek(x, y), 0, 1);
    const z = t * t * (3 - 2 * t);
    return groot + (klein - groot) * z;
  };
}

/** Een rooster om snel de buren van een punt te vinden. */
function maakRooster(punten, vak, cel) {
  const kol = Math.max(1, Math.ceil(vak.b / cel));
  const rijen = Math.max(1, Math.ceil(vak.h / cel));
  const vakjes = Array.from({ length: kol * rijen }, () => []);
  const plek = (p) => [begrens(Math.floor((p.x - vak.x) / cel), 0, kol - 1), begrens(Math.floor((p.y - vak.y) / cel), 0, rijen - 1)];
  punten.forEach((p, i) => {
    const [cx, cy] = plek(p);
    vakjes[cy * kol + cx].push(i);
  });
  return { kol, rijen, vakjes, plek, cel };
}

/**
 * De Voronoi-cel van punt i: begin met het hele vak en knip af op de middelloodlijn met elke
 * buur. Buren worden ring voor ring gezocht; zodra de ring verder ligt dan twee keer het
 * verste hoekpunt van de cel, kan geen buur de cel nog kleiner maken.
 */
function cel(i, punten, rooster, vak) {
  const p = punten[i];
  let veelhoek = [{ x: vak.x, y: vak.y }, { x: vak.x + vak.b, y: vak.y }, { x: vak.x + vak.b, y: vak.y + vak.h }, { x: vak.x, y: vak.y + vak.h }];
  const [cx, cy] = rooster.plek(p);
  const maxRing = Math.max(rooster.kol, rooster.rijen);
  for (let r = 0; r <= maxRing; r++) {
    for (let j = cy - r; j <= cy + r; j++) {
      if (j < 0 || j >= rooster.rijen) continue;
      const rand = j === cy - r || j === cy + r;
      for (let k = cx - r; k <= cx + r; k += rand ? 1 : 2 * r || 1) {
        if (k < 0 || k >= rooster.kol) continue;
        for (const m of rooster.vakjes[j * rooster.kol + k]) {
          if (m === i) continue;
          const q = punten[m];
          const a = q.x - p.x;
          const b = q.y - p.y;
          if (!a && !b) continue;
          veelhoek = knipHalf(veelhoek, a, b, (a * (p.x + q.x) + b * (p.y + q.y)) / 2);
          if (veelhoek.length < 3) return null;
        }
      }
    }
    let verst = 0;
    for (const v of veelhoek) verst = Math.max(verst, Math.hypot(v.x - p.x, v.y - p.y));
    if (r * rooster.cel > 2 * verst + rooster.cel) break;
  }
  return veelhoek;
}

/** De startpunten: willekeurig verspreid, met meer punten waar de cellen klein zijn. */
function startpunten(w, vak, maat, magHier) {
  const kans = willekeur(w.zaad);
  const klein = vexel.mm(w.celmaat) / Math.max(1, w.verschil);
  // Schatting van het aantal cellen: oppervlak gedeeld door de celmaat in het kwadraat.
  let som = 0;
  const proef = 400;
  for (let i = 0; i < proef; i++) {
    const x = vak.x + kans() * vak.b;
    const y = vak.y + kans() * vak.h;
    if (magHier(x, y)) som += 1 / (maat(x, y) ** 2);
  }
  const aantal = Math.round(((som / proef) * vak.b * vak.h) / 0.87);
  if (aantal > 6000) return { teVeel: aantal };
  const punten = [];
  let pogingen = 0;
  while (punten.length < aantal && pogingen < aantal * 400) {
    pogingen++;
    const x = vak.x + kans() * vak.b;
    const y = vak.y + kans() * vak.h;
    if (!magHier(x, y)) continue;
    if (kans() > (klein / maat(x, y)) ** 2) continue;
    punten.push({ x, y });
  }
  return { punten };
}

/** Alle cellen als veelhoeken, na `w.regelmaat` stappen Lloyd-relaxatie. */
function cellen(w, vak, magHier) {
  const maat = maatVeld(w, vak);
  const start = startpunten(w, vak, maat, magHier);
  if (start.teVeel) return { teVeel: start.teVeel };
  let punten = start.punten;
  if (punten.length < 2) return { cellen: [] };
  const klein = vexel.mm(w.celmaat) / Math.max(1, w.verschil);
  const dichtheid = w.kleiner === 'geen' ? null : (x, y) => 1 / (maat(x, y) ** 2);
  let veelhoeken = [];
  for (let stap = 0; stap <= w.regelmaat; stap++) {
    const rooster = maakRooster(punten, vak, klein);
    veelhoeken = punten.map((_, i) => cel(i, punten, rooster, vak));
    if (stap === w.regelmaat) break;
    // Lloyd: elk punt naar het (gewogen) zwaartepunt van zijn cel; buiten de vorm blijft het staan.
    punten = punten.map((p, i) => {
      const v = veelhoeken[i];
      if (!v) return p;
      const z = zwaartepunt(v, dichtheid);
      return magHier(z.x, z.y) ? z : p;
    });
  }
  return { cellen: veelhoeken.map((v, i) => (v ? { veelhoek: v, punt: punten[i] } : null)).filter(Boolean) };
}

/** Een bolle veelhoek een afstand d naar binnen zetten (elke rand evenwijdig naar binnen). */
function zetIn(veelhoek, d) {
  if (d <= 0) return veelhoek;
  const richting = oppervlak(veelhoek) > 0 ? 1 : -1;
  let uit = veelhoek;
  for (let i = 0, n = veelhoek.length; i < n; i++) {
    const p = veelhoek[i];
    const q = veelhoek[(i + 1) % n];
    const lengte = Math.hypot(q.x - p.x, q.y - p.y);
    if (lengte < 1e-9) continue;
    // Normaal naar buiten; halfruimte: normaal · x ≤ normaal · p - d.
    const nx = (richting * (q.y - p.y)) / lengte;
    const ny = (-richting * (q.x - p.x)) / lengte;
    uit = knipHalf(uit, nx, ny, nx * p.x + ny * p.y - d);
    if (uit.length < 3) return null;
  }
  return uit;
}

/** Korte randjes (van het knippen) samenvoegen, zodat de afronding mooi blijft. */
function zonderKorteRanden(veelhoek, min) {
  const uit = [];
  for (const p of veelhoek) {
    const vorige = uit[uit.length - 1];
    if (vorige && Math.hypot(p.x - vorige.x, p.y - vorige.y) < min) continue;
    uit.push(p);
  }
  while (uit.length > 3 && Math.hypot(uit[0].x - uit[uit.length - 1].x, uit[0].y - uit[uit.length - 1].y) < min) uit.pop();
  return uit;
}

/**
 * Afgeronde hoeken: elke hoek wordt een Bézierboog die op beide randen begint op afstand t van
 * de hoek. Bij 100 % is t de halve rand, dan sluiten de bogen naadloos aan (een kiezelvorm).
 */
function rondAf(veelhoek, procent) {
  const n = veelhoek.length;
  const f = procent / 100;
  const k = 0.55;
  if (f <= 0) return veelhoek.map((p) => ({ x: rond(p.x), y: rond(p.y) }));
  const uit = [];
  for (let i = 0; i < n; i++) {
    const v = veelhoek[i];
    const a = veelhoek[(i + n - 1) % n];
    const b = veelhoek[(i + 1) % n];
    const la = Math.hypot(a.x - v.x, a.y - v.y);
    const lb = Math.hypot(b.x - v.x, b.y - v.y);
    const t = Math.min(la, lb) * 0.5 * f;
    const p1 = { x: v.x + ((a.x - v.x) * t) / la, y: v.y + ((a.y - v.y) * t) / la };
    const p2 = { x: v.x + ((b.x - v.x) * t) / lb, y: v.y + ((b.y - v.y) * t) / lb };
    uit.push({ x: p1.x, y: p1.y, uit: { x: p1.x + (v.x - p1.x) * k, y: p1.y + (v.y - p1.y) * k } });
    uit.push({ x: p2.x, y: p2.y, in: { x: p2.x + (v.x - p2.x) * k, y: p2.y + (v.y - p2.y) * k } });
  }
  // Punten die (bijna) samenvallen worden één punt met beide handvatten.
  const samen = [];
  for (const p of uit) {
    const vorige = samen[samen.length - 1];
    if (vorige && Math.hypot(p.x - vorige.x, p.y - vorige.y) < 0.05) {
      if (p.uit) vorige.uit = p.uit;
      if (p.in) vorige.in = p.in;
    } else samen.push({ ...p });
  }
  if (samen.length > 1) {
    const eerste = samen[0];
    const laatste = samen[samen.length - 1];
    if (Math.hypot(eerste.x - laatste.x, eerste.y - laatste.y) < 0.05) {
      if (laatste.in) eerste.in = laatste.in;
      samen.pop();
    }
  }
  return samen.map((p) => {
    const q = { x: rond(p.x), y: rond(p.y) };
    if (p.in) q.in = { x: rond(p.in.x), y: rond(p.in.y) };
    if (p.uit) q.uit = { x: rond(p.uit.x), y: rond(p.uit.y) };
    return q;
  });
}

/**
 * Een (bolle) cel knippen op de vorm: elk subpad van de vorm wordt geknipt met de cel als mes
 * (dat kan omdat de cel bol is). Gaten in de vorm komen er als eigen subpad bij; met de
 * even-oneven-regel blijven ze open.
 */
function knipOpVorm(celVeelhoek, vorm) {
  const richting = oppervlak(celVeelhoek) > 0 ? 1 : -1;
  const stukken = [];
  for (const v of vorm) {
    let stuk = v;
    for (let i = 0, n = celVeelhoek.length; i < n && stuk.length >= 3; i++) {
      const p = celVeelhoek[i];
      const q = celVeelhoek[(i + 1) % n];
      const nx = richting * (q.y - p.y);
      const ny = -richting * (q.x - p.x);
      stuk = knipHalf(stuk, nx, ny, nx * p.x + ny * p.y);
    }
    if (stuk.length >= 3 && Math.abs(oppervlak(stuk)) > 0.5) stukken.push(stuk);
  }
  return stukken;
}

/** Een kleur (CMYK-waarden) op plek t van 0 tot 1 langs de kleuren van het palet. */
function langsPalet(kleuren, t) {
  const n = kleuren.length;
  if (n === 1) return kleuren[0].slice();
  const s = begrens(t, 0, 1) * (n - 1);
  const i = Math.min(n - 2, Math.floor(s));
  const f = s - i;
  return kleuren[i].map((v, j) => Math.round((v + (kleuren[i + 1][j] - v) * f) * 10) / 10);
}

/**
 * Alle vormen. `vak` is het gebied in pt; `vorm` (optioneel) de veelhoeken van de
 * geselecteerde vorm als de cellen daarbinnen moeten blijven.
 */
function maakCellen(w, vak, vorm, cmyk) {
  const magHier = vorm ? (x, y) => binnenVorm(vorm, x, y) : () => true;
  const uitkomst = cellen(w, vak, magHier);
  if (uitkomst.teVeel) return { teVeel: uitkomst.teVeel };
  const palet = PALETTEN[w.palet] || PALETTEN.lagune;
  const kleuren = palet.kleuren;
  const kans = willekeur(w.zaad * 13 + 5);
  const voeg = vexel.mm(w.voeg);
  const randen = w.weergave === 'randen';
  const hoek = (w.hoek * Math.PI) / 180;
  const ux = Math.cos(hoek);
  const uy = Math.sin(hoek);
  // De projectie van het vak op de verlooprichting, om t van 0 tot 1 te krijgen.
  const hoeken = [[vak.x, vak.y], [vak.x + vak.b, vak.y], [vak.x, vak.y + vak.h], [vak.x + vak.b, vak.y + vak.h]].map(([x, y]) => x * ux + y * uy);
  const pMin = Math.min(...hoeken);
  const pMax = Math.max(...hoeken);
  const TINTEN = 16;

  const groepen = new Map();
  let aantal = 0;
  for (const c of uitkomst.cellen) {
    const ingezet = zetIn(c.veelhoek, randen ? voeg / 2 : voeg / 2);
    if (!ingezet) continue;
    const schoon = zonderKorteRanden(ingezet, 0.15);
    if (schoon.length < 3 || Math.abs(oppervlak(schoon)) < 1) continue;
    let subpaden;
    const afgerond = rondAf(schoon, w.afronding);
    if (!vorm) subpaden = [{ gesloten: true, punten: afgerond }];
    else {
      const plat = vlakAf({ gesloten: true, punten: afgerond }, 5);
      const geheelBinnen = plat.every((p) => binnenVorm(vorm, p.x, p.y))
        && !vorm.some((v) => v.some((p) => binnenVorm([plat], p.x, p.y)));
      if (geheelBinnen) subpaden = [{ gesloten: true, punten: afgerond }];
      else {
        subpaden = knipOpVorm(plat, vorm).map((s) => ({ gesloten: true, punten: s.map((p) => ({ x: rond(p.x), y: rond(p.y) })) }));
        if (!subpaden.length) continue;
      }
    }
    let sleutel;
    let waarden;
    if (w.kleurwijze === 'willekeurig') {
      sleutel = Math.floor(kans() * kleuren.length);
      waarden = kleuren[sleutel];
    } else {
      const t = (c.punt.x * ux + c.punt.y * uy - pMin) / (pMax - pMin || 1);
      const s = begrens(t + (kans() - 0.5) * (w.variatie / 100), 0, 1);
      sleutel = Math.round(s * (TINTEN - 1));
      waarden = langsPalet(kleuren, sleutel / (TINTEN - 1));
    }
    if (!groepen.has(sleutel)) groepen.set(sleutel, { waarden, subpaden: [] });
    groepen.get(sleutel).subpaden.push(...subpaden);
    aantal++;
  }

  const kinderen = [];
  if (w.achtergrond) {
    const bg = vorm
      ? { soort: 'pad', naam: 'Voeg', subpaden: vorm.map((v) => ({ gesloten: true, punten: v.map((p) => ({ x: rond(p.x), y: rond(p.y) })) })), vulregel: 'evenodd' }
      : { soort: 'rechthoek', naam: 'Voeg', x: rond(vak.x), y: rond(vak.y), b: rond(vak.b), h: rond(vak.h) };
    kinderen.push({ ...bg, vulling: alsKleur(palet.achtergrond, cmyk), lijn: null, lijndikte: 0 });
  }
  const celVormen = [];
  [...groepen.keys()].sort((a, b) => a - b).forEach((sleutel, nr) => {
    const g = groepen.get(sleutel);
    const kleur = alsKleur(g.waarden, cmyk);
    for (let i = 0; i < g.subpaden.length; i += GRENS.subpaden) {
      const deel = g.subpaden.slice(i, i + GRENS.subpaden);
      const naam = `Kleur ${nr + 1}` + (g.subpaden.length > GRENS.subpaden ? ` (${i / GRENS.subpaden + 1})` : '');
      if (randen) {
        celVormen.push({ soort: 'pad', naam, subpaden: deel, vulling: null, lijn: kleur, lijndikte: rond(Math.max(0.1, voeg)),
          lijnhoek: 'round', lijneinde: 'round' });
      } else celVormen.push({ soort: 'pad', naam, subpaden: deel, vulregel: 'evenodd', vulling: kleur, lijn: null, lijndikte: 0 });
    }
  });
  kinderen.push({ soort: 'groep', naam: 'Cellen', kinderen: celVormen });
  return { vormen: [{ soort: 'groep', naam: 'Voronoi-cellen', kinderen }], cellen: aantal, kleuren: groepen.size };
}

// ---- het venster ----------------------------------------------------------

/** De veelhoeken van de geselecteerde vormen (alleen paden en samengestelde paden). */
function vormVanSelectie(items) {
  const paden = items.filter((o) => Array.isArray(o.subpaden) && o.subpaden.length);
  if (!paden.length) return null;
  const veelhoeken = [];
  for (const o of paden) {
    for (const s of o.subpaden) {
      const v = zonderKorteRanden(vlakAf({ ...s, gesloten: true }, 12), 0.05);
      if (v.length >= 3 && Math.abs(oppervlak(v)) > 1) veelhoeken.push(v);
    }
  }
  return veelhoeken.length ? veelhoeken : null;
}

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
    gebied: keuzeVeld({
      afloop: 'Tekengebied met afloop', tekengebied: 'Tekengebied', kader: 'Selectie (het kader)', vorm: 'Selectie (binnen de vorm)',
    }, w0.gebied),
    weergave: keuzeVeld(WEERGAVEN, w0.weergave),
    celmaat: getalVeld(w0.celmaat, 1, 300, 0.5),
    regelmaat: getalVeld(w0.regelmaat, 0, 20, 1),
    kleiner: keuzeVeld(RICHTINGEN, w0.kleiner),
    verschil: getalVeld(w0.verschil, 1, 8, 0.5),
    voeg: getalVeld(w0.voeg, 0, 50, 0.1),
    afronding: getalVeld(w0.afronding, 0, 100, 5),
    palet: keuzeVeld(Object.fromEntries(Object.entries(PALETTEN).map(([k, v]) => [k, v.naam])), w0.palet),
    kleurwijze: keuzeVeld(KLEURWIJZEN, w0.kleurwijze),
    hoek: getalVeld(w0.hoek, -360, 360, 5),
    variatie: getalVeld(w0.variatie, 0, 100, 5),
    zaad: getalVeld(w0.zaad, 1, 999999, 1),
  };
  const achtergrond = maak('input', { type: 'checkbox' });
  achtergrond.checked = w0.achtergrond !== false;
  const achteraan = maak('input', { type: 'checkbox' });
  achteraan.checked = w0.achteraan !== false;
  const stalen = maak('span', { 'aria-hidden': 'true', stijl: { display: 'flex', gap: '2px', flex: 'none' } });
  const anders = maak('button', { klasse: 'knop', type: 'button', tekst: 'Anders', title: 'Een ander zaadje: dezelfde instellingen, andere cellen',
    stijl: { flex: 'none' },
    bijClick: () => {
      velden.zaad.value = String(1 + Math.floor(Math.random() * 999998));
      plan();
    } });

  const doek = maak('canvas', { 'aria-hidden': 'true', stijl: { width: '100%', height: '230px', borderRadius: '6px' } });
  const samenvatting = maak('p', { klasse: 'uitleg', 'aria-live': 'polite', stijl: { margin: '0', minHeight: '30px' } });
  const maakKnop = maak('button', { klasse: 'knop primair', type: 'submit', tekst: 'Cellen maken' });
  const annuleer = maak('button', { klasse: 'knop', type: 'button', tekst: 'Annuleren', bijClick: () => vexel.sluit() });
  const vinkje = (vak, tekst) => maak('label', { klasse: 'rij', stijl: { margin: '0', gap: '6px' } }, vak, maak('span', { tekst }));
  const achteraanRij = vinkje(achteraan, 'Achteraan in de laag');
  const voegRij = regel('Voeg', velden.voeg, 'mm');
  const hoekRij = regel('Hoek', velden.hoek, '°');
  const variatieRij = regel('Variatie', velden.variatie, '%');
  const verschilRij = regel('Verschil', velden.verschil, '×');

  const formulier = maak('form', { stijl: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '8px' } },
    doek,
    regel('Vullen', velden.gebied),
    regel('Weergave', velden.weergave),
    twee(regel('Celmaat', velden.celmaat, 'mm'), regel('Regelmaat', velden.regelmaat, 'stap')),
    twee(regel('Kleiner', velden.kleiner), verschilRij),
    twee(voegRij, regel('Afronding', velden.afronding, '%')),
    regel('Palet', velden.palet, stalen),
    regel('Kleuren', velden.kleurwijze),
    twee(hoekRij, variatieRij),
    regel('Zaadje', velden.zaad, anders),
    maak('div', { klasse: 'rij', stijl: { margin: '0', gap: '18px' } }, vinkje(achtergrond, 'Achtergrond (voegkleur)'), achteraanRij),
    samenvatting,
    maak('div', { klasse: 'knoppen', stijl: { marginTop: '0' } }, annuleer, maakKnop),
  );
  document.body.append(formulier);

  const waarden = () => ({
    gebied: velden.gebied.value,
    weergave: velden.weergave.value,
    celmaat: begrens(leesGetal(velden.celmaat, STANDAARD.celmaat), 1, 300),
    regelmaat: Math.round(begrens(leesGetal(velden.regelmaat, STANDAARD.regelmaat), 0, 20)),
    kleiner: velden.kleiner.value,
    verschil: begrens(leesGetal(velden.verschil, STANDAARD.verschil), 1, 8),
    voeg: begrens(leesGetal(velden.voeg, STANDAARD.voeg), 0, 50),
    afronding: begrens(leesGetal(velden.afronding, STANDAARD.afronding), 0, 100),
    palet: velden.palet.value,
    kleurwijze: velden.kleurwijze.value,
    hoek: begrens(leesGetal(velden.hoek, STANDAARD.hoek), -360, 360),
    variatie: begrens(leesGetal(velden.variatie, STANDAARD.variatie), 0, 100),
    achtergrond: achtergrond.checked,
    achteraan: achteraan.checked,
    zaad: Math.round(begrens(leesGetal(velden.zaad, 1), 1, 999999)),
  });

  const kaderVan = (items) => {
    const x0 = Math.min(...items.map((o) => o.kader.x));
    const y0 = Math.min(...items.map((o) => o.kader.y));
    const x1 = Math.max(...items.map((o) => o.kader.x + o.kader.b));
    const y1 = Math.max(...items.map((o) => o.kader.y + o.kader.h));
    return { x: x0, y: y0, b: x1 - x0, h: y1 - y0 };
  };

  const gebiedVan = (w, items) => {
    const tg = doc.tekengebied;
    if (w.gebied === 'tekengebied') return { vak: { x: 0, y: 0, b: tg.b, h: tg.h } };
    if (w.gebied === 'afloop') {
      const a = doc.afloop || { boven: 0, rechts: 0, onder: 0, links: 0 };
      return { vak: { x: -a.links, y: -a.boven, b: tg.b + a.links + a.rechts, h: tg.h + a.boven + a.onder } };
    }
    if (!items.length) return { fout: 'Er is niets geselecteerd. Selecteer een vorm, of kies "Tekengebied" bij Vullen.' };
    if (w.gebied === 'vorm') {
      const vorm = vormVanSelectie(items);
      if (!vorm) return { fout: 'De selectie heeft geen vorm om in te vullen (alleen paden). Kies "Selectie (het kader)".' };
      const xs = vorm.flat().map((p) => p.x);
      const ys = vorm.flat().map((p) => p.y);
      const vak = { x: Math.min(...xs), y: Math.min(...ys), b: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
      if (!(vak.b > 5) || !(vak.h > 5)) return { fout: 'De selectie is te klein om te vullen.' };
      return { vak, vorm };
    }
    const vak = kaderVan(items);
    if (!(vak.b > 5) || !(vak.h > 5)) return { fout: 'De selectie is te klein om te vullen.' };
    return { vak };
  };

  function bouw(w, items) {
    const gebied = gebiedVan(w, items);
    if (gebied.fout) return gebied;
    const uitkomst = maakCellen(w, gebied.vak, gebied.vorm, cmyk);
    if (uitkomst.teVeel) {
      return { fout: `Dat worden zo'n ${getal(uitkomst.teVeel, 0)} cellen (hooguit 6.000). Kies een grotere celmaat of minder verschil.`, gebied: gebied.vak };
    }
    if (!uitkomst.cellen) return { fout: 'Er past geen enkele cel. Kies een kleinere celmaat of een smallere voeg.', gebied: gebied.vak };
    const t = tel(uitkomst.vormen);
    if (t.punten > GRENS.punten || t.vormen > GRENS.vormen) {
      return { fout: `Te veel punten (${getal(t.punten, 0)}, hooguit 50.000). Kies een grotere celmaat.`, gebied: gebied.vak };
    }
    return { ...uitkomst, gebied: gebied.vak, punten: t.punten };
  }

  let gepland = false;
  function teken() {
    gepland = false;
    const w = waarden();
    const palet = PALETTEN[w.palet] || PALETTEN.lagune;
    achteraanRij.style.visibility = w.gebied === 'kader' || w.gebied === 'vorm' ? 'hidden' : '';
    verschilRij.style.visibility = w.kleiner === 'geen' ? 'hidden' : '';
    hoekRij.style.visibility = w.kleurwijze === 'verloop' ? '' : 'hidden';
    variatieRij.style.visibility = w.kleurwijze === 'verloop' ? '' : 'hidden';
    voegRij.firstChild.textContent = w.weergave === 'randen' ? 'Lijndikte' : 'Voeg';
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
      samenvatting.textContent = `${getal(uitkomst.cellen, 0)} cellen in ${uitkomst.kleuren} `
        + `${uitkomst.kleuren === 1 ? 'kleur' : 'kleuren'} (${getal(uitkomst.punten, 0)} punten, `
        + `${getal(g.b / vexel.mm(1), 0)} × ${getal(g.h / vexel.mm(1), 0)} mm).`;
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
      const items = w.gebied === 'kader' || w.gebied === 'vorm' ? await vexel.selectie() : [];
      const uitkomst = bouw(w, items);
      if (uitkomst.fout) {
        vexel.melding(uitkomst.fout, 'let');
        maakKnop.disabled = false;
        return;
      }
      // In de selectie komen de cellen bovenop de vorm, anders zou de vorm ze afdekken.
      const binnen = w.gebied === 'kader' || w.gebied === 'vorm';
      await vexel.maak(uitkomst.vormen, w.achteraan && !binnen ? { achteraan: true } : undefined);
      await vexel.bewaar('instellingen', w);
      vexel.melding(`Voronoi-cellen gemaakt: ${getal(uitkomst.cellen, 0)} cellen.`, 'ok');
      vexel.sluit();
    } catch (fout) {
      maakKnop.disabled = false;
      vexel.melding(fout && fout.message ? fout.message : 'De cellen konden niet worden gemaakt.', 'fout');
    }
  });

  const metSelectie = velden.gebied.value === 'kader' || velden.gebied.value === 'vorm';
  if (metSelectie && !selectie.length) velden.gebied.value = 'afloop';
  else if (selectie.length && !opgeslagen) velden.gebied.value = vormVanSelectie(selectie) ? 'vorm' : 'kader';
  teken();
  velden.celmaat.focus();
  velden.celmaat.select();
}

vexel.opCommando('maken', toonVenster);
