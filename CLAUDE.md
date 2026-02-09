# Ecnelis FLY - Guide Claude Code

## Projet

Application web PWA d'exploration sonore geolocalise. Angular 18, standalone components, AWS Amplify (backend), Leaflet (carte).

## Build & Dev

```bash
npx ng build          # Build production
npx ng serve          # Dev server (localhost:4200)
```

Warnings pre-existants a ignorer : budget bundle, duplicate Material theming, CommonJS modules (leaflet, qrcode, etc.).

## Architecture

- **Angular 18** : standalone components, signals (`signal()`, `computed()`, `toSignal()`)
- **Backend** : AWS Amplify Gen2 (GraphQL API, S3 storage, Cognito auth)
- **Carte** : Leaflet + leaflet.markercluster + leaflet-search
- **i18n** : @ngx-translate (FR/EN, fichiers JSON dans assets/i18n/)
- **UI** : Angular Material (MatDialog, MatBottomSheet, MatIcon)
- **Theming** : light/dark via `body.light-theme` / `body.dark-theme`, SCSS `:host-context(body.dark-theme)`

## Palette de couleurs (Gradient Harmony)

Design system : spectre blue -> indigo -> violet avec accents distincts par section.

### Variables SCSS (home.component.scss)

| Variable | Valeur | Usage |
|----------|--------|-------|
| `$primary-blue` | `#1976d2` | Carte mondiale, brand primaire |
| `$primary-indigo` | `#3f51b5` | Zones |
| `$primary-violet` | `#7e57c2` | Accent secondaire |
| `$logo-orange` | `#F5A623` | Logo |

### Gradients des hero cards

| Card | Gradient | Accent CTA (light/dark) | Border-left |
|------|----------|------------------------|-------------|
| Map | `#1e3a5f -> #1976d2` | `#1976d2` / `#90caf9` | blue |
| Featured (Son du jour) | `#283593 -> #5c6bc0` | `#6a3de8` / `#b388ff` | violet `#7c4dff` |
| Zones | `#1a237e -> #3f51b5` | `#00897b` / `#80cbc4` | teal |
| Journey (Voyager) | `#303f9f -> #5e6abf` | `#b07c10` / `#fbbf24` | amber |

### Couleur "Featured" (Son du jour) - coherence cross-app

Le violet `#7c4dff` est la couleur identitaire du "Son du jour", utilisee dans :
- Home page : hero card accent (border-left + CTA)
- Sidebar : icone + label featured sound (`#7c4dff`, gradient `#7c4dff -> #536dfe`)
- Mapfly overlay cinematique : icone, badge, pulse circle
- Mapfly popup : bandeau header violet (`featured-popup-header`)

### Accents futurs reserves

| Card future | Couleur prevue |
|-------------|---------------|
| Card 5 | Emerald `#0d7c51` |
| Card 6 | Coral `#c2410c` |

## Structure des pages cles

### Home (`features/home/pages/home/`)

- **Desktop** : hero cards en grille, Swiper carousel categories
- **Mobile portrait** (`@media max-width: 700px, orientation: portrait`) :
  - Container : `height: calc(100dvh - 64px)`, flex column
  - Hero card Map : full-width, `clamp(140px, 30dvh, 240px)`
  - Secondary cards : scroll horizontal snap (`scroll-snap-type: x mandatory`)
  - Carousel categories : `position: sticky; bottom: 0` avec glassmorphism
  - Pastilles : grille pyramide 4+5, style premium (border neutre, pas de glow)
- **Small phones** (`max-height: 800px`) : tailles reduites supplementaires
- Chargement : `Promise.allSettled` pour afficher toutes les cards simultanement

### Mapfly (`features/map/pages/mapfly/`)

- `ViewEncapsulation.None` (styles globaux pour popups Leaflet)
- **Featured mode** : animation cinematique fly-in, overlay violet, popup avec header violet
- **Journey mode** : navigation multi-etapes, couleur dynamique via `--journey-color`
- Offset popup : `lat + 0.0012` pour centrer popup visible au zoom 17

## Conventions SCSS

- Dark theme : toujours via `:host-context(body.dark-theme) &` (pas de media query)
- Mobile portrait : `@media (max-width: 700px) and (orientation: portrait)`
- Texture grain : variable `$noise-texture` (SVG feTurbulence inline)
- Animations d'entree : `@keyframes fadeInUp`, `@keyframes slideUpBar`

## Fichiers temporaires a ignorer

- `preview-color-proposals.html` (preview design, pas partie de l'app)
