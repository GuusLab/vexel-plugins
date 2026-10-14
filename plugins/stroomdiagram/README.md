# Stroomdiagram

Schrijf een proces op als gewone tekst met pijlen, en krijg een net
stroomschema: afgeronde vormen voor begin en einde, rechthoeken voor stappen,
ruiten voor keuzes, haakse pijlen met labels en een automatische indeling van
boven naar beneden. Voor een werkinstructie, een procesbeschrijving, een
presentatie of een poster.

## Gebruik

1. Kies **Plugins › Stroomdiagram…**.
2. Typ de stappen. Elke regel is een keten met `->` ertussen:

   ```
   Start -> Bestelling ontvangen -> Op voorraad? -> ja: Inpakken; nee: Bijbestellen
   Bijbestellen -> Inpakken
   Inpakken -> Verzenden -> Einde
   ```

   - Een naam die eindigt op `?` wordt een **keuze** (ruit).
   - Takken schrijf je als `ja: X; nee: Y`. Het woord voor de dubbele punt
     komt als label bij de pijl. Ook een gewone pijl kan een label krijgen:
     `Controle -> goed: Verzenden`.
   - **Dezelfde naam is dezelfde stap**: zo voeg je takken weer samen, of maak
     je een lus terug naar een eerdere stap.
   - `Start`, `Begin`, `Einde`, `Eind`, `Klaar` en `Stop` worden vanzelf rond.
     Wil je een andere vorm, zet de naam dan tussen haakjes: `(rond)`,
     `[stap]`, `<keuze>` of `/invoer of uitvoer/` (een parallellogram).
   - Tekst na `#` op een regel is commentaar.
3. Kies de **stijl** (lichte tint, gevuld of omlijnd), de **kleuren**, ronde of
   rechte **hoeken**, de lettergrootte, de maximale vakbreedte en de
   lijndikte.
4. Klik **Stroomdiagram maken**.

Het diagram komt midden op het tekengebied als groep **Stroomdiagram**, met
daarin **Pijlen** (per pijl een groep met de lijn, de pijlpunt en het label)
en **Vormen** (per stap een groep met de vorm en de tekst, bijvoorbeeld
"Keuze · Op voorraad?"). In een CMYK-document is alles CMYK, anders RGB. Je
laatste invoer en instellingen worden onthouden.

## Hoe de indeling werkt

- Elke stap komt een rij lager dan de stap ervoor; samenkomende takken komen
  onder de langste tak.
- De eerste tak van een keuze gaat recht omlaag, de volgende takken gaan
  rechts uit de ruit en schuiven een kolom op.
- Een pijl die terug omhoog gaat (een lus), loopt via een baan aan de
  buitenkant, zodat hij geen vormen kruist.

## Tips

- Zet de belangrijkste route steeds als eerste tak: die blijft dan in één
  rechte lijn.
- Lange namen worden afgebroken op de maximale vakbreedte. De tekstbreedte is
  een schatting; de vormen krijgen daarom wat extra ruimte.
- Is het diagram groter dan het tekengebied, dan wordt het verkleind en zegt
  de samenvatting dat.
- Een naam met een dubbele punt (zoals `Stap 1: inpakken`) leest de plugin als
  label plus naam; laat de dubbele punt dan weg.

## Rechten

- **Document wijzigen** (`document.schrijven`): om het diagram te tekenen.

Stroomdiagram leest je selectie niet en bewaart alleen zijn eigen
instellingen.

## Licentie

MIT, eigen werk van GuusLab.
