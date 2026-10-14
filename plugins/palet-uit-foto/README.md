# Palet uit foto

Haal de hoofdkleuren uit een foto en zet ze als kleurvlakjes met een naam
en hun waarden naast de foto. Handig om een huisstijl, folder of affiche
af te stemmen op het beeld dat erin staat, en om kleuren door te geven aan
een drukker of collega.

## Gebruik

1. Selecteer een foto (eerst plaatsen met **Bestand › Plaatsen**).
2. Kies **Plugins › Palet uit foto…**.
3. Kies hoeveel **kleuren** je wilt (3 tot 12) en de **methode**:
   - **Clusters (k-means)** zoekt de kleuren die samen de foto het best
     beschrijven. Met **Andere variant** probeer je een andere start.
   - **Mediaan-snede** deelt de kleuren steeds doormidden; vast resultaat,
     vaak met meer oog voor kleine, felle kleuren.
4. Kies hoe je ze **sorteert**: meest voorkomend eerst, van licht naar
   donker, of op tint (het kleurenwiel rond, grijs achteraan).
5. Kies welke **waarden** erbij komen (CMYK, hex of allebei) en de
   **plaats**. Rechts in het venster zie je de gevonden kleuren met hun
   naam, waarde en aandeel in de foto.
6. Klik **Palet maken**.

Het palet komt als groep **Palet: <naam van de foto>** met per kleur een
groepje (vlak, naam en waarde). Standaard staat het rechts naast de foto;
past het daar niet op het tekengebied, dan komt het eronder, en past dat ook
niet, dan over de onderrand van de foto op een wit vlak. De samenvatting
zegt waar het komt. Vlakjes en tekst schalen mee met de foto.

Meer foto's geselecteerd? Dan krijgt elke foto zijn eigen palet; het
voorbeeld toont de eerste.

De kleurnamen ("Diepblauw", "Zandgeel", "Grijsgroen") leidt de plugin af uit
tint, licht en verzadiging. Twee kleuren met dezelfde naam krijgen een
nummer.

## Steunkleuren

Met **Als stalen (steunkleuren) toevoegen** wordt elke kleur een staal in
je document, zodat je hem met één klik op andere vormen zet. Let op: een
steunkleur is in drukwerk een eigen drukplaat (een extra inkt). Voor gewoon
vierkleurendruk laat je deze optie uit; dan krijgen de vlakjes gewone
CMYK-kleuren. De naam van een staal bevat de hexwaarde, zodat stalen uit
verschillende foto's niet door elkaar lopen.

## Tips

- In een CMYK-document staat bij elk vlak precies de CMYK-waarde waarmee het
  gevuld is. De omrekening van foto (RGB) naar CMYK is een eigen inktmodel,
  geen kleurprofiel: vraag voor kritische huisstijlkleuren een drukproef.
- Doorzichtige delen van een foto tellen niet mee.
- Een foto met veel lucht of water geeft vaak meerdere blauwen. Kies meer
  kleuren, of **Mediaan-snede**, om ook de kleine accenten te vinden.

## Rechten

- **Selectie lezen** (`selectie.lezen`): om de geselecteerde foto en zijn
  plek te vinden.
- **Foto's lezen** (`beeld.lezen`): om de kleuren van de foto te meten. De
  foto zelf blijft ongewijzigd.
- **Document wijzigen** (`document.schrijven`): om het palet te tekenen.

Palet uit foto bewaart alleen zijn eigen instellingen.

## Licentie

MIT, eigen werk van GuusLab.
