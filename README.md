# Breeze ☁️

A pastel weather app with a hidden notebook inside for people experiencing domestic violence.
Built for the Congressional App Challenge.

## How it works

| The weather app (what everyone sees) | The hidden notebook (only with the secret code) |
| --- | --- |
| Real weather: now, next 24 hours, 7 days | **Journal**: dated entries of what happened, how bad it was, injuries, witnesses, police report number, photos |
| Flat pastel color for each kind of weather | **Abuser**: details police and courts ask for (description, car and plate, workplace, weapons) |
| Installs like a normal app (PWA) | **Safety plan**: go-bag, home and phone checklists plus your own notes |
| Nothing about abuse appears anywhere | **Get help**: hotlines to call or text, trusted people, a one-tap "send for help" text with your location |
| | **Print or save as PDF**: the journal as a report for a protective order |

**First time:** search `#notebook` in the city search to set up the notebook and choose a secret code.
The app never shows or mentions the notebook on its own. Users would learn the phrase from wherever they found Breeze (an advocate, a school counselor, a hotline).

**After that:** type the secret code into the city search to open the notebook.
**To hide it:** tap **Hide** or press **Esc**. It also hides itself when you switch apps or after a few minutes without use.

## Safety and privacy design

- **Encrypted at rest.** All entries and photos are encrypted with AES-256-GCM. The key comes from the user's code (PBKDF2, 250,000 rounds). The code itself is never stored, so even someone who inspects the browser storage sees only scrambled data.
- **No server, no accounts.** Everything stays on the device. The only network calls are for weather (Open-Meteo), naming your city, and the ISS orbit and launch schedule, and those last two never include your location.
- **The code never leaves the device.** Searches are checked against the code locally *before* anything is sent to the weather service.
- **Invisible from the weather app.** No setup screen, buttons, or text about abuse ever shows unless you type the setup phrase or your code. Esc or switching apps closes even the setup screen.
- **No traces in the UI.** The notebook's HTML is deleted from the page when you hide it. The tab title and icon never change. Code fields are masked without being password fields, so password managers don't offer to save them.
- **Photos stay hidden.** Photos are stored encrypted inside the app instead of the camera roll, and GPS/EXIF data is stripped.
- **Panic tools:** the Hide button, hiding automatically, and Delete everything.
- **Survives a broken or taken phone:** encrypted backup and restore.

## Run it locally

Any static server works (service workers and Web Crypto need `localhost` or HTTPS):

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

To test on your phone, deploy it (below). Phones need HTTPS.

## Deploy (free)

**GitHub Pages:** push this folder to a repo → Settings → Pages → deploy from the `main` branch root. (This copy is live at https://nomadictuba2005.github.io/.)
Netlify or Cloudflare Pages also work: drag and drop the folder.

Then on a phone, open the URL and choose **Add to Home Screen** (iOS Safari: Share → Add to Home Screen).

## Project structure

```
index.html            weather app markup
fonts/                Bagel Fat One + Atkinson Hyperlegible, with their licenses
CREDITS.md            outside services, fonts and tools (required by the contest rules)
css/styles.css        all styles, including the print layout for reports
js/app.js             wiring: unlock, quick exit, auto-lock, service worker
js/weather.js         Open-Meteo weather, sun and moon, and illustrations
js/space.js           ISS pass predictions and upcoming rocket launches
js/vendor/            satellite.js (orbit math), with its license
js/vault.js           encryption + IndexedDB storage, backup/restore
js/hub.js             the hidden notebook UI
js/content.js         hotlines, checklists, warning signs (English + Spanish)
js/i18n.js            all notebook text in English and Spanish
js/local.js           state coalitions + local programs for "Near you"
js/config.js          setup phrase and private setup link
js/setup.js           notebook setup screen
sw.js                 offline caching
manifest.webmanifest  PWA install info
```

No frameworks and no build step: plain HTML, CSS and JavaScript.

## Notes

- The setup phrase and the private setup link (`#start-notebook`) live in `js/config.js`. Both only work when no notebook exists yet. Change them before publishing if they've been shown publicly (e.g. in your demo video).
- To add local programs for another area, add an entry to `AREAS` in `js/local.js`.
- Someone who opens the browser's developer tools could read the app's source code and see what it does (their data stays encrypted). That's why nothing in the site's name or address mentions abuse.
- If you change files, bump `VERSION` in `sw.js` so installed copies update.
- Hotline numbers are US national services. Double-check them before your demo.
