# Sudoku

Maakt echte sudoku's met precies één oplossing, in vier niveaus, als klassiek
9 × 9-raster of als 6 × 6 voor kinderen. Ze komen netjes verdeeld op het vel,
klaar om te drukken: voor een puzzelblad, een clubblad, een schoolkrant of een
werkblad.

## Gebruik

1. Kies **Plugins › Sudoku…**.
2. Kies het **Raster** (*9 × 9* of *6 × 6*) en de **Moeilijkheid**.
3. Kies het **Aantal puzzels** (1 tot 12). De plugin rekent zelf uit hoe ze het
   grootst op het tekengebied passen, binnen de **Marge**.
4. Kies waar de **Oplossing** komt:
   - *Verborgen in het raster*: de ontbrekende cijfers staan in blauw precies in
     de lege vakjes, in de groep *Oplossingen (verborgen)*. Zet die groep in het
     lagenpaneel aan om het antwoordblad te drukken, en weer uit voor het
     puzzelblad.
   - *Klein onderaan het vel*: kleine oplossingen in een strook onder een
     stippellijn.
   - *Op een apart vlak naast het vel*: een tweede blad met dezelfde indeling,
     rechts naast het tekengebied, met de gegeven cijfers zwart en de rest
     blauw. Zet het op een eigen tekengebied of pagina.
5. Geef eventueel een **Titel** en zet *Nummer en niveau boven elk raster* aan
   of uit.
6. Kijk naar het voorbeeld en klik **Sudoku's maken**.

Elke puzzel is een groep (*Sudoku 1 · moeilijk*) met het raster (dunne lijnen,
dikke lijnen en rand als aparte paden) en de gegeven cijfers als losse
tekstjes. Je laatste instellingen worden onthouden.

## De niveaus

Elke puzzel wordt gecontroleerd: er is precies één oplossing. Het niveau zegt
welke denkstappen je nodig hebt:

| niveau | wat je nodig hebt (9 × 9) | gegeven cijfers |
|---|---|---|
| Makkelijk | alleen kijken waar een cijfer in een rij, kolom of blok nog kan | ongeveer 36 |
| Gemiddeld | ook: welk cijfer past in dit vakje nog? | ongeveer 28–31 |
| Moeilijk | ook: paren en cijfers die in een blok op één lijn vastliggen | ongeveer 25–32 |
| Heel moeilijk | meer dan dat (vooruitdenken) | zo weinig mogelijk, vaak 23–29 |

Bij 6 × 6 is bijna elke puzzel met de eerste stap op te lossen; daar bepaalt
het aantal gegeven cijfers het niveau (20, 16, 14 of zo weinig mogelijk).

## Tips

- **Zaadje.** Hetzelfde zaadje geeft dezelfde puzzels; met **Andere** krijg je
  een nieuwe reeks. Boven elk raster staat een code als *#2026-3* (zaadje en
  nummer), zodat je een puzzel later terugvindt.
- Heel moeilijk maken duurt even (een fractie van een seconde per puzzel); het
  voorbeeld vult zich vanzelf.
- In een CMYK-document zijn de lijnen en cijfers 100% zwart en de oplossing
  CMYK-blauw; in RGB worden het RGB-kleuren.

## Rechten

- **Document wijzigen** (`document.schrijven`): om de rasters, cijfers en
  oplossingen te tekenen.

Sudoku leest je selectie niet en bewaart alleen zijn eigen instellingen.

## Licentie

MIT, eigen werk van GuusLab.
