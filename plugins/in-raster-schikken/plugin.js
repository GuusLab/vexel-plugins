// In raster schikken: zet de geselecteerde objecten netjes in kolommen en rijen.
// Eigen werk, MIT-licentie (zie de README van deze repo).
'use strict';

const STANDAARD = {
  kolommen: 0, tussenX: 5, tussenY: 5, uitlijning: 'mm', volgorde: 'staan',
  cel: 'grootste', celB: 30, celH: 30, gelijk: false,
};

const UITLIJNINGEN = [
  ['lb', 'Linksboven'], ['mb', 'Boven'], ['rb', 'Rechtsboven'],
  ['lm', 'Links'], ['mm', 'Midden'], ['rm', 'Rechts'],
  ['lo', 'Linksonder'], ['mo', 'Onder'], ['ro', 'Rechtsonder'],
];

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

function veldMetLabel(labelTekst, veld, eenheid) {
  const regel = maak('div', { stijl: { display: 'flex', alignItems: 'center', gap: '6px' } }, veld);
  veld.style.flex = '1';
  veld.style.minWidth = '0';
  if (eenheid) regel.append(maak('span', { klasse: 'uitleg', tekst: eenheid }));
  return maak('label', { stijl: { display: 'grid', gap: '4px', minWidth: '0', alignContent: 'start' } }, maak('span', { klasse: 'label', tekst: labelTekst }), regel);
}

const leesGetal = (veld, terugval) => {
  const n = Number(String(veld.value).replace(',', '.'));
  return Number.isFinite(n) ? n : terugval;
};
const begrens = (n, min, max) => Math.min(max, Math.max(min, n));
const getalTekst = (n, cijfers = 1) => n.toLocaleString('nl-NL', { maximumFractionDigits: cijfers, useGrouping: false });
const css = (naam, terugval) => getComputedStyle(document.documentElement).getPropertyValue(naam).trim() || terugval;

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

// ---- kleur (om op te sorteren) ---------------------------------------------

function hexNaarRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Een sorteersleutel voor kleur: eerst de bonte kleuren rond de kleurcirkel,
    dan grijzen van licht naar donker, dan objecten zonder kleur. */
function kleurSleutel(o) {
  const kleur = o.vulling || o.lijn;
  let rgb = kleur ? hexNaarRgb(kleur.hex) : null;
  if (!rgb && kleur && Array.isArray(kleur.cmyk)) {
    const [c, m, y, k] = kleur.cmyk.map((v) => v / 100);
    rgb = [c, m, y].map((v) => 255 * (1 - v) * (1 - k));
  }
  if (!rgb) return [2, 0, 0];
  const [r, g, b] = rgb.map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d < 0.08) return [1, -l, 0];
  let h;
  if (max === r) h = ((g - b) / d + 6) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [0, h * 60, -l];
}

// ---- de rekensom ----------------------------------------------------------

/** Leesvolgorde: eerst in rijen (wat op dezelfde hoogte staat), dan per rij van links naar rechts. */
function leesvolgorde(lijst) {
  const opY = [...lijst].sort((a, b) => a.o.kader.y - b.o.kader.y || a.i - b.i);
  const rijen = [];
  for (const r of opY) {
    const cy = r.o.kader.y + r.o.kader.h / 2;
    const rij = rijen.find((q) => cy >= q.y0 && cy <= q.y1);
    if (rij) rij.leden.push(r);
    else rijen.push({ y0: r.o.kader.y, y1: r.o.kader.y + r.o.kader.h, leden: [r] });
  }
  return rijen.flatMap((q) => q.leden.sort((a, b) => (a.o.kader.x + a.o.kader.b / 2) - (b.o.kader.x + b.o.kader.b / 2) || a.i - b.i));
}

function sorteer(items, volgorde) {
  const lijst = items.map((o, i) => ({ o, i }));
  const opp = (r) => r.o.kader.b * r.o.kader.h;
  switch (volgorde) {
    case 'selectie': return lijst;
    case 'groot': return lijst.sort((a, b) => opp(b) - opp(a) || a.i - b.i);
    case 'klein': return lijst.sort((a, b) => opp(a) - opp(b) || a.i - b.i);
    case 'kleur': return lijst.sort((a, b) => {
      const p = kleurSleutel(a.o);
      const q = kleurSleutel(b.o);
      return p[0] - q[0] || p[1] - q[1] || p[2] - q[2] || a.i - b.i;
    });
    default: return leesvolgorde(lijst);
  }
}

/** Het plan: per object de cel, de schaal en de verplaatsing. */
function bereken(items, w) {
  const n = items.length;
  const grootsteB = Math.max(...items.map((o) => o.kader.b));
  const grootsteH = Math.max(...items.map((o) => o.kader.h));
  const celB = w.cel === 'vast' ? vexel.mm(w.celB) : grootsteB;
  const celH = w.cel === 'vast' ? vexel.mm(w.celH) : grootsteH;
  const tx = vexel.mm(w.tussenX);
  const ty = vexel.mm(w.tussenY);
  let kolommen = Math.round(w.kolommen);
  const auto = !(kolommen >= 1);
  if (auto) {
    // zo vierkant mogelijk: kolommen × celbreedte ongeveer gelijk aan rijen × celhoogte
    const verhouding = (celH + ty) / Math.max(1e-6, celB + tx);
    kolommen = Math.ceil(Math.sqrt(n * verhouding) - 0.001);
  }
  kolommen = begrens(kolommen, 1, n);
  const rijen = Math.ceil(n / kolommen);
  const begin = omhullende(items);
  const [ax, ay] = [{ l: 0, m: 0.5, r: 1 }[w.uitlijning[0]], { b: 0, m: 0.5, o: 1 }[w.uitlijning[1]]];

  let teGroot = 0;
  const plan = sorteer(items, w.volgorde).map((rij, i) => {
    const o = rij.o;
    const k = o.kader;
    const kol = i % kolommen;
    const r = Math.floor(i / kolommen);
    const celX = begin.x + kol * (celB + tx);
    const celY = begin.y + r * (celH + ty);
    let schaal = 1;
    if (w.gelijk) {
      const fx = k.b > 1e-6 ? celB / k.b : Infinity;
      const fy = k.h > 1e-6 ? celH / k.h : Infinity;
      schaal = Math.min(fx, fy);
      if (!Number.isFinite(schaal)) schaal = 1;
      schaal = begrens(schaal, 0.001, 1000);
    }
    const b = k.b * schaal;
    const h = k.h * schaal;
    if (b > celB + 0.01 || h > celH + 0.01) teGroot++;
    const doelX = celX + ax * (celB - b) + b / 2;
    const doelY = celY + ay * (celH - h) + h / 2;
    return {
      o, schaal, cel: { x: celX, y: celY, b: celB, h: celH },
      nieuw: { x: doelX - b / 2, y: doelY - h / 2, b, h },
      dx: doelX - (k.x + k.b / 2), dy: doelY - (k.y + k.h / 2),
    };
  });
  return { plan, kolommen, rijen, auto, celB, celH, teGroot };
}

// ---- voorvertoning --------------------------------------------------------

function tekenVoorbeeld(canvas, uitkomst) {
  const schaal = devicePixelRatio || 1;
  const vak = canvas.getBoundingClientRect();
  canvas.width = Math.round(vak.width * schaal);
  canvas.height = Math.round(vak.height * schaal);
  const g = canvas.getContext('2d');
  g.setTransform(schaal, 0, 0, schaal, 0, 0);
  g.clearRect(0, 0, vak.width, vak.height);
  if (!uitkomst) return;

  const rects = uitkomst.plan.flatMap((p) => [p.cel, p.nieuw]);
  const x0 = Math.min(...rects.map((r) => r.x));
  const y0 = Math.min(...rects.map((r) => r.y));
  const x1 = Math.max(...rects.map((r) => r.x + r.b));
  const y1 = Math.max(...rects.map((r) => r.y + r.h));
  const s = Math.min((vak.width - 16) / Math.max(1, x1 - x0), (vak.height - 16) / Math.max(1, y1 - y0));
  const ox = (vak.width - (x1 - x0) * s) / 2 - x0 * s;
  const oy = (vak.height - (y1 - y0) * s) / 2 - y0 * s;

  const accent = vexel.thema.accent || css('--accent', '#5aa2ff');
  const lijn = vexel.thema.lijn || css('--lijn', '#444');
  const zacht = vexel.thema.tekstZacht || css('--tekst-zacht', '#999');

  g.setLineDash([3, 3]);
  g.strokeStyle = lijn;
  for (const p of uitkomst.plan) g.strokeRect(ox + p.cel.x * s + 0.5, oy + p.cel.y * s + 0.5, p.cel.b * s, p.cel.h * s);
  g.setLineDash([]);
  g.font = '10px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  uitkomst.plan.forEach((p, i) => {
    const r = p.nieuw;
    g.globalAlpha = 0.3;
    g.fillStyle = accent;
    g.fillRect(ox + r.x * s, oy + r.y * s, Math.max(1, r.b * s), Math.max(1, r.h * s));
    g.globalAlpha = 1;
    g.strokeStyle = accent;
    g.strokeRect(ox + r.x * s + 0.5, oy + r.y * s + 0.5, Math.max(0, r.b * s - 1), Math.max(0, r.h * s - 1));
    if (p.cel.b * s > 16 && p.cel.h * s > 12 && uitkomst.plan.length <= 400) {
      g.fillStyle = zacht;
      g.fillText(String(i + 1), ox + (r.x + r.b / 2) * s, oy + (r.y + r.h / 2) * s);
    }
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

  const kolommen = getalVeld(w0.kolommen, 0, 500, 1);
  const tussenX = getalVeld(w0.tussenX, 0, 1000, 0.5);
  const tussenY = getalVeld(w0.tussenY, 0, 1000, 0.5);
  const uitlijning = keuzeVeld(UITLIJNINGEN, w0.uitlijning);
  const volgorde = keuzeVeld([
    ['staan', 'Zoals ze staan (rij voor rij)'],
    ['selectie', 'Volgorde van selecteren'],
    ['groot', 'Op grootte, groot eerst'],
    ['klein', 'Op grootte, klein eerst'],
    ['kleur', 'Op kleur'],
  ], w0.volgorde);
  const cel = keuzeVeld([['grootste', 'Zo groot als het grootste object'], ['vast', 'Vaste maat']], w0.cel);
  const celB = getalVeld(w0.celB, 0.1, 5000, 1);
  const celH = getalVeld(w0.celH, 0.1, 5000, 1);
  const gelijk = maak('input', { type: 'checkbox', stijl: { margin: '0' } });
  gelijk.checked = Boolean(w0.gelijk);
  const kolUitleg = maak('span', { klasse: 'uitleg' });

  const voorbeeld = maak('canvas', { 'aria-hidden': 'true', stijl: { width: '100%', height: '140px', display: 'block' } });
  const samenvatting = maak('p', { klasse: 'uitleg', 'aria-live': 'polite', stijl: { margin: '0', minHeight: '32px' } });
  const maakKnop = maak('button', { klasse: 'knop primair', type: 'submit', tekst: 'Schikken' });
  const annuleer = maak('button', { klasse: 'knop', type: 'button', tekst: 'Annuleren', bijClick: () => vexel.sluit() });

  const twee = (...k) => maak('div', { stijl: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' } }, ...k);
  const celMaat = twee(veldMetLabel('Celbreedte', celB, 'mm'), veldMetLabel('Celhoogte', celH, 'mm'));
  const formulier = maak('form', { stijl: { display: 'grid', gap: '10px', padding: '14px' } },
    twee(maak('div', { stijl: { display: 'grid', gap: '4px' } }, veldMetLabel('Kolommen', kolommen), kolUitleg),
      veldMetLabel('Uitlijnen in de cel', uitlijning)),
    twee(veldMetLabel('Tussen kolommen', tussenX, 'mm'), veldMetLabel('Tussen rijen', tussenY, 'mm')),
    veldMetLabel('Volgorde', volgorde),
    veldMetLabel('Celmaat', cel),
    celMaat,
    maak('label', { stijl: { display: 'flex', gap: '6px', alignItems: 'center' } },
      gelijk, maak('span', { tekst: 'Even groot maken: elk object passend in de cel schalen' })),
    maak('div', { stijl: { background: 'var(--bg-2)', border: '1px solid var(--lijn)', borderRadius: '6px', padding: '6px' } }, voorbeeld),
    samenvatting,
    maak('div', { klasse: 'knoppen', stijl: { marginTop: '0' } }, annuleer, maakKnop),
  );
  document.body.append(formulier);

  const waarden = () => ({
    kolommen: Math.round(begrens(leesGetal(kolommen, 0), 0, 500)),
    tussenX: begrens(leesGetal(tussenX, 5), 0, 1000),
    tussenY: begrens(leesGetal(tussenY, 5), 0, 1000),
    uitlijning: uitlijning.value,
    volgorde: volgorde.value,
    cel: cel.value,
    celB: begrens(leesGetal(celB, 30), 0.1, 5000),
    celH: begrens(leesGetal(celH, 30), 0.1, 5000),
    gelijk: gelijk.checked,
  });

  function probleem() {
    if (leesFout) return 'De selectie kon niet worden gelezen: ' + leesFout.message;
    if (doc.alleenLezen) return 'Dit document is alleen-lezen.';
    if (items.length < 2) return 'Selecteer eerst minstens twee objecten en open dit venster opnieuw.';
    return null;
  }

  function werkBij() {
    const w = waarden();
    celMaat.style.display = w.cel === 'vast' ? 'grid' : 'none';
    const p = probleem();
    maakKnop.disabled = Boolean(p);
    if (p) {
      samenvatting.textContent = p;
      samenvatting.classList.add('fout');
      kolUitleg.textContent = '0 is automatisch.';
      tekenVoorbeeld(voorbeeld, null);
      return;
    }
    samenvatting.classList.remove('fout');
    const u = bereken(items, w);
    kolUitleg.textContent = u.auto ? `Automatisch: ${u.kolommen}.` : '0 is automatisch.';
    let tekst = `${items.length} objecten in ${u.kolommen} ${u.kolommen === 1 ? 'kolom' : 'kolommen'} × ${u.rijen} `
      + `${u.rijen === 1 ? 'rij' : 'rijen'}, cellen van ${getalTekst(u.celB / pt)} × ${getalTekst(u.celH / pt)} mm.`;
    if (u.teGroot) tekst += ` Let op: ${u.teGroot === 1 ? 'één object is' : u.teGroot + ' objecten zijn'} groter dan de cel.`;
    if (items.length >= 5000) tekst += ' Let op: Vexel geeft hooguit 5000 objecten door; de rest blijft staan.';
    samenvatting.textContent = tekst;
    tekenVoorbeeld(voorbeeld, u);
  }

  formulier.addEventListener('input', werkBij);
  formulier.addEventListener('change', werkBij);
  formulier.addEventListener('submit', async (gebeurtenis) => {
    gebeurtenis.preventDefault();
    if (probleem()) return;
    const w = waarden();
    maakKnop.disabled = true;
    try {
      const nu = await leesSelectie();
      const zelfde = nu.length === items.length && nu.every((o) => items.some((v) => v.id === o.id));
      items = nu;
      if (!zelfde) {
        werkBij();
        vexel.melding('De selectie is veranderd. Bekijk het voorbeeld en klik nog eens op Schikken.', 'let');
        return;
      }
      const u = bereken(items, w);
      const lijst = u.plan.map((p) => {
        const wijziging = { id: p.o.id };
        if (Math.abs(p.schaal - 1) > 1e-9) wijziging.schaal = p.schaal;
        if (Math.abs(p.dx) > 1e-9 || Math.abs(p.dy) > 1e-9) wijziging.verplaats = { dx: p.dx, dy: p.dy };
        return wijziging;
      }).filter((x) => x.schaal !== undefined || x.verplaats);
      if (lijst.length) await vexel.wijzig(lijst);
      await vexel.bewaar('instellingen', w);
      vexel.melding(lijst.length
        ? `${items.length} objecten in ${u.kolommen} × ${u.rijen} gezet.`
        : 'Alles stond al op zijn plek.', 'ok');
      vexel.sluit();
    } catch (fout) {
      vexel.melding(fout && fout.message ? fout.message : 'Schikken lukte niet.', 'fout');
    } finally {
      maakKnop.disabled = Boolean(probleem());
    }
  });

  werkBij();
  kolommen.focus();
  kolommen.select();
}

vexel.opCommando('schikken', toonVenster);
