// Woordzoeker: een letterrooster met verstopte woorden, de woordenlijst eronder en
// desgewenst een oplossing. Netjes gezet: elke letter in het midden van een gelijk vakje.
// Eigen werk, MIT-licentie (zie de README van deze repo).
'use strict';

const STANDAARD = {
  raster: 'auto', kolommen: 15, rijen: 15, celmaat: 8,
  horizontaal: true, verticaal: true, diagonaal: true, achterstevoren: false,
  hoofdletters: true, ij: true, vulling: 'gewoon',
  lijnen: 'kader', lijst: true, oplossing: 'groep', zaad: 1,
};

const VOORBEELD = 'bloesem\ntulp\nnarcis\nvlinder\nlammetje\nkikker\nregenboog\nmadelief\nzonnetje\nvogelnest\nkievit\nbij';

const MAX_RASTER = 30;
const MAX_WOORDEN = 80;

// Hoe vaak een letter in Nederlandse tekst voorkomt (ongeveer, in promille).
const FREQUENTIE = {
  E: 189, N: 100, A: 75, T: 68, I: 65, R: 64, O: 61, D: 59, S: 37, L: 36, G: 34, V: 29, H: 24, K: 23,
  M: 22, U: 20, B: 16, P: 16, W: 15, J: 10, Z: 14, C: 12, F: 8, X: 1, Y: 1, Q: 1,
};
const OPLOSKLEUR = { cmyk: [0, 90, 85, 0], hex: '#e2402f' };

// ---- willekeur met zaadje -----------------------------------------------------

function willekeur(zaad) {
  let s = (Math.imul((zaad | 0) ^ 0x2545f491, 0x9e3779b1) >>> 0) || 1;
  const volgende = () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
  for (let i = 0; i < 8; i++) volgende();
  return volgende;
}

const begrens = (n, min, max) => Math.min(max, Math.max(min, n));

// ---- woorden ------------------------------------------------------------------

/** Maakt van een woord een lijst vakjes: hoofdletters A–Z, en IJ samen als dat aan staat. */
function vakjesVan(woord, ij) {
  const letters = [];
  for (const teken of woord.normalize('NFKD').toUpperCase()) {
    const code = teken.charCodeAt(0);
    if (code >= 65 && code <= 90) letters.push(teken);
  }
  if (!ij) return letters;
  const vakjes = [];
  for (let i = 0; i < letters.length; i++) {
    if (letters[i] === 'I' && letters[i + 1] === 'J') {
      vakjes.push('IJ');
      i++;
    } else vakjes.push(letters[i]);
  }
  return vakjes;
}

/** Leest de woordenlijst: één per regel, of gescheiden door komma's of puntkomma's. */
function leesWoorden(tekst, ij) {
  const woorden = [];
  const gezien = new Set();
  const teKort = [];
  for (const regel of tekst.split('\n')) {
    for (const deel of regel.split(/[,;]/)) {
      const toon = deel.trim().replace(/ +/g, ' ');
      if (!toon) continue;
      const vakjes = vakjesVan(toon, ij);
      const sleutel = vakjes.join('');
      if (gezien.has(sleutel)) continue;
      if (vakjes.length < 2) {
        teKort.push(toon);
        continue;
      }
      gezien.add(sleutel);
      woorden.push({ toon, vakjes });
    }
  }
  return { woorden, teKort };
}

// ---- puzzel -------------------------------------------------------------------

function richtingenVan(w) {
  const r = [];
  if (w.horizontaal) r.push([0, 1]);
  if (w.verticaal) r.push([1, 0]);
  if (w.diagonaal) r.push([1, 1], [-1, 1]);
  if (w.achterstevoren) r.push(...r.map(([a, b]) => [-a, -b]));
  return r;
}
const ALLE_RICHTINGEN = [[0, 1], [1, 0], [1, 1], [-1, 1], [0, -1], [-1, 0], [-1, -1], [1, -1]];

/** Probeert alle woorden in een rooster van C × R te leggen. */
function legWoorden(woorden, C, R, richtingen, rnd) {
  const rooster = new Array(C * R).fill(null);
  const geplaatst = [];
  const mislukt = [];
  let werk = 0;
  const volgorde = woorden.slice().sort((a, b) => b.vakjes.length - a.vakjes.length || (rnd() - 0.5));
  for (const woord of volgorde) {
    const L = woord.vakjes.length;
    const kandidaten = [];
    let besteOverlap = 0;
    for (const [dr, dc] of richtingen) {
      for (let r0 = 0; r0 < R; r0++) {
        const r1 = r0 + dr * (L - 1);
        if (r1 < 0 || r1 >= R) continue;
        for (let c0 = 0; c0 < C; c0++) {
          const c1 = c0 + dc * (L - 1);
          if (c1 < 0 || c1 >= C) continue;
          werk++;
          let overlap = 0;
          let past = true;
          for (let k = 0; k < L; k++) {
            const v = rooster[(r0 + dr * k) * C + c0 + dc * k];
            if (v === null) continue;
            if (v !== woord.vakjes[k]) { past = false; break; }
            overlap++;
          }
          // een woord helemaal over een ander woord heen telt niet
          if (!past || overlap === L) continue;
          kandidaten.push([r0, c0, dr, dc, overlap]);
          besteOverlap = Math.max(besteOverlap, overlap);
        }
      }
    }
    if (!kandidaten.length) {
      mislukt.push(woord);
      continue;
    }
    // soms bewust een kruising zoeken: dat maakt de puzzel compacter en leuker
    const metOverlap = kandidaten.filter((k) => k[4] > 0);
    const keus = metOverlap.length && rnd() < 0.55 ? metOverlap : kandidaten;
    const [r0, c0, dr, dc] = keus[Math.floor(rnd() * keus.length)];
    for (let k = 0; k < L; k++) rooster[(r0 + dr * k) * C + c0 + dc * k] = woord.vakjes[k];
    geplaatst.push({ woord, r0, c0, dr, dc });
  }
  return { rooster, geplaatst, mislukt, werk };
}

function maakVuller(w, woorden, rnd) {
  const zak = [];
  if (w.vulling === 'woordletters') {
    for (const woord of woorden) for (const v of woord.vakjes) zak.push(v);
  }
  if (!zak.length) {
    for (const [letter, n] of Object.entries(FREQUENTIE)) {
      if (w.ij && letter === 'Y') continue;
      for (let i = 0; i < n; i++) zak.push(letter);
    }
    if (w.ij) for (let i = 0; i < 9; i++) zak.push('IJ');
  }
  return () => zak[Math.floor(rnd() * zak.length)];
}

/** Hoe vaak een woord in het rooster staat (in alle acht richtingen). */
function telVoorkomens(rooster, C, R, vakjes) {
  const L = vakjes.length;
  const plekken = new Set();
  for (const [dr, dc] of ALLE_RICHTINGEN) {
    for (let r0 = 0; r0 < R; r0++) {
      for (let c0 = 0; c0 < C; c0++) {
        const r1 = r0 + dr * (L - 1);
        const c1 = c0 + dc * (L - 1);
        if (r1 < 0 || r1 >= R || c1 < 0 || c1 >= C) continue;
        let k = 0;
        while (k < L && rooster[(r0 + dr * k) * C + c0 + dc * k] === vakjes[k]) k++;
        if (k === L) {
          // een woord dat achterstevoren hetzelfde is, telt op dezelfde plek maar één keer
          const a = r0 * C + c0;
          const b = r1 * C + c1;
          plekken.add(Math.min(a, b) + ':' + Math.max(a, b));
        }
      }
    }
  }
  return plekken.size;
}

/** De hele puzzel: maat bepalen, woorden leggen, de rest vullen. */
function maakPuzzel(w, woorden) {
  const richtingen = richtingenVan(w);
  if (!woorden.length) return { fout: 'Typ minstens één woord van twee letters of meer.' };
  if (woorden.length > MAX_WOORDEN) return { fout: `Dat zijn ${woorden.length} woorden; hooguit ${MAX_WOORDEN}.` };
  if (!richtingen.length) return { fout: 'Zet minstens één richting aan.' };
  const langste = Math.max(...woorden.map((x) => x.vakjes.length));
  const letters = woorden.reduce((n, x) => n + x.vakjes.length, 0);
  let C;
  let R;
  if (w.raster === 'auto') {
    C = begrens(Math.max(langste, Math.ceil(Math.sqrt(letters * 1.9)), 6), 2, MAX_RASTER);
    R = C;
  } else {
    C = w.kolommen;
    R = w.rijen;
  }
  const maxL = Math.max(w.horizontaal || w.diagonaal ? C : 0, w.verticaal || w.diagonaal ? R : 0);
  if (langste > maxL && w.raster !== 'auto') {
    const lang = woorden.find((x) => x.vakjes.length === langste);
    return { fout: `“${lang.toon}” is te lang voor een rooster van ${C} × ${R}. Maak het rooster groter.` };
  }

  // Een vaste hoeveelheid werk (geen klok), zodat hetzelfde zaadje op elke
  // computer dezelfde puzzel geeft en de voorvertoning gelijk is aan het resultaat.
  let beste = null;
  let pogingen = 0;
  let werk = 0;
  for (;;) {
    const rnd = willekeur(w.zaad * 131 + pogingen * 7 + C * 1009);
    const r = legWoorden(woorden, C, R, richtingen, rnd);
    pogingen++;
    werk += r.werk;
    if (!beste || r.mislukt.length < beste.mislukt.length) beste = { ...r, C, R, rnd };
    if (!beste.mislukt.length || werk > 1500000 || pogingen >= 80) break;
    if (pogingen % 12 === 0 && w.raster === 'auto' && C < MAX_RASTER) {
      C++;
      R++;
      beste = null;
    }
  }

  // vullen, en zorgen dat elk woord precies één keer in het rooster staat
  const { rooster, rnd } = beste;
  const vrij = [];
  rooster.forEach((v, i) => { if (v === null) vrij.push(i); });
  const vul = maakVuller(w, woorden, rnd);
  for (const i of vrij) rooster[i] = vul();
  for (let ronde = 0; ronde < 40; ronde++) {
    const dubbel = beste.geplaatst.filter((g) => telVoorkomens(rooster, beste.C, beste.R, g.woord.vakjes) > 1);
    if (!dubbel.length) break;
    for (const i of vrij) if (rnd() < 0.35) rooster[i] = vul();
  }
  return beste;
}

// ---- vormen -------------------------------------------------------------------

const r3 = (n) => Math.round(n * 1000) / 1000;

/** Een capsule rond een woord, van het midden van het eerste naar het laatste vakje. */
function capsule(x0, y0, x1, y1, r) {
  let ux = x1 - x0;
  let uy = y1 - y0;
  const l = Math.hypot(ux, uy) || 1;
  ux /= l;
  uy /= l;
  const phi = Math.atan2(ux, -uy); // hoek van de normaal (-uy, ux)
  const punten = [];
  const zet = (cx, cy, a) => ({ x: r3(cx + r * Math.cos(a)), y: r3(cy + r * Math.sin(a)) });
  const boog = (cx, cy, a1, a2) => {
    for (let s = 0; s < 2; s++) {
      const a = a1 + ((a2 - a1) * s) / 2;
      const b = a1 + ((a2 - a1) * (s + 1)) / 2;
      const k = (4 / 3) * Math.tan((b - a) / 4) * r;
      const vorige = punten[punten.length - 1];
      vorige.uit = { x: r3(cx + r * Math.cos(a) - k * Math.sin(a)), y: r3(cy + r * Math.sin(a) + k * Math.cos(a)) };
      const p = zet(cx, cy, b);
      p.in = { x: r3(cx + r * Math.cos(b) + k * Math.sin(b)), y: r3(cy + r * Math.sin(b) - k * Math.cos(b)) };
      punten.push(p);
    }
  };
  punten.push(zet(x0, y0, phi));
  punten.push(zet(x1, y1, phi));
  boog(x1, y1, phi, phi - Math.PI);
  punten.push(zet(x0, y0, phi - Math.PI));
  boog(x0, y0, phi - Math.PI, phi - 2 * Math.PI);
  // het laatste punt valt samen met het eerste: neem zijn handvat over en laat het weg
  const laatste = punten.pop();
  punten[0].in = laatste.in;
  return { gesloten: true, punten };
}

/** Breedte van tekst in Inter, ongeveer (in em), voor de kolommen van de woordenlijst. */
const breedteEm = (tekst) => [...tekst].reduce((n, t) => n + ('MW'.includes(t) ? 0.86 : 'IJ'.includes(t) ? 0.32 : t === ' ' ? 0.26 : 0.66), 0);

/** Alle vormen van een exemplaar van de puzzel, met linksboven op (x, y). */
function puzzelVormen(p, w, opmaak, x, y, metOplossing) {
  const { C, R, rooster } = p;
  const c = opmaak.c;
  const kinderen = [];
  const breed = C * c;
  const hoog = R * c;
  if (w.lijnen !== 'geen') {
    const subpaden = [{
      gesloten: true,
      punten: [{ x: r3(x), y: r3(y) }, { x: r3(x + breed), y: r3(y) }, { x: r3(x + breed), y: r3(y + hoog) }, { x: r3(x), y: r3(y + hoog) }],
    }];
    if (w.lijnen === 'raster') {
      for (let i = 1; i < C; i++) subpaden.push({ gesloten: false, punten: [{ x: r3(x + i * c), y: r3(y) }, { x: r3(x + i * c), y: r3(y + hoog) }] });
      for (let j = 1; j < R; j++) subpaden.push({ gesloten: false, punten: [{ x: r3(x), y: r3(y + j * c) }, { x: r3(x + breed), y: r3(y + j * c) }] });
    }
    kinderen.push({
      soort: 'pad', naam: w.lijnen === 'raster' ? 'Raster' : 'Kader', subpaden, vulling: null,
      lijn: opmaak.lijnKleur, lijndikte: w.lijnen === 'raster' ? 0.5 : 0.75, lijnhoek: 'miter',
    });
  }
  const letters = [];
  const grootte = r3(c * (rooster.some((v) => v.length > 1) ? 0.5 : 0.56));
  const zakken = w.hoofdletters ? 0.362 : 0.27;
  for (let j = 0; j < R; j++) {
    for (let i = 0; i < C; i++) {
      const v = rooster[j * C + i];
      letters.push({
        soort: 'tekst', inhoud: w.hoofdletters ? v : v.toLowerCase(),
        x: r3(x + (i + 0.5) * c), y: r3(y + (j + 0.5) * c + grootte * zakken),
        grootte, gewicht: 500, uitlijning: 'midden', vulling: opmaak.tekstKleur,
      });
    }
  }
  kinderen.push({ soort: 'groep', naam: 'Letters', kinderen: letters });
  if (metOplossing) {
    const rand = c * 0.4;
    const capsules = p.geplaatst.map((g) => {
      const L = g.woord.vakjes.length - 1;
      return {
        soort: 'pad', naam: g.woord.toon.slice(0, 100),
        subpaden: [capsule(x + (g.c0 + 0.5) * c, y + (g.r0 + 0.5) * c, x + (g.c0 + g.dc * L + 0.5) * c, y + (g.r0 + g.dr * L + 0.5) * c, rand)],
        vulling: null, lijn: opmaak.oplosKleur, lijndikte: 1, lijnhoek: 'round',
      };
    });
    // als groep op de puzzel: verborgen, aan te zetten in het lagenpaneel
    kinderen.push({ soort: 'groep', naam: 'Oplossing', zichtbaar: w.oplossing !== 'groep', kinderen: capsules });
  }
  return kinderen;
}

/** De woordenlijst onder het rooster, in kolommen. */
function lijstVormen(p, w, opmaak, x, y, breed) {
  const woorden = p.geplaatst.map((g) => (w.hoofdletters ? g.woord.toon.toUpperCase() : g.woord.toon.toLowerCase()))
    .sort((a, b) => a.localeCompare(b, 'nl'));
  const fs = 11;
  const breedste = Math.max(...woorden.map((t) => breedteEm(t.toUpperCase()))) * fs + vexel.mm(6);
  const n = begrens(Math.floor(breed / breedste), 1, 5);
  const perKolom = Math.ceil(woorden.length / n);
  const kolommen = [];
  for (let i = 0; i < n; i++) {
    const deel = woorden.slice(i * perKolom, (i + 1) * perKolom);
    if (!deel.length) continue;
    kolommen.push({
      soort: 'tekst', inhoud: deel.join('\n'), x: r3(x + (i * breed) / n), y: r3(y + fs),
      grootte: fs, regelafstand: 16, gewicht: 400, uitlijning: 'links', letterafstand: w.hoofdletters ? 40 : 0, vulling: opmaak.tekstKleur,
    });
  }
  return { vorm: { soort: 'groep', naam: 'Woordenlijst', kinderen: kolommen }, hoogte: perKolom * 16 };
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

function vinkje(tekst, aan) {
  const vak = maak('input', { type: 'checkbox' });
  vak.checked = Boolean(aan);
  return { vak, el: maak('label', { stijl: { display: 'flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap' } }, vak, tekst) };
}

// ---- het venster --------------------------------------------------------------

async function toonVenster() {
  const doc = await vexel.document();
  const cmyk = doc.kleurruimte === 'cmyk';
  const w0 = { ...STANDAARD, ...((await vexel.haal('instellingen')) || {}) };

  const woordenVeld = maak('textarea', {
    klasse: 'veld', spellcheck: 'false', 'aria-label': 'Woorden, één per regel',
    placeholder: 'Eén woord per regel, of gescheiden door komma’s',
    stijl: { width: '100%', height: '100%', minHeight: '190px', padding: '6px 8px', resize: 'none', lineHeight: '1.45' },
  });
  woordenVeld.value = VOORBEELD;
  const titel = maak('input', { klasse: 'veld', type: 'text', maxlength: 80, placeholder: 'Bijvoorbeeld: Zoek de lentewoorden', stijl: { width: '100%' } });
  const raster = keuzeVeld([['auto', 'Automatisch'], ['vast', 'Vaste maat']], w0.raster);
  const kolommen = getalVeld(w0.kolommen, 4, MAX_RASTER, 1);
  const rijen = getalVeld(w0.rijen, 4, MAX_RASTER, 1);
  const celmaat = getalVeld(w0.celmaat, 3, 30, 0.5);
  const richting = {
    horizontaal: vinkje('Horizontaal', w0.horizontaal),
    verticaal: vinkje('Verticaal', w0.verticaal),
    diagonaal: vinkje('Diagonaal', w0.diagonaal),
    achterstevoren: vinkje('Achterstevoren', w0.achterstevoren),
  };
  const letters = keuzeVeld([['hoofd', 'HOOFDLETTERS'], ['klein', 'kleine letters']], w0.hoofdletters ? 'hoofd' : 'klein');
  const vulling = keuzeVeld([['gewoon', 'Gewone letters'], ['woordletters', 'Letters uit de woorden']], w0.vulling);
  const ij = vinkje('IJ in één vakje', w0.ij);
  const lijnen = keuzeVeld([['geen', 'Geen lijnen'], ['kader', 'Kader'], ['raster', 'Kader en raster']], w0.lijnen);
  const lijst = vinkje('Woordenlijst', w0.lijst);
  const oplossing = keuzeVeld([['geen', 'Geen'], ['groep', 'Groep erop'], ['ernaast', 'Los ernaast']], w0.oplossing);
  const zaad = getalVeld(w0.zaad, 1, 99999, 1);

  const doek = maak('canvas', { 'aria-hidden': 'true', stijl: { width: '100%', height: '210px' } });
  const samenvatting = maak('p', { klasse: 'uitleg', 'aria-live': 'polite', stijl: { margin: '0', minHeight: '2.9em' } });
  const variant = maak('button', { klasse: 'knop', type: 'button', tekst: 'Opnieuw schudden' });
  const maakKnop = maak('button', { klasse: 'knop primair', type: 'submit', tekst: 'Woordzoeker maken' });
  const annuleer = maak('button', { klasse: 'knop', type: 'button', tekst: 'Annuleren', bijClick: () => vexel.sluit() });

  const formulier = maak('form', { stijl: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '10px', padding: '12px 14px 14px' } },
    kolommenRij('1fr 1.25fr',
      maak('label', { stijl: { display: 'grid', gridTemplateRows: 'auto 1fr', gap: '3px', alignSelf: 'stretch' } },
        maak('span', { klasse: 'label', tekst: 'Woorden', stijl: { minWidth: '0' } }), woordenVeld),
      doek),
    kolommenRij('2fr 1fr', metLabel('Titel (mag leeg)', titel), metLabel('Celmaat', celmaat, 'mm')),
    kolommenRij('1fr 1fr 1fr', metLabel('Rooster', raster), metLabel('Kolommen', kolommen), metLabel('Rijen', rijen)),
    maak('div', { stijl: { display: 'flex', flexWrap: 'wrap', gap: '4px 14px' } }, ...Object.values(richting).map((v) => v.el)),
    kolommenRij('1fr 1fr 1fr', metLabel('Letters', letters), metLabel('Opvullen met', vulling), ij.el),
    kolommenRij('1fr 1fr 1fr', metLabel('Lijnen', lijnen), metLabel('Oplossing', oplossing), lijst.el),
    kolommenRij('1fr 2fr', metLabel('Variant', zaad), samenvatting),
    maak('div', { klasse: 'knoppen', stijl: { marginTop: '0' } }, variant, maak('span', { stijl: { flex: '1' } }), annuleer, maakKnop),
  );
  ij.el.style.height = '26px';
  lijst.el.style.height = '26px';
  document.head.append(maak('style', { tekst: '.veld:disabled{opacity:.45}.knop{white-space:nowrap}textarea.veld{height:auto}' }));
  document.body.style.padding = '0';
  document.body.append(formulier);

  const waarden = () => ({
    raster: raster.value,
    kolommen: Math.round(begrens(leesGetal(kolommen, 15), 4, MAX_RASTER)),
    rijen: Math.round(begrens(leesGetal(rijen, 15), 4, MAX_RASTER)),
    celmaat: begrens(leesGetal(celmaat, 8), 3, 30),
    horizontaal: richting.horizontaal.vak.checked,
    verticaal: richting.verticaal.vak.checked,
    diagonaal: richting.diagonaal.vak.checked,
    achterstevoren: richting.achterstevoren.vak.checked,
    hoofdletters: letters.value === 'hoofd',
    ij: ij.vak.checked,
    vulling: vulling.value,
    lijnen: lijnen.value,
    lijst: lijst.vak.checked,
    oplossing: oplossing.value,
    zaad: Math.round(begrens(leesGetal(zaad, 1), 1, 99999)),
  });

  const bereken = () => {
    const w = waarden();
    const { woorden, teKort } = leesWoorden(woordenVeld.value, w.ij);
    return { w, puzzel: maakPuzzel(w, woorden), teKort };
  };

  let gepland = false;
  function teken() {
    gepland = false;
    const { w, puzzel, teKort } = bereken();
    kolommen.disabled = w.raster === 'auto';
    rijen.disabled = w.raster === 'auto';
    if (w.raster === 'auto' && puzzel.C) {
      kolommen.value = String(puzzel.C);
      rijen.value = String(puzzel.R);
    }

    const schaal = devicePixelRatio || 1;
    const kader = doek.getBoundingClientRect();
    doek.width = Math.round(kader.width * schaal);
    doek.height = Math.round(kader.height * schaal);
    const g = doek.getContext('2d');
    g.setTransform(schaal, 0, 0, schaal, 0, 0);
    g.clearRect(0, 0, kader.width, kader.height);
    if (puzzel.C) {
      const { C, R, rooster } = puzzel;
      const c = Math.min((kader.width - 16) / C, (kader.height - 16) / R);
      const ox = (kader.width - C * c) / 2;
      const oy = (kader.height - R * c) / 2;
      g.fillStyle = '#ffffff';
      g.fillRect(ox, oy, C * c, R * c);
      if (w.lijnen === 'raster') {
        g.strokeStyle = '#d5d7dc';
        g.lineWidth = 0.5;
        g.beginPath();
        for (let i = 1; i < C; i++) { g.moveTo(ox + i * c, oy); g.lineTo(ox + i * c, oy + R * c); }
        for (let j = 1; j < R; j++) { g.moveTo(ox, oy + j * c); g.lineTo(ox + C * c, oy + j * c); }
        g.stroke();
      }
      if (w.oplossing !== 'geen') {
        g.strokeStyle = OPLOSKLEUR.hex;
        g.lineWidth = Math.max(1, c * 0.75);
        g.lineCap = 'round';
        g.globalAlpha = 0.28;
        for (const p of puzzel.geplaatst) {
          const L = p.woord.vakjes.length - 1;
          g.beginPath();
          g.moveTo(ox + (p.c0 + 0.5) * c, oy + (p.r0 + 0.5) * c);
          g.lineTo(ox + (p.c0 + p.dc * L + 0.5) * c, oy + (p.r0 + p.dr * L + 0.5) * c);
          g.stroke();
        }
        g.globalAlpha = 1;
      }
      g.fillStyle = '#1a1a1a';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = `500 ${Math.max(5, c * 0.56)}px Inter, system-ui, sans-serif`;
      for (let j = 0; j < R; j++) {
        for (let i = 0; i < C; i++) {
          const v = rooster[j * C + i];
          g.fillText(w.hoofdletters ? v : v.toLowerCase(), ox + (i + 0.5) * c, oy + (j + 0.5) * c + 0.5);
        }
      }
    }

    let tekst;
    if (doc.alleenLezen) tekst = 'Dit document is alleen-lezen; je kunt hier niets aan toevoegen.';
    else if (puzzel.fout) tekst = puzzel.fout;
    else {
      const maat = getal((puzzel.C * vexel.mm(w.celmaat)) / vexel.mm(1), 0);
      const hoogte = getal((puzzel.R * vexel.mm(w.celmaat)) / vexel.mm(1), 0);
      tekst = `${puzzel.C} × ${puzzel.R} letters (${maat} × ${hoogte} mm), ${puzzel.geplaatst.length} woorden verstopt.`;
      if (puzzel.mislukt.length) {
        tekst = `Past niet: ${puzzel.mislukt.map((x) => x.toon).join(', ')}. Maak het rooster groter of zet meer richtingen aan.`;
      }
    }
    if (teKort.length && !puzzel.fout) tekst += ` Overgeslagen (te kort): ${teKort.join(', ')}.`;
    samenvatting.textContent = tekst;
    samenvatting.classList.toggle('fout', Boolean(puzzel.fout || (puzzel.mislukt && puzzel.mislukt.length)));
    maakKnop.disabled = doc.alleenLezen || Boolean(puzzel.fout);
  }
  const plan = () => {
    if (!gepland) {
      gepland = true;
      requestAnimationFrame(teken);
    }
  };

  variant.addEventListener('click', () => {
    zaad.value = String(1 + Math.floor(Math.random() * 99999));
    plan();
  });
  formulier.addEventListener('input', plan);
  formulier.addEventListener('change', plan);
  formulier.addEventListener('submit', async (gebeurtenis) => {
    gebeurtenis.preventDefault();
    const { w, puzzel } = bereken();
    if (puzzel.fout) return vexel.melding(puzzel.fout, 'let');
    const tg = doc.tekengebied;
    const c = vexel.mm(w.celmaat);
    const opmaak = {
      c,
      tekstKleur: cmyk ? { cmyk: [0, 0, 0, 100] } : { hex: '#1a1a1a' },
      lijnKleur: cmyk ? { cmyk: [0, 0, 0, w.lijnen === 'raster' ? 35 : 80] } : { hex: w.lijnen === 'raster' ? '#b3b3b3' : '#404040' },
      oplosKleur: cmyk ? { cmyk: OPLOSKLEUR.cmyk } : { hex: OPLOSKLEUR.hex },
    };
    const breed = puzzel.C * c;
    const x = r3((tg.b - breed) / 2);
    const titelTekst = titel.value.trim();
    const bovenkant = vexel.mm(18);
    const y = r3(bovenkant + (titelTekst ? 40 : 0));

    const exemplaar = (dx, metOplossing, naam) => {
      const kinderen = [];
      if (titelTekst) {
        kinderen.push({
          soort: 'tekst', naam: 'Titel', inhoud: titelTekst, x: r3(dx + tg.b / 2), y: r3(bovenkant + 20),
          grootte: 20, gewicht: 700, uitlijning: 'midden', vulling: opmaak.tekstKleur,
        });
      }
      kinderen.push(...puzzelVormen(puzzel, w, opmaak, x + dx, y, metOplossing));
      if (w.lijst && puzzel.geplaatst.length) kinderen.push(lijstVormen(puzzel, w, opmaak, x + dx, y + puzzel.R * c + vexel.mm(8), breed).vorm);
      return { soort: 'groep', naam, kinderen };
    };
    const vormen = [exemplaar(0, w.oplossing === 'groep', `Woordzoeker ${puzzel.C} × ${puzzel.R}`)];
    if (w.oplossing === 'ernaast') vormen.push(exemplaar(tg.b + vexel.mm(20), true, `Woordzoeker ${puzzel.C} × ${puzzel.R}, oplossing`));

    maakKnop.disabled = true;
    try {
      await vexel.maak(vormen);
      await vexel.bewaar('instellingen', w);
      let melding = `Woordzoeker gemaakt met ${puzzel.geplaatst.length} woorden.`;
      if (puzzel.mislukt.length) melding += ` Niet geplaatst: ${puzzel.mislukt.map((m) => m.toon).join(', ')}.`;
      if (w.oplossing === 'groep') melding += ' De oplossing staat verborgen in de groep Oplossing; zet hem aan in het lagenpaneel.';
      if (w.oplossing === 'ernaast') melding += ' De oplossing staat rechts naast het tekengebied.';
      vexel.melding(melding, puzzel.mislukt.length ? 'let' : 'ok');
      vexel.sluit();
    } catch (fout) {
      maakKnop.disabled = false;
      vexel.melding(fout && fout.message ? fout.message : 'De woordzoeker kon niet worden gemaakt.', 'fout');
    }
  });

  teken();
  woordenVeld.focus();
  woordenVeld.select();
}

vexel.opCommando('maken', toonVenster);
