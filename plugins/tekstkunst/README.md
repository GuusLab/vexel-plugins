# Tekstkunst

Maak van een foto een raster van letters of tekens: je eigen tekst die
steeds herhaald wordt, of een tekenset waarin zware tekens de donkere
delen vormen. Als echte tekst in Vexel, dus scherp op elk formaat en
later nog te bewerken; mooi voor een affiche, een omslag of een
naamportret.

## Gebruik

1. Selecteer een foto (Bestand › Plaatsen).
2. Kies **Plugins › Tekstkunst…**. Links zie je meteen de voorvertoning;
   houd **Voor/na** ingedrukt (of de toets O) om de foto te zien, en zet de
   **Loep** aan om een stuk vergroot te bekijken.
3. Kies bij **Tekens** een **tekenset op dichtheid** (bijvoorbeeld
   ` . : - = + * # % @`) of **eigen tekst, herhaald** en typ je tekst.
4. Stel het aantal **kolommen** in. De regelhoogte volgt vanzelf, zodat de
   letters een strak raster vormen.
5. Kies bij **Maken als**:
   - **Losse letters**: elk teken is een eigen tekstobject, precies in het
     midden van zijn vak. Grootte en gewicht kunnen de **helderheid** volgen
     (donker = groter en vetter), en de kleur kan **per letter uit de foto**
     komen.
   - **Compact**: één tekstobject per regel, in één kleur. Licht en makkelijk
     te bewerken.
6. Kies de kleur, eventueel een **donker vlak eronder** met lichte letters,
   en stel helderheid en contrast bij. **Automatisch contrast** rekt de toon
   op tot de volle omvang, zodat ook een flauwe foto goed uitkomt.
7. Klik **Tekstkunst maken**.

Het resultaat is één groep **Tekstkunst** precies over de foto, met per
regel een groep (of tekstobject) **Regel 1**, **Regel 2**, … en onderin een
onzichtbaar **Kader** (of het **Achtergrond**-vlak) zo groot als de foto.
Lege vakken en doorzichtige delen van de foto krijgen geen teken. In een
CMYK-document krijgen de letters CMYK-kleuren, anders RGB. Heb je meer
foto's geselecteerd, dan krijgt elke foto zijn eigen tekstkunst.

## Tips

- Losse letters: tot ongeveer 4800 letters maakt de plugin in één keer. Bij
  meer zegt het venster hoeveel kolommen wel in één keer passen; anders komt
  het in een paar groepen (en is het ook een paar keer ongedaan maken).
- Met eigen tekst in één kleur zie je de foto alleen als grootte of gewicht
  de helderheid volgt; het venster waarschuwt je daarvoor.
- Compact: de letter heeft geen vaste breedte, dus de plugin kiest per regel
  de letterafstand zo dat de regel de breedte van de foto vult. De tekens
  staan daardoor niet precies onder elkaar; wil je een strak raster, kies dan
  losse letters.
- De voorvertoning gebruikt de letter van je systeem als die van Vexel er
  niet is; in Vexel kunnen de letters daardoor net iets anders vallen.
- Een kleine foto met weinig kolommen (30 tot 50) geeft grote, goed
  leesbare tekens; voor een fijn portret ga je naar 80 tot 120 kolommen.
- Wit op zwart: zet **Donker vlak eronder** aan en kies **Eén kleur** met
  **Wit**.

## Rechten

- **Selectie lezen** (`selectie.lezen`): om de geselecteerde foto en zijn
  plek te vinden.
- **Pixels lezen** (`beeld.lezen`): om de helderheid en de kleuren van de
  foto te lezen.
- **Document wijzigen** (`document.schrijven`): om de letters te plaatsen.

Tekstkunst verandert de foto zelf niet en bewaart alleen zijn eigen
instellingen.

## Licentie

MIT, eigen werk van GuusLab.
