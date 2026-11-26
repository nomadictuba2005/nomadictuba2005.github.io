# Breeze

Breeze is a weather app with a hidden, encrypted notebook inside it for people experiencing domestic violence.

To anyone looking at the phone, it's a normal weather app with real forecasts. Typing a secret code into the city search opens a private notebook where someone can document abuse, plan for their safety, and find help. Nothing in the weather app mentions the notebook or abuse.

Built for the 2026 Congressional App Challenge.

Live at https://nomadictuba2005.github.io

## Features

**The weather app (what everyone sees)**

- Current weather, the next 24 hours, and a 7 day forecast
- City search that handles typos and runs on the phone
- Sunrise, sunset, moon phase, ISS passes, and upcoming rocket launches
- A believable forecast even with no internet connection
- Installs to the home screen like a regular app and works offline

**The hidden notebook (only with the code)**

- Journal: dated entries with what happened, how serious it was, injuries, witnesses, police report numbers, and photos
- Abuser details that police and courts ask for, like a description, car and plate, workplace, and weapons
- Safety plan: go-bag, home, and phone checklists plus personal notes
- Get help: hotlines to call or text, trusted contacts, and a one tap text that sends your location
- Print or save the journal as a PDF report for a protective order
- Available in English, Spanish, Chinese, French, Vietnamese, and Hindi

## How to open the notebook

1. Type `#notebook` into the city search and press Enter. This only works before a notebook exists.
2. Choose a secret code.
3. From then on, typing that code into the city search opens the notebook.

You can also go straight to setup with https://nomadictuba2005.github.io/#start-notebook. The link clears itself from the address bar.

To close it quickly, tap Hide or press Esc. The notebook also locks itself when you switch apps or leave it alone for a few minutes.

## Safety and privacy

- Everything is encrypted on the device with AES-256-GCM. The key comes from the user's code (PBKDF2, 250,000 rounds), and the code is never stored.
- There is no server and no account. Nothing in the notebook ever leaves the phone.
- The code is checked on the phone before any search is sent to the weather service, so it never goes over the network.
- City suggestions while typing come from a list bundled with the app, so nothing typed is sent anywhere until Enter.
- When the notebook is hidden, its HTML is removed from the page. The tab title and icon never change.
- Photos are stored encrypted inside the app instead of the camera roll, with location data stripped.
- Encrypted backup and restore, in case the phone is broken or taken.
- No analytics and no trackers.

The only network requests are for weather (Open-Meteo), naming the current city (BigDataCloud), and ISS and launch data, which never includes the user's location.

## Run it locally

Breeze is plain HTML, CSS, and JavaScript with no build step. Service workers and Web Crypto need `localhost` or HTTPS, so use a local server instead of opening the file directly:

```bash
git clone https://github.com/nomadictuba2005/nomadictuba2005.github.io.git
cd nomadictuba2005.github.io
python3 -m http.server 8000
```

Then open http://localhost:8000.

Any static server works, for example `npx serve` instead of Python.

To try it on a phone, it has to be served over HTTPS, so deploy it first.

## Deploy

On GitHub Pages, the workflow in `.github/workflows/pages.yml` deploys the site on every push and every 2 hours, which also refreshes the ISS and launch data in `data/space.json`. In the repo settings, set Pages to deploy from GitHub Actions.

Netlify or Cloudflare Pages also work by uploading the folder.

On a phone, open the site and use Add to Home Screen (in iOS Safari, it's under the Share button).

## Project structure

```
index.html            weather app markup
css/styles.css        all styles, including the print layout for reports
js/app.js             unlocking, quick exit, auto-lock, service worker setup
js/weather.js         forecasts, sun and moon, illustrations
js/places.js          typo-tolerant city suggestions
js/climate.js         offline forecast built from typical weather
js/space.js           ISS passes and rocket launches
js/vault.js           encryption, storage (IndexedDB), backup and restore
js/hub.js             the notebook interface
js/setup.js           notebook setup screen
js/content.js         hotlines, checklists, and warning signs
js/i18n.js            notebook text in English and Spanish, and the language list
js/lang/              Chinese, French, Vietnamese, and Hindi translations
js/local.js           state coalitions and local programs
js/config.js          setup phrase and setup link
js/vendor/            satellite.js for orbit math
data/places.tsv       city list from GeoNames
data/climate.json     typical weather by month
sw.js                 offline caching
manifest.webmanifest  install info
.github/              deploy workflow and data scripts
```

## Notes for developers

- The setup phrase and setup link are in `js/config.js`. Change them if they've been shown publicly, for example in a demo video.
- When you change any app files, bump `VERSION` in `sw.js` so installed copies update.
- To add local programs for another area, add an entry to `AREAS` in `js/local.js`.
- Hotline numbers are US national services. Check them before a demo.

## Credits

Outside services, data, fonts, and the one bundled library are listed in [CREDITS.md](CREDITS.md).

## License

MIT. See [LICENSE](LICENSE). Fonts and the bundled satellite.js library keep their own licenses, listed in CREDITS.md.
