// Golven: gestapelde golflijnen of gevulde banden met een kleurverloop, als vloeiende krommen.
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

function keuzeVeld(opties, waarde) {
  const veld = maak('select', { klasse: 'veld' },
    ...Object.entries(opties).map(([sleutel, tekst]) => maak('option', { value: sleutel, tekst })));
  veld.value = sleutel(opties, waarde);
  return veld;
}
const sleutel = (opties, waarde) => (Object.prototype.hasOwnProperty.call(opties, waarde) ? waarde : Object.keys(opties)[0]);

/** Een rij met een label links en een of meer velden (met eenheid) rechts. */
function regel(label, ...velden) {
  const rij = maak('label', { klasse: 'rij', stijl: { margin: '0' } }, maak('span', { klasse: 'label', tekst: label }));
  for (const v of velden) {
    if (typeof v === 'string') rij.append(maak('span', { klasse: 'uitleg', tekst: v, stijl: { flex: 'none' } }));
    else rij.append(v);
  }
  return rij;
}

// ---- kleur ----------------------------------------------------------------
// Een eenvoudige omrekening zonder kleurprofiel, alleen voor het voorbeeld.

const rgbVanCmyk = ([c, m, y, k]) => {
  const z = 1 - k / 100;
  return [255 * (1 - c / 100) * z, 255 * (1 - m / 100) * z, 255 * (1 - y / 100) * z].map(Math.round);
};
const hexVanRgb = (rgb) => '#' + rgb.map((n) => begrens(Math.round(n), 0, 255).toString(16).padStart(2, '0')).join('');
const kleurCss = (kleur) => (!kleur ? 'transparent' : kleur.hex || hexVanRgb(rgbVanCmyk(kleur.cmyk)));

const rgbVanHex = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** Meng twee kleuren van dezelfde soort; t van 0 tot 1. */
function mengKleur(a, b, t) {
  if (a.cmyk && b.cmyk) return { cmyk: a.cmyk.map((v, i) => Math.round((v + (b.cmyk[i] - v) * t) * 10) / 10) };
  const ra = a.hex ? rgbVanHex(a.hex) : rgbVanCmyk(a.cmyk);
  const rb = b.hex ? rgbVanHex(b.hex) : rgbVanCmyk(b.cmyk);
  return { hex: hexVanRgb(ra.map((v, i) => v + (rb[i] - v) * t)) };
}

/**
 * Een kleurkeuze: een lijst met drukkleuren en "Eigen kleur…". In een CMYK-document
 * typ je dan vier getallen (C M Y K), in een RGB-document kies je een kleur.
 */
function kleurKiezer(kleuren, bewaard, cmyk) {
  const lijst = { ...Object.fromEntries(Object.entries(kleuren).map(([k, v]) => [k, v.naam])), eigen: 'Eigen kleur…' };
  const keuze = keuzeVeld(lijst, bewaard && bewaard.keuze);
  const staal = maak('span', { 'aria-hidden': 'true', stijl: {
    flex: 'none', width: '18px', height: '18px', borderRadius: '4px', border: '1px solid var(--lijn)' } });
  const eigenCmyk = maak('input', { klasse: 'veld', type: 'text', placeholder: 'C M Y K', 'aria-label': 'CMYK, vier getallen',
    value: (bewaard && bewaard.cmyk ? bewaard.cmyk : [0, 0, 0, 100]).join(' '), stijl: { maxWidth: '110px' } });
  const eigenRgb = maak('input', { type: 'color', 'aria-label': 'Eigen kleur', value: (bewaard && bewaard.hex) || '#1a1a1a',
    stijl: { flex: 'none', width: '34px', height: '26px', padding: '0', border: '1px solid var(--lijn)', background: 'none' } });
  const eigen = cmyk ? eigenCmyk : eigenRgb;
  const veld = maak('span', { stijl: { display: 'flex', gap: '6px', alignItems: 'center', flex: '1', minWidth: '0' } }, keuze, eigen, staal);

  function lees() {
    if (keuze.value !== 'eigen') {
      const k = kleuren[keuze.value];
      return cmyk ? { cmyk: k.cmyk.slice() } : { hex: hexVanRgb(rgbVanCmyk(k.cmyk)) };
    }
    if (!cmyk) return { hex: eigenRgb.value.toLowerCase() };
    const delen = eigenCmyk.value.replace(/[,;%]/g, ' ').trim().split(/ +/).map(Number);
    if (delen.length !== 4 || delen.some((n) => !Number.isFinite(n))) return null;
    return { cmyk: delen.map((n) => begrens(n, 0, 100)) };
  }
  function bij() {
    eigen.style.display = keuze.value === 'eigen' ? '' : 'none';
    const k = lees();
    staal.style.background = k ? kleurCss(k) : 'transparent';
  }
  veld.addEventListener('input', bij);
  veld.addEventListener('change', bij);
  bij();
  return {
    veld,
    lees,
    zet: (waarde) => {
      keuze.value = sleutel(lijst, waarde && waarde.keuze);
      if (waarde && waarde.cmyk) eigenCmyk.value = waarde.cmyk.join(' ');
      if (waarde && waarde.hex) eigenRgb.value = waarde.hex;
      bij();
    },
    bewaar: () => ({ keuze: keuze.value, cmyk: cmyk && lees() ? lees().cmyk : bewaard && bewaard.cmyk, hex: !cmyk ? eigenRgb.value : bewaard && bewaard.hex }),
  };
}

// ---- willekeur met een zaadje ---------------------------------------------

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

// ---- tellen en opdelen ----------------------------------------------------

function tel(vormen) {
  let vormenAantal = 0;
  let punten = 0;
  const loop = (v) => {
    vormenAantal++;
    if (v.kinderen) v.kinderen.forEach(loop);
    if (v.subpaden) for (const s of v.subpaden) punten += s.punten.length;
    if (v.soort === 'ellips' || v.soort === 'rechthoek') punten += 4;
  };
  vormen.forEach(loop);
  return { vormen: vormenAantal, punten };
}

const GRENS = { vormen: 5000, punten: 50000, subpaden: 1000 };
// ---- voorbeeld op een canvas ----------------------------------------------

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

/**
 * Tekent het tekengebied (wit vel) met de vormen erop, passend in het canvas.
 * `zicht` is het stuk dat in beeld moet (in pt), standaard het hele tekengebied.
 */
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
  const loop = (v, dekking) => {
    if (v.soort === 'groep') return v.kinderen.forEach((k) => loop(k, dekking));
    let p;
    if (v.soort === 'pad') p = padVanSubpaden(v.subpaden, sx, ox, oy);
    else if (v.soort === 'rechthoek') {
      p = new Path2D();
      p.rect(ox + v.x * sx, oy + v.y * sx, v.b * sx, v.h * sx);
    } else if (v.soort === 'ellips') {
      p = new Path2D();
      p.ellipse(ox + v.cx * sx, oy + v.cy * sx, v.rx * sx, v.ry * sx, 0, 0, Math.PI * 2);
    } else return;
    g.globalAlpha = dekking * (v.dekking === undefined ? 1 : v.dekking);
    if (v.vulling) {
      g.fillStyle = kleurCss(v.vulling);
      g.fill(p);
    }
    if (v.lijn && v.lijndikte > 0) {
      g.strokeStyle = kleurCss(v.lijn);
      // Heel dunne lijnen: een halve pixel breed, maar met minder dekking, zodat het vlak klopt.
      const breedte = v.lijndikte * sx;
      g.lineWidth = Math.max(0.5, breedte);
      if (breedte < 0.5) g.globalAlpha *= Math.max(0.15, breedte / 0.5);
      g.lineJoin = 'round';
      g.stroke(p);
    }
    g.globalAlpha = 1;
  };
  vormen.forEach((v) => loop(v, 1));
  // De rand van het tekengebied: wat erbuiten valt, is afloop.
  g.strokeStyle = vexel.thema.accent;
  g.globalAlpha = 0.9;
  g.lineWidth = 1;
  g.setLineDash([3, 3]);
  g.strokeRect(ox + 0.5, oy + 0.5, tg.b * sx - 1, tg.h * sx - 1);
  g.setLineDash([]);
  g.globalAlpha = 1;
}

// ---- de golven ------------------------------------------------------------

const KLEUREN = {
  nacht: { naam: 'Nachtblauw', cmyk: [100, 80, 20, 40] },
  blauw: { naam: 'Diepblauw', cmyk: [100, 70, 0, 10] },
  zee: { naam: 'Zeegroen', cmyk: [75, 0, 35, 10] },
  hemel: { naam: 'Hemelsblauw', cmyk: [45, 5, 0, 0] },
  mint: { naam: 'Mint', cmyk: [30, 0, 22, 0] },
  zand: { naam: 'Zand', cmyk: [0, 10, 30, 5] },
  geel: { naam: 'Geel', cmyk: [0, 12, 85, 0] },
  oranje: { naam: 'Oranje', cmyk: [0, 60, 95, 0] },
  koraal: { naam: 'Koraal', cmyk: [0, 65, 50, 0] },
  roze: { naam: 'Roze', cmyk: [0, 35, 10, 0] },
  paars: { naam: 'Paars', cmyk: [70, 90, 0, 10] },
  groen: { naam: 'Bosgroen', cmyk: [85, 20, 85, 35] },
  grijs: { naam: 'Lichtgrijs', cmyk: [0, 0, 0, 15] },
  zwart: { naam: 'Zwart', cmyk: [0, 0, 0, 100] },
  wit: { naam: 'Wit', cmyk: [0, 0, 0, 0] },
};

const WEERGAVEN = { banden: 'Gevulde banden', lijnen: 'Lijnen' };
const RICHTINGEN = { liggend: 'Liggend', staand: 'Staand' };

const STANDAARD = {
  gebied: 'tekengebied', afloop: 3, weergave: 'banden', richting: 'liggend', lijnen: 14, golflengte: 140, amplitude: 9,
  ruis: 45, fase: 14, zaad: 2718, dikte: 0.75, kleur1: { keuze: 'hemel' }, kleur2: { keuze: 'nacht' },
};

/** Vloeiende ruis in twee richtingen (waarderuis met zachte overgangen), van -1 tot 1. */
function maakRuis(zaad) {
  const kans = willekeur(zaad);
  const tabel = Array.from({ length: 256 }, () => kans() * 2 - 1);
  const volgorde = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(kans() * (i + 1));
    [volgorde[i], volgorde[j]] = [volgorde[j], volgorde[i]];
  }
  const waarde = (x, y) => tabel[volgorde[(volgorde[x & 255] + y) & 255]];
  const zacht = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const laag = (x, y) => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = zacht(x - x0);
    const fy = zacht(y - y0);
    const a = waarde(x0, y0) + (waarde(x0 + 1, y0) - waarde(x0, y0)) * fx;
    const b = waarde(x0, y0 + 1) + (waarde(x0 + 1, y0 + 1) - waarde(x0, y0 + 1)) * fx;
    return a + (b - a) * fy;
  };
  return (x, y) => (laag(x, y) * 0.7 + laag(x * 2.1 + 17, y * 2.1 + 31) * 0.3) / 0.85;
}

/** Een vloeiende kromme door de punten: handvatten zoals bij een Catmull-Rom-spline. */
function kromme(punten) {
  const n = punten.length;
  return punten.map((p, i) => {
    const vorige = punten[Math.max(0, i - 1)];
    const volgende = punten[Math.min(n - 1, i + 1)];
    const deler = i === 0 || i === n - 1 ? 3 : 6;
    const tx = (volgende.x - vorige.x) / deler;
    const ty = (volgende.y - vorige.y) / deler;
    const q = { x: p.x, y: p.y };
    if (i > 0) q.in = { x: p.x - tx, y: p.y - ty };
    if (i < n - 1) q.uit = { x: p.x + tx, y: p.y + ty };
    return q;
  });
}

/** Dezelfde kromme achterstevoren: in en uit wisselen. */
const omgekeerd = (k) => k.slice().reverse().map((p) => {
  const q = { x: p.x, y: p.y };
  if (p.uit) q.in = p.uit;
  if (p.in) q.uit = p.in;
  return q;
});

/**
 * Rekent de golflijnen uit in een "liggend" stelsel: x loopt langs de golf, y dwars erop.
 * Geeft per lijn een lijst punten { x, y }.
 */
function golflijnen(w, vak, aantal) {
  const ruis = maakRuis(w.zaad);
  const lambda = vexel.mm(w.golflengte);
  const A = vexel.mm(w.amplitude);
  const stappen = Math.max(8, Math.min(400, Math.ceil(vak.b / (lambda / 10))));
  const tussen = vak.h / (aantal + (w.weergave === 'banden' ? 1 : 0));
  const r = w.ruis / 100;
  const lijnen = [];
  for (let i = 0; i < aantal; i++) {
    const basis = vak.y + tussen * (i + (w.weergave === 'banden' ? 1 : 0.5));
    const fase = (i * w.fase * Math.PI) / 180;
    const punten = [];
    for (let k = 0; k <= stappen; k++) {
      const x = vak.x + (vak.b * k) / stappen;
      const golf = Math.sin((2 * Math.PI * (x - vak.x)) / lambda + fase);
      const n = ruis((x - vak.x) / lambda * 1.6, basis / lambda * 1.2 + 0.37);
      let y = basis + A * ((1 - r) * golf + r * 1.6 * n);
      // Lijnen mogen elkaar niet kruisen.
      if (i > 0) y = Math.max(y, lijnen[i - 1][k].y + tussen * 0.12);
      punten.push({ x, y });
    }
    lijnen.push(punten);
  }
  // Binnen het vak houden (alleen nodig bij grote uitslagen).
  for (const lijn of lijnen) for (const p of lijn) p.y = begrens(p.y, vak.y, vak.y + vak.h);
  return lijnen;
}

/** Alle vormen; `vak` is het gebied in pt. */
function maakGolven(w, vak, k1, k2) {
  const staand = w.richting === 'staand';
  // Staand: x en y omwisselen, zodat de golven van boven naar onder lopen.
  const wissel = (p) => (staand ? { x: p.y, y: p.x } : p);
  const wisselPunt = (p) => {
    const q = wissel(p);
    if (p.in) q.in = wissel(p.in);
    if (p.uit) q.uit = wissel(p.uit);
    return q;
  };
  const v = staand ? { x: vak.y, y: vak.x, b: vak.h, h: vak.b } : vak;
  const lijnen = golflijnen(w, v, w.lijnen).map(kromme);
  const kinderen = [];
  if (w.weergave === 'lijnen') {
    lijnen.forEach((lijn, i) => {
      const t = w.lijnen > 1 ? i / (w.lijnen - 1) : 0;
      kinderen.push({
        soort: 'pad', naam: `Lijn ${i + 1}`, subpaden: [{ gesloten: false, punten: lijn.map(wisselPunt) }],
        vulling: null, lijn: mengKleur(k1, k2, t), lijndikte: w.dikte, lijneinde: 'butt', lijnhoek: 'round',
      });
    });
  } else {
    const rand = (y) => [{ x: v.x, y }, { x: v.x + v.b, y }];
    const randen = [rand(v.y), ...lijnen, rand(v.y + v.h)];
    for (let i = 0; i < randen.length - 1; i++) {
      const t = i / (randen.length - 2);
      const punten = [...randen[i], ...omgekeerd(randen[i + 1])].map(wisselPunt);
      kinderen.push({ soort: 'pad', naam: `Band ${i + 1}`, subpaden: [{ gesloten: true, punten }], vulling: mengKleur(k1, k2, t), lijn: null, lijndikte: 0 });
    }
  }
  return [{ soort: 'groep', naam: `Golven (${w.lijnen} ${w.weergave === 'lijnen' ? 'lijnen' : 'banden'})`, kinderen }];
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
    gebied: keuzeVeld({ tekengebied: 'Tekengebied', selectie: 'Selectie (het kader)' }, w0.gebied),
    afloop: getalVeld(w0.afloop, 0, 20, 0.5),
    weergave: keuzeVeld(WEERGAVEN, w0.weergave),
    richting: keuzeVeld(RICHTINGEN, w0.richting),
    lijnen: getalVeld(w0.lijnen, 1, 200, 1),
    golflengte: getalVeld(w0.golflengte, 5, 2000, 5),
    amplitude: getalVeld(w0.amplitude, 0, 500, 1),
    ruis: getalVeld(w0.ruis, 0, 100, 5),
    fase: getalVeld(w0.fase, -180, 180, 1),
    zaad: getalVeld(w0.zaad, 1, 999999, 1),
    dikte: getalVeld(w0.dikte, 0.1, 20, 0.05),
  };
  const kleur1 = kleurKiezer(KLEUREN, w0.kleur1, cmyk);
  const kleur2 = kleurKiezer(KLEUREN, w0.kleur2, cmyk);
  const anders = maak('button', { klasse: 'knop', type: 'button', tekst: 'Anders', title: 'Een ander zaadje: dezelfde instellingen, een andere golf',
    stijl: { flex: 'none' },
    bijClick: () => {
      velden.zaad.value = String(1 + Math.floor(Math.random() * 999998));
      plan();
    } });

  const doek = maak('canvas', { 'aria-hidden': 'true', stijl: { width: '100%', height: '170px' } });
  const samenvatting = maak('p', { klasse: 'uitleg', 'aria-live': 'polite', stijl: { margin: '0', minHeight: '32px' } });
  const maakKnop = maak('button', { klasse: 'knop primair', type: 'submit', tekst: 'Golven maken' });
  const annuleer = maak('button', { klasse: 'knop', type: 'button', tekst: 'Annuleren', bijClick: () => vexel.sluit() });

  const afloopRij = regel('Afloop', velden.afloop, 'mm');
  const dikteRij = regel('Lijndikte', velden.dikte, 'pt');
  const formulier = maak('form', { stijl: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '8px' } },
    doek,
    regel('Vullen', velden.gebied),
    afloopRij,
    regel('Weergave', velden.weergave),
    regel('Richting', velden.richting),
    regel('Aantal lijnen', velden.lijnen),
    regel('Golflengte', velden.golflengte, 'mm'),
    regel('Uitslag', velden.amplitude, 'mm'),
    regel('Ruis', velden.ruis, '%'),
    regel('Verspringen', velden.fase, '° per lijn'),
    regel('Zaadje', velden.zaad, anders),
    dikteRij,
    regel('Kleur van', kleur1.veld),
    regel('Kleur naar', kleur2.veld),
    samenvatting,
    maak('div', { klasse: 'knoppen', stijl: { marginTop: '0' } }, annuleer, maakKnop),
  );
  document.body.append(formulier);

  const waarden = () => ({
    gebied: velden.gebied.value,
    afloop: begrens(leesGetal(velden.afloop, 3), 0, 20),
    weergave: velden.weergave.value,
    richting: velden.richting.value,
    lijnen: Math.round(begrens(leesGetal(velden.lijnen, 14), 1, 200)),
    golflengte: begrens(leesGetal(velden.golflengte, 140), 5, 2000),
    amplitude: begrens(leesGetal(velden.amplitude, 9), 0, 500),
    ruis: begrens(leesGetal(velden.ruis, 45), 0, 100),
    fase: begrens(leesGetal(velden.fase, 14), -180, 180),
    zaad: Math.round(begrens(leesGetal(velden.zaad, 1), 1, 999999)),
    dikte: begrens(leesGetal(velden.dikte, 0.75), 0.1, 20),
    kleur1: kleur1.bewaar(),
    kleur2: kleur2.bewaar(),
  });

  const gebiedVan = (w, items) => {
    if (w.gebied !== 'selectie') {
      const a = vexel.mm(w.afloop);
      return { x: -a, y: -a, b: doc.tekengebied.b + 2 * a, h: doc.tekengebied.h + 2 * a };
    }
    if (!items.length) return { fout: 'Er is niets geselecteerd. Selecteer een vorm, of kies "Tekengebied" bij Vullen.' };
    const x0 = Math.min(...items.map((o) => o.kader.x));
    const y0 = Math.min(...items.map((o) => o.kader.y));
    const x1 = Math.max(...items.map((o) => o.kader.x + o.kader.b));
    const y1 = Math.max(...items.map((o) => o.kader.y + o.kader.h));
    if (!(x1 - x0 > 1) || !(y1 - y0 > 1)) return { fout: 'De selectie is te klein om te vullen.' };
    return { x: x0, y: y0, b: x1 - x0, h: y1 - y0 };
  };

  function bouw(w, items) {
    const k1 = kleur1.lees();
    const k2 = kleur2.lees();
    if (!k1 || !k2) return { fout: 'Een eigen kleur is niet goed: typ vier getallen van 0 tot 100, zoals 60 0 20 0.' };
    const gebied = gebiedVan(w, items);
    if (gebied.fout) return gebied;
    const vormen = maakGolven(w, gebied, k1, k2);
    const t = tel(vormen);
    if (t.punten > GRENS.punten) {
      return { fout: `Te veel punten (${getal(t.punten, 0)}). Kies minder lijnen of een langere golf.`, gebied };
    }
    return { vormen, gebied, punten: t.punten };
  }

  let gepland = false;
  function teken() {
    gepland = false;
    const w = waarden();
    afloopRij.style.display = w.gebied === 'selectie' ? 'none' : '';
    dikteRij.style.display = w.weergave === 'lijnen' ? '' : 'none';
    const uitkomst = bouw(w, selectie);
    const g = uitkomst.gebied;
    const zicht = !g ? null : {
      x: Math.min(0, g.x), y: Math.min(0, g.y),
      b: Math.max(doc.tekengebied.b, g.x + g.b) - Math.min(0, g.x),
      h: Math.max(doc.tekengebied.h, g.y + g.h) - Math.min(0, g.y),
    };
    tekenVoorbeeld(doek, doc, uitkomst.vormen || [], zicht);
    maakKnop.disabled = Boolean(uitkomst.fout) || doc.alleenLezen;
    samenvatting.classList.toggle('fout', Boolean(uitkomst.fout));
    if (doc.alleenLezen) samenvatting.textContent = 'Dit document is alleen-lezen: je kunt hier niets aan toevoegen.';
    else if (uitkomst.fout) samenvatting.textContent = uitkomst.fout;
    else {
      const wat = w.weergave === 'lijnen' ? `${w.lijnen} golflijnen` : `${w.lijnen + 1} banden`;
      samenvatting.textContent = `${wat}, elk een eigen tint, als vloeiende krommen (${getal(uitkomst.punten, 0)} punten).`;
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
      await vexel.maak(uitkomst.vormen);
      await vexel.bewaar('instellingen', w);
      vexel.melding(`Golven gemaakt: ${uitkomst.vormen[0].kinderen.length} ${w.weergave === 'lijnen' ? 'lijnen' : 'banden'}.`, 'ok');
      vexel.sluit();
    } catch (fout) {
      maakKnop.disabled = false;
      vexel.melding(fout && fout.message ? fout.message : 'De golven konden niet worden gemaakt.', 'fout');
    }
  });

  if (velden.gebied.value === 'selectie' && !selectie.length) velden.gebied.value = 'tekengebied';
  else if (selectie.length && !opgeslagen) velden.gebied.value = 'selectie';
  teken();
  velden.lijnen.focus();
  velden.lijnen.select();
}

vexel.opCommando('maken', toonVenster);
