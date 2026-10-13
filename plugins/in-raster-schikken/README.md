# In raster schikken

Zet de geselecteerde objecten netjes in kolommen en rijen, elk in een cel van
dezelfde maat en daarin uitgelijnd. Handig voor een overzicht van logo's,
productfoto's, iconen, stalen of etiketten die nu kriskras op het tekengebied
staan.

## Gebruik

1. Selecteer de objecten (minstens twee).
2. Kies **Plugins › In raster schikken…**.
3. Kies het aantal **kolommen**. Laat je 0 staan, dan kiest de plugin zelf een
   aantal waarmee het raster ongeveer vierkant wordt.
4. Stel de **tussenruimte** tussen de kolommen en tussen de rijen in (in mm).
5. Kies hoe elk object in zijn cel komt te staan: **midden**, **linksboven**,
   **onder**, enzovoort.
6. Kies de **volgorde**:
   - **Zoals ze staan**: rij voor rij, van links naar rechts, zoals je leest.
   - **Volgorde van selecteren**.
   - **Op grootte**: groot eerst of klein eerst.
   - **Op kleur**: rond de kleurcirkel, daarna de grijzen van licht naar donker.
7. Kies de **celmaat**: zo groot als het grootste object, of een vaste maat in mm.
8. Zet desgewenst **Even groot maken** aan: dan wordt elk object (met behoud van
   verhouding) zo geschaald dat het precies in de cel past.
9. Het voorbeeld laat de cellen gestippeld zien en waar elk object komt, met de
   volgorde in cijfers. Klik **Schikken**.

Het raster begint linksboven in de huidige selectie. Alles samen is één stap:
één keer ongedaan maken zet alles terug. Je laatste instellingen worden
onthouden.

## Tips

- De plugin rekent met de omtrek van de vormen zelf, zonder lijndikte. Een dikke
  lijn steekt dus een halve lijndikte buiten de cel; maak de tussenruimte iets
  groter als dat uitmaakt.
- Bij **Even groot maken** schalen lijndiktes niet mee.
- Een groep telt als één object. Maak een groep eerst los als je de delen apart
  wilt schikken.
- Zie je "groter dan de cel" in de samenvatting, kies dan een grotere vaste maat
  of zet **Even groot maken** aan.

## Rechten

- **Selectie lezen** (`selectie.lezen`): om te zien welke objecten je hebt
  geselecteerd, hoe groot ze zijn en welke kleur ze hebben (voor de volgorde op
  kleur).
- **Document wijzigen** (`document.schrijven`): om die objecten te verplaatsen en
  eventueel te schalen. Er wordt niets nieuws getekend en niets weggehaald.

## Licentie

MIT, eigen werk van GuusLab.
