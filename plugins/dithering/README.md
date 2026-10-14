# Dithering

Zet een foto om in een beeld met maar een paar tinten: echt 1-bit zwart-wit,
een paar grijstinten of twee eigen kleuren, opgebouwd uit puntjes. Mooi voor
een grafische, retro of krantenachtige look, en voor drukwerk in één of twee
kleuren.

## Gebruik

1. Selecteer een of meer foto's (Bestand › Plaatsen).
2. Kies **Plugins › Dithering…**.
3. Stel in:
   - **Methode**: *Foutverdeling* (Floyd–Steinberg, natuurlijk en fijn),
     *Foutverdeling, contrastrijk* (Atkinson, met meer zuiver wit en zwart) of
     een *geordend raster* van 4 × 4 of 8 × 8 (regelmatig kruispatroon).
   - **Palet**: zwart-wit, 3 tot 8 grijstinten, of twee eigen kleuren
     (donker en licht).
   - **Pixelgrootte**: hoe groot één punt is, in pixels van de volle foto.
   - **Helderheid** en **Contrast** vooraf: vaak het verschil tussen een
     grauwe en een sprekende dithering.
4. Kies **100 %** om de punten op ware grootte te zien, en houd **Voor/na**
   (of V) ingedrukt voor het origineel.
5. Klik **Toepassen**.

## Tips

- Een iets hoger contrast (10–30) geeft bijna altijd een helderder resultaat.
- Twee kleuren, bijvoorbeeld donkerblauw op crème, geven een rustige
  zeefdrukachtige look.
- De samenvatting onderin noemt hoeveel punten het worden. Is het raster
  fijner dan de voorvertoning kan tonen, dan zegt hij dat erbij.
- Doorzichtige delen van een PNG blijven doorzichtig.

## Rechten

- **Selectie lezen** (`selectie.lezen`): om te zien welke foto's je hebt
  geselecteerd.
- **Pixels lezen** (`beeld.lezen`): om de foto te bewerken.
- **Pixels vervangen** (`beeld.schrijven`): om het resultaat terug te zetten.

Was de foto een JPEG, dan bewaart Vexel het resultaat ook als JPEG; heel
scherpe puntjes kunnen dan een fractie zachter worden. Een CMYK-foto is na het
toepassen RGB.

## Licentie

MIT, eigen werk van GuusLab.
