# Lijngravure

Maak van een foto een gravure zoals op een bankbiljet of een oude houtsnede:
rechte of golvende lijnen, cirkels of een spiraal, die dikker worden waar de
foto donker is. Elke lijn is een gevulde vorm, dus het resultaat is scherp op
elk formaat en drukt in één kleur, zonder rasters of lijndikte-trucs.

## Gebruik

1. Plaats een foto (**Bestand › Plaatsen**) en selecteer hem.
2. Kies **Plugins › Lijngravure…**. Links zie je meteen een grote
   voorvertoning; houd **Voor/na** ingedrukt (of de toets O) om de foto te
   zien, en zet de **Loep** aan (toets L) om de lijnen van dichtbij te bekijken.
3. Kies de **soort**: rechte lijnen of golvende lijnen (met een **hoek**,
   **golfhoogte** en **golflengte**), of cirkels en een spiraal (met het
   **midden** in procenten van de foto, standaard het midden).
4. Stel de **lijnafstand** in millimeter in. Met **Reliëf** buigen de lijnen
   mee met de donkerte, zodat de foto een beetje boven het papier lijkt uit
   te komen.
5. Bij **Dikte** stel je de **dikste lijn** in (in procenten van de
   lijnafstand) en de **dunste lijn** in millimeter. Dunner dan dat wordt de
   lijn onderbroken met een spitse punt, zoals bij een echte gravure; zet
   **Doorlopende lijnen** aan om ze nooit te onderbreken.
6. Kies een **kleur**, en pas eventueel **helderheid** en **contrast** aan.
   **Omkeren** maakt een negatief; met **Witte lijnen op een vlak in de kleur**
   komt er een vlak in de gekozen kleur onder, met witte lijnen erop.
7. Klik **Gravure maken**.

De gravure komt als één groep precies over de foto, met de naam van de soort
en de lijnafstand. Daarin staat een onzichtbaar **Kader** zo groot als de
foto (of het gekleurde vlak) en de lijnen als samengestelde paden. Wat buiten
de foto zou steken, wordt netjes afgeknipt. Doorzichtige delen van een foto
krijgen geen inkt. Onder de knoppen staat hoeveel lijnen, vormen en
ankerpunten het worden; is het te veel voor één keer, dan zegt het venster
welke lijnafstand wel past.

Zijn er meer foto's geselecteerd, dan krijgen ze allemaal een gravure met
dezelfde instellingen; de voorvertoning toont de eerste.

In een CMYK-document krijgen de lijnen een CMYK-kleur, anders RGB.

## Tips

- Zet de foto daarna uit in het lagenpaneel of verplaats de gravure: de
  plugin laat de foto staan.
- Een lijnafstand van 0,8 tot 1,5 mm geeft veel detail; 2 tot 4 mm is grafisch
  en stoer, mooi voor een affiche.
- Een rustige golf (golfhoogte 1 mm, golflengte 20 tot 40 mm) met wat reliëf
  geeft het bekende bankbiljet-effect. Een spiraal met het midden op een oog
  of een gezicht trekt de aandacht precies daarheen.
- Een foto met veel contrast werkt het best; schuif anders het contrast omhoog.
- De lijnen zijn één kleur zonder overdruk, dus de overdrukvoorvertoning is
  niet nodig om te zien hoe het drukt.

## Rechten

- **Selectie lezen** (`selectie.lezen`): om de geselecteerde foto en zijn
  kader te vinden.
- **Foto's lezen** (`beeld.lezen`): om de helderheid van de foto te meten. De
  foto zelf verandert niet.
- **Document wijzigen** (`document.schrijven`): om de gravure te tekenen.

Lijngravure bewaart alleen zijn eigen instellingen.

## Licentie

MIT, eigen werk van GuusLab.
