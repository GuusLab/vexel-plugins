// Guilloche: sierranden en medaillons van in elkaar gevlochten golflijnen.
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

/** Een lange lijst subpaden als één of meer paden (hooguit 1000 subpaden per pad). */
function alsPaden(subpaden, naam, stijl) {
  const paden = [];
  for (let i = 0; i < subpaden.length; i += GRENS.subpaden) {
    paden.push({ soort: 'pad', naam, subpaden: subpaden.slice(i, i + GRENS.subpaden), ...stijl });
  }
  if (paden.length > 1) paden.forEach((p, i) => { p.naam = `${naam} ${i + 1}`; });
  return paden;
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

// ---- guilloche ------------------------------------------------------------
// Elke lijn is een gesloten kromme P(t), t van 0 tot 1. We nemen een paar punten per golf
// en zetten de handvatten langs de afgeleide: zo blijft de lijn strak met weinig punten.

const KLEUREN = {
  groen: { naam: 'Diepgroen', cmyk: [90, 30, 80, 30] },
  goud: { naam: 'Goud', cmyk: [0, 25, 80, 25] },
  blauw: { naam: 'Diepblauw', cmyk: [100, 70, 0, 10] },
  bordeaux: { naam: 'Bordeaux', cmyk: [20, 100, 70, 25] },
  brons: { naam: 'Brons', cmyk: [0, 50, 80, 35] },
  cyaan: { naam: 'Cyaan', cmyk: [100, 0, 0, 0] },
  magenta: { naam: 'Magenta', cmyk: [0, 100, 0, 0] },
  zwart: { naam: 'Zwart', cmyk: [0, 0, 0, 100] },
  grijs: { naam: 'Grijs (K 60)', cmyk: [0, 0, 0, 60] },
};

const VORMEN = { rand: 'Sierrand', medaillon: 'Medaillon' };

const STANDAARD = {
  vorm: 'rand', gebied: 'tekengebied', inspring: 10, breedte: 9, golflengte: 7, golven: 48, diameter: 90,
  lagen: 3, dichtheid: 10, amplitude: 100, dikte: 0.3, randlijnen: true, kleur1: { keuze: 'groen' }, kleur2: { keuze: 'goud' },
};

const PUNTEN_PER_GOLF = 6;

/** Een gesloten kromme met N punten en handvatten langs de afgeleide. */
function gesloten(P, N) {
  const h = 1e-5;
  const dt = 1 / N;
  const punten = [];
  for (let k = 0; k < N; k++) {
    const t = k / N;
    const p = P(t);
    const a = P(t - h);
    const b = P(t + h);
    const dx = ((b.x - a.x) / (2 * h)) * (dt / 3);
    const dy = ((b.y - a.y) / (2 * h)) * (dt / 3);
    punten.push({ x: p.x, y: p.y, in: { x: p.x - dx, y: p.y - dy }, uit: { x: p.x + dx, y: p.y + dy } });
  }
  return { gesloten: true, punten };
}

/** Een afgeronde rechthoek als functie van de booglengte: punt en normaal naar buiten. */
function afgerondeRechthoek(x, y, b, h, r) {
  const rechtB = b - 2 * r;
  const rechtH = h - 2 * r;
  const boog = (Math.PI / 2) * r;
  const delen = [
    { lengte: rechtB, punt: (u) => ({ x: x + r + u, y, nx: 0, ny: -1 }) },
    { lengte: boog, punt: (u) => hoek(x + b - r, y + r, -Math.PI / 2 + u / r) },
    { lengte: rechtH, punt: (u) => ({ x: x + b, y: y + r + u, nx: 1, ny: 0 }) },
    { lengte: boog, punt: (u) => hoek(x + b - r, y + h - r, u / r) },
    { lengte: rechtB, punt: (u) => ({ x: x + b - r - u, y: y + h, nx: 0, ny: 1 }) },
    { lengte: boog, punt: (u) => hoek(x + r, y + h - r, Math.PI / 2 + u / r) },
    { lengte: rechtH, punt: (u) => ({ x, y: y + h - r - u, nx: -1, ny: 0 }) },
    { lengte: boog, punt: (u) => hoek(x + r, y + r, Math.PI + u / r) },
  ];
  function hoek(cx, cy, a) {
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), nx: Math.cos(a), ny: Math.sin(a) };
  }
  const totaal = delen.reduce((s, d) => s + d.lengte, 0);
  const op = (t) => {
    let s = (((t % 1) + 1) % 1) * totaal;
    for (const d of delen) {
      if (s <= d.lengte) return d.punt(s);
      s -= d.lengte;
    }
    return delen[0].punt(0);
  };
  return { op, totaal };
}

/** De sierrand: families van in elkaar gevlochten golflijnen langs een afgeronde rechthoek. */
function maakRand(w, vak) {
  const half = vexel.mm(w.breedte) / 2;
  const inspring = vexel.mm(w.inspring);
  const x = vak.x + inspring + half;
  const y = vak.y + inspring + half;
  const b = vak.b - 2 * (inspring + half);
  const h = vak.h - 2 * (inspring + half);
  const r = Math.min(half + vexel.mm(4), b / 2, h / 2);
  if (!(b > 4 * half) || !(h > 4 * half) || r < half) {
    return { fout: 'De rand past niet: maak de inspringing of de breedte kleiner, of kies een groter gebied.' };
  }
  const baan = afgerondeRechthoek(x, y, b, h, r);
  const n = Math.max(4, Math.round(baan.totaal / vexel.mm(w.golflengte)));
  const A = half * (w.amplitude / 100);
  const lagen = [];
  // Laag 1: de hoofdband, fijne golven over de hele breedte.
  // Laag 2: een trage, brede vlecht eroverheen (een derde van het aantal golven).
  // Laag 3: dezelfde vlecht in spiegelbeeld, zodat de twee koorden om elkaar heen draaien.
  const families = [
    { freq: n, a: A * 0.92, fase: 0, spreiding: 1, kleur: 1 },
    { freq: Math.max(4, Math.round(n / 3)), a: A * 0.62, fase: Math.PI, spreiding: 0.18, kleur: 2 },
    { freq: Math.max(4, Math.round(n / 3)), a: A * 0.62, fase: 0, spreiding: 0.18, kleur: 2 },
  ].slice(0, w.lagen);
  families.forEach((f, li) => {
    const subpaden = [];
    for (let j = 0; j < w.dichtheid; j++) {
      const fase = f.fase + (2 * Math.PI * f.spreiding * j) / w.dichtheid;
      const P = (t) => {
        const p = baan.op(t);
        const d = f.a * Math.sin(2 * Math.PI * f.freq * t + fase);
        return { x: p.x + p.nx * d, y: p.y + p.ny * d };
      };
      subpaden.push(gesloten(P, f.freq * PUNTEN_PER_GOLF));
    }
    lagen.push({ naam: `Band ${li + 1}`, subpaden, kleur: f.kleur });
  });
  if (w.randlijnen) {
    const randlijn = (d) => gesloten((t) => {
      const p = baan.op(t);
      return { x: p.x + p.nx * d, y: p.y + p.ny * d };
    }, 64);
    const marge = half + vexel.mm(0.8);
    lagen.push({ naam: 'Randlijnen', subpaden: [randlijn(marge), randlijn(-marge), randlijn(marge + vexel.mm(0.6))], kleur: 1, dik: true });
  }
  return { lagen, omschrijving: `een sierrand van ${n} golven rondom` };
}

/** Het medaillon: concentrische banden van golflijnen en een gevlochten rozet in het hart. */
function maakMedaillon(w, vak, straal) {
  const cx = vak.x + vak.b / 2;
  const cy = vak.y + vak.h / 2;
  const R = straal;
  const n = Math.max(8, Math.round(w.golven / 4) * 4);
  const amp = w.amplitude / 100;
  const L = w.dichtheid;
  const polair = (r) => (t) => {
    const a = 2 * Math.PI * t;
    const rr = r(a);
    return { x: cx + rr * Math.cos(a), y: cy + rr * Math.sin(a) };
  };
  const banden = [
    // Buitenste band: een smalle, dichte gevlochten ring.
    { naam: 'Buitenring', freq: n, maak: (fase) => (a) => R * 0.865 + R * 0.075 * amp * Math.sin(n * a + fase) },
    // Middenband: een ring met lobben, zelf weer gevlochten.
    {
      naam: 'Lobbenring',
      freq: n,
      maak: (fase) => (a) => R * 0.6 + R * 0.06 * Math.cos((n / 4) * a) + R * 0.1 * amp * Math.sin((n / 2) * a + fase),
    },
    // Hart: bloembladen die over elkaar heen vallen.
    {
      naam: 'Rozet',
      freq: n / 2,
      maak: (fase) => (a) => R * 0.12 + R * 0.24 * amp * (0.5 + 0.5 * Math.cos((n / 4) * a + fase / 2)),
    },
  ].slice(0, w.lagen);
  const lagen = banden.map((band, li) => {
    const subpaden = [];
    for (let j = 0; j < L; j++) {
      const fase = (2 * Math.PI * j) / L;
      subpaden.push(gesloten(polair(band.maak(fase)), Math.round(band.freq * PUNTEN_PER_GOLF)));
    }
    return { naam: band.naam, subpaden, kleur: li % 2 ? 2 : 1 };
  });
  if (w.randlijnen) {
    const cirkel = (r) => gesloten(polair(() => r), 16);
    lagen.push({ naam: 'Randlijnen', subpaden: [cirkel(R), cirkel(R * 0.975), cirkel(R * 0.765)], kleur: 1, dik: true });
  }
  return { lagen, omschrijving: `een medaillon van ${getal(naarMm(2 * R), 0)} mm met ${n} golven` };
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
    vorm: keuzeVeld(VORMEN, w0.vorm),
    gebied: keuzeVeld({ tekengebied: 'Tekengebied', selectie: 'Selectie (het kader)' }, w0.gebied),
    inspring: getalVeld(w0.inspring, 0, 200, 1),
    breedte: getalVeld(w0.breedte, 2, 100, 0.5),
    golflengte: getalVeld(w0.golflengte, 1, 100, 0.5),
    golven: getalVeld(w0.golven, 8, 240, 4),
    diameter: getalVeld(w0.diameter, 10, 1000, 5),
    lagen: getalVeld(w0.lagen, 1, 3, 1),
    dichtheid: getalVeld(w0.dichtheid, 1, 40, 1, 'Lijnen per laag'),
    amplitude: getalVeld(w0.amplitude, 10, 150, 5),
    dikte: getalVeld(w0.dikte, 0.1, 3, 0.05),
    randlijnen: maak('input', { type: 'checkbox', stijl: { margin: '0', flex: 'none' } }),
  };
  velden.randlijnen.checked = Boolean(w0.randlijnen);
  const kleur1 = kleurKiezer(KLEUREN, w0.kleur1, cmyk);
  const kleur2 = kleurKiezer(KLEUREN, w0.kleur2, cmyk);

  const doekGeheel = maak('canvas', { 'aria-hidden': 'true', stijl: { width: '100%', height: '190px' } });
  const doekDetail = maak('canvas', { 'aria-hidden': 'true', stijl: { width: '100%', height: '190px' } });
  const samenvatting = maak('p', { klasse: 'uitleg', 'aria-live': 'polite', stijl: { margin: '0', minHeight: '32px' } });
  const maakKnop = maak('button', { klasse: 'knop primair', type: 'submit', tekst: 'Guilloche maken' });
  const annuleer = maak('button', { klasse: 'knop', type: 'button', tekst: 'Annuleren', bijClick: () => vexel.sluit() });

  const randRijen = [
    regel('Inspringen', velden.inspring, 'mm van de rand'),
    regel('Breedte', velden.breedte, 'mm'),
    regel('Golflengte', velden.golflengte, 'mm'),
  ];
  const medRijen = [regel('Diameter', velden.diameter, 'mm'), regel('Golven', velden.golven, 'rondom')];
  const formulier = maak('form', { stijl: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '8px' } },
    maak('div', { stijl: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' } }, doekGeheel, doekDetail),
    regel('Vorm', velden.vorm),
    regel('Plaats', velden.gebied),
    ...randRijen,
    ...medRijen,
    regel('Lagen', velden.lagen, 'lijnen per laag', velden.dichtheid),
    regel('Uitslag', velden.amplitude, '%'),
    regel('Lijndikte', velden.dikte, 'pt'),
    regel('Randlijnen', velden.randlijnen, maak('span', { klasse: 'uitleg', tekst: 'dunne lijnen langs de band' })),
    regel('Kleur 1', kleur1.veld),
    regel('Kleur 2', kleur2.veld),
    samenvatting,
    maak('div', { klasse: 'knoppen', stijl: { marginTop: '0' } }, annuleer, maakKnop),
  );
  document.body.append(formulier);

  const waarden = () => ({
    vorm: velden.vorm.value,
    gebied: velden.gebied.value,
    inspring: begrens(leesGetal(velden.inspring, 10), 0, 200),
    breedte: begrens(leesGetal(velden.breedte, 9), 2, 100),
    golflengte: begrens(leesGetal(velden.golflengte, 7), 1, 100),
    golven: Math.round(begrens(leesGetal(velden.golven, 48), 8, 240)),
    diameter: begrens(leesGetal(velden.diameter, 90), 10, 1000),
    lagen: Math.round(begrens(leesGetal(velden.lagen, 2), 1, 3)),
    dichtheid: Math.round(begrens(leesGetal(velden.dichtheid, 10), 1, 40)),
    amplitude: begrens(leesGetal(velden.amplitude, 100), 10, 150),
    dikte: begrens(leesGetal(velden.dikte, 0.3), 0.1, 3),
    randlijnen: velden.randlijnen.checked,
    kleur1: kleur1.bewaar(),
    kleur2: kleur2.bewaar(),
  });

  const gebiedVan = (w, items) => {
    if (w.gebied !== 'selectie') return { x: 0, y: 0, b: doc.tekengebied.b, h: doc.tekengebied.h };
    if (!items.length) return { fout: 'Er is niets geselecteerd. Selecteer een vorm, of kies "Tekengebied" bij Plaats.' };
    const x0 = Math.min(...items.map((o) => o.kader.x));
    const y0 = Math.min(...items.map((o) => o.kader.y));
    const x1 = Math.max(...items.map((o) => o.kader.x + o.kader.b));
    const y1 = Math.max(...items.map((o) => o.kader.y + o.kader.h));
    if (!(x1 - x0 > 5) || !(y1 - y0 > 5)) return { fout: 'De selectie is te klein.' };
    return { x: x0, y: y0, b: x1 - x0, h: y1 - y0 };
  };

  function bouw(w, items) {
    const k1 = kleur1.lees();
    const k2 = kleur2.lees();
    if (!k1 || !k2) return { fout: 'Een eigen kleur is niet goed: typ vier getallen van 0 tot 100, zoals 100 0 0 0.' };
    const vak = gebiedVan(w, items);
    if (vak.fout) return vak;
    // In een selectie past het medaillon zich aan de kleinste zijde aan.
    const straal = w.gebied === 'selectie' ? Math.min(vak.b, vak.h) / 2 : vexel.mm(w.diameter) / 2;
    // Eerst een snelle schatting, zodat een veel te fijne instelling het venster niet ophoudt.
    const golven = w.vorm === 'rand' ? (2 * (vak.b + vak.h)) / vexel.mm(w.golflengte) : w.golven;
    const schatting = w.lagen * w.dichtheid * golven * PUNTEN_PER_GOLF;
    if (schatting > GRENS.punten * 1.5) {
      const ongeveer = getal(Math.round(schatting / 1000) * 1000, 0);
      return { fout: `Te veel punten (ongeveer ${ongeveer}, hooguit ${getal(GRENS.punten, 0)}). Kies minder lijnen per laag of langere golven.`, vak };
    }
    const uitkomst = w.vorm === 'rand' ? maakRand(w, vak) : maakMedaillon(w, vak, straal);
    if (uitkomst.fout) return uitkomst;
    const kinderen = [];
    for (const laag of uitkomst.lagen) {
      const stijl = {
        vulling: null, lijn: laag.kleur === 2 ? k2 : k1, lijndikte: laag.dik ? Math.max(0.35, w.dikte * 1.6) : w.dikte, lijnhoek: 'round',
      };
      kinderen.push(...alsPaden(laag.subpaden, laag.naam, stijl));
    }
    const vormen = [{ soort: 'groep', naam: w.vorm === 'rand' ? 'Guilloche-rand' : 'Guilloche-medaillon', kinderen }];
    const t = tel(vormen);
    if (t.punten > GRENS.punten) {
      return { fout: `Te veel punten (${getal(t.punten, 0)}, hooguit ${getal(GRENS.punten, 0)}). Kies minder lijnen per laag, minder lagen of langere golven.`, vak };
    }
    return { vormen, vak, straal, omschrijving: uitkomst.omschrijving, punten: t.punten };
  }

  let gepland = false;
  function teken() {
    gepland = false;
    const w = waarden();
    randRijen.forEach((r) => { r.style.display = w.vorm === 'rand' ? '' : 'none'; });
    medRijen.forEach((r) => { r.style.display = w.vorm === 'medaillon' ? '' : 'none'; });
    medRijen[0].style.display = w.vorm === 'medaillon' && w.gebied !== 'selectie' ? '' : 'none';
    const uitkomst = bouw(w, selectie);
    const vormen = uitkomst.vormen || [];
    tekenVoorbeeld(doekGeheel, doc, vormen);
    // Rechts een uitsnede: de hoek van de rand, of een stuk van het medaillon.
    const v = uitkomst.vak;
    if (v && w.vorm === 'rand') {
      const d = vexel.mm(w.inspring + w.breedte * 3 + 6);
      tekenVoorbeeld(doekDetail, doc, vormen, { x: v.x, y: v.y, b: d, h: d });
    } else if (v) {
      const r = uitkomst.straal || vexel.mm(w.diameter) / 2;
      tekenVoorbeeld(doekDetail, doc, vormen, { x: v.x + v.b / 2, y: v.y + v.h / 2 - r, b: r, h: r });
    } else tekenVoorbeeld(doekDetail, doc, []);
    maakKnop.disabled = Boolean(uitkomst.fout) || doc.alleenLezen;
    samenvatting.classList.toggle('fout', Boolean(uitkomst.fout));
    if (doc.alleenLezen) samenvatting.textContent = 'Dit document is alleen-lezen: je kunt hier niets aan toevoegen.';
    else if (uitkomst.fout) samenvatting.textContent = uitkomst.fout;
    else {
      const o = uitkomst.omschrijving;
      samenvatting.textContent = `${o[0].toUpperCase()}${o.slice(1)}, ${w.lagen} ${w.lagen === 1 ? 'laag' : 'lagen'} van ${w.dichtheid} lijnen (${getal(uitkomst.punten, 0)} punten).`;
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
      const items = w.gebied === 'selectie' ? await vexel.selectie() : [];
      const uitkomst = bouw(w, items);
      if (uitkomst.fout) {
        vexel.melding(uitkomst.fout, 'let');
        maakKnop.disabled = false;
        return;
      }
      await vexel.maak(uitkomst.vormen);
      await vexel.bewaar('instellingen', w);
      vexel.melding(`Guilloche gemaakt: ${uitkomst.omschrijving}.`, 'ok');
      vexel.sluit();
    } catch (fout) {
      maakKnop.disabled = false;
      vexel.melding(fout && fout.message ? fout.message : 'De guilloche kon niet worden gemaakt.', 'fout');
    }
  });

  if (velden.gebied.value === 'selectie' && !selectie.length) velden.gebied.value = 'tekengebied';
  teken();
  velden.vorm.focus();
}

vexel.opCommando('maken', toonVenster);
