// Glitch: een digitale storing op een foto, met verschoven kleurkanalen, verspringende stroken,
// scanlijnen en ruisblokken. Alles met een zaadje, zodat een mooie variant terug te halen is.
// Eigen werk van GuusLab, MIT-licentie.
'use strict';

// ---- algemene hulpjes -------------------------------------------------------

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

const begrens = (n, min, max) => Math.min(max, Math.max(min, n));
const getal = (n, cijfers = 0) => n.toLocaleString('nl-NL', { minimumFractionDigits: cijfers, maximumFractionDigits: cijfers });
const metTeken = (n, cijfers = 0) => {
  if (Math.abs(n) < Math.pow(10, -cijfers) / 2) return getal(0, cijfers);
  return (n > 0 ? '+' : '−') + getal(Math.abs(n), cijfers);
};
/** Wacht tot de browser het venster opnieuw heeft getekend (zodat "Bezig…" echt te zien is). */
const verf = () => new Promise((klaar) => requestAnimationFrame(() => setTimeout(klaar, 0)));
const meervoud = (n, een, veel) => (n === 1 ? een : veel);

function hexNaarRgb(hex) {
  const h = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  const n = h ? parseInt(h[1], 16) : 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const geldigHex = (hex) => /^#[0-9a-f]{6}$/i.test(String(hex || ''));

/** Een reproduceerbare reeks getallen tussen 0 en 1 (mulberry32). */
function willekeur(zaad) {
  let a = (Math.floor(zaad) >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const nieuwZaad = () => 1 + Math.floor(Math.random() * 99998);
const tussen = (r, a, b) => a + (b - a) * r();
/** Een vaste "willekeurige" waarde 0..1 voor een paar gehele getallen (zelfde invoer, zelfde uitkomst). */
function hash3(a, b, c) {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// ---- het fotovenster (zelfde opbouw in alle fotobewerkers) ------------------

const STIJL = `
[hidden]{display:none!important}
body{padding:12px 14px;overflow:hidden}
.fv{display:grid;grid-template-columns:minmax(0,1fr) 250px;grid-template-rows:minmax(0,1fr) auto;gap:10px 14px;height:calc(100vh - 24px)}
.fv-beeld{position:relative;min-height:0;min-width:0;border-radius:6px;background:var(--bg-2);display:flex;align-items:center;justify-content:center;
  overflow:hidden;user-select:none;-webkit-user-select:none;cursor:pointer}
.fv-beeld canvas{background:transparent;border-radius:2px;box-shadow:0 1px 6px #0006}
.fv-beeld .fv-etiket{position:absolute;left:8px;top:8px;padding:2px 7px;border-radius:4px;background:#000b;color:#fff;font-size:11px;pointer-events:none}
.fv-leeg{max-width:300px;text-align:center;color:var(--tekst-zacht);line-height:1.5;cursor:default}
.fv-leeg b{display:block;color:var(--tekst);font-size:13px;margin-bottom:4px}
.fv-rechts{min-height:0;overflow-y:auto;padding-right:4px;margin-right:-4px}
.fv-kop{font-size:10.5px;text-transform:uppercase;letter-spacing:.07em;color:var(--tekst-zwak,#7f838f);margin:14px 0 4px;font-weight:600}
.fv-kop:first-child{margin-top:0}
.fv-schuif{display:grid;grid-template-columns:78px minmax(0,1fr) 40px;align-items:center;gap:6px;height:25px}
.fv-schuif span:first-child{color:var(--tekst-zacht)}
.fv-schuif .fv-waarde{text-align:right;font-variant-numeric:tabular-nums;color:var(--tekst-zacht)}
.fv-schuif.gewijzigd span:first-child,.fv-schuif.gewijzigd .fv-waarde{color:var(--tekst)}
input[type=range]{width:100%;margin:0;height:16px;background:transparent;-webkit-appearance:none;appearance:none;cursor:pointer}
input[type=range]::-webkit-slider-runnable-track{height:3px;border-radius:2px;background:var(--spoor,var(--lijn-sterk,#464954))}
input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:12px;margin-top:-4.5px;border-radius:50%;background:var(--tekst);
  border:2px solid var(--bg);box-shadow:0 0 0 1px #0008}
input[type=range]:focus{outline:none}input[type=range]:focus::-webkit-slider-thumb{background:var(--accent)}
input[type=range]:disabled{opacity:.4;cursor:default}
input[type=range]::-moz-range-track{height:3px;border-radius:2px;background:var(--spoor,var(--lijn-sterk,#464954))}
input[type=range]::-moz-range-thumb{width:10px;height:10px;border-radius:50%;background:var(--tekst);border:2px solid var(--bg)}
.fv-rij{display:flex;align-items:center;gap:8px;margin:5px 0}
.fv-rij .label{min-width:78px}
.fv-rij input[type=color]{width:34px;height:24px;padding:0;border:1px solid var(--lijn);border-radius:4px;background:var(--bg-2);cursor:pointer}
.fv-vink{display:flex;align-items:center;gap:8px;margin:8px 0 4px;color:var(--tekst);cursor:pointer}
.fv-onder{grid-column:1/-1;display:flex;align-items:center;gap:8px}
.fv-onder .uitleg{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
`;

/**
 * Bouwt het venster: grote voorvertoning links, instellingen rechts, knoppen onder.
 * cfg: { naam, standaard, velden, bereken(bron, doel, b, h, w), klaarTekst(n), zichtbaar?(w, sleutel), zaad? }
 */
async function fotoVenster(cfg) {
  document.head.append(maak('style', { tekst: STIJL }));
  const doc = await vexel.document();
  const selectie = await vexel.selectie();
  const fotos = selectie.filter((o) => o.soort === 'beeld');
  const bewaard = (await vexel.haal('instellingen')) || {};
  const w = { ...cfg.standaard };
  for (const k of Object.keys(cfg.standaard)) {
    if (typeof bewaard[k] === typeof cfg.standaard[k]) w[k] = bewaard[k];
  }

  const beeldVak = maak('div', { klasse: 'fv-beeld', title: 'Ingedrukt houden: origineel' });
  const etiket = maak('div', { klasse: 'fv-etiket', tekst: 'Origineel' });
  etiket.hidden = true;
  const doek = maak('canvas');
  beeldVak.append(doek, etiket);
  const rechts = maak('div', { klasse: 'fv-rechts' });

  // de instellingen
  const velden = [];
  for (const v of cfg.velden) {
    if (v.kop) {
      const kop = maak('div', { klasse: 'fv-kop', tekst: v.kop });
      velden.push({ v, rij: kop });
      rechts.append(kop);
      continue;
    }
    let rij;
    let zet;
    if (v.keuzes) {
      const lijst = maak('select', { klasse: 'veld', 'aria-label': v.label });
      for (const [waarde, tekst] of v.keuzes) lijst.append(maak('option', { value: waarde, tekst }));
      lijst.addEventListener('change', () => {
        w[v.sleutel] = lijst.value;
        gewijzigd();
      });
      rij = maak('div', { klasse: 'fv-rij' }, maak('span', { klasse: 'label', tekst: v.label }), lijst);
      zet = () => {
        lijst.value = w[v.sleutel];
      };
    } else if (v.vinkje) {
      const vak = maak('input', { type: 'checkbox', 'aria-label': v.label });
      vak.addEventListener('change', () => {
        w[v.sleutel] = vak.checked;
        gewijzigd();
      });
      rij = maak('label', { klasse: 'fv-vink' }, vak, maak('span', { tekst: v.label }));
      zet = () => {
        vak.checked = !!w[v.sleutel];
      };
    } else if (v.kleur) {
      const veld = maak('input', { type: 'color', 'aria-label': v.label });
      veld.addEventListener('input', () => {
        w[v.sleutel] = veld.value;
        gewijzigd();
      });
      rij = maak('div', { klasse: 'fv-rij' }, maak('span', { klasse: 'label', tekst: v.label }), veld,
        v.uitleg ? maak('span', { klasse: 'uitleg', tekst: v.uitleg }) : null);
      zet = () => {
        veld.value = geldigHex(w[v.sleutel]) ? w[v.sleutel] : cfg.standaard[v.sleutel];
      };
    } else {
      const invoer = maak('input', { type: 'range', min: v.min, max: v.max, step: v.stap || 1, 'aria-label': v.label });
      if (v.spoor) invoer.style.setProperty('--spoor', v.spoor);
      const waarde = maak('span', { klasse: 'fv-waarde' });
      rij = maak('label', { klasse: 'fv-schuif', title: 'Dubbelklik om terug te zetten' }, maak('span', { tekst: v.label }), invoer, waarde);
      invoer.addEventListener('input', () => {
        w[v.sleutel] = Number(invoer.value);
        gewijzigd();
      });
      invoer.addEventListener('dblclick', () => {
        w[v.sleutel] = cfg.standaard[v.sleutel];
        gewijzigd();
      });
      zet = () => {
        invoer.value = String(w[v.sleutel]);
        const n = w[v.sleutel];
        waarde.textContent = (v.min < 0 ? metTeken(n, v.cijfers || 0) : getal(n, v.cijfers || 0)) + (v.eenheid || '');
        rij.classList.toggle('gewijzigd', n !== cfg.standaard[v.sleutel]);
      };
    }
    velden.push({ v, rij, zet });
    rechts.append(rij);
  }

  const samenvatting = maak('div', { klasse: 'uitleg' });
  const voorNa = maak('button', { type: 'button', klasse: 'knop', tekst: 'Voor/na', title: 'Ingedrukt houden om het origineel te zien (of houd de toets V ingedrukt)' });
  const standaard = maak('button', { type: 'button', klasse: 'knop', tekst: 'Standaard', title: 'Terug naar de standaardinstellingen' });
  const variant = cfg.zaad ? maak('button', { type: 'button', klasse: 'knop', tekst: 'Andere variant', title: 'Zelfde instellingen, ander toeval' }) : null;
  const annuleer = maak('button', { type: 'button', klasse: 'knop', tekst: 'Annuleren', bijClick: () => vexel.sluit() });
  const toepassen = maak('button', { type: 'submit', klasse: 'knop primair', tekst: 'Toepassen' });
  const onder = maak('div', { klasse: 'fv-onder' }, voorNa, variant, standaard, samenvatting, annuleer, toepassen);
  const formulier = maak('form', { klasse: 'fv' }, beeldVak, rechts, onder);
  document.body.append(formulier);

  const zonderFoto = (titel, tekst) => {
    doek.remove();
    beeldVak.style.cursor = 'default';
    beeldVak.removeAttribute('title');
    beeldVak.append(maak('div', { klasse: 'fv-leeg' }, maak('b', { tekst: titel }), maak('span', { tekst })));
    for (const el of [rechts, voorNa, variant, standaard, toepassen]) if (el) el.hidden = true;
    formulier.style.gridTemplateColumns = 'minmax(0,1fr)';
    annuleer.textContent = 'Sluiten';
    samenvatting.textContent = '';
    formulier.addEventListener('submit', (e) => e.preventDefault());
    annuleer.focus();
  };
  if (!fotos.length) {
    if (selectie.length) zonderFoto('Dit is geen foto', `Je selectie bevat geen foto. Selecteer een foto (Bestand › Plaatsen) en open ${cfg.naam} opnieuw.`);
    else zonderFoto('Selecteer eerst een foto', `Selecteer eerst een foto (Bestand › Plaatsen) en open ${cfg.naam} opnieuw.`);
    return;
  }

  samenvatting.textContent = 'Foto laden…';
  let klein;
  try {
    klein = await vexel.beeld(fotos[0].id, { maxZijde: 900 });
  } catch (fout) {
    zonderFoto('Deze foto kan ik niet lezen', fout.message);
    return;
  }
  const bron = klein.pixels;
  const uit = new ImageData(klein.breedte, klein.hoogte);
  doek.width = klein.breedte;
  doek.height = klein.hoogte;
  const g = doek.getContext('2d');
  const origineel = new ImageData(new Uint8ClampedArray(bron), klein.breedte, klein.hoogte);

  const pasMaat = () => {
    const r = beeldVak.getBoundingClientRect();
    const f = Math.min((r.width - 16) / klein.breedte, (r.height - 16) / klein.hoogte, 2);
    doek.style.width = Math.max(1, Math.floor(klein.breedte * f)) + 'px';
    doek.style.height = Math.max(1, Math.floor(klein.hoogte * f)) + 'px';
  };
  pasMaat();
  addEventListener('resize', pasMaat);

  let vraagTeken = 0;
  let toonOrigineel = false;
  function teken() {
    vraagTeken = 0;
    if (toonOrigineel) {
      g.putImageData(origineel, 0, 0);
      return;
    }
    cfg.bereken(bron, uit.data, klein.breedte, klein.hoogte, w);
    g.putImageData(uit, 0, 0);
  }
  const plan = () => {
    if (!vraagTeken) vraagTeken = requestAnimationFrame(teken);
  };

  const samen = () => {
    const delen = [];
    if (fotos.length > 1) delen.push(`${fotos.length} foto's geselecteerd; je ziet de eerste, Toepassen bewerkt ze allemaal`);
    else delen.push(`${fotos[0].naam || 'Foto'} · ${getal(klein.origineel[0])} × ${getal(klein.origineel[1])} px`);
    if (cfg.zaad) delen.push('variant ' + w.zaad);
    if (fotos.some((f) => f.beeld && f.beeld.cmyk)) delen.push('CMYK-foto wordt RGB');
    if (doc.alleenLezen) delen.push('dit document is alleen-lezen');
    samenvatting.textContent = delen.join(' · ');
    samenvatting.title = samenvatting.textContent;
  };

  let bewaarKlok = 0;
  function gewijzigd() {
    for (const { v, rij, zet } of velden) {
      if (zet) zet();
      if (cfg.zichtbaar) rij.hidden = !cfg.zichtbaar(w, v.sleutel || v.kop);
    }
    toepassen.disabled = doc.alleenLezen;
    samen();
    plan();
    clearTimeout(bewaarKlok);
    bewaarKlok = setTimeout(() => vexel.bewaar('instellingen', w), 400);
  }

  standaard.addEventListener('click', () => {
    Object.assign(w, cfg.standaard, cfg.zaad ? { zaad: w.zaad } : {});
    gewijzigd();
  });
  if (variant) {
    variant.addEventListener('click', () => {
      w.zaad = nieuwZaad();
      gewijzigd();
    });
  }

  const zetOrigineel = (aan) => {
    if (toonOrigineel === aan) return;
    toonOrigineel = aan;
    etiket.hidden = !aan;
    voorNa.classList.toggle('primair', aan);
    plan();
  };
  for (const el of [voorNa, beeldVak]) {
    el.addEventListener('pointerdown', (e) => {
      if (e.button === 0) zetOrigineel(true);
    });
  }
  addEventListener('pointerup', () => zetOrigineel(false));
  addEventListener('pointercancel', () => zetOrigineel(false));
  addEventListener('blur', () => zetOrigineel(false));
  document.addEventListener('keydown', (e) => {
    const typen = e.target && (e.target.tagName === 'SELECT' || e.target.type === 'color');
    if ((e.key === 'v' || e.key === 'V') && !e.metaKey && !e.ctrlKey && !e.repeat && !typen) zetOrigineel(true);
  });
  document.addEventListener('keyup', (e) => {
    if (e.key === 'v' || e.key === 'V') zetOrigineel(false);
  });

  formulier.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (doc.alleenLezen) {
      vexel.melding('Dit document is alleen-lezen; de foto kan niet worden aangepast.', 'let');
      return;
    }
    clearTimeout(bewaarKlok);
    vexel.bewaar('instellingen', w);
    for (const el of formulier.querySelectorAll('input, select, button')) el.disabled = true;
    toepassen.textContent = 'Bezig…';
    let klaar = 0;
    try {
      for (const foto of fotos) {
        samenvatting.textContent = fotos.length > 1 ? `Bezig met foto ${klaar + 1} van ${fotos.length}…` : 'Bezig met de volle foto…';
        await verf();
        const groot = await vexel.beeld(foto.id);
        const doel = new Uint8ClampedArray(groot.pixels.length);
        cfg.bereken(groot.pixels, doel, groot.breedte, groot.hoogte, w);
        await vexel.zetBeeld(foto.id, { breedte: groot.breedte, hoogte: groot.hoogte, pixels: doel });
        klaar++;
      }
      vexel.melding(cfg.klaarTekst(klaar), 'ok');
      vexel.sluit();
    } catch (fout) {
      vexel.melding((klaar ? `${klaar} ${meervoud(klaar, 'foto', "foto's")} bewerkt, daarna ging het mis: ` : '') + fout.message, 'fout');
      for (const el of formulier.querySelectorAll('input, select, button')) el.disabled = false;
      toepassen.textContent = 'Toepassen';
      gewijzigd();
    }
  });

  gewijzigd();
  if (doc.alleenLezen) toepassen.title = 'Dit document is alleen-lezen.';
  toepassen.focus();
}

// ---- de glitch --------------------------------------------------------------
// Alle maten zijn een deel van de breedte of hoogte, zodat de volle foto er net zo uitziet als de voorvertoning.

const STANDAARD = {
  rood: 35, blauw: -35, verticaal: 0,
  stroken: 18, verspringen: 40, hoogte: 4,
  scan: 30, dichtheid: 260,
  blokken: 12, blokgrootte: 12,
  zaad: 1234,
};

const VELDEN = [
  { kop: 'Kleurkanalen' },
  { sleutel: 'rood', label: 'Rood', min: -100, max: 100, spoor: 'linear-gradient(90deg,#ff5050,#5a5a5a,#ff5050)' },
  { sleutel: 'blauw', label: 'Blauw', min: -100, max: 100, spoor: 'linear-gradient(90deg,#4f8dff,#5a5a5a,#4f8dff)' },
  { sleutel: 'verticaal', label: 'Verticaal', min: -100, max: 100 },
  { kop: 'Verschoven stroken' },
  { sleutel: 'stroken', label: 'Stroken', min: 0, max: 60 },
  { sleutel: 'verspringen', label: 'Verspringen', min: 0, max: 100 },
  { sleutel: 'hoogte', label: 'Hoogte', min: 1, max: 20 },
  { kop: 'Scanlijnen' },
  { sleutel: 'scan', label: 'Sterkte', min: 0, max: 100 },
  { sleutel: 'dichtheid', label: 'Lijnen', min: 60, max: 600, stap: 10 },
  { kop: 'Ruisblokken' },
  { sleutel: 'blokken', label: 'Blokken', min: 0, max: 60 },
  { sleutel: 'blokgrootte', label: 'Blokgrootte', min: 1, max: 30 },
];

/** Rekent de glitch uit van `bron` naar `doel`. Doorzichtige plekken (PNG) blijven doorzichtig en geven geen zwarte randen. */
function glitch(bron, doel, b, h, w) {
  const r = willekeur(w.zaad);
  const tus = new Uint8ClampedArray(bron);

  // 1. horizontale stroken die verspringen (met omloop), soms maar één kanaal
  const stroken = [];
  for (let i = 0; i < w.stroken; i++) {
    const y = r();
    const hoog = 0.002 + Math.pow(r(), 2) * (w.hoogte / 100);
    const dx = (r() * 2 - 1) * (w.verspringen / 100) * 0.35 * (r() < 0.3 ? 0.35 : 1);
    const kanaal = r() < 0.35 ? Math.floor(r() * 3) : -1;
    stroken.push({ y, hoog, dx, kanaal });
  }
  for (const s of stroken) {
    const y0 = Math.floor(s.y * h);
    const y1 = Math.min(h, y0 + Math.max(1, Math.round(s.hoog * h)));
    const dx = Math.round(s.dx * b);
    if (!dx) continue;
    for (let y = y0; y < y1; y++) {
      const rij = y * b;
      for (let x = 0; x < b; x++) {
        const j = (rij + x) * 4;
        if (bron[j + 3] === 0) continue;
        let sx = (x - dx) % b;
        if (sx < 0) sx += b;
        const k = (rij + sx) * 4;
        const a = bron[k + 3] / 255;
        if (s.kanaal < 0) {
          for (let c = 0; c < 3; c++) tus[j + c] = bron[k + c] * a + bron[j + c] * (1 - a);
        } else tus[j + s.kanaal] = bron[k + s.kanaal] * a + bron[j + s.kanaal] * (1 - a);
      }
    }
  }

  // 2. de kleurkanalen uit elkaar (aan de rand vastgehouden)
  const dR = Math.round((w.rood / 100) * 0.04 * b);
  const dB = Math.round((w.blauw / 100) * 0.04 * b);
  const dV = Math.round((w.verticaal / 100) * 0.03 * h);
  for (let y = 0; y < h; y++) {
    const yr = begrens(y - dV, 0, h - 1) * b;
    const yb = begrens(y + dV, 0, h - 1) * b;
    for (let x = 0; x < b; x++) {
      const j = (y * b + x) * 4;
      const kr = (yr + begrens(x - dR, 0, b - 1)) * 4;
      const kb = (yb + begrens(x - dB, 0, b - 1)) * 4;
      const ar = tus[kr + 3] / 255;
      const ab = tus[kb + 3] / 255;
      doel[j] = tus[kr] * ar + tus[j] * (1 - ar);
      doel[j + 1] = tus[j + 1];
      doel[j + 2] = tus[kb + 2] * ab + tus[j + 2] * (1 - ab);
      doel[j + 3] = bron[j + 3];
    }
  }

  // 3. ruisblokken: verplaatste stukken, gekleurde ruis en kapotte kleuren
  const cel = h / 240;
  for (let i = 0; i < w.blokken; i++) {
    const bb = (0.02 + r() * (w.blokgrootte / 100) * 1.6) * b;
    const bh = (0.006 + Math.pow(r(), 1.5) * (w.blokgrootte / 100) * 0.6) * h;
    const x0 = Math.floor(r() * (b - bb));
    const y0 = Math.floor(r() * (h - bh));
    const x1 = Math.min(b, Math.ceil(x0 + bb));
    const y1 = Math.min(h, Math.ceil(y0 + bh));
    const soort = r();
    const ox = Math.round((r() * 2 - 1) * 0.12 * b);
    const oy = Math.round((r() * 2 - 1) * 0.04 * h);
    const zout = Math.floor(r() * 100000);
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const j = (y * b + x) * 4;
        if (bron[j + 3] === 0) continue;
        if (soort < 0.45) {
          const k = (begrens(y + oy, 0, h - 1) * b + begrens(x + ox, 0, b - 1)) * 4;
          const a = tus[k + 3] / 255;
          for (let c = 0; c < 3; c++) doel[j + c] = tus[k + c] * a + doel[j + c] * (1 - a);
        } else if (soort < 0.75) {
          const ix = Math.floor(x / cel);
          const iy = Math.floor(y / cel);
          const v = hash3(ix, iy, zout);
          const fel = hash3(ix, iy, zout + 1) < 0.25;
          for (let c = 0; c < 3; c++) {
            const n = fel ? (hash3(ix, iy, zout + 2 + c) < 0.5 ? 0 : 255) : v * 255;
            doel[j + c] = n * 0.85 + doel[j + c] * 0.15;
          }
        } else {
          const rr = doel[j];
          doel[j] = Math.round(doel[j + 2] / 85) * 85;
          doel[j + 1] = Math.round(doel[j + 1] / 85) * 85;
          doel[j + 2] = Math.round(rr / 85) * 85;
        }
      }
    }
  }

  // 4. scanlijnen: een zachte golf over de hoogte
  if (w.scan > 0) {
    const s = (w.scan / 100) * 0.5;
    const periode = h / w.dichtheid;
    for (let y = 0; y < h; y++) {
      // het gemiddelde van de golf over de hele pixelrij, zodat fijne lijnen op een kleine foto niet verdwijnen
      const k = (2 * Math.PI) / periode;
      const golf = 0.5 + (0.5 * (Math.sin(k * (y + 1)) - Math.sin(k * y))) / k;
      const f = 1 - s * golf;
      if (f === 1) continue;
      for (let x = 0, j = y * b * 4; x < b; x++, j += 4) {
        doel[j] *= f;
        doel[j + 1] *= f;
        doel[j + 2] *= f;
      }
    }
  }
}

vexel.opCommando('glitch', () => fotoVenster({
  naam: 'Glitch',
  standaard: STANDAARD,
  velden: VELDEN,
  zaad: true,
  bereken: glitch,
  klaarTekst: (n) => (n > 1 ? `Glitch op ${n} foto's gezet.` : 'Glitch op de foto gezet.'),
}));
