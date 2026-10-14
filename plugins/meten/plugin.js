// Meten: de echte oppervlakte, omtrek (padlengte), het aantal punten en de maat van
// de geselecteerde vormen, met totalen. Handig voor snijplotter, laser en borduren:
// hoe lang is de snijlijn, hoeveel materiaal gaat erin? De uitkomst kan als label
// naast de selectie.
// Eigen werk, MIT-licentie (zie de README van deze repo).
'use strict';

const STANDAARD = { eenheid: 'mm', snelheid: '', labelInhoud: 'alles', labelPer: 'object' };
const MM2_PER_PT2 = (25.4 / 72) ** 2;
const MM_PER_PT = 25.4 / 72;

// ---- meetkunde ----------------------------------------------------------------

const p2 = (p) => ({ x: p.x, y: p.y });

/** De segmenten van een subpad als kubische Béziers [a, c1, c2, b]. */
function segmenten(sp) {
  const pts = sp.punten || [];
  const uit = [];
  const n = pts.length;
  if (n < 2) return uit;
  const tot = sp.gesloten ? n : n - 1;
  for (let i = 0; i < tot; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    uit.push([p2(a), a.uit ? p2(a.uit) : p2(a), b.in ? p2(b.in) : p2(b), p2(b)]);
  }
  return uit;
}

const afstand = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
const isLijn = (s) => s[1].x === s[0].x && s[1].y === s[0].y && s[2].x === s[3].x && s[2].y === s[3].y;

function splits(s, t) {
  const m = (a, b) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  const ab = m(s[0], s[1]);
  const bc = m(s[1], s[2]);
  const cd = m(s[2], s[3]);
  const abc = m(ab, bc);
  const bcd = m(bc, cd);
  const p = m(abc, bcd);
  return [[s[0], ab, abc, p], [p, bcd, cd, s[3]]];
}

/** Lengte van een kubische Bézier: net zo lang halveren tot boog en koorde samenvallen. */
function bezierLengte(s, diepte = 0) {
  if (isLijn(s)) return afstand(s[0], s[3]);
  const koorde = afstand(s[0], s[3]);
  const veelhoek = afstand(s[0], s[1]) + afstand(s[1], s[2]) + afstand(s[2], s[3]);
  if (veelhoek - koorde < 1e-4 * Math.max(1, veelhoek) || diepte > 18) return (2 * koorde + veelhoek) / 3;
  const [l, r] = splits(s, 0.5);
  return bezierLengte(l, diepte + 1) + bezierLengte(r, diepte + 1);
}

/** Een subpad als veelhoek (fijn genoeg voor de oppervlakte: afwijking < 0,002 pt). */
function veelhoek(sp) {
  const uit = [];
  const segs = segmenten(sp);
  if (!segs.length) return uit;
  uit.push(segs[0][0]);
  for (const s of segs) {
    if (isLijn(s)) {
      uit.push(s[3]);
      continue;
    }
    // aantal stappen uit de kromming (tweede verschillen van het controleveelhoek)
    const dd = Math.max(
      Math.hypot(s[0].x - 2 * s[1].x + s[2].x, s[0].y - 2 * s[1].y + s[2].y),
      Math.hypot(s[1].x - 2 * s[2].x + s[3].x, s[1].y - 2 * s[2].y + s[3].y));
    const n = Math.min(512, Math.max(4, Math.ceil(Math.sqrt((0.75 * dd) / 0.002))));
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const u = 1 - t;
      const a = u * u * u;
      const b = 3 * u * u * t;
      const c = 3 * u * t * t;
      const d = t * t * t;
      uit.push({ x: a * s[0].x + b * s[1].x + c * s[2].x + d * s[3].x, y: a * s[0].y + b * s[1].y + c * s[2].y + d * s[3].y });
    }
  }
  return uit;
}

/**
 * De gevulde oppervlakte van een stel veelhoeken met een vulregel, exact voor
 * veelhoeken: het vlak wordt in horizontale stroken gesneden op elke hoekpunthoogte;
 * binnen een strook zijn de gevulde stukken trapezia.
 */
function gevuldeOppervlakte(veelhoeken, vulregel) {
  const randen = [];
  const ys = [];
  for (const vh of veelhoeken) {
    const n = vh.length;
    if (n < 3) continue;
    for (let i = 0; i < n; i++) {
      const a = vh[i];
      const b = vh[(i + 1) % n];
      ys.push(a.y);
      if (a.y === b.y) continue;
      const omlaag = b.y > a.y;
      randen.push({
        y0: Math.min(a.y, b.y), y1: Math.max(a.y, b.y),
        x0: omlaag ? a.x : b.x, x1: omlaag ? b.x : a.x, dir: omlaag ? 1 : -1,
      });
    }
  }
  if (!randen.length) return 0;
  randen.sort((a, b) => a.y0 - b.y0);
  ys.sort((a, b) => a - b);
  const uniek = ys.filter((y, i) => i === 0 || y - ys[i - 1] > 1e-9);
  const xOp = (r, y) => r.x0 + ((r.x1 - r.x0) * (y - r.y0)) / (r.y1 - r.y0);
  const binnen = (w) => (vulregel === 'evenodd' ? (w & 1) !== 0 : w !== 0);

  let actief = [];
  let volgende = 0;
  let totaal = 0;

  function strook(ya, yb, diepte) {
    const ym = (ya + yb) / 2;
    const lijst = actief.filter((r) => r.y0 <= ym && r.y1 >= ym)
      .map((r) => ({ r, xa: xOp(r, ya), xb: xOp(r, yb), xm: xOp(r, ym) }))
      .sort((a, b) => a.xm - b.xm);
    // kruisen randen elkaar binnen de strook? dan in tweeën
    if (diepte < 12) {
      for (let i = 1; i < lijst.length; i++) {
        if (lijst[i].xa < lijst[i - 1].xa - 1e-9 || lijst[i].xb < lijst[i - 1].xb - 1e-9) {
          strook(ya, ym, diepte + 1);
          strook(ym, yb, diepte + 1);
          return;
        }
      }
    }
    let w = 0;
    for (let i = 0; i < lijst.length - 1; i++) {
      w += lijst[i].r.dir;
      if (binnen(w)) totaal += ((lijst[i + 1].xa - lijst[i].xa + lijst[i + 1].xb - lijst[i].xb) / 2) * (yb - ya);
    }
  }

  for (let k = 0; k < uniek.length - 1; k++) {
    const ya = uniek[k];
    const yb = uniek[k + 1];
    const ym = (ya + yb) / 2;
    while (volgende < randen.length && randen[volgende].y0 <= ym) actief.push(randen[volgende++]);
    actief = actief.filter((r) => r.y1 >= ym);
    strook(ya, yb, 0);
  }
  return Math.abs(totaal);
}

/** Alle maten van één object uit de selectie. */
function meet(o) {
  if (!Array.isArray(o.subpaden) || !o.subpaden.length) return { o, meetbaar: false };
  let lengte = 0;
  let punten = 0;
  let open = 0;
  const veelhoeken = [];
  for (const sp of o.subpaden) {
    punten += (sp.punten || []).length;
    for (const s of segmenten(sp)) lengte += bezierLengte(s);
    if (sp.gesloten) veelhoeken.push(veelhoek(sp));
    else open++;
  }
  const opp = gevuldeOppervlakte(veelhoeken, o.vulregel === 'evenodd' ? 'evenodd' : 'nonzero');
  return {
    o, meetbaar: true, oppervlakte: opp * MM2_PER_PT2, lengte: lengte * MM_PER_PT, punten,
    subpaden: o.subpaden.length, open, b: o.kader ? o.kader.b * MM_PER_PT : 0, h: o.kader ? o.kader.h * MM_PER_PT : 0,
  };
}

// ---- getallen -----------------------------------------------------------------

const getal = (n, cijfers) => n.toLocaleString('nl-NL', { minimumFractionDigits: cijfers, maximumFractionDigits: cijfers });

function lengteTekst(mm, eenheid) {
  if (eenheid === 'cm') return getal(mm / 10, mm < 100 ? 2 : 1) + ' cm';
  if (eenheid === 'm') return getal(mm / 1000, 3) + ' m';
  return getal(mm, mm < 100 ? 2 : 1) + ' mm';
}
function oppTekst(mm2, eenheid) {
  if (eenheid === 'cm') return getal(mm2 / 100, mm2 < 1000 ? 2 : 1) + ' cm²';
  if (eenheid === 'm') return getal(mm2 / 1e6, 4) + ' m²';
  return getal(mm2, mm2 < 100 ? 2 : mm2 < 10000 ? 1 : 0) + ' mm²';
}
const maatTekst = (b, h) => `${getal(b, 1)} × ${getal(h, 1)} mm`;
function tijdTekst(s) {
  if (s < 60) return Math.round(s) + ' s';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ${Math.round(s - m * 60)} s`;
  return `${Math.floor(m / 60)} u ${m % 60} min`;
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
const kolommenRij = (sjabloon, ...kinderen) =>
  maak('div', { stijl: { display: 'grid', gridTemplateColumns: sjabloon.replace(/([0-9.]+fr)/g, 'minmax(0, $1)'), gap: '10px', alignItems: 'end' } },
    ...kinderen);

const SOORTNAAM = { pad: 'Pad', samengesteld: 'Samengesteld pad', tekst: 'Tekst', groep: 'Groep', knipgroep: 'Knipgroep', beeld: 'Foto' };
const naamVan = (o) => o.naam || SOORTNAAM[o.soort] || 'Object';

// ---- voorvertoning -------------------------------------------------------------

function tekenVoorvertoning(doek, metingen, licht) {
  const schaal = devicePixelRatio || 1;
  const kader = doek.getBoundingClientRect();
  doek.width = Math.round(kader.width * schaal);
  doek.height = Math.round(kader.height * schaal);
  const g = doek.getContext('2d');
  g.setTransform(schaal, 0, 0, schaal, 0, 0);
  g.clearRect(0, 0, kader.width, kader.height);
  const metPad = metingen.filter((m) => m.meetbaar && m.o.kader);
  if (!metPad.length) return;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const m of metPad) {
    const k = m.o.kader;
    x0 = Math.min(x0, k.x);
    y0 = Math.min(y0, k.y);
    x1 = Math.max(x1, k.x + k.b);
    y1 = Math.max(y1, k.y + k.h);
  }
  const s = Math.min((kader.width - 24) / Math.max(1e-6, x1 - x0), (kader.height - 24) / Math.max(1e-6, y1 - y0));
  const ox = (kader.width - (x1 - x0) * s) / 2 - x0 * s;
  const oy = (kader.height - (y1 - y0) * s) / 2 - y0 * s;
  const accent = vexel.thema.accent || '#c6ff3d';
  metPad.forEach((m, i) => {
    g.beginPath();
    for (const sp of m.o.subpaden) {
      const segs = segmenten(sp);
      if (!segs.length) continue;
      g.moveTo(ox + segs[0][0].x * s, oy + segs[0][0].y * s);
      for (const q of segs) g.bezierCurveTo(ox + q[1].x * s, oy + q[1].y * s, ox + q[2].x * s, oy + q[2].y * s, ox + q[3].x * s, oy + q[3].y * s);
      if (sp.gesloten) g.closePath();
    }
    const aan = licht === i;
    g.globalAlpha = licht === null || aan ? 0.32 : 0.1;
    g.fillStyle = accent;
    g.fill(m.o.vulregel === 'evenodd' ? 'evenodd' : 'nonzero');
    g.globalAlpha = licht === null || aan ? 1 : 0.35;
    g.strokeStyle = accent;
    g.lineWidth = aan ? 2 : 1.2;
    g.stroke();
    g.globalAlpha = 1;
  });
}

// ---- het venster --------------------------------------------------------------

async function toonVenster() {
  const doc = await vexel.document();
  const items = await vexel.selectie();
  const w0 = { ...STANDAARD, ...((await vexel.haal('instellingen')) || {}) };
  const metingen = items.map(meet);
  const meetbaar = metingen.filter((m) => m.meetbaar);

  const eenheid = keuzeVeld([['mm', 'mm en mm²'], ['cm', 'cm en cm²'], ['m', 'm en m²']], w0.eenheid);
  const snelheid = maak('input', { klasse: 'veld', type: 'number', min: 0, max: 10000, step: 1, value: w0.snelheid, placeholder: 'leeg = geen', stijl: { width: '100%' } });
  const labelInhoud = keuzeVeld([['alles', 'Oppervlakte, omtrek en maat'], ['opp', 'Alleen oppervlakte'], ['omtrek', 'Alleen omtrek (snijlijn)']], w0.labelInhoud);
  const labelPer = keuzeVeld([['object', 'Per object en totaal'], ['totaal', 'Alleen het totaal']], w0.labelPer);

  const doek = maak('canvas', { 'aria-hidden': 'true', stijl: { width: '100%', height: '130px', flex: 'none' } });
  const tabel = maak('div', { role: 'table', 'aria-label': 'Metingen', stijl: { border: '1px solid var(--lijn)', borderRadius: '5px', background: 'var(--bg-2)', overflow: 'auto', minHeight: '0' } });
  const samenvatting = maak('p', { klasse: 'uitleg', 'aria-live': 'polite', stijl: { margin: '0', minHeight: '1.5em' } });
  const plaats = maak('button', { klasse: 'knop primair', type: 'submit', tekst: 'Als label plaatsen' });
  const sluit = maak('button', { klasse: 'knop', type: 'button', tekst: 'Sluiten', bijClick: () => vexel.sluit() });

  const formulier = maak('form', {
    stijl: { display: 'grid', gridTemplateRows: (meetbaar.length ? 'auto ' : '') + 'minmax(0, 1fr) auto auto auto auto', gap: '10px', padding: '12px 14px 14px', height: '100vh' },
  },
  doek,
  tabel,
  kolommenRij('1fr 1fr', metLabel('Eenheid', eenheid), metLabel('Snijsnelheid (voor de tijd)', snelheid, 'mm/s')),
  kolommenRij('1fr 1fr', metLabel('Label', labelInhoud), metLabel('Regels', labelPer)),
  samenvatting,
  maak('div', { klasse: 'knoppen', stijl: { marginTop: '0' } }, sluit, plaats),
  );
  document.head.append(maak('style', {
    tekst: '.knop{white-space:nowrap}.t{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr) minmax(0,1fr) 42px;gap:8px;'
      + 'padding:4px 8px;border-bottom:1px solid var(--lijn);align-items:baseline;font-variant-numeric:tabular-nums}'
      + '.t>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.t>span:not(:first-child){text-align:right}'
      + '.t.kop{color:var(--tekst-zacht);position:sticky;top:0;background:var(--bg-2);font-size:11px}'
      + '.t.som{font-weight:600;border-bottom:0;border-top:1px solid var(--lijn-sterk,#464954);position:sticky;bottom:0;background:var(--bg-2)}'
      + '.t .sub{display:block;color:var(--tekst-zacht);font-size:10.5px;font-weight:400}.t.niet{color:var(--tekst-zacht)}'
      + '.t:not(.kop):not(.som):hover{background:var(--bg-3,#2c2e35)}.leegte{padding:16px 12px;color:var(--tekst-zacht);line-height:1.5}',
  }));
  document.body.style.padding = '0';
  document.body.append(formulier);

  const waarden = () => ({
    eenheid: eenheid.value,
    snelheid: snelheid.value.trim(),
    labelInhoud: labelInhoud.value,
    labelPer: labelPer.value,
  });
  const totalen = () => ({
    oppervlakte: meetbaar.reduce((n, m) => n + m.oppervlakte, 0),
    lengte: meetbaar.reduce((n, m) => n + m.lengte, 0),
    punten: meetbaar.reduce((n, m) => n + m.punten, 0),
  });

  let licht = null;
  function bijwerken() {
    const w = waarden();
    tabel.replaceChildren();
    if (!items.length) {
      tabel.append(maak('div', { klasse: 'leegte', tekst: 'Er is niets geselecteerd. Sluit dit venster, selecteer de vormen die je wilt meten en kies Meten opnieuw.' }));
    } else {
      tabel.append(maak('div', { klasse: 't kop', role: 'row' },
        maak('span', { tekst: 'Object' }), maak('span', { tekst: 'Oppervlakte' }), maak('span', { tekst: 'Omtrek' }), maak('span', { tekst: 'Punten' })));
      let index = 0;
      for (const m of metingen) {
        if (!m.meetbaar) {
          const reden = m.o.soort === 'groep' ? 'groep: selecteer de vormen erin' : m.o.soort === 'tekst' ? 'tekst: zet hem eerst om in paden' : 'heeft geen pad';
          tabel.append(maak('div', { klasse: 't niet', role: 'row' },
            maak('span', { tekst: naamVan(m.o), title: naamVan(m.o) }), maak('span', { tekst: reden, stijl: { gridColumn: 'span 3', textAlign: 'left' } })));
          continue;
        }
        const i = index++;
        const rij = maak('div', { klasse: 't', role: 'row' },
          maak('span', { title: naamVan(m.o) }, naamVan(m.o), maak('span', { klasse: 'sub', tekst: maatTekst(m.b, m.h) })),
          maak('span', { tekst: m.open === m.subpaden ? '—' : oppTekst(m.oppervlakte, w.eenheid) }),
          maak('span', { tekst: lengteTekst(m.lengte, w.eenheid) }),
          maak('span', { tekst: String(m.punten) }));
        rij.addEventListener('mouseenter', () => { licht = i; tekenVoorvertoning(doek, metingen, licht); });
        rij.addEventListener('mouseleave', () => { licht = null; tekenVoorvertoning(doek, metingen, licht); });
        tabel.append(rij);
      }
      if (meetbaar.length > 1) {
        const t = totalen();
        tabel.append(maak('div', { klasse: 't som', role: 'row' },
          maak('span', { tekst: `Totaal (${meetbaar.length})` }), maak('span', { tekst: oppTekst(t.oppervlakte, w.eenheid) }),
          maak('span', { tekst: lengteTekst(t.lengte, w.eenheid) }), maak('span', { tekst: String(t.punten) })));
      }
    }
    tekenVoorvertoning(doek, metingen, licht);

    let tekst;
    let fout = false;
    if (!items.length) {
      tekst = 'Selecteer eerst een of meer vormen.';
      fout = true;
    } else if (!meetbaar.length) {
      tekst = 'Hier valt niets te meten: selecteer paden of vormen (geen groep, tekst of foto).';
      fout = true;
    } else {
      const t = totalen();
      tekst = `Snijlijn in totaal ${lengteTekst(t.lengte, w.eenheid)}`;
      const v = Number(String(w.snelheid).replace(',', '.'));
      if (w.snelheid && Number.isFinite(v) && v > 0) tekst += `, ca. ${tijdTekst(t.lengte / v)} bij ${getal(v, 0)} mm/s`;
      tekst += '.';
      if (meetbaar.some((m) => m.open)) tekst += ' Open paden tellen mee in de lengte, niet in de oppervlakte.';
      if (doc.alleenLezen) {
        tekst += ' Dit document is alleen-lezen, dus een label plaatsen kan niet.';
      }
    }
    samenvatting.textContent = tekst;
    samenvatting.classList.toggle('fout', fout);
    plaats.disabled = fout || doc.alleenLezen;
  }

  function labelVormen(w) {
    const cmyk = doc.kleurruimte === 'cmyk';
    const kleur = cmyk ? { cmyk: [0, 0, 0, 85] } : { hex: '#262626' };
    const zacht = cmyk ? { cmyk: [0, 0, 0, 55] } : { hex: '#737373' };
    const regel = (m) => {
      const delen = [];
      if (w.labelInhoud !== 'omtrek' && m.open !== m.subpaden) delen.push(oppTekst(m.oppervlakte, w.eenheid));
      if (w.labelInhoud !== 'opp') delen.push((m.open === m.subpaden ? 'lengte ' : 'omtrek ') + lengteTekst(m.lengte, w.eenheid));
      if (w.labelInhoud === 'alles') delen.push(maatTekst(m.b, m.h));
      return delen.join(' · ');
    };
    const regels = [];
    if (w.labelPer === 'object' || meetbaar.length === 1) {
      for (const m of meetbaar.slice(0, 60)) regels.push(naamVan(m.o) + ': ' + regel(m));
      if (meetbaar.length > 60) regels.push(`… en nog ${meetbaar.length - 60}`);
    }
    if (meetbaar.length > 1) {
      const t = totalen();
      const delen = [];
      if (w.labelInhoud !== 'omtrek') delen.push(oppTekst(t.oppervlakte, w.eenheid));
      if (w.labelInhoud !== 'opp') delen.push('omtrek ' + lengteTekst(t.lengte, w.eenheid));
      regels.push(`Totaal (${meetbaar.length}): ` + delen.join(' · '));
    }
    // rechts naast de selectie; past dat niet, dan eronder
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const o of items) {
      const k = o.kader;
      if (!k) continue;
      x0 = Math.min(x0, k.x);
      y0 = Math.min(y0, k.y);
      x1 = Math.max(x1, k.x + k.b);
      y1 = Math.max(y1, k.y + k.h);
    }
    const grootte = 8;
    const regelafstand = 11;
    const breedte = Math.max(...regels.map((r) => r.length)) * grootte * 0.52;
    const tg = doc.tekengebied;
    let x = x1 + vexel.mm(5);
    let y = y0 + grootte;
    if (x + breedte > tg.b && y1 + vexel.mm(5) + regels.length * regelafstand < tg.h) {
      x = x0;
      y = y1 + vexel.mm(5) + grootte;
    }
    const kinderen = [{ soort: 'tekst', naam: 'Kop', x, y, inhoud: 'Meting', grootte: 7, gewicht: 600, letterafstand: 60, vulling: zacht }];
    kinderen.push({
      soort: 'tekst', naam: 'Maten', x, y: y + regelafstand + 1, inhoud: regels.join('\n'), grootte, regelafstand, gewicht: 400, vulling: kleur,
    });
    return [{ soort: 'groep', naam: 'Meting', kinderen }];
  }

  formulier.addEventListener('input', bijwerken);
  formulier.addEventListener('change', bijwerken);
  formulier.addEventListener('submit', async (gebeurtenis) => {
    gebeurtenis.preventDefault();
    if (plaats.disabled) return;
    const w = waarden();
    plaats.disabled = true;
    try {
      await vexel.maak(labelVormen(w));
      await vexel.bewaar('instellingen', w);
      vexel.melding('Label met de maten geplaatst.', 'ok');
      vexel.sluit();
    } catch (fout) {
      plaats.disabled = false;
      vexel.melding(fout && fout.message ? fout.message : 'Het label kon niet worden geplaatst.', 'fout');
    }
  });
  eenheid.addEventListener('change', () => vexel.bewaar('instellingen', waarden()));

  if (!meetbaar.length) doek.style.display = 'none';
  bijwerken();
  plaats.focus();
}

vexel.opCommando('meten', toonVenster);
