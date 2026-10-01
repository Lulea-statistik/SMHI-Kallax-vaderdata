# SMHI-Kallax-vaderdata

Automatisk historik och daglig uppdatering av meteorologiska observationer från SMHI för **Luleå-Kallax Flygplats (station 162860)**.

## Vad som hämtas

Konfigurationen finns i `config/parameters.json`. Grunduppsättningen innehåller temperatur, vind, nederbörd, luftfuktighet, snödjup, lufttryck, sikt, rådande väder, molnmängd, byvind och daggpunkt.

Om en parameter inte finns för stationen hoppas den över och status skrivs till `metadata/parameters.csv`.

## Historik och daglig uppdatering

Första körningen använder `corrected-archive` tillsammans med den längsta tillgängliga aktuella perioden, normalt `latest-months`.

Därefter kör GitHub Actions varje dag kl. **04:30 UTC**. Den dagliga körningen hämtar den aktuella perioden igen och deduplicerar på observationens start- och sluttid. Den första dagen i varje månad gör `auto` dessutom en full arkivuppdatering.

Manuell körning finns under **Actions > Update SMHI Kallax weather data > Run workflow**.

Körlägen:

- `auto` - bootstrap om data saknas, annars daglig uppdatering; den 1:a i månaden full uppdatering
- `bootstrap` - historiskt arkiv + aktuell period
- `update` - aktuell period
- `refresh-all` - historiskt arkiv + aktuell period igen

## Dataformat

Data sparas årsvis per parameter, till exempel:

```text
data/parameter_1/2025.csv
data/parameter_1/2026.csv
data/parameter_4/2026.csv
```

`data/manifest.csv` listar samtliga datafiler, antal rader och min/max-datum.

Varje observationsfil innehåller bland annat:

- `station_id`, `station_name`
- `parameter_id`, `parameter_name`, `parameter_summary`, `unit`
- `datetime_utc`
- `datetime_local` i Europe/Stockholm
- `value`, `quality`
- `source_period`

## Power BI

I `powerbi/PowerQuery_M.txt` finns en Power Query som läser `data/manifest.csv` och kombinerar alla års-/parameterfiler till en tabell.

## Källa

SMHI Open Data, MetObs API. Station: Luleå-Kallax Flygplats, id 162860.
