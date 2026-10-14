// Lichtlek: warme, filmachtige lichtvlekken en gloed langs de rand van een foto,
// met desgewenst stofjes en krasjes. Alles met een zaadje, zodat een mooie variant terug te halen is.
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

// ---- het lichtlek -----------------------------------------------------------
// Het licht wordt eerst op een klein raster berekend (in verhoudingen van de foto) en dan zacht
// uitvergroot, zodat de volle foto er net zo uitziet als de voorvertoning.

const KLEUREN = {
  oranje: { naam: 'Warm oranje', kern: '#fff1c4', kleur: '#ff7a1f', rand: '#e0241b' },
  rood: { naam: 'Rood', kern: '#ffd2a8', kleur: '#ff3b1f', rand: '#b8001e' },
  roze: { naam: 'Roze', kern: '#ffe3ef', kleur: '#ff5f9e', rand: '#c2185b' },
  goud: { naam: 'Goud', kern: '#fffbe0', kleur: '#ffc23a', rand: '#ff7a00' },
  paars: { naam: 'Paars en blauw', kern: '#f2e6ff', kleur: '#a35cff', rand: '#2f5bff' },
  eigen: { naam: 'Eigen kleur' },
};

const PLEKKEN = [
  ['links', 'Links'], ['rechts', 'Rechts'], ['boven', 'Boven'], ['onder', 'Onder'],
  ['linksboven', 'Linksboven'], ['rechtsboven', 'Rechtsboven'], ['linksonder', 'Linksonder'], ['rechtsonder', 'Rechtsonder'],
  ['twee', 'Links en rechts'],
];

const STANDAARD = {
  kleur: 'oranje', eigenKleur: '#ff6a3d', plek: 'rechts',
  sterkte: 70, grootte: 45, gloed: 20,
  stof: false, stofjes: 40, krasjes: 30,
  zaad: 2024,
};

const VELDEN = [
  { kop: 'Licht' },
  { sleutel: 'kleur', label: 'Kleur', keuzes: Object.entries(KLEUREN).map(([k, v]) => [k, v.naam]) },
  { sleutel: 'eigenKleur', label: 'Eigen kleur', kleur: true },
  { sleutel: 'plek', label: 'Plek', keuzes: PLEKKEN },
  { sleutel: 'sterkte', label: 'Sterkte', min: 0, max: 100 },
  { sleutel: 'grootte', label: 'Grootte', min: 10, max: 100 },
  { sleutel: 'gloed', label: 'Gloed', min: 0, max: 100 },
  { kop: 'Film' },
  { sleutel: 'stof', label: 'Stofjes en krasjes', vinkje: true },
  { sleutel: 'stofjes', label: 'Stofjes', min: 0, max: 100 },
  { sleutel: 'krasjes', label: 'Krasjes', min: 0, max: 100 },
];

const lin = (v) => Math.pow(v / 255, 2.2);
/** Van lineair licht (0..1) terug naar schermwaarden, als tabel: dat scheelt veel rekenwerk per pixel. */
const GAMMA = new Float32Array(4097);
for (let i = 0; i <= 4096; i++) GAMMA[i] = Math.pow(i / 4096, 1 / 2.2);

/** De kleuren van een lek (lineair licht): kern (heet), kleur en rand. */
function lekKleuren(w) {
  const k = KLEUREN[w.kleur] && w.kleur !== 'eigen' ? KLEUREN[w.kleur] : null;
  if (k) return [k.kern, k.kleur, k.rand].map((h) => hexNaarRgb(h).map(lin));
  const eigen = hexNaarRgb(geldigHex(w.eigenKleur) ? w.eigenKleur : STANDAARD.eigenKleur);
  const kern = eigen.map((v) => 255 - (255 - v) * 0.25);
  const rand = eigen.map((v) => v * 0.7);
  return [kern, eigen, rand].map((c) => c.map(lin));
}

/** De richting van de randen waar het licht vandaan komt: [ux, uy] wijst de foto in. */
function randen(plek) {
  const r = {
    links: [[0, 0.5, 1, 0]], rechts: [[1, 0.5, -1, 0]], boven: [[0.5, 0, 0, 1]], onder: [[0.5, 1, 0, -1]],
    linksboven: [[0, 0, 0.71, 0.71]], rechtsboven: [[1, 0, -0.71, 0.71]],
    linksonder: [[0, 1, 0.71, -0.71]], rechtsonder: [[1, 1, -0.71, -0.71]],
    twee: [[0, 0.5, 1, 0], [1, 0.5, -1, 0]],
  };
  return r[plek] || r.rechts;
}

/** Berekent het licht op een klein raster (gb × gh), RGB lineair, 0 tot ongeveer 1. */
function lichtKaart(w, verhouding) {
  const gb = verhouding >= 1 ? 192 : Math.max(8, Math.round(192 * verhouding));
  const gh = verhouding >= 1 ? Math.max(8, Math.round(192 / verhouding)) : 192;
  const kaart = new Float32Array(gb * gh * 3);
  const r = willekeur(w.zaad);
  const [kern, kleur, rand] = lekKleuren(w);
  const bereik = 0.12 + (w.grootte / 100) * 0.75;
  // in eenheden waarin de korte zijde 1 is, zodat vlekken rond blijven
  const sx = Math.max(1, verhouding);
  const sy = Math.max(1, 1 / verhouding);
  const vlekken = [];
  for (const [ex, ey, ux, uy] of randen(w.plek)) {
    const vx = -uy;
    const vy = ux;
    const n = 5 + Math.floor(r() * 4);
    for (let i = 0; i < n; i++) {
      const langs = (r() * 2 - 1) * 0.55;
      const diep = Math.pow(r(), 1.6) * bereik * 0.55 - 0.05;
      vlekken.push({
        x: ex * sx + vx * langs * sx + ux * diep,
        y: ey * sy + vy * langs * sy + uy * diep,
        rl: (0.15 + r() * 0.5) * bereik * 1.3,
        rd: (0.25 + r() * 0.55) * bereik,
        ux, uy, vx, vy,
        sterk: 0.15 + Math.pow(r(), 0.7) * 0.9,
        heet: r(),
      });
    }
  }
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gb; gx++) {
      const px = ((gx + 0.5) / gb) * sx;
      const py = ((gy + 0.5) / gh) * sy;
      let rr = 0;
      let gg = 0;
      let bb = 0;
      for (const v of vlekken) {
        const dx = px - v.x;
        const dy = py - v.y;
        const l = (dx * v.vx + dy * v.vy) / v.rl;
        const d = (dx * v.ux + dy * v.uy) / v.rd;
        const e = Math.exp(-(l * l + d * d) * 1.6) * v.sterk;
        if (e < 0.002) continue;
        // midden van een vlek heet (bijna wit), naar buiten de kleur, helemaal buiten de rand
        const t = Math.exp(-(l * l + d * d) * 3.5) * v.heet;
        const u = begrens(Math.sqrt(l * l + d * d) / 1.4, 0, 1);
        for (let c = 0; c < 3; c++) {
          const basis = kleur[c] * (1 - u) + rand[c] * u;
          const k = basis * (1 - t) + kern[c] * t;
          if (c === 0) rr += k * e;
          else if (c === 1) gg += k * e;
          else bb += k * e;
        }
      }
      const i = (gy * gb + gx) * 3;
      kaart[i] = 1 - Math.exp(-rr * 1.6);
      kaart[i + 1] = 1 - Math.exp(-gg * 1.6);
      kaart[i + 2] = 1 - Math.exp(-bb * 1.6);
    }
  }
  return { kaart, gb, gh, kleur };
}

/** Stofjes en krasjes: vaste plekken (in verhoudingen), als zachte vlekjes en lijntjes in een dekkingslaag. */
function stofLaag(w, b, h) {
  const laag = new Float32Array(b * h);
  const r = willekeur(w.zaad * 7 + 3);
  const lang = Math.max(b, h);
  const verf1 = (x, y, straal, sterk) => {
    const s = Math.max(0.6, straal);
    const dekking = sterk * Math.min(1, (straal * straal) / 0.36);
    const x0 = Math.max(0, Math.floor(x - s - 1));
    const x1 = Math.min(b - 1, Math.ceil(x + s + 1));
    const y0 = Math.max(0, Math.floor(y - s - 1));
    const y1 = Math.min(h - 1, Math.ceil(y + s + 1));
    for (let yy = y0; yy <= y1; yy++) {
      for (let xx = x0; xx <= x1; xx++) {
        const d = Math.hypot(xx + 0.5 - x, yy + 0.5 - y);
        const a = begrens(s + 0.5 - d, 0, 1) * dekking;
        const i = yy * b + xx;
        if (Math.abs(a) > Math.abs(laag[i])) laag[i] = a;
      }
    }
  };
  const n = Math.round((w.stofjes / 100) * 160);
  for (let i = 0; i < n; i++) {
    const x = r() * b;
    const y = r() * h;
    const licht = r() < 0.75;
    const sterk = (licht ? 1 : -0.8) * (0.35 + r() * 0.6);
    if (r() < 0.2) {
      // een haartje: een kort, gebogen lijntje
      const lengte = (0.01 + r() * 0.04) * lang;
      let hoek = r() * Math.PI * 2;
      const buig = (r() * 2 - 1) * 0.08;
      const stappen = Math.ceil(lengte);
      let px = x;
      let py = y;
      for (let s = 0; s < stappen; s++) {
        verf1(px, py, lang * 0.0005, sterk * 0.8);
        px += Math.cos(hoek);
        py += Math.sin(hoek);
        hoek += buig / Math.max(1, lang / 900);
      }
    } else verf1(x, y, (0.0006 + Math.pow(r(), 3) * 0.003) * lang, sterk);
  }
  const k = Math.round((w.krasjes / 100) * 9);
  for (let i = 0; i < k; i++) {
    const x0 = r() * b;
    const golf = (r() * 0.006 + 0.001) * b;
    const fase = r() * 6.28;
    const begin = r() * 0.6 * h;
    const eind = Math.min(h, begin + (0.3 + r() * 0.7) * h);
    const sterk = 0.18 + r() * 0.3;
    const dik = lang * (0.0003 + r() * 0.0004);
    for (let y = Math.floor(begin); y < eind; y++) {
      const x = x0 + golf * Math.sin(fase + (y / h) * 5);
      const flits = 0.6 + 0.4 * Math.sin(fase * 3 + (y / h) * 40);
      verf1(x, y, dik, sterk * flits);
    }
  }
  return laag;
}

/** Rekent het lichtlek uit van `bron` naar `doel`. */
function lichtlek(bron, doel, b, h, w) {
  const { kaart, gb, gh, kleur } = lichtKaart(w, b / h);
  const sterkte = (w.sterkte / 100) * 1.25;
  const gloed = w.gloed / 100;
  const gloedKleur = kleur.map((v) => Math.pow(v, 1 / 2.2));
  const stof = w.stof ? stofLaag(w, b, h) : null;
  const fx = gb / b;
  const fy = gh / h;
  const rij = new Float32Array(b * 3);
  for (let y = 0; y < h; y++) {
    // één rij van de lichtkaart bilineair uitvergroten
    const ky = begrens((y + 0.5) * fy - 0.5, 0, gh - 1);
    const y0 = Math.floor(ky);
    const y1 = Math.min(gh - 1, y0 + 1);
    const ty = ky - y0;
    for (let x = 0; x < b; x++) {
      const kx = begrens((x + 0.5) * fx - 0.5, 0, gb - 1);
      const x0 = Math.floor(kx);
      const x1 = Math.min(gb - 1, x0 + 1);
      const tx = kx - x0;
      for (let c = 0; c < 3; c++) {
        const a = kaart[(y0 * gb + x0) * 3 + c] * (1 - tx) + kaart[(y0 * gb + x1) * 3 + c] * tx;
        const d = kaart[(y1 * gb + x0) * 3 + c] * (1 - tx) + kaart[(y1 * gb + x1) * 3 + c] * tx;
        rij[x * 3 + c] = GAMMA[(begrens((a * (1 - ty) + d * ty) * sterkte, 0, 1) * 4096) | 0];
      }
    }
    for (let x = 0; x < b; x++) {
      const j = (y * b + x) * 4;
      const s = stof ? stof[y * b + x] : 0;
      for (let c = 0; c < 3; c++) {
        let v = bron[j + c] / 255;
        // gloed: de zwarten iets optillen in de kleur van het licht, alsof het licht over de hele film kruipt
        if (gloed > 0) v = v + (1 - v) * gloed * 0.16 * gloedKleur[c] - v * gloed * 0.04;
        // "scherm"-menging: licht maakt alleen lichter, nooit doffer
        const l = rij[x * 3 + c];
        v = 1 - (1 - v) * (1 - l);
        if (s > 0) v = v + (1 - v) * s * 0.9;
        else if (s < 0) v = v * (1 + s * 0.85);
        doel[j + c] = v * 255 + 0.5;
      }
      doel[j + 3] = bron[j + 3];
    }
  }
}

vexel.opCommando('lichtlek', () => fotoVenster({
  naam: 'Lichtlek',
  standaard: STANDAARD,
  velden: VELDEN,
  zaad: true,
  bereken: lichtlek,
  zichtbaar: (w, sleutel) => {
    if (sleutel === 'eigenKleur') return w.kleur === 'eigen';
    if (sleutel === 'stofjes' || sleutel === 'krasjes') return w.stof;
    return true;
  },
  klaarTekst: (n) => (n > 1 ? `Lichtlek op ${n} foto's gezet.` : 'Lichtlek op de foto gezet.'),
}));
