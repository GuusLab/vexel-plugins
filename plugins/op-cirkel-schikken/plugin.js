// Op cirkel schikken: zet de geselecteerde objecten op een cirkel of boog.
// Eigen werk, MIT-licentie (zie de README van deze repo).
'use strict';

const STANDAARD = { beginhoek: 0, boog: 360, middelpunt: 'selectie', volgorde: 'hoek', richting: 'mee', meedraaien: 'geen' };

// ---- kleine hulpjes voor het venster ------------------------------------

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

function getalVeld(waarde, min, max, stap) {
  return maak('input', { klasse: 'veld', type: 'number', value: waarde, min, max, step: stap, inputmode: 'decimal' });
}

function keuzeVeld(opties, waarde) {
  const veld = maak('select', { klasse: 'veld' }, ...opties.map(([w, t]) => maak('option', { value: w, tekst: t })));
  veld.value = opties.some(([w]) => w === waarde) ? waarde : opties[0][0];
  return veld;
}

function veldMetLabel(labelTekst, veld, eenheid, extra) {
  const regel = maak('div', { stijl: { display: 'flex', alignItems: 'center', gap: '6px' } }, veld);
  veld.style.flex = '1';
  veld.style.minWidth = '0';
  if (eenheid) regel.append(maak('span', { klasse: 'uitleg', tekst: eenheid }));
  if (extra) regel.append(extra);
  return maak('label', { stijl: { display: 'grid', gap: '4px', minWidth: '0', alignContent: 'start' } }, maak('span', { klasse: 'label', tekst: labelTekst }), regel);
}

const leesGetal = (veld, terugval) => {
  const n = Number(String(veld.value).replace(',', '.'));
  return Number.isFinite(n) ? n : terugval;
};
const begrens = (n, min, max) => Math.min(max, Math.max(min, n));
const getalTekst = (n, cijfers = 1) => n.toLocaleString('nl-NL', { maximumFractionDigits: cijfers, useGrouping: false });
const css = (naam, terugval) => getComputedStyle(document.documentElement).getPropertyValue(naam).trim() || terugval;
const RAD = Math.PI / 180;

/** Hoek in graden naar (-180, 180]. */
function normaleHoek(g) {
  let h = ((g % 360) + 360) % 360;
  if (h > 180) h -= 360;
  return Math.abs(h) < 1e-9 ? 0 : h;
}

// ---- selectie ------------------------------------------------------------

async function leesSelectie() {
  const items = await vexel.selectie();
  return items.filter((o) => o && o.kader && Number.isFinite(o.kader.x) && Number.isFinite(o.kader.b));
}

function omhullende(items) {
  const x0 = Math.min(...items.map((o) => o.kader.x));
  const y0 = Math.min(...items.map((o) => o.kader.y));
  const x1 = Math.max(...items.map((o) => o.kader.x + o.kader.b));
  const y1 = Math.max(...items.map((o) => o.kader.y + o.kader.h));
  return { x: x0, y: y0, b: x1 - x0, h: y1 - y0 };
}

const midden = (k) => ({ x: k.x + k.b / 2, y: k.y + k.h / 2 });

// ---- de rekensom ----------------------------------------------------------

/** De hoekstap tussen twee objecten (graden). Op een hele cirkel n gelijke
    stukken, op een boog n - 1 (het eerste en laatste object op de uiteinden). */
function stapVan(n, boog) {
  if (n < 2) return 0;
  return boog >= 359.999 ? 360 / n : boog / (n - 1);
}

/** Een straal waarbij de objecten elkaar net niet raken (met wat lucht). */
function passendeStraal(items, boog) {
  const n = items.length;
  const grootste = Math.max(...items.map((o) => Math.hypot(o.kader.b, o.kader.h)));
  const stap = Math.min(180, stapVan(n, boog)) * RAD;
  const nodig = n < 2 || stap <= 0 ? grootste : (grootste * 1.15) / (2 * Math.sin(stap / 2));
  const k = omhullende(items);
  return Math.max(nodig, Math.min(k.b, k.h) / 2, vexel.mm(5));
}

/** Zet de objecten in volgorde langs de cirkel. */
function sorteer(items, w, m) {
  const lijst = items.map((o, i) => ({ o, i, c: midden(o.kader) }));
  const richting = w.richting === 'tegen' ? -1 : 1;
  if (w.volgorde === 'links') lijst.sort((a, b) => a.c.x - b.c.x || a.c.y - b.c.y || a.i - b.i);
  else if (w.volgorde === 'boven') lijst.sort((a, b) => a.c.y - b.c.y || a.c.x - b.c.x || a.i - b.i);
  else if (w.volgorde === 'hoek') {
    // hoe ver een object nu (in de looprichting) van de beginhoek staat
    const verder = (c) => {
      const dx = c.x - m.x;
      const dy = c.y - m.y;
      if (Math.hypot(dx, dy) < 1e-6) return 0;
      const hoek = Math.atan2(dx, -dy) / RAD; // 0 = boven, met de klok mee
      return (((richting * (hoek - w.beginhoek)) % 360) + 360) % 360;
    };
    lijst.forEach((r) => { r.hoek = verder(r.c); r.afstand = Math.hypot(r.c.x - m.x, r.c.y - m.y); });
    lijst.sort((a, b) => a.hoek - b.hoek || a.afstand - b.afstand || a.i - b.i);
  }
  return lijst;
}

/** Het plan: per object de nieuwe plek en draaiing. */
function bereken(items, w, doc) {
  const n = items.length;
  const m = w.middelpunt === 'tekengebied'
    ? { x: doc.tekengebied.b / 2, y: doc.tekengebied.h / 2 }
    : midden(omhullende(items));
  const r = vexel.mm(w.straal);
  const stap = stapVan(n, w.boog);
  const richting = w.richting === 'tegen' ? -1 : 1;
  const plan = sorteer(items, w, m).map((rij, i) => {
    const hoek = w.beginhoek + richting * i * stap;
    const doel = { x: m.x + r * Math.sin(hoek * RAD), y: m.y - r * Math.cos(hoek * RAD) };
    let draai = 0;
    if (w.meedraaien === 'buiten') draai = normaleHoek(hoek);
    else if (w.meedraaien === 'midden') draai = normaleHoek(hoek + 180);
    return { o: rij.o, van: rij.c, doel, draai, hoek };
  });
  // overlappen ze? Kijk naar de buren langs de cirkel (ruwe schatting met de diagonaal)
  let overlap = false;
  for (let i = 0; i < plan.length; i++) {
    const a = plan[i];
    const b = plan[(i + 1) % plan.length];
    if (a === b || (i === plan.length - 1 && w.boog < 359.999)) continue;
    const ruimte = Math.hypot(a.doel.x - b.doel.x, a.doel.y - b.doel.y);
    const nodig = (Math.min(a.o.kader.b, a.o.kader.h) + Math.min(b.o.kader.b, b.o.kader.h)) / 2;
    if (ruimte < nodig * 0.98) overlap = true;
  }
  return { m, r, stap, plan, overlap };
}

// ---- voorvertoning --------------------------------------------------------

function tekenVoorbeeld(canvas, items, uitkomst, w) {
  const schaal = devicePixelRatio || 1;
  const vak = canvas.getBoundingClientRect();
  canvas.width = Math.round(vak.width * schaal);
  canvas.height = Math.round(vak.height * schaal);
  const g = canvas.getContext('2d');
  g.setTransform(schaal, 0, 0, schaal, 0, 0);
  g.clearRect(0, 0, vak.width, vak.height);
  if (!uitkomst) return;
  const { m, r, plan } = uitkomst;

  // alles wat we tekenen moet erin passen: de oude plekken, de cirkel en de nieuwe plekken
  const punten = [];
  for (const o of items) punten.push([o.kader.x, o.kader.y], [o.kader.x + o.kader.b, o.kader.y + o.kader.h]);
  punten.push([m.x - r, m.y - r], [m.x + r, m.y + r]);
  for (const p of plan) {
    const d = Math.hypot(p.o.kader.b, p.o.kader.h) / 2;
    punten.push([p.doel.x - d, p.doel.y - d], [p.doel.x + d, p.doel.y + d]);
  }
  const x0 = Math.min(...punten.map((p) => p[0]));
  const y0 = Math.min(...punten.map((p) => p[1]));
  const x1 = Math.max(...punten.map((p) => p[0]));
  const y1 = Math.max(...punten.map((p) => p[1]));
  const s = Math.min((vak.width - 16) / Math.max(1, x1 - x0), (vak.height - 16) / Math.max(1, y1 - y0));
  const ox = (vak.width - (x1 - x0) * s) / 2 - x0 * s;
  const oy = (vak.height - (y1 - y0) * s) / 2 - y0 * s;
  const X = (x) => ox + x * s;
  const Y = (y) => oy + y * s;

  const accent = vexel.thema.accent || css('--accent', '#5aa2ff');
  const zacht = vexel.thema.tekstZacht || css('--tekst-zacht', '#999');
  const lijn = vexel.thema.lijn || css('--lijn', '#444');

  // de oude plekken, gestippeld
  g.setLineDash([3, 3]);
  g.strokeStyle = lijn;
  g.lineWidth = 1;
  for (const o of items) g.strokeRect(X(o.kader.x) + 0.5, Y(o.kader.y) + 0.5, o.kader.b * s, o.kader.h * s);
  g.setLineDash([]);

  // de cirkel of boog, en het middelpunt
  g.strokeStyle = zacht;
  g.globalAlpha = 0.5;
  g.beginPath();
  if (w.boog >= 359.999) g.arc(X(m.x), Y(m.y), r * s, 0, Math.PI * 2);
  else {
    const richting = w.richting === 'tegen' ? -1 : 1;
    const a0 = (w.beginhoek - 90) * RAD;
    const a1 = (w.beginhoek - 90 + richting * w.boog) * RAD;
    g.arc(X(m.x), Y(m.y), r * s, a0, a1, richting < 0);
  }
  g.stroke();
  g.globalAlpha = 1;
  g.fillStyle = zacht;
  g.beginPath();
  g.arc(X(m.x), Y(m.y), 2.5, 0, Math.PI * 2);
  g.fill();

  // de nieuwe plekken: de kaders, gedraaid zoals ze komen te staan
  plan.forEach((p, i) => {
    g.save();
    g.translate(X(p.doel.x), Y(p.doel.y));
    g.rotate(p.draai * RAD);
    g.fillStyle = accent;
    g.globalAlpha = i === 0 ? 0.55 : 0.22;
    g.fillRect((-p.o.kader.b / 2) * s, (-p.o.kader.h / 2) * s, p.o.kader.b * s, p.o.kader.h * s);
    g.globalAlpha = 1;
    g.strokeStyle = accent;
    g.strokeRect((-p.o.kader.b / 2) * s, (-p.o.kader.h / 2) * s, p.o.kader.b * s, p.o.kader.h * s);
    // een streepje aan de bovenkant laat zien hoe het object gedraaid staat
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(0, (-p.o.kader.h / 2) * s);
    g.stroke();
    g.restore();
  });
}

// ---- het venster ----------------------------------------------------------

async function toonVenster() {
  const doc = await vexel.document();
  const w0 = { ...STANDAARD, ...((await vexel.haal('instellingen')) || {}) };
  let items = [];
  let leesFout = null;
  try {
    items = await leesSelectie();
  } catch (fout) {
    leesFout = fout;
  }
  const pt = vexel.mm(1);

  const rondMm = (v) => String(Math.round((v / pt) * 10) / 10);
  const straal = getalVeld(items.length ? rondMm(passendeStraal(items, w0.boog)) : 40, 0, 5000, 1);
  const passend = maak('button', { klasse: 'knop', type: 'button', tekst: 'Passend', title: 'Een straal waarbij de objecten elkaar niet raken' });
  const beginhoek = getalVeld(w0.beginhoek, -360, 360, 5);
  const boog = getalVeld(w0.boog, 1, 360, 5);
  const middelpunt = keuzeVeld([['selectie', 'Midden van de selectie'], ['tekengebied', 'Midden van het tekengebied']], w0.middelpunt);
  const volgorde = keuzeVeld([
    ['hoek', 'Zoals ze rond het midden staan'],
    ['links', 'Van links naar rechts'],
    ['boven', 'Van boven naar onder'],
    ['selectie', 'Volgorde van selecteren'],
  ], w0.volgorde);
  const richting = keuzeVeld([['mee', 'Met de klok mee'], ['tegen', 'Tegen de klok in']], w0.richting);
  const meedraaien = keuzeVeld([
    ['geen', 'Niet draaien'],
    ['buiten', 'Naar buiten'],
    ['midden', 'Naar het midden'],
  ], w0.meedraaien);

  const voorbeeld = maak('canvas', { 'aria-hidden': 'true', stijl: { width: '100%', height: '150px', display: 'block' } });
  const samenvatting = maak('p', { klasse: 'uitleg', 'aria-live': 'polite', stijl: { margin: '0', minHeight: '32px' } });
  const maakKnop = maak('button', { klasse: 'knop primair', type: 'submit', tekst: 'Schikken' });
  const annuleer = maak('button', { klasse: 'knop', type: 'button', tekst: 'Annuleren', bijClick: () => vexel.sluit() });

  const twee = (...k) => maak('div', { stijl: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' } }, ...k);
  const formulier = maak('form', { stijl: { display: 'grid', gap: '10px', padding: '14px' } },
    maak('div', { stijl: { display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px', alignItems: 'end' } },
      veldMetLabel('Straal', straal, 'mm'), passend),
    veldMetLabel('Middelpunt', middelpunt),
    twee(veldMetLabel('Beginhoek', beginhoek, '°'), veldMetLabel('Boog', boog, '°')),
    maak('p', { klasse: 'uitleg', stijl: { margin: '-4px 0 0' }, tekst: '0° is boven, met de klok mee. 360° is een hele cirkel.' }),
    veldMetLabel('Volgorde', volgorde),
    twee(veldMetLabel('Richting', richting), veldMetLabel('Meedraaien', meedraaien)),
    maak('div', { stijl: { background: 'var(--bg-2)', border: '1px solid var(--lijn)', borderRadius: '6px', padding: '6px' } }, voorbeeld),
    samenvatting,
    maak('div', { klasse: 'knoppen', stijl: { marginTop: '0' } }, annuleer, maakKnop),
  );
  document.body.append(formulier);

  const waarden = () => ({
    straal: begrens(leesGetal(straal, 40), 0, 5000),
    beginhoek: begrens(leesGetal(beginhoek, 0), -360, 360),
    boog: begrens(leesGetal(boog, 360), 1, 360),
    middelpunt: middelpunt.value,
    volgorde: volgorde.value,
    richting: richting.value,
    meedraaien: meedraaien.value,
  });

  function probleem() {
    if (leesFout) return 'De selectie kon niet worden gelezen: ' + leesFout.message;
    if (doc.alleenLezen) return 'Dit document is alleen-lezen.';
    if (items.length < 2) return 'Selecteer eerst minstens twee objecten en open dit venster opnieuw.';
    return null;
  }

  function werkBij() {
    const w = waarden();
    const p = probleem();
    maakKnop.disabled = Boolean(p);
    passend.disabled = !items.length;
    if (p) {
      samenvatting.textContent = p;
      samenvatting.classList.add('fout');
      tekenVoorbeeld(voorbeeld, items, null, w);
      return;
    }
    samenvatting.classList.remove('fout');
    const uitkomst = bereken(items, w, doc);
    const stapTekst = getalTekst(uitkomst.stap, 1);
    let tekst = `${items.length} objecten op ${w.boog >= 359.999 ? 'een cirkel' : 'een boog'} met een straal van `
      + `${getalTekst(w.straal, 1)} mm, om de ${stapTekst}°.`;
    if (uitkomst.overlap) tekst += ' Let op: ze overlappen elkaar; klik op Passend voor een grotere straal.';
    if (w.meedraaien !== 'geen') tekst += ' Het draaien komt bij de draaiing die ze nu al hebben.';
    if (items.length >= 5000) tekst += ' Let op: Vexel geeft hooguit 5000 objecten door; de rest blijft staan.';
    samenvatting.textContent = tekst;
    tekenVoorbeeld(voorbeeld, items, uitkomst, w);
  }

  passend.addEventListener('click', () => {
    if (!items.length) return;
    straal.value = rondMm(passendeStraal(items, waarden().boog));
    werkBij();
  });

  formulier.addEventListener('input', werkBij);
  formulier.addEventListener('change', werkBij);
  formulier.addEventListener('submit', async (gebeurtenis) => {
    gebeurtenis.preventDefault();
    if (probleem()) return;
    const w = waarden();
    maakKnop.disabled = true;
    try {
      // de selectie kan intussen veranderd zijn: lees hem opnieuw
      const nu = await leesSelectie();
      const zelfde = nu.length === items.length && nu.every((o) => items.some((v) => v.id === o.id));
      items = nu;
      if (!zelfde) {
        werkBij();
        vexel.melding('De selectie is veranderd. Bekijk het voorbeeld en klik nog eens op Schikken.', 'let');
        return;
      }
      const uitkomst = bereken(items, w, doc);
      const lijst = uitkomst.plan.map((p) => {
        const wijziging = { id: p.o.id, verplaats: { dx: p.doel.x - p.van.x, dy: p.doel.y - p.van.y } };
        if (p.draai) wijziging.draai = p.draai;
        return wijziging;
      });
      await vexel.wijzig(lijst);
      await vexel.bewaar('instellingen', { ...w, straal: undefined });
      vexel.melding(`${lijst.length} objecten op ${w.boog >= 359.999 ? 'een cirkel' : 'een boog'} gezet.`, 'ok');
      vexel.sluit();
    } catch (fout) {
      vexel.melding(fout && fout.message ? fout.message : 'Schikken lukte niet.', 'fout');
    } finally {
      maakKnop.disabled = Boolean(probleem());
    }
  });

  werkBij();
  straal.focus();
  straal.select();
}

vexel.opCommando('schikken', toonVenster);
