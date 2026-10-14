# Isometrische blokken

Bouw isometrische blokken, balken, trappen, torens en cilinders door simpelweg
hoogtes in een raster te typen. Elk blok krijgt drie vlakken in een lichte,
middel en donkere tint van één kleur, zodat het meteen ruimtelijk oogt. Met het
hulpraster teken je er zelf verder op door.

## Gebruik

### Blokken

1. Kies **Plugins › Isometrische blokken › Blokken maken…**.
2. Kies een **voorbeeld** (kubus, balk, trap, piramide, muur met toren of een
   willekeurige stad), of typ zelf de **hoogtes**: één regel per rij, een
   getal per vak, gescheiden door spaties. `0` of `.` is een leeg vak, en
   `2,5` mag ook. Bijvoorbeeld:

   ```
   1 2 3 4
   1 2 3 4
   ```

   is een trap van vier treden, twee vakken diep.
3. Kies de **vorm**: massieve blokken, losse kubussen (met een lijn tussen
   elke kubus als je randen aanzet) of cilinders.
4. Stel de **ribbe** in (de maat van één blok in millimeter) en de **hoogte
   per stap** (100 % is een kubus, 50 % een platte tegel).
5. Kies de **kleur**, van welke kant het **licht** komt en of je randen wilt.
6. Klik **Blokken maken**.

Alles komt als één groep midden op het tekengebied, met per vak een groep
("Vak 2,3") met de vlakken "Boven", "Links" en "Rechts". Vlakken die door
een buurblok verborgen zijn, worden niet getekend.

### Hulpraster

1. Kies **Plugins › Isometrische blokken › Isometrisch hulpraster…**.
2. Kies **lijnen** (30°, 150° en verticaal) of **stippen** op de snijpunten,
   de **ribbe**, de kleur, de lijndikte en de dekking.
3. Klik **Raster maken**. Het raster komt achteraan over het hele
   tekengebied, als groep "Isometrisch hulpraster".

## Tips

- Gebruik voor het hulpraster dezelfde ribbe als voor je blokken: de hoeken
  van de blokken vallen dan precies op het raster, en je kunt er met de hand
  verder op tekenen.
- Kies bij **Stad** steeds **Andere stad** tot je een mooie skyline hebt, en
  pas daarna een paar getallen aan.
- Wil je meerdere kleuren, maak dan meerdere keren blokken en schuif ze over
  het raster.

## Rechten

- **Document wijzigen** (`document.schrijven`): om de blokken en het raster te
  tekenen.

Isometrische blokken leest je selectie niet en bewaart alleen zijn eigen
instellingen.

## Licentie

MIT, eigen werk van GuusLab.
