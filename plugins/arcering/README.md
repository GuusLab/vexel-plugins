# Arcering

Vul een gesloten vorm met evenwijdige lijnen, kruisarcering, stippels of lijnen
die van dicht naar ijl verlopen, voor een getekend, gegraveerd of technisch
uiterlijk. De lijnen worden precies binnen de vorm afgeknipt, en gaten (zoals
in een O of een ring) blijven open. Handig voor illustraties, kaarten,
stempels, plattegronden en alles wat met één inktkleur gedrukt of
gesneden/gegraveerd wordt.

## Gebruik

1. Selecteer een of meer gesloten vormen: rechthoeken, ellipsen, paden of
   samengestelde paden (met gaten).
2. Kies **Plugins › Arcering…**.
3. Kies de **soort**:
   - **Evenwijdige lijnen** onder een **hoek** (0° is liggend, 90° staand).
   - **Kruisarcering**: twee lagen lijnen, haaks op elkaar.
   - **Stippels**: ronde stippen in een verspringend raster, met een
     **stipgrootte** in mm. Stippen aan de rand vallen nooit half buiten de vorm.
   - **Verlopende lijnen**: aan de ene kant liggen de lijnen dicht op elkaar, naar
     de andere kant toe steeds verder uit elkaar (tot de **afstand ×** die je
     kiest). Met **Lijnen worden dunner** lopen ook de lijndiktes mee, als bij een
     gravure. **Andersom** draait het verloop om.
4. Stel de **afstand** in (mm, van lijn tot lijn) en de **lijndikte** (pt).
5. Kies de **kleur**: die van de vorm (de vulkleur, anders de lijnkleur), zwart
   of wit.
6. Kies wat er met de **vorm** gebeurt:
   - **Omtrek houden, vulling weg**: de vorm wordt vervangen door een omtrek
     (in de lijnkleur van de vorm, of de kleur van de arcering) met de arcering
     erin.
   - **Alleen de arcering**: de vorm wordt vervangen door alleen de arcering.
   - **Vorm laten staan**: de arcering komt erbovenop, de vorm blijft zoals hij
     was. Kies dan een andere kleur dan de vulling.
7. Klik **Arceren**.

De voorvertoning laat precies zien wat er komt. De arcering is per vorm een
groep met een paar paden (gewone lijnen met rechte uiteinden, of gevulde
stippen); grote arceringen worden over meerdere paden verdeeld. Eén keer
ongedaan maken zet alles terug. Je laatste instellingen worden onthouden.

## Tips

- Een afstand van 0,8 tot 1,5 mm met 0,3 tot 0,5 pt geeft een klassieke
  pentekening; 3 mm met 1 pt een grafisch, modern vlak.
- Krommen worden heel fijn gevolgd (op 0,08 pt nauwkeurig), dus ook kleine
  ronde vormen worden netjes afgeknipt.
- Gaten: gaat de vulregel van de vorm mee in de selectie, dan volgt de arcering
  die; anders geldt even-oneven (elk binnenste subpad is een gat).
- Tekst arceren? Zet de tekst eerst om naar paden. Een groep eerst losmaken.
- Er gaan hooguit 24 000 lijnen of 11 000 stippels in één keer; anders vraagt
  de plugin om een grotere afstand.

## Rechten

- **Selectie lezen** (`selectie.lezen`): om de vorm, de kleuren en de lijndikte
  van je selectie te kennen.
- **Document wijzigen** (`document.schrijven`): om de arcering te tekenen en,
  als je dat kiest, de geselecteerde vormen te vervangen.

Arcering bewaart alleen zijn eigen instellingen.

## Licentie

MIT, eigen werk van GuusLab.
