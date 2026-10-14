// De hash van een merknaam voor tools/merken.json (zodat de repo de naam zelf niet noemt).
//   node tools/merk-hash.mjs "Naam van het merk"            toont de hash(es)
//   node tools/merk-hash.mjs --voeg-toe "Naam" "Andere naam"  zet ze meteen in merken.json
// Bij --voeg-toe is elk argument één naam; zonder --voeg-toe vormen alle argumenten samen één naam.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { merkHashes } from './valideer.mjs';

const args = process.argv.slice(2);
const voegToe = args[0] === '--voeg-toe';
const namen = voegToe ? args.slice(1).map((a) => a.trim()).filter(Boolean) : [args.join(' ').trim()].filter(Boolean);
if (!namen.length) {
  console.error('Gebruik: node tools/merk-hash.mjs "Naam van het merk"');
  console.error('     of: node tools/merk-hash.mjs --voeg-toe "Naam" "Andere naam" …');
  process.exit(1);
}

if (!voegToe) {
  for (const h of merkHashes(namen[0])) console.log(h);
} else {
  const pad = join(dirname(fileURLToPath(import.meta.url)), 'merken.json');
  const data = JSON.parse(readFileSync(pad, 'utf8'));
  const voor = new Set(data.hashes);
  const alles = new Set(voor);
  for (const n of namen) for (const h of merkHashes(n)) alles.add(h);
  data.hashes = [...alles].sort();
  writeFileSync(pad, JSON.stringify(data, null, 2) + '\n');
  // de namen zelf worden nergens geschreven of getoond
  console.log(`${namen.length} naam/namen verwerkt: ${alles.size - voor.size} nieuwe hash(es), ${alles.size} in totaal.`);
}
