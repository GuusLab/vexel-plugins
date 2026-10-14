// Bonnen en vouchers: cadeaubonnen, kortingsbonnen en stempelkaarten in vier stijlen,
// met een rechte, gekartelde of postzegelrand, een afscheurstrook met perforatie,
// doorlopende nummers en zoveel bonnen per vel als er passen, met snijruimte.
// Eigen werk, MIT-licentie (zie de README van deze repo).
'use strict';

const STANDAARD = {
  soort: 'cadeau', stijl: 'klassiek', rand: 'recht', formaat: 'bon', b: 150, h: 65,
  strook: true, aantal: 0, snijruimte: 6, nummer: 1, cijfers: 4, voorvoegsel: 'Nr. ', vakjes: 10, zaad: 7,
};
const TEKSTEN = {
  cadeau: { titel: 'Cadeaubon', waarde: '€ 25', tekst: 'Te besteden in onze winkel en webwinkel', geldig: '31 december 2027' },
  korting: { titel: 'Kortingsbon', waarde: '20% korting', tekst: 'op je volgende aankoop, niet geldig in combinatie met andere acties', geldig: '30 juni 2027' },
  stempel: { titel: 'Stempelkaart', waarde: 'De 10e koffie is gratis', tekst: 'Eén stempel per aankoop', geldig: '' },
};
const FORMATEN = {
  bon: { naam: 'Bon 150 × 65 mm', b: 150, h: 65 },
  dl: { naam: 'Strook 210 × 99 mm', b: 210, h: 99 },
  breed: { naam: 'Breed 170 × 80 mm', b: 170, h: 80 },
  a6: { naam: 'A6 148 × 105 mm', b: 148, h: 105 },
  kaart: { naam: 'Kaartje 85 × 55 mm', b: 85, h: 55 },
  eigen: { naam: 'Eigen maat' },
};

// Kleuren per stijl: [cmyk, hex]
const STIJLEN = {
  klassiek: {
    naam: 'Klassiek', hoek: 2, achter: [[0, 3, 12, 3], '#f7f0e1'], inkt: [[0, 85, 75, 45], '#7a1f1f'],
    accent: [[0, 30, 80, 25], '#b8862b'], zacht: [[0, 20, 30, 35], '#a68b72'], vlak: [[0, 8, 22, 8], '#ece0c8'],
  },
  modern: {
    naam: 'Modern', hoek: 0, achter: [[0, 0, 0, 0], '#ffffff'], inkt: [[0, 0, 0, 92], '#1f1f1f'],
    accent: [[0, 75, 85, 0], '#ff5a36'], zacht: [[0, 0, 0, 45], '#8c8c8c'], vlak: [[0, 75, 85, 0], '#ff5a36'], opVlak: [[0, 0, 0, 0], '#ffffff'],
  },
  speels: {
    naam: 'Speels', hoek: 5, achter: [[0, 4, 30, 0], '#fff4c7'], inkt: [[85, 65, 25, 25], '#23395b'],
    accent: [[0, 65, 20, 0], '#ff6f91'], zacht: [[45, 30, 15, 10], '#7f8fa8'], vlak: [[70, 0, 35, 0], '#2ec4b6'],
    confetti: [[[0, 65, 20, 0], '#ff6f91'], [[70, 0, 35, 0], '#2ec4b6'], [[0, 30, 90, 0], '#ffb627'], [[55, 40, 0, 0], '#6c8cff']],
  },
  elegant: {
    naam: 'Elegant', hoek: 1.5, achter: [[100, 80, 25, 45], '#14213d'], inkt: [[2, 5, 15, 0], '#f5ecd7'],
    accent: [[0, 25, 70, 20], '#c9a14a'], zacht: [[30, 20, 10, 20], '#9aa3b5'], vlak: [[100, 80, 25, 55], '#0f1a31'],
  },
};

// ---- willekeur met zaadje -------------------------------------------------------

function willekeur(zaad) {
  let s = (Math.imul((zaad | 0) ^ 0x3c6ef372, 0x9e3779b1) >>> 0) || 1;
  const volgende = () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
  for (let i = 0; i < 6; i++) volgende();
  return volgende;
}
const begrens = (n, min, max) => Math.min(max, Math.max(min, n));
const r3 = (n) => Math.round(n * 1000) / 1000;

// ---- tekstmaten (Inter, ongeveer) -----------------------------------------------

function breedteEm(tekst, gewicht = 400) {
  let n = 0;
  for (const t of tekst) {
    if ("iIjlft.,:;!|’'".includes(t)) n += 0.29;
    else if (t === ' ') n += 0.26;
    else if ('mwMW%'.includes(t)) n += 0.85;
    else if (t >= 'A' && t <= 'Z') n += 0.66;
    else if (t >= '0' && t <= '9') n += 0.6;
    else n += 0.55;
  }
  return n * (gewicht >= 700 ? 1.06 : gewicht >= 600 ? 1.03 : 1);
}
/** De grootste lettergrootte (≤ max) waarbij de tekst in `breed` pt past. */
const pasGrootte = (tekst, breed, max, gewicht, spatie = 0) =>
  Math.min(max, breed / Math.max(0.1, breedteEm(tekst, gewicht) + (spatie / 1000) * [...tekst].length));

// ---- randen ---------------------------------------------------------------------

const K = 0.5522847498;

/** Een rechthoek met afgeronde hoeken als subpad. */
function afgerond(x, y, b, h, r) {
  r = Math.min(r, b / 2, h / 2);
  if (r <= 0.01) return { gesloten: true, punten: [{ x, y }, { x: x + b, y }, { x: x + b, y: y + h }, { x, y: y + h }] };
  const k = r * K;
  const p = (px, py, ix, iy, ux, uy) => ({ x: r3(px), y: r3(py), in: { x: r3(ix), y: r3(iy) }, uit: { x: r3(ux), y: r3(uy) } });
  return {
    gesloten: true,
    punten: [
      p(x + r, y, x + r - k, y, x + r, y), p(x + b - r, y, x + b - r, y, x + b - r + k, y),
      p(x + b, y + r, x + b, y + r - k, x + b, y + r), p(x + b, y + h - r, x + b, y + h - r, x + b, y + h - r + k),
      p(x + b - r, y + h, x + b - r + k, y + h, x + b - r, y + h), p(x + r, y + h, x + r, y + h, x + r - k, y + h),
      p(x, y + h - r, x, y + h - r + k, x, y + h - r), p(x, y + r, x, y + r, x, y + r - k),
    ],
  };
}

/**
 * De omtrek van een bon met een gekartelde rand (kartelschaar) of een postzegelrand
 * (halve rondjes naar binnen). Met inkepingen op `inkeep` (x) boven en onder voor de strook.
 */
/** Een rechthoek met afgeronde hoeken en halve inkepingen boven en onder op x = inkeep. */
function rechtMetInkeep(x, y, b, h, r, inkeep) {
  r = Math.min(Math.max(0, r), b / 4, h / 4);
  const ri = vexel.mm(2.2);
  const k = r * K;
  const ki = ri * K;
  const p = (px, py, extra) => ({ x: r3(px), y: r3(py), ...(extra || {}) });
  const q = (px, py) => ({ x: r3(px), y: r3(py) });
  return {
    gesloten: true,
    punten: [
      p(x + r, y, { in: q(x + r - k, y) }),
      p(inkeep - ri, y, { uit: q(inkeep - ri, y + ki) }),
      p(inkeep, y + ri, { in: q(inkeep - ki, y + ri), uit: q(inkeep + ki, y + ri) }),
      p(inkeep + ri, y, { in: q(inkeep + ri, y + ki) }),
      p(x + b - r, y, { uit: q(x + b - r + k, y) }),
      p(x + b, y + r, { in: q(x + b, y + r - k) }),
      p(x + b, y + h - r, { uit: q(x + b, y + h - r + k) }),
      p(x + b - r, y + h, { in: q(x + b - r + k, y + h) }),
      p(inkeep + ri, y + h, { uit: q(inkeep + ri, y + h - ki) }),
      p(inkeep, y + h - ri, { in: q(inkeep + ki, y + h - ri), uit: q(inkeep - ki, y + h - ri) }),
      p(inkeep - ri, y + h, { in: q(inkeep - ri, y + h - ki) }),
      p(x + r, y + h, { uit: q(x + r - k, y + h) }),
      p(x, y + h - r, { in: q(x, y + h - r + k) }),
      p(x, y + r, { uit: q(x, y + r - k) }),
    ],
  };
}

function bonOmtrek(x, y, b, h, rand, hoek, inkeep) {
  if (rand === 'recht' && inkeep === null) return afgerond(x, y, b, h, hoek);
  if (rand === 'recht') return rechtMetInkeep(x, y, b, h, hoek, inkeep);
  const punten = [];
  const zet = (px, py, extra) => punten.push({ x: r3(px), y: r3(py), ...(extra || {}) });
  // halve cirkel (Bézier) van a naar b, naar binnen gericht (richting n)
  const hap = (ax, ay, bx, by, nx, ny) => {
    const mx = (ax + bx) / 2;
    const my = (ay + by) / 2;
    const r = Math.hypot(bx - ax, by - ay) / 2;
    const ux = (bx - ax) / (2 * r);
    const uy = (by - ay) / (2 * r);
    const tx = mx + nx * r;
    const ty = my + ny * r;
    const k = r * K;
    const vorige = punten[punten.length - 1];
    vorige.uit = { x: r3(ax + nx * k), y: r3(ay + ny * k) };
    zet(tx, ty, { in: { x: r3(tx - ux * k), y: r3(ty - uy * k) }, uit: { x: r3(tx + ux * k), y: r3(ty + uy * k) } });
    zet(bx, by, { in: { x: r3(bx + nx * k), y: r3(by + ny * k) } });
  };
  const zijde = (ax, ay, bx, by, nx, ny, metInkeep) => {
    const lengte = Math.hypot(bx - ax, by - ay);
    const ux = (bx - ax) / lengte;
    const uy = (by - ay) / lengte;
    if (rand === 'gekarteld') {
      const stap = vexel.mm(3.2);
      const n = Math.max(2, Math.round(lengte / stap));
      const d = lengte / n;
      const diep = vexel.mm(1.4);
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) * d;
        zet(ax + ux * t + nx * diep, ay + uy * t + ny * diep);
        zet(ax + ux * (i + 1) * d, ay + uy * (i + 1) * d);
      }
      return;
    }
    if (rand === 'postzegel') {
      const stap = vexel.mm(4);
      const n = Math.max(2, Math.round(lengte / stap));
      const d = lengte / n;
      const r = d * 0.3;
      for (let i = 0; i < n; i++) {
        const m = (i + 0.5) * d;
        zet(ax + ux * (m - r), ay + uy * (m - r));
        hap(ax + ux * (m - r), ay + uy * (m - r), ax + ux * (m + r), ay + uy * (m + r), nx, ny);
        zet(ax + ux * (i + 1) * d, ay + uy * (i + 1) * d);
      }
      return;
    }
    // recht, met een inkeping voor de afscheurstrook
    if (metInkeep !== null) {
      const r = vexel.mm(2.2);
      const t = metInkeep;
      zet(ax + ux * (t - r), ay + uy * (t - r));
      hap(ax + ux * (t - r), ay + uy * (t - r), ax + ux * (t + r), ay + uy * (t + r), nx, ny);
    }
    zet(bx, by);
  };
  zet(x, y);
  zijde(x, y, x + b, y, 0, 1, inkeep === null ? null : inkeep - x);
  zijde(x + b, y, x + b, y + h, -1, 0, null);
  zijde(x + b, y + h, x, y + h, 0, -1, inkeep === null ? null : x + b - inkeep);
  zijde(x, y + h, x, y, 1, 0, null);
  // dubbele punten (begin = eind) samenvoegen
  const eind = punten[punten.length - 1];
  if (Math.abs(eind.x - punten[0].x) < 0.01 && Math.abs(eind.y - punten[0].y) < 0.01) {
    punten[0].in = eind.in;
    punten.pop();
  }
  return { gesloten: true, punten };
}

function ster(cx, cy, r, punten = 5) {
  const pts = [];
  for (let i = 0; i < punten * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / punten;
    const rr = i % 2 ? r * 0.45 : r;
    pts.push({ x: r3(cx + rr * Math.cos(a)), y: r3(cy + rr * Math.sin(a)) });
  }
  return { gesloten: true, punten: pts };
}

// ---- een bon --------------------------------------------------------------------

function bonVormen(w, x, y, nr, kleur) {
  const st = STIJLEN[w.stijl];
  const k = (sleutel) => kleur(st[sleutel]);
  const B = vexel.mm(w.b);
  const H = vexel.mm(w.h);
  const strookB = w.strook ? Math.min(B * 0.27, vexel.mm(48)) : 0;
  const hoofdB = B - strookB;
  const inkeep = w.strook ? x + hoofdB : null;
  const hoek = vexel.mm(st.hoek);
  const p = Math.max(vexel.mm(4), H * 0.1);
  const kinderen = [];
  const nummer = w.voorvoegsel + String(nr).padStart(w.cijfers, '0');

  kinderen.push({ soort: 'pad', naam: 'Bon', subpaden: [bonOmtrek(x, y, B, H, w.rand, hoek, inkeep)], vulling: k('achter'), lijn: null });

  // versiering per stijl
  if (w.stijl === 'klassiek') {
    const i1 = vexel.mm(2.5);
    const i2 = vexel.mm(3.4);
    kinderen.push({ soort: 'pad', naam: 'Kader', vulling: null, lijn: k('accent'), lijndikte: 0.9, subpaden: [afgerond(x + i1, y + i1, hoofdB - 2 * i1, H - 2 * i1, 1)] });
    kinderen.push({ soort: 'pad', naam: 'Kader binnen', vulling: null, lijn: k('accent'), lijndikte: 0.35, subpaden: [afgerond(x + i2, y + i2, hoofdB - 2 * i2, H - 2 * i2, 0.6)] });
  } else if (w.stijl === 'modern') {
    kinderen.push({ soort: 'rechthoek', naam: 'Balk', x: r3(x), y: r3(y), b: r3(vexel.mm(3)), h: r3(H), vulling: k('accent'), lijn: null });
  } else if (w.stijl === 'elegant') {
    const i1 = vexel.mm(3);
    kinderen.push({ soort: 'pad', naam: 'Kader', vulling: null, lijn: k('accent'), lijndikte: 0.5, subpaden: [afgerond(x + i1, y + i1, hoofdB - 2 * i1, H - 2 * i1, 0)] });
    const hk = vexel.mm(5);
    const hoeken = [[x + i1, y + i1, 1, 1], [x + hoofdB - i1, y + i1, -1, 1], [x + hoofdB - i1, y + H - i1, -1, -1], [x + i1, y + H - i1, 1, -1]];
    kinderen.push({
      soort: 'pad', naam: 'Hoeken', vulling: null, lijn: k('accent'), lijndikte: 1.2,
      subpaden: hoeken.map(([hx, hy, sx, sy]) => ({ gesloten: false, punten: [{ x: r3(hx + sx * hk), y: r3(hy + sy * 1.6) }, { x: r3(hx + sx * 1.6), y: r3(hy + sy * 1.6) },
          { x: r3(hx + sx * 1.6), y: r3(hy + sy * hk) }] })),
    });
  } else if (w.stijl === 'speels') {
    const rnd = willekeur(w.zaad * 31 + nr);
    const stippen = [];
    // confetti alleen in een smalle band langs de rand, zodat de tekst vrij blijft
    const band = Math.max(vexel.mm(2.4), p * 0.55);
    const binnen = vexel.mm(1.6);
    const omtrek = 2 * (hoofdB + H);
    const n = Math.round(omtrek / vexel.mm(7));
    for (let i = 0; i < n; i++) {
      let t = ((i + rnd() * 0.8) / n) * omtrek;
      const diep = binnen + rnd() * (band - binnen);
      let cx;
      let cy;
      if (t < hoofdB) [cx, cy] = [x + t, y + diep];
      else if ((t -= hoofdB) < H) [cx, cy] = [x + hoofdB - diep, y + t];
      else if ((t -= H) < hoofdB) [cx, cy] = [x + hoofdB - t, y + H - diep];
      else [cx, cy] = [x + diep, y + H - (t - hoofdB)];
      cx = begrens(cx, x + binnen + vexel.mm(1), x + hoofdB - binnen - vexel.mm(1));
      cy = begrens(cy, y + binnen + vexel.mm(1), y + H - binnen - vexel.mm(1));
      const kl = kleur(st.confetti[i % st.confetti.length]);
      const r = vexel.mm(0.45 + rnd() * 0.5);
      if (rnd() < 0.45) stippen.push({ soort: 'ellips', cx: r3(cx), cy: r3(cy), rx: r3(r), ry: r3(r), vulling: kl, lijn: null });
      else {
        const a = rnd() * Math.PI;
        const l = vexel.mm(0.9);
        const dx = Math.cos(a) * l;
        const dy = Math.sin(a) * l;
        stippen.push({
          soort: 'pad', subpaden: [{ gesloten: false, punten: [{ x: r3(cx - dx), y: r3(cy - dy) }, { x: r3(cx + dx), y: r3(cy + dy) }] }],
          vulling: null, lijn: kl, lijndikte: r3(vexel.mm(0.6)), lijneinde: 'round',
        });
      }
    }
    kinderen.push({ soort: 'groep', naam: 'Confetti', kinderen: stippen });
  }

  // tekst in het hoofddeel
  const binnenX = x + p + (w.stijl === 'modern' ? vexel.mm(3) : 0);
  const binnenB = hoofdB - 2 * p - (w.stijl === 'modern' ? vexel.mm(3) : 0);
  const midden = w.stijl === 'elegant' || w.stijl === 'klassiek';
  const tx = midden ? x + hoofdB / 2 : binnenX;
  const uitl = midden ? 'midden' : 'links';
  const tekst = (naam, inhoud, ty, grootte, gewicht, kleurNaam, extra) => {
    if (!inhoud) return;
    kinderen.push({ soort: 'tekst', naam, inhoud, x: r3(tx), y: r3(ty), grootte: r3(grootte), gewicht, uitlijning: uitl, vulling: k(kleurNaam), ...(extra || {}) });
  };
  const kopSpatie = w.stijl === 'modern' ? 60 : 220;
  const kopG = Math.min(H * 0.085, pasGrootte(w.titel.toUpperCase(), binnenB * 0.8, 13, 600, kopSpatie));
  let ty = y + p + kopG;
  tekst('Titel', w.titel.toUpperCase(), ty, kopG, 600, 'accent', { letterafstand: kopSpatie });
  if (w.afzender && !midden) {
    const g = Math.min(kopG * 0.9, pasGrootte(w.afzender, binnenB * 0.45, 9, 600));
    kinderen.push({ soort: 'tekst', naam: 'Afzender', inhoud: w.afzender, x: r3(x + hoofdB - p), y: r3(ty), grootte: r3(g), gewicht: 600, uitlijning: 'rechts', vulling: k('inkt') });
  }

  if (w.soort === 'stempel') {
    // vakjes om af te stempelen, in één of twee rijen
    const n = w.vakjes;
    const rijen = n > 6 && (binnenB / n) < H * 0.22 ? 2 : 1;
    const perRij = Math.ceil(n / rijen);
    const bg = Math.min(H * 0.075, pasGrootte(w.waarde, binnenB, 12, 600));
    const g2 = w.tekst ? Math.min(bg * 0.8, pasGrootte(w.tekst, binnenB, 8.5, 400)) : 0;
    const heeftOnder = Boolean((w.afzender && midden) || w.geldig || !w.strook);
    const tekstBlok = bg * 1.45 + (w.tekst ? g2 * 1.7 : 0) + (heeftOnder ? Math.min(H * 0.055, 7.5) * 1.9 : 0);
    const beschikbaarH = Math.max(H * 0.2, y + H - p - (ty + kopG * 0.6) - tekstBlok);
    const d = Math.min(binnenB / perRij, beschikbaarH / rijen);
    const r = d * 0.4;
    const blokB = perRij * d;
    const startX = midden ? x + hoofdB / 2 - blokB / 2 : binnenX;
    const startY = ty + kopG * 0.6 + (beschikbaarH - rijen * d) / 2;
    const rondjes = [];
    for (let i = 0; i < n; i++) {
      const rij = Math.floor(i / perRij);
      const kol = i % perRij;
      const cx = startX + (kol + 0.5) * d;
      const cy = startY + (rij + 0.5) * d;
      const laatste = i === n - 1;
      rondjes.push({
        soort: 'ellips', naam: `Vakje ${i + 1}`, cx: r3(cx), cy: r3(cy), rx: r3(r), ry: r3(r),
        vulling: laatste ? k('accent') : null, lijn: laatste ? null : k('zacht'), lijndikte: 0.8, streep: laatste ? [] : [2.2, 1.6],
      });
      if (laatste) rondjes.push({ soort: 'pad', naam: 'Ster', subpaden: [ster(cx, cy, r * 0.55)], vulling: k('achter'), lijn: null });
      else {
        rondjes.push({
          soort: 'tekst', naam: 'Cijfer', inhoud: String(i + 1), x: r3(cx), y: r3(cy + r * 0.32), grootte: r3(r * 0.85), gewicht: 500, uitlijning: 'midden', vulling: k('zacht'),
        });
      }
    }
    kinderen.push({ soort: 'groep', naam: 'Stempelvakjes', kinderen: rondjes });
    ty = startY + rijen * d + H * 0.01;
    tekst('Beloning', w.waarde, ty + bg, bg, 600, 'inkt');
    if (w.tekst) tekst('Tekst', w.tekst, ty + bg + g2 * 1.6, g2, 400, 'zacht');
  } else {
    // de waarde groot, met de tekst eronder midden tussen de titel en de onderste regel
    const waardeG = Math.min(H * 0.34, pasGrootte(w.waarde, binnenB * (midden ? 0.9 : 0.8), 72, 800));
    const g = w.tekst ? Math.min(H * 0.065, pasGrootte(w.tekst, binnenB, 10, 400)) : 0;
    const blok = waardeG * 0.74 + (w.tekst ? g * 2 : 0);
    const boven = ty + kopG * 0.5;
    const beneden = y + H - p * 0.85 - Math.min(H * 0.055, 7.5) * 1.6;
    const blokY = boven + Math.max(0, (beneden - boven - blok) / 2);
    tekst('Waarde', w.waarde, blokY + waardeG * 0.74, waardeG, 800, 'inkt');
    if (w.tekst) tekst('Tekst', w.tekst, blokY + waardeG * 0.74 + g * 2, g, 400, 'inkt');
  }

  // onderste regel: afzender (bij midden), geldig tot en nummer
  const kleinG = Math.min(H * 0.055, 7.5);
  const onder = y + H - p * 0.85;
  const delen = [];
  if (w.afzender && midden) delen.push(w.afzender);
  if (w.geldig) delen.push(`Geldig t/m ${w.geldig}`);
  if (!w.strook) delen.push(nummer);
  if (delen.length) {
    const regel = delen.join('   ·   ');
    const g = Math.min(kleinG, pasGrootte(regel, binnenB, kleinG, 400, 40));
    tekst('Voorwaarden', regel, onder, g, 400, 'zacht', { letterafstand: 40 });
  }

  // de afscheurstrook
  if (w.strook) {
    const sx = x + hoofdB;
    const sp = vexel.mm(3.5);
    kinderen.push({
      soort: 'pad', naam: 'Perforatie', vulling: null, lijn: k('zacht'), lijndikte: 0.6, streep: [1.5, 2.2], lijneinde: 'round',
      subpaden: [{ gesloten: false, punten: [{ x: r3(sx), y: r3(y + vexel.mm(w.rand === 'recht' ? 2.4 : 1.6)) }, { x: r3(sx), y: r3(y + H - vexel.mm(w.rand === 'recht' ? 2.4 : 1.6)) }] }],
    });
    if (w.stijl !== 'klassiek' && w.stijl !== 'speels') {
      // bij een gekartelde of postzegelrand blijft de rand van de strook zichtbaar
      const ri = w.rand === 'recht' ? 0 : vexel.mm(w.rand === 'gekarteld' ? 1.6 : 1.4);
      kinderen.push({
        soort: 'rechthoek', naam: 'Strookvlak', x: r3(sx + vexel.mm(1.2)), y: r3(y + Math.max(ri, vexel.mm(w.stijl === 'elegant' ? 3 : 0))),
        b: r3(strookB - vexel.mm(w.stijl === 'elegant' ? 4.2 : 1.2) - ri), h: r3(H - 2 * Math.max(ri, vexel.mm(w.stijl === 'elegant' ? 3 : 0))),
        vulling: k('vlak'), lijn: null,
      });
    }
    const opStrook = w.stijl === 'modern' ? 'opVlak' : 'inkt';
    const scx = sx + strookB / 2;
    const sg = Math.min(H * 0.06, 7);
    const labelG = Math.min(sg, pasGrootte('BEWAARSTROOK', strookB - 2 * sp, sg, 600, 120));
    const strook = [
      { soort: 'tekst', naam: 'Kop', inhoud: 'BEWAARSTROOK', x: r3(scx), y: r3(y + p + labelG), grootte: r3(labelG), gewicht: 600, letterafstand: 120, uitlijning: 'midden',
          vulling: k(w.stijl === 'modern' ? 'opVlak' : 'accent') },
      { soort: 'tekst', naam: 'Nummer', inhoud: nummer, x: r3(scx), y: r3(y + p + labelG + H * 0.16), grootte: r3(Math.min(H * 0.11, pasGrootte(nummer, strookB - 2 * sp, 14, 700))),
          gewicht: 700, uitlijning: 'midden', vulling: k(opStrook) },
    ];
    // invulregels
    const velden = w.soort === 'stempel' ? ['Naam', 'Telefoon'] : ['Datum', 'Paraaf'];
    velden.forEach((v, i) => {
      const ly = y + H - p - (velden.length - 1 - i) * H * 0.17;
      strook.push({ soort: 'tekst', naam: v, inhoud: v, x: r3(sx + sp), y: r3(ly - 3), grootte: r3(sg * 0.85), vulling: k(w.stijl === 'modern' ? 'opVlak' : 'zacht') });
      strook.push({ soort: 'pad', naam: 'Invulregel', subpaden: [{ gesloten: false, punten: [{ x: r3(sx + sp), y: r3(ly) }, { x: r3(sx + strookB - sp), y: r3(ly) }] }], vulling: null,
          lijn: k(w.stijl === 'modern' ? 'opVlak' : 'zacht'), lijndikte: 0.4 });
    });
    kinderen.push({ soort: 'groep', naam: 'Strook', kinderen: strook });
  }
  return { soort: 'groep', naam: `${w.titel || 'Bon'} ${nummer}`.trim().slice(0, 100), kinderen };
}

// ---- het vel --------------------------------------------------------------------

function indeling(w, tg) {
  const B = vexel.mm(w.b);
  const H = vexel.mm(w.h);
  const gat = vexel.mm(w.snijruimte);
  // eerst met 8 mm marge; past er dan niets, dan tot aan de rand (een strook van 210 mm op A4)
  const passend = (marge, ruimte, maat) => Math.max(0, Math.floor((ruimte - 2 * marge + gat + 0.01) / (maat + gat)));
  const kol = passend(vexel.mm(8), tg.b, B) || passend(0, tg.b, B);
  const rij = passend(vexel.mm(8), tg.h, H) || passend(0, tg.h, H);
  const perVel = kol * rij;
  const aantal = w.aantal > 0 ? w.aantal : Math.max(1, perVel);
  return { B, H, gat, kol, rij, perVel, aantal, vellen: perVel ? Math.ceil(aantal / perVel) : 0 };
}

function alleVormen(w, tg, kleur) {
  const ind = indeling(w, tg);
  if (!ind.perVel) return { ind, vormen: [] };
  const blokB = ind.kol * ind.B + (ind.kol - 1) * ind.gat;
  const vullingRijen = Math.min(ind.rij, Math.ceil(Math.min(ind.aantal, ind.perVel) / ind.kol));
  const blokH = vullingRijen * ind.H + (vullingRijen - 1) * ind.gat;
  const x0 = (tg.b - blokB) / 2;
  const y0 = (tg.h - blokH) / 2;
  const vellen = [];
  for (let v = 0; v < ind.vellen; v++) {
    const bonnen = [];
    for (let i = 0; i < ind.perVel; i++) {
      const n = v * ind.perVel + i;
      if (n >= ind.aantal) break;
      const k = i % ind.kol;
      const r = Math.floor(i / ind.kol);
      const dx = v * (tg.b + vexel.mm(20));
      bonnen.push(bonVormen(w, x0 + dx + k * (ind.B + ind.gat), y0 + r * (ind.H + ind.gat), w.nummer + n, kleur));
    }
    vellen.push({ soort: 'groep', naam: ind.vellen > 1 ? `Bonnen, vel ${v + 1}` : 'Bonnen', kinderen: bonnen });
  }
  return { ind, vormen: vellen };
}

/** Hoeveel vormen en punten: [vormen, punten]. */
function telVormen(vormen) {
  let n = 0;
  let p = 0;
  const loop = (v) => {
    n++;
    if (v.subpaden) for (const sp of v.subpaden) p += sp.punten.length;
    (v.kinderen || []).forEach(loop);
  };
  vormen.forEach(loop);
  return [n, p];
}

/** Een Nederlandse melding als het te veel wordt voor één keer, anders null. */
function teVeel(n, p, aantal) {
  if (n <= 5000 && p <= 50000) return null;
  const maxAantal = Math.max(1, Math.floor(aantal * Math.min(5000 / n, 50000 / p)));
  return `Dat worden ${n > 5000 ? `${n} vormen (hooguit 5000)` : `${p} punten (hooguit 50 000)`} in één keer. `
    + `Maak er hooguit ${maxAantal} tegelijk${p > 50000 ? ', of kies een rechte rand' : ''}.`;
}

// ---- voorvertoning: de vormen op een canvas -----------------------------------------

function cssKleur(k) {
  if (!k) return null;
  if (k.hex) return k.hex;
  if (k.cmyk) {
    const [c, m, y, z] = k.cmyk.map((v) => v / 100);
    const f = (a) => Math.round(255 * (1 - a) * (1 - z));
    return `rgb(${f(c)},${f(m)},${f(y)})`;
  }
  return '#000';
}

function tekenVorm(g, v, s) {
  if (v.zichtbaar === false) return;
  if (v.soort === 'groep') {
    for (const k of v.kinderen) tekenVorm(g, k, s);
    return;
  }
  g.save();
  g.globalAlpha = v.dekking === undefined ? 1 : v.dekking;
  const vul = cssKleur(v.vulling);
  const lijn = cssKleur(v.lijn);
  if (v.soort === 'tekst') {
    g.font = `${v.gewicht || 400} ${v.grootte * s}px Inter, system-ui, sans-serif`;
    g.textAlign = v.uitlijning === 'midden' ? 'center' : v.uitlijning === 'rechts' ? 'right' : 'left';
    g.textBaseline = 'alphabetic';
    if ('letterSpacing' in g) g.letterSpacing = ((v.letterafstand || 0) / 1000) * v.grootte * s + 'px';
    g.fillStyle = vul || '#000';
    String(v.inhoud).split('\n').forEach((r, i) => g.fillText(r, v.x * s, (v.y + i * (v.regelafstand || v.grootte * 1.2)) * s));
    g.restore();
    return;
  }
  g.beginPath();
  if (v.soort === 'rechthoek') g.rect(v.x * s, v.y * s, v.b * s, v.h * s);
  else if (v.soort === 'ellips') g.ellipse(v.cx * s, v.cy * s, v.rx * s, v.ry * s, 0, 0, Math.PI * 2);
  else if (v.soort === 'pad') {
    for (const sp of v.subpaden) {
      const pts = sp.punten;
      g.moveTo(pts[0].x * s, pts[0].y * s);
      const n = pts.length;
      for (let i = 1; i <= (sp.gesloten ? n : n - 1); i++) {
        const a = pts[i - 1];
        const b = pts[i % n];
        const c1 = a.uit || a;
        const c2 = b.in || b;
        g.bezierCurveTo(c1.x * s, c1.y * s, c2.x * s, c2.y * s, b.x * s, b.y * s);
      }
      if (sp.gesloten) g.closePath();
    }
  }
  if (vul) {
    g.fillStyle = vul;
    g.fill(v.vulregel === 'evenodd' ? 'evenodd' : 'nonzero');
  }
  if (lijn && (v.lijndikte === undefined || v.lijndikte > 0)) {
    g.strokeStyle = lijn;
    g.lineWidth = Math.max(0.4, (v.lijndikte === undefined ? 1 : v.lijndikte) * s);
    g.lineCap = v.lijneinde || 'butt';
    g.setLineDash((v.streep || []).map((d) => d * s));
    g.stroke();
  }
  g.restore();
}

// ---- venster-hulpjes ----------------------------------------------------------------

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
const getalVeld = (waarde, min, max, stap) =>
  maak('input', { klasse: 'veld', type: 'number', min, max, step: stap, value: waarde, stijl: { width: '100%' } });
const tekstVeld = (waarde, max, plaats) =>
  maak('input', { klasse: 'veld', type: 'text', maxlength: max, value: waarde, placeholder: plaats || '', stijl: { width: '100%' } });
function keuzeVeld(opties, waarde) {
  const veld = maak('select', { klasse: 'veld', stijl: { width: '100%' } },
    ...opties.map(([w, t]) => maak('option', { value: w, tekst: t })));
  veld.value = opties.some(([w]) => String(w) === String(waarde)) ? String(waarde) : String(opties[0][0]);
  return veld;
}
const metLabel = (tekst, veld, eenheid) =>
  maak('label', { stijl: { display: 'grid', gap: '3px', minWidth: '0' } },
    maak('span', { klasse: 'label', tekst, stijl: { minWidth: '0' } }),
    eenheid
      ? maak('span', { stijl: { display: 'flex', alignItems: 'center', gap: '6px' } }, veld,
        maak('span', { klasse: 'uitleg', tekst: eenheid, stijl: { flex: 'none' } }))
      : veld);
const kolommenRij = (sjabloon, ...kinderen) =>
  maak('div', { stijl: { display: 'grid', gridTemplateColumns: sjabloon.replace(/([0-9.]+fr)/g, 'minmax(0, $1)'), gap: '8px 10px', alignItems: 'end' } },
    ...kinderen);
function vinkje(tekst, aan) {
  const vak = maak('input', { type: 'checkbox' });
  vak.checked = Boolean(aan);
  return { vak, el: maak('label', { stijl: { display: 'flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap', height: '26px' } }, vak, tekst) };
}
const getal = (n, c = 0) => n.toLocaleString('nl-NL', { maximumFractionDigits: c });

// ---- het venster --------------------------------------------------------------------

async function toonVenster() {
  const doc = await vexel.document();
  const cmyk = doc.kleurruimte === 'cmyk';
  const kleur = (paar) => (cmyk ? { cmyk: paar[0] } : { hex: paar[1] });
  const w0 = { ...STANDAARD, ...((await vexel.haal('instellingen')) || {}) };
  const teksten = { ...TEKSTEN[w0.soort] || TEKSTEN.cadeau };

  const soort = keuzeVeld([['cadeau', 'Cadeaubon'], ['korting', 'Kortingsbon'], ['stempel', 'Stempelkaart']], w0.soort);
  const stijl = keuzeVeld(Object.entries(STIJLEN).map(([k, v]) => [k, v.naam]), w0.stijl);
  const rand = keuzeVeld([['recht', 'Rechte rand'], ['gekarteld', 'Gekarteld'], ['postzegel', 'Postzegelrand']], w0.rand);
  const formaat = keuzeVeld(Object.entries(FORMATEN).map(([k, v]) => [k, v.naam]), w0.formaat);
  const breedte = getalVeld(w0.b, 40, 300, 1);
  const hoogte = getalVeld(w0.h, 30, 300, 1);
  const titel = tekstVeld(teksten.titel, 40);
  const waarde = tekstVeld(teksten.waarde, 60);
  const regel = tekstVeld(teksten.tekst, 120, 'Mag leeg');
  const afzender = tekstVeld('', 50, 'Naam van je zaak (mag leeg)');
  const geldig = tekstVeld(teksten.geldig, 40, 'Mag leeg');
  const vakjes = getalVeld(w0.vakjes, 3, 24, 1);
  const nummer = getalVeld(w0.nummer, 0, 999999, 1);
  const cijfers = getalVeld(w0.cijfers, 1, 6, 1);
  const voorvoegsel = tekstVeld(w0.voorvoegsel, 12);
  const strook = vinkje('Afscheurstrook', w0.strook);
  const aantal = getalVeld(w0.aantal || '', 1, 500, 1);
  aantal.placeholder = 'vel vol';
  const snijruimte = getalVeld(w0.snijruimte, 0, 30, 0.5);
  const zaad = getalVeld(w0.zaad, 1, 99999, 1);

  const waardeLabel = maak('span', { klasse: 'label', tekst: 'Waarde' });
  const waardeVak = maak('label', { stijl: { display: 'grid', gap: '3px', minWidth: '0' } }, waardeLabel, waarde);
  const vakjesVak = metLabel('Vakjes', vakjes);
  const zaadVak = metLabel('Confetti', zaad);

  const doek = maak('canvas', { 'aria-hidden': 'true', stijl: { width: '100%', height: '178px' } });
  const samenvatting = maak('p', { klasse: 'uitleg', 'aria-live': 'polite', stijl: { margin: '0', minHeight: '2.9em' } });
  const maakKnop = maak('button', { klasse: 'knop primair', type: 'submit', tekst: 'Bonnen maken' });
  const annuleer = maak('button', { klasse: 'knop', type: 'button', tekst: 'Annuleren', bijClick: () => vexel.sluit() });

  const formulier = maak('form', { stijl: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '8px', padding: '12px 14px 14px' } },
    doek,
    kolommenRij('1fr 1fr 1fr', metLabel('Soort', soort), metLabel('Stijl', stijl), metLabel('Rand', rand)),
    kolommenRij('1.6fr 0.7fr 0.7fr', metLabel('Formaat', formaat), metLabel('Breedte', breedte, 'mm'), metLabel('Hoogte', hoogte, 'mm')),
    kolommenRij('1fr 1.4fr 0.5fr', metLabel('Titel', titel), waardeVak, vakjesVak),
    kolommenRij('1fr', metLabel('Tekst', regel)),
    kolommenRij('1.4fr 1fr', metLabel('Afzender', afzender), metLabel('Geldig t/m', geldig)),
    kolommenRij('0.9fr 0.7fr 0.6fr 1fr', metLabel('Voorvoegsel', voorvoegsel), metLabel('Eerste nr.', nummer), metLabel('Cijfers', cijfers), strook.el),
    kolommenRij('1fr 1fr 1fr', metLabel('Aantal', aantal), metLabel('Snijruimte', snijruimte, 'mm'), zaadVak),
    samenvatting,
    maak('div', { klasse: 'knoppen', stijl: { marginTop: '0' } }, annuleer, maakKnop),
  );
  document.head.append(maak('style', { tekst: '.veld:disabled{opacity:.45}.knop{white-space:nowrap}.verborgen{visibility:hidden}' }));
  document.body.style.padding = '0';
  document.body.append(formulier);

  const waarden = () => {
    const f = FORMATEN[formaat.value] || FORMATEN.bon;
    const eigen = formaat.value === 'eigen';
    return {
      soort: soort.value, stijl: stijl.value, rand: rand.value, formaat: formaat.value,
      b: eigen ? begrens(leesGetal(breedte, 170), 40, 300) : f.b,
      h: eigen ? begrens(leesGetal(hoogte, 80), 30, 300) : f.h,
      titel: titel.value.trim(), waarde: waarde.value.trim(), tekst: regel.value.trim(), afzender: afzender.value.trim(), geldig: geldig.value.trim(),
      vakjes: Math.round(begrens(leesGetal(vakjes, 10), 3, 24)),
      nummer: Math.round(begrens(leesGetal(nummer, 1), 0, 999999)),
      cijfers: Math.round(begrens(leesGetal(cijfers, 4), 1, 6)),
      voorvoegsel: voorvoegsel.value,
      strook: strook.vak.checked,
      aantal: Math.round(begrens(leesGetal(aantal, 0), 0, 500)),
      snijruimte: begrens(leesGetal(snijruimte, 6), 0, 30),
      zaad: Math.round(begrens(leesGetal(zaad, 7), 1, 99999)),
    };
  };

  // andere soort: standaardteksten wisselen (alleen als ze nog niet zijn aangepast)
  let vorigeSoort = soort.value;
  soort.addEventListener('change', () => {
    const oud = TEKSTEN[vorigeSoort];
    const nieuw = TEKSTEN[soort.value];
    for (const [veld, sleutel] of [[titel, 'titel'], [waarde, 'waarde'], [regel, 'tekst'], [geldig, 'geldig']]) {
      if (veld.value.trim() === oud[sleutel] || !veld.value.trim()) veld.value = nieuw[sleutel];
    }
    vorigeSoort = soort.value;
  });
  formaat.addEventListener('change', () => {
    const f = FORMATEN[formaat.value];
    if (f && f.b) {
      breedte.value = String(f.b);
      hoogte.value = String(f.h);
    }
  });
  if (FORMATEN[w0.formaat] && FORMATEN[w0.formaat].b) {
    breedte.value = String(FORMATEN[w0.formaat].b);
    hoogte.value = String(FORMATEN[w0.formaat].h);
  }

  let gepland = false;
  function teken() {
    gepland = false;
    const w = waarden();
    breedte.disabled = w.formaat !== 'eigen';
    hoogte.disabled = w.formaat !== 'eigen';
    waardeLabel.textContent = w.soort === 'stempel' ? 'Beloning' : w.soort === 'korting' ? 'Korting' : 'Waarde';
    vakjesVak.classList.toggle('verborgen', w.soort !== 'stempel');
    zaadVak.classList.toggle('verborgen', w.stijl !== 'speels');
    const schaal = devicePixelRatio || 1;
    const vak = doek.getBoundingClientRect();
    doek.width = Math.round(vak.width * schaal);
    doek.height = Math.round(vak.height * schaal);
    const g = doek.getContext('2d');
    g.setTransform(schaal, 0, 0, schaal, 0, 0);
    g.clearRect(0, 0, vak.width, vak.height);
    const ind = indeling(w, doc.tekengebied);
    // één bon groot, en rechts een miniatuur van het vel
    const velB = 70;
    const velH = velB * (doc.tekengebied.h / doc.tekengebied.b);
    const ruimteB = vak.width - velB - 30;
    const B = vexel.mm(w.b);
    const H = vexel.mm(w.h);
    const s = Math.min((ruimteB - 10) / B, (vak.height - 16) / H);
    g.save();
    g.translate(10 + (ruimteB - 10 - B * s) / 2, (vak.height - H * s) / 2);
    g.shadowColor = 'rgba(0,0,0,0.35)';
    g.shadowBlur = 10;
    g.shadowOffsetY = 3;
    const bon = bonVormen(w, 0, 0, w.nummer, kleur);
    tekenVorm(g, bon.kinderen[0], s);
    g.shadowColor = 'transparent';
    for (const k of bon.kinderen.slice(1)) tekenVorm(g, k, s);
    g.restore();
    // miniatuur
    const vx = vak.width - velB - 8;
    const vy = (vak.height - velH) / 2;
    g.fillStyle = '#ffffff';
    g.fillRect(vx, vy, velB, velH);
    const vs = velB / doc.tekengebied.b;
    if (ind.perVel) {
      const blokB = ind.kol * ind.B + (ind.kol - 1) * ind.gat;
      const rijen = Math.min(ind.rij, Math.ceil(Math.min(ind.aantal, ind.perVel) / ind.kol));
      const blokH = rijen * ind.H + (rijen - 1) * ind.gat;
      const x0 = (doc.tekengebied.b - blokB) / 2;
      const y0 = (doc.tekengebied.h - blokH) / 2;
      g.fillStyle = cssKleur(kleur(w.stijl === 'modern' || w.stijl === 'klassiek' ? STIJLEN[w.stijl].accent : STIJLEN[w.stijl].achter));
      for (let i = 0; i < Math.min(ind.aantal, ind.perVel); i++) {
        const k = i % ind.kol;
        const r = Math.floor(i / ind.kol);
        g.fillRect(vx + (x0 + k * (ind.B + ind.gat)) * vs, vy + (y0 + r * (ind.H + ind.gat)) * vs, ind.B * vs, ind.H * vs);
      }
    }
    g.strokeStyle = vexel.thema.lijn || '#34363e';
    g.strokeRect(vx + 0.5, vy + 0.5, velB - 1, velH - 1);

    let tekst;
    let fout = false;
    if (doc.alleenLezen) {
      tekst = 'Dit document is alleen-lezen; je kunt hier niets aan toevoegen.';
      fout = true;
    } else if (!ind.perVel) {
      tekst = `Een bon van ${getal(w.b)} × ${getal(w.h)} mm past niet op het tekengebied. Kies een kleiner formaat of draai het tekengebied.`;
      fout = true;
    } else if (teVeel(...telVormen([bon]).map((x) => x * ind.aantal), ind.aantal)) {
      tekst = teVeel(...telVormen([bon]).map((x) => x * ind.aantal), ind.aantal);
      fout = true;
    } else if (!w.titel && !w.waarde) {
      tekst = 'Vul een titel of waarde in.';
      fout = true;
    } else {
      const n = ind.aantal;
      const namen = { stempel: ['stempelkaart', 'stempelkaarten'], korting: ['kortingsbon', 'kortingsbonnen'], cadeau: ['cadeaubon', 'cadeaubonnen'] };
      tekst = `${n} ${namen[w.soort][n === 1 ? 0 : 1]} van ${getal(w.b)} × ${getal(w.h)} mm`;
      tekst += ind.vellen > 1 ? ` op ${ind.vellen} vellen (${ind.perVel} per vel, ${ind.kol} × ${ind.rij})` : `, ${Math.min(n, ind.perVel)} op het vel (${ind.kol} × ${ind.rij} past)`;
      tekst += `, nummers ${w.voorvoegsel}${String(w.nummer).padStart(w.cijfers, '0')} t/m ${String(w.nummer + n - 1).padStart(w.cijfers, '0')}.`;
      if (w.snijruimte < 3 && w.rand !== 'recht') tekst += ' Tip: geef een gekartelde rand minstens 3 mm snijruimte.';
      if (ind.vellen > 1) tekst += ' De volgende vellen komen rechts naast het tekengebied.';
    }
    samenvatting.textContent = tekst;
    samenvatting.classList.toggle('fout', fout);
    maakKnop.disabled = fout;
  }
  const plan = () => {
    if (!gepland) {
      gepland = true;
      requestAnimationFrame(teken);
    }
  };

  formulier.addEventListener('input', plan);
  formulier.addEventListener('change', plan);
  formulier.addEventListener('submit', async (gebeurtenis) => {
    gebeurtenis.preventDefault();
    if (maakKnop.disabled) return;
    const w = waarden();
    const { ind, vormen } = alleVormen(w, doc.tekengebied, kleur);
    const probleem = teVeel(...telVormen(vormen), ind.aantal);
    if (probleem) {
      vexel.melding(probleem, 'let');
      return;
    }
    maakKnop.disabled = true;
    try {
      await vexel.maak(vormen);
      const bewaren = { ...w };
      for (const k of ['titel', 'waarde', 'tekst', 'afzender', 'geldig']) delete bewaren[k];
      bewaren.nummer = w.nummer + ind.aantal;
      await vexel.bewaar('instellingen', bewaren);
      vexel.melding(`${ind.aantal} ${ind.aantal === 1 ? 'bon' : 'bonnen'} gemaakt${ind.vellen > 1 ? ` op ${ind.vellen} vellen` : ''}. Volgende keer begint de nummering bij ${bewaren.nummer}.`, 'ok');
      vexel.sluit();
    } catch (fout) {
      maakKnop.disabled = false;
      vexel.melding(fout && fout.message ? fout.message : 'De bonnen konden niet worden gemaakt.', 'fout');
    }
  });

  teken();
  titel.focus();
}

vexel.opCommando('maken', toonVenster);
