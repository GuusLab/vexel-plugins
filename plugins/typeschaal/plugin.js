// Typeschaal: een specimenblad met een modulaire letterschaal (H1–H6, Body, Klein).
// Eigen werk, MIT-licentie (zie de README van deze repo).
'use strict';

// ---- hulpjes voor het venster ----------------------------------------------

function maak(tag, opties = {}, ...kinderen) {
  const el = document.createElement(tag);
  for (const [sleutel, waarde] of Object.entries(opties)) {
    if (waarde === undefined || waarde === null || waarde === false) continue;
    if (sleutel === 'klasse') el.className = waarde;
    else if (sleutel === 'tekst') el.textContent = waarde;
    else if (sleutel === 'stijl') Object.assign(el.style, waarde);
    else if (sleutel.startsWith('bij')) el.addEventListener(sleutel.slice(3).toLowerCase(), waarde);
    else el.setAttribute(sleutel, waarde === true ? '' : String(waarde));
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

function vinkje(tekst, aan) {
  const invoer = maak('input', { type: 'checkbox' });
  invoer.checked = Boolean(aan);
  const blok = maak('label', { stijl: { display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', minWidth: '0' } },
    invoer, maak('span', { tekst }));
  return { blok, invoer };
}

/** Label boven een veld, met optioneel een eenheid erachter. */
function metLabel(labelTekst, veld, eenheid) {
  veld.style.flex = '1';
  veld.style.minWidth = '0';
  const regel = maak('div', { stijl: { display: 'flex', alignItems: 'center', gap: '6px' } }, veld);
  if (eenheid) regel.append(maak('span', { klasse: 'uitleg', tekst: eenheid }));
  return maak('label', { stijl: { display: 'grid', gap: '4px', minWidth: '0' } },
    maak('span', { klasse: 'label', tekst: labelTekst, stijl: { minWidth: '0' } }), regel);
}

/** Een raster van n gelijke kolommen. */
const kolommen = (n, ...kinderen) =>
  maak('div', { stijl: { display: 'grid', gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, gap: '10px', alignItems: 'end' } }, ...kinderen);

const leesGetal = (veld, terugval) => {
  const n = Number(String(veld.value).trim().replace(',', '.'));
  return String(veld.value).trim() !== '' && Number.isFinite(n) ? n : terugval;
};
const begrens = (n, min, max) => Math.min(max, Math.max(min, n));
const css = (naam, terugval) => getComputedStyle(document.documentElement).getPropertyValue(naam).trim() || terugval;
const nl = (n, cijfers = 1) => n.toLocaleString('nl-NL', { maximumFractionDigits: cijfers });
const naarMm = (pt) => pt / vexel.mm(1);

/** Canvas op de juiste pixeldichtheid; geeft { g, b, h } terug. */
function bereidDoek(doek) {
  const schaal = devicePixelRatio || 1;
  const kader = doek.getBoundingClientRect();
  doek.width = Math.max(1, Math.round(kader.width * schaal));
  doek.height = Math.max(1, Math.round(kader.height * schaal));
  const g = doek.getContext('2d');
  g.setTransform(schaal, 0, 0, schaal, 0, 0);
  g.clearRect(0, 0, kader.width, kader.height);
  return { g, b: kader.width, h: kader.height };
}

// ---- kleuren ----------------------------------------------------------------

/** Een kleur als { cmyk, hex }: in een CMYK-document CMYK, anders hex. */
const kleur = (cmyk, hex, isCmyk) => (isCmyk ? { cmyk } : { hex });

/** CMYK naar een hex-benadering, voor de voorvertoning. */
function cmykNaarHex([c, m, y, k]) {
  const f = (a) => Math.round(255 * (1 - a / 100) * (1 - k / 100)).toString(16).padStart(2, '0');
  return `#${f(c)}${f(m)}${f(y)}`;
}

// ---- tekst meten en afbreken (Inter, geschat) ---------------------------------

const SMAL = new Set([..."iIl.,:;'!|j()[]{}ft"]);
const HALF = new Set([...'rsJ1-"/']);
const BREED = new Set([...'mwMW@%']);
const RUIM = new Set([...'ABCDEGHKNOQRUVXY&#0234567890']);

/** Geschatte breedte van een tekst in em (Inter, normaal gewicht). */
function emBreedte(tekst) {
  let som = 0;
  for (const t of tekst) {
    if (t === ' ') som += 0.28;
    else if (SMAL.has(t)) som += 0.28;
    else if (HALF.has(t)) som += 0.4;
    else if (BREED.has(t)) som += 0.86;
    else if (RUIM.has(t)) som += 0.66;
    else if (t >= 'A' && t <= 'Z') som += 0.62;
    else som += 0.55;
  }
  return som;
}

/** Breedte in pt bij een lettergrootte en gewicht (vet is iets breder). */
const tekstBreedte = (tekst, grootte, gewicht = 400) => emBreedte(tekst) * grootte * (1 + Math.max(0, gewicht - 400) / 300 * 0.06);

/** Breek een tekst af in regels die binnen `breedte` pt passen. */
function breekAf(tekst, breedte, grootte, gewicht = 400) {
  const regels = [];
  for (const alinea of String(tekst).split('\n')) {
    let regel = '';
    for (const woord of alinea.split(/\s+/).filter(Boolean)) {
      const proef = regel ? `${regel} ${woord}` : woord;
      if (!regel || tekstBreedte(proef, grootte, gewicht) <= breedte) regel = proef;
      else { regels.push(regel); regel = woord; }
    }
    regels.push(regel);
  }
  return regels;
}

/** Knoppenrij met Annuleren en de hoofdknop. */
function knoppenRij(hoofdTekst) {
  const hoofd = maak('button', { klasse: 'knop primair', type: 'submit', tekst: hoofdTekst });
  const annuleer = maak('button', { klasse: 'knop', type: 'button', tekst: 'Annuleren', bijClick: () => vexel.sluit() });
  const rij = maak('div', { klasse: 'knoppen', stijl: { marginTop: '0' } }, annuleer, hoofd);
  return { rij, hoofd };
}

// ---- de schaal ----------------------------------------------------------------

const VERHOUDINGEN = [
  ['1.125', '1,125 · grote seconde'],
  ['1.2', '1,2 · kleine terts'],
  ['1.25', '1,25 · grote terts'],
  ['1.333', '1,333 · kwart'],
  ['1.5', '1,5 · kwint'],
  ['1.618', '1,618 · gulden snede'],
  ['eigen', 'Eigen verhouding…'],
];

const STANDAARD = {
  basis: 10,
  verhouding: '1.25',
  eigen: 1.3,
  afronden: '0.5',
  marge: 15,
  kop: 'Een goede kop zegt meer',
  lopend: 'Goede typografie valt pas op als ze ontbreekt: rustige regels, genoeg wit en een duidelijke rangorde maken elke tekst prettig om te lezen.',
  advies: true,
  klein: true,
};

// Regelafstand als factor van de lettergrootte: lopende tekst ruim, grote koppen strakker.
const FACTOR = { Klein: 1.5, Body: 1.5, H6: 1.4, H5: 1.35, H4: 1.3, H3: 1.25, H2: 1.2, H1: 1.15 };

const rond = (n, stap) => Math.max(stap, Math.round(n / stap) * stap);

/** De stappen van klein naar groot: [{ naam, grootte, regelafstand, kop }]. */
function stappen(w) {
  const lijst = [];
  const r = w.r;
  if (w.klein) lijst.push({ naam: 'Klein', exp: -1 });
  lijst.push({ naam: 'Body', exp: 0 });
  for (let i = 1; i <= 6; i++) lijst.push({ naam: `H${7 - i}`, exp: i });
  return lijst.map((s) => {
    const grootte = rond(w.basis * r ** s.exp, w.afronden);
    const factor = grootte > 48 ? Math.min(FACTOR[s.naam], 1.1) : FACTOR[s.naam];
    return { ...s, grootte, regelafstand: rond(grootte * factor, 0.5), kop: s.exp > 0 };
  });
}

const ptTekst = (n) => `${nl(n, 2)} pt`;

/**
 * Zet het blad op. Geeft een lijst tekens terug ({ soort: 'tekst' | 'lijn', … }),
 * per stap gegroepeerd, en de schaalfactor die nodig was om te passen.
 */
function opzet(w, gebied) {
  const marge = vexel.mm(w.marge);
  const labelB = Math.min(vexel.mm(34), (gebied.b - 2 * marge) * 0.3);
  const xTekst = marge + labelB;
  const tekstB = gebied.b - marge - xTekst;
  if (tekstB < 30 || gebied.h - 2 * marge < 80) return { fout: 'Het tekengebied is te klein voor deze marge: kies een kleinere marge.' };

  const lijst = stappen(w).reverse();
  if (lijst[0].grootte > 1000) {
    return { fout: `H1 wordt ${ptTekst(lijst[0].grootte)}, groter dan 1.000 pt: kies een kleinere basisgrootte of verhouding.` };
  }
  const kopHoogte = 44;
  const beschikbaar = gebied.h - 2 * marge - kopHoogte;

  const bouwRijen = (f) => {
    let y = marge + kopHoogte;
    const rijen = [];
    for (const s of lijst) {
      const g = s.grootte * f;
      const la = (w.advies ? s.regelafstand : s.grootte * 1.2) * f;
      const gewicht = s.kop ? 700 : 400;
      const bron = s.kop ? w.kop : w.lopend;
      // De schatting van de tekenbreedte is grof: houd wat ruimte over.
      let regels = breekAf(bron, tekstB * 0.95, g, gewicht);
      const max = s.kop ? 1 : (w.advies ? 3 : 1);
      if (regels.length > max) {
        regels = regels.slice(0, max);
        // Een kop laat gewoon woorden weg; lopende tekst krijgt een beletselteken.
        if (!s.kop) regels[max - 1] = `${regels[max - 1].replace(/[\s,.:;]+$/, '')}…`;
      }
      // Past zelfs het eerste woord niet, knip dan letters weg.
      while (regels[0].length > 1 && tekstBreedte(regels[0], g, gewicht) > tekstB * 0.95) {
        regels[0] = s.kop ? regels[0].slice(0, -1) : `${regels[0].replace(/…$/, '').slice(0, -1)}…`;
      }
      const pad = 6 + g * 0.05;
      const basis = pad + Math.max(g * 0.76, 8);
      const onder = Math.max(basis + (regels.length - 1) * la + g * 0.22, basis + (w.advies ? 20 : 10) + 3);
      const hoogte = onder + pad;
      rijen.push({ s, y, hoogte, basislijn: y + basis, regels, g, la, gewicht });
      y += hoogte;
    }
    return { rijen, hoogte: y - marge - kopHoogte };
  };

  let f = 1;
  let uit = bouwRijen(f);
  for (let i = 0; i < 80 && uit.hoogte > beschikbaar; i++) {
    f *= Math.max(0.9, Math.min(0.995, beschikbaar / uit.hoogte));
    uit = bouwRijen(f);
  }
  if (uit.hoogte > beschikbaar || f < 0.2) return { fout: 'Dit past niet op het tekengebied: kies een kleinere basisgrootte of verhouding.' };

  const naamVerhouding = w.verhouding === 'eigen' ? `${nl(w.r, 3)} (eigen)` : VERHOUDINGEN.find(([v]) => v === w.verhouding)[1];
  const titel = [
    { soort: 'tekst', x: marge, y: marge + 14, inhoud: 'Typografische schaal', grootte: 16, gewicht: 700, kleur: 'tekst' },
    { soort: 'tekst', x: marge, y: marge + 29, grootte: 8, kleur: 'zacht',
      inhoud: `Basis ${ptTekst(w.basis)} · verhouding ${naamVerhouding}${f < 0.999 ? ` · getoond op ${Math.round(f * 100)}%` : ''}` },
    { soort: 'lijn', x1: marge, x2: gebied.b - marge, y: marge + kopHoogte - 4, dik: 0.75, kleur: 'tekst' },
  ];
  const groepen = uit.rijen.map((r, i) => {
    const info = w.advies ? [ptTekst(r.s.grootte), `regelafstand ${ptTekst(r.s.regelafstand)}`] : [ptTekst(r.s.grootte)];
    const tekens = [
      { soort: 'tekst', x: marge, y: r.basislijn, inhoud: r.s.naam, grootte: 8, gewicht: 700, kleur: 'accent' },
      { soort: 'tekst', x: marge, y: r.basislijn + 10, inhoud: info.join('\n'), grootte: 7, regelafstand: 9, kleur: 'zacht' },
      { soort: 'tekst', x: xTekst, y: r.basislijn, inhoud: r.regels.join('\n'), grootte: r.g, gewicht: r.gewicht,
        regelafstand: r.regels.length > 1 ? r.la : undefined, kleur: 'tekst' },
    ];
    if (i < uit.rijen.length - 1) tekens.push({ soort: 'lijn', x1: marge, x2: gebied.b - marge, y: r.y + r.hoogte, dik: 0.25, kleur: 'fijn' });
    return { naam: `${r.s.naam} · ${ptTekst(r.s.grootte)}`, tekens };
  });
  return { titel, groepen, f, stappen: uit.rijen.map((r) => r.s) };
}

// ---- naar vormen -----------------------------------------------------------------

const KLEUREN = {
  tekst: { cmyk: [0, 0, 0, 100], hex: '#1a1a1a' },
  zacht: { cmyk: [0, 0, 0, 55], hex: '#767676' },
  fijn: { cmyk: [0, 0, 0, 18], hex: '#d6d6d6' },
  accent: { cmyk: [85, 45, 0, 0], hex: '#2a6fc9' },
};

function alsVorm(t, isCmyk) {
  const k = KLEUREN[t.kleur];
  const kl = kleur(k.cmyk, k.hex, isCmyk);
  if (t.soort === 'lijn') {
    return { soort: 'pad', naam: 'Lijn', subpaden: [{ gesloten: false, punten: [{ x: t.x1, y: t.y }, { x: t.x2, y: t.y }] }],
      vulling: null, lijn: kl, lijndikte: t.dik };
  }
  const v = { soort: 'tekst', x: t.x, y: t.y, inhoud: t.inhoud, grootte: Math.round(t.grootte * 100) / 100, vulling: kl, lijn: null };
  if (t.gewicht) v.gewicht = t.gewicht;
  if (t.regelafstand) v.regelafstand = Math.round(t.regelafstand * 100) / 100;
  v.naam = t.inhoud.split('\n')[0].slice(0, 60);
  return v;
}

// ---- het venster ---------------------------------------------------------------------

async function toonVenster() {
  const doc = await vexel.document();
  const isCmyk = doc.kleurruimte === 'cmyk';
  const w0 = { ...STANDAARD, ...((await vexel.haal('instellingen')) || {}) };

  const basis = getalVeld(w0.basis, 4, 72, 0.5);
  const verhouding = keuzeVeld(VERHOUDINGEN, w0.verhouding);
  const eigen = getalVeld(w0.eigen, 1.01, 2, 0.001);
  const eigenBlok = metLabel('Eigen verhouding', eigen);
  const afronden = keuzeVeld([['0.1', 'Op 0,1 pt'], ['0.5', 'Op 0,5 pt'], ['1', 'Op hele pt']], w0.afronden);
  const marge = getalVeld(w0.marge, 0, 100, 1);
  const kop = maak('input', { klasse: 'veld', type: 'text', value: w0.kop, maxlength: 120 });
  const lopend = maak('textarea', { klasse: 'veld', rows: 3, maxlength: 600,
    stijl: { height: 'auto', padding: '5px 8px', resize: 'none', lineHeight: '1.4' } });
  lopend.value = w0.lopend;
  const advies = vinkje('Regelafstand-advies', w0.advies);
  const klein = vinkje('Met stap Klein', w0.klein);

  const doek = maak('canvas', { 'aria-hidden': 'true', stijl: { width: '100%', height: '180px', display: 'block' } });
  const samenvatting = maak('p', { klasse: 'uitleg', 'aria-live': 'polite', stijl: { margin: '0', minHeight: '32px' } });
  const { rij: knoppen, hoofd } = knoppenRij('Specimen maken');

  const formulier = maak('form', { stijl: { display: 'grid', gap: '10px', padding: '0' } },
    kolommen(2, metLabel('Basisgrootte (Body)', basis, 'pt'), metLabel('Verhouding', verhouding)),
    eigenBlok,
    kolommen(2, metLabel('Afronden', afronden), metLabel('Marge', marge, 'mm')),
    metLabel('Voorbeeld voor koppen', kop),
    metLabel('Voorbeeld voor lopende tekst', lopend),
    maak('div', { stijl: { display: 'flex', gap: '18px', flexWrap: 'wrap' } }, advies.blok, klein.blok),
    doek,
    samenvatting,
    knoppen,
  );
  document.body.append(formulier);

  const waarden = () => {
    const keuze = verhouding.value;
    const r = keuze === 'eigen' ? begrens(leesGetal(eigen, 1.3), 1.01, 2) : Number(keuze);
    return {
      basis: begrens(leesGetal(basis, 10), 4, 72),
      verhouding: keuze,
      eigen: begrens(leesGetal(eigen, 1.3), 1.01, 2),
      r,
      afronden: Number(afronden.value),
      marge: begrens(leesGetal(marge, 15), 0, 100),
      kop: kop.value.trim() || STANDAARD.kop,
      lopend: lopend.value.replace(/\s+/g, ' ').trim() || STANDAARD.lopend,
      advies: advies.invoer.checked,
      klein: klein.invoer.checked,
    };
  };

  function teken() {
    const w = waarden();
    eigenBlok.style.display = w.verhouding === 'eigen' ? '' : 'none';
    const uit = opzet(w, doc.tekengebied);
    hoofd.disabled = Boolean(uit.fout) || doc.alleenLezen;

    if (doc.alleenLezen) samenvatting.textContent = 'Dit document is alleen-lezen: open een document dat je mag wijzigen.';
    else if (uit.fout) samenvatting.textContent = uit.fout;
    else {
      const s = uit.stappen;
      const groot = s[0];
      const kleinste = s[s.length - 1];
      let t = `${s.length} stappen van ${ptTekst(kleinste.grootte)} (${kleinste.naam}) tot ${ptTekst(groot.grootte)} (H1).`;
      if (uit.f < 0.999) t += ` Past niet op ware grootte: het voorbeeld wordt op ${Math.round(uit.f * 100)}% gezet (de pt-waarden kloppen wel).`;
      samenvatting.textContent = t;
    }

    const { g, b, h } = bereidDoek(doek);
    g.fillStyle = vexel.thema.bg2;
    g.fillRect(0, 0, b, h);
    const gb = doc.tekengebied;
    const s = Math.min((b - 16) / gb.b, (h - 16) / gb.h);
    const ox = (b - gb.b * s) / 2;
    const oy = (h - gb.h * s) / 2;
    g.fillStyle = '#ffffff';
    g.fillRect(ox, oy, gb.b * s, gb.h * s);
    if (uit.fout) return;
    g.save();
    g.beginPath();
    g.rect(ox, oy, gb.b * s, gb.h * s);
    g.clip();
    g.translate(ox, oy);
    g.scale(s, s);
    for (const t of [...uit.titel, ...uit.groepen.flatMap((gr) => gr.tekens)]) {
      const k = KLEUREN[t.kleur].hex;
      if (t.soort === 'lijn') {
        g.strokeStyle = k;
        g.lineWidth = Math.max(t.dik, 0.6 / s);
        g.beginPath();
        g.moveTo(t.x1, t.y);
        g.lineTo(t.x2, t.y);
        g.stroke();
      } else {
        g.fillStyle = k;
        g.font = `${t.gewicht || 400} ${t.grootte}px Inter, system-ui, sans-serif`;
        t.inhoud.split('\n').forEach((regel, i) => g.fillText(regel, t.x, t.y + i * (t.regelafstand || t.grootte * 1.2)));
      }
    }
    g.restore();
  }

  formulier.addEventListener('input', teken);
  formulier.addEventListener('change', teken);
  formulier.addEventListener('submit', async (gebeurtenis) => {
    gebeurtenis.preventDefault();
    if (doc.alleenLezen) return vexel.melding('Dit document is alleen-lezen.', 'let');
    const w = waarden();
    const uit = opzet(w, doc.tekengebied);
    if (uit.fout) return vexel.melding(uit.fout, 'let');

    try { await vexel.bewaar('instellingen', { ...w, r: undefined }); } catch (fout) { /* instellingen onthouden is bijzaak */ }

    const kinderen = [
      { soort: 'groep', naam: 'Titel', kinderen: uit.titel.map((t) => alsVorm(t, isCmyk)) },
      ...uit.groepen.map((gr) => ({ soort: 'groep', naam: gr.naam, kinderen: gr.tekens.map((t) => alsVorm(t, isCmyk)) })),
    ];
    hoofd.disabled = true;
    try {
      await vexel.maak([{ soort: 'groep', naam: `Typeschaal ${nl(w.r, 3)} vanaf ${ptTekst(w.basis)}`, kinderen }]);
    } catch (fout) {
      hoofd.disabled = false;
      return vexel.melding(fout && fout.message ? fout.message : 'Het specimenblad kon niet worden gemaakt.', 'fout');
    }
    const extra = uit.f < 0.999 ? ` Op ${Math.round(uit.f * 100)}% gezet om te passen.` : '';
    vexel.melding(`Typeschaal gemaakt: ${uit.stappen.length} stappen.${extra}`, uit.f < 0.999 ? 'let' : 'ok');
    vexel.sluit();
  });

  teken();
  basis.focus();
  basis.select();
}

vexel.opCommando('maken', toonVenster);
