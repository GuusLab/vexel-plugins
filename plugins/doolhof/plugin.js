// Doolhof: een rechthoekig of rond doolhof, met de wanden samengevoegd tot een paar
// lange paden en desgewenst de oplossing als aparte groep.
// Eigen werk, MIT-licentie (zie de README van deze repo).
'use strict';

const STANDAARD = {
  vorm: 'recht', algoritme: 'gangen', kolommen: 20, rijen: 20, ringen: 10, celmaat: 8,
  wand: 1.5, kleur: 'zwart', openingen: 'hoeken', oplossing: 'groep', doel: true, zaad: 1,
};

const ALGORITMEN = {
  gangen: 'Lange gangen',
  zijpaden: 'Veel zijpaden',
  evenwichtig: 'Evenwichtig',
};

const KLEUREN = {
  zwart: { naam: 'Zwart', cmyk: [0, 0, 0, 100], hex: '#1a1a1a' },
  blauw: { naam: 'Donkerblauw', cmyk: [100, 75, 0, 35], hex: '#1d3557' },
  groen: { naam: 'Donkergroen', cmyk: [85, 20, 75, 35], hex: '#1f5c45' },
  paars: { naam: 'Paars', cmyk: [65, 90, 0, 10], hex: '#5b2a86' },
};
const OPLOSKLEUR = { cmyk: [0, 90, 85, 0], hex: '#e2402f' };

const MAX_SUBPADEN = 1000;
const MAX_PUNTEN = 48000;

// ---- willekeur met zaadje -----------------------------------------------------

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

const begrens = (n, min, max) => Math.min(max, Math.max(min, n));

// ---- doolhof als graaf --------------------------------------------------------
// Elke cel is een knoop; buren[i] zijn de cellen naast i. Een algoritme kiest een
// opspannende boom: de gangen. Wat geen gang is, wordt een wand.

/** Recursieve backtracker, met een eigen stapel: lange, kronkelende gangen. */
function backtracker(buren, rnd, start) {
  const n = buren.length;
  const bezocht = new Uint8Array(n);
  const gangen = buren.map(() => []);
  const stapel = [start];
  bezocht[start] = 1;
  while (stapel.length) {
    const cel = stapel[stapel.length - 1];
    const vrij = buren[cel].filter((b) => !bezocht[b]);
    if (!vrij.length) {
      stapel.pop();
      continue;
    }
    const b = vrij[Math.floor(rnd() * vrij.length)];
    gangen[cel].push(b);
    gangen[b].push(cel);
    bezocht[b] = 1;
    stapel.push(b);
  }
  return gangen;
}

/** Prim met willekeurige randen: veel korte zijpaden en doodlopende stukjes. */
function prim(buren, rnd, start) {
  const n = buren.length;
  const bezocht = new Uint8Array(n);
  const gangen = buren.map(() => []);
  const rand = [];
  const voegToe = (cel) => {
    bezocht[cel] = 1;
    for (const b of buren[cel]) if (!bezocht[b]) rand.push(cel, b);
  };
  voegToe(start);
  while (rand.length) {
    const k = Math.floor(rnd() * (rand.length / 2)) * 2;
    const a = rand[k];
    const b = rand[k + 1];
    rand[k] = rand[rand.length - 2];
    rand[k + 1] = rand[rand.length - 1];
    rand.length -= 2;
    if (bezocht[b]) continue;
    gangen[a].push(b);
    gangen[b].push(a);
    voegToe(b);
  }
  return gangen;
}

/** Wilson: willekeurige wandelingen zonder lussen; elk doolhof is even waarschijnlijk. */
function wilson(buren, rnd, start) {
  const n = buren.length;
  const inBoom = new Uint8Array(n);
  const volgende = new Int32Array(n).fill(-1);
  const gangen = buren.map(() => []);
  inBoom[start] = 1;
  const volgorde = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [volgorde[i], volgorde[j]] = [volgorde[j], volgorde[i]];
  }
  for (const begin of volgorde) {
    if (inBoom[begin]) continue;
    // wandel tot je de boom raakt; een lus wist zichzelf door 'volgende' te overschrijven
    let cel = begin;
    while (!inBoom[cel]) {
      const b = buren[cel];
      volgende[cel] = b[Math.floor(rnd() * b.length)];
      cel = volgende[cel];
    }
    cel = begin;
    while (!inBoom[cel]) {
      inBoom[cel] = 1;
      gangen[cel].push(volgende[cel]);
      gangen[volgende[cel]].push(cel);
      cel = volgende[cel];
    }
  }
  return gangen;
}

function maakGangen(algoritme, buren, rnd, start) {
  if (algoritme === 'zijpaden') return prim(buren, rnd, start);
  if (algoritme === 'evenwichtig') return wilson(buren, rnd, start);
  return backtracker(buren, rnd, start);
}

/** De weg van a naar b door de gangen (breedte eerst). */
function zoekWeg(gangen, a, b) {
  const vorige = new Int32Array(gangen.length).fill(-1);
  vorige[a] = a;
  const rij = [a];
  for (let k = 0; k < rij.length; k++) {
    const cel = rij[k];
    if (cel === b) break;
    for (const x of gangen[cel]) {
      if (vorige[x] < 0) {
        vorige[x] = cel;
        rij.push(x);
      }
    }
  }
  const weg = [b];
  while (weg[weg.length - 1] !== a) weg.push(vorige[weg[weg.length - 1]]);
  return weg.reverse();
}

const heeftGang = (gangen, a, b) => gangen[a].includes(b);

// ---- wanden aan elkaar rijgen -------------------------------------------------
// Een wand is een rand tussen twee roosterpunten: recht, of een boog op een ring.
// We lopen zo lang mogelijk door, bij een kruising bij voorkeur rechtdoor.

/**
 * knopen: [{ x, y }], randen: [{ a, b, boog?: { r, ha, hb } }] (hoeken in radialen
 * rond (cx, cy)). Geeft ketens: lijsten van { rand, van } in looprichting.
 */
function rijg(knopen, randen) {
  const bij = knopen.map(() => []);
  randen.forEach((r, i) => {
    bij[r.a].push(i);
    bij[r.b].push(i);
  });
  const gebruikt = new Uint8Array(randen.length);
  const vrijeGraad = (k) => bij[k].reduce((n, i) => n + (gebruikt[i] ? 0 : 1), 0);

  const richting = (i, van, aankomst) => {
    const r = randen[i];
    const naar = r.a === van ? r.b : r.a;
    if (!r.boog) {
      const dx = knopen[naar].x - knopen[van].x;
      const dy = knopen[naar].y - knopen[van].y;
      const l = Math.hypot(dx, dy) || 1;
      return [dx / l, dy / l];
    }
    // raaklijn aan de boog, in de looprichting
    const hVan = r.a === van ? r.boog.ha : r.boog.hb;
    const hNaar = r.a === van ? r.boog.hb : r.boog.ha;
    const teken = Math.sign(hNaar - hVan) || 1;
    const h = aankomst ? hNaar : hVan;
    return [-Math.sin(h) * teken, Math.cos(h) * teken];
  };

  const ketens = [];
  const loop = (start) => {
    const keten = [];
    let knoop = start;
    let vorigeRichting = null;
    for (;;) {
      let beste = -1;
      let besteScore = -Infinity;
      for (const i of bij[knoop]) {
        if (gebruikt[i]) continue;
        const d = richting(i, knoop, false);
        const score = vorigeRichting ? d[0] * vorigeRichting[0] + d[1] * vorigeRichting[1] : 0;
        if (score > besteScore + 1e-9) {
          besteScore = score;
          beste = i;
        }
      }
      if (beste < 0) break;
      gebruikt[beste] = 1;
      keten.push({ rand: beste, van: knoop });
      vorigeRichting = richting(beste, knoop, true);
      knoop = randen[beste].a === knoop ? randen[beste].b : randen[beste].a;
    }
    if (keten.length) ketens.push(keten);
  };
  // eerst vanaf losse uiteinden en kruisingen met een oneven aantal wanden
  for (let k = 0; k < knopen.length; k++) while (vrijeGraad(k) % 2 === 1) loop(k);
  for (let k = 0; k < knopen.length; k++) while (vrijeGraad(k) > 0) loop(k);
  return ketens;
}

const r3 = (n) => Math.round(n * 1000) / 1000;

/** Voegt een boog toe aan een puntenlijst (het beginpunt staat er al in). */
function boogNaar(punten, cx, cy, r, h1, h2) {
  const stukken = Math.max(1, Math.ceil(Math.abs(h2 - h1) / (Math.PI / 2) - 1e-9));
  for (let s = 0; s < stukken; s++) {
    const a = h1 + ((h2 - h1) * s) / stukken;
    const b = h1 + ((h2 - h1) * (s + 1)) / stukken;
    const k = (4 / 3) * Math.tan((b - a) / 4) * r;
    const vorige = punten[punten.length - 1];
    vorige.uit = { x: r3(cx + r * Math.cos(a) - k * Math.sin(a)), y: r3(cy + r * Math.sin(a) + k * Math.cos(a)) };
    punten.push({
      x: r3(cx + r * Math.cos(b)),
      y: r3(cy + r * Math.sin(b)),
      in: { x: r3(cx + r * Math.cos(b) + k * Math.sin(b)), y: r3(cy + r * Math.sin(b) - k * Math.cos(b)) },
    });
  }
}

/** Zet ketens om naar subpaden; rechte stukken op één lijn worden één stuk. */
function ketensNaarSubpaden(ketens, knopen, randen, cx, cy) {
  return ketens.map((keten) => {
    const eerste = keten[0].van;
    const punten = [{ x: r3(knopen[eerste].x), y: r3(knopen[eerste].y) }];
    let k = 0;
    while (k < keten.length) {
      const { rand, van } = keten[k];
      const r = randen[rand];
      const naar = r.a === van ? r.b : r.a;
      if (r.boog) {
        // opeenvolgende bogen op dezelfde ring in dezelfde richting worden één boog
        let h1 = r.a === van ? r.boog.ha : r.boog.hb;
        let h2 = r.a === van ? r.boog.hb : r.boog.ha;
        const zin = Math.sign(h2 - h1);
        let m = k + 1;
        while (m < keten.length) {
          const q = randen[keten[m].rand];
          if (!q.boog || q.boog.r !== r.boog.r) break;
          const q1 = q.a === keten[m].van ? q.boog.ha : q.boog.hb;
          const q2 = q.a === keten[m].van ? q.boog.hb : q.boog.ha;
          if (Math.sign(q2 - q1) !== zin) break;
          h2 += q2 - q1;
          m++;
        }
        boogNaar(punten, cx, cy, r.boog.r, h1, h2);
        k = m;
      } else {
        const p = { x: r3(knopen[naar].x), y: r3(knopen[naar].y) };
        const n = punten.length;
        // een recht punt midden op een rechte lijn is overbodig
        if (n >= 2 && !punten[n - 1].in && !punten[n - 1].uit && !punten[n - 2].uit) {
          const a = punten[n - 2];
          const b = punten[n - 1];
          if (Math.abs((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) < 1e-6) punten.pop();
        }
        punten.push(p);
        k++;
      }
    }
    const laatste = punten[punten.length - 1];
    const dicht = punten.length > 2 && Math.abs(laatste.x - punten[0].x) < 1e-6 && Math.abs(laatste.y - punten[0].y) < 1e-6;
    if (dicht) {
      punten.pop();
      if (laatste.in) punten[0].in = laatste.in;
    }
    return { gesloten: dicht, punten };
  });
}

// ---- rechthoekig doolhof ------------------------------------------------------

function rechthoekig(w, rnd, c) {
  const C = w.kolommen;
  const R = w.rijen;
  const id = (r, k) => r * C + k;
  const buren = [];
  for (let r = 0; r < R; r++) {
    for (let k = 0; k < C; k++) {
      const b = [];
      if (r > 0) b.push(id(r - 1, k));
      if (k > 0) b.push(id(r, k - 1));
      if (k < C - 1) b.push(id(r, k + 1));
      if (r < R - 1) b.push(id(r + 1, k));
      buren.push(b);
    }
  }
  // openingen
  let inKant;
  let uitKant;
  let inCel;
  let uitCel;
  if (w.openingen === 'midden') {
    inCel = id(0, Math.floor(C / 2)); uitCel = id(R - 1, Math.floor(C / 2)); inKant = 'boven'; uitKant = 'onder';
  } else if (w.openingen === 'zijkanten') {
    inCel = id(0, 0); uitCel = id(R - 1, C - 1); inKant = 'links'; uitKant = 'rechts';
  } else {
    inCel = id(0, 0); uitCel = id(R - 1, C - 1); inKant = 'boven'; uitKant = 'onder';
  }
  const gangen = maakGangen(w.algoritme, buren, rnd, inCel);

  const knopen = [];
  for (let j = 0; j <= R; j++) for (let i = 0; i <= C; i++) knopen.push({ x: i * c, y: j * c });
  const kn = (i, j) => j * (C + 1) + i;
  const randen = [];
  const isOpening = (kant, r, k) => (kant === inKant && (r * C + k) === inCel) || (kant === uitKant && (r * C + k) === uitCel);
  // liggende wanden
  for (let j = 0; j <= R; j++) {
    for (let k = 0; k < C; k++) {
      const muur = j === 0 ? !isOpening('boven', 0, k)
        : j === R ? !isOpening('onder', R - 1, k)
          : !heeftGang(gangen, id(j - 1, k), id(j, k));
      if (muur) randen.push({ a: kn(k, j), b: kn(k + 1, j) });
    }
  }
  // staande wanden
  for (let i = 0; i <= C; i++) {
    for (let r = 0; r < R; r++) {
      const muur = i === 0 ? !isOpening('links', r, 0)
        : i === C ? !isOpening('rechts', r, C - 1)
          : !heeftGang(gangen, id(r, i - 1), id(r, i));
      if (muur) randen.push({ a: kn(i, r), b: kn(i, r + 1) });
    }
  }
  const subpaden = ketensNaarSubpaden(rijg(knopen, randen), knopen, randen, 0, 0);

  // de oplossing: door de middens van de cellen, met een stukje naar buiten
  const weg = zoekWeg(gangen, inCel, uitCel);
  const midden = (cel) => ({ x: ((cel % C) + 0.5) * c, y: (Math.floor(cel / C) + 0.5) * c });
  const buiten = (kant, cel) => {
    const m = midden(cel);
    if (kant === 'boven') return { x: m.x, y: -c * 0.5 };
    if (kant === 'onder') return { x: m.x, y: R * c + c * 0.5 };
    if (kant === 'links') return { x: -c * 0.5, y: m.y };
    return { x: C * c + c * 0.5, y: m.y };
  };
  const ruw = [buiten(inKant, inCel), ...weg.map(midden), buiten(uitKant, uitCel)];
  const oplossing = [];
  for (const p of ruw) {
    const n = oplossing.length;
    if (n >= 2) {
      const a = oplossing[n - 2];
      const b = oplossing[n - 1];
      if (Math.abs((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) < 1e-6) oplossing.pop();
    }
    oplossing.push({ x: r3(p.x), y: r3(p.y) });
  }
  return {
    b: C * c, h: R * c, subpaden, cellen: C * R, stappen: weg.length,
    oplossing: [{ gesloten: false, punten: oplossing }], doel: null,
  };
}

// ---- rond doolhof -------------------------------------------------------------

function rond(w, rnd, c) {
  const R = w.ringen; // ringen rond het midden; ring 0 is het midden zelf
  const n = [1, 6];
  for (let r = 2; r <= R; r++) {
    const breedte = (2 * Math.PI * (r + 0.5) * c) / n[r - 1];
    n.push(breedte > 1.9 * c ? n[r - 1] * 2 : n[r - 1]);
  }
  const begin = [0];
  for (let r = 1; r <= R; r++) begin.push(begin[r - 1] + n[r - 1]);
  const totaal = begin[R] + n[R];
  const id = (r, i) => begin[r] + (((i % n[r]) + n[r]) % n[r]);
  const ouder = (r, i) => (r === 1 ? 0 : id(r - 1, Math.floor((i * n[r - 1]) / n[r])));
  const buren = Array.from({ length: totaal }, () => []);
  for (let r = 1; r <= R; r++) {
    for (let i = 0; i < n[r]; i++) {
      const cel = id(r, i);
      buren[cel].push(id(r, i + 1), id(r, i - 1));
      const o = ouder(r, i);
      buren[cel].push(o);
      buren[o].push(cel);
    }
  }
  const draai = -Math.PI / 2 - Math.PI / n[R]; // de ingang (cel 0 van de buitenste ring) recht boven
  const hoek = (r, i) => draai + (2 * Math.PI * i) / n[r];
  const inCel = id(R, 0);
  const gangen = maakGangen(w.algoritme, buren, rnd, inCel);

  // roosterpunten op straal k·c; buiten de laatste ring dezelfde verdeling als ring R
  const verdeling = (k) => n[Math.min(k, R)];
  const kBegin = [0, 0];
  for (let k = 1; k <= R + 1; k++) kBegin[k + 1] = kBegin[k] + verdeling(k);
  const knopen = [];
  for (let k = 1; k <= R + 1; k++) {
    for (let j = 0; j < verdeling(k); j++) {
      const h = draai + (2 * Math.PI * j) / verdeling(k);
      knopen.push({ x: k * c * Math.cos(h), y: k * c * Math.sin(h) });
    }
  }
  const kn = (k, j) => kBegin[k] + (((j % verdeling(k)) + verdeling(k)) % verdeling(k));
  const randen = [];
  const boog = (k, j) => {
    const m = verdeling(k);
    randen.push({
      a: kn(k, j), b: kn(k, j + 1),
      boog: { r: k * c, ha: draai + (2 * Math.PI * j) / m, hb: draai + (2 * Math.PI * (j + 1)) / m },
    });
  };
  for (let k = 1; k <= R; k++) {
    // de boog tussen ring k-1 en ring k, per cel van ring k
    for (let i = 0; i < n[k]; i++) if (!heeftGang(gangen, id(k, i), ouder(k, i))) boog(k, i);
    // de spaken in ring k
    for (let i = 0; i < n[k]; i++) {
      if (heeftGang(gangen, id(k, i), id(k, i - 1))) continue;
      const verder = (i * verdeling(k + 1)) / n[k];
      randen.push({ a: kn(k, i), b: kn(k + 1, verder) });
    }
  }
  for (let i = 1; i < n[R]; i++) boog(R + 1, i); // buitenrand, met de ingang open
  const subpaden = ketensNaarSubpaden(rijg(knopen, randen), knopen, randen, 0, 0);

  // de oplossing in poolcoördinaten: bogen langs een ring, rechte stukken naar binnen
  const weg = zoekWeg(gangen, inCel, 0);
  const ringVan = (cel) => {
    for (let r = R; r >= 0; r--) if (cel >= begin[r]) return r;
    return 0;
  };
  const middenHoek = (cel) => {
    const r = ringVan(cel);
    return hoek(r, cel - begin[r] + 0.5);
  };
  const punten = [];
  const naarPunt = (rho, h) => punten.push({ x: r3(rho * Math.cos(h)), y: r3(rho * Math.sin(h)) });
  let rho = (R + 1.5) * c;
  let h = middenHoek(inCel);
  naarPunt(rho, h);
  const boogTot = (nieuw) => {
    let d = nieuw - h;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    if (Math.abs(d) > 1e-9) boogNaar(punten, 0, 0, rho, h, h + d);
    h = nieuw;
  };
  const rechtTot = (nieuwRho) => {
    rho = nieuwRho;
    naarPunt(rho, h);
  };
  rechtTot((R + 0.5) * c);
  for (let s = 1; s < weg.length; s++) {
    const a = weg[s - 1];
    const b = weg[s];
    const ra = ringVan(a);
    const rb = ringVan(b);
    if (rb === 0) {
      punten.push({ x: 0, y: 0 });
    } else if (ra === rb) {
      boogTot(middenHoek(b));
    } else if (rb < ra) {
      rechtTot((rb + 0.5) * c);
      boogTot(middenHoek(b));
    } else {
      boogTot(middenHoek(b));
      rechtTot((rb + 0.5) * c);
    }
  }
  const doel = w.doel ? { cx: 0, cy: 0, r: c * 0.32 } : null;
  return {
    b: 2 * (R + 1) * c, h: 2 * (R + 1) * c, midden: true, subpaden, cellen: totaal, stappen: weg.length,
    oplossing: [{ gesloten: false, punten }], doel,
  };
}

function maakDoolhof(w) {
  const c = vexel.mm(w.celmaat);
  const rnd = willekeur(w.zaad);
  return w.vorm === 'rond' ? rond(w, rnd, c) : rechthoekig(w, rnd, c);
}

/** Verschuift subpaden (met handvatten). */
function verschuif(subpaden, dx, dy) {
  const p = (q) => ({ x: r3(q.x + dx), y: r3(q.y + dy) });
  return subpaden.map((sp) => ({
    gesloten: sp.gesloten,
    punten: sp.punten.map((q) => {
      const u = p(q);
      if (q.in) u.in = p(q.in);
      if (q.uit) u.uit = p(q.uit);
      return u;
    }),
  }));
}

/** Verdeelt subpaden over paden van hooguit MAX_SUBPADEN subpaden. */
function inPaden(subpaden, stijl, naam) {
  const paden = [];
  for (let i = 0; i < subpaden.length; i += MAX_SUBPADEN) {
    paden.push({ soort: 'pad', ...stijl, subpaden: subpaden.slice(i, i + MAX_SUBPADEN) });
  }
  if (paden.length === 1) return { ...paden[0], naam };
  return { soort: 'groep', naam, kinderen: paden.map((p, i) => ({ ...p, naam: `${naam} ${i + 1}` })) };
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

const kolommen = (sjabloon, ...kinderen) =>
  maak('div', { stijl: { display: 'grid', gridTemplateColumns: sjabloon.replace(/([0-9.]+fr)/g, 'minmax(0, $1)'), gap: '10px', alignItems: 'end' } },
    ...kinderen);

/** Tekent subpaden (met handvatten) op een canvas. */
function tekenSubpaden(g, subpaden, s, ox, oy) {
  g.beginPath();
  for (const sp of subpaden) {
    const pts = sp.punten;
    g.moveTo(ox + pts[0].x * s, oy + pts[0].y * s);
    const n = sp.gesloten ? pts.length : pts.length - 1;
    for (let i = 1; i <= n; i++) {
      const a = pts[i - 1];
      const b = pts[i % pts.length];
      const c1 = a.uit || a;
      const c2 = b.in || b;
      g.bezierCurveTo(ox + c1.x * s, oy + c1.y * s, ox + c2.x * s, oy + c2.y * s, ox + b.x * s, oy + b.y * s);
    }
    if (sp.gesloten) g.closePath();
  }
}

// ---- het venster --------------------------------------------------------------

async function toonVenster() {
  const doc = await vexel.document();
  const cmyk = doc.kleurruimte === 'cmyk';
  const w0 = { ...STANDAARD, ...((await vexel.haal('instellingen')) || {}) };

  const vorm = keuzeVeld([['recht', 'Rechthoekig'], ['rond', 'Rond']], w0.vorm);
  const algoritme = keuzeVeld(Object.entries(ALGORITMEN), w0.algoritme);
  const kolommenVeld = getalVeld(w0.kolommen, 2, 100, 1);
  const rijen = getalVeld(w0.rijen, 2, 100, 1);
  const ringen = getalVeld(w0.ringen, 2, 40, 1);
  const celmaat = getalVeld(w0.celmaat, 2, 50, 0.5);
  const wand = getalVeld(w0.wand, 0.1, 20, 0.1);
  const kleur = keuzeVeld(Object.entries(KLEUREN).map(([k, v]) => [k, v.naam]), w0.kleur);
  const openingen = keuzeVeld([['hoeken', 'Linksboven → rechtsonder'], ['midden', 'Midden boven → onder'],
    ['zijkanten', 'Links → rechts']], w0.openingen);
  const oplossing = keuzeVeld([['geen', 'Geen'], ['groep', 'Aparte groep erop'], ['ernaast', 'Los exemplaar ernaast']], w0.oplossing);
  const doel = maak('input', { type: 'checkbox' });
  doel.checked = Boolean(w0.doel);
  const zaad = getalVeld(w0.zaad, 1, 99999, 1);

  const blokKolommen = metLabel('Kolommen', kolommenVeld);
  const blokRijen = metLabel('Rijen', rijen);
  const blokRingen = metLabel('Ringen', ringen);
  const blokOpeningen = metLabel('Ingang en uitgang', openingen);
  const blokDoel = maak('label', { klasse: 'uitleg', stijl: { display: 'flex', alignItems: 'center', gap: '6px', height: '26px' } },
    doel, 'Stip als doel in het midden');

  const doek = maak('canvas', { 'aria-hidden': 'true', stijl: { width: '100%', height: '210px' } });
  const samenvatting = maak('p', { klasse: 'uitleg', 'aria-live': 'polite', stijl: { margin: '0', minHeight: '2.9em' } });
  const variant = maak('button', { klasse: 'knop', type: 'button', tekst: 'Ander doolhof' });
  const maakKnop = maak('button', { klasse: 'knop primair', type: 'submit', tekst: 'Doolhof maken' });
  const annuleer = maak('button', { klasse: 'knop', type: 'button', tekst: 'Annuleren', bijClick: () => vexel.sluit() });

  const formulier = maak('form', { stijl: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '10px', padding: '12px 14px 14px' } },
    doek,
    kolommen('1fr 1fr', metLabel('Vorm', vorm), metLabel('Soort gangen', algoritme)),
    kolommen('1fr 1fr 1fr', blokKolommen, blokRijen, blokRingen, metLabel('Celmaat', celmaat, 'mm')),
    kolommen('1fr 1fr 1fr', metLabel('Wanddikte', wand, 'pt'), metLabel('Kleur', kleur), metLabel('Variant', zaad)),
    kolommen('1.3fr 1fr', blokOpeningen, blokDoel, metLabel('Oplossing', oplossing)),
    samenvatting,
    maak('div', { klasse: 'knoppen', stijl: { marginTop: '0' } }, variant, maak('span', { stijl: { flex: '1' } }), annuleer, maakKnop),
  );
  document.head.append(maak('style', { tekst: '.knop{white-space:nowrap}' }));
  document.body.style.padding = '0';
  document.body.append(formulier);

  const waarden = () => ({
    vorm: vorm.value,
    algoritme: algoritme.value,
    kolommen: Math.round(begrens(leesGetal(kolommenVeld, 20), 2, 100)),
    rijen: Math.round(begrens(leesGetal(rijen, 20), 2, 100)),
    ringen: Math.round(begrens(leesGetal(ringen, 12), 2, 40)),
    celmaat: begrens(leesGetal(celmaat, 8), 2, 50),
    wand: begrens(leesGetal(wand, 1.5), 0.1, 20),
    kleur: kleur.value,
    openingen: openingen.value,
    oplossing: oplossing.value,
    doel: doel.checked,
    zaad: Math.round(begrens(leesGetal(zaad, 1), 1, 99999)),
  });

  let gepland = false;
  function teken() {
    gepland = false;
    const w = waarden();
    const recht = w.vorm === 'recht';
    blokKolommen.style.display = recht ? 'grid' : 'none';
    blokRijen.style.display = recht ? 'grid' : 'none';
    blokOpeningen.style.display = recht ? 'grid' : 'none';
    blokRingen.style.display = recht ? 'none' : 'grid';
    blokDoel.style.display = recht ? 'none' : 'flex';
    const d = maakDoolhof(w);

    const schaal = devicePixelRatio || 1;
    const kader = doek.getBoundingClientRect();
    doek.width = Math.round(kader.width * schaal);
    doek.height = Math.round(kader.height * schaal);
    const g = doek.getContext('2d');
    g.setTransform(schaal, 0, 0, schaal, 0, 0);
    g.clearRect(0, 0, kader.width, kader.height);
    const marge = vexel.mm(w.celmaat) * 0.8;
    const s = Math.min((kader.width - 16) / (d.b + 2 * marge), (kader.height - 16) / (d.h + 2 * marge));
    const ox = kader.width / 2 - (d.midden ? 0 : (d.b * s) / 2);
    const oy = kader.height / 2 - (d.midden ? 0 : (d.h * s) / 2);
    g.lineJoin = recht ? 'miter' : 'round';
    g.lineCap = recht ? 'square' : 'round';
    g.strokeStyle = css('--tekst', '#e8e9ec');
    g.lineWidth = Math.max(0.75, w.wand * s);
    tekenSubpaden(g, d.subpaden, s, ox, oy);
    g.stroke();
    if (w.oplossing !== 'geen') {
      g.strokeStyle = css('--accent', '#5aa2ff');
      g.lineWidth = Math.max(1, vexel.mm(w.celmaat) * 0.22 * s);
      g.lineJoin = 'round';
      g.lineCap = 'round';
      tekenSubpaden(g, d.oplossing, s, ox, oy);
      g.stroke();
    }
    if (d.doel) {
      g.fillStyle = css('--tekst', '#e8e9ec');
      g.beginPath();
      g.arc(ox, oy, d.doel.r * s, 0, Math.PI * 2);
      g.fill();
    }

    const mm = (pt) => getal(pt / vexel.mm(1), 0);
    const maat = recht ? `${w.kolommen} × ${w.rijen} cellen` : `${w.ringen} ringen, ${d.cellen} cellen`;
    const past = d.b <= doc.tekengebied.b + 0.01 && d.h <= doc.tekengebied.h + 0.01;
    const punten = d.subpaden.reduce((n, sp) => n + sp.punten.length, 0) * (w.oplossing === 'ernaast' ? 2 : 1);
    let tekst = `${maat}, ${mm(d.b)} × ${mm(d.h)} mm, wanden in ${d.subpaden.length} paden; de oplossing gaat door ${d.stappen} cellen.`;
    if (!past) tekst += ' Let op: groter dan het tekengebied.';
    if (doc.alleenLezen) tekst = 'Dit document is alleen-lezen; je kunt hier niets aan toevoegen.';
    else if (punten > MAX_PUNTEN) tekst = 'Dit doolhof is te groot om in één keer te maken. Kies minder cellen.';
    samenvatting.textContent = tekst;
    maakKnop.disabled = doc.alleenLezen || punten > MAX_PUNTEN;
  }
  const plan = () => {
    if (!gepland) {
      gepland = true;
      requestAnimationFrame(teken);
    }
  };

  variant.addEventListener('click', () => {
    zaad.value = String(1 + Math.floor(Math.random() * 99999));
    plan();
  });
  formulier.addEventListener('input', plan);
  formulier.addEventListener('change', plan);
  formulier.addEventListener('submit', async (gebeurtenis) => {
    gebeurtenis.preventDefault();
    const w = waarden();
    const d = maakDoolhof(w);
    const tg = doc.tekengebied;
    // midden op het tekengebied
    const dx = d.midden ? tg.b / 2 : (tg.b - d.b) / 2;
    const dy = d.midden ? tg.h / 2 : (tg.h - d.h) / 2;
    const k = KLEUREN[w.kleur] || KLEUREN.zwart;
    const wandKleur = cmyk ? { cmyk: k.cmyk } : { hex: k.hex };
    const oplosKleur = cmyk ? { cmyk: OPLOSKLEUR.cmyk } : { hex: OPLOSKLEUR.hex };
    const recht = w.vorm === 'recht';
    const wandStijl = {
      vulling: null, lijn: wandKleur, lijndikte: w.wand,
      lijneinde: recht ? 'square' : 'round', lijnhoek: recht ? 'miter' : 'round',
    };
    const oplosStijl = {
      vulling: null, lijn: oplosKleur, lijndikte: r3(vexel.mm(w.celmaat) * 0.22),
      lijneinde: 'round', lijnhoek: 'round',
    };
    const naam = recht ? `Doolhof ${w.kolommen} × ${w.rijen}` : `Rond doolhof, ${w.ringen} ringen`;
    const exemplaar = (x, y, metOplossing) => {
      const kinderen = [inPaden(verschuif(d.subpaden, x, y), wandStijl, 'Wanden')];
      if (d.doel) {
        kinderen.push({ soort: 'ellips', naam: 'Doel', cx: r3(x), cy: r3(y), rx: r3(d.doel.r), ry: r3(d.doel.r), vulling: wandKleur, lijn: null });
      }
      // als groep op het doolhof: verborgen, aan te zetten in het lagenpaneel (voor het antwoordblad)
      if (metOplossing) kinderen.push({ soort: 'groep', naam: 'Oplossing', zichtbaar: w.oplossing !== 'groep', kinderen: [inPaden(verschuif(d.oplossing, x, y), oplosStijl, 'Route')] });
      return kinderen;
    };
    const vormen = [{ soort: 'groep', naam, kinderen: exemplaar(dx, dy, w.oplossing === 'groep') }];
    if (w.oplossing === 'ernaast') {
      vormen.push({ soort: 'groep', naam: `${naam}, oplossing`, kinderen: exemplaar(dx + tg.b + vexel.mm(20), dy, true) });
    }

    maakKnop.disabled = true;
    try {
      await vexel.maak(vormen);
      await vexel.bewaar('instellingen', w);
      const extra = w.oplossing === 'groep' ? ' De oplossing staat verborgen in de groep Oplossing; zet hem aan in het lagenpaneel.'
        : w.oplossing === 'ernaast' ? ' De oplossing staat rechts naast het tekengebied.' : '';
      vexel.melding(`${naam} gemaakt.${extra}`, 'ok');
      vexel.sluit();
    } catch (fout) {
      maakKnop.disabled = false;
      vexel.melding(fout && fout.message ? fout.message : 'Het doolhof kon niet worden gemaakt.', 'fout');
    }
  });

  teken();
  vorm.focus();
}

vexel.opCommando('maken', toonVenster);
