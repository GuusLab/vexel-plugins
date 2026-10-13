// Arcering: vul een gesloten vorm met evenwijdige lijnen, kruisarcering, stippels of
// lijnen die in dichtheid verlopen. De lijnen worden hier zelf binnen de vorm geknipt
// (even-oneven, dus gaten blijven open).
// Eigen werk, MIT-licentie (zie de README van deze repo).
'use strict';

const STANDAARD = {
  soort: 'lijnen', hoek: 45, afstand: 1.5, dikte: 0.5, stip: 0.6,
  verloop: 4, dikteMee: true, omkeren: false,
  kleur: 'vorm', vorm: 'omtrek',
};

const SOORTEN = {
  lijnen: 'Evenwijdige lijnen',
  kruis: 'Kruisarcering',
  stippels: 'Stippels',
  verloop: 'Verlopende lijnen',
};

const MAX_LIJNEN = 24000;
const MAX_STIPPELS = 11000;
const MAX_SUBPADEN = 1000;
const TOLERANTIE = 0.08; // pt: zo dicht volgen de lijnstukjes een kromme

const begrens = (n, min, max) => Math.min(max, Math.max(min, n));
const r3 = (n) => Math.round(n * 1000) / 1000;

// ---- kleur --------------------------------------------------------------------

const hexNaarRgb = (hex) => {
  const n = parseInt(String(hex).slice(1), 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const rgbNaarHex = (rgb) => '#' + rgb.map((v) => Math.round(begrens(v, 0, 255)).toString(16).padStart(2, '0')).join('');
function rgbNaarCmyk([r, g, b]) {
  const [rr, gg, bb] = [r / 255, g / 255, b / 255];
  const k = 1 - Math.max(rr, gg, bb);
  if (k >= 0.999) return [0, 0, 0, 100];
  return [(1 - rr - k) / (1 - k), (1 - gg - k) / (1 - k), (1 - bb - k) / (1 - k), k].map((n) => Math.round(n * 100));
}
function cmykNaarRgb([c, m, y, k]) {
  const z = 1 - k / 100;
  return [255 * (1 - c / 100) * z, 255 * (1 - m / 100) * z, 255 * (1 - y / 100) * z];
}
function kleurVoorDocument(k, cmyk) {
  if (cmyk) return k.cmyk ? { cmyk: k.cmyk.slice() } : { cmyk: rgbNaarCmyk(hexNaarRgb(k.hex)) };
  return k.hex ? { hex: k.hex } : { hex: rgbNaarHex(cmykNaarRgb(k.cmyk)) };
}
const kleurCss = (k) => (k.hex ? k.hex : rgbNaarHex(cmykNaarRgb(k.cmyk)));
const echteKleur = (k) => Boolean(k && (k.cmyk || k.hex));

// ---- vorm platmaken -----------------------------------------------------------

/** Voegt een kubische kromme a→b (met handvatten c1, c2) toe als lijnstukjes. */
function kromme(uit, a, c1, c2, b, diepte) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l = Math.hypot(dx, dy) || 1e-9;
  const d1 = Math.abs((c1.x - a.x) * dy - (c1.y - a.y) * dx) / l;
  const d2 = Math.abs((c2.x - a.x) * dy - (c2.y - a.y) * dx) / l;
  if (diepte > 14 || (d1 + d2 <= TOLERANTIE && Math.hypot(c1.x - a.x, c1.y - a.y) + Math.hypot(c2.x - b.x, c2.y - b.y) <= l * 2)) {
    uit.push({ x: b.x, y: b.y });
    return;
  }
  const m = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const ab = m(a, c1);
  const bc = m(c1, c2);
  const cd = m(c2, b);
  const abc = m(ab, bc);
  const bcd = m(bc, cd);
  const mid = m(abc, bcd);
  kromme(uit, a, ab, abc, mid, diepte + 1);
  kromme(uit, mid, bcd, cd, b, diepte + 1);
}

/** Maakt van de subpaden (met handvatten) gesloten veelhoeken. */
function veelhoeken(subpaden) {
  const uit = [];
  for (const sp of subpaden || []) {
    const p = sp.punten || [];
    if (p.length < 2) continue;
    const v = [{ x: p[0].x, y: p[0].y }];
    // elk subpad telt als gesloten: ook de laatste naar de eerste
    for (let i = 1; i <= p.length; i++) {
      const a = p[i - 1];
      const b = p[i % p.length];
      if (a.uit || b.in) kromme(v, a, a.uit || a, b.in || b, b, 0);
      else v.push({ x: b.x, y: b.y });
    }
    v.pop(); // het laatste punt is weer het eerste
    if (v.length >= 3) uit.push(v);
  }
  return uit;
}

// ---- knippen ------------------------------------------------------------------
// Draai de vorm zo dat de lijnen liggend lopen. Per hoogte y zoeken we waar de
// randen gekruist worden; tussen de 1e en 2e, 3e en 4e, ... kruising ligt binnen.

function maakSnijder(veelhoekenLijst, hoek, nietNul) {
  const c = Math.cos(hoek);
  const s = Math.sin(hoek);
  const randen = [];
  let ymin = Infinity;
  let ymax = -Infinity;
  let xmin = Infinity;
  let xmax = -Infinity;
  for (const v of veelhoekenLijst) {
    const q = v.map((p) => ({ x: p.x * c + p.y * s, y: -p.x * s + p.y * c }));
    for (let i = 0; i < q.length; i++) {
      const a = q[i];
      const b = q[(i + 1) % q.length];
      xmin = Math.min(xmin, a.x); xmax = Math.max(xmax, a.x);
      ymin = Math.min(ymin, a.y); ymax = Math.max(ymax, a.y);
      if (a.y === b.y) continue;
      const [lo, hi] = a.y < b.y ? [a, b] : [b, a];
      randen.push({ y0: lo.y, y1: hi.y, x0: lo.x, k: (hi.x - lo.x) / (hi.y - lo.y), d: a.y < b.y ? 1 : -1 });
    }
  }
  randen.sort((a, b) => a.y0 - b.y0);
  /**
   * De stukken binnen de vorm op hoogte y, als [begin, eind, begin, eind, ...].
   * Een rand telt half-open (y0 ≤ y < y1), zodat een hoekpunt nooit dubbel telt.
   * Even-oneven: om de andere kruising binnen. Bij 'nonzero' telt de looprichting.
   */
  const snij = (y) => {
    const xs = [];
    for (const r of randen) {
      if (r.y0 > y) break;
      if (y < r.y1) xs.push({ x: r.x0 + (y - r.y0) * r.k, d: r.d });
    }
    xs.sort((a, b) => a.x - b.x);
    if (!nietNul) return xs.map((q) => q.x);
    const uit = [];
    let teller = 0;
    for (const q of xs) {
      const was = teller;
      teller += q.d;
      if (was === 0 && teller !== 0) uit.push(q.x);
      else if (was !== 0 && teller === 0) uit.push(q.x);
    }
    return uit;
  };
  const terug = (x, y) => ({ x: r3(x * c - y * s), y: r3(x * s + y * c) });
  return { snij, terug, ymin, ymax, xmin, xmax };
}

/** De hoogtes van de lijnen: gelijk verdeeld, of verlopend van dicht naar ijl. */
function hoogtes(ymin, ymax, afstand, w) {
  const uit = [];
  const h = ymax - ymin;
  if (w.soort !== 'verloop') {
    const n = Math.max(1, Math.floor(h / afstand));
    const start = ymin + (h - (n - 1) * afstand) / 2;
    for (let i = 0; i < n; i++) uit.push({ y: start + i * afstand, t: 0 });
    return uit;
  }
  let y = ymin + afstand / 2;
  while (y < ymax && uit.length < 20000) {
    let t = (y - ymin) / (h || 1);
    if (w.omkeren) t = 1 - t;
    uit.push({ y, t });
    y += afstand * (1 + (w.verloop - 1) * Math.pow(t, 1.4));
  }
  return uit;
}

/** Rekent de arcering uit voor één vorm. Geeft lijnen [{ a, b, t }] of stippels [{ x, y }]. */
function arceer(veelhoekenLijst, w, nietNul) {
  const afstand = vexel.mm(w.afstand);
  const hoek = (w.hoek * Math.PI) / 180;
  if (w.soort === 'stippels') {
    const r = vexel.mm(w.stip) / 2;
    const S = maakSnijder(veelhoekenLijst, hoek, nietNul);
    const rij = afstand * 0.866;
    const binnen = (xs, x) => {
      let n = 0;
      for (const v of xs) if (v < x) n++;
      return n % 2 === 1;
    };
    const stippels = [];
    for (let y = Math.ceil(S.ymin / rij) * rij; y <= S.ymax; y += rij) {
      const xs = S.snij(y);
      if (xs.length < 2) continue;
      const boven = S.snij(y - r * 0.8);
      const onder = S.snij(y + r * 0.8);
      const verschuif = (Math.abs(Math.round(y / rij)) % 2) * 0.5;
      for (let i = 0; i + 1 < xs.length; i += 2) {
        const a = xs[i] + r;
        const b = xs[i + 1] - r;
        for (let j = Math.ceil(a / afstand - verschuif); (j + verschuif) * afstand <= b; j++) {
          const x = (j + verschuif) * afstand;
          if (!binnen(boven, x) || !binnen(onder, x)) continue;
          stippels.push(S.terug(x, y));
          if (stippels.length > MAX_STIPPELS) return { stippels, teVeel: true };
        }
      }
    }
    return { stippels };
  }
  const lijnen = [];
  const hoeken = w.soort === 'kruis' ? [hoek, hoek + Math.PI / 2] : [hoek];
  for (const h of hoeken) {
    const S = maakSnijder(veelhoekenLijst, h, nietNul);
    for (const { y, t } of hoogtes(S.ymin, S.ymax, afstand, w)) {
      const xs = S.snij(y);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        if (xs[i + 1] - xs[i] < 0.05) continue;
        lijnen.push({ a: S.terug(xs[i], y), b: S.terug(xs[i + 1], y), t });
        if (lijnen.length > MAX_LIJNEN) return { lijnen, teVeel: true };
      }
    }
  }
  return { lijnen };
}

// ---- vormen maken -------------------------------------------------------------

function stipSubpad(p, r) {
  const k = 0.5523 * r;
  const q = (x, y) => ({ x: r3(x), y: r3(y) });
  return {
    gesloten: true,
    punten: [
      { ...q(p.x, p.y - r), in: q(p.x - k, p.y - r), uit: q(p.x + k, p.y - r) },
      { ...q(p.x + r, p.y), in: q(p.x + r, p.y - k), uit: q(p.x + r, p.y + k) },
      { ...q(p.x, p.y + r), in: q(p.x + k, p.y + r), uit: q(p.x - k, p.y + r) },
      { ...q(p.x - r, p.y), in: q(p.x - r, p.y + k), uit: q(p.x - r, p.y - k) },
    ],
  };
}

/** Verdeelt subpaden over paden van hooguit MAX_SUBPADEN subpaden. */
function inPaden(subpaden, stijl) {
  const paden = [];
  for (let i = 0; i < subpaden.length; i += MAX_SUBPADEN) {
    paden.push({ soort: 'pad', ...stijl, subpaden: subpaden.slice(i, i + MAX_SUBPADEN) });
  }
  return paden;
}

function arceringVormen(uitkomst, w, kleur) {
  if (uitkomst.stippels) {
    const r = vexel.mm(w.stip) / 2;
    return inPaden(uitkomst.stippels.map((p) => stipSubpad(p, r)), { vulling: kleur, lijn: null });
  }
  const stijl = { vulling: null, lijn: kleur, lijneinde: 'butt' };
  if (w.soort === 'verloop' && w.dikteMee) {
    // zes diktes, van vol naar dun, elk als eigen pad
    const emmers = [[], [], [], [], [], []];
    for (const l of uitkomst.lijnen) emmers[Math.min(5, Math.floor(l.t * 6))].push(l);
    return emmers.flatMap((lijst, i) => inPaden(
      lijst.map((l) => ({ gesloten: false, punten: [l.a, l.b] })),
      { ...stijl, lijndikte: r3(Math.max(0.05, w.dikte * (1 - (0.72 * (i + 0.5)) / 6))) },
    ));
  }
  return inPaden(uitkomst.lijnen.map((l) => ({ gesloten: false, punten: [l.a, l.b] })), { ...stijl, lijndikte: w.dikte });
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

function metLabel(tekst, veld, eenheid) {
  const label = maak('span', { klasse: 'label', tekst, stijl: { minWidth: '0' } });
  const blok = maak('label', { stijl: { display: 'grid', gap: '3px', minWidth: '0' } }, label,
    eenheid
      ? maak('span', { stijl: { display: 'flex', alignItems: 'center', gap: '6px' } }, veld,
        maak('span', { klasse: 'uitleg', tekst: eenheid, stijl: { flex: 'none' } }))
      : veld);
  return Object.assign(blok, { labelEl: label });
}

const kolommen = (sjabloon, ...kinderen) =>
  maak('div', { stijl: { display: 'grid', gridTemplateColumns: sjabloon.replace(/([0-9.]+fr)/g, 'minmax(0, $1)'), gap: '10px', alignItems: 'end' } },
    ...kinderen);

function vinkje(tekst, aan) {
  const vak = maak('input', { type: 'checkbox' });
  vak.checked = Boolean(aan);
  return { vak, el: maak('label', { stijl: { display: 'flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap', height: '26px' } }, vak, tekst) };
}

// ---- het venster --------------------------------------------------------------

const SOORT_NAAM = { tekst: 'tekst', groep: 'een groep', beeld: 'een afbeelding' };

async function toonVenster() {
  const doc = await vexel.document();
  const cmyk = doc.kleurruimte === 'cmyk';
  let selectie;
  try {
    selectie = await vexel.selectie();
  } catch (fout) {
    vexel.melding(fout && fout.message ? fout.message : 'De selectie kon niet worden gelezen.', 'fout');
    vexel.sluit();
    return;
  }
  const vormen = [];
  const overgeslagen = [];
  for (const item of selectie) {
    const v = item.subpaden ? veelhoeken(item.subpaden) : [];
    if (v.length) vormen.push({ item, veelhoeken: v });
    else overgeslagen.push(item);
  }
  if (!selectie.length) {
    vexel.melding('Selecteer eerst een of meer gesloten vormen om te arceren.', 'let');
    vexel.sluit();
    return;
  }
  if (!vormen.length) {
    const soort = SOORT_NAAM[selectie[0].soort] || 'geen gesloten vorm';
    vexel.melding(`De selectie is ${soort}. Arcering werkt op paden en samengestelde paden; zet tekst eerst om naar paden en maak groepen los.`, 'let');
    vexel.sluit();
    return;
  }

  const w0 = { ...STANDAARD, ...((await vexel.haal('instellingen')) || {}) };
  const soort = keuzeVeld(Object.entries(SOORTEN), w0.soort);
  const hoek = getalVeld(w0.hoek, -360, 360, 5);
  const afstand = getalVeld(w0.afstand, 0.2, 50, 0.1);
  const dikte = getalVeld(w0.dikte, 0.05, 20, 0.05);
  const stip = getalVeld(w0.stip, 0.05, 20, 0.05);
  const verloop = getalVeld(w0.verloop, 1, 12, 0.5);
  const dikteMee = vinkje('Lijnen dunner', w0.dikteMee);
  const omkeren = vinkje('Andersom', w0.omkeren);
  const kleur = keuzeVeld([['vorm', 'Kleur van de vorm'], ['zwart', 'Zwart'], ['wit', 'Wit']], w0.kleur);
  const vorm = keuzeVeld([['omtrek', 'Omtrek houden, vulling weg'], ['vervangen', 'Alleen de arcering'],
    ['behouden', 'Vorm laten staan']], w0.vorm);

  const blokDikte = metLabel('Lijndikte', dikte, 'pt');
  const blokStip = metLabel('Stipgrootte', stip, 'mm');
  const blokVerloop = metLabel('Tot afstand ×', verloop);
  const verloopRij = kolommen('0.8fr 1.3fr 1fr', blokVerloop, dikteMee.el, omkeren.el);

  const doek = maak('canvas', { 'aria-hidden': 'true', stijl: { width: '100%', height: '175px' } });
  const samenvatting = maak('p', { klasse: 'uitleg', 'aria-live': 'polite', stijl: { margin: '0', minHeight: '2.9em' } });
  const maakKnop = maak('button', { klasse: 'knop primair', type: 'submit', tekst: 'Arceren' });
  const annuleer = maak('button', { klasse: 'knop', type: 'button', tekst: 'Annuleren', bijClick: () => vexel.sluit() });

  const formulier = maak('form', { stijl: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '10px', padding: '12px 14px 14px' } },
    doek,
    kolommen('1.4fr 1fr', metLabel('Soort', soort), metLabel('Hoek', hoek, '°')),
    kolommen('1fr 1fr', metLabel('Afstand', afstand, 'mm'), blokDikte, blokStip),
    verloopRij,
    kolommen('1fr 1.4fr', metLabel('Kleur', kleur), metLabel('Vorm', vorm)),
    samenvatting,
    maak('div', { klasse: 'knoppen', stijl: { marginTop: '0' } }, annuleer, maakKnop),
  );
  document.head.append(maak('style', { tekst: '.veld:disabled{opacity:.45}.knop{white-space:nowrap}' }));
  document.body.style.padding = '0';
  document.body.append(formulier);

  const waarden = () => ({
    soort: soort.value,
    hoek: begrens(leesGetal(hoek, 45), -360, 360),
    afstand: begrens(leesGetal(afstand, 1.5), 0.2, 50),
    dikte: begrens(leesGetal(dikte, 0.5), 0.05, 20),
    stip: begrens(leesGetal(stip, 0.6), 0.05, 20),
    verloop: begrens(leesGetal(verloop, 4), 1, 12),
    dikteMee: dikteMee.vak.checked,
    omkeren: omkeren.vak.checked,
    kleur: kleur.value,
    vorm: vorm.value,
  });
  const zwart = { cmyk: [0, 0, 0, 100], hex: '#000000' };
  const kleurVan = (item, w) => {
    if (w.kleur === 'zwart') return kleurVoorDocument(cmyk ? { cmyk: zwart.cmyk } : { hex: zwart.hex }, cmyk);
    if (w.kleur === 'wit') return cmyk ? { cmyk: [0, 0, 0, 0] } : { hex: '#ffffff' };
    const k = echteKleur(item.vulling) ? item.vulling : echteKleur(item.lijn) ? item.lijn : { cmyk: zwart.cmyk };
    return kleurVoorDocument(k, cmyk);
  };
  const bereken = (w) => {
    let aantal = 0;
    let teVeel = false;
    const per = vormen.map((v) => {
      const u = arceer(v.veelhoeken, w, v.item.vulregel === 'nonzero');
      aantal += (u.lijnen || u.stippels).length;
      teVeel = teVeel || Boolean(u.teVeel) || aantal > (u.stippels ? MAX_STIPPELS : MAX_LIJNEN);
      return u;
    });
    return { per, aantal, teVeel };
  };

  // het kader om alles heen, voor de voorvertoning
  const alle = vormen.flatMap((v) => v.veelhoeken.flat());
  const kx0 = Math.min(...alle.map((p) => p.x));
  const ky0 = Math.min(...alle.map((p) => p.y));
  const kx1 = Math.max(...alle.map((p) => p.x));
  const ky1 = Math.max(...alle.map((p) => p.y));

  let gepland = false;
  function teken() {
    gepland = false;
    const w = waarden();
    const stippels = w.soort === 'stippels';
    blokDikte.style.display = stippels ? 'none' : 'grid';
    blokStip.style.display = stippels ? 'grid' : 'none';
    verloopRij.style.display = w.soort === 'verloop' ? 'grid' : 'none';
    const r = bereken(w);

    const schaal = devicePixelRatio || 1;
    const kader = doek.getBoundingClientRect();
    doek.width = Math.round(kader.width * schaal);
    doek.height = Math.round(kader.height * schaal);
    const g = doek.getContext('2d');
    g.setTransform(schaal, 0, 0, schaal, 0, 0);
    g.clearRect(0, 0, kader.width, kader.height);
    const s = Math.min((kader.width - 20) / Math.max(1, kx1 - kx0), (kader.height - 20) / Math.max(1, ky1 - ky0));
    const ox = (kader.width - (kx1 - kx0) * s) / 2 - kx0 * s;
    const oy = (kader.height - (ky1 - ky0) * s) / 2 - ky0 * s;
    // papier achter de vormen, zodat je de echte kleuren ziet
    g.fillStyle = w.kleur === 'wit' ? '#3a3d45' : '#ffffff';
    g.fillRect(ox + kx0 * s - 8, oy + ky0 * s - 8, (kx1 - kx0) * s + 16, (ky1 - ky0) * s + 16);
    vormen.forEach((v, i) => {
      g.beginPath();
      for (const vh of v.veelhoeken) {
        vh.forEach((p, k) => (k ? g.lineTo(ox + p.x * s, oy + p.y * s) : g.moveTo(ox + p.x * s, oy + p.y * s)));
        g.closePath();
      }
      if (w.vorm === 'behouden') {
        g.fillStyle = echteKleur(v.item.vulling) ? kleurCss(v.item.vulling) : 'transparent';
        g.fill('evenodd');
      }
      const k = kleurCss(kleurVan(v.item, w));
      const u = r.per[i];
      if (u.stippels) {
        g.fillStyle = k;
        const rr = Math.max(0.5, (vexel.mm(w.stip) / 2) * s);
        for (const p of u.stippels) {
          g.beginPath();
          g.arc(ox + p.x * s, oy + p.y * s, rr, 0, Math.PI * 2);
          g.fill();
        }
      } else {
        g.strokeStyle = k;
        g.lineCap = 'butt';
        for (const l of u.lijnen) {
          const dun = w.soort === 'verloop' && w.dikteMee ? 1 - 0.72 * l.t : 1;
          g.lineWidth = Math.max(0.5, w.dikte * dun * s);
          g.beginPath();
          g.moveTo(ox + l.a.x * s, oy + l.a.y * s);
          g.lineTo(ox + l.b.x * s, oy + l.b.y * s);
          g.stroke();
        }
      }
      if (w.vorm !== 'vervangen') {
        g.beginPath();
        for (const vh of v.veelhoeken) {
          vh.forEach((p, k2) => (k2 ? g.lineTo(ox + p.x * s, oy + p.y * s) : g.moveTo(ox + p.x * s, oy + p.y * s)));
          g.closePath();
        }
        g.strokeStyle = w.kleur === 'wit' ? '#e8e9ec' : '#5b5f6a';
        g.lineWidth = 1;
        g.stroke();
      }
    });

    const wat = w.soort === 'stippels' ? 'stippels' : 'lijnen';
    let tekst = `${r.aantal.toLocaleString('nl-NL')} ${wat} in ${vormen.length} ${vormen.length === 1 ? 'vorm' : 'vormen'}, `
      + `${getal(w.afstand)} mm uit elkaar.`;
    if (overgeslagen.length) tekst += ` ${overgeslagen.length} geselecteerd object(en) overgeslagen: geen pad.`;
    if (w.vorm === 'behouden' && w.kleur === 'vorm') tekst += ' Let op: de arcering heeft dezelfde kleur als de vulling eronder.';
    if (r.teVeel) tekst = `Dat worden te veel ${wat} (meer dan ${(w.soort === 'stippels' ? MAX_STIPPELS : MAX_LIJNEN).toLocaleString('nl-NL')}). Maak de afstand groter.`;
    if (doc.alleenLezen) tekst = 'Dit document is alleen-lezen; je kunt hier niets aan veranderen.';
    samenvatting.textContent = tekst;
    samenvatting.classList.toggle('fout', r.teVeel);
    maakKnop.disabled = doc.alleenLezen || r.teVeel || !r.aantal;
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
    const r = bereken(w);
    if (r.teVeel) return vexel.melding('Dat worden te veel lijnen of stippels. Maak de afstand groter.', 'let');
    if (!r.aantal) return vexel.melding('De vorm is te klein voor deze afstand. Maak de afstand kleiner.', 'let');
    const naamSoort = { lijnen: `lijnen ${getal(w.hoek, 0)}°`, kruis: 'kruis', stippels: 'stippels', verloop: 'verloop' }[w.soort];
    const nieuw = vormen.map((v, i) => {
      const hatch = arceringVormen(r.per[i], w, kleurVan(v.item, w));
      const groep = { soort: 'groep', naam: `Arcering (${naamSoort})`, kinderen: hatch };
      if (w.vorm !== 'omtrek') return groep;
      const lijn = echteKleur(v.item.lijn) ? kleurVoorDocument(v.item.lijn, cmyk) : kleurVan(v.item, w);
      const omtrek = {
        soort: 'pad', naam: 'Omtrek', subpaden: v.item.subpaden.map((sp) => ({
          gesloten: true,
          punten: sp.punten.map((p) => {
            const q = { x: p.x, y: p.y };
            if (p.in) q.in = { x: p.in.x, y: p.in.y };
            if (p.uit) q.uit = { x: p.uit.x, y: p.uit.y };
            return q;
          }),
        })),
        vulling: null, lijn, lijndikte: v.item.lijndikte > 0 ? v.item.lijndikte : 0.5,
      };
      return { soort: 'groep', naam: `${(v.item.naam || 'Vorm').slice(0, 80)}, gearceerd`, kinderen: hatch.length ? [groep, omtrek] : [omtrek] };
    }).filter((v) => v.kinderen.length);
    // alleen paden worden vervangen; wat overgeslagen is, blijft dan ook staan
    const vervang = w.vorm !== 'behouden' && !overgeslagen.length;

    maakKnop.disabled = true;
    try {
      await vexel.maak(nieuw, vervang ? { vervangSelectie: true } : undefined);
      await vexel.bewaar('instellingen', w);
      let melding = `Gearceerd: ${r.aantal.toLocaleString('nl-NL')} ${w.soort === 'stippels' ? 'stippels' : 'lijnen'}.`;
      if (w.vorm !== 'behouden' && !vervang) melding += ' De originele vormen staan er nog, omdat er ook iets anders geselecteerd was.';
      vexel.melding(melding, 'ok');
      vexel.sluit();
    } catch (fout) {
      maakKnop.disabled = false;
      vexel.melding(fout && fout.message ? fout.message : 'De arcering kon niet worden gemaakt.', 'fout');
    }
  });

  teken();
  soort.focus();
}

vexel.opCommando('arceren', toonVenster);
