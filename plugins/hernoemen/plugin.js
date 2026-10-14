// Objecten hernoemen: geef de geselecteerde objecten in één keer een nette naam,
// met een patroon ("Knop {n}"), een beginnummer, voorloopnullen, zoeken en vervangen
// en hoofdletters. Een lijst laat vooraf zien wat elke naam wordt.
// Eigen werk, MIT-licentie (zie de README van deze repo).
'use strict';

const STANDAARD = {
  basis: 'patroon', patroon: 'Knop {n}', begin: 1, stap: 1, cijfers: 1,
  volgorde: 'lezen', omkeren: false, zoek: '', vervang: '', hoofdgevoelig: false, regex: false, letters: 'zelfde',
};

const SOORTNAAM = {
  pad: 'Pad', samengesteld: 'Samengesteld pad', tekst: 'Tekst', groep: 'Groep', knipgroep: 'Knipgroep',
  beeld: 'Foto', rechthoek: 'Rechthoek', ellips: 'Ellips', symbool: 'Symbool',
};

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

const begrens = (n, min, max) => Math.min(max, Math.max(min, n));
const leesGetal = (veld, terugval) => {
  const n = Number(String(veld.value).replace(',', '.'));
  return Number.isFinite(n) ? n : terugval;
};
const getalVeld = (waarde, min, max, stap) =>
  maak('input', { klasse: 'veld', type: 'number', min, max, step: stap, value: waarde, stijl: { width: '100%' } });
const tekstVeld = (waarde, plaats) =>
  maak('input', { klasse: 'veld', type: 'text', value: waarde, placeholder: plaats || '', spellcheck: 'false', stijl: { width: '100%' } });

function keuzeVeld(opties, waarde) {
  const veld = maak('select', { klasse: 'veld', stijl: { width: '100%' } },
    ...opties.map(([w, t]) => maak('option', { value: w, tekst: t })));
  veld.value = opties.some(([w]) => w === waarde) ? waarde : opties[0][0];
  return veld;
}

const metLabel = (tekst, veld) =>
  maak('label', { stijl: { display: 'grid', gap: '3px', minWidth: '0' } },
    maak('span', { klasse: 'label', tekst, stijl: { minWidth: '0' } }), veld);

const kolommenRij = (sjabloon, ...kinderen) =>
  maak('div', { stijl: { display: 'grid', gridTemplateColumns: sjabloon.replace(/([0-9.]+fr)/g, 'minmax(0, $1)'), gap: '10px', alignItems: 'end' } },
    ...kinderen);

function vinkje(tekst, aan) {
  const vak = maak('input', { type: 'checkbox' });
  vak.checked = Boolean(aan);
  return { vak, el: maak('label', { stijl: { display: 'flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap', height: '26px' } }, vak, tekst) };
}

// ---- volgorde -----------------------------------------------------------------

const midden = (o) => (o.kader ? { x: o.kader.x + o.kader.b / 2, y: o.kader.y + o.kader.h / 2 } : { x: 0, y: 0 });

/** Zet de objecten in de gekozen volgorde; 'lezen' = rij voor rij, van links naar rechts. */
function ordenen(items, volgorde, omkeren) {
  const lijst = items.map((o, i) => ({ o, i, m: midden(o) }));
  if (volgorde === 'lr') lijst.sort((a, b) => a.m.x - b.m.x || a.m.y - b.m.y || a.i - b.i);
  else if (volgorde === 'bo') lijst.sort((a, b) => a.m.y - b.m.y || a.m.x - b.m.x || a.i - b.i);
  else if (volgorde === 'lezen') {
    // rijen: objecten waarvan het midden binnen de halve hoogte van de rij valt
    const opY = lijst.slice().sort((a, b) => a.m.y - b.m.y || a.i - b.i);
    const rijen = [];
    for (const it of opY) {
      const h = it.o.kader ? it.o.kader.h : 0;
      const rij = rijen.find((r) => Math.abs(r.y - it.m.y) <= Math.max(2, Math.min(r.h, h) / 2));
      if (rij) {
        rij.leden.push(it);
        rij.y = rij.leden.reduce((n, x) => n + x.m.y, 0) / rij.leden.length;
      } else rijen.push({ y: it.m.y, h, leden: [it] });
    }
    rijen.sort((a, b) => a.y - b.y);
    lijst.length = 0;
    for (const r of rijen) lijst.push(...r.leden.sort((a, b) => a.m.x - b.m.x || a.i - b.i));
  }
  if (omkeren) lijst.reverse();
  return lijst.map((x) => x.o);
}

// ---- namen --------------------------------------------------------------------

/** 1 → A, 26 → Z, 27 → AA. */
function letterVan(n) {
  let s = '';
  let k = Math.max(1, Math.floor(n));
  while (k > 0) {
    k--;
    s = String.fromCharCode(65 + (k % 26)) + s;
    k = Math.floor(k / 26);
  }
  return s;
}

const mmTekst = (pt) => String(Math.round(vexel.naarMm(pt) * 10) / 10).replace('.', ',');

function hoofdletters(tekst, soort) {
  if (soort === 'hoofd') return tekst.toLocaleUpperCase('nl');
  if (soort === 'klein') return tekst.toLocaleLowerCase('nl');
  if (soort === 'zin') {
    const k = tekst.toLocaleLowerCase('nl');
    return k.replace(/^(\s*)(ij|\p{L})/u, (_, s, l) => s + l.toLocaleUpperCase('nl'));
  }
  if (soort === 'woord') {
    return tekst.toLocaleLowerCase('nl').replace(/(^|[\s\-_/(])(ij|\p{L})/gu, (_, s, l) => s + l.toLocaleUpperCase('nl'));
  }
  return tekst;
}

/** Bouwt de zoekfunctie; geeft { fout } bij een ongeldige reguliere expressie. */
function maakVervanger(w) {
  if (!w.zoek) return { pas: (t) => t };
  let re;
  try {
    const bron = w.regex ? w.zoek : w.zoek.replace(/[.*+?^${}()|[\]\\]/g, (t) => '\\' + t);
    re = new RegExp(bron, w.hoofdgevoelig ? 'gu' : 'giu');
  } catch (fout) {
    return { fout: 'Dit zoekpatroon klopt niet (sluit elk haakje). Zet “Zoek met patroon” uit om gewoon op tekst te zoeken.' };
  }
  // bij gewone tekst geen $1 en $& in de vervanging
  const vervang = w.regex ? w.vervang : w.vervang.replace(/\$/g, '$$$$');
  return { pas: (t) => t.replace(re, vervang) };
}

/** De nieuwe naam van elk object: [{ o, oud, nieuw }]. */
function nieuweNamen(items, w) {
  const vervanger = maakVervanger(w);
  if (vervanger.fout) return { fout: vervanger.fout, lijst: [] };
  const geordend = ordenen(items, w.volgorde, w.omkeren);
  const lijst = geordend.map((o, i) => {
    const nummer = w.begin + i * w.stap;
    const oud = o.naam || '';
    let naam;
    if (w.basis === 'patroon') {
      const teken = nummer < 0 ? '-' : '';
      const n = teken + String(Math.abs(nummer)).padStart(w.cijfers, '0');
      naam = w.patroon.replace(/\{(n|a|naam|soort|b|h|i)\}/gi, (_, sleutel) => {
        const s = sleutel.toLowerCase();
        if (s === 'n') return n;
        if (s === 'a') return letterVan(nummer);
        if (s === 'i') return String(i + 1);
        if (s === 'naam') return oud || SOORTNAAM[o.soort] || 'Object';
        if (s === 'soort') return SOORTNAAM[o.soort] || 'Object';
        if (s === 'b') return o.kader ? mmTekst(o.kader.b) : '';
        return o.kader ? mmTekst(o.kader.h) : '';
      });
    } else naam = oud;
    naam = vervanger.pas(naam);
    naam = hoofdletters(naam, w.letters);
    naam = [...naam].filter((t) => t.charCodeAt(0) >= 32).join('').replace(/\s+/g, ' ').trim().slice(0, 100);
    return { o, oud, nieuw: naam };
  });
  return { lijst };
}

// ---- het venster --------------------------------------------------------------

async function toonVenster() {
  const doc = await vexel.document();
  const items = await vexel.selectie();
  const w0 = { ...STANDAARD, ...((await vexel.haal('instellingen')) || {}) };

  const basis = keuzeVeld([['patroon', 'Nieuwe naam volgens patroon'], ['huidig', 'Huidige naam houden']], w0.basis);
  const patroon = tekstVeld(w0.patroon, 'Bijvoorbeeld: Knop {n}');
  const begin = getalVeld(w0.begin, -99999, 99999, 1);
  const stap = getalVeld(w0.stap, -1000, 1000, 1);
  const cijfers = keuzeVeld([['1', '1'], ['2', '01'], ['3', '001'], ['4', '0001'], ['5', '00001']], String(w0.cijfers));
  const volgorde = keuzeVeld([
    ['lezen', 'Leesvolgorde (rij voor rij)'], ['lr', 'Van links naar rechts'], ['bo', 'Van boven naar onder'], ['selectie', 'Volgorde van de lagen'],
  ], w0.volgorde);
  const omkeren = vinkje('Omgekeerd', w0.omkeren);
  const zoek = tekstVeld(w0.zoek, 'Zoek (mag leeg)');
  const vervang = tekstVeld(w0.vervang, 'Vervang door');
  const hoofdgevoelig = vinkje('Hoofdlettergevoelig', w0.hoofdgevoelig);
  const regex = vinkje('Zoek met patroon', w0.regex);
  regex.el.title = 'Zoek met een reguliere expressie; in de vervanging werken $1, $2 …';
  const letters = keuzeVeld([
    ['zelfde', 'Zoals het is'], ['hoofd', 'HOOFDLETTERS'], ['klein', 'kleine letters'], ['woord', 'Elk Woord Een Hoofdletter'], ['zin', 'Eerste letter hoofdletter'],
  ], w0.letters);

  const tokens = maak('p', { klasse: 'uitleg', stijl: { margin: '-4px 0 0' } });
  tokens.append('Gebruik ', maak('b', { tekst: '{n}' }), ' (nummer), ', maak('b', { tekst: '{a}' }), ' (A, B, C …), ',
    maak('b', { tekst: '{naam}' }), ' (huidige naam), ', maak('b', { tekst: '{soort}' }), ', ', maak('b', { tekst: '{b}' }), ' en ',
    maak('b', { tekst: '{h}' }), ' (breedte en hoogte in mm).');

  const lijstEl = maak('div', {
    role: 'list', 'aria-label': 'Voorvertoning van de nieuwe namen',
    stijl: { border: '1px solid var(--lijn)', borderRadius: '5px', background: 'var(--bg-2)', overflow: 'auto', minHeight: '0' },
  });
  const samenvatting = maak('p', { klasse: 'uitleg', 'aria-live': 'polite', stijl: { margin: '0', minHeight: '1.5em' } });
  const toepassen = maak('button', { klasse: 'knop primair', type: 'submit', tekst: 'Hernoemen' });
  const annuleer = maak('button', { klasse: 'knop', type: 'button', tekst: 'Annuleren', bijClick: () => vexel.sluit() });

  const formulier = maak('form', {
    stijl: { display: 'grid', gridTemplateRows: 'auto auto auto auto auto auto auto auto minmax(0, 1fr) auto auto', gap: '10px', padding: '12px 14px 14px', height: '100vh' },
  },
  kolommenRij('1fr', metLabel('Naam', basis)),
  kolommenRij('1fr', metLabel('Patroon', patroon)),
  tokens,
  kolommenRij('1fr 1fr 1fr', metLabel('Begin bij', begin), metLabel('Stap', stap), metLabel('Cijfers', cijfers)),
  kolommenRij('1fr auto', metLabel('Volgorde', volgorde), omkeren.el),
  kolommenRij('1fr 1fr', metLabel('Zoeken', zoek), metLabel('Vervangen door', vervang)),
  maak('div', { stijl: { display: 'flex', gap: '4px 16px', flexWrap: 'wrap', marginTop: '-6px' } }, hoofdgevoelig.el, regex.el),
  kolommenRij('1fr', metLabel('Hoofdletters', letters)),
  lijstEl,
  samenvatting,
  maak('div', { klasse: 'knoppen', stijl: { marginTop: '0' } }, annuleer, toepassen),
  );
  document.head.append(maak('style', {
    tekst: '.veld:disabled{opacity:.45}.knop{white-space:nowrap}b{color:var(--tekst);font-weight:600}'
      + '.r{display:grid;grid-template-columns:30px minmax(0,1fr) 14px minmax(0,1fr);gap:6px;align-items:center;padding:3px 8px;'
      + 'border-bottom:1px solid var(--lijn)}.r:last-child{border-bottom:0}.r span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
      + '.r .nr{color:var(--tekst-zacht);text-align:right;font-variant-numeric:tabular-nums}.r .oud{color:var(--tekst-zacht)}'
      + '.r .pijl{color:var(--tekst-zacht)}.r .nieuw.anders{color:var(--accent)}.r .leeg{font-style:italic;opacity:.7}'
      + '.r.dubbel .nieuw{color:#ffc35c}.leegte{padding:16px 12px;color:var(--tekst-zacht);line-height:1.5}',
  }));
  document.body.style.padding = '0';
  document.body.append(formulier);

  const waarden = () => ({
    basis: basis.value,
    patroon: patroon.value,
    begin: Math.round(begrens(leesGetal(begin, 1), -99999, 99999)),
    stap: Math.round(begrens(leesGetal(stap, 1), -1000, 1000)),
    cijfers: Number(cijfers.value) || 1,
    volgorde: volgorde.value,
    omkeren: omkeren.vak.checked,
    zoek: zoek.value,
    vervang: vervang.value,
    hoofdgevoelig: hoofdgevoelig.vak.checked,
    regex: regex.vak.checked,
    letters: letters.value,
  });

  let laatste = { lijst: [] };
  function bijwerken() {
    const w = waarden();
    patroon.disabled = w.basis !== 'patroon';
    for (const v of [begin, stap, cijfers]) v.disabled = w.basis !== 'patroon';
    lijstEl.replaceChildren();
    if (!items.length) {
      lijstEl.append(maak('div', { klasse: 'leegte', tekst: 'Er is niets geselecteerd. Sluit dit venster, selecteer de objecten die je wilt hernoemen en kies Objecten hernoemen opnieuw.' }));
      samenvatting.textContent = 'Selecteer eerst een of meer objecten.';
      samenvatting.classList.add('fout');
      toepassen.disabled = true;
      laatste = { lijst: [] };
      return;
    }
    laatste = nieuweNamen(items, w);
    const telling = new Map();
    for (const r of laatste.lijst) telling.set(r.nieuw, (telling.get(r.nieuw) || 0) + 1);
    laatste.lijst.forEach((r, i) => {
      const anders = r.nieuw !== r.oud;
      const dubbel = telling.get(r.nieuw) > 1 && w.basis === 'patroon';
      lijstEl.append(maak('div', { klasse: 'r' + (dubbel ? ' dubbel' : ''), role: 'listitem' },
        maak('span', { klasse: 'nr', tekst: String(i + 1) }),
        maak('span', { klasse: 'oud' + (r.oud ? '' : ' leeg'), tekst: r.oud || SOORTNAAM[r.o.soort] || 'Object', title: r.oud }),
        maak('span', { klasse: 'pijl', tekst: '›', 'aria-hidden': 'true' }),
        maak('span', { klasse: 'nieuw' + (anders ? ' anders' : '') + (r.nieuw ? '' : ' leeg'), tekst: r.nieuw || '(geen naam)', title: r.nieuw })));
    });
    const veranderd = laatste.lijst.filter((r) => r.nieuw !== r.oud).length;
    const dubbele = [...telling.values()].filter((n) => n > 1).length;
    let tekst;
    let fout = false;
    if (doc.alleenLezen) {
      tekst = 'Dit document is alleen-lezen; je kunt hier niets hernoemen.';
      fout = true;
    } else if (laatste.fout) {
      tekst = laatste.fout;
      fout = true;
    } else if (!veranderd) tekst = `Bij deze ${items.length === 1 ? 'selectie' : items.length + ' objecten'} verandert er niets.`;
    else {
      tekst = `${veranderd} van ${items.length} ${items.length === 1 ? 'object krijgt' : 'objecten krijgen'} een nieuwe naam.`;
      if (dubbele && w.basis === 'patroon') tekst += ' Let op: sommige namen komen dubbel voor (geel); gebruik {n} voor een nummer.';
    }
    samenvatting.textContent = tekst;
    samenvatting.classList.toggle('fout', fout);
    toepassen.disabled = fout || !veranderd;
  }

  formulier.addEventListener('input', bijwerken);
  formulier.addEventListener('change', bijwerken);
  formulier.addEventListener('submit', async (gebeurtenis) => {
    gebeurtenis.preventDefault();
    bijwerken();
    const wijzigingen = laatste.lijst.filter((r) => r.nieuw !== r.oud).map((r) => ({ id: r.o.id, naam: r.nieuw }));
    if (!wijzigingen.length || toepassen.disabled) return;
    toepassen.disabled = true;
    try {
      await vexel.wijzig(wijzigingen);
      await vexel.bewaar('instellingen', waarden());
      vexel.melding(wijzigingen.length === 1 ? 'Eén object hernoemd.' : `${wijzigingen.length} objecten hernoemd.`, 'ok');
      vexel.sluit();
    } catch (fout) {
      toepassen.disabled = false;
      vexel.melding(fout && fout.message ? fout.message : 'Hernoemen lukte niet.', 'fout');
    }
  });

  bijwerken();
  if (items.length) {
    const veld = basis.value === 'patroon' ? patroon : zoek;
    veld.focus();
    veld.select();
  }
}

vexel.opCommando('hernoemen', toonVenster);
