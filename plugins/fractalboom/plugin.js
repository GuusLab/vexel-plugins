// Fractalboom: bomen, varens, koraal en bloesemtakken die zichzelf vertakken, als nette gevulde vormen.
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

// ---- krommen --------------------------------------------------------------

const rond = (n) => Math.round(n * 100) / 100;

/** Een vloeiende gesloten kromme door de punten (handvatten volgens Catmull-Rom). */
function krommeGesloten(punten) {
  const n = punten.length;
  return punten.map((p, i) => {
    const vorige = punten[(i - 1 + n) % n];
    const volgende = punten[(i + 1) % n];
    const tx = (volgende.x - vorige.x) / 6;
    const ty = (volgende.y - vorige.y) / 6;
    return { x: p.x, y: p.y, in: { x: p.x - tx, y: p.y - ty }, uit: { x: p.x + tx, y: p.y + ty } };
  });
}

/** Alle punten (ook handvatten) van een subpad verschalen en verschuiven, afgerond. */
function plaatsSubpad(s, f, dx, dy) {
  const zet = (q) => ({ x: rond(q.x * f + dx), y: rond(q.y * f + dy) });
  return {
    gesloten: s.gesloten,
    punten: s.punten.map((p) => {
      const q = zet(p);
      if (p.in) q.in = zet(p.in);
      if (p.uit) q.uit = zet(p.uit);
      return q;
    }),
  };
}

// ---- paletten -------------------------------------------------------------
// Alles in CMYK; in een RGB-document wordt het omgerekend.
// tak: drie tinten van stam naar twijg; blad en bloem: een paar kleuren; hart: het midden van een bloem.

const BRUIN = [[45, 65, 80, 50], [40, 60, 75, 35], [35, 50, 68, 22]];
const PALETTEN = {
  zomer: { naam: 'Zomer', tak: BRUIN,
    blad: [[70, 25, 95, 25], [55, 12, 85, 14], [80, 40, 95, 45], [45, 10, 75, 8]],
    bloem: [[0, 45, 10, 0], [0, 25, 5, 0], [0, 5, 3, 0]], hart: [0, 20, 90, 0] },
  herfst: { naam: 'Herfst', tak: BRUIN,
    blad: [[0, 70, 95, 0], [0, 45, 95, 0], [10, 85, 95, 20], [0, 25, 90, 0]],
    bloem: [[0, 10, 60, 0], [0, 5, 30, 0]], hart: [0, 45, 90, 10] },
  lente: { naam: 'Lente', tak: [[50, 70, 70, 65], [45, 65, 65, 50], [40, 60, 60, 38]],
    blad: [[48, 10, 75, 10], [35, 5, 60, 4], [62, 20, 88, 20]],
    bloem: [[0, 55, 15, 0], [0, 35, 8, 0], [0, 15, 4, 0], [0, 3, 2, 0]], hart: [0, 30, 95, 0] },
  groen: { naam: 'Varengroen', tak: [[80, 35, 95, 40], [72, 22, 92, 25], [62, 10, 88, 12]],
    blad: [[72, 18, 92, 18], [58, 6, 80, 4], [82, 34, 96, 38]],
    bloem: [[0, 10, 60, 0]], hart: [0, 40, 90, 0] },
  koraal: { naam: 'Koraal', tak: [[0, 82, 72, 12], [0, 66, 60, 0], [0, 45, 45, 0]],
    blad: [[0, 30, 40, 0]], bloem: [[0, 15, 25, 0]], hart: [0, 10, 40, 0] },
  diepzee: { naam: 'Diepzee', tak: [[95, 65, 30, 35], [82, 32, 25, 10], [60, 5, 20, 0]],
    blad: [[40, 0, 15, 0]], bloem: [[20, 0, 10, 0]], hart: [0, 0, 50, 0] },
  goud: { naam: 'Goud', tak: [[0, 32, 88, 28], [0, 26, 78, 14], [0, 18, 62, 2]],
    blad: [[0, 20, 72, 6], [0, 12, 55, 0], [0, 32, 88, 22]],
    bloem: [[0, 8, 30, 0], [0, 16, 50, 0]], hart: [0, 45, 90, 12] },
  inkt: { naam: 'Inkt', tak: [[0, 0, 0, 100], [0, 0, 0, 100], [0, 0, 0, 100]],
    blad: [[0, 0, 0, 100], [0, 0, 0, 80]], bloem: [[0, 0, 0, 45], [0, 0, 0, 25]], hart: [0, 0, 0, 100] },
};

// ---- voorinstellingen -------------------------------------------------------

const GROEIWIJZEN = { vork: 'Vertakken', veer: 'Geveerd' };
const LOOF = { geen: 'Geen', blad: 'Bladeren', bloesem: 'Bloesem', beide: 'Bladeren en bloesem' };

const VOORINSTELLINGEN = {
  boom: { naam: 'Boom', groei: 'vork', diepte: 9, takken: 2, zijtakken: 12, hoek: 44, verhouding: 78, stamlengte: 100, dikte: 10, twijg: 8,
    willekeur: 40, richting: 0, wind: 8, hangen: -45, loof: 'blad', dichtheid: 75, bladmaat: 9, palet: 'zomer' },
  varen: { naam: 'Varen', groei: 'veer', diepte: 2, takken: 2, zijtakken: 18, hoek: 64, verhouding: 42, stamlengte: 100, dikte: 2.4, twijg: 14,
    willekeur: 15, richting: 12, wind: 22, hangen: 0, loof: 'blad', dichtheid: 100, bladmaat: 100, palet: 'groen' },
  koraal: { naam: 'Koraal', groei: 'vork', diepte: 7, takken: 2, zijtakken: 12, hoek: 48, verhouding: 80, stamlengte: 35, dikte: 16, twijg: 34,
    willekeur: 50, richting: 0, wind: 0, hangen: -30, loof: 'geen', dichtheid: 0, bladmaat: 6, palet: 'koraal' },
  bloesem: { naam: 'Bloesemtak', groei: 'vork', diepte: 7, takken: 2, zijtakken: 12, hoek: 40, verhouding: 76, stamlengte: 100, dikte: 7, twijg: 14,
    willekeur: 55, richting: 62, wind: 0, hangen: 12, loof: 'beide', dichtheid: 65, bladmaat: 10, palet: 'lente' },
  wilg: { naam: 'Wilg', groei: 'vork', diepte: 6, takken: 3, zijtakken: 12, hoek: 58, verhouding: 78, stamlengte: 120, dikte: 11, twijg: 5,
    willekeur: 35, richting: 0, wind: 4, hangen: 75, loof: 'blad', dichtheid: 80, bladmaat: 5, palet: 'lente' },
};

const STANDAARD = { voorinstelling: 'boom', plaats: 'tekengebied', grootte: 85, zaad: 1618, ...VOORINSTELLINGEN.boom };
delete STANDAARD.naam;

const MAX_TAKKEN = 6000;

/** Hoeveel takken het ongeveer worden (om te weigeren vóór het rekenen). */
function telTakken(w) {
  const perKnoop = w.groei === 'veer' ? 2 * w.zijtakken : w.takken;
  let som = 0;
  let laag = 1;
  for (let i = 0; i <= w.diepte; i++) {
    som += laag;
    laag *= perKnoop;
  }
  return som;
}

// ---- de groei ---------------------------------------------------------------
// Rekent in eigen eenheden: de stam is 100 lang en begint in (0, 0), omhoog.
// Een hoek van 0 is recht omhoog, positief is naar rechts (met de klok mee).

const richtingVan = (a) => ({ x: Math.sin(a), y: -Math.cos(a) });

function groei(w) {
  const kans = willekeur(w.zaad);
  const r = w.willekeur / 100;
  const takken = [];
  const bladeren = [];
  const bloemen = [];
  const stam = 100;
  const windDoel = w.wind >= 0 ? Math.PI / 2 : -Math.PI / 2;
  const windKracht = Math.abs(w.wind) / 100;
  const hangKracht = w.hangen / 100;
  const veer = w.groei === 'veer';
  const metBlad = w.loof === 'blad' || w.loof === 'beide';
  const metBloem = w.loof === 'bloesem' || w.loof === 'beide';
  const dicht = w.dichtheid / 100;
  // Twijgen blijven zichtbaar: nooit dunner dan een klein deel van de stam.
  const minBreedte = (stam * w.dikte) / 100 * (w.twijg / 100);
  const blad = (x, y, a, lengte, breedte) => bladeren.push({ x, y, a, lengte, breedte, kleur: Math.floor(kans() * 1000) });
  const bloem = (x, y, straal) => bloemen.push({ x, y, straal, draai: kans() * Math.PI, kleur: Math.floor(kans() * 1000) });

  /** Bladeren en bloesem langs een eindtak. */
  function loofLangs(punten, richtingen, lengte, deel = 1) {
    const n = punten.length - 1;
    const maat = (stam * w.bladmaat) / 100;
    if (metBlad) {
      const aantal = Math.round(dicht * 6 * deel);
      for (let j = 0; j < aantal; j++) {
        const t = (j + 1) / (aantal + 1);
        const i = Math.min(n, Math.round(t * n));
        const kant = j % 2 ? 1 : -1;
        const a = richtingen[i] + kant * (0.6 + kans() * 0.35);
        blad(punten[i].x, punten[i].y, a, maat * (0.75 + kans() * 0.5), 0.42);
      }
      if (dicht > 0 && deel === 1) blad(punten[n].x, punten[n].y, richtingen[n] + (kans() - 0.5) * 0.4, maat * (0.85 + kans() * 0.4), 0.42);
    }
    if (metBloem) {
      const aantal = Math.round(dicht * 3 * deel * (0.5 + kans()));
      for (let j = 0; j < aantal; j++) {
        const i = Math.min(n, Math.round((0.3 + 0.7 * kans()) * n));
        bloem(punten[i].x + (kans() - 0.5) * maat * 0.4, punten[i].y + (kans() - 0.5) * maat * 0.4, maat * (0.38 + kans() * 0.22));
      }
      if (dicht > 0 && deel === 1) bloem(punten[n].x, punten[n].y, maat * (0.42 + kans() * 0.2));
    }
    return lengte;
  }

  /** Eén tak: een kromme lijn van gelijke stapjes die met wind en zwaarte meebuigt. */
  function tak(x, y, a, lengte, breedte, niveau) {
    if (takken.length >= MAX_TAKKEN) return;
    const eind = niveau === w.diepte;
    // Een geveerd eindblaadje wordt een blad in plaats van een tak.
    if (veer && eind && metBlad && niveau > 0) {
      blad(x, y, a, lengte, 0.34);
      return;
    }
    const stappen = veer && !eind ? w.zijtakken + 1 : 5;
    const ds = lengte / stappen;
    const punten = [{ x, y }];
    const richtingen = [a];
    const diepteFactor = w.diepte ? niveau / w.diepte : 0;
    let px = x;
    let py = y;
    let hoek = a;
    for (let s = 1; s <= stappen; s++) {
      hoek += windKracht * 0.07 * (0.35 + diepteFactor) * Math.sin(windDoel - hoek) * (veer ? 5 / stappen : 1);
      // Hangen: positief buigt naar beneden (zwaarte), negatief naar boven (naar het licht).
      hoek += hangKracht * (hangKracht > 0 ? 0.11 : 0.13) * (0.1 + diepteFactor) * Math.sin(hoek) * (veer ? 5 / stappen : 1);
      hoek += (kans() - 0.5) * r * 0.32 * (veer ? 0.4 : 1);
      const d = richtingVan(hoek);
      px += d.x * ds;
      py += d.y * ds;
      punten.push({ x: px, y: py });
      richtingen.push(hoek);
    }
    const eindBreedte = Math.max(minBreedte, breedte * (veer ? 0.35 : 0.8));
    const breedtes = punten.map((_, i) => breedte + (eindBreedte - breedte) * (i / stappen));
    if (niveau === 0 && !veer) breedtes[0] *= 1.3;
    takken.push({ punten, richtingen, breedtes, niveau });
    if (eind) {
      loofLangs(punten, richtingen, lengte);
      return;
    }
    // Ook wat loof op de takken net onder de twijgen, zodat de kroon voller wordt.
    if (!veer && niveau === w.diepte - 1 && w.diepte > 2) loofLangs(punten, richtingen, lengte, 0.4);
    if (veer) {
      // Zijtakken links en rechts, eerst langer, naar de punt toe korter.
      for (let i = 1; i <= w.zijtakken; i++) {
        const t = i / (w.zijtakken + 1);
        const vorm = Math.pow(1 - t, 0.85) * Math.min(1, 0.55 + t * 3);
        for (const kant of [-1, 1]) {
          let l = lengte * (w.verhouding / 100) * vorm * (1 + (kans() - 0.5) * r * 0.4);
          // Fijne blaadjes niet langer dan nodig, anders schuiven ze over elkaar.
          if (niveau > 0) l = Math.min(l, ds * 2);
          const ah = richtingen[i] + kant * (w.hoek * Math.PI / 180) * (1 + (kans() - 0.5) * r * 0.3);
          tak(punten[i].x, punten[i].y, ah, l, Math.max(minBreedte, breedtes[i] * 0.45), niveau + 1);
        }
      }
      return;
    }
    const n = w.takken;
    const spreiding = (w.hoek * Math.PI) / 180;
    const kindBreedte = Math.max(minBreedte, eindBreedte * Math.pow(1 / n, 0.35));
    for (let k = 0; k < n; k++) {
      // Bij veel willekeur valt soms een tak weg (maar nooit allemaal).
      if (k > 0 && kans() < r * 0.12) continue;
      const basis = n === 1 ? 0 : -spreiding / 2 + (spreiding * k) / (n - 1);
      const ah = richtingen[stappen] + basis + (kans() - 0.5) * spreiding * r * 0.6;
      // De stam kan korter of langer zijn; de takken erboven rekenen met de gewone lengte.
      const l = (niveau === 0 ? stam : lengte) * (w.verhouding / 100) * (1 + (kans() - 0.5) * r * 0.5);
      tak(punten[stappen].x, punten[stappen].y, ah, l, kindBreedte, niveau + 1);
    }
  }

  tak(0, 0, (w.richting * Math.PI) / 180, (stam * w.stamlengte) / 100, (stam * w.dikte) / 100, 0);
  return { takken, bladeren, bloemen };
}

/** De omtrek van een tak: links heen, rond om de punt, rechts terug (altijd dezelfde draairichting). */
function takOmtrek(t) {
  const n = t.punten.length;
  const links = [];
  const rechts = [];
  for (let i = 0; i < n; i++) {
    const d = richtingVan(t.richtingen[i]);
    const h = t.breedtes[i] / 2;
    links.push({ x: t.punten[i].x + d.y * h, y: t.punten[i].y - d.x * h });
    rechts.push({ x: t.punten[i].x - d.y * h, y: t.punten[i].y + d.x * h });
  }
  const de = richtingVan(t.richtingen[n - 1]);
  const he = t.breedtes[n - 1] / 2;
  const punt = { x: t.punten[n - 1].x + de.x * he * 0.9, y: t.punten[n - 1].y + de.y * he * 0.9 };
  const lus = [...links, punt, ...rechts.reverse()];
  if (t.niveau > 0) {
    // Een klein stukje terug in de ouder, zodat er geen naad is.
    const db = richtingVan(t.richtingen[0]);
    const hb = t.breedtes[0] / 2;
    lus.push({ x: t.punten[0].x - db.x * hb * 0.9, y: t.punten[0].y - db.y * hb * 0.9 });
  }
  const k = krommeGesloten(lus);
  if (t.niveau === 0) {
    // Recht afgesneden voet.
    delete k[0].in;
    delete k[k.length - 1].uit;
  }
  return { gesloten: true, punten: k };
}

/** Een blad: twee bogen van de voet naar de punt. */
function bladVorm(b) {
  const d = richtingVan(b.a);
  const nx = d.y;
  const ny = -d.x;
  const L = b.lengte;
  const B = b.lengte * b.breedte;
  const voet = { x: b.x, y: b.y };
  const punt = { x: b.x + d.x * L, y: b.y + d.y * L };
  return {
    gesloten: true,
    punten: [
      { x: voet.x, y: voet.y, in: { x: voet.x + d.x * L * 0.2 - nx * B, y: voet.y + d.y * L * 0.2 - ny * B },
        uit: { x: voet.x + d.x * L * 0.2 + nx * B, y: voet.y + d.y * L * 0.2 + ny * B } },
      { x: punt.x, y: punt.y, in: { x: punt.x - d.x * L * 0.45 + nx * B * 0.75, y: punt.y - d.y * L * 0.45 + ny * B * 0.75 },
        uit: { x: punt.x - d.x * L * 0.45 - nx * B * 0.75, y: punt.y - d.y * L * 0.45 - ny * B * 0.75 } },
    ],
  };
}

/** Een cirkel als subpad met vier punten. */
function cirkel(cx, cy, r) {
  const k = r * 0.5523;
  return {
    gesloten: true,
    punten: [
      { x: cx, y: cy - r, in: { x: cx - k, y: cy - r }, uit: { x: cx + k, y: cy - r } },
      { x: cx + r, y: cy, in: { x: cx + r, y: cy - k }, uit: { x: cx + r, y: cy + k } },
      { x: cx, y: cy + r, in: { x: cx + k, y: cy + r }, uit: { x: cx - k, y: cy + r } },
      { x: cx - r, y: cy, in: { x: cx - r, y: cy + k }, uit: { x: cx - r, y: cy - k } },
    ],
  };
}

/** Een bloem: vijf ronde blaadjes rond het midden, plus het hart. */
function bloemVorm(b) {
  const blaadjes = [];
  for (let i = 0; i < 5; i++) {
    const a = b.draai + (i * 2 * Math.PI) / 5;
    blaadjes.push(bladVorm({ x: b.x, y: b.y, a, lengte: b.straal, breedte: 0.62 }));
  }
  return { blaadjes, hart: cirkel(b.x, b.y, b.straal * 0.24) };
}

/** Grenzen van alle geometrie (in eigen eenheden). */
function grenzen(g) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  const bij = (x, y, m) => {
    x0 = Math.min(x0, x - m);
    y0 = Math.min(y0, y - m);
    x1 = Math.max(x1, x + m);
    y1 = Math.max(y1, y + m);
  };
  for (const t of g.takken) t.punten.forEach((p, i) => bij(p.x, p.y, t.breedtes[i] / 2));
  for (const b of g.bladeren) {
    const d = richtingVan(b.a);
    bij(b.x + d.x * b.lengte * 0.5, b.y + d.y * b.lengte * 0.5, b.lengte * 0.5);
  }
  for (const b of g.bloemen) bij(b.x, b.y, b.straal);
  return { x: x0, y: y0, b: x1 - x0, h: y1 - y0 };
}

/** Subpaden in stukken van hooguit 1000, elk een eigen pad. */
function paden(naam, subpaden, kleur, cmyk) {
  const uit = [];
  for (let i = 0; i < subpaden.length; i += GRENS.subpaden) {
    const deel = subpaden.slice(i, i + GRENS.subpaden);
    const extra = subpaden.length > GRENS.subpaden ? ` (${i / GRENS.subpaden + 1})` : '';
    uit.push({ soort: 'pad', naam: naam + extra, subpaden: deel, vulling: alsKleur(kleur, cmyk), lijn: null, lijndikte: 0 });
  }
  return uit;
}

/** Alle vormen, passend in `vak` (pt): de voet onderaan in het midden. */
function maakBoom(w, vak, cmyk, marge) {
  const g = groei(w);
  const palet = PALETTEN[w.palet] || PALETTEN.zomer;
  const kader = grenzen(g);
  const ruimte = { b: vak.b - 2 * marge.x, h: vak.h - marge.boven - marge.onder };
  const f = Math.min((ruimte.b * 0.96) / kader.b, (ruimte.h * w.grootte) / 100 / kader.h);
  const dx = vak.x + vak.b / 2 - (kader.x + kader.b / 2) * f;
  const dy = vak.y + vak.h - marge.onder - (kader.y + kader.h) * f;

  const kinderen = [];
  // Takken: drie tinten, van stam naar twijg.
  const tinten = [[], [], []];
  for (const t of g.takken) {
    const tint = w.diepte ? Math.min(2, Math.floor((t.niveau / (w.diepte + 0.01)) * 3)) : 0;
    tinten[tint].push(plaatsSubpad(takOmtrek(t), f, dx, dy));
  }
  const takNamen = ['Stam', 'Takken', 'Twijgen'];
  const takVormen = [];
  tinten.forEach((lijst, i) => {
    if (lijst.length) takVormen.push(...paden(takNamen[i], lijst, palet.tak[i], cmyk));
  });
  kinderen.push({ soort: 'groep', naam: w.groei === 'veer' ? 'Stelen' : 'Stam en takken', kinderen: takVormen });

  if (g.bladeren.length) {
    const perKleur = palet.blad.map(() => []);
    for (const b of g.bladeren) perKleur[b.kleur % palet.blad.length].push(plaatsSubpad(bladVorm(b), f, dx, dy));
    const vormen = [];
    perKleur.forEach((lijst, i) => {
      if (lijst.length) vormen.push(...paden(`Blad ${i + 1}`, lijst, palet.blad[i], cmyk));
    });
    kinderen.push({ soort: 'groep', naam: 'Bladeren', kinderen: vormen });
  }
  if (g.bloemen.length) {
    const perKleur = palet.bloem.map(() => []);
    const harten = [];
    for (const b of g.bloemen) {
      const v = bloemVorm(b);
      perKleur[b.kleur % palet.bloem.length].push(...v.blaadjes.map((s) => plaatsSubpad(s, f, dx, dy)));
      harten.push(plaatsSubpad(v.hart, f, dx, dy));
    }
    const vormen = [];
    perKleur.forEach((lijst, i) => {
      if (lijst.length) vormen.push(...paden(`Bloesem ${i + 1}`, lijst, palet.bloem[i], cmyk));
    });
    vormen.push(...paden('Harten', harten, palet.hart, cmyk));
    kinderen.push({ soort: 'groep', naam: 'Bloesem', kinderen: vormen });
  }
  const naam = (VOORINSTELLINGEN[w.voorinstelling] || {}).naam || 'Fractalboom';
  return {
    vormen: [{ soort: 'groep', naam: `Fractalboom (${naam.toLowerCase()})`, kinderen }],
    takken: g.takken.length, bladeren: g.bladeren.length, bloemen: g.bloemen.length,
    hoogte: kader.h * f, stamDikte: (100 * w.dikte / 100) * f, afgekapt: g.takken.length >= MAX_TAKKEN,
  };
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
    voorinstelling: keuzeVeld(Object.fromEntries(Object.entries(VOORINSTELLINGEN).map(([k, v]) => [k, v.naam])), w0.voorinstelling),
    plaats: keuzeVeld({ tekengebied: 'Tekengebied (onderaan in het midden)', selectie: 'Selectie (in het kader)' }, w0.plaats),
    grootte: getalVeld(w0.grootte, 10, 100, 5),
    groei: keuzeVeld(GROEIWIJZEN, w0.groei),
    diepte: getalVeld(w0.diepte, 1, 12, 1),
    takken: keuzeVeld({ 2: '2', 3: '3', 4: '4' }, String(w0.takken)),
    zijtakken: getalVeld(w0.zijtakken, 3, 30, 1),
    hoek: getalVeld(w0.hoek, 0, 180, 1),
    stamlengte: getalVeld(w0.stamlengte, 5, 300, 5),
    verhouding: getalVeld(w0.verhouding, 20, 95, 1),
    dikte: getalVeld(w0.dikte, 0.5, 40, 0.5),
    twijg: getalVeld(w0.twijg, 1, 80, 1),
    willekeur: getalVeld(w0.willekeur, 0, 100, 5),
    richting: getalVeld(w0.richting, -90, 90, 1),
    wind: getalVeld(w0.wind, -100, 100, 5),
    hangen: getalVeld(w0.hangen, -100, 100, 5),
    loof: keuzeVeld(LOOF, w0.loof),
    dichtheid: getalVeld(w0.dichtheid, 0, 100, 5),
    bladmaat: getalVeld(w0.bladmaat, 1, 150, 0.5),
    palet: keuzeVeld(Object.fromEntries(Object.entries(PALETTEN).map(([k, v]) => [k, v.naam])), w0.palet),
    zaad: getalVeld(w0.zaad, 1, 999999, 1),
  };
  const stalen = maak('span', { 'aria-hidden': 'true', stijl: { display: 'flex', gap: '2px', flex: 'none' } });
  const anders = maak('button', { klasse: 'knop', type: 'button', tekst: 'Anders', title: 'Een ander zaadje: dezelfde soort plant, anders gegroeid',
    stijl: { flex: 'none' },
    bijClick: () => {
      velden.zaad.value = String(1 + Math.floor(Math.random() * 999998));
      plan();
    } });

  const doek = maak('canvas', { 'aria-hidden': 'true', stijl: { width: '100%', height: '165px', borderRadius: '6px' } });
  const samenvatting = maak('p', { klasse: 'uitleg', 'aria-live': 'polite', stijl: { margin: '0', minHeight: '30px' } });
  const maakKnop = maak('button', { klasse: 'knop primair', type: 'submit', tekst: 'Plant maken' });
  const annuleer = maak('button', { klasse: 'knop', type: 'button', tekst: 'Annuleren', bijClick: () => vexel.sluit() });

  const takkenRij = regel('Per knoop', velden.takken, '');
  const zijRij = regel('Zijtakken', velden.zijtakken, '');
  const grootteRij = regel('Grootte', velden.grootte, '%');
  const hangRij = regel('Hangen', velden.hangen, '%');
  hangRij.title = 'Positief: takken hangen omlaag. Negatief: takken groeien naar het licht.';
  velden.wind.title = 'Positief: naar rechts. Negatief: naar links.';
  const formulier = maak('form', { stijl: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '7px' } },
    doek,
    regel('Soort', velden.voorinstelling),
    regel('Plaats', velden.plaats),
    twee(regel('Groei', velden.groei), grootteRij),
    twee(regel('Niveaus', velden.diepte, ''), maak('div', {}, takkenRij, zijRij)),
    twee(regel('Hoek', velden.hoek, '°'), regel('Lengte', velden.verhouding, '%')),
    twee(regel('Stamdikte', velden.dikte, '%'), regel('Twijgdikte', velden.twijg, '%')),
    twee(regel('Richting', velden.richting, '°'), regel('Willekeur', velden.willekeur, '%')),
    twee(regel('Wind', velden.wind, '%'), hangRij),
    twee(regel('Stamlengte', velden.stamlengte, '%'), regel('Loof', velden.loof)),
    twee(regel('Dichtheid', velden.dichtheid, '%'), regel('Bladmaat', velden.bladmaat, '%')),
    regel('Kleuren', velden.palet, stalen),
    regel('Zaadje', velden.zaad, anders),
    samenvatting,
    maak('div', { klasse: 'knoppen', stijl: { marginTop: '0' } }, annuleer, maakKnop),
  );
  document.body.append(formulier);

  const getalVan = (sleutel, min, max) => begrens(leesGetal(velden[sleutel], STANDAARD[sleutel]), min, max);
  const waarden = () => ({
    voorinstelling: velden.voorinstelling.value,
    plaats: velden.plaats.value,
    grootte: getalVan('grootte', 10, 100),
    groei: velden.groei.value,
    diepte: Math.round(getalVan('diepte', 1, 12)),
    takken: Number(velden.takken.value) || 2,
    zijtakken: Math.round(getalVan('zijtakken', 3, 30)),
    hoek: getalVan('hoek', 0, 180),
    stamlengte: getalVan('stamlengte', 5, 300),
    verhouding: getalVan('verhouding', 20, 95),
    dikte: getalVan('dikte', 0.5, 40),
    twijg: getalVan('twijg', 1, 80),
    willekeur: getalVan('willekeur', 0, 100),
    richting: getalVan('richting', -90, 90),
    wind: getalVan('wind', -100, 100),
    hangen: getalVan('hangen', -100, 100),
    loof: velden.loof.value,
    dichtheid: getalVan('dichtheid', 0, 100),
    bladmaat: getalVan('bladmaat', 1, 150),
    palet: velden.palet.value,
    zaad: Math.round(begrens(leesGetal(velden.zaad, 1), 1, 999999)),
  });

  /** Een voorinstelling zet alle groei- en kleurvelden; plaats, grootte en zaadje blijven. */
  velden.voorinstelling.addEventListener('change', () => {
    const v = VOORINSTELLINGEN[velden.voorinstelling.value];
    if (!v) return;
    for (const [sleutel, waarde] of Object.entries(v)) {
      if (sleutel !== 'naam' && velden[sleutel]) velden[sleutel].value = String(waarde);
    }
  });

  const gebiedVan = (w, items) => {
    const tg = doc.tekengebied;
    if (w.plaats !== 'selectie') {
      return { vak: { x: 0, y: 0, b: tg.b, h: tg.h }, marge: { x: tg.b * 0.05, boven: tg.h * 0.05, onder: tg.h * 0.06 } };
    }
    if (!items.length) return { fout: 'Er is niets geselecteerd. Selecteer een vorm, of kies "Tekengebied" bij Plaats.' };
    const x0 = Math.min(...items.map((o) => o.kader.x));
    const y0 = Math.min(...items.map((o) => o.kader.y));
    const x1 = Math.max(...items.map((o) => o.kader.x + o.kader.b));
    const y1 = Math.max(...items.map((o) => o.kader.y + o.kader.h));
    if (!(x1 - x0 > 5) || !(y1 - y0 > 5)) return { fout: 'De selectie is te klein om een plant in te zetten.' };
    return { vak: { x: x0, y: y0, b: x1 - x0, h: y1 - y0 }, marge: { x: 0, boven: 0, onder: 0 } };
  };

  function bouw(w, items) {
    const gebied = gebiedVan(w, items);
    if (gebied.fout) return gebied;
    const aantal = telTakken(w);
    if (aantal > MAX_TAKKEN) {
      const wat = w.groei === 'veer' ? 'minder zijtakken' : 'minder takken per knoop';
      return { fout: `Dat worden ${getal(aantal, 0)} takken (hooguit ${getal(MAX_TAKKEN, 0)}). Kies minder niveaus of ${wat}.`, gebied };
    }
    const uitkomst = maakBoom(w, gebied.vak, cmyk, gebied.marge);
    const t = tel(uitkomst.vormen);
    if (t.punten > GRENS.punten || t.vormen > GRENS.vormen) {
      return { fout: `Te veel punten (${getal(t.punten, 0)}, hooguit 50.000). Kies minder niveaus, minder loof of een lagere dichtheid.`, gebied };
    }
    return { ...uitkomst, gebied, punten: t.punten };
  }

  let gepland = false;
  function teken() {
    gepland = false;
    const w = waarden();
    const palet = PALETTEN[w.palet] || PALETTEN.zomer;
    const toon = [palet.tak[0], palet.tak[2], ...palet.blad.slice(0, 2), ...palet.bloem.slice(0, 2)];
    stalen.replaceChildren(...toon.map((c) => maak('span', { stijl: {
      width: '10px', height: '18px', borderRadius: '3px', border: '1px solid var(--lijn)', background: kleurCss({ cmyk: c }) } })));
    takkenRij.style.display = w.groei === 'veer' ? 'none' : '';
    zijRij.style.display = w.groei === 'veer' ? '' : 'none';
    const uitkomst = bouw(w, selectie);
    const g = uitkomst.gebied && uitkomst.gebied.vak;
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
      const delen = [`${getal(uitkomst.takken, 0)} takken`];
      if (uitkomst.bladeren) delen.push(`${getal(uitkomst.bladeren, 0)} bladeren`);
      if (uitkomst.bloemen) delen.push(`${getal(uitkomst.bloemen, 0)} bloesems`);
      samenvatting.textContent = `${delen.join(', ')}; ${getal(uitkomst.hoogte / vexel.mm(1), 0)} mm hoog, `
        + `stam ${getal(uitkomst.stamDikte / vexel.mm(1), 1)} mm dik (${getal(uitkomst.punten, 0)} punten).`;
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
      const items = w.plaats === 'selectie' ? await vexel.selectie() : [];
      const uitkomst = bouw(w, items);
      if (uitkomst.fout) {
        vexel.melding(uitkomst.fout, 'let');
        maakKnop.disabled = false;
        return;
      }
      await vexel.maak(uitkomst.vormen);
      await vexel.bewaar('instellingen', w);
      vexel.melding(`Plant gemaakt: ${getal(uitkomst.takken, 0)} takken.`, 'ok');
      vexel.sluit();
    } catch (fout) {
      maakKnop.disabled = false;
      vexel.melding(fout && fout.message ? fout.message : 'De plant kon niet worden gemaakt.', 'fout');
    }
  });

  if (velden.plaats.value === 'selectie' && !selectie.length) velden.plaats.value = 'tekengebied';
  else if (selectie.length && !opgeslagen) velden.plaats.value = 'selectie';
  teken();
  velden.voorinstelling.focus();
}

vexel.opCommando('maken', toonVenster);
