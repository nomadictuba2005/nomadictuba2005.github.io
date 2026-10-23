# Credits

The Congressional App Challenge rules ask entrants to document every outside library, framework and tool. Breeze has no frameworks; it's plain HTML, CSS and JavaScript with one small library, listed below, plus the outside resources after it.

## Code library (bundled in `js/vendor/`)

| Library | Used for | License |
| --- | --- | --- |
| [satellite.js](https://github.com/shashwatak/satellite-js) 7.1.0 | Working out when the ISS passes overhead, on the phone | MIT (`js/vendor/LICENSE-satellite.js.md`). Only the functions Breeze uses were bundled into one file with esbuild. |

## Services the app calls while running

| What | Used for | Terms |
| --- | --- | --- |
| [Open-Meteo](https://open-meteo.com/) forecast API and geocoding API | Weather data and city search | Free for non-commercial use, no API key. Data is CC BY 4.0, credited in the app ("Forecast from Open-Meteo"). |
| [BigDataCloud](https://www.bigdatacloud.com/) reverse geocoding (client-side, free tier) | Turning the phone's location into a city name | Free client-side API |
| [CelesTrak](https://celestrak.org/) and [wheretheiss.at](https://wheretheiss.at/) | The ISS's current orbit (TLE), refreshed every 12 hours | Free public data, no API key |
| [The Space Devs Launch Library 2](https://thespacedevs.com/llapi) | Upcoming rocket launches, refreshed every 2 hours | Free tier, no API key. Credited in the app ("Launches from The Space Devs"). |

No notebook data is ever sent to these services. Open-Meteo and BigDataCloud only receive a city name or coordinates when the weather screen asks for them. The ISS and launch services receive no location at all; passes and "near you" launches are worked out on the phone.

## Fonts (bundled in `fonts/`)

| Font | Author | License |
| --- | --- | --- |
| Bagel Fat One | The Bagel Fat Project Authors | SIL Open Font License 1.1 (`fonts/OFL-BagelFatOne.txt`) |
| Atkinson Hyperlegible | Braille Institute of America | SIL Open Font License 1.1 (`fonts/OFL-AtkinsonHyperlegible.txt`) |

Both were downloaded from Google Fonts.

## Content

- Hotline numbers and descriptions come from each organization's public information (National Domestic Violence Hotline, love is respect, RAINN, 988 Lifeline, Childhelp, StrongHearts Native Helpline).
- The safety-plan checklist and the "signs you may be in more danger" list are based on widely published safety-planning guidance from domestic violence organizations, rewritten in plain language.

## Local help data (bundled in `js/local.js`)

- State and territory domestic violence coalitions: [NNEDV's list of State and U.S. Territorial Coalitions](https://nnedv.org/content/state-u-s-territory-coalitions/), checked October 2026.
- Orange County, California programs: numbers taken from each organization's own website, October 2026 ([Human Options](https://www.humanoptions.org/), [Laura's House](https://laurashouse.org/), [Interval House](https://www.intervalhouse.org/)).
- Linked services: 2-1-1 (United Way) and [DomesticShelters.org](https://www.domesticshelters.org/) shelter search.

## Development tools (not part of the app)

- Google Chrome and Playwright: automated testing and screenshots
- ImageMagick: resizing the app icons
- esbuild: bundling the satellite.js functions into one file
- Skyfield (Python): checking the app's ISS pass times against an independent calculation

