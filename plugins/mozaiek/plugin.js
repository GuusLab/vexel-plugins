// Mozaïek: een low-poly- of celmozaïek als achtergrond, ingekleurd met een verloop.
// De punten, de Delaunay-driehoeken en de Voronoi-cellen worden hier zelf uitgerekend.
// Eigen werk, MIT-licentie (zie de README van deze repo).
'use strict';

const MAX_CELLEN = 4000;

const STANDAARD = {
  soort: 'driehoeken', verdeling: 'poisson', celmaat: 14, onregelmatig: 70,
  palet: 'avond', kleuren: ['#1d2b64', '#8a3f8f', '#f6a57a'], drieKleuren: true,
  verloop: 'lineair', hoek: 120, variatie: 40,
  lijnen: 'geen', lijndikte: 0.5,
  gebied: 'afloop', afloop: 3, zaad: 1,
};

const PALETTEN = {
  avond: { naam: 'Avondlucht', kleuren: ['#1d2b64', '#8a3f8f', '#f6a57a'] },
  zee: { naam: 'Zee', kleuren: ['#0b3d5c', '#1f7a9c', '#9fe0d8'] },
  bos: { naam: 'Bos', kleuren: ['#12372a', '#3d7a4a', '#c9d97b'] },
  zand: { naam: 'Zand', kleuren: ['#7a4b2a', '#d49a5b', '#f4e2b8'] },
  vuur: { naam: 'Vuur', kleuren: ['#5c0f1b', '#d8452b', '#ffc94a'] },
  ijs: { naam: 'IJs', kleuren: ['#dfe9f3', '#9bbbd9', '#3e6a9a'] },
  grijs: { naam: 'Leisteen', kleuren: ['#1f232a', '#5f6773', '#d9dde3'] },
  eigen: { naam: 'Eigen kleuren', kleuren: null },
};

// ---- willekeur met zaadje -----------------------------------------------------

/** Een kleine xorshift-generator: hetzelfde zaadje geeft altijd dezelfde reeks. */
function willekeur(zaad) {
  let s = (Math.imul((zaad | 0) ^ 0x2545f491, 0x9e3779b1) >>> 0) || 1;
  const volgende = () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
  for (let i = 0; i < 8; i++) volgende();
  return volgende;
}

// ---- kleur --------------------------------------------------------------------

const begrens = (n, min, max) => Math.min(max, Math.max(min, n));
const hexNaarRgb = (hex) => {
  const n = parseInt(String(hex).slice(1), 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const rgbNaarHex = (rgb) => '#' + rgb.map((v) => Math.round(begrens(v, 0, 255)).toString(16).padStart(2, '0')).join('');
function rgbNaarCmyk([r, g, b]) {
  const [rr, gg, bb] = [r / 255, g / 255, b / 255];
  const k = 1 - Math.max(rr, gg, bb);
  if (k >= 0.999) return [0, 0, 0, 100];
  return [(1 - rr - k) / (1 - k), (1 - gg - k) / (1 - k), (1 - bb - k) / (1 - k), k].map((n) => n * 100);
}
function cmykNaarRgb([c, m, y, k]) {
  const z = 1 - k / 100;
  return [255 * (1 - c / 100) * z, 255 * (1 - m / 100) * z, 255 * (1 - y / 100) * z];
}

/** Mengt twee kleuren (lijsten getallen, RGB of CMYK) met verhouding t. */
const meng = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

function verloopKleur(t, stops) {
  t = begrens(t, 0, 1);
  if (stops.length === 2) return meng(stops[0], stops[1], t);
  return t < 0.5 ? meng(stops[0], stops[1], t * 2) : meng(stops[1], stops[2], (t - 0.5) * 2);
}

/** Maakt een kleur iets lichter (s > 0) of donkerder (s < 0). */
function schakeer(kleur, s, cmyk) {
  if (cmyk) {
    if (s >= 0) return [kleur[0] * (1 - s), kleur[1] * (1 - s), kleur[2] * (1 - s), kleur[3] * (1 - s)];
    return [kleur[0], kleur[1], kleur[2], kleur[3] + -s * (100 - kleur[3])];
  }
  return s >= 0 ? kleur.map((v) => v + (255 - v) * s) : kleur.map((v) => v * (1 + s));
}

const rond1 = (n) => Math.round(begrens(n, 0, 100) * 10) / 10;
const alsKleur = (waarden, cmyk) => (cmyk ? { cmyk: waarden.map(rond1) } : { hex: rgbNaarHex(waarden) });
const alsCss = (waarden, cmyk) => rgbNaarHex(cmyk ? cmykNaarRgb(waarden) : waarden);

// ---- punten -------------------------------------------------------------------

/**
 * Punten in het gebied E: eerst een ring op de rand (zodat de driehoeken het hele
 * gebied dekken), dan het binnenste met Poisson-schijven of een verspringend raster.
 */
function maakPunten(E, celmaat, verdeling, onregelmatig, rnd) {
  // Poisson-punten liggen losser dan een raster; met 0,77 krijg je even grote cellen
  const d = verdeling === 'raster' ? celmaat : celmaat * 0.77;
  const xs = [];
  const ys = [];
  const cel = d / Math.SQRT2;
  const gb = Math.ceil(E.b / cel) + 1;
  const gh = Math.ceil(E.h / cel) + 1;
  const rooster = new Int32Array(gb * gh).fill(-1);
  const vak = (x, y) => [begrens(Math.floor((x - E.x) / cel), 0, gb - 1), begrens(Math.floor((y - E.y) / cel), 0, gh - 1)];
  const zet = (x, y) => {
    const [i, j] = vak(x, y);
    rooster[j * gb + i] = xs.length;
    xs.push(x);
    ys.push(y);
  };
  const vrij = (x, y) => {
    const [gi, gj] = vak(x, y);
    for (let j = Math.max(0, gj - 2); j <= Math.min(gh - 1, gj + 2); j++) {
      for (let i = Math.max(0, gi - 2); i <= Math.min(gb - 1, gi + 2); i++) {
        const k = rooster[j * gb + i];
        if (k >= 0 && (xs[k] - x) ** 2 + (ys[k] - y) ** 2 < d * d) return false;
      }
    }
    return true;
  };

  // de ring: elke zijde in gelijke stukken van minstens d
  const hoeken = [[E.x, E.y], [E.x + E.b, E.y], [E.x + E.b, E.y + E.h], [E.x, E.y + E.h]];
  for (let z = 0; z < 4; z++) {
    const [ax, ay] = hoeken[z];
    const [bx, by] = hoeken[(z + 1) % 4];
    const n = Math.max(1, Math.floor(Math.hypot(bx - ax, by - ay) / d));
    for (let i = 0; i < n; i++) zet(ax + ((bx - ax) * i) / n, ay + ((by - ay) * i) / n);
  }
  const ring = xs.length;

  if (verdeling === 'raster') {
    const rijHoogte = d * 0.866;
    const j = begrens(onregelmatig, 0, 100) / 100;
    for (let r = 0; r * rijHoogte <= E.h; r++) {
      const verschuif = r % 2 ? d / 2 : 0;
      for (let k = -1; k * d <= E.b; k++) {
        const x = E.x + verschuif + k * d + (rnd() - 0.5) * j * d;
        const y = E.y + r * rijHoogte + (rnd() - 0.5) * j * rijHoogte;
        if (x - E.x < d / 2 || E.x + E.b - x < d / 2 || y - E.y < d / 2 || E.y + E.h - y < d / 2) continue;
        xs.push(x);
        ys.push(y);
      }
    }
  } else {
    // Poisson-schijven (Bridson): nieuwe punten tussen d en 2d van een actief punt
    const actief = [];
    for (let i = 0; i < ring; i++) actief.push(i);
    const midden = [E.x + E.b / 2, E.y + E.h / 2];
    if (vrij(...midden)) {
      actief.push(xs.length);
      zet(...midden);
    }
    while (actief.length) {
      const plek = Math.floor(rnd() * actief.length);
      const k = actief[plek];
      let gevonden = false;
      for (let poging = 0; poging < 24; poging++) {
        const hoek = rnd() * Math.PI * 2;
        const afstand = d * (1 + rnd());
        const x = xs[k] + Math.cos(hoek) * afstand;
        const y = ys[k] + Math.sin(hoek) * afstand;
        if (x <= E.x || x >= E.x + E.b || y <= E.y || y >= E.y + E.h || !vrij(x, y)) continue;
        actief.push(xs.length);
        zet(x, y);
        gevonden = true;
        break;
      }
      if (!gevonden) {
        actief[plek] = actief[actief.length - 1];
        actief.pop();
      }
    }
  }
  // een heel klein beetje ruis, zodat er nooit drie punten precies op één lijn liggen
  for (let i = 0; i < xs.length; i++) {
    xs[i] += (rnd() - 0.5) * d * 0.004;
    ys[i] += (rnd() - 0.5) * d * 0.004;
  }
  return { xs, ys };
}

// ---- Delaunay (punt voor punt invoegen, met omklappen) ------------------------
// Elke driehoek t heeft drie halve randen 3t, 3t+1, 3t+2. Rand e loopt van punt
// V[e] naar het beginpunt van de volgende rand; H[e] is de rand ertegenover in
// de buurdriehoek (of -1). Alle driehoeken draaien dezelfde kant op.

const volgendeRand = (e) => (e % 3 === 2 ? e - 2 : e + 1);
const vorigeRand = (e) => (e % 3 === 0 ? e + 2 : e - 1);

function delaunay(xs0, ys0) {
  const n = xs0.length;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < n; i++) {
    x0 = Math.min(x0, xs0[i]); x1 = Math.max(x1, xs0[i]);
    y0 = Math.min(y0, ys0[i]); y1 = Math.max(y1, ys0[i]);
  }
  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2;
  const groot = Math.max(x1 - x0, y1 - y0, 1) * 40;
  // eigen coördinaten rond het midden, dat rekent nauwkeuriger
  const X = new Float64Array(n + 3);
  const Y = new Float64Array(n + 3);
  for (let i = 0; i < n; i++) { X[i] = xs0[i] - mx; Y[i] = ys0[i] - my; }
  X[n] = -groot; Y[n] = -groot;
  X[n + 1] = groot; Y[n + 1] = -groot;
  X[n + 2] = 0; Y[n + 2] = groot;

  const maxDriehoeken = 2 * (n + 3);
  const V = new Int32Array(3 * maxDriehoeken);
  const H = new Int32Array(3 * maxDriehoeken).fill(-1);
  let aantal = 0;
  const nieuw = (a, b, c) => {
    const t = aantal++;
    V[3 * t] = a; V[3 * t + 1] = b; V[3 * t + 2] = c;
    return t;
  };
  const koppel = (a, b) => {
    H[a] = b;
    if (b >= 0) H[b] = a;
  };
  const orient = (a, b, c) => (X[b] - X[a]) * (Y[c] - Y[a]) - (Y[b] - Y[a]) * (X[c] - X[a]);
  const inCirkel = (a, b, c, p) => {
    const adx = X[a] - X[p], ady = Y[a] - Y[p];
    const bdx = X[b] - X[p], bdy = Y[b] - Y[p];
    const cdx = X[c] - X[p], cdy = Y[c] - Y[p];
    const det = (adx * adx + ady * ady) * (bdx * cdy - cdx * bdy)
      - (bdx * bdx + bdy * bdy) * (adx * cdy - cdx * ady)
      + (cdx * cdx + cdy * cdy) * (adx * bdy - bdx * ady);
    return det * orient(a, b, c) > 0;
  };

  const stapel = [];
  function legaliseer(start) {
    stapel.push(start);
    while (stapel.length) {
      const a = stapel.pop();
      const b = H[a];
      if (b < 0) continue;
      const a0 = a - (a % 3);
      const b0 = b - (b % 3);
      const al = a0 + ((a + 1) % 3);
      const ar = a0 + ((a + 2) % 3);
      const bl = b0 + ((b + 2) % 3);
      const br = b0 + ((b + 1) % 3);
      const p0 = V[ar], pr = V[a], pl = V[al], p1 = V[bl];
      if (!inCirkel(p0, pr, pl, p1)) continue;
      V[a] = p1;
      V[b] = p0;
      const hbl = H[bl];
      const har = H[ar];
      koppel(a, hbl);
      koppel(b, har);
      koppel(ar, bl);
      stapel.push(a, br);
    }
  }

  function zoek(p, t) {
    for (let stap = 0; stap < 4 * n + 64; stap++) {
      let verder = false;
      for (let k = 0; k < 3; k++) {
        const e = 3 * t + k;
        if (orient(V[e], V[volgendeRand(e)], p) < 0 && H[e] >= 0) {
          t = Math.floor(H[e] / 3);
          verder = true;
          break;
        }
      }
      if (!verder) return t;
    }
    for (let s = 0; s < aantal; s++) {
      if (orient(V[3 * s], V[3 * s + 1], p) >= 0 && orient(V[3 * s + 1], V[3 * s + 2], p) >= 0
        && orient(V[3 * s + 2], V[3 * s], p) >= 0) return s;
    }
    return t;
  }

  nieuw(n, n + 1, n + 2);
  // punt voor punt, in slingervolgorde, zodat het zoeken kort blijft
  const strook = Math.max((y1 - y0) / Math.max(1, Math.sqrt(n / 4)), 1e-9);
  const volgorde = Array.from({ length: n }, (_, i) => i);
  const rij = (i) => Math.floor((Y[i] - (y0 - my)) / strook);
  volgorde.sort((a, b) => rij(a) - rij(b) || (rij(a) % 2 ? X[b] - X[a] : X[a] - X[b]));

  let t = 0;
  for (const p of volgorde) {
    t = zoek(p, t);
    const e0 = 3 * t;
    const a = V[e0], b = V[e0 + 1], c = V[e0 + 2];
    const hab = H[e0], hbc = H[e0 + 1], hca = H[e0 + 2];
    V[e0 + 2] = p;
    const t1 = nieuw(b, c, p);
    const t2 = nieuw(c, a, p);
    const f0 = 3 * t1;
    const g0 = 3 * t2;
    koppel(e0, hab); koppel(f0, hbc); koppel(g0, hca);
    koppel(e0 + 1, f0 + 2); koppel(f0 + 1, g0 + 2); koppel(g0 + 1, e0 + 2);
    legaliseer(e0); legaliseer(f0); legaliseer(g0);
  }

  return { V, H, aantal, n, X, Y, mx, my };
}

function middelpuntOmgeschreven(D, t) {
  const a = D.V[3 * t], b = D.V[3 * t + 1], c = D.V[3 * t + 2];
  const ax = D.X[a], ay = D.Y[a];
  const bx = D.X[b] - ax, by = D.Y[b] - ay;
  const cx = D.X[c] - ax, cy = D.Y[c] - ay;
  const dd = 2 * (bx * cy - by * cx);
  if (Math.abs(dd) < 1e-12) return [ax + D.mx, ay + D.my];
  const b2 = bx * bx + by * by;
  const c2 = cx * cx + cy * cy;
  return [ax + (cy * b2 - by * c2) / dd + D.mx, ay + (bx * c2 - cx * b2) / dd + D.my];
}

// ---- knippen op een rechthoek -------------------------------------------------

function knipRechthoek(veelhoek, R) {
  const randen = [
    (p) => p[0] - R.x, (p) => R.x + R.b - p[0],
    (p) => p[1] - R.y, (p) => R.y + R.h - p[1],
  ];
  let uit = veelhoek;
  for (const binnen of randen) {
    if (uit.length < 3) return [];
    const nieuw = [];
    for (let i = 0; i < uit.length; i++) {
      const p = uit[i];
      const q = uit[(i + 1) % uit.length];
      const dp = binnen(p);
      const dq = binnen(q);
      if (dp >= 0) nieuw.push(p);
      if ((dp >= 0) !== (dq >= 0)) {
        const t = dp / (dp - dq);
        nieuw.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
      }
    }
    uit = nieuw;
  }
  return uit;
}

const oppervlak = (v) => {
  let s = 0;
  for (let i = 0; i < v.length; i++) {
    const p = v[i];
    const q = v[(i + 1) % v.length];
    s += p[0] * q[1] - q[0] * p[1];
  }
  return Math.abs(s / 2);
};

// ---- het mozaïek --------------------------------------------------------------

/** Rekent de stukjes uit voor gebied A (in pt). Geeft { stukjes } of { fout }. */
function berekenMozaiek(w, A, d) {
  const marge = 1.5 * d;
  const E = { x: A.x - marge, y: A.y - marge, b: A.b + 2 * marge, h: A.h + 2 * marge };
  const schatting = (E.b * E.h) / (d * d);
  if (schatting > 30000) {
    return { fout: 'Dat worden veel te veel cellen. Maak de celmaat groter.' };
  }
  const rnd = willekeur(w.zaad);
  const { xs, ys } = maakPunten(E, d, w.verdeling, w.onregelmatig, rnd);
  const D = delaunay(xs, ys);
  const stukjes = [];
  const klein = d * d * 1e-4;

  if (w.soort === 'driehoeken') {
    for (let t = 0; t < D.aantal; t++) {
      const a = D.V[3 * t], b = D.V[3 * t + 1], c = D.V[3 * t + 2];
      if (a >= D.n || b >= D.n || c >= D.n) continue;
      const v = knipRechthoek([[xs[a], ys[a]], [xs[b], ys[b]], [xs[c], ys[c]]], A);
      if (v.length < 3 || oppervlak(v) < klein) continue;
      stukjes.push({ v, m: [(xs[a] + xs[b] + xs[c]) / 3, (ys[a] + ys[b] + ys[c]) / 3] });
    }
  } else {
    const uit = new Int32Array(D.n).fill(-1);
    for (let e = 0; e < 3 * D.aantal; e++) if (D.V[e] < D.n) uit[D.V[e]] = e;
    const midden = new Map();
    const mp = (t) => {
      if (!midden.has(t)) midden.set(t, middelpuntOmgeschreven(D, t));
      return midden.get(t);
    };
    for (let i = 0; i < D.n; i++) {
      // punten ver buiten het gebied overslaan
      if (xs[i] < A.x - d || xs[i] > A.x + A.b + d || ys[i] < A.y - d || ys[i] > A.y + A.h + d) continue;
      const start = uit[i];
      if (start < 0) continue;
      const cel = [];
      let e = start;
      let rond = false;
      for (let stap = 0; stap < 64; stap++) {
        cel.push(mp(Math.floor(e / 3)));
        e = D.H[vorigeRand(e)];
        if (e < 0) break;
        if (e === start) { rond = true; break; }
      }
      if (!rond) continue;
      const v = knipRechthoek(cel, A);
      if (v.length < 3 || oppervlak(v) < klein) continue;
      stukjes.push({ v, m: [xs[i], ys[i]] });
    }
  }
  if (stukjes.length > MAX_CELLEN) {
    return {
      fout: `Dat worden ${stukjes.length.toLocaleString('nl-NL')} ${w.soort === 'driehoeken' ? 'driehoeken' : 'cellen'};`
        + ` hooguit ${MAX_CELLEN.toLocaleString('nl-NL')}. Maak de celmaat groter.`,
      aantal: stukjes.length,
    };
  }

  // kleuren: verloop over het gebied, met wat variatie per stukje
  const kr = willekeur(w.zaad * 7919 + 17);
  const cmyk = w.cmyk;
  const stops = (w.drieKleuren ? w.kleuren : [w.kleuren[0], w.kleuren[2]])
    .map((hex) => (cmyk ? rgbNaarCmyk(hexNaarRgb(hex)) : hexNaarRgb(hex)));
  const hoek = (w.hoek * Math.PI) / 180;
  const ux = Math.cos(hoek);
  const uy = Math.sin(hoek);
  const lengte = Math.abs(A.b * ux) + Math.abs(A.h * uy) || 1;
  const cx = A.x + A.b / 2;
  const cy = A.y + A.h / 2;
  const straal = Math.hypot(A.b, A.h) / 2 || 1;
  const v = w.variatie / 100;
  for (const s of stukjes) {
    let t = w.verloop === 'radiaal'
      ? Math.hypot(s.m[0] - cx, s.m[1] - cy) / straal
      : ((s.m[0] - cx) * ux + (s.m[1] - cy) * uy) / lengte + 0.5;
    t += (kr() - 0.5) * v * 0.22;
    s.kleur = schakeer(verloopKleur(t, stops), (kr() - 0.5) * 2 * v * 0.16, cmyk);
  }
  return { stukjes };
}

// ---- venster-hulpjes ----------------------------------------------------------

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
const css = (naam, terugval) => getComputedStyle(document.documentElement).getPropertyValue(naam).trim() || terugval;
const getal = (n, cijfers = 1) => n.toLocaleString('nl-NL', { maximumFractionDigits: cijfers });

const getalVeld = (waarde, min, max, stap) =>
  maak('input', { klasse: 'veld', type: 'number', min, max, step: stap, value: waarde, stijl: { width: '100%' } });

function keuzeVeld(opties, waarde) {
  const veld = maak('select', { klasse: 'veld', stijl: { width: '100%' } },
    ...opties.map(([w, t]) => maak('option', { value: w, tekst: t })));
  veld.value = opties.some(([w]) => w === waarde) ? waarde : opties[0][0];
  return veld;
}

const metLabel = (tekst, veld, eenheid) =>
  maak('label', { stijl: { display: 'grid', gap: '3px', minWidth: '0' } },
    maak('span', { klasse: 'label', tekst, stijl: { minWidth: '0' } }),
    eenheid
      ? maak('span', { stijl: { display: 'flex', alignItems: 'center', gap: '6px' } }, veld,
        maak('span', { klasse: 'uitleg', tekst: eenheid, stijl: { flex: 'none' } }))
      : veld);

const kolommen = (...kinderen) =>
  maak('div', { stijl: { display: 'grid', gridTemplateColumns: `repeat(${kinderen.length}, minmax(0, 1fr))`, gap: '10px', alignItems: 'end' } },
    ...kinderen);

const kleurVeld = (hex, label) =>
  maak('input', {
    type: 'color', value: hex, 'aria-label': label,
    stijl: { width: '34px', height: '26px', padding: '0 2px', border: '1px solid var(--lijn)', borderRadius: '5px', background: 'var(--bg-2)' },
  });

// ---- het venster --------------------------------------------------------------

/** De afloop in pt per kant: die van het document als Vexel hem geeft, anders de ingevulde maat. */
function afloopVan(doc, mm) {
  const a = doc.afloop;
  const kant = (n) => (Number.isFinite(n) && n >= 0 ? n : null);
  if (a && [a.boven, a.rechts, a.onder, a.links].every((n) => kant(n) !== null)) {
    return { boven: a.boven, rechts: a.rechts, onder: a.onder, links: a.links, vanDocument: true };
  }
  const p = vexel.mm(mm);
  return { boven: p, rechts: p, onder: p, links: p, vanDocument: false };
}

function omhullende(items) {
  const x0 = Math.min(...items.map((v) => v.kader.x));
  const y0 = Math.min(...items.map((v) => v.kader.y));
  const x1 = Math.max(...items.map((v) => v.kader.x + v.kader.b));
  const y1 = Math.max(...items.map((v) => v.kader.y + v.kader.h));
  return { x: x0, y: y0, b: x1 - x0, h: y1 - y0 };
}

async function toonVenster() {
  const doc = await vexel.document();
  const w0 = { ...STANDAARD, ...((await vexel.haal('instellingen')) || {}) };
  let selectie = [];
  try {
    selectie = (await vexel.selectie()).filter((v) => v.kader && v.kader.b > 0 && v.kader.h > 0);
  } catch (fout) {
    selectie = [];
  }
  if (selectie.length && !(await vexel.haal('instellingen'))) w0.gebied = 'selectie';

  const soort = keuzeVeld([['driehoeken', 'Driehoeken'], ['cellen', 'Cellen']], w0.soort);
  const verdeling = keuzeVeld([['poisson', 'Vrij verspreid'], ['raster', 'Verspringend raster']], w0.verdeling);
  const celmaat = getalVeld(w0.celmaat, 2, 200, 1);
  const onregelmatig = getalVeld(w0.onregelmatig, 0, 100, 5);
  const palet = keuzeVeld(Object.entries(PALETTEN).map(([k, p]) => [k, p.naam]), w0.palet);
  const kleurVelden = [0, 1, 2].map((i) => kleurVeld(w0.kleuren[i] || '#888888', `Kleur ${i + 1}`));
  const drie = maak('input', { type: 'checkbox', 'aria-label': 'Drie kleuren gebruiken' });
  drie.checked = Boolean(w0.drieKleuren);
  const verloop = keuzeVeld([['lineair', 'Lineair'], ['radiaal', 'Radiaal']], w0.verloop);
  const hoek = getalVeld(w0.hoek, -360, 360, 5);
  const variatie = getalVeld(w0.variatie, 0, 100, 5);
  const lijnen = keuzeVeld([['geen', 'Geen'], ['licht', 'Licht'], ['donker', 'Donker']], w0.lijnen);
  const lijndikte = getalVeld(w0.lijndikte, 0.1, 10, 0.1);
  const gebiedOpties = [['afloop', 'Met afloop'], ['tekengebied', 'Tekengebied']];
  if (selectie.length) gebiedOpties.push(['selectie', 'Selectiekader']);
  const gebied = keuzeVeld(gebiedOpties, w0.gebied);
  const docAfloop = afloopVan(doc, w0.afloop);
  const afloop = getalVeld(w0.afloop, 0, 20, 0.5);
  if (docAfloop.vanDocument) {
    // de afloop van het document zelf; het veld laat hem alleen zien
    afloop.value = String(Math.round((Math.max(docAfloop.boven, docAfloop.rechts, docAfloop.onder, docAfloop.links) / vexel.mm(1)) * 10) / 10);
    afloop.title = 'De afloop van het document';
  }
  const achteraan = maak('input', { type: 'checkbox' });
  achteraan.checked = w0.achteraan !== false;
  const zaad = getalVeld(w0.zaad, 1, 99999, 1);
  const variant = maak('button', { klasse: 'knop', type: 'button', tekst: 'Andere variant' });

  const doek = maak('canvas', { 'aria-hidden': 'true', stijl: { width: '100%', height: '130px' } });
  const samenvatting = maak('p', { klasse: 'uitleg', 'aria-live': 'polite', stijl: { margin: '0', minHeight: '2.9em' } });
  const maakKnop = maak('button', { klasse: 'knop primair', type: 'submit', tekst: 'Mozaïek maken' });
  const annuleer = maak('button', { klasse: 'knop', type: 'button', tekst: 'Annuleren', bijClick: () => vexel.sluit() });

  const kleurRij = maak('div', { stijl: { display: 'flex', alignItems: 'center', gap: '6px' } },
    kleurVelden[0], kleurVelden[1], kleurVelden[2],
    maak('label', { klasse: 'uitleg', stijl: { display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '2px' } }, drie, 'midden'));

  const formulier = maak('form', { stijl: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '10px', padding: '12px 14px 14px' } },
    doek,
    kolommen(metLabel('Soort', soort), metLabel('Punten', verdeling)),
    kolommen(metLabel('Celmaat', celmaat, 'mm'), metLabel('Onregelmatig', onregelmatig, '%'), metLabel('Variant', zaad)),
    kolommen(metLabel('Kleuren', palet), maak('div', { stijl: { display: 'grid', gap: '3px' } },
      maak('span', { klasse: 'label', tekst: 'Begin · midden · eind', stijl: { minWidth: '0' } }), kleurRij)),
    kolommen(metLabel('Verloop', verloop), metLabel('Hoek', hoek, '°'), metLabel('Variatie', variatie, '%')),
    kolommen(metLabel('Lijnen', lijnen), metLabel('Lijndikte', lijndikte, 'pt'),
      maak('label', { klasse: 'uitleg', stijl: { display: 'flex', alignItems: 'center', gap: '5px', height: '26px', whiteSpace: 'nowrap' } },
        achteraan, 'Achteraan')),
    maak('div', { stijl: { display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '10px', alignItems: 'end' } },
      metLabel('Vullen', gebied), metLabel('Afloop', afloop, 'mm')),
    samenvatting,
    maak('div', { klasse: 'knoppen', stijl: { marginTop: '0' } },
      variant, maak('span', { stijl: { flex: '1' } }), annuleer, maakKnop),
  );
  document.head.append(maak('style', { tekst: '.veld:disabled{opacity:.45}.knop{white-space:nowrap}' }));
  document.body.style.padding = '0';
  document.body.append(formulier);

  const waarden = () => ({
    soort: soort.value,
    verdeling: verdeling.value,
    celmaat: begrens(leesGetal(celmaat, 14), 2, 200),
    onregelmatig: begrens(leesGetal(onregelmatig, 70), 0, 100),
    palet: palet.value,
    kleuren: kleurVelden.map((k) => k.value),
    drieKleuren: drie.checked,
    verloop: verloop.value,
    hoek: begrens(leesGetal(hoek, 0), -360, 360),
    variatie: begrens(leesGetal(variatie, 40), 0, 100),
    lijnen: lijnen.value,
    lijndikte: begrens(leesGetal(lijndikte, 0.5), 0.1, 10),
    gebied: gebied.value,
    afloop: begrens(leesGetal(afloop, 3), 0, 20),
    zaad: Math.round(begrens(leesGetal(zaad, 1), 1, 99999)),
    achteraan: achteraan.checked,
    cmyk: doc.kleurruimte === 'cmyk',
  });

  const gebiedVan = (w) => {
    if (w.gebied === 'selectie' && selectie.length) return omhullende(selectie);
    const a = w.gebied === 'afloop' ? afloopVan(doc, w.afloop) : { boven: 0, rechts: 0, onder: 0, links: 0 };
    return { x: -a.links, y: -a.boven, b: doc.tekengebied.b + a.links + a.rechts, h: doc.tekengebied.h + a.boven + a.onder };
  };

  let uitkomst = null;
  let gepland = false;
  function teken() {
    gepland = false;
    const w = waarden();
    onregelmatig.disabled = w.verdeling !== 'raster';
    hoek.disabled = w.verloop === 'radiaal';
    lijndikte.disabled = w.lijnen === 'geen';
    afloop.disabled = w.gebied !== 'afloop' || docAfloop.vanDocument;
    kleurVelden[1].style.opacity = w.drieKleuren ? '1' : '0.35';
    const A = gebiedVan(w);
    uitkomst = berekenMozaiek(w, A, vexel.mm(w.celmaat));

    const schaal = devicePixelRatio || 1;
    const kader = doek.getBoundingClientRect();
    doek.width = Math.round(kader.width * schaal);
    doek.height = Math.round(kader.height * schaal);
    const g = doek.getContext('2d');
    g.setTransform(schaal, 0, 0, schaal, 0, 0);
    g.clearRect(0, 0, kader.width, kader.height);
    const s = Math.min((kader.width - 16) / A.b, (kader.height - 16) / A.h);
    const ox = (kader.width - A.b * s) / 2 - A.x * s;
    const oy = (kader.height - A.h * s) / 2 - A.y * s;
    if (uitkomst.stukjes) {
      const lijnKleur = w.lijnen === 'licht' ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.55)';
      for (const st of uitkomst.stukjes) {
        g.beginPath();
        st.v.forEach(([x, y], i) => (i ? g.lineTo(ox + x * s, oy + y * s) : g.moveTo(ox + x * s, oy + y * s)));
        g.closePath();
        g.fillStyle = alsCss(st.kleur, w.cmyk);
        g.fill();
        g.lineJoin = 'round';
        if (w.lijnen === 'geen') {
          g.strokeStyle = g.fillStyle;
          g.lineWidth = 0.6;
        } else {
          g.strokeStyle = lijnKleur;
          g.lineWidth = Math.max(0.5, w.lijndikte * s);
        }
        g.stroke();
      }
    }
    // het tekengebied als stippellijn, zodat je de afloop ziet
    const tg = doc.tekengebied;
    g.setLineDash([3, 3]);
    g.strokeStyle = css('--tekst-zacht', '#b4b7bf');
    g.lineWidth = 1;
    g.strokeRect(ox + 0.5, oy + 0.5, tg.b * s, tg.h * s);
    g.setLineDash([]);

    const naam = w.soort === 'driehoeken' ? 'driehoeken' : 'cellen';
    const waar = w.gebied === 'selectie' ? 'kader van de selectie'
      : w.gebied === 'afloop' ? `tekengebied met ${afloop.value.replace('.', ',')} mm afloop` : 'tekengebied';
    if (doc.alleenLezen) samenvatting.textContent = 'Dit document is alleen-lezen; je kunt hier niets aan toevoegen.';
    else if (uitkomst.fout) samenvatting.textContent = uitkomst.fout;
    else {
      samenvatting.textContent = `${uitkomst.stukjes.length.toLocaleString('nl-NL')} ${naam} over `
        + `${getal(A.b / vexel.mm(1))} × ${getal(A.h / vexel.mm(1))} mm (${waar}).`;
    }
    samenvatting.classList.toggle('fout', Boolean(uitkomst.fout));
    maakKnop.disabled = Boolean(uitkomst.fout) || doc.alleenLezen;
  }
  const plan = () => {
    if (!gepland) {
      gepland = true;
      requestAnimationFrame(teken);
    }
  };

  palet.addEventListener('change', () => {
    const p = PALETTEN[palet.value];
    if (p && p.kleuren) kleurVelden.forEach((k, i) => { k.value = p.kleuren[i]; });
  });
  kleurVelden.forEach((k) => k.addEventListener('input', () => { palet.value = 'eigen'; }));
  variant.addEventListener('click', () => {
    zaad.value = String(1 + Math.floor(Math.random() * 99999));
    plan();
  });
  formulier.addEventListener('input', plan);
  formulier.addEventListener('change', plan);
  formulier.addEventListener('submit', async (gebeurtenis) => {
    gebeurtenis.preventDefault();
    const w = waarden();
    const A = gebiedVan(w);
    const r = berekenMozaiek(w, A, vexel.mm(w.celmaat));
    if (r.fout) return vexel.melding(r.fout, 'let');

    const lijnKleur = w.lijnen === 'licht'
      ? (w.cmyk ? { cmyk: [0, 0, 0, 0] } : { hex: '#ffffff' })
      : (w.cmyk ? { cmyk: [0, 0, 0, 85] } : { hex: '#262626' });
    const rond = (n) => Math.round(n * 1000) / 1000;
    const kinderen = r.stukjes.map((st) => {
      const kleur = alsKleur(st.kleur, w.cmyk);
      return {
        soort: 'pad',
        subpaden: [{ gesloten: true, punten: st.v.map(([x, y]) => ({ x: rond(x), y: rond(y) })) }],
        vulling: kleur,
        // zonder lijnen een haarlijntje in de eigen kleur, zodat er geen witte naden ontstaan
        lijn: w.lijnen === 'geen' ? kleur : lijnKleur,
        lijndikte: w.lijnen === 'geen' ? 0.25 : w.lijndikte,
        lijnhoek: 'round',
      };
    });
    const naam = `Mozaïek, ${kinderen.length} ${w.soort === 'driehoeken' ? 'driehoeken' : 'cellen'}`;

    maakKnop.disabled = true;
    try {
      await vexel.maak([{ soort: 'groep', naam, kinderen }], w.achteraan ? { achteraan: true } : undefined);
      const { cmyk, ...bewaren } = w;
      await vexel.bewaar('instellingen', bewaren);
      vexel.melding(`${naam} gemaakt.`, 'ok');
      vexel.sluit();
    } catch (fout) {
      maakKnop.disabled = false;
      vexel.melding(fout && fout.message ? fout.message : 'Het mozaïek kon niet worden gemaakt.', 'fout');
    }
  });

  teken();
  soort.focus();
}

vexel.opCommando('maken', toonVenster);
