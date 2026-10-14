// Rolcirkels: lijnen van een wieltje dat binnen of buiten een ring rolt, in lagen, als gladde krommen.
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
// Elke laag krijgt een kleur op het verloop door de paletkleuren (gemengd in CMYK).

const PALETTEN = {
  zonsondergang: { naam: 'Zonsondergang', kleuren: [[75, 100, 20, 15], [10, 95, 30, 0], [0, 60, 90, 0], [0, 20, 90, 0]] },
  oceaan: { naam: 'Oceaan', kleuren: [[100, 80, 25, 30], [90, 20, 30, 5], [55, 0, 25, 0]] },
  pauw: { naam: 'Pauw', kleuren: [[90, 30, 45, 15], [70, 85, 0, 0], [0, 85, 30, 0]] },
  regenboog: { naam: 'Regenboog', kleuren: [[0, 85, 80, 0], [0, 45, 95, 0], [10, 0, 85, 0], [70, 0, 50, 0], [85, 45, 0, 0], [65, 85, 0, 0]] },
  goud: { naam: 'Goud en brons', kleuren: [[25, 55, 95, 30], [10, 30, 95, 5], [5, 10, 70, 0]] },
  inkt: { naam: 'Inkt', kleuren: [[75, 65, 55, 90], [60, 45, 40, 50]] },
  roze: { naam: 'Roze en mint', kleuren: [[0, 70, 20, 0], [0, 35, 10, 0], [45, 0, 30, 0]] },
};

function kleurOpVerloop(palet, t) {
  const k = palet.kleuren;
  if (k.length === 1) return k[0].slice();
  const plek = begrens(t, 0, 1) * (k.length - 1);
  const i = Math.min(k.length - 2, Math.floor(plek));
  const f = plek - i;
  return k[i].map((v, j) => Math.round((v + (k[i + 1][j] - v) * f) * 10) / 10);
}

// ---- de kromme ------------------------------------------------------------

const ggd = (a, b) => (b ? ggd(b, a % b) : a);

/**
 * Voorinstellingen: ring (R tanden), wiel (r tanden), pen (d in % van het wiel) en de lagen.
 * Met hele tandaantallen sluit de kromme altijd.
 */
const VOORINSTELLINGEN = {
  bloem: { naam: 'Bloem', soort: 'binnen', ring: 96, wiel: 60, pen: 85, lagen: 8, draai: 5.6, verloop: 0, krimp: 0, weergave: 'lijnen', palet: 'zonsondergang' },
  kant: { naam: 'Kant', soort: 'buiten', ring: 60, wiel: 25, pen: 70, lagen: 6, draai: 0, verloop: 9, krimp: 0, weergave: 'lijnen', palet: 'oceaan' },
  wervel: { naam: 'Wervel', soort: 'binnen', ring: 120, wiel: 45, pen: 100, lagen: 16, draai: 1.4, verloop: 0, krimp: 3, weergave: 'vlakken', palet: 'oceaan' },
  kompas: { naam: 'Kompasroos', soort: 'binnen', ring: 144, wiel: 54, pen: 95, lagen: 12, draai: 0, verloop: 0, krimp: 6, weergave: 'vlakken', palet: 'regenboog' },
  schelp: { naam: 'Schelp', soort: 'buiten', ring: 84, wiel: 36, pen: 100, lagen: 10, draai: 3, verloop: 6, krimp: 0, weergave: 'lijnen', palet: 'goud' },
  fijn: { naam: 'Fijn weefsel', soort: 'binnen', ring: 105, wiel: 47, pen: 75, lagen: 3, draai: 1.2, verloop: 0, krimp: 0, weergave: 'lijnen', palet: 'inkt' },
  eigen: { naam: 'Eigen instelling' },
};
const SOORTEN = { binnen: 'Wiel binnen de ring', buiten: 'Wiel buiten de ring' };
const WEERGAVEN = { lijnen: 'Lijnen', vlakken: 'Doorzichtige vlakken', beide: 'Vlakken met lijn' };

const STANDAARD = {
  voorinstelling: 'bloem', ...VOORINSTELLINGEN.bloem, plaats: 'midden', diameter: 120, dikte: 0.6, dekking: 30,
};
delete STANDAARD.naam;

/** Punt en afgeleide (naar t) van de kromme, in tanden-eenheden. */
function trochoide(soort, R, r, d) {
  if (soort === 'buiten') {
    const a = R + r;
    const k = a / r;
    return (t) => ({
      x: a * Math.cos(t) - d * Math.cos(k * t), y: a * Math.sin(t) - d * Math.sin(k * t),
      dx: -a * Math.sin(t) + d * k * Math.sin(k * t), dy: a * Math.cos(t) - d * k * Math.cos(k * t),
    });
  }
  const a = R - r;
  const k = a / r;
  return (t) => ({
    x: a * Math.cos(t) + d * Math.cos(k * t), y: a * Math.sin(t) - d * Math.sin(k * t),
    dx: -a * Math.sin(t) - d * k * Math.sin(k * t), dy: a * Math.cos(t) - d * k * Math.cos(k * t),
  });
}

/** Gegevens van de kromme: symmetrie, omlopen en het grootste bereik vanaf het midden. */
function kenmerken(w) {
  const g = ggd(w.ring, w.wiel);
  const lussen = w.ring / g;
  const omlopen = w.wiel / g;
  const snel = (w.soort === 'buiten' ? w.ring + w.wiel : Math.abs(w.ring - w.wiel)) / g;
  return { g, lussen, omlopen, snel, periode: (2 * Math.PI * w.wiel) / g };
}

/**
 * Benadert één laag met kubische Béziers. De handvatten komen uit de exacte afgeleide
 * (Hermite), en het aantal punten per lus groeit tot het midden van elk stuk minder dan
 * `tol` (pt) van de echte kromme ligt.
 */
function laagPunten(f, schaal, draai, kenm, tol) {
  const c = Math.cos(draai);
  const s = Math.sin(draai);
  const zet = (x, y) => ({ x: (x * c - y * s) * schaal, y: (x * s + y * c) * schaal });
  const basis = kenm.snel + kenm.omlopen;
  let uitkomst = null;
  for (const perLus of [4, 6, 8, 12, 16, 24]) {
    const n = Math.max(8, Math.round(basis * perLus));
    const h = kenm.periode / n;
    const monsters = [];
    for (let i = 0; i < n; i++) monsters.push(f(i * h));
    let fout = 0;
    for (let i = 0; i < n && fout <= tol; i++) {
      const a = monsters[i];
      const b = monsters[(i + 1) % n];
      const m = f((i + 0.5) * h);
      // Het midden van de Bézier: (P0 + 3 C1 + 3 C2 + P1) / 8
      const bx = (a.x + 3 * (a.x + (a.dx * h) / 3) + 3 * (b.x - (b.dx * h) / 3) + b.x) / 8;
      const by = (a.y + 3 * (a.y + (a.dy * h) / 3) + 3 * (b.y - (b.dy * h) / 3) + b.y) / 8;
      fout = Math.max(fout, Math.hypot(bx - m.x, by - m.y) * schaal);
    }
    uitkomst = monsters.map((p) => {
      const q = zet(p.x, p.y);
      const vin = zet(p.x - (p.dx * h) / 3, p.y - (p.dy * h) / 3);
      const vuit = zet(p.x + (p.dx * h) / 3, p.y + (p.dy * h) / 3);
      return { x: q.x, y: q.y, in: vin, uit: vuit };
    });
    if (fout <= tol) break;
  }
  return uitkomst;
}

/** Alle lagen rond (0, 0), in pt; `straal` is de buitenste straal. */
function maakSpiro(w, midden, straal, cmyk) {
  const kenm = kenmerken(w);
  const palet = PALETTEN[w.palet] || PALETTEN.zonsondergang;
  const lagen = [];
  let grootste = 0;
  for (let i = 0; i < w.lagen; i++) {
    const d = Math.max(0, (w.pen / 100) * w.wiel * (1 - (i * w.verloop) / 100));
    const krimp = Math.max(0.02, 1 - (i * w.krimp) / 100);
    const a = w.soort === 'buiten' ? w.ring + w.wiel : Math.abs(w.ring - w.wiel);
    grootste = Math.max(grootste, (a + d) * krimp);
    lagen.push({ d, krimp });
  }
  const schaal = straal / (grootste || 1);
  const kinderen = lagen.map((laag, i) => {
    const f = trochoide(w.soort, w.ring, w.wiel, laag.d);
    const punten = laagPunten(f, schaal * laag.krimp, (i * w.draai * Math.PI) / 180 - Math.PI / 2, kenm, 0.06)
      .map((p) => ({
        x: rond(midden.x + p.x), y: rond(midden.y + p.y),
        in: { x: rond(midden.x + p.in.x), y: rond(midden.y + p.in.y) },
        uit: { x: rond(midden.x + p.uit.x), y: rond(midden.y + p.uit.y) },
      }));
    const t = w.lagen > 1 ? i / (w.lagen - 1) : 0;
    const kleur = alsKleur(kleurOpVerloop(palet, t), cmyk);
    const vorm = { soort: 'pad', naam: `Laag ${i + 1}`, subpaden: [{ gesloten: true, punten }], vulregel: 'evenodd' };
    if (w.weergave === 'lijnen') Object.assign(vorm, { vulling: null, lijn: kleur, lijndikte: w.dikte, lijnhoek: 'round' });
    else if (w.weergave === 'vlakken') Object.assign(vorm, { vulling: kleur, lijn: null, lijndikte: 0, dekking: w.dekking / 100 });
    else Object.assign(vorm, { vulling: kleur, lijn: kleur, lijndikte: w.dikte, lijnhoek: 'round', dekking: w.dekking / 100 });
    return vorm;
  });
  return { vormen: [{ soort: 'groep', naam: `Rolcirkels (${kenm.lussen}-voudig)`, kinderen }], kenm };
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
    soort: keuzeVeld(SOORTEN, w0.soort),
    ring: getalVeld(w0.ring, 2, 400, 1),
    wiel: getalVeld(w0.wiel, 1, 399, 1),
    pen: getalVeld(w0.pen, 0, 300, 5),
    plaats: keuzeVeld({ midden: 'Midden op het tekengebied', selectie: 'In de selectie' }, w0.plaats),
    diameter: getalVeld(w0.diameter, 2, 2000, 5),
    lagen: getalVeld(w0.lagen, 1, 40, 1),
    draai: getalVeld(w0.draai, -180, 180, 0.5),
    verloop: getalVeld(w0.verloop, -50, 50, 1),
    krimp: getalVeld(w0.krimp, 0, 30, 1),
    weergave: keuzeVeld(WEERGAVEN, w0.weergave),
    dekking: getalVeld(w0.dekking, 5, 100, 5),
    dikte: getalVeld(w0.dikte, 0.1, 20, 0.1),
    palet: keuzeVeld(Object.fromEntries(Object.entries(PALETTEN).map(([k, v]) => [k, v.naam])), w0.palet),
  };
  const stalen = maak('span', { 'aria-hidden': 'true', stijl: { display: 'flex', gap: '2px', flex: 'none' } });
  const doek = maak('canvas', { 'aria-hidden': 'true', stijl: { width: '100%', height: '230px', borderRadius: '6px' } });
  const samenvatting = maak('p', { klasse: 'uitleg', 'aria-live': 'polite', stijl: { margin: '0', minHeight: '30px' } });
  const maakKnop = maak('button', { klasse: 'knop primair', type: 'submit', tekst: 'Rolcirkels maken' });
  const annuleer = maak('button', { klasse: 'knop', type: 'button', tekst: 'Annuleren', bijClick: () => vexel.sluit() });

  const diameterRij = regel('Diameter', velden.diameter, 'mm');
  const dekkingRij = regel('Dekking', velden.dekking, '%');
  const dikteRij = regel('Lijndikte', velden.dikte, 'pt');
  const formulier = maak('form', { stijl: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '8px' } },
    doek,
    regel('Voorinstelling', velden.voorinstelling),
    regel('Soort', velden.soort),
    twee(regel('Ring', velden.ring, 'tanden'), regel('Wiel', velden.wiel, 'tanden')),
    twee(regel('Pen', velden.pen, '%'), diameterRij),
    regel('Plaats', velden.plaats),
    twee(regel('Lagen', velden.lagen, ' '), regel('Draai/laag', velden.draai, '°')),
    twee(regel('Pen/laag', velden.verloop, '%'), regel('Krimp/laag', velden.krimp, '%')),
    regel('Weergave', velden.weergave),
    twee(dikteRij, dekkingRij),
    regel('Palet', velden.palet, stalen),
    samenvatting,
    maak('div', { klasse: 'knoppen', stijl: { marginTop: '0' } }, annuleer, maakKnop),
  );
  document.body.append(formulier);

  const instelVelden = ['soort', 'ring', 'wiel', 'pen', 'lagen', 'draai', 'verloop', 'krimp', 'weergave', 'palet'];
  velden.voorinstelling.addEventListener('change', () => {
    const v = VOORINSTELLINGEN[velden.voorinstelling.value];
    if (!v || !v.soort) return;
    for (const k of instelVelden) velden[k].value = String(v[k]);
  });
  for (const k of instelVelden) {
    velden[k].addEventListener('input', () => {
      velden.voorinstelling.value = 'eigen';
    });
  }

  const waarden = () => ({
    voorinstelling: velden.voorinstelling.value,
    soort: velden.soort.value,
    ring: Math.round(begrens(leesGetal(velden.ring, STANDAARD.ring), 2, 400)),
    wiel: Math.round(begrens(leesGetal(velden.wiel, STANDAARD.wiel), 1, 399)),
    pen: begrens(leesGetal(velden.pen, STANDAARD.pen), 0, 300),
    plaats: velden.plaats.value,
    diameter: begrens(leesGetal(velden.diameter, STANDAARD.diameter), 2, 2000),
    lagen: Math.round(begrens(leesGetal(velden.lagen, STANDAARD.lagen), 1, 40)),
    draai: begrens(leesGetal(velden.draai, STANDAARD.draai), -180, 180),
    verloop: begrens(leesGetal(velden.verloop, 0), -50, 50),
    krimp: begrens(leesGetal(velden.krimp, 0), 0, 30),
    weergave: velden.weergave.value,
    dekking: begrens(leesGetal(velden.dekking, STANDAARD.dekking), 5, 100),
    dikte: begrens(leesGetal(velden.dikte, STANDAARD.dikte), 0.1, 20),
    palet: velden.palet.value,
  });

  function plekVan(w, items) {
    if (w.plaats !== 'selectie') {
      return { midden: { x: doc.tekengebied.b / 2, y: doc.tekengebied.h / 2 }, straal: vexel.mm(w.diameter) / 2 };
    }
    if (!items.length) return { fout: 'Er is niets geselecteerd. Selecteer een vorm, of kies "Midden op het tekengebied" bij Plaats.' };
    const x0 = Math.min(...items.map((o) => o.kader.x));
    const y0 = Math.min(...items.map((o) => o.kader.y));
    const x1 = Math.max(...items.map((o) => o.kader.x + o.kader.b));
    const y1 = Math.max(...items.map((o) => o.kader.y + o.kader.h));
    if (!(x1 - x0 > 2) || !(y1 - y0 > 2)) return { fout: 'De selectie is te klein.' };
    return { midden: { x: (x0 + x1) / 2, y: (y0 + y1) / 2 }, straal: Math.min(x1 - x0, y1 - y0) / 2 };
  }

  function bouw(w, items) {
    if (w.soort === 'binnen' && w.wiel >= w.ring) {
      return { fout: 'Bij een wiel binnen de ring moet het wiel minder tanden hebben dan de ring. Maak het wiel kleiner of kies "Wiel buiten de ring".' };
    }
    const plek = plekVan(w, items);
    if (plek.fout) return plek;
    const kenm = kenmerken(w);
    if ((kenm.snel + kenm.omlopen) * 4 * w.lagen > GRENS.punten) {
      return { fout: `Dit patroon wordt te groot (${kenm.lussen} lussen, ${kenm.omlopen} omlopen per laag). Kies minder lagen, of tandaantallen met een gemeenschappelijke deler.`, plek };
    }
    const uitkomst = maakSpiro(w, plek.midden, plek.straal, cmyk);
    const t = tel(uitkomst.vormen);
    if (t.punten > GRENS.punten) {
      return { fout: `Te veel punten (${getal(t.punten, 0)}, hooguit 50.000). Kies minder lagen of een eenvoudiger verhouding.`, plek };
    }
    return { ...uitkomst, plek, punten: t.punten };
  }

  let gepland = false;
  function teken() {
    gepland = false;
    const w = waarden();
    diameterRij.style.visibility = w.plaats === 'selectie' ? 'hidden' : '';
    dekkingRij.style.visibility = w.weergave === 'lijnen' ? 'hidden' : '';
    dikteRij.style.visibility = w.weergave === 'vlakken' ? 'hidden' : '';
    const palet = PALETTEN[w.palet] || PALETTEN.zonsondergang;
    stalen.replaceChildren(...palet.kleuren.map((c) => maak('span', { stijl: {
      width: '10px', height: '18px', borderRadius: '3px', border: '1px solid var(--lijn)', background: kleurCss({ cmyk: c }) } })));
    const uitkomst = bouw(w, selectie);
    const p = uitkomst.plek && uitkomst.plek.midden ? uitkomst.plek : null;
    const zicht = p ? { x: p.midden.x - p.straal * 1.1, y: p.midden.y - p.straal * 1.1, b: p.straal * 2.2, h: p.straal * 2.2 } : null;
    tekenVoorbeeld(doek, doc, uitkomst.vormen || [], zicht);
    maakKnop.disabled = Boolean(uitkomst.fout) || doc.alleenLezen;
    samenvatting.classList.toggle('fout', Boolean(uitkomst.fout) || doc.alleenLezen);
    if (doc.alleenLezen) samenvatting.textContent = 'Dit document is alleen-lezen: je kunt hier niets aan toevoegen.';
    else if (uitkomst.fout) samenvatting.textContent = uitkomst.fout;
    else {
      const k = uitkomst.kenm;
      const omloop = k.omlopen === 1 ? '1 omloop' : `${k.omlopen} omlopen`;
      samenvatting.textContent = `${k.lussen}-voudig symmetrisch, ${omloop} per laag; ${w.lagen} ${w.lagen === 1 ? 'laag' : 'lagen'}, `
        + `Ø ${getal((p.straal * 2) / vexel.mm(1), 0)} mm, ${getal(uitkomst.punten, 0)} punten.`;
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
      vexel.melding(`Rolcirkels gemaakt: ${uitkomst.kenm.lussen}-voudig, ${w.lagen} ${w.lagen === 1 ? 'laag' : 'lagen'}.`, 'ok');
      vexel.sluit();
    } catch (fout) {
      maakKnop.disabled = false;
      vexel.melding(fout && fout.message ? fout.message : 'De figuur kon niet worden gemaakt.', 'fout');
    }
  });

  if (velden.plaats.value === 'selectie' && !selectie.length) velden.plaats.value = 'midden';
  else if (selectie.length && !opgeslagen) velden.plaats.value = 'selectie';
  teken();
  velden.voorinstelling.focus();
}

vexel.opCommando('maken', toonVenster);
