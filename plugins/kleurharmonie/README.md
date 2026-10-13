# Kleurharmonie

Kies een vorm met een vulkleur en laat zien welke kleuren erbij passen. De
plugin zet een rij vlakjes neer, onder je selectie of naast het tekengebied,
met de CMYK-waarden eronder.

## Gebruik

1. Selecteer een vorm met een vulkleur (hoeft niet: je kunt ook zelf een
   kleur intypen).
2. Kies **Plugins › Kleurharmonie…**.
3. Kies een harmonie:
   - **Complementair**: de kleur, de tegenkleur en van beide een 50%-tint.
   - **Analoog**: vijf buren op de kleurcirkel, telkens 20° verder.
   - **Triade**: drie kleuren op gelijke afstand (120°).
   - **Tinten**: de kleur in 100, 80, 60, 40 en 20 procent, zoals een
     rasterpercentage op de pers.
4. Kies waar de vlakjes komen, hoe groot ze zijn en of de waarden eronder
   moeten. Het voorbeeld loopt mee.
5. Klik **Vlakjes maken**.

De vlakjes komen als één groep in je document; één keer ongedaan maken haalt
ze weg. In een CMYK-document krijgen ze CMYK-kleuren, anders RGB.

De omrekening tussen CMYK en de kleurcirkel is eenvoudig en gebruikt geen
kleurprofiel. Prima om mee te kiezen, maar geen drukproef: controleer de
uiteindelijke kleuren altijd zelf.

## Rechten

- **Selectie lezen** (`selectie.lezen`): om de vulkleur en plaats van je
  selectie te zien.
- **Document wijzigen** (`document.schrijven`): om de vlakjes te tekenen.

De plugin bewaart alleen zijn eigen instellingen en de laatst gebruikte kleur.

## Licentie

MIT, eigen werk van GuusLab.
