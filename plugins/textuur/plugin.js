// Textuur: maakt een doorzichtige textuurfoto (korrel, papiervezel, vlekken, rasterpunten of krassen)
// om over een ontwerp te leggen. Alle maten in millimeter, met een zaadje voor een vaste variant.
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


// ---- ruis -------------------------------------------------------------------

/** Vloeiende waarderuis (0..1) op een rooster met cellen van 1 bij 1. */
function ruis(x, y, zaad) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = hash3(xi, yi, zaad);
  const b = hash3(xi + 1, yi, zaad);
  const c = hash3(xi, yi + 1, zaad);
  const d = hash3(xi + 1, yi + 1, zaad);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
/** Een paar lagen ruis op elkaar (grof tot fijn), 0..1. */
function wolk(x, y, zaad, lagen) {
  let som = 0;
  let gewicht = 0;
  let f = 1;
  let a = 1;
  for (let i = 0; i < lagen; i++) {
    som += ruis(x * f + i * 17.3, y * f - i * 9.1, zaad + i * 101) * a;
    gewicht += a;
    f *= 2.03;
    a *= 0.5;
  }
  return som / gewicht;
}
const zacht = (a, b, x) => {
  const t = begrens((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// ---- de texturen ------------------------------------------------------------
// Alles is in millimeter: dezelfde textuur ziet er op elke resolutie hetzelfde uit.

const SOORTEN = [
  ['korrel', 'Korrel'],
  ['vezel', 'Papiervezel'],
  ['vlekken', 'Vlekken (grunge)'],
  ['raster', 'Rasterpunten'],
  ['krassen', 'Krassen'],
];

const STANDAARD = {
  soort: 'korrel', kleur: '#000000', dekking: 35, grootte: 40, dichtheid: 50,
  maat: 'tekengebied', ppi: 300, achtergrond: 'licht', zaad: 777,
};

/**
 * Tekent de dekking (0..255) van een textuur in een stuk van het vlak.
 * vak = { x, y, b, h } in mm (het stuk dat je wilt zien), k = pixels per mm, pb/ph = pixelmaat.
 * totaal = { b, h } in mm: het hele vlak, zodat de vormen overal dezelfde zijn.
 */
function textuur(w, totaal, vak, k, pb, ph) {
  const dek = new Uint8ClampedArray(pb * ph);
  const g = w.grootte / 100;
  const d = w.dichtheid / 100;
  const zaad = w.zaad;
  const r = willekeur(zaad);
  const opp = totaal.b * totaal.h;

  // vormen (lijnen, punten) tekenen we met het canvas: dat is vanzelf even scherp op elke maat
  const tekenVormen = (teken) => {
    const doek = new OffscreenCanvas(pb, ph);
    const c = doek.getContext('2d');
    c.setTransform(k, 0, 0, k, -vak.x * k, -vak.y * k);
    c.fillStyle = '#000';
    c.strokeStyle = '#000';
    c.lineCap = 'round';
    teken(c);
    const px = c.getImageData(0, 0, pb, ph).data;
    for (let i = 0; i < dek.length; i++) dek[i] = Math.max(dek[i], px[i * 4 + 3]);
  };
  const perPixel = (f) => {
    for (let y = 0; y < ph; y++) {
      const my = vak.y + (y + 0.5) / k;
      for (let x = 0; x < pb; x++) {
        const v = f(vak.x + (x + 0.5) / k, my);
        const i = y * pb + x;
        if (v * 255 > dek[i]) dek[i] = v * 255;
      }
    }
  };

  if (w.soort === 'korrel') {
    const cel = 0.05 + g * 0.35; // mm
    const drempel = 0.78 - d * 0.42;
    perPixel((x, y) => {
      const n = ruis(x / cel, y / cel, zaad) * 0.7 + ruis(x / (cel * 0.45), y / (cel * 0.45), zaad + 7) * 0.3;
      const golf = ruis(x / 25, y / 25, zaad + 3) * 0.12;
      return zacht(drempel - golf, drempel - golf + 0.12, n);
    });
  } else if (w.soort === 'vezel') {
    const n = Math.round(opp * (0.01 + d * 0.06));
    const lengte = 2 + g * 14;
    tekenVormen((c) => {
      for (let i = 0; i < Math.min(n, 60000); i++) {
        const x = r() * totaal.b;
        const y = r() * totaal.h;
        const hoek = r() * Math.PI * 2;
        const l = lengte * (0.3 + r() * 0.9);
        const buig = (r() * 2 - 1) * 0.6;
        const x2 = x + Math.cos(hoek) * l;
        const y2 = y + Math.sin(hoek) * l;
        const cx = (x + x2) / 2 + Math.cos(hoek + Math.PI / 2) * l * buig * 0.3;
        const cy = (y + y2) / 2 + Math.sin(hoek + Math.PI / 2) * l * buig * 0.3;
        c.globalAlpha = 0.25 + r() * 0.6;
        c.lineWidth = 0.03 + Math.pow(r(), 2) * 0.12;
        c.beginPath();
        c.moveTo(x, y);
        c.quadraticCurveTo(cx, cy, x2, y2);
        c.stroke();
      }
    });
    perPixel((x, y) => wolk(x / 8, y / 8, zaad + 5, 4) * 0.32 * (0.4 + d));
  } else if (w.soort === 'vlekken') {
    const schaal = 6 + g * 50;
    const drempel = 0.66 - d * 0.22;
    perPixel((x, y) => {
      const n = wolk(x / schaal, y / schaal, zaad, 5);
      let v = zacht(drempel, drempel + 0.07, n) * (0.55 + 0.45 * ruis(x / 0.6, y / 0.6, zaad + 9));
      // spatjes en stippels
      const s = ruis(x / 0.35, y / 0.35, zaad + 11);
      if (s > 0.9 - d * 0.08) v = Math.max(v, zacht(0.9 - d * 0.08, 0.95, s));
      // een vage waas
      v = Math.max(v, zacht(0.45, 0.8, wolk(x / (schaal * 2.2), y / (schaal * 2.2), zaad + 21, 3)) * 0.25);
      return v;
    });
  } else if (w.soort === 'raster') {
    const steek = 0.6 + g * 3.4; // mm tussen de punten
    const hoek = Math.PI / 4;
    const cs = Math.cos(hoek);
    const sn = Math.sin(hoek);
    const diag = Math.hypot(totaal.b, totaal.h);
    const n = Math.ceil(diag / steek) + 2;
    tekenVormen((c) => {
      const mx = totaal.b / 2;
      const my = totaal.h / 2;
      for (let i = -n / 2; i <= n / 2; i++) {
        for (let j = -n / 2; j <= n / 2; j++) {
          const u = i * steek;
          const v = j * steek;
          const x = mx + u * cs - v * sn;
          const y = my + u * sn + v * cs;
          if (x < vak.x - steek || y < vak.y - steek || x > vak.x + vak.b + steek || y > vak.y + vak.h + steek) continue;
          const toon = begrens(wolk(x / 40, y / 40, zaad, 3) * 1.6 - 0.85 + d, 0, 1);
          if (toon < 0.02) continue;
          c.beginPath();
          c.arc(x, y, (steek / 2) * Math.sqrt(toon) * 1.1, 0, Math.PI * 2);
          c.fill();
        }
      }
    });
  } else if (w.soort === 'krassen') {
    const n = Math.round(opp * (0.0006 + d * 0.004));
    const richting = r() * Math.PI;
    tekenVormen((c) => {
      for (let i = 0; i < Math.min(n, 20000); i++) {
        const lang = r() < 0.15;
        const l = (lang ? 40 + r() * 120 : 3 + r() * 25) * (0.5 + g);
        const hoek = richting + (r() * 2 - 1) * (r() < 0.7 ? 0.25 : 1.6);
        const x = r() * totaal.b;
        const y = r() * totaal.h;
        const stappen = 6;
        const buig = (r() * 2 - 1) * 0.15;
        c.globalAlpha = 0.35 + r() * 0.65;
        c.lineWidth = 0.04 + Math.pow(r(), 3) * (0.2 + g * 0.4);
        c.beginPath();
        c.moveTo(x, y);
        let px = x;
        let py = y;
        let a = hoek;
        for (let s = 0; s < stappen; s++) {
          a += buig;
          px += (Math.cos(a) * l) / stappen;
          py += (Math.sin(a) * l) / stappen;
          c.lineTo(px, py);
        }
        c.stroke();
      }
    });
  }
  return dek;
}

/** Maakt RGBA van een dekkingskaart: één kleur, met de dekking als doorzichtigheid. */
function naarRgba(dek, kleur, dekking) {
  const [r, g, b] = hexNaarRgb(kleur);
  const px = new Uint8ClampedArray(dek.length * 4);
  for (let i = 0, j = 0; i < dek.length; i++, j += 4) {
    px[j] = r;
    px[j + 1] = g;
    px[j + 2] = b;
    px[j + 3] = dek[i] * dekking + 0.5;
  }
  return px;
}

// ---- het venster ------------------------------------------------------------

const STIJL = `
[hidden]{display:none!important}
body{padding:12px 14px;overflow:hidden}
.tx{display:grid;grid-template-columns:minmax(0,1fr) 250px;grid-template-rows:minmax(0,1fr) auto;gap:10px 14px;height:calc(100vh - 24px)}
.tx-beeld{position:relative;min-height:0;min-width:0;border-radius:6px;background:var(--bg-2);display:flex;align-items:center;justify-content:center;overflow:hidden}
.tx-beeld canvas{border-radius:1px;box-shadow:0 1px 8px #0007}
.tx-detail{position:absolute;right:10px;bottom:10px;padding:4px;border-radius:6px;background:var(--bg);box-shadow:0 2px 10px #0008;text-align:center}
.tx-detail canvas{width:150px;height:150px;box-shadow:none;border-radius:3px;display:block}
.tx-detail span{display:block;font-size:10.5px;color:var(--tekst-zacht);margin-top:3px}
.tx-rechts{min-height:0;overflow-y:auto;padding-right:4px;margin-right:-4px}
.fv-kop{font-size:10.5px;text-transform:uppercase;letter-spacing:.07em;color:var(--tekst-zwak,#7f838f);margin:14px 0 4px;font-weight:600}
.fv-kop:first-child{margin-top:0}
.fv-schuif{display:grid;grid-template-columns:78px minmax(0,1fr) 40px;align-items:center;gap:6px;height:25px}
.fv-schuif span:first-child{color:var(--tekst-zacht)}
.fv-schuif .fv-waarde{text-align:right;font-variant-numeric:tabular-nums;color:var(--tekst-zacht)}
input[type=range]{width:100%;margin:0;height:16px;background:transparent;-webkit-appearance:none;appearance:none;cursor:pointer}
input[type=range]::-webkit-slider-runnable-track{height:3px;border-radius:2px;background:var(--lijn-sterk,#464954)}
input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:12px;margin-top:-4.5px;border-radius:50%;background:var(--tekst);
  border:2px solid var(--bg);box-shadow:0 0 0 1px #0008}
input[type=range]:focus{outline:none}input[type=range]:focus::-webkit-slider-thumb{background:var(--accent)}
.fv-rij{display:flex;align-items:center;gap:8px;margin:5px 0}
.fv-rij .label{min-width:78px}
.fv-rij input[type=color]{width:34px;height:24px;padding:0;border:1px solid var(--lijn);border-radius:4px;background:var(--bg-2);cursor:pointer}
.tx-soorten{display:grid;grid-template-columns:1fr 1fr;gap:5px}
.tx-soorten button{height:28px;border:1px solid var(--lijn);border-radius:5px;background:var(--bg-2);color:var(--tekst-zacht);font:inherit;cursor:pointer}
.tx-soorten button:hover{color:var(--tekst);border-color:var(--lijn-sterk,#464954)}
.tx-soorten button.actief{border-color:var(--accent);color:var(--tekst)}
.fv-onder{grid-column:1/-1;display:flex;align-items:center;gap:8px}
.fv-onder .uitleg{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
`;

const MAXPX = 16000000;
const MAXZIJDE = 16384;
const naam = (s) => (SOORTEN.find(([k]) => k === s) || SOORTEN[0])[1];

async function venster() {
  document.head.append(maak('style', { tekst: STIJL }));
  const doc = await vexel.document();
  const selectie = await vexel.selectie();
  const bewaard = (await vexel.haal('instellingen')) || {};
  const w = { ...STANDAARD };
  for (const k of Object.keys(STANDAARD)) if (typeof bewaard[k] === typeof STANDAARD[k]) w[k] = bewaard[k];
  if (!SOORTEN.some(([k]) => k === w.soort)) w.soort = STANDAARD.soort;

  // het kader van de selectie (alles samen), in pt
  let selKader = null;
  for (const o of selectie) {
    const k = o.kader;
    if (!k || !(k.b > 0) || !(k.h > 0)) continue;
    if (!selKader) selKader = { x: k.x, y: k.y, r: k.x + k.b, o: k.y + k.h };
    else {
      selKader.x = Math.min(selKader.x, k.x);
      selKader.y = Math.min(selKader.y, k.y);
      selKader.r = Math.max(selKader.r, k.x + k.b);
      selKader.o = Math.max(selKader.o, k.y + k.h);
    }
  }
  if (!selKader && w.maat === 'selectie') w.maat = 'tekengebied';

  const plek = () => {
    if (w.maat === 'selectie' && selKader) return { x: selKader.x, y: selKader.y, b: selKader.r - selKader.x, h: selKader.o - selKader.y };
    if (w.maat === 'afloop') {
      const a = doc.afloop || { boven: 0, rechts: 0, onder: 0, links: 0 };
      return { x: -a.links, y: -a.boven, b: doc.tekengebied.b + a.links + a.rechts, h: doc.tekengebied.h + a.boven + a.onder };
    }
    return { x: 0, y: 0, b: doc.tekengebied.b, h: doc.tekengebied.h };
  };
  /** De pixelmaat bij de gekozen ppi, verlaagd als het te groot wordt. */
  const pixelmaat = () => {
    const p = plek();
    const bi = p.b / 72;
    const hi = p.h / 72;
    let ppi = w.ppi;
    const max = Math.min(Math.sqrt(MAXPX / (bi * hi)), MAXZIJDE / Math.max(bi, hi));
    const verlaagd = ppi > max;
    if (verlaagd) ppi = Math.floor(max);
    return { plek: p, ppi, verlaagd, pb: Math.max(1, Math.round(bi * ppi)), ph: Math.max(1, Math.round(hi * ppi)) };
  };

  // -- opbouw
  const doek = maak('canvas');
  const detail = maak('canvas', { width: 300, height: 300 });
  const detailTekst = maak('span');
  const detailVak = maak('div', { klasse: 'tx-detail', title: 'Een stukje op de resolutie van het resultaat' }, detail, detailTekst);
  const beeldVak = maak('div', { klasse: 'tx-beeld' }, doek, detailVak);
  const rechts = maak('div', { klasse: 'tx-rechts' });

  const soortKnoppen = maak('div', { klasse: 'tx-soorten' });
  for (const [k, t] of SOORTEN) {
    const knop = maak('button', { type: 'button', tekst: t, 'data-soort': k });
    knop.addEventListener('click', () => {
      w.soort = k;
      gewijzigd();
    });
    soortKnoppen.append(knop);
  }
  rechts.append(maak('div', { klasse: 'fv-kop', tekst: 'Soort' }), soortKnoppen, maak('div', { klasse: 'fv-kop', tekst: 'Uiterlijk' }));

  const kleur = maak('input', { type: 'color', 'aria-label': 'Kleur' });
  kleur.addEventListener('input', () => {
    w.kleur = kleur.value;
    gewijzigd();
  });
  kleur.title = 'Zwart of wit werkt vaak het best';
  rechts.append(maak('div', { klasse: 'fv-rij' }, maak('span', { klasse: 'label', tekst: 'Kleur' }), kleur));

  const schuiven = [];
  for (const [sleutel, label, min, max] of [['dekking', 'Dekking', 5, 100], ['grootte', 'Grootte', 0, 100], ['dichtheid', 'Dichtheid', 0, 100]]) {
    const invoer = maak('input', { type: 'range', min, max, step: 1, 'aria-label': label });
    const waarde = maak('span', { klasse: 'fv-waarde' });
    invoer.addEventListener('input', () => {
      w[sleutel] = Number(invoer.value);
      gewijzigd();
    });
    invoer.addEventListener('dblclick', () => {
      w[sleutel] = STANDAARD[sleutel];
      gewijzigd();
    });
    schuiven.push({ sleutel, invoer, waarde });
    rechts.append(maak('label', { klasse: 'fv-schuif', title: 'Dubbelklik om terug te zetten' }, maak('span', { tekst: label }), invoer, waarde));
  }

  const keuze = (label, sleutel, opties) => {
    const lijst = maak('select', { klasse: 'veld', 'aria-label': label });
    for (const [k, t, uit] of opties) {
      const o = maak('option', { value: k, tekst: t });
      if (uit) o.disabled = true;
      lijst.append(o);
    }
    lijst.addEventListener('change', () => {
      w[sleutel] = sleutel === 'ppi' ? Number(lijst.value) : lijst.value;
      gewijzigd();
    });
    rechts.append(maak('div', { klasse: 'fv-rij' }, maak('span', { klasse: 'label', tekst: label }), lijst));
    return lijst;
  };
  rechts.append(maak('div', { klasse: 'fv-kop', tekst: 'Maat' }));
  const maat = keuze('Vlak', 'maat', [
    ['tekengebied', 'Tekengebied'],
    ['afloop', 'Tekengebied met afloop'],
    ['selectie', selKader ? 'Kader van de selectie' : 'Kader van de selectie (niets geselecteerd)', !selKader],
  ]);
  const ppi = keuze('Resolutie', 'ppi', [['150', '150 ppi (scherm, snel)'], ['300', '300 ppi (drukwerk)']]);
  const achter = keuze('Voorbeeld op', 'achtergrond', [['licht', 'Licht papier'], ['donker', 'Donker vlak'], ['ruit', 'Ruitjes (doorzichtig)']]);

  const samenvatting = maak('div', { klasse: 'uitleg' });
  const variant = maak('button', { type: 'button', klasse: 'knop', tekst: 'Andere variant', title: 'Zelfde instellingen, ander toeval' });
  const standaard = maak('button', { type: 'button', klasse: 'knop', tekst: 'Standaard' });
  const annuleer = maak('button', { type: 'button', klasse: 'knop', tekst: 'Annuleren', bijClick: () => vexel.sluit() });
  const maken = maak('button', { type: 'submit', klasse: 'knop primair', tekst: 'Textuur maken' });
  const formulier = maak('form', { klasse: 'tx' }, beeldVak, rechts, maak('div', { klasse: 'fv-onder' }, variant, standaard, samenvatting, annuleer, maken));
  document.body.append(formulier);

  // -- voorvertoning
  const ruitjes = (c, b, h) => {
    const g = c.getContext('2d');
    g.fillStyle = '#f4f4f4';
    g.fillRect(0, 0, b, h);
    g.fillStyle = '#dcdcdc';
    const s = Math.max(6, Math.round(b / 48));
    for (let y = 0; y < h; y += s) for (let x = (y / s) % 2 ? s : 0; x < b; x += 2 * s) g.fillRect(x, y, s, s);
  };
  const achtergrond = (c) => {
    const g = c.getContext('2d');
    if (w.achtergrond === 'ruit') ruitjes(c, c.width, c.height);
    else {
      g.fillStyle = w.achtergrond === 'donker' ? '#2b3a4f' : '#f6f1e7';
      g.fillRect(0, 0, c.width, c.height);
    }
  };
  const legOp = (c, dek, b, h) => {
    const tmp = new OffscreenCanvas(b, h);
    tmp.getContext('2d').putImageData(new ImageData(naarRgba(dek, w.kleur, w.dekking / 100), b, h), 0, 0);
    c.getContext('2d').drawImage(tmp, 0, 0, c.width, c.height);
  };

  let vraag = 0;
  function teken() {
    vraag = 0;
    const m = pixelmaat();
    const mm = { b: vexel.naarMm(m.plek.b), h: vexel.naarMm(m.plek.h) };
    // het hele vlak, passend in het venster
    const r = beeldVak.getBoundingClientRect();
    const f = Math.min((r.width - 24) / mm.b, (r.height - 24) / mm.h);
    const db = Math.max(1, Math.floor(mm.b * f));
    const dh = Math.max(1, Math.floor(mm.h * f));
    const schaal = Math.min(2, devicePixelRatio || 1);
    doek.width = Math.round(db * schaal);
    doek.height = Math.round(dh * schaal);
    doek.style.width = db + 'px';
    doek.style.height = dh + 'px';
    achtergrond(doek);
    legOp(doek, textuur(w, mm, { x: 0, y: 0, ...mm }, doek.width / mm.b, doek.width, doek.height), doek.width, doek.height);
    // detail: een stukje uit het midden op de echte resolutie
    const k = m.ppi / 25.4;
    const zijde = Math.min(detail.width / k, mm.b, mm.h);
    const vak = { x: (mm.b - zijde) / 2, y: (mm.h - zijde) / 2, b: zijde, h: zijde };
    const n = Math.max(1, Math.round(zijde * k));
    // bij een klein vlak is het geheel al scherp genoeg; dan zit het detail alleen in de weg
    detailVak.hidden = Math.min(mm.b, mm.h) < zijde * 2.5;
    achtergrond(detail);
    legOp(detail, textuur(w, mm, vak, k, n, n), n, n);
    detailTekst.textContent = `Detail ${getal(zijde, 0)} × ${getal(zijde, 0)} mm`;

    const delen = [`${naam(w.soort)} · ${getal(mm.b, 0)} × ${getal(mm.h, 0)} mm`, `${getal(m.pb)} × ${getal(m.ph)} px bij ${m.ppi} ppi`];
    if (m.verlaagd) delen.push('resolutie verlaagd (hooguit 16 miljoen pixels)');
    if (doc.alleenLezen) delen.push('dit document is alleen-lezen');
    samenvatting.textContent = delen.join(' · ');
    samenvatting.title = samenvatting.textContent;
  }
  const plan = () => {
    if (!vraag) vraag = requestAnimationFrame(teken);
  };

  let bewaarKlok = 0;
  function gewijzigd() {
    for (const knop of soortKnoppen.children) knop.classList.toggle('actief', knop.dataset.soort === w.soort);
    kleur.value = geldigHex(w.kleur) ? w.kleur : STANDAARD.kleur;
    for (const { sleutel, invoer, waarde } of schuiven) {
      invoer.value = String(w[sleutel]);
      waarde.textContent = getal(w[sleutel]) + (sleutel === 'dekking' ? '%' : '');
    }
    maat.value = w.maat;
    ppi.value = String(w.ppi);
    achter.value = w.achtergrond;
    maken.disabled = doc.alleenLezen;
    plan();
    clearTimeout(bewaarKlok);
    bewaarKlok = setTimeout(() => vexel.bewaar('instellingen', w), 400);
  }
  variant.addEventListener('click', () => {
    w.zaad = nieuwZaad();
    gewijzigd();
  });
  standaard.addEventListener('click', () => {
    Object.assign(w, STANDAARD, { zaad: w.zaad, soort: w.soort, maat: w.maat, ppi: w.ppi, achtergrond: w.achtergrond });
    gewijzigd();
  });
  addEventListener('resize', plan);

  formulier.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (doc.alleenLezen) {
      vexel.melding('Dit document is alleen-lezen; er kan geen textuur bij.', 'let');
      return;
    }
    clearTimeout(bewaarKlok);
    vexel.bewaar('instellingen', w);
    for (const el of formulier.querySelectorAll('input, select, button')) el.disabled = true;
    maken.textContent = 'Bezig…';
    samenvatting.textContent = 'De textuur wordt gemaakt…';
    await verf();
    try {
      const m = pixelmaat();
      const mm = { b: vexel.naarMm(m.plek.b), h: vexel.naarMm(m.plek.h) };
      const dek = textuur(w, mm, { x: 0, y: 0, ...mm }, m.pb / mm.b, m.pb, m.ph);
      const pixels = naarRgba(dek, w.kleur, w.dekking / 100);
      await vexel.maak([{
        soort: 'beeld', x: m.plek.x, y: m.plek.y, b: m.plek.b, h: m.plek.h,
        naam: 'Textuur: ' + naam(w.soort).toLowerCase(),
        pixels: { breedte: m.pb, hoogte: m.ph, pixels },
      }]);
      vexel.melding(`Textuur gemaakt: ${naam(w.soort).toLowerCase()}, ${getal(m.pb)} × ${getal(m.ph)} px.`, 'ok');
      vexel.sluit();
    } catch (fout) {
      vexel.melding(fout.message, 'fout');
      for (const el of formulier.querySelectorAll('input, select, button')) el.disabled = false;
      maken.textContent = 'Textuur maken';
      gewijzigd();
    }
  });

  gewijzigd();
  maken.focus();
}

vexel.opCommando('maken', venster);
