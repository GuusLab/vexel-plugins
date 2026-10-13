# Tabel

Maak van geplakte tekst in één keer een verzorgde tabel: kopregel vet,
zebrastrepen, nette randen en getallen rechts uitgelijnd. Handig voor prijslijsten,
dienstregelingen, specificaties en uitslagen in drukwerk.

## Gebruik

1. Kies **Plugins › Tabel…**.
2. Plak of typ je gegevens: één rij per regel, met de cellen gescheiden door een
   tab, een puntkomma of een komma. De plugin herkent de scheiding zelf (in die
   volgorde, zodat `12,50` met een puntkomma ertussen gewoon één getal blijft).
   Kopieer je cellen uit een rekenblad, dan zijn het tabs en werkt het meteen.
3. Kies of de eerste regel de kop is, of je zebrastrepen wilt en welke randen:
   geen, horizontaal of een volledig raster.
4. Stel de totale breedte (mm), de lettergrootte (pt) en de celmarge (mm) in.
   Kolommen worden verdeeld op tekstlengte of allemaal even breed.
5. Per kolom kun je de uitlijning kiezen. Op **Auto** gaan kolommen met alleen
   getallen (ook `1.234,5`, `€ 12,50` of `15%`) naar rechts.
6. Het voorbeeld en de maat onderin lopen mee. Klik **Tabel maken**.

De tabel komt bovenaan het tekengebied, horizontaal in het midden, als één groep
**Tabel** met daarin de groep **Kopregel**, een groep per rij (**Rij 1**,
**Rij 2**, …) en de groep **Randen**. Elke cel is een eigen tekstobject, genoemd
naar zijn kolom en inhoud. Eén keer ongedaan maken haalt de hele tabel weg.

## Tips

- Te lange tekst in een cel loopt vanzelf door op een volgende regel; de rij wordt
  dan hoger.
- Een cel met een scheidingsteken erin zet je tussen dubbele aanhalingstekens:
  `"Folder, A5"`.
- In een CMYK-document gebruikt de tabel CMYK-kleuren (tekst 100% zwart,
  zebrastrepen 7% zwart), anders RGB.
- Je laatste instellingen en gegevens worden onthouden.
- Het afbreken gaat op een schatting van de letterbreedte. Controleer dus even of
  alles netjes past, en maak de tabel desnoods iets breder.

## Rechten

- **Document wijzigen** (`document.schrijven`): om de tabel te tekenen.

Tabel leest je selectie niet en bewaart alleen zijn eigen instellingen.

## Licentie

MIT, eigen werk van GuusLab.
