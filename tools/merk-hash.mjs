// De hash van een merknaam voor tools/merken.json (zodat de repo de naam zelf niet noemt).
//   node tools/merk-hash.mjs "Naam van het merk"
import { merkHashes } from './valideer.mjs';

const naam = process.argv.slice(2).join(' ').trim();
if (!naam) {
  console.error('Gebruik: node tools/merk-hash.mjs "Naam van het merk"');
  process.exit(1);
}
for (const h of merkHashes(naam)) console.log(h);
