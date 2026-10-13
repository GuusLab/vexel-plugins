#!/usr/bin/env node
// Controleert elke plugin in plugins/<id>/ volgens het contract (zie README en docs/api.md).
//
//   node tools/valideer.mjs              alle plugins
//   node tools/valideer.mjs pad/naar/map één losse pluginmap (handig tijdens het maken)
//
// Geen afhankelijkheden, Node 20 of nieuwer. Exitcode 1 bij fouten.
// Bestanden buiten plugins/ worden niet gecontroleerd: die vallen onder CODEOWNERS.

import { createHash } from 'node:crypto';
import { lstatSync, readdirSync, readFileSync, existsSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const HIER = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(HIER, '..');

export const KB = 1024;
export const GRENZEN = {
  pluginJs: 200 * KB,
  icoon: 16 * KB,
  totaal: 256 * KB,
  regelLengte: 200,
};

export const ID_PATROON = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const GITHUB_PATROON = /^[A-Za-z0-9-]{1,39}$/;
export const LICENTIES = ['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', '0BSD'];
export const CATEGORIEEN = ['vormen', 'kleur', 'tekst', 'ordenen', 'patronen', 'hulpmiddelen'];
export const RECHTEN = ['selectie.lezen', 'document.schrijven'];

const TOEGESTANE_BESTANDEN = ['plugin.json', 'plugin.js', 'icoon.svg', 'README.md', 'LICENSE'];
// Bestanden die macOS zelf aanmaakt; ze staan in .gitignore en komen dus nooit in een PR.
const GENEGEERD = new Set(['.DS_Store']);

// ---------------------------------------------------------------------------
// Hulpjes

const lengte = (s) => [...s].length; // tekens, niet UTF-16-eenheden

export function laadMerken(pad = join(HIER, 'merken.json')) {
  const data = JSON.parse(readFileSync(pad, 'utf8'));
  return new Set(data.hashes);
}

/* Merknamen staan als hash in merken.json: de naam in kleine letters, woorden
   met één spatie ertussen. Een naam van twee woorden telt ook aan elkaar. */
const normaal = (s) => s.toLowerCase().normalize('NFKC').trim().split(/[\s_-]+/).filter(Boolean).join(' ');

export function merkHashes(naam) {
  const n = normaal(naam);
  return n.includes(' ') ? [sha256(n), sha256(n.replace(/ /g, ''))] : [sha256(n)];
}

/** Alle merknamen in een tekst: [{ woord, index }] (hele woorden, ook twee achter elkaar). */
function vindMerken(tekst, hashes) {
  const woorden = [...tekst.matchAll(/[\p{L}\p{N}]+/gu)];
  const gevonden = [];
  for (let i = 0; i < woorden.length; i++) {
    const w = woorden[i];
    if (hashes.has(sha256(normaal(w[0])))) { gevonden.push({ woord: w[0], index: w.index }); continue; }
    const v = woorden[i + 1];
    // twee woorden, alleen gescheiden door spaties, _ of -
    if (v && /^[\s_-]*$/.test(tekst.slice(w.index + w[0].length, v.index)) && hashes.has(sha256(normaal(w[0] + ' ' + v[0])))) {
      gevonden.push({ woord: tekst.slice(w.index, v.index + v[0].length), index: w.index });
      i++;
    }
  }
  return gevonden;
}

// Bidi-stuurtekens, tekens zonder breedte en andere onzichtbare tekens (Trojan Source).
const ONZICHTBAAR =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u00AD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180B-\u180F\u200B-\u200F\u202A-\u202E\u2060-\u206F\u3164\uFE00-\uFE0F\uFEFF\uFFA0\uFFF9-\uFFFB\u{E0000}-\u{E007F}\u{E0100}-\u{E01EF}]/u;
const ONZICHTBAAR_G = new RegExp(ONZICHTBAAR.source, 'gu');

function tekenNaam(t) {
  return 'U+' + t.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
}

function regelVan(tekst, index) {
  let n = 1;
  for (let i = 0; i < index; i++) if (tekst.charCodeAt(i) === 10) n++;
  return n;
}

function leesUtf8(buf) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Manifest: vaste volgorde en hash (gedeeld met bouw-index.mjs en de tests)

/** Het manifest in vaste volgorde, zonder ontbrekende optionele velden. */
export function canoniekManifest(m) {
  const auteur = { naam: m.auteur.naam };
  if (m.auteur.github !== undefined) auteur.github = m.auteur.github;
  return {
    id: m.id,
    naam: m.naam,
    beschrijving: m.beschrijving,
    auteur,
    licentie: m.licentie,
    categorie: m.categorie,
    rechten: [...m.rechten],
    commandos: m.commandos.map((c) => {
      const uit = { id: c.id, titel: c.titel };
      if (c.venster !== undefined) uit.venster = { breedte: c.venster.breedte, hoogte: c.venster.hoogte };
      return uit;
    }),
  };
}

export const sha256 = (data) => createHash('sha256').update(data).digest('hex');

/** hash = sha256("<id>\n" + JSON.stringify(canoniek manifest) + "\n" + sha256(plugin.js)) */
export function pluginHash(manifest, pluginJsBytes) {
  const m = canoniekManifest(manifest);
  return sha256(Buffer.from(`${m.id}\n${JSON.stringify(m)}\n${sha256(pluginJsBytes)}`, 'utf8'));
}

// ---------------------------------------------------------------------------
// Manifest-controle

function valideerManifest(m, mapNaam, fout) {
  const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const isTekst = (v) => typeof v === 'string';
  const extra = (obj, toegestaan, waar) => {
    for (const k of Object.keys(obj)) {
      if (!toegestaan.includes(k)) fout('manifest.onbekend-veld', `onbekend veld "${waar}${k}"; toegestaan: ${toegestaan.join(', ')}`, k);
    }
  };
  const tekstVeld = (v, naam, min, max) => {
    if (!isTekst(v)) return fout('manifest.veld', `"${naam}" moet tekst zijn`, naam.split('.').pop());
    const n = lengte(v);
    if (n < min || n > max) fout('manifest.veld', `"${naam}" moet ${min} tot ${max} tekens lang zijn (nu ${n})`, naam.split('.').pop());
    if (v !== v.trim()) fout('manifest.veld', `"${naam}" begint of eindigt met spaties`, naam.split('.').pop());
    if (/[\r\n\t]/.test(v)) fout('manifest.veld', `"${naam}" mag geen regeleinden of tabs bevatten`, naam.split('.').pop());
  };

  if (!isObject(m)) return fout('manifest.veld', 'plugin.json moet een JSON-object zijn');
  extra(m, ['id', 'naam', 'beschrijving', 'auteur', 'licentie', 'categorie', 'rechten', 'commandos'], '');
  for (const k of ['id', 'naam', 'beschrijving', 'auteur', 'licentie', 'categorie', 'rechten', 'commandos']) {
    if (!(k in m)) fout('manifest.ontbreekt', `verplicht veld "${k}" ontbreekt`);
  }

  if ('id' in m) {
    if (!isTekst(m.id) || !ID_PATROON.test(m.id) || m.id.length < 2 || m.id.length > 40) {
      fout('manifest.id', '"id" moet 2 tot 40 tekens zijn: kleine letters, cijfers en losse streepjes (bijv. "mijn-plugin")', 'id');
    } else if (m.id !== mapNaam) {
      fout('manifest.id', `"id" ("${m.id}") moet gelijk zijn aan de mapnaam ("${mapNaam}")`, 'id');
    } else if (/^vexel(-|$)/.test(m.id)) {
      fout('naam.vexel', 'het id mag niet met "vexel" beginnen: een plugin mag niet officieel lijken', 'id');
    }
  }
  if ('naam' in m) {
    tekstVeld(m.naam, 'naam', 2, 40);
    if (isTekst(m.naam) && /^vexel(?![\p{L}\p{N}])/iu.test(m.naam.trim())) {
      fout('naam.vexel', 'de naam mag niet met "Vexel" beginnen: een plugin mag niet officieel lijken', 'naam');
    }
  }
  if ('beschrijving' in m) {
    tekstVeld(m.beschrijving, 'beschrijving', 10, 140);
    if (isTekst(m.beschrijving)) {
      const b = m.beschrijving.trim();
      if (!/[.!?]$/.test(b) || /[.!?]\s+\S/.test(b)) {
        fout('manifest.veld', '"beschrijving" moet precies één zin zijn, met een punt aan het eind', 'beschrijving');
      }
    }
  }
  if ('auteur' in m) {
    if (!isObject(m.auteur)) fout('manifest.veld', '"auteur" moet een object zijn: { "naam": "...", "github": "..." }', 'auteur');
    else {
      extra(m.auteur, ['naam', 'github'], 'auteur.');
      if (!('naam' in m.auteur)) fout('manifest.ontbreekt', 'verplicht veld "auteur.naam" ontbreekt', 'auteur');
      else tekstVeld(m.auteur.naam, 'auteur.naam', 1, 60);
      if ('github' in m.auteur && (!isTekst(m.auteur.github) || !GITHUB_PATROON.test(m.auteur.github))) {
        fout('manifest.veld', '"auteur.github" moet een GitHub-gebruikersnaam zijn (letters, cijfers, streepjes, hooguit 39)', 'github');
      }
    }
  }
  if ('licentie' in m && !LICENTIES.includes(m.licentie)) {
    fout('licentie', `licentie "${m.licentie}" is niet toegestaan; kies uit: ${LICENTIES.join(', ')}`, 'licentie');
  }
  if ('categorie' in m && !CATEGORIEEN.includes(m.categorie)) {
    fout('manifest.veld', `categorie "${m.categorie}" bestaat niet; kies uit: ${CATEGORIEEN.join(', ')}`, 'categorie');
  }
  if ('rechten' in m) {
    if (!Array.isArray(m.rechten)) fout('manifest.veld', '"rechten" moet een lijst zijn (mag leeg)', 'rechten');
    else {
      for (const r of m.rechten) {
        if (!RECHTEN.includes(r)) fout('manifest.veld', `onbekend recht "${r}"; mogelijk: ${RECHTEN.join(', ')}`, 'rechten');
      }
      if (new Set(m.rechten).size !== m.rechten.length) fout('manifest.veld', 'een recht staat dubbel in "rechten"', 'rechten');
    }
  }
  if ('commandos' in m) {
    if (!Array.isArray(m.commandos) || m.commandos.length < 1 || m.commandos.length > 10) {
      fout('manifest.veld', '"commandos" moet een lijst van 1 tot 10 commando\'s zijn', 'commandos');
    } else {
      const ids = new Set();
      m.commandos.forEach((c, i) => {
        const w = `commandos[${i}]`;
        if (!isObject(c)) return fout('manifest.veld', `${w} moet een object zijn`, 'commandos');
        extra(c, ['id', 'titel', 'venster'], `${w}.`);
        if (!isTekst(c.id) || !ID_PATROON.test(c.id) || c.id.length < 2 || c.id.length > 40) {
          fout('manifest.veld', `${w}.id moet 2 tot 40 tekens zijn: kleine letters, cijfers en losse streepjes`, 'commandos');
        } else if (ids.has(c.id)) {
          fout('manifest.veld', `commando-id "${c.id}" staat dubbel`, 'commandos');
        } else ids.add(c.id);
        if (!('titel' in c)) fout('manifest.ontbreekt', `${w}.titel ontbreekt`, 'commandos');
        else {
          tekstVeld(c.titel, `${w}.titel`, 2, 40);
          if (isTekst(c.titel)) {
            if (c.venster !== undefined && !c.titel.endsWith('…')) {
              fout('manifest.veld', `${w}.titel opent een venster en moet dus eindigen op "…" (één teken, geen drie punten)`, 'titel');
            }
            if (c.venster === undefined && (c.titel.endsWith('…') || c.titel.endsWith('...'))) {
              fout('manifest.veld', `${w}.titel eindigt op "…", maar dit commando opent geen venster`, 'titel');
            }
          }
        }
        if (c.venster !== undefined) {
          const v = c.venster;
          if (!isObject(v)) fout('manifest.veld', `${w}.venster moet een object zijn: { "breedte": ..., "hoogte": ... }`, 'venster');
          else {
            extra(v, ['breedte', 'hoogte'], `${w}.venster.`);
            if (!Number.isInteger(v.breedte) || v.breedte < 200 || v.breedte > 800) {
              fout('manifest.veld', `${w}.venster.breedte moet een heel getal van 200 tot 800 zijn`, 'breedte');
            }
            if (!Number.isInteger(v.hoogte) || v.hoogte < 120 || v.hoogte > 800) {
              fout('manifest.veld', `${w}.venster.hoogte moet een heel getal van 120 tot 800 zijn`, 'hoogte');
            }
          }
        }
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Code: een eenvoudige lexer die tekst, template-literals, reguliere expressies
// en commentaar wegpoetst, zodat alleen echte code overblijft.

const REGEX_NA_WOORD = new Set([
  'return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw',
  'case', 'do', 'else', 'yield', 'await',
]);

/**
 * Geeft de code terug met dezelfde lengte en regels, waarin de inhoud van
 * strings, templates en reguliere expressies door spaties is vervangen
 * (de aanhalingstekens blijven staan) en commentaar helemaal leeg is.
 * Code binnen ${...} in een template blijft wel staan.
 * `twijfelAlsRegex`: wat te doen met een "/" na ")", "]" of "}" (deling of
 * reguliere expressie). De controle draait beide varianten.
 */
export function poetsCode(tekst, { twijfelAlsRegex = false } = {}) {
  const uit = tekst.split('');
  const fouten = [];
  const leeg = (i) => {
    if (uit[i] !== '\n' && uit[i] !== '\r') uit[i] = ' ';
  };
  const n = tekst.length;
  const stapel = []; // per open template: aantal open { in de ${...}-code
  let i = 0;
  let laatste = ''; // laatste betekenisvolle teken in code
  let laatsteWoord = '';

  const isWoordteken = (c) => /[\p{L}\p{N}_$]/u.test(c);

  const leesTemplate = () => {
    // i staat op het teken na de openende ` of na de } die ${...} sluit
    while (i < n) {
      const c = tekst[i];
      if (c === '\\') { leeg(i); if (i + 1 < n) leeg(i + 1); i += 2; continue; }
      if (c === '`') { i++; laatste = '`'; laatsteWoord = ''; return; }
      if (c === '$' && tekst[i + 1] === '{') { i += 2; stapel.push(0); laatste = '{'; laatsteWoord = ''; return; }
      leeg(i);
      i++;
    }
    fouten.push({ index: n - 1, melding: 'template-literal (`) wordt niet afgesloten' });
  };

  while (i < n) {
    const c = tekst[i];
    const d = tekst[i + 1];

    if (c === '/' && d === '/') {
      while (i < n && tekst[i] !== '\n') { leeg(i); i++; }
      continue;
    }
    if (c === '/' && d === '*') {
      const eind = tekst.indexOf('*/', i + 2);
      const stop = eind === -1 ? n : eind + 2;
      if (eind === -1) fouten.push({ index: i, melding: 'commentaar (/*) wordt niet afgesloten' });
      for (; i < stop; i++) leeg(i);
      continue;
    }
    if (c === "'" || c === '"') {
      const begin = i;
      i++;
      let dicht = false;
      while (i < n) {
        const e = tekst[i];
        if (e === '\\') { leeg(i); if (i + 1 < n) leeg(i + 1); i += 2; continue; }
        if (e === c) { dicht = true; i++; break; }
        if (e === '\n') break;
        leeg(i);
        i++;
      }
      if (!dicht) fouten.push({ index: begin, melding: 'tekst tussen aanhalingstekens wordt niet afgesloten op dezelfde regel' });
      laatste = c; laatsteWoord = '';
      continue;
    }
    if (c === '`') {
      i++;
      leesTemplate();
      continue;
    }
    if (c === '{' && stapel.length) { stapel[stapel.length - 1]++; }
    if (c === '}' && stapel.length) {
      if (stapel[stapel.length - 1] === 0) {
        stapel.pop();
        i++;
        leesTemplate();
        continue;
      }
      stapel[stapel.length - 1]--;
    }
    if (c === '/') {
      const twijfel = laatste === ')' || laatste === ']' || laatste === '}';
      const regexMag =
        laatste === '' ||
        /[(,=:[!&|?{;+\-*%<>~^]/.test(laatste) ||
        REGEX_NA_WOORD.has(laatsteWoord) ||
        (twijfel && twijfelAlsRegex);
      if (regexMag && !REGEX_NA_WOORD.has('') ) {
        // zoek het einde op dezelfde regel; lukt dat niet, dan was het een deling
        let j = i + 1;
        let inKlasse = false;
        let eind = -1;
        while (j < n && tekst[j] !== '\n') {
          const e = tekst[j];
          if (e === '\\') { j += 2; continue; }
          if (e === '[') inKlasse = true;
          else if (e === ']') inKlasse = false;
          else if (e === '/' && !inKlasse) { eind = j; break; }
          j++;
        }
        if (eind !== -1 && !(laatsteWoord && !REGEX_NA_WOORD.has(laatsteWoord) && isWoordteken(laatste))) {
          for (let k = i + 1; k < eind; k++) leeg(k);
          i = eind + 1;
          while (i < n && /[a-z]/i.test(tekst[i])) i++; // vlaggen
          laatste = '/'; laatsteWoord = '';
          continue;
        }
      }
    }
    if (!/\s/.test(c)) {
      if (isWoordteken(c)) {
        let j = i;
        while (j < n && isWoordteken(tekst[j])) j++;
        laatsteWoord = tekst.slice(i, j);
        laatste = tekst[j - 1];
        i = j;
        continue;
      }
      laatste = c;
      laatsteWoord = '';
    }
    i++;
  }
  return { code: uit.join(''), fouten };
}

const W = '(?<![\\p{L}\\p{N}_$])';
const E = '(?![\\p{L}\\p{N}_$])';
const woord = (w) => new RegExp(`${W}${w}${E}`, 'gu');

// Verboden overal in de code (ook als eigenschap, zoals x.fetch).
const VERBODEN_OVERAL = [
  ['eval', 'eval voert tekst uit als code'],
  ['Function', 'de Function-constructor voert tekst uit als code'],
  ['importScripts', 'importScripts laadt code van buiten'],
  ['fetch', 'een plugin heeft geen netwerk; gebruik alleen de vexel-API'],
  ['XMLHttpRequest', 'een plugin heeft geen netwerk'],
  ['WebSocket', 'een plugin heeft geen netwerk'],
  ['EventSource', 'een plugin heeft geen netwerk'],
  ['sendBeacon', 'een plugin heeft geen netwerk'],
  ['postMessage', 'een plugin praat alleen via de vexel-API'],
  ['localStorage', 'gebruik vexel.bewaar() en vexel.haal()'],
  ['sessionStorage', 'gebruik vexel.bewaar() en vexel.haal()'],
  ['indexedDB', 'gebruik vexel.bewaar() en vexel.haal()'],
  ['caches', 'geen opslag buiten vexel.bewaar()'],
  ['serviceWorker', 'geen workers'],
  ['Worker', 'geen workers'],
  ['SharedWorker', 'geen workers'],
  ['atob', 'geen gecodeerde (verstopte) code'],
  ['btoa', 'geen gecodeerde (verstopte) code'],
  ['location', 'een plugin navigeert niet'],
  ['cookie', 'geen cookies'],
  ['defaultView', 'geen toegang tot het venster eromheen'],
].map(([w, reden]) => ({ re: woord(w), naam: w, reden }));

// Verboden als losse naam; als eigenschap (el.style.top) of objectsleutel ({ top: 1 }) mag het.
const VERBODEN_LOS = ['top', 'parent', 'frames', 'opener', 'self', 'window', 'globalThis'];

const VERBODEN_PATROON = [
  { re: new RegExp(`${W}import\\s*\\(`, 'gu'), naam: 'import(', reden: 'een plugin laadt geen andere code' },
  { re: new RegExp(`${W}open\\s*\\(`, 'gu'), naam: 'open(', reden: 'een plugin opent geen vensters of adressen' },
  { re: /document\s*(?:\?\.|\.)\s*(?:domain|write|writeln)(?![\p{L}\p{N}_$])/gu, naam: 'document.write/domain', reden: 'niet toegestaan' },
  { re: new RegExp(`${W}(?:webkit)?RTC[A-Z][\\p{L}\\p{N}_$]*`, 'gu'), naam: 'WebRTC', reden: 'een plugin heeft geen netwerk (WebRTC is uitgezet)' },
  {
    re: new RegExp(`${W}set(?:Timeout|Interval)\\s*\\(\\s*['"\`]`, 'gu'),
    naam: 'setTimeout/setInterval met tekst',
    reden: 'geef een functie mee, geen tekst',
  },
];

function controleerGepoetst(code, fout) {
  const meld = (index, naam, reden) => fout('code.verboden', `"${naam}" is niet toegestaan: ${reden}`, regelVan(code, index));

  for (const { re, naam, reden } of [...VERBODEN_OVERAL, ...VERBODEN_PATROON]) {
    re.lastIndex = 0;
    for (const m of code.matchAll(re)) meld(m.index, naam, reden);
  }
  for (const w of VERBODEN_LOS) {
    for (const m of code.matchAll(woord(w))) {
      const voor = code.slice(0, m.index).replace(/\s+$/u, '');
      const na = code.slice(m.index + w.length).replace(/^\s+/u, '');
      if (voor.endsWith('.') && !voor.endsWith('...')) continue; // eigenschap: x.top of x?.top (maar niet ...top)
      if (na.startsWith(':') && /[{,]$/.test(voor)) continue; // objectsleutel: { top: 1 }
      meld(m.index, w, 'een plugin komt niet buiten zijn eigen venster');
    }
  }
  for (const m of code.matchAll(/\\/g)) {
    fout('code.escape', 'een backslash in code (buiten tekst) is niet toegestaan, zoals \\u-escapes in namen', regelVan(code, m.index));
  }
}

/** Controleert de tekst van plugin.js. `fout(code, melding, regel)` krijgt elke fout. */
export function controleerCode(tekst, fout) {
  // 1. Moet een geldig gewoon script zijn (wordt alleen gecompileerd, niet uitgevoerd).
  try {
    new vm.Script(tekst, { filename: 'plugin.js' });
  } catch (e) {
    const m = /plugin\.js:(\d+)/.exec(e.stack || '');
    fout('code.syntaxis', `geen geldig script: ${e.message}`, m ? Number(m[1]) : undefined);
  }

  // 2. Op de ruwe tekst: </script, lange regels.
  for (const m of tekst.matchAll(/<\/script/gi)) {
    fout('code.verboden', '"</script" is niet toegestaan (ook niet in tekst of commentaar)', regelVan(tekst, m.index));
  }
  tekst.split('\n').forEach((r, idx) => {
    const n = lengte(r.replace(/\r$/, ''));
    if (n > GRENZEN.regelLengte) {
      fout('code.regel-te-lang', `regel is ${n} tekens; maximaal ${GRENZEN.regelLengte} (geen geminificeerde code)`, idx + 1);
    }
  });

  // 3. Op de gepoetste code, voor beide lezingen van een twijfelachtige "/".
  const gezien = new Set();
  const uniek = (code, melding, regel) => {
    const sleutel = `${code}|${melding}|${regel}`;
    if (gezien.has(sleutel)) return;
    gezien.add(sleutel);
    fout(code, melding, regel);
  };
  for (const twijfelAlsRegex of [false, true]) {
    const { code, fouten } = poetsCode(tekst, { twijfelAlsRegex });
    if (!twijfelAlsRegex) {
      for (const f of fouten) uniek('code.syntaxis', f.melding, regelVan(tekst, f.index));
    }
    controleerGepoetst(code, uniek);
  }
}

// ---------------------------------------------------------------------------
// Icoon

export function controleerIcoon(tekst, fout) {
  const zonderCommentaar = tekst.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '));
  const regels = [
    [/<script/gi, 'geen <script>'],
    [/\son[a-z]+\s*=/gi, 'geen on…-attributen (zoals onload)'],
    [/<foreignObject/gi, 'geen <foreignObject>'],
    [/<!DOCTYPE/gi, 'geen <!DOCTYPE>'],
    [/<!ENTITY/gi, 'geen <!ENTITY>'],
    [/javascript:/gi, 'geen javascript:'],
    [/&#/g, 'geen genummerde tekens (&#...;)'],
    [/@import/gi, 'geen @import'],
    [/<(?:iframe|embed|object|audio|video)\b/gi, 'geen ingesloten inhoud'],
    [/url\(\s*['"]?(?!#)/gi, 'url(...) mag alleen naar #iets in hetzelfde bestand wijzen'],
    [/(?:xlink:)?href\s*=\s*(?:"(?!#)|'(?!#)|(?!["'#]))/gi, 'href mag alleen naar #iets in hetzelfde bestand wijzen'],
    [/attributeName\s*=\s*["']?(?:xlink:)?href/gi, 'geen animatie van href'],
  ];
  for (const [re, melding] of regels) {
    for (const m of tekst.matchAll(re)) fout('icoon', `onveilig icoon: ${melding}`, regelVan(tekst, m.index));
  }
  const begin = zonderCommentaar.replace(/^\s*(<\?xml[^>]*\?>)?\s*/, '');
  if (!/^<svg[\s>]/.test(begin)) return fout('icoon', 'het icoon moet met <svg beginnen');
  const wortel = /^<svg\b([^>]*)>/.exec(begin);
  const vb = wortel && /\sviewBox\s*=\s*["']([^"']*)["']/.exec(wortel[1]);
  if (!vb) return fout('icoon', 'het <svg>-element heeft geen viewBox');
  const getallen = vb[1].trim().split(/[\s,]+/).map(Number);
  if (getallen.length !== 4 || getallen.some((g) => !Number.isFinite(g))) {
    return fout('icoon', `viewBox "${vb[1]}" is geen vier getallen`);
  }
  if (!(getallen[2] > 0) || getallen[2] !== getallen[3]) {
    fout('icoon', `viewBox moet vierkant zijn (breedte = hoogte), nu ${getallen[2]} × ${getallen[3]}`);
  }
}

// ---------------------------------------------------------------------------
// Eén pluginmap

/**
 * Controleert één pluginmap. Geeft { fouten, manifest, bestanden } terug.
 * `fouten`: [{ code, bestand, regel, melding }]. `bestand` is relatief aan `basis`.
 */
export function valideerPlugin(map, { merken = laadMerken(), basis = ROOT } = {}) {
  const fouten = [];
  const mapNaam = basename(map);
  const rel = (b) => relative(basis, join(map, b)) || b;
  const fout = (bestand, code, melding, regel) => fouten.push({ code, bestand: rel(bestand), regel, melding });

  let st;
  try {
    st = lstatSync(map);
  } catch {
    fout('', 'bestand.ontbreekt', 'map bestaat niet');
    return { fouten };
  }
  if (!st.isDirectory()) {
    fout('', 'bestand.onbekend', 'hier hoort alleen een map per plugin');
    return { fouten };
  }

  // Bestanden in de map
  const bestanden = {};
  let totaal = 0;
  for (const naam of readdirSync(map)) {
    if (GENEGEERD.has(naam)) continue;
    const s = lstatSync(join(map, naam));
    if (s.isSymbolicLink()) { fout(naam, 'bestand.onbekend', 'symbolische koppelingen zijn niet toegestaan'); continue; }
    if (s.isDirectory()) { fout(naam, 'bestand.onbekend', 'submappen zijn niet toegestaan'); continue; }
    if (!TOEGESTANE_BESTANDEN.includes(naam)) {
      fout(naam, 'bestand.onbekend', `onbekend bestand; toegestaan: ${TOEGESTANE_BESTANDEN.join(', ')}`);
      continue;
    }
    bestanden[naam] = readFileSync(join(map, naam));
    totaal += s.size;
  }
  for (const naam of ['plugin.json', 'plugin.js', 'icoon.svg', 'README.md']) {
    if (!bestanden[naam]) fout(naam, 'bestand.ontbreekt', 'verplicht bestand ontbreekt');
  }
  if (totaal > GRENZEN.totaal) {
    fout('', 'grootte', `de plugin is samen ${(totaal / KB).toFixed(1)} KB; maximaal ${GRENZEN.totaal / KB} KB`);
  }
  if (bestanden['plugin.js'] && bestanden['plugin.js'].length > GRENZEN.pluginJs) {
    fout('plugin.js', 'grootte', `${(bestanden['plugin.js'].length / KB).toFixed(1)} KB; maximaal ${GRENZEN.pluginJs / KB} KB`);
  }
  if (bestanden['icoon.svg'] && bestanden['icoon.svg'].length > GRENZEN.icoon) {
    fout('icoon.svg', 'grootte', `${(bestanden['icoon.svg'].length / KB).toFixed(1)} KB; maximaal ${GRENZEN.icoon / KB} KB`);
  }

  // Tekst, onzichtbare tekens, merknamen
  const teksten = {};
  for (const [naam, buf] of Object.entries(bestanden)) {
    const t = leesUtf8(buf);
    if (t === null) { fout(naam, 'utf8', 'geen geldige UTF-8-tekst'); continue; }
    if (t.charCodeAt(0) === 0xfeff) fout(naam, 'onzichtbaar-teken', 'het bestand begint met een BOM; sla op als UTF-8 zonder BOM', 1);
    for (const m of t.matchAll(ONZICHTBAAR_G)) {
      if (m.index === 0 && m[0] === '\uFEFF') continue;
      fout(naam, 'onzichtbaar-teken', `onzichtbaar of bidi-stuurteken ${tekenNaam(m[0])} (Trojan Source); haal het weg`, regelVan(t, m.index));
    }
    teksten[naam] = t;
    if (naam !== 'LICENSE') {
      for (const m of vindMerken(t, merken)) {
        fout(naam, 'merknaam', `"${m.woord}" is een merknaam van een ander; die mag niet in een plugin staan`, regelVan(t, m.index));
      }
    }
  }

  // Manifest
  let manifest;
  if (teksten['plugin.json'] !== undefined) {
    const tekst = teksten['plugin.json'];
    const regelVanVeld = (veld) => {
      if (!veld) return undefined;
      const idx = tekst.indexOf(`"${veld}"`);
      return idx === -1 ? undefined : regelVan(tekst, idx);
    };
    try {
      manifest = JSON.parse(tekst);
    } catch (e) {
      fout('plugin.json', 'manifest.json', `geen geldige JSON: ${e.message}`);
    }
    if (manifest !== undefined) {
      const voor = fouten.length;
      valideerManifest(manifest, mapNaam, (code, melding, veld) => fout('plugin.json', code, melding, regelVanVeld(veld)));
      if (fouten.length !== voor) manifest = manifest && typeof manifest === 'object' ? manifest : undefined;
      if (manifest && manifest.licentie && manifest.licentie !== 'MIT' && LICENTIES.includes(manifest.licentie) && !bestanden.LICENSE) {
        fout('LICENSE', 'licentie.ontbreekt', `licentie is ${manifest.licentie}: voeg de licentietekst toe als LICENSE`);
      }
    }
  }

  // Code en icoon
  if (teksten['plugin.js'] !== undefined) {
    controleerCode(teksten['plugin.js'], (code, melding, regel) => fout('plugin.js', code, melding, regel));
  }
  if (teksten['icoon.svg'] !== undefined) {
    controleerIcoon(teksten['icoon.svg'], (code, melding, regel) => fout('icoon.svg', code, melding, regel));
  }

  return { fouten, manifest, bestanden };
}

// ---------------------------------------------------------------------------
// ingetrokken.json

export function valideerIngetrokken(pad = join(ROOT, 'ingetrokken.json')) {
  const fouten = [];
  const fout = (melding) => fouten.push({ code: 'ingetrokken', bestand: 'ingetrokken.json', melding });
  if (!existsSync(pad)) return { fouten, lijst: [] };
  let lijst;
  try {
    lijst = JSON.parse(readFileSync(pad, 'utf8'));
  } catch (e) {
    fout(`geen geldige JSON: ${e.message}`);
    return { fouten, lijst: [] };
  }
  if (!Array.isArray(lijst)) {
    fout('moet een lijst zijn: [{ "id": "...", "reden": "..." }]');
    return { fouten, lijst: [] };
  }
  lijst.forEach((x, i) => {
    if (!x || typeof x !== 'object' || Array.isArray(x)) return fout(`item ${i} moet een object zijn`);
    for (const k of Object.keys(x)) if (k !== 'id' && k !== 'reden') fout(`item ${i}: onbekend veld "${k}"`);
    if (typeof x.id !== 'string' || !ID_PATROON.test(x.id)) fout(`item ${i}: ongeldig id`);
    if (typeof x.reden !== 'string' || lengte(x.reden.trim()) < 3 || lengte(x.reden) > 200) {
      fout(`item ${i}: "reden" moet 3 tot 200 tekens zijn`);
    }
  });
  return { fouten, lijst: fouten.length ? [] : lijst.map((x) => ({ id: x.id, reden: x.reden })) };
}

// ---------------------------------------------------------------------------
// Alles

export function valideerAlles(root = ROOT) {
  const merken = laadMerken();
  const pluginsMap = join(root, 'plugins');
  const fouten = [];
  const plugins = [];
  if (existsSync(pluginsMap)) {
    for (const naam of readdirSync(pluginsMap).sort()) {
      if (GENEGEERD.has(naam)) continue;
      const map = join(pluginsMap, naam);
      const r = valideerPlugin(map, { merken, basis: root });
      fouten.push(...r.fouten);
      if (!r.fouten.length) plugins.push({ id: naam, map, manifest: r.manifest, bestanden: r.bestanden });
    }
  }
  const ing = valideerIngetrokken(join(root, 'ingetrokken.json'));
  fouten.push(...ing.fouten);
  return { fouten, plugins, ingetrokken: ing.lijst };
}

export function toonFouten(fouten) {
  const gh = process.env.GITHUB_ACTIONS === 'true';
  for (const f of fouten) {
    const plek = f.bestand + (f.regel ? `:${f.regel}` : '');
    console.error(`${plek}: ${f.melding}  [${f.code}]`);
    if (gh) {
      const esc = (s) => String(s).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
      console.error(`::error file=${esc(f.bestand)}${f.regel ? `,line=${f.regel}` : ''}::${esc(f.melding)}`);
    }
  }
}

function hoofd() {
  const args = process.argv.slice(2);
  if (args.length) {
    const merken = laadMerken();
    let fouten = [];
    for (const a of args) fouten.push(...valideerPlugin(resolve(a), { merken, basis: process.cwd() }).fouten);
    toonFouten(fouten);
    if (fouten.length) {
      console.error(`\n${fouten.length} fout${fouten.length === 1 ? '' : 'en'} gevonden.`);
      process.exit(1);
    }
    console.log('In orde.');
    return;
  }
  const { fouten, plugins } = valideerAlles();
  toonFouten(fouten);
  if (fouten.length) {
    console.error(`\n${fouten.length} fout${fouten.length === 1 ? '' : 'en'} gevonden.`);
    process.exit(1);
  }
  console.log(`In orde: ${plugins.length} plugin${plugins.length === 1 ? '' : 's'} (${plugins.map((p) => p.id).join(', ')}).`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) hoofd();
