# Beveiliging

## Een probleem melden

Vind je een manier waarop een plugin uit zijn sandbox kan komen, de controle
kan omzeilen, gegevens kan weglekken of iets kan doen wat zijn rechten niet
toestaan? Meld het dan **privé**, niet in een openbaar issue of pull request:

1. Ga naar het tabblad **Security** van deze repo.
2. Klik **Report a vulnerability** (privé melden via GitHub).
3. Beschrijf wat je vond, hoe je het kunt nagaan, en welke plugin of welk
   bestand het betreft.

Alleen de beheerder ziet je melding. We reageren zo snel als we kunnen,
houden je op de hoogte en noemen je graag bij naam als het is opgelost,
tenzij je dat liever niet hebt.

## Wat hier onder valt

- de controle en de bouwstap in `tools/` en `.github/workflows/`;
- de plugins in `plugins/`;
- de index en de galerij op `https://guuslab.github.io/vexel-plugins/`.

Een gat in Vexel zelf (bijvoorbeeld in de sandbox waarin plugins draaien) mag
je op dezelfde manier hier melden.

## Een kwaadaardige of kapotte plugin

Een plugin die al gepubliceerd is en kwaad doet, wordt meteen ingetrokken via
`ingetrokken.json`. Vexel zet hem dan bij iedereen uit. Meld ook dit privé
zoals hierboven.
