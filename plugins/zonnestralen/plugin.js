// Zonnestralen: stralen in twee kleuren vanuit een middelpunt, tot in de afloop.
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

// ---- het gebied -----------------------------------------------------------

/** Het tekengebied plus afloop, of het kader van de selectie. */
async function leesGebied(soort, doc, afloopMm) {
  if (soort === 'selectie') {
    const items = await vexel.selectie();
    if (!items.length) return { fout: 'Er is niets geselecteerd. Selecteer een vorm, of kies "Tekengebied" bij Vullen.' };
    const x0 = Math.min(...items.map((o) => o.kader.x));
    const y0 = Math.min(...items.map((o) => o.kader.y));
    const x1 = Math.max(...items.map((o) => o.kader.x + o.kader.b));
    const y1 = Math.max(...items.map((o) => o.kader.y + o.kader.h));
    if (!(x1 - x0 > 1) || !(y1 - y0 > 1)) return { fout: 'De selectie is te klein om te vullen.' };
    return { x: x0, y: y0, b: x1 - x0, h: y1 - y0, items };
  }
  const a = vexel.mm(afloopMm);
  return { x: -a, y: -a, b: doc.tekengebied.b + 2 * a, h: doc.tekengebied.h + 2 * a };
}

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

const naarMm = (pt) => pt / vexel.mm(1);

// ---- de stralen -----------------------------------------------------------

const STANDAARD = {
  gebied: 'tekengebied', afloop: 3, stralen: 24, breedte: 50, middelpunt: 'midden', mx: 50, my: 50, draaiing: 0,
  kleur1: { keuze: 'oker' }, kleur2: { keuze: 'geel' }, kern: 'zacht', kernMaat: 22, kernKleur: { keuze: 'creme' },
};

const KLEUREN = {
  geel: { naam: 'Geel', cmyk: [0, 12, 85, 0] },
  oker: { naam: 'Oker', cmyk: [0, 32, 90, 0] },
  oranje: { naam: 'Oranje', cmyk: [0, 60, 95, 0] },
  rood: { naam: 'Rood', cmyk: [0, 90, 85, 0] },
  roze: { naam: 'Roze', cmyk: [0, 45, 12, 0] },
  lila: { naam: 'Lila', cmyk: [30, 40, 0, 0] },
  hemel: { naam: 'Hemelsblauw', cmyk: [50, 8, 0, 0] },
  blauw: { naam: 'Diepblauw', cmyk: [100, 70, 0, 10] },
  mint: { naam: 'Mint', cmyk: [40, 0, 30, 0] },
  groen: { naam: 'Groen', cmyk: [80, 0, 70, 10] },
  creme: { naam: 'Crème', cmyk: [0, 4, 22, 0] },
  wit: { naam: 'Wit', cmyk: [0, 0, 0, 0] },
  grijs: { naam: 'Lichtgrijs', cmyk: [0, 0, 0, 12] },
  donker: { naam: 'Donkergrijs', cmyk: [0, 0, 0, 80] },
  zwart: { naam: 'Zwart', cmyk: [0, 0, 0, 100] },
};

const MIDDELPUNTEN = {
  midden: 'Midden', onder: 'Midden onder', boven: 'Midden boven', links: 'Links midden', rechts: 'Rechts midden',
  linksboven: 'Linksboven', rechtsboven: 'Rechtsboven', linksonder: 'Linksonder', rechtsonder: 'Rechtsonder', eigen: 'Eigen plek…',
};
const PLEKKEN = {
  midden: [50, 50], onder: [50, 100], boven: [50, 0], links: [0, 50], rechts: [100, 50],
  linksboven: [0, 0], rechtsboven: [100, 0], linksonder: [0, 100], rechtsonder: [100, 100],
};
const KERNEN = { geen: 'Geen', scherp: 'Scherp', zacht: 'Zacht' };

/** Knipt een veelhoek af op een rechthoek (alle hoeken binnen blijven, de rest valt weg). */
function knipVeelhoek(punten, r) {
  const randen = [
    (p) => p.x >= r.x, (p) => p.x <= r.x + r.b, (p) => p.y >= r.y, (p) => p.y <= r.y + r.h,
  ];
  const snij = [
    (a, b) => ({ x: r.x, y: a.y + ((b.y - a.y) * (r.x - a.x)) / (b.x - a.x) }),
    (a, b) => ({ x: r.x + r.b, y: a.y + ((b.y - a.y) * (r.x + r.b - a.x)) / (b.x - a.x) }),
    (a, b) => ({ x: a.x + ((b.x - a.x) * (r.y - a.y)) / (b.y - a.y), y: r.y }),
    (a, b) => ({ x: a.x + ((b.x - a.x) * (r.y + r.h - a.y)) / (b.y - a.y), y: r.y + r.h }),
  ];
  let uit = punten;
  for (let k = 0; k < 4 && uit.length; k++) {
    const invoer = uit;
    uit = [];
    for (let i = 0; i < invoer.length; i++) {
      const a = invoer[(i + invoer.length - 1) % invoer.length];
      const b = invoer[i];
      const aIn = randen[k](a);
      const bIn = randen[k](b);
      if (bIn) {
        if (!aIn) uit.push(snij[k](a, b));
        uit.push(b);
      } else if (aIn) uit.push(snij[k](a, b));
    }
  }
  // Punten die vrijwel samenvallen, eruit.
  return uit.filter((p, i) => {
    const q = uit[(i + uit.length - 1) % uit.length];
    return uit.length < 2 || Math.hypot(p.x - q.x, p.y - q.y) > 0.01;
  });
}

function cirkelVeelhoek(cx, cy, r, n = 160) {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  });
}

/** Een cirkel als ellips als hij helemaal binnen valt, anders als afgeknipt pad (of null). */
function cirkel(cx, cy, r, knip, stijl, naam) {
  if (cx - r >= knip.x && cy - r >= knip.y && cx + r <= knip.x + knip.b && cy + r <= knip.y + knip.h) {
    return { soort: 'ellips', naam, cx, cy, rx: r, ry: r, ...stijl };
  }
  const punten = knipVeelhoek(cirkelVeelhoek(cx, cy, r), knip);
  return punten.length >= 3 ? { soort: 'pad', naam, subpaden: [{ gesloten: true, punten }], ...stijl } : null;
}

/** Alle vormen voor de zonnestralen. `basis` bepaalt het middelpunt, `knip` wat gevuld wordt. */
function maakStralen(w, basis, knip, kleuren) {
  const [px, py] = w.middelpunt === 'eigen' ? [w.mx, w.my] : PLEKKEN[w.middelpunt];
  const cx = basis.x + (basis.b * px) / 100;
  const cy = basis.y + (basis.h * py) / 100;
  const hoeken = [[knip.x, knip.y], [knip.x + knip.b, knip.y], [knip.x, knip.y + knip.h], [knip.x + knip.b, knip.y + knip.h]];
  const verst = Math.max(...hoeken.map(([x, y]) => Math.hypot(x - cx, y - cy)));
  const stap = (4 * Math.PI) / 180;
  const R = (verst * 1.05) / Math.cos(stap / 2);

  const paar = (Math.PI * 2) / (w.stralen / 2);
  const breed = paar * (w.breedte / 100);
  const subpaden = [];
  for (let k = 0; k < w.stralen / 2; k++) {
    const a0 = (w.draaiing * Math.PI) / 180 - Math.PI / 2 + k * paar - breed / 2;
    const n = Math.max(1, Math.ceil(breed / stap));
    const punten = [{ x: cx, y: cy }];
    for (let i = 0; i <= n; i++) {
      const a = a0 + (breed * i) / n;
      punten.push({ x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) });
    }
    const geknipt = knipVeelhoek(punten, knip);
    if (geknipt.length >= 3) subpaden.push({ gesloten: true, punten: geknipt });
  }

  const vlak = (kleur) => ({ vulling: kleur, lijn: null, lijndikte: 0 });
  const kinderen = [{ soort: 'rechthoek', naam: 'Achtergrond', x: knip.x, y: knip.y, b: knip.b, h: knip.h, ...vlak(kleuren.tussen) }];
  if (subpaden.length) kinderen.push({ soort: 'pad', naam: `Stralen (${w.stralen / 2})`, subpaden, ...vlak(kleuren.stralen) });

  if (w.kern !== 'geen' && w.kernMaat > 0) {
    const r = (Math.min(basis.b, basis.h) * w.kernMaat) / 200;
    const kern = [];
    if (w.kern === 'zacht') {
      // Geen verloop in de API: een stapel ringen met weinig dekking geeft een zachte rand.
      const lagen = 24;
      for (let i = 0; i < lagen; i++) {
        const t = i / lagen;
        const ri = r * (1 + 1.5 * (1 - t) * (1 - t));
        const v = cirkel(cx, cy, ri, knip, { ...vlak(kleuren.kern), dekking: 0.07 }, `Gloed ${i + 1}`);
        if (v) kern.push(v);
      }
    }
    const hart = cirkel(cx, cy, r, knip, vlak(kleuren.kern), 'Kern');
    if (hart) kern.push(hart);
    if (kern.length === 1) kinderen.push(kern[0]);
    else if (kern.length) kinderen.push({ soort: 'groep', naam: 'Kern', kinderen: kern });
  }
  return [{ soort: 'groep', naam: `Zonnestralen ${w.stralen}`, kinderen }];
}

// ---- het venster ----------------------------------------------------------

async function toonVenster() {
  const doc = await vexel.document();
  const cmyk = doc.kleurruimte === 'cmyk';
  const w0 = { ...STANDAARD, ...((await vexel.haal('instellingen')) || {}) };
  let selectie = [];
  try {
    selectie = await vexel.selectie();
  } catch (fout) {
    selectie = [];
  }

  const velden = {
    gebied: keuzeVeld({ tekengebied: 'Tekengebied', selectie: 'Selectie' }, w0.gebied),
    afloop: getalVeld(w0.afloop, 0, 20, 0.5),
    stralen: getalVeld(w0.stralen, 4, 240, 2),
    breedte: getalVeld(w0.breedte, 10, 90, 5, 'Breedte van de stralen in procent'),
    middelpunt: keuzeVeld(MIDDELPUNTEN, w0.middelpunt),
    mx: getalVeld(w0.mx, -100, 200, 5),
    my: getalVeld(w0.my, -100, 200, 5, 'Plek y in procent'),
    draaiing: getalVeld(w0.draaiing, -360, 360, 1),
    kern: keuzeVeld(KERNEN, w0.kern),
    kernMaat: getalVeld(w0.kernMaat, 1, 200, 1, 'Doorsnede van de kern in procent'),
  };
  const kleurStralen = kleurKiezer(KLEUREN, w0.kleur2, cmyk);
  const kleurTussen = kleurKiezer(KLEUREN, w0.kleur1, cmyk);
  const kleurKern = kleurKiezer(KLEUREN, w0.kernKleur, cmyk);

  const doek = maak('canvas', { 'aria-hidden': 'true', stijl: { width: '100%', height: '168px' } });
  const samenvatting = maak('p', { klasse: 'uitleg', 'aria-live': 'polite', stijl: { margin: '0', minHeight: '32px' } });
  const maakKnop = maak('button', { klasse: 'knop primair', type: 'submit', tekst: 'Stralen maken' });
  const annuleer = maak('button', { klasse: 'knop', type: 'button', tekst: 'Annuleren', bijClick: () => vexel.sluit() });

  const afloopRij = regel('Afloop', velden.afloop, 'mm');
  const eigenRij = regel('Plek (x, y)', velden.mx, '%', velden.my, '%');
  const kernRij = regel('Kern', velden.kern, velden.kernMaat, '%');
  const kernKleurRij = regel('Kleur kern', kleurKern.veld);

  const formulier = maak('form', { stijl: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '8px' } },
    doek,
    regel('Vullen', velden.gebied),
    afloopRij,
    regel('Stralen', velden.stralen, 'breedte', velden.breedte, '%'),
    regel('Middelpunt', velden.middelpunt),
    eigenRij,
    regel('Draaiing', velden.draaiing, '°'),
    regel('Kleur stralen', kleurStralen.veld),
    regel('Kleur tussen', kleurTussen.veld),
    kernRij,
    kernKleurRij,
    samenvatting,
    maak('div', { klasse: 'knoppen', stijl: { marginTop: '0' } }, annuleer, maakKnop),
  );
  document.body.append(formulier);

  const waarden = () => {
    let stralen = Math.round(begrens(leesGetal(velden.stralen, 24), 4, 240));
    if (stralen % 2) stralen += 1;
    return {
      gebied: velden.gebied.value,
      afloop: begrens(leesGetal(velden.afloop, 3), 0, 20),
      stralen,
      breedte: begrens(leesGetal(velden.breedte, 50), 10, 90),
      middelpunt: velden.middelpunt.value,
      mx: begrens(leesGetal(velden.mx, 50), -100, 200),
      my: begrens(leesGetal(velden.my, 50), -100, 200),
      draaiing: begrens(leesGetal(velden.draaiing, 0), -360, 360),
      kern: velden.kern.value,
      kernMaat: begrens(leesGetal(velden.kernMaat, 22), 1, 200),
      kleur1: kleurTussen.bewaar(),
      kleur2: kleurStralen.bewaar(),
      kernKleur: kleurKern.bewaar(),
    };
  };

  /** Bouwt alles op uit de velden; geeft { vormen } of { fout }. */
  function bouw(w, gebied) {
    const kleuren = { stralen: kleurStralen.lees(), tussen: kleurTussen.lees(), kern: kleurKern.lees() };
    if (!kleuren.stralen || !kleuren.tussen || !kleuren.kern) {
      return { fout: 'Een eigen kleur is niet goed: typ vier getallen van 0 tot 100, zoals 0 40 100 0.' };
    }
    if (gebied.fout) return gebied;
    const basis = w.gebied === 'selectie' ? gebied : { x: 0, y: 0, b: doc.tekengebied.b, h: doc.tekengebied.h };
    return { vormen: maakStralen(w, basis, gebied, kleuren) };
  }

  const gebiedNu = (w) => {
    if (w.gebied !== 'selectie') {
      const a = vexel.mm(w.afloop);
      return { x: -a, y: -a, b: doc.tekengebied.b + 2 * a, h: doc.tekengebied.h + 2 * a };
    }
    if (!selectie.length) return { fout: 'Er is niets geselecteerd. Selecteer een vorm, of kies "Tekengebied" bij Vullen.' };
    const x0 = Math.min(...selectie.map((o) => o.kader.x));
    const y0 = Math.min(...selectie.map((o) => o.kader.y));
    const x1 = Math.max(...selectie.map((o) => o.kader.x + o.kader.b));
    const y1 = Math.max(...selectie.map((o) => o.kader.y + o.kader.h));
    return { x: x0, y: y0, b: x1 - x0, h: y1 - y0 };
  };

  let gepland = false;
  function teken() {
    gepland = false;
    const w = waarden();
    afloopRij.style.display = w.gebied === 'selectie' ? 'none' : '';
    eigenRij.style.display = w.middelpunt === 'eigen' ? '' : 'none';
    velden.kernMaat.style.display = w.kern === 'geen' ? 'none' : '';
    kernRij.lastChild.style.display = w.kern === 'geen' ? 'none' : '';
    kernKleurRij.style.display = w.kern === 'geen' ? 'none' : '';
    const gebied = gebiedNu(w);
    const uitkomst = bouw(w, gebied);
    const zicht = gebied.fout ? null : {
      x: Math.min(0, gebied.x), y: Math.min(0, gebied.y),
      b: Math.max(doc.tekengebied.b, gebied.x + gebied.b) - Math.min(0, gebied.x),
      h: Math.max(doc.tekengebied.h, gebied.y + gebied.h) - Math.min(0, gebied.y),
    };
    tekenVoorbeeld(doek, doc, uitkomst.vormen || [], zicht);
    maakKnop.disabled = Boolean(uitkomst.fout) || doc.alleenLezen;
    samenvatting.classList.toggle('fout', Boolean(uitkomst.fout));
    if (doc.alleenLezen) samenvatting.textContent = 'Dit document is alleen-lezen: je kunt hier niets aan toevoegen.';
    else if (uitkomst.fout) samenvatting.textContent = uitkomst.fout;
    else {
      const maat = `${getal(naarMm(gebied.b), 0)} × ${getal(naarMm(gebied.h), 0)} mm`;
      const waar = w.gebied === 'selectie' ? 'over de selectie' : w.afloop > 0 ? `tot in de afloop van ${getal(w.afloop)} mm` : 'op het tekengebied';
      samenvatting.textContent = `${w.stralen / 2} gekleurde stralen en ${w.stralen / 2} tussenruimtes, ${waar} (${maat}).`;
    }
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
    const w = waarden();
    maakKnop.disabled = true;
    try {
      const gebied = await leesGebied(w.gebied, doc, w.afloop);
      const uitkomst = bouw(w, gebied);
      if (uitkomst.fout) {
        vexel.melding(uitkomst.fout, 'let');
        maakKnop.disabled = false;
        return;
      }
      await vexel.maak(uitkomst.vormen);
      await vexel.bewaar('instellingen', w);
      vexel.melding(`Zonnestralen gemaakt: ${w.stralen} stralen.`, 'ok');
      vexel.sluit();
    } catch (fout) {
      maakKnop.disabled = false;
      vexel.melding(fout && fout.message ? fout.message : 'De zonnestralen konden niet worden gemaakt.', 'fout');
    }
  });

  if (w0.gebied === 'selectie' && !selectie.length) velden.gebied.value = 'tekengebied';
  else if (selectie.length && !(await vexel.haal('instellingen'))) velden.gebied.value = 'selectie';
  teken();
  velden.stralen.focus();
  velden.stralen.select();
}

vexel.opCommando('maken', toonVenster);
