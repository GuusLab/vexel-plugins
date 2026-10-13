// Doosontwerp: stansvorm voor een vouwdoos met insteekkleppen (rechte of omgekeerde insteek).
// Eigen werk, MIT-licentie (zie de README van deze repo).
'use strict';

const STANDAARD = {
  lengte: 60, breedte: 30, hoogte: 100, dikte: 0.4, lijmklep: 15, insteek: 15,
  sluiting: 'recht', stof: 'auto', stofHoogte: 25, afronding: 3, panelen: true,
};

const SLUITINGEN = {
  recht: 'Rechte insteek',
  omgekeerd: 'Omgekeerde insteek',
};

const PT = vexel.mm(1);

// ---- kleine hulpjes --------------------------------------------------------

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

const getalVeld = (id, waarde, min, max, stap) =>
  maak('input', { klasse: 'veld', id, type: 'number', value: waarde, min, max, step: stap, inputmode: 'decimal' });

function veldMetLabel(tekst, veld, eenheid) {
  veld.style.width = '100%';
  veld.style.minWidth = '0';
  const kop = maak('span', { klasse: 'label', tekst, stijl: { minWidth: '0', whiteSpace: 'nowrap' } });
  if (eenheid) kop.append(maak('span', { tekst: ` (${eenheid})`, stijl: { opacity: '0.7' } }));
  return maak('label', { stijl: { display: 'grid', gap: '4px', minWidth: '0' } }, kop, veld);
}

const keuzeLijst = (id, opties, waarde) => {
  const el = maak('select', { klasse: 'veld', id },
    ...Object.entries(opties).map(([w, t]) => maak('option', { value: w, tekst: t })));
  el.value = opties[waarde] ? waarde : Object.keys(opties)[0];
  return el;
};

const leesGetal = (veld, terugval) => {
  const n = Number(String(veld.value).replace(',', '.'));
  return Number.isFinite(n) ? n : terugval;
};
const begrens = (n, min, max) => Math.min(max, Math.max(min, n));
const mmTekst = (n) => n.toLocaleString('nl-NL', { maximumFractionDigits: 1 });
const css = (naam, terugval) => getComputedStyle(document.documentElement).getPropertyValue(naam).trim() || terugval;

// ---- afgeronde hoeken --------------------------------------------------------

/**
 * Zet een lijst hoekpunten { x, y, r } om in padpunten met bezierhandvatten.
 * Een hoek met r > 0 wordt een cirkelboog; r wordt zo nodig kleiner gemaakt
 * zodat twee bogen op één zijde elkaar nooit overlappen.
 */
function rondHoeken(punten, gesloten = true) {
  const n = punten.length;
  const uit = [];
  for (let i = 0; i < n; i++) {
    const p = punten[i];
    const r = p.r || 0;
    const rand = !gesloten && (i === 0 || i === n - 1);
    if (!(r > 0) || rand) {
      uit.push({ x: p.x, y: p.y });
      continue;
    }
    const a = punten[(i - 1 + n) % n];
    const b = punten[(i + 1) % n];
    const l1 = Math.hypot(a.x - p.x, a.y - p.y);
    const l2 = Math.hypot(b.x - p.x, b.y - p.y);
    if (l1 < 1e-6 || l2 < 1e-6) {
      uit.push({ x: p.x, y: p.y });
      continue;
    }
    const v1 = { x: (a.x - p.x) / l1, y: (a.y - p.y) / l1 };
    const v2 = { x: (b.x - p.x) / l2, y: (b.y - p.y) / l2 };
    const hoek = Math.acos(begrens(v1.x * v2.x + v1.y * v2.y, -1, 1));
    if (hoek < 1e-3 || Math.PI - hoek < 1e-3) {
      uit.push({ x: p.x, y: p.y });
      continue;
    }
    const t = Math.tan(hoek / 2);
    const d = Math.min(r / t, l1 / 2, l2 / 2);
    const straal = d * t;
    const h = (4 / 3) * Math.tan((Math.PI - hoek) / 4) * straal;
    const p1 = { x: p.x + v1.x * d, y: p.y + v1.y * d };
    const p2 = { x: p.x + v2.x * d, y: p.y + v2.y * d };
    uit.push({ x: p1.x, y: p1.y, uit: { x: p1.x - v1.x * h, y: p1.y - v1.y * h } });
    uit.push({ x: p2.x, y: p2.y, in: { x: p2.x - v2.x * h, y: p2.y - v2.y * h } });
  }
  return uit;
}

// ---- de uitslag (alles in mm, y omlaag) ---------------------------------------

/**
 * Rekent de uitslag uit. De vier wanden staan naast elkaar: achterkant,
 * zijkant, voorkant, zijkant, met de lijmklep links aan de achterkant.
 * Wanden en kleppen zijn binnenmaat + materiaaldikte (rillijn tot rillijn),
 * de insteekklep is per kant een materiaaldikte smaller dan de deksel.
 */
function ontwerp(w) {
  const t = w.dikte;
  const Lp = w.lengte + t;
  const Wp = w.breedte + t;
  const Hp = w.hoogte + t;
  const D = w.breedte + t;
  const T = w.insteek;
  const g = w.lijmklep;
  const r = w.afronding;
  const inzet = Math.max(t, 0.5);
  let F = 0;
  if (w.stof === 'auto') F = Math.round(Math.min(0.45 * w.lengte, D + T / 2) * 2) / 2;
  else if (w.stof === 'eigen') F = w.stofHoogte;

  const fouten = [];
  if (g >= Wp) fouten.push('De lijmklep is breder dan de zijkant: maak hem smaller dan ' + mmTekst(Wp) + ' mm.');
  if (F > w.lengte / 2) fouten.push('De stofkleppen zijn te hoog: ze mogen hooguit de halve lengte zijn (' + mmTekst(w.lengte / 2) + ' mm).');
  if (T > Hp * 0.9) fouten.push('De insteekklep is te diep voor deze hoogte; maak hem kleiner.');
  if (2 * inzet + 2 * r >= Lp) fouten.push('De lengte is te klein voor de insteekklep; maak de doos langer of de afronding kleiner.');

  const kolommen = [
    { naam: 'Achterkant', soort: 'L', x0: 0, b: Lp },
    { naam: 'Zijkant', soort: 'W', x0: Lp, b: Wp },
    { naam: 'Voorkant', soort: 'L', x0: Lp + Wp, b: Lp },
    { naam: 'Zijkant', soort: 'W', x0: 2 * Lp + Wp, b: Wp },
  ];
  const X = 2 * Lp + 2 * Wp;
  const bodemOp = w.sluiting === 'omgekeerd' ? 'Voorkant' : 'Achterkant';
  const klepBoven = (k) => (k.soort === 'W' ? (F > 0 ? 'stof' : 'vlak') : (k.naam === 'Achterkant' ? 'klep' : 'vlak'));
  const klepOnder = (k) => (k.soort === 'W' ? (F > 0 ? 'stof' : 'vlak') : (k.naam === bodemOp ? 'klep' : 'vlak'));

  const rTong = Math.min(r * 1.5, T * 0.8);
  const taps = Math.min(F * 0.35, Wp * 0.25);

  // Profiel van een rand boven een wand, van (x0, 0) naar (x1, 0), naar boven (y < 0).
  function profiel(soort, x0, x1) {
    if (soort === 'klep') {
      return [
        { x: x0, y: 0 }, { x: x0, y: -D }, { x: x0 + inzet, y: -D },
        { x: x0 + inzet, y: -D - T, r: rTong }, { x: x1 - inzet, y: -D - T, r: rTong },
        { x: x1 - inzet, y: -D }, { x: x1, y: -D }, { x: x1, y: 0 },
      ];
    }
    if (soort === 'stof') {
      return [{ x: x0, y: 0 }, { x: x0 + taps, y: -F, r }, { x: x1 - taps, y: -F, r }, { x: x1, y: 0 }];
    }
    return [{ x: x0, y: 0 }, { x: x1, y: 0 }];
  }
  const spiegel = (p) => ({ ...p, y: Hp - p.y });

  // De buitencontour als één gesloten lijn, met de klok mee.
  const schuin = Math.min(g * 0.6, Hp * 0.2);
  const omtrek = [{ x: 0, y: Hp }, { x: -g, y: Hp - schuin, r: Math.min(r, g / 2) }, { x: -g, y: schuin, r: Math.min(r, g / 2) }, { x: 0, y: 0 }];
  for (const k of kolommen) omtrek.push(...profiel(klepBoven(k), k.x0, k.x0 + k.b).slice(1));
  omtrek.push({ x: X, y: Hp });
  for (const k of [...kolommen].reverse()) {
    omtrek.push(...profiel(klepOnder(k), k.x0, k.x0 + k.b).map(spiegel).reverse().slice(1));
  }
  omtrek.pop();
  const schoon = omtrek.filter((p, i) => {
    const v = omtrek[(i - 1 + omtrek.length) % omtrek.length];
    return Math.hypot(p.x - v.x, p.y - v.y) > 1e-6;
  });

  // Rillijnen: elke vouw één keer, nooit onder een snijlijn.
  const rillen = [];
  for (const x of [0, Lp, Lp + Wp, 2 * Lp + Wp]) rillen.push([{ x, y: 0 }, { x, y: Hp }]);
  for (const k of kolommen) {
    const x1 = k.x0 + k.b;
    for (const [soort, y, richting] of [[klepBoven(k), 0, -1], [klepOnder(k), Hp, 1]]) {
      if (soort === 'vlak') continue;
      rillen.push([{ x: k.x0, y }, { x: x1, y }]);
      if (soort === 'klep') rillen.push([{ x: k.x0 + inzet, y: y + richting * D }, { x: x1 - inzet, y: y + richting * D }]);
    }
  }

  // Hulpvlakken met namen.
  const maatTekst = (b, h) => `${mmTekst(b)} × ${mmTekst(h)} mm`;
  const vlakken = [{
    naam: 'Lijmklep', klep: true, label: 'Lijmklep',
    punten: [{ x: 0, y: Hp }, { x: -g, y: Hp - schuin, r: Math.min(r, g / 2) }, { x: -g, y: schuin, r: Math.min(r, g / 2) }, { x: 0, y: 0 }],
  }];
  for (const k of kolommen) {
    const x1 = k.x0 + k.b;
    vlakken.push({
      naam: k.naam, label: `${k.naam}\n${maatTekst(k.b, Hp)}`,
      punten: [{ x: k.x0, y: 0 }, { x: x1, y: 0 }, { x: x1, y: Hp }, { x: k.x0, y: Hp }],
    });
    for (const [soort, onder] of [[klepBoven(k), false], [klepOnder(k), true]]) {
      const m = onder ? spiegel : (p) => p;
      if (soort === 'stof') {
        vlakken.push({ naam: 'Stofklep', klep: true, label: 'Stofklep', punten: profiel('stof', k.x0, x1).map(m) });
      } else if (soort === 'klep') {
        const naam = onder ? 'Bodemklep' : 'Deksel';
        vlakken.push({
          naam, label: `${naam}\n${maatTekst(k.b, D)}`,
          punten: [{ x: k.x0, y: 0 }, { x: k.x0, y: -D }, { x: x1, y: -D }, { x: x1, y: 0 }].map(m),
        });
        vlakken.push({ naam: 'Insteekklep', klep: true, label: 'Insteekklep', punten: profiel('klep', k.x0, x1).slice(2, 6).map(m) });
      }
    }
  }

  const xs = schoon.map((p) => p.x);
  const ys = schoon.map((p) => p.y);
  const kader = { x: Math.min(...xs), y: Math.min(...ys), b: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  return { omtrek: schoon, rillen, vlakken, kader, fouten, F };
}

/** Plaatst de uitslag midden op het tekengebied; draait hem een kwartslag als hij alleen zo past. */
function plaats(uitslag, tekengebied) {
  const tb = tekengebied.b / PT;
  const th = tekengebied.h / PT;
  const k = uitslag.kader;
  const pastRecht = k.b <= tb && k.h <= th;
  const pastGedraaid = k.h <= tb && k.b <= th;
  const draai = !pastRecht && pastGedraaid;
  const bb = draai ? k.h : k.b;
  const bh = draai ? k.b : k.h;
  const ox = (tb - bb) / 2;
  const oy = (th - bh) / 2;
  const f = draai
    ? (p) => ({ x: (ox + (k.y + k.h - p.y)) * PT, y: (oy + (p.x - k.x)) * PT })
    : (p) => ({ x: (ox + p.x - k.x) * PT, y: (oy + p.y - k.y) * PT });
  return { f, draai, past: pastRecht || pastGedraaid, b: bb, h: bh };
}

const zetOm = (punten, f) => punten.map((p) => ({ ...f(p), r: p.r ? p.r * PT : 0 }));

// ---- de vormen voor Vexel -------------------------------------------------------

function bouwVormen(w, uitslag, plek, cmyk) {
  const kleur = (c, h) => (cmyk ? { cmyk: c } : { hex: h });
  const snij = kleur([0, 100, 0, 0], '#e5007d');
  const ril = kleur([100, 0, 0, 0], '#009fe3');
  const lijn = { vulling: null, lijndikte: 0.25, lijnhoek: 'round', lijneinde: 'butt' };

  const kinderen = [];
  if (w.panelen) {
    const vlakVormen = [];
    for (const v of uitslag.vlakken) {
      const pt = zetOm(v.punten, plek.f);
      vlakVormen.push({
        soort: 'pad', naam: v.naam, subpaden: [{ gesloten: true, punten: rondHoeken(pt) }],
        vulling: v.klep ? kleur([0, 0, 0, 7], '#ededed') : kleur([0, 2, 10, 0], '#fdf8e6'), lijn: null,
      });
    }
    for (const v of uitslag.vlakken) {
      const pt = zetOm(v.punten, plek.f);
      const xs = pt.map((p) => p.x);
      const ys = pt.map((p) => p.y);
      const b = Math.max(...xs) - Math.min(...xs);
      const h = Math.max(...ys) - Math.min(...ys);
      const regels = v.label.split('\n');
      const grootte = begrens(Math.min(b / (regels[0].length * 0.62), h / (regels.length * 1.6)), 3.5, 9);
      if (grootte < 3.6 && v.klep) continue;
      const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
      const cy = (Math.max(...ys) + Math.min(...ys)) / 2;
      vlakVormen.push({
        soort: 'tekst', naam: `Label ${v.naam.toLowerCase()}`, inhoud: v.label, grootte, uitlijning: 'midden',
        gewicht: v.klep ? 400 : 600, regelafstand: grootte * 1.25,
        x: cx, y: cy - ((regels.length - 1) * grootte * 1.25) / 2 + grootte * 0.35,
        vulling: kleur([0, 0, 0, 65], '#595959'), lijn: null,
      });
    }
    kinderen.push({ soort: 'groep', naam: 'Panelen', kinderen: vlakVormen });
  }
  kinderen.push({
    soort: 'groep', naam: 'Rillijn',
    kinderen: [{
      soort: 'pad', naam: 'Rillijnen', ...lijn, lijn: ril, streep: [vexel.mm(2), vexel.mm(1)],
      subpaden: uitslag.rillen.map((l) => ({ gesloten: false, punten: l.map(plek.f) })),
    }],
  });
  kinderen.push({
    soort: 'groep', naam: 'Snijlijn',
    kinderen: [{
      soort: 'pad', naam: 'Snijlijn buitenkant', ...lijn, lijn: snij,
      subpaden: [{ gesloten: true, punten: rondHoeken(zetOm(uitslag.omtrek, plek.f)) }],
    }],
  });
  const soort = w.sluiting === 'omgekeerd' ? 'omgekeerde insteek' : 'rechte insteek';
  return [{
    soort: 'groep', naam: `Doos ${mmTekst(w.lengte)} × ${mmTekst(w.breedte)} × ${mmTekst(w.hoogte)} mm, ${soort}`,
    kinderen,
  }];
}

// ---- voorvertoning --------------------------------------------------------------

function padOpCanvas(g, punten, gesloten, f) {
  if (!punten.length) return;
  const q = (p) => f(p);
  const eerste = q(punten[0]);
  g.moveTo(eerste.x, eerste.y);
  const n = punten.length;
  for (let i = 1; i <= (gesloten ? n : n - 1); i++) {
    const a = punten[i - 1];
    const b = punten[i % n];
    const c1 = q(a.uit || a);
    const c2 = q(b.in || b);
    const e = q(b);
    g.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, e.x, e.y);
  }
  if (gesloten) g.closePath();
}

// ---- het venster -----------------------------------------------------------------

async function toonVenster() {
  const doc = await vexel.document();
  const w0 = { ...STANDAARD, ...((await vexel.haal('instellingen')) || {}) };

  const v = {
    lengte: getalVeld('lengte', w0.lengte, 5, 1000, 0.5),
    breedte: getalVeld('breedte', w0.breedte, 5, 1000, 0.5),
    hoogte: getalVeld('hoogte', w0.hoogte, 5, 1000, 0.5),
    dikte: getalVeld('dikte', w0.dikte, 0, 3, 0.05),
    lijmklep: getalVeld('lijmklep', w0.lijmklep, 5, 60, 0.5),
    insteek: getalVeld('insteek', w0.insteek, 5, 80, 0.5),
    stofHoogte: getalVeld('stofHoogte', w0.stofHoogte, 3, 500, 0.5),
    afronding: getalVeld('afronding', w0.afronding, 0, 20, 0.5),
  };
  const sluiting = keuzeLijst('sluiting', SLUITINGEN, w0.sluiting);
  const stof = keuzeLijst('stof', { auto: 'Automatisch', eigen: 'Eigen hoogte', geen: 'Geen' }, w0.stof);
  const panelen = maak('input', { type: 'checkbox', id: 'panelen', stijl: { margin: '0' } });
  panelen.checked = w0.panelen !== false;

  const voorbeeld = maak('canvas', { 'aria-hidden': 'true', stijl: { width: '100%', height: '150px' } });
  const samenvatting = maak('p', { klasse: 'uitleg', 'aria-live': 'polite', stijl: { margin: '0', minHeight: '32px' } });
  const maakKnop = maak('button', { klasse: 'knop primair', type: 'submit', tekst: 'Stansvorm maken' });
  const annuleer = maak('button', { klasse: 'knop', type: 'button', tekst: 'Annuleren', bijClick: () => vexel.sluit() });

  const drie = (...k) => maak('div', { stijl: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' } }, ...k);
  const twee = (...k) => maak('div', { stijl: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' } }, ...k);
  const regel = 'Wanden = binnenmaat + dikte; de insteekklep is per kant een dikte smaller.';
  const kop = (tekst) => maak('div', { klasse: 'label', tekst, stijl: { fontWeight: '600', color: 'var(--tekst)', margin: '2px 0 -4px' } });
  const stofHoogteVak = veldMetLabel('Hoogte stofklep', v.stofHoogte, 'mm');
  const sluitingUitleg = maak('p', { klasse: 'uitleg', stijl: { margin: '-4px 0 0' } });

  const formulier = maak('form', { stijl: { display: 'grid', gap: '10px' } },
    kop('Binnenmaten'),
    drie(veldMetLabel('Lengte', v.lengte, 'mm'), veldMetLabel('Breedte', v.breedte, 'mm'), veldMetLabel('Hoogte', v.hoogte, 'mm')),
    kop('Materiaal en kleppen'),
    drie(veldMetLabel('Dikte', v.dikte, 'mm'), veldMetLabel('Lijmklep', v.lijmklep, 'mm'), veldMetLabel('Insteekklep', v.insteek, 'mm')),
    maak('p', { klasse: 'uitleg', tekst: regel, stijl: { margin: '-4px 0 0' } }),
    twee(veldMetLabel('Sluiting', sluiting), veldMetLabel('Stofkleppen', stof)),
    sluitingUitleg,
    twee(stofHoogteVak, veldMetLabel('Hoekafronding kleppen', v.afronding, 'mm')),
    maak('label', { stijl: { display: 'flex', gap: '6px', alignItems: 'center' } },
      panelen, maak('span', { tekst: 'Panelen met namen (hulpvlakken, niet om te drukken)' })),
    maak('div', { stijl: { background: 'var(--bg-2)', border: '1px solid var(--lijn)', borderRadius: '6px', padding: '6px' } }, voorbeeld),
    samenvatting,
    maak('div', { klasse: 'knoppen', stijl: { marginTop: '0' } }, annuleer, maakKnop),
  );
  document.body.append(formulier);

  const waarden = () => ({
    lengte: begrens(leesGetal(v.lengte, 60), 5, 1000),
    breedte: begrens(leesGetal(v.breedte, 30), 5, 1000),
    hoogte: begrens(leesGetal(v.hoogte, 100), 5, 1000),
    dikte: begrens(leesGetal(v.dikte, 0.4), 0, 3),
    lijmklep: begrens(leesGetal(v.lijmklep, 15), 5, 60),
    insteek: begrens(leesGetal(v.insteek, 15), 5, 80),
    stofHoogte: begrens(leesGetal(v.stofHoogte, 25), 3, 500),
    afronding: begrens(leesGetal(v.afronding, 3), 0, 20),
    sluiting: sluiting.value,
    stof: stof.value,
    panelen: panelen.checked,
  });

  function bereken() {
    const w = waarden();
    const uitslag = ontwerp(w);
    const plek = plaats(uitslag, doc.tekengebied);
    return { w, uitslag, plek };
  }

  function teken() {
    const { w, uitslag, plek } = bereken();
    sluitingUitleg.textContent = w.sluiting === 'omgekeerd'
      ? 'Deksel scharniert aan de achterkant, bodem aan de voorkant.'
      : 'Deksel en bodem scharnieren allebei aan de achterkant.';
    stofHoogteVak.style.opacity = w.stof === 'eigen' ? '1' : '0.45';
    v.stofHoogte.disabled = w.stof !== 'eigen';

    let tekst = `Uitslag ${mmTekst(plek.b)} × ${mmTekst(plek.h)} mm`;
    if (w.stof === 'auto' && uitslag.F) tekst += `, stofkleppen ${mmTekst(uitslag.F)} mm`;
    tekst += plek.draai ? ', een kwartslag gedraaid zodat hij past.' : '.';
    if (!plek.past) {
      tekst += ` Past niet op het tekengebied (${mmTekst(doc.tekengebied.b / PT)} × ${mmTekst(doc.tekengebied.h / PT)} mm): `
        + 'maak het tekengebied groter of de doos kleiner.';
    }
    if (doc.alleenLezen) tekst = 'Dit document is alleen-lezen; je kunt hier geen stansvorm maken.';
    if (uitslag.fouten.length) tekst = uitslag.fouten[0];
    samenvatting.textContent = tekst;
    samenvatting.classList.toggle('fout', Boolean(uitslag.fouten.length) || !plek.past);
    maakKnop.disabled = doc.alleenLezen || Boolean(uitslag.fouten.length);

    const schaal = devicePixelRatio || 1;
    const kader = voorbeeld.getBoundingClientRect();
    voorbeeld.width = Math.round(kader.width * schaal);
    voorbeeld.height = Math.round(kader.height * schaal);
    const g = voorbeeld.getContext('2d');
    g.setTransform(schaal, 0, 0, schaal, 0, 0);
    g.clearRect(0, 0, kader.width, kader.height);
    const tb = doc.tekengebied.b;
    const th = doc.tekengebied.h;
    const bx = Math.min(-plek.b * PT / 2 + tb / 2, 0);
    const by = Math.min(-plek.h * PT / 2 + th / 2, 0);
    const bb = Math.max(tb, plek.b * PT);
    const bh = Math.max(th, plek.h * PT);
    const s = Math.min((kader.width - 8) / bb, (kader.height - 8) / bh);
    const ox = (kader.width - bb * s) / 2 - bx * s;
    const oy = (kader.height - bh * s) / 2 - by * s;
    const f = (p) => ({ x: ox + p.x * s, y: oy + p.y * s });

    g.fillStyle = css('--bg', vexel.thema.bg);
    g.fillRect(ox, oy, tb * s, th * s);
    g.strokeStyle = plek.past ? css('--lijn', vexel.thema.lijn) : '#ff5c5c';
    g.lineWidth = 1;
    g.strokeRect(ox + 0.5, oy + 0.5, tb * s - 1, th * s - 1);

    if (w.panelen) {
      for (const vl of uitslag.vlakken) {
        g.beginPath();
        padOpCanvas(g, rondHoeken(zetOm(vl.punten, plek.f)), true, f);
        g.fillStyle = vl.klep ? 'rgba(160, 170, 185, 0.16)' : 'rgba(90, 162, 255, 0.18)';
        g.fill();
      }
    }
    g.lineWidth = 1;
    g.setLineDash([4, 2.5]);
    g.strokeStyle = '#38b6f0';
    g.beginPath();
    for (const l of uitslag.rillen) padOpCanvas(g, l.map(plek.f), false, f);
    g.stroke();
    g.setLineDash([]);
    g.strokeStyle = '#ff4fb4';
    g.lineWidth = 1.2;
    g.beginPath();
    padOpCanvas(g, rondHoeken(zetOm(uitslag.omtrek, plek.f)), true, f);
    g.stroke();
  }

  formulier.addEventListener('input', teken);
  formulier.addEventListener('change', teken);
  formulier.addEventListener('submit', async (gebeurtenis) => {
    gebeurtenis.preventDefault();
    const { w, uitslag, plek } = bereken();
    if (doc.alleenLezen) return vexel.melding('Dit document is alleen-lezen.', 'let');
    if (uitslag.fouten.length) return vexel.melding(uitslag.fouten[0], 'let');

    maakKnop.disabled = true;
    try {
      await vexel.maak(bouwVormen(w, uitslag, plek, doc.kleurruimte === 'cmyk'));
      await vexel.bewaar('instellingen', w);
      if (plek.past) {
        vexel.melding(`Stansvorm gemaakt: uitslag ${mmTekst(plek.b)} × ${mmTekst(plek.h)} mm${plek.draai ? ' (gedraaid)' : ''}.`, 'ok');
      } else {
        vexel.melding(`Stansvorm gemaakt, maar de uitslag (${mmTekst(plek.b)} × ${mmTekst(plek.h)} mm) is groter dan het tekengebied.`, 'let');
      }
      vexel.sluit();
    } catch (fout) {
      maakKnop.disabled = false;
      vexel.melding(fout && fout.message ? fout.message : 'De stansvorm kon niet worden gemaakt.', 'fout');
    }
  });

  teken();
  v.lengte.focus();
  v.lengte.select();
}

vexel.opCommando('maken', toonVenster);
