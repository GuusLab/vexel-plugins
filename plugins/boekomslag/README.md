# Boekomslag

Tekent de complete indeling van een boekomslag: achterkant, rug, voorkant en
eventueel flappen, of het overtrek van een harde kaft met borden, groeven en
inslag. De rugdikte rekent de plugin uit het aantal pagina's, het papier en de
bindwijze. Met snij-, ril- en vouwlijnen in eigen steunkleuren die
overdrukken, een veilige zone, een hulplijn en voorbeeldtekst op de rug, en
alle maten erbij.

## Gebruik

1. Kies **Plugins › Boekomslag…**.
2. **Boek**: kies een **Formaat** (of vul breedte en hoogte van het
   binnenwerk in), het aantal **Pagina's** en de **Bindwijze**. De
   **Correctie** vult zich bij de bindwijze; pas hem aan als je drukker een
   ander getal noemt.
3. **Papier binnenwerk**: kies de **Soort** (met zijn volume) en het
   **Gewicht**, of kies *Eigen dikte per vel* en vul de dikte in µm in (staat
   vaak op het papieretiket of in de papierwaaier). Weet je de rug al van je
   drukker, zet dan **Rugdikte zelf invullen** aan.
4. **Omslag** (zachte kaft): **Afloop**, **Veilige marge** (ruimte die je vrij
   houdt van tekst langs de snijkant), een **Scharnierril** (een ril naast de
   rug, bijvoorbeeld 6 mm; 0 = geen) en **Flappen** met hun breedte.
   Harde kaft: **Bordikte**, **Uitsteek** (hoeveel het bord buiten het blok
   steekt), **Groef** (de ruimte tussen rugbord en bord) en **Inslag** (wat
   om het bord heen vouwt).
5. **Rugtekst**: van boven naar beneden, van onder naar boven of geen, en de
   tekst die als voorbeeld op de rug komt.
6. Lees de rug en de omslagmaat onder het voorbeeld, en klik **Omslag maken**.

Zet het tekengebied op de omslagmaat (zonder afloop) en de afloop op wat je
koos; dan komt de omslag precies linksboven. Past het tekengebied niet, dan
komt de omslag in het midden en zegt de plugin welke maat het tekengebied moet
krijgen.

## Wat je krijgt

Eén groep, *Boekomslag 148 × 210 mm · rug 11,75 mm*, met:

- **Snijlijn**: de rand van de omslag (bij een harde kaft de rand van het
  overtrek en de schuine hoeken, 1,5 × de bordikte van de bordhoek).
- **Rillijnen en vouwlijnen**: op de randen van de rug, bij de flappen en de
  scharnierrillen; bij een harde kaft waar de inslag om het bord vouwt.
- **Borden en groeven** (harde kaft): de plek van de twee borden en het
  rugbord.
- **Hulplijnen**: de afloop, de veilige zone per paneel, de middenlijn van de
  rug en een label per paneel (*VOORKANT 148 × 210 mm*).
- **Rugtekst (vervang door je eigen tekst)**: echte tekst, gedraaid en
  midden op de rug; past hij niet, dan maakt de plugin hem kleiner.
- **Maatvoering**: maatlijnen per paneel, de totale breedte en de hoogte, en
  onder de omslag de hele berekening in één regel.

Snijlijn, rillijnen en hulplijnen staan in de steunkleuren *Snijlijn*,
*Rillijn* en *Hulplijnen*, met overdruk. Zo laat je ze bij het drukken in één
keer weg, en ziet de drukker meteen wat wat is.

## De rekensom

Alle maten in mm.

```
vellen       = pagina's / 2                     (een vel is twee pagina's)
dikte vel    = gewicht × volume                 (µm; of je eigen dikte)
blok         = vellen × dikte vel / 1000
```

Zachte kaft (gebrocheerd):

```
rug          = blok + correctie                 (garenloos 0,5, genaaid 1,0)
omslag breed = (flap) + breedte + rug + breedte + (flap)
omslag hoog  = hoogte                           (plus afloop rondom)
```

Harde kaft (gebonden):

```
rug          = blok + correctie + 2 × bordikte
bord breed   = breedte + uitsteek − (groef − bordikte)
bord hoog    = hoogte + 2 × uitsteek
overtrek     = inslag + bord + groef + rug + groef + bord + inslag   (breed)
             = inslag + bord hoog + inslag                           (hoog)
```

Voorbeeld: een roman van 148 × 210 mm, 200 pagina's houtvrij offset 90 g/m²
(volume 1,25), garenloos: 100 vel × 112,5 µm = 11,25 mm, plus 0,5 mm is een rug
van **11,75 mm**. De omslag wordt 148 + 11,75 + 148 = **307,75 × 210 mm**, met
3 mm afloop 313,75 × 216 mm.

Hetzelfde boek genaaid gebonden met bord van 2 mm, uitsteek 3, groef 7 en
inslag 15: rug 11,25 + 1 + 4 = 16,25 mm, borden 146 × 216 mm, overtrek
**352,25 × 246 mm**.

De bordmaat bij een harde kaft is een gangbare vuistregel (het bord begint
ongeveer een groef min een bordikte naast de rug); elke binderij werkt net
iets anders. Leg de maten naast het sjabloon van je binder en pas zo nodig
groef, uitsteek of bordikte aan.

Het volume (dikte per g/m²) verschilt per papiermerk en per partij. De
voorinstellingen zijn gangbare waarden: houtvrij offset 1,25, mat gestreken
1,0, silk 0,95, glans 0,85, romandruk 1,5 tot 2,0. Gebruik voor de definitieve
omslag altijd de dikte of de rugmaat die je drukker opgeeft.

## Tips

- Een oneven aantal pagina's rondt de plugin naar boven af (een blad heeft
  twee kanten). Bij genaaid binnenwerk waarschuwt hij als het aantal geen
  veelvoud van 16 is.
- Bij flappen vouwt de flap precies op de rand van voor- en achterkant. Wil
  je drukker een paar millimeter vouwtoeslag, maak de flap dan zoveel breder.
- Groepeer je ontwerp op een eigen laag boven de hulplijnen; zo kun je de
  omslaggroep later weggooien of verbergen.

## Rechten

- **Document wijzigen** (`document.schrijven`): om de lijnen, labels en maten
  te tekenen.

Boekomslag leest je selectie niet en bewaart alleen zijn eigen instellingen.

## Licentie

MIT, eigen werk van GuusLab.
