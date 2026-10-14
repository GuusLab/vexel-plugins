# Low-poly

Maak van een foto een vlak van driehoeken, elk in de gemiddelde kleur van
het stuk foto eronder. De punten liggen dichter bij de randen in de foto,
zodat vormen herkenbaar blijven. Echte vectoren, dus scherp op elk formaat:
mooi voor een affiche, een omslag of een achtergrond in een huisstijl.

## Gebruik

1. Selecteer een foto (eerst plaatsen met **Bestand › Plaatsen**).
2. Kies **Plugins › Low-poly…**. Links zie je meteen het resultaat.
3. Kies het aantal **Punten** (60 tot 2300; er komen ongeveer twee keer zo
   veel driehoeken) en hoe sterk de punten de **Randen** volgen. Bij 0 %
   liggen ze gelijkmatig verspreid, bij 100 % zitten ze vooral op de randen.
4. **Andere variant** legt de punten opnieuw neer met dezelfde instellingen.
   Elke variant is terug te halen: het nummer staat ernaast en wordt bewaard.
5. Pas eventueel **Verzadiging** en **Helderheid** aan, en kies een **Lijn**:
   - **Naden dichten** (standaard): een heel dunne lijn (0,25 pt) in de kleur
     van de driehoek zelf, zodat er op het scherm en in een PDF geen witte
     haarlijntjes tussen de driehoeken te zien zijn;
   - **Witte lijn** of **Donkere lijn** met een eigen dikte, voor een
     zichtbaar draadmodel;
   - **Geen lijn**.
6. Houd **Voor/na** ingedrukt (of de toets O) om de foto te zien, en zet de
   **Loep** aan (toets L) om details vergroot te bekijken.
7. Klik **Low-poly maken**.

De driehoeken komen als één groep **Low-poly** precies over het kader van de
foto. Driehoeken met precies dezelfde kleur staan samen in één pad, zodat het
document licht blijft. Het eerste kind is een onzichtbaar **Kader** zo groot
als de foto: zo ligt de groep op de millimeter over de foto. Doorzichtige
delen van de foto (bijvoorbeeld een PNG met ronde hoeken) worden weggelaten.

In een CMYK-document krijgt elke driehoek een CMYK-kleur (hooguit 300 %
inkt; neutraal grijs alleen in zwart), anders RGB. Zijn er meer foto's
geselecteerd, dan maakt de plugin ze allemaal (de voorvertoning toont de
eerste).

## Tips

- 400 tot 900 punten geeft het bekende grove facetten-effect; 2000 en meer
  lijkt al dicht bij de foto.
- Een foto met een duidelijk onderwerp tegen een rustige achtergrond werkt
  het best; zet **Randen** dan hoog.
- De foto blijft onder de driehoeken staan. Verberg of verwijder hem in het
  lagenpaneel als je hem niet meer nodig hebt.
- Is de foto gedraaid, dan volgt de groep het rechte kader eromheen.

## Rechten

- **Selectie lezen** (`selectie.lezen`): om de geselecteerde foto en zijn
  kader te vinden.
- **Foto's lezen** (`beeld.lezen`): om de kleuren van de foto te lezen.
- **Document wijzigen** (`document.schrijven`): om de driehoeken te tekenen.

Low-poly verandert de foto zelf niet en bewaart alleen zijn eigen
instellingen.

## Licentie

MIT, eigen werk van GuusLab.
