// Halftoon: een halftoonraster als vectoren, met stippen, vierkantjes, ruiten of lijnen die in grootte verlopen.
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

// ---- het halftoonraster ---------------------------------------------------

const VORMEN = { stippen: 'Stippen', vierkant: 'Vierkantjes', ruiten: 'Ruiten', lijnen: 'Lijnen' };
const VERLOPEN = { lineair: 'Lineair', radiaal: 'Radiaal (vanuit het midden)', rand: 'Van het midden naar de rand' };

const KLEUREN = {
  zwart: { naam: 'Zwart', cmyk: [0, 0, 0, 100] },
  grijs: { naam: 'Grijs (K 50)', cmyk: [0, 0, 0, 50] },
  cyaan: { naam: 'Cyaan', cmyk: [100, 0, 0, 0] },
  magenta: { naam: 'Magenta', cmyk: [0, 100, 0, 0] },
  geel: { naam: 'Geel', cmyk: [0, 0, 100, 0] },
  blauw: { naam: 'Diepblauw', cmyk: [100, 70, 0, 10] },
  rood: { naam: 'Rood', cmyk: [0, 90, 85, 0] },
  oranje: { naam: 'Oranje', cmyk: [0, 60, 95, 0] },
  groen: { naam: 'Groen', cmyk: [80, 0, 70, 10] },
  wit: { naam: 'Wit', cmyk: [0, 0, 0, 0] },
};

const STANDAARD = {
  gebied: 'tekengebied', afloop: 3, vorm: 'stippen', raster: 4, rasterhoek: 45, verloop: 'lineair', verloophoek: 90,
  min: 0, max: 100, omkeren: false, kleur: { keuze: 'zwart' },
};

const KAPPA = 0.5522847498;
// Bij 100 % raken de vormen elkaar; stippen zijn bij 141 % helemaal dicht, ruiten bij 200 %.
const GROOTSTE = { stippen: 141, vierkant: 100, ruiten: 200, lijnen: 100 };
const KLEINSTE = () => vexel.mm(0.1); // kleinere punten drukken niet

/** Het gebied als lijst veelhoeken (voor "ligt dit punt erin?"), of null voor de hele rechthoek. */
function vormVanSelectie(items) {
  const veelhoeken = [];
  for (const o of items) {
    if (!o.subpaden || !o.subpaden.length) {
      const k = o.kader;
      veelhoeken.push([{ x: k.x, y: k.y }, { x: k.x + k.b, y: k.y }, { x: k.x + k.b, y: k.y + k.h }, { x: k.x, y: k.y + k.h }]);
      continue;
    }
    // Alle subpaden van één object samen: even-oneven, zodat gaten gaten blijven.
    const ringen = o.subpaden.map((s) => vlak(s));
    veelhoeken.push({ ringen });
  }
  return veelhoeken;
}

/** Een subpad als veelhoek (bochten in stukjes). */
function vlak(s) {
  const uit = [];
  const n = s.punten.length;
  for (let i = 0; i < n; i++) {
    const a = s.punten[i];
    const b = s.punten[(i + 1) % n];
    uit.push({ x: a.x, y: a.y });
    if (i === n - 1 && !s.gesloten) break;
    if (a.uit || b.in) {
      const c1 = a.uit || a;
      const c2 = b.in || b;
      for (let k = 1; k < 12; k++) {
        const t = k / 12;
        const m = 1 - t;
        uit.push({
          x: m * m * m * a.x + 3 * m * m * t * c1.x + 3 * m * t * t * c2.x + t * t * t * b.x,
          y: m * m * m * a.y + 3 * m * m * t * c1.y + 3 * m * t * t * c2.y + t * t * t * b.y,
        });
      }
    }
  }
  return uit;
}

function inRing(p, ring) {
  let binnen = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) binnen = !binnen;
  }
  return binnen;
}

function inVorm(p, vormen) {
  return vormen.some((v) => (Array.isArray(v) ? inRing(p, v) : v.ringen.filter((r) => inRing(p, r)).length % 2 === 1));
}

/** Waarde van het verloop op punt p: 0 tot 1. */
function verloopFunctie(w, gebied) {
  const cx = gebied.x + gebied.b / 2;
  const cy = gebied.y + gebied.h / 2;
  if (w.verloop === 'radiaal') {
    const R = Math.hypot(gebied.b, gebied.h) / 2;
    return (p) => Math.hypot(p.x - cx, p.y - cy) / R;
  }
  if (w.verloop === 'rand') {
    // Een afgeronde rechthoek die vanuit het midden naar de rand groeit: 0 in het midden, 1 op de rand.
    return (p) => {
      const nx = Math.abs(p.x - cx) / (gebied.b / 2);
      const ny = Math.abs(p.y - cy) / (gebied.h / 2);
      return Math.pow(nx ** 4 + ny ** 4, 0.25);
    };
  }
  const a = (w.verloophoek * Math.PI) / 180;
  const d = { x: Math.cos(a), y: Math.sin(a) };
  const bereik = (Math.abs(d.x) * gebied.b + Math.abs(d.y) * gebied.h) / 2;
  return (p) => ((p.x - cx) * d.x + (p.y - cy) * d.y) / (2 * bereik) + 0.5;
}

function stip(p, r) {
  const k = r * KAPPA;
  return { gesloten: true, punten: [
    { x: p.x, y: p.y - r, in: { x: p.x - k, y: p.y - r }, uit: { x: p.x + k, y: p.y - r } },
    { x: p.x + r, y: p.y, in: { x: p.x + r, y: p.y - k }, uit: { x: p.x + r, y: p.y + k } },
    { x: p.x, y: p.y + r, in: { x: p.x + k, y: p.y + r }, uit: { x: p.x - k, y: p.y + r } },
    { x: p.x - r, y: p.y, in: { x: p.x - r, y: p.y + k }, uit: { x: p.x - r, y: p.y - k } },
  ] };
}

/** Een vierkant om p met halve zijde h, langs de richtingen u en v (eenheidsvectoren). */
function vierkant(p, h, u, v) {
  const hoek = (a, b) => ({ x: p.x + (a * u.x + b * v.x) * h, y: p.y + (a * u.y + b * v.y) * h });
  return { gesloten: true, punten: [hoek(-1, -1), hoek(1, -1), hoek(1, 1), hoek(-1, 1)] };
}

function ruit(p, h, u, v) {
  const hoek = (a, b) => ({ x: p.x + (a * u.x + b * v.x) * h, y: p.y + (a * u.y + b * v.y) * h });
  return { gesloten: true, punten: [hoek(0, -1), hoek(1, 0), hoek(0, 1), hoek(-1, 0)] };
}

/**
 * Bouwt het raster. Geeft { rijen: [[subpad, …], …], aantal } terug: per rasterrij de vormen.
 * Kunnen de vormen elkaar raken, dan worden de even en oneven vormen van een rij aparte paden,
 * zodat overlappende vormen in één pad nooit een gat geven.
 */
function bouwRaster(w, gebied, vorm) {
  const s = vexel.mm(w.raster);
  const a = (w.rasterhoek * Math.PI) / 180;
  const u = { x: Math.cos(a), y: Math.sin(a) };
  const v = { x: -u.y, y: u.x };
  const cx = gebied.x + gebied.b / 2;
  const cy = gebied.y + gebied.h / 2;
  const hoeken = [[gebied.x, gebied.y], [gebied.x + gebied.b, gebied.y], [gebied.x, gebied.y + gebied.h], [gebied.x + gebied.b, gebied.y + gebied.h]];
  const pu = hoeken.map(([x, y]) => ((x - cx) * u.x + (y - cy) * u.y) / s);
  const pv = hoeken.map(([x, y]) => ((x - cx) * v.x + (y - cy) * v.y) / s);
  const i0 = Math.floor(Math.min(...pu)) - 1;
  const i1 = Math.ceil(Math.max(...pu)) + 1;
  const j0 = Math.floor(Math.min(...pv)) - 1;
  const j1 = Math.ceil(Math.max(...pv)) + 1;
  const waarde = verloopFunctie(w, gebied);
  const maat = (p) => {
    let t = begrens(waarde(p), 0, 1);
    if (w.omkeren) t = 1 - t;
    return (w.min + (w.max - w.min) * t) / 100;
  };
  const binnen = (p) => p.x >= gebied.x && p.x <= gebied.x + gebied.b && p.y >= gebied.y && p.y <= gebied.y + gebied.h
    && (!vorm || inVorm(p, vorm));
  const kleinste = KLEINSTE();
  const rijen = [];
  let aantal = 0;
  const kanOverlappen = Math.max(w.min, w.max) > 100;
  const punt = (i, j) => ({ x: cx + (i * u.x + j * v.x) * s, y: cy + (i * u.y + j * v.y) * s });

  for (let j = j0; j <= j1; j++) {
    if (w.vorm === 'lijnen') {
      // Een lijn per rij die dikker en dunner wordt; om de halve rastermaat gemeten.
      const stukken = [];
      let huidig = [];
      const sluit = () => {
        if (huidig.length >= 2) stukken.push(huidig);
        huidig = [];
      };
      for (let k = i0 * 2; k <= i1 * 2; k++) {
        const p = punt(k / 2, j);
        const dikte = binnen(p) ? maat(p) * s : 0;
        if (dikte < kleinste) {
          sluit();
          continue;
        }
        huidig.push({ p, d: dikte / 2 });
      }
      sluit();
      const subpaden = stukken.map((stuk) => {
        const boven = stuk.map(({ p, d }) => ({ x: p.x - v.x * d, y: p.y - v.y * d }));
        const onder = stuk.map(({ p, d }) => ({ x: p.x + v.x * d, y: p.y + v.y * d })).reverse();
        // Spitse uiteinden: de lijn loopt een halve stap verder uit tot een punt.
        const eerste = stuk[0].p;
        const laatste = stuk[stuk.length - 1].p;
        const voor = { x: eerste.x - (u.x * s) / 4, y: eerste.y - (u.y * s) / 4 };
        const na = { x: laatste.x + (u.x * s) / 4, y: laatste.y + (u.y * s) / 4 };
        aantal++;
        return { gesloten: true, punten: [voor, ...boven, na, ...onder] };
      });
      if (subpaden.length) rijen.push(subpaden);
      continue;
    }
    const even = [];
    const oneven = [];
    for (let i = i0; i <= i1; i++) {
      const p = punt(i, j);
      if (!binnen(p)) continue;
      const f = maat(p);
      let vormpje = null;
      if (w.vorm === 'stippen') {
        const r = (f * s) / 2;
        if (2 * r >= kleinste) vormpje = stip(p, r);
      } else if (w.vorm === 'vierkant') {
        if (f * s >= kleinste) vormpje = vierkant(p, (f * s) / 2, u, v);
      } else if (f * s >= kleinste) vormpje = ruit(p, (f * s) / 2, u, v);
      if (!vormpje) continue;
      aantal++;
      (i % 2 === 0 || !kanOverlappen ? even : oneven).push(vormpje);
    }
    if (even.length) rijen.push(even);
    if (oneven.length) rijen.push(oneven);
  }
  return { rijen, aantal };
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
    gebied: keuzeVeld({ tekengebied: 'Tekengebied', selectie: 'Selectie (binnen de vorm)' }, w0.gebied),
    afloop: getalVeld(w0.afloop, 0, 20, 0.5),
    vorm: keuzeVeld(VORMEN, w0.vorm),
    raster: getalVeld(w0.raster, 0.5, 100, 0.5),
    rasterhoek: getalVeld(w0.rasterhoek, -180, 180, 1, 'Rasterhoek in graden'),
    verloop: keuzeVeld(VERLOPEN, w0.verloop),
    verloophoek: getalVeld(w0.verloophoek, -360, 360, 15),
    min: getalVeld(w0.min, 0, 200, 5),
    max: getalVeld(w0.max, 0, 200, 5, 'Grootste grootte in procent'),
    omkeren: maak('input', { type: 'checkbox', stijl: { margin: '0', flex: 'none' } }),
  };
  velden.omkeren.checked = Boolean(w0.omkeren);
  const kleur = kleurKiezer(KLEUREN, w0.kleur, cmyk);

  const doek = maak('canvas', { 'aria-hidden': 'true', stijl: { width: '100%', height: '200px' } });
  const samenvatting = maak('p', { klasse: 'uitleg', 'aria-live': 'polite', stijl: { margin: '0', minHeight: '32px' } });
  const maakKnop = maak('button', { klasse: 'knop primair', type: 'submit', tekst: 'Halftoon maken' });
  const annuleer = maak('button', { klasse: 'knop', type: 'button', tekst: 'Annuleren', bijClick: () => vexel.sluit() });

  const afloopRij = regel('Afloop', velden.afloop, 'mm');
  const hoekRij = regel('Richting', velden.verloophoek, '°');
  const formulier = maak('form', { stijl: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '8px' } },
    doek,
    regel('Vullen', velden.gebied),
    afloopRij,
    regel('Vorm', velden.vorm),
    regel('Raster', velden.raster, 'mm', velden.rasterhoek, '°'),
    regel('Verloop', velden.verloop),
    hoekRij,
    regel('Grootte', velden.min, 'tot', velden.max, '%'),
    regel('Omkeren', velden.omkeren, maak('span', { klasse: 'uitleg', tekst: 'klein en groot omwisselen' })),
    regel('Kleur', kleur.veld),
    samenvatting,
    maak('div', { klasse: 'knoppen', stijl: { marginTop: '0' } }, annuleer, maakKnop),
  );
  document.body.append(formulier);

  const waarden = () => {
    const vorm = velden.vorm.value;
    const grens = GROOTSTE[vorm];
    return {
      gebied: velden.gebied.value,
      afloop: begrens(leesGetal(velden.afloop, 3), 0, 20),
      vorm,
      raster: begrens(leesGetal(velden.raster, 4), 0.5, 100),
      rasterhoek: begrens(leesGetal(velden.rasterhoek, 45), -180, 180),
      verloop: velden.verloop.value,
      verloophoek: begrens(leesGetal(velden.verloophoek, 90), -360, 360),
      min: begrens(leesGetal(velden.min, 0), 0, grens),
      max: begrens(leesGetal(velden.max, 100), 0, grens),
      omkeren: velden.omkeren.checked,
      kleur: kleur.bewaar(),
    };
  };

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
    return { x: x0, y: y0, b: x1 - x0, h: y1 - y0, vorm: vormVanSelectie(items) };
  };

  /** Alles klaar voor Vexel, of { fout }. */
  function bouw(w, items) {
    const k = kleur.lees();
    if (!k) return { fout: 'De eigen kleur is niet goed: typ vier getallen van 0 tot 100, zoals 0 0 0 100.' };
    const gebied = gebiedVan(w, items);
    if (gebied.fout) return gebied;
    // Ruwe schatting vooraf, zodat een veel te fijn raster de boel niet ophoudt.
    const cellen = (gebied.b * gebied.h) / (vexel.mm(w.raster) ** 2);
    if (cellen > 60000) {
      return { fout: `Dat raster is te fijn voor dit gebied (ongeveer ${getal(cellen, 0)} cellen). Kies een grotere rastermaat.` };
    }
    const r = bouwRaster(w, gebied, gebied.vorm);
    if (!r.aantal) return { fout: 'Er blijft niets over: maak de grootte groter, of controleer het gebied.', gebied };
    const stijl = { vulling: k, lijn: null, lijndikte: 0 };
    const kinderen = r.rijen.map((subpaden, i) => ({ soort: 'pad', naam: `Rij ${i + 1}`, subpaden, ...stijl }));
    const vormen = [{ soort: 'groep', naam: `Halftoon: ${VORMEN[w.vorm].toLowerCase()}, ${getal(w.raster)} mm`, kinderen }];
    const t = tel(vormen);
    if (t.punten > GRENS.punten || t.vormen > GRENS.vormen) {
      const minder = Math.ceil(w.raster * Math.sqrt(t.punten / GRENS.punten) * 2 + 0.5) / 2;
      return {
        fout: `Te fijn: ${getal(t.punten, 0)} punten (hooguit ${getal(GRENS.punten, 0)}). Kies een rastermaat van minstens ${getal(minder)} mm of een kleiner gebied.`,
        gebied,
      };
    }
    return { vormen, aantal: r.aantal, rijen: kinderen.length, punten: t.punten, gebied };
  }

  let gepland = false;
  function teken() {
    gepland = false;
    const w = waarden();
    afloopRij.style.display = w.gebied === 'selectie' ? 'none' : '';
    hoekRij.style.display = w.verloop === 'lineair' ? '' : 'none';
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
      const wat = w.vorm === 'lijnen' ? 'lijnstukken' : VORMEN[w.vorm].toLowerCase();
      samenvatting.textContent = `${getal(uitkomst.aantal, 0)} ${wat} in ${uitkomst.rijen} paden, ${getal(uitkomst.punten, 0)} punten.`;
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
      vexel.melding(`Halftoon gemaakt: ${getal(uitkomst.aantal, 0)} vormen.`, 'ok');
      vexel.sluit();
    } catch (fout) {
      maakKnop.disabled = false;
      vexel.melding(fout && fout.message ? fout.message : 'Het halftoonraster kon niet worden gemaakt.', 'fout');
    }
  });

  if (velden.gebied.value === 'selectie' && !selectie.length) velden.gebied.value = 'tekengebied';
  else if (selectie.length && !opgeslagen) velden.gebied.value = 'selectie';
  teken();
  velden.raster.focus();
  velden.raster.select();
}

vexel.opCommando('maken', toonVenster);
