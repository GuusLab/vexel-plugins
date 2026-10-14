# Foto naar halftoon

Maak van een foto een echt halftoonraster in vectoren: stippen, vierkantjes,
ruitjes of lijnen waarvan de grootte de helderheid volgt. In één kleur, of
als CMYK-scheiding in vier lagen met de klassieke rasterhoeken. Scherp op elk
formaat, en drukklaar: geen pixels meer, alleen vlakken in drukkleuren.

## Gebruik

1. Plaats een foto (**Bestand › Plaatsen**) en selecteer hem.
2. Kies **Plugins › Foto naar halftoon…**. Links zie je meteen een grote
   voorvertoning van het raster.
3. Kies bij **Kleuren** **Eén kleur** of **CMYK-scheiding (4 lagen)**.
4. Kies de **punt**: rond, vierkant, ruit of lijnen.
5. Stel het **raster** in, als rastermaat in millimeter of in lijnen per inch
   (lpi). Bij één kleur kies je ook de **rasterhoek** (45° is klassiek). Bij
   CMYK liggen de hoeken vast: cyaan 15°, magenta 75°, geel 0°, zwart 45°.
6. Pas **Helderheid** en **Contrast** aan. **Omkeren** maakt een negatief.
   Met **Witte punten op een vlak in de kleur** komt er een vlak in de
   gekozen kleur onder, met witte punten die het licht dragen.
7. Houd **Voor/na** ingedrukt (of de toets O) om de foto te zien, en zet de
   **Loep** aan (toets L) om de punten van dichtbij te bekijken.
8. Klik **Halftoon maken**.

Het raster komt als één groep precies over de foto, met per rasterrij één
samengesteld pad. Bij CMYK zijn dat vier lagen (Geel, Cyaan, Magenta, Zwart)
die elkaar overdrukken, zoals op de pers. De foto zelf blijft eronder staan;
verberg hem in het lagenpaneel of verwijder hem als je alleen het raster wilt.
Het eerste object in de groep heet **Kader**: een onzichtbaar vlak zo groot
als de foto, zodat de groep op de millimeter klopt.

Punten kleiner dan 0,1 mm laat de plugin weg: die drukken toch niet. Aan de
rand worden de punten netjes afgeknipt, zodat niets buiten de foto steekt.
Onderin het venster staat hoeveel punten en ankerpunten het worden. Past het
niet in één keer, dan komt het in een paar groepen (elk een eigen stap bij
ongedaan maken) en zegt het venster welk raster wel in één keer past.

Zijn er meer foto's geselecteerd, dan krijgen ze allemaal hetzelfde raster;
de voorvertoning toont de eerste.

## Tips

- Een raster van 1 tot 2 mm (13 tot 25 lpi) is goed zichtbaar als effect;
  grof (3 tot 6 mm) geeft een stoere affiche-look.
- De CMYK-lagen staan op overdrukken. Zet **Weergave › Overdrukvoorvertoning**
  aan om in Vexel te zien hoe het gedrukt wordt; zonder die weergave dekt de
  bovenste laag de andere af op het scherm.
- Eén steunkleur? Kies één kleur en kleur de groep daarna in je steunkleur.
- Lijnen bij 0° of 90° geven een strak, grafisch effect; bij 45° oogt het
  rustiger.
- Een foto met doorzichtige delen geeft daar geen punten.

## Rechten

- **Selectie lezen** (`selectie.lezen`): om de geselecteerde foto en zijn
  plek te vinden.
- **Foto's lezen** (`beeld.lezen`): om de pixels van de foto te lezen.
- **Document wijzigen** (`document.schrijven`): om het raster te tekenen.

De plugin verandert de foto zelf niet en bewaart alleen zijn eigen
instellingen.

## Licentie

MIT, eigen werk van GuusLab.
