# Ecnelis FLY - Guide Claude Code

## Projet

Application web PWA d'exploration sonore geolocalise. Angular 20, standalone components, AWS Amplify (backend), Leaflet (carte).

## Documentation a maintenir

Lors de mises a jour majeures (framework, runtime, stack), penser a mettre a jour :
- `CLAUDE.md` (ce fichier) — versions, architecture, conventions
- `README.md` — stack technique, prerequis Node.js
- `amplify.yml` — version Node.js (`nvm install`/`nvm use`) et commentaires
- `public/i18n/*.json` — cle `lastUpdate` (FR/EN/ES) si pertinent
- `src/app/features/legal/` — mentions legales (copyright, dates) via i18n

## Build & Dev

```bash
npx ng build          # Build production
npx ng serve          # Dev server (localhost:4200)
```

Warnings pre-existants a ignorer : budget bundle, duplicate Material theming, CommonJS modules (leaflet, qrcode, etc.).
Budget `anyComponentStyle` : `maximumError: 100kb` dans `angular.json` (augmente pour mapfly.component.scss avec le panneau categories desktop + styles popups/controles premium).
Si OOM en local : `NODE_OPTIONS=--max-old-space-size=4096 npx ng build` (TypeScript 5.9 + Angular 20 esbuild requiert plus de memoire).

## Architecture

- **Angular 20** : standalone components (defaut depuis Angular 19), signals (`signal()`, `computed()`, `toSignal()`), TypeScript 5.9
- **Backend** : AWS Amplify Gen2 (GraphQL API, S3 storage, Cognito auth, Lambda Node.js 22)
- **Carte** : Leaflet + leaflet.markercluster + leaflet-search + leaflet-minimap
- **Audio** : wavesurfer.js v7 (waveform player custom, ~30 kB gzip)
- **i18n** : @ngx-translate (FR/EN/ES, fichiers JSON dans public/i18n/)
- **Versioning** : `APP_VERSION` importe depuis `src/environments/version.ts` (lit `package.json`)
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
| `$logo-dark-blue` | `#0d47a1` | Accent unifie mobile light (icones, titres, borders) |

### Accents CTA et border-left par type de card

| Card | Accent CTA (light/dark) | Border-left |
|------|------------------------|-------------|
| Map | `#1976d2` / `#90caf9` | blue |
| Featured (Son du jour) | `#6a3de8` / `#b388ff` | violet `#7c4dff` |
| Journey (Voyages sonores) | `#5c6a8a` / `#8fb4d8` | slate-indigo `#5c6a8a` |
| Quiz | `#0d7c51` / `#66bb6a` | emerald |
| Article | `#8b6f47` / `#c4a882` | terre |
| Monthly Zone (Terroir) | `#b07c10` / `#fbbf24` | amber |

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

- **Desktop base** : hero cards en grille (map + 3 secondary visible, 4eme cachee), Swiper carousel categories
- **Desktop XL** (`@media min-width: 1920px`) : layout hero map pleine largeur + 4 secondary cards en ligne (voir section dediee)
- **Mobile portrait** (`@media max-width: 700px, orientation: portrait`) — **Design "Premium Blue"** :
  - **Layout scroll interne** : `height: calc(100dvh - 48px - 56px - env(safe-area-inset-bottom))`, `overflow-y: auto`, `gap: 24px`. Le scroll est interne au `.home-container` — `mat-sidenav-content` ne scroll PAS (toolbar et bottom nav restent fixes)
  - **Toolbar sticky** : `position: sticky; top: 0; z-index: 50` + glassmorphism (`backdrop-filter: blur(20px)`) dans `app.component.scss`
  - **Flex non-compressible** : toutes les sections ont `flex: 0 0 auto` (pas de compression flex sur petits ecrans, le scroll gere)
  - **Aplatissement CSS** : `.hero-section` et `.hero-actions` en `display: contents`, reordonnancement via `order` :
    1. `.hero-content` (order: 1) — Header : logo 80px interactif + titre "Ecoutez le monde"
    2. `.hero-card-map` (order: 2) — Carte mondiale : card horizontale (mat-icon `public` + contenu + chevron)
    3. `.onboarding-section` (order: 3) — Stats inline (548 sons · 111 pays · 177 explorateurs) + separateur gradient bleu→orange en `::after`
    4. `.alaune-section` (order: 4) — Bloc unifie "A la une" : mat-icon `auto_awesome` + titre + carousel 3D coverflow infinite scroll (pas d'indicateur de position)
    5. `.carousel-section` (order: 7) — Carousel categories : mat-icon `category` + titre "Categories" + fleches scroll + chips
  - **Icones Material** : PNG illustrations remplacees par `<mat-icon>` (38x38px pour A la une/Categories, 64x64px pour Mapfly)
    - **Light** : fond gradient `$logo-dark-blue (#0d47a1) → #1565c0`, icone blanche, box-shadow bleue
    - **Dark** : fond gradient `#5c6bc0 → #7e57c2` (indigo→violet lumineux), icone blanche, glow violet
  - **Couleur unifiee light** : `$logo-dark-blue (#0d47a1)` pour tous les titres bold, icones, borders, accents
  - **Background light** : `#F1F2F6` + grain SVG quasi imperceptible (opacity 0.05, baseFrequency 0.65, taille 200px — direction sensorielle/artistique)
  - **Background dark** : `linear-gradient(180deg, #080a18, #0c0e22, #0a0c1e)` + grain (opacity 0.035, baseFrequency 0.65, taille 200px)
  - **Formes decoratives** : blob bleu (`$primary-blue`, 0.06 opacity) et blob orange (`$logo-orange`, 0.06 opacity) en pseudo-elements sur `.hero-content`, vague organique (`$primary-blue`, 0.02 opacity) en `::after` sur `.home-container`. Tous masques (`opacity: 0`) jusqu'a `.ready` puis fade-in via `transition`
  - **Hierarchie des surfaces** (variation premium, pas de monotonie) :
    - `.hero-card-map` : `border-radius: 26px`, shadow forte (hero immersif)
    - `.alaune-section` : `border-radius: 26px`, fond `rgba($logo-dark-blue, 0.09→0.04)`, shadow profonde + `inset 0 1px` inner glow (spotlight editorial)
    - `.carousel-section` : `border-radius: 18px`, fond `rgba($logo-dark-blue, 0.035)`, flat sans shadow (secondaire ancre)
    - `.community-stats` : pas de container (transparent, pas de border/shadow — donnees flottantes)
  - **Separateur Onboarding→A la une** : trait gradient `$logo-dark-blue 70% → $logo-orange 100%`, 85% largeur, opacity 0.25, margin-top 10px, en `::after` sur `.onboarding-section`
  - **Indicateurs de scroll A la une** : chevrons `<` `>` en position absolue sur les bords du carousel (`.alaune-scroll-wrap`), styles `.scroll-hint` + `.alaune-hint-left/.alaune-hint-right`. Chevrons internes aux cards (`.carousel-card-chevron`) masques en mobile pour eviter le doublon
  - **Pas d'accent top bars** : toutes les `::before` accent bars supprimees pour bords propres
  - **Descriptions cachees** : `.hero-card-desc { display: none }` sur toutes les cards mobile
  - **Cards secondary (carousel 3D)** : `min-width: 65vw`, `transform: perspective(600px) rotateY(±25° max) scale(0.80–1.0)`, `transform-origin: center center` (fixe, jamais de flip — evite clignotement bords), `backface-visibility: hidden`, `border-left` + `border-right: 4px solid` colore par type, infinite scroll (cards triplees), glow subtil sur card active
- **Small phones** (`max-height: 700px`) : gap reduit (18px), logo 64px, padding compact
- Chargement : `Promise.allSettled` pour afficher toutes les cards simultanement

#### Orchestrated Reveal (chargement)

Tous les elements demarrent a `opacity: 0` et apparaissent en cascade coordonnee quand `dataLoaded()` passe a `true` (classe `.ready` sur `.home-container`). Easing : `cubic-bezier(0.22, 1, 0.36, 1)`. Les formes decoratives (blobs, wave) sont aussi masquees (`opacity: 0`) et font un fade-in via `transition` quand `.ready` est applique.

- Stagger desktop : logo (0.05s) -> titre (0.12s) -> sous-titre (0.18s) -> carte map (0.25s) -> alaune section (0.30s) -> secondary cards (0.35s) -> onboarding (0.48s) -> carousel (0.50s)
- Stagger mobile : logo (0.05s) -> titre (0.12s) -> sous-titre (0.18s) -> carte map (0.25s) -> alaune section (0.28s) -> cards individuelles (0.28s-0.46s) -> stats (0.50s) -> carousel (0.55s)
- Desktop : `.hero-cards-secondary` utilise `display: contents`, donc les cards individuelles sont ciblees via `nth-child` pour le reveal
- Mobile : animation `fadeInUp` pour toutes les sections, cards staggerees individuellement via `nth-child`. Apres 1.2s les animations CSS sont desactivees (`style.animation = 'none'`) pour laisser le JS piloter les transforms 3D

#### Gradients positionnels des secondary cards (desktop uniquement)

Les gradients dependent de la **position** dans la grille (pas du type de card). **Scopés dans `@media (min-width: 701px)`** pour ne pas fuiter sur mobile :

| Position | Gradient | Description |
|----------|----------|-------------|
| nth-child(1) | `$gradient-pos-2` (`#1f2f6e -> #4a62c6`) | Bleu-indigo |
| nth-child(2) | Custom (`#292b8c -> #6760c1`) | Indigo-violet doux (casse la linearite) |
| nth-child(3) | `$gradient-pos-3` (`#283593 -> #5c6bc0`) | Indigo |
| nth-child(4) | `$gradient-pos-4` (`#2d2485 -> #7558c2`) | Indigo-violet (XL uniquement) |

#### Ordering des secondary cards

- **5 types dans le pool** : `featured`, `quiz`, `monthlyZone`, `monthlyJourney`, `article`
- `featured` est toujours inclus si disponible (jamais exclu)
- **Desktop (4 cards preparees)** : pool de {quiz, monthlyZone, monthlyJourney, article}, on en tire 3 au hasard (Fisher-Yates shuffle) + featured = 4 cards. CSS cache la 4eme sur desktop normal (`@media min-width: 701px and max-width: 1919px`), affiche les 4 en XL (`>=1920px`). Featured toujours en position 2
- **Mobile (toutes les cards)** : pool complet {quiz, monthlyZone, monthlyJourney, article}, TOUTES les cards disponibles sont affichees (le scroll horizontal gere n'importe quel nombre). Featured en 2e position
- Si `featured` absent : les cards disponibles remplissent les positions sans contrainte
- Logique dans `orderedSecondaryCards` signal, template via `@for` + `@switch`

#### Bloc "A la une" mobile (`.alaune-section`)

Section unifiee regroupant illustration + titre + carousel 3D coverflow infinite scroll.

**Structure HTML :**
```html
<div class="alaune-section">
  <img class="alaune-illustration" />  <!-- masque en mobile -->
  <mat-icon class="alaune-icon-mobile">auto_awesome</mat-icon>
  <h2 class="alaune-title">À la une</h2>
  <div class="hero-cards-secondary" #secondaryScroll>
    <!-- cards carousel (repeatedCards = cards x3 pour infinite loop) -->
  </div>
</div>
```

**Layout :** `display: flex; flex-direction: column; gap: 10px; border-radius: 26px; margin: 4px 16px 0; padding: 14px 0 14px`

**Icone :** `.alaune-icon-mobile` — mat-icon `auto_awesome`, 38x38px, `position: absolute; top: 10px; left: 14px`. PNG `.alaune-illustration` masque

**Titre :** `.alaune-title` — `font-size: 1.02rem; font-weight: 800; padding: 0 16px 0 60px; line-height: 38px` (aligne verticalement sur l'icone 38px). Couleur `$logo-dark-blue` (light) / `rgba(255,255,255,0.92)` (dark)

**Background light :** `linear-gradient(160deg, rgba($logo-dark-blue, 0.09), rgba($logo-dark-blue, 0.04))` — surface teintee bleue premium elevee
**Background dark :** `linear-gradient(160deg, rgba(18, 18, 34, 0.96), rgba(22, 24, 48, 0.94))` — surface deep harmonisee
**Box-shadow light :** `0 2px 4px rgba(0,0,0,0.04), 0 8px 24px rgba($logo-dark-blue,0.10), 0 20px 52px rgba($logo-dark-blue,0.06), inset 0 1px 0 rgba(255,255,255,0.60)` — inner glow premium
**Border :** `1px solid rgba($logo-dark-blue, 0.14)` light / `rgba(#5c6bc0, 0.18)` dark

**Carousel 3D coverflow :** `scroll-snap-type: x mandatory`, `scroll-snap-align: center`, `gap: 10px`, `padding: 0 calc(50% - 32.5vw)`. Cards triplees (`repeatedCards` computed signal) pour infinite loop. Listener scroll RAF-throttle via `ngZone.runOutsideAngular` (perf). `overflow-y: hidden` (pas `visible` — CSS spec force `auto` si l'autre axe est `auto`). Pas de `scroll-behavior: smooth` (cause emballement en grand geste). Pas de `scroll-snap-stop: always` (rigidifie le scroll). Apres 1.2s les animations CSS reveal sont desactivees pour laisser JS piloter les transforms.

**Cards 3D :** `min-width: 65vw`, `transform: perspective(600px) rotateY(±25°) scale(0.80–1.0)`, `opacity: 0.35–1.0`. `transform-origin: center center` fixe (pas de flip `left`/`right` — le flip causait un clignotement de bande noire/blanche aux bords). `backface-visibility: hidden` (elimine artefacts rendering 3D). Interpolation cosinus (`factor = 0.5 * (1 + cos(π * t))`). `border-left` + `border-right: 4px solid` colore par type. `border-radius: 18px`. Card active : glow `0 0 20px rgba($primary-indigo, 0.08)` light / `rgba(#5c6bc0, 0.12)` dark.
**Badges :** `white-space: normal` (retour a la ligne pour textes longs type ES), `letter-spacing: 0.3px`, `max-width: 80px`
Dark : `background: rgba(255,255,255,0.06)` + borders colores par type

**Border per card type (left + right) :**
| Card | Border-left (light) | Border-left (dark) |
|------|--------------------|--------------------|
| Featured | `#7c4dff` | `rgba(#b388ff, 0.60)` |
| Journey | `#5c6a8a` | `rgba(#8fb4d8, 0.50)` |
| Quiz | `#0d7c51` | `rgba(#66bb6a, 0.50)` |
| Article | `$accent-article` | `rgba($accent-article-light, 0.50)` |
| Zone | `#b07c10` | `rgba(#fbbf24, 0.50)` |

**Icon tints per card type (light / dark) :**
| Card | Icon bg (light) | Icon color (light) | Icon bg (dark) | Icon color (dark) |
|------|----------------|--------------------|---------------|-------------------|
| Featured | `rgba(#7c4dff, 0.10)` | `#6a3de8` | `rgba(#b388ff, 0.18)` | `#b388ff` |
| Journey | `rgba(#5c6a8a, 0.10)` | `#5c6a8a` | `rgba(#8fb4d8, 0.18)` | `#8fb4d8` |
| Quiz | `rgba(#0d7c51, 0.10)` | `#0d7c51` | `rgba(#66bb6a, 0.18)` | `#66bb6a` |
| Article | `rgba($accent-article, 0.10)` | `$accent-article` | `rgba($accent-article-light, 0.18)` | `$accent-article-light` |
| Zone | `rgba(#b07c10, 0.10)` | `#b07c10` | `rgba(#fbbf24, 0.18)` | `#fbbf24` |

**Descriptions :** cachees (`display: none`) — style minimaliste

**Chevrons :** `carousel-card-chevron` sur chaque card (indicateur cliquable), `color: #9CA3AF` light / `rgba(255,255,255,0.20)` dark

**Infinite scroll :** cards array triplees via `repeatedCards = computed(() => [...cards, ...cards, ...cards])`. Scroll demarre au set du milieu. `repositionIfNeeded()` detecte les bords et repositionne invisiblement — appele uniquement quand le scroll est au repos (debounce 150ms), jamais pendant le scroll actif (evite le clignotement). Desactive `scroll-snap-type` pendant le saut. Guard `isRepositioning` empeche la reentrance. `activeCardIndex` utilise modulo pour mapper sur les cards originales.

**Scroll performance :** Le scroll listener est RAF-throttle (`requestAnimationFrame` avec annulation du frame precedent). `updateActiveCard()` met a jour les CSS custom properties (scale, opacity, rotateY) a chaque frame. Pas de transition CSS sur `transform`/`opacity` (updates instantanees a 60fps, pas de delai). Seul `box-shadow` a une transition (glow card active).

#### CTA labels home (i18n)

Le CTA de la card Voyage sur la home utilise `home.hero.startJourney` : FR "Decoller", EN "Take off", ES "Despegar" (court, on-brand "FLY"). La page voyages complete (`journeys.startJourney`) garde "Commencer le voyage" (plus de place).

#### i18n Onboarding + Stats

| Cle | FR | EN | ES |
|-----|----|----|-----|
| `home.onboarding.title` | Notre communaute | Our community | Nuestra comunidad |
| `home.stats.sounds` | sons | sounds | sonidos |
| `home.stats.countries` | pays | countries | paises |
| `home.stats.contributors` | explorateurs | explorers | exploradores |
| `home.onboarding.explore` | Explorez les sons du monde | Explore the sounds of the world | Explora los sonidos del mundo |
| `home.onboarding.listen` | Ecoutez des lieux uniques | Listen to unique places | Escucha lugares unicos |
| `home.onboarding.contribute` | Partagez vos decouvertes | Share your discoveries | Comparte tus descubrimientos |
| `home.categories.mobileTitle` | Categories | Categories | Categorias |

#### Long Press mobile

- **Tap** (< 400ms) : navigation normale
- **Long press** (>= 400ms) : description apparait en fondu, retour haptique (`navigator.vibrate(10)`), auto-dismiss 3s
- **Signals** : `longPressedCard: signal<string | null>(null)`, `isMobileGrid: signal<boolean>`
- **Events template** : `(pointerdown)` / `(pointerup)` / `(pointerleave)` sur chaque card
- **CSS** : `.hero-card.long-pressed` → `.hero-card-desc { max-height: 60px; opacity: 1 }`
- Les `routerLink` des cards quiz/article sont conditionnels (`[routerLink]="isMobileGrid() ? null : ..."`) pour eviter navigation pendant long-press

#### Carte mondiale mobile (hero card map)

Design "Premium Blue" — card horizontale avec mat-icon `public`.

**Layout :** `flex-direction: row` (icone 64px gauche + contenu centre + chevron droite), `border-radius: 20px`, `margin: 20px 16px 0`

**Icone :** `.map-card-icon-mobile` — mat-icon `public`, 64x64px, `border-radius: 16px`. PNG `.map-card-illustration` masque (`display: none !important`)

**Light :**
- Background : `#ffffff`, `border: 1px solid rgba($primary-indigo, 0.08)`
- Icone : gradient `$logo-dark-blue → #1565c0`, icone blanche, shadow bleue
- Titre : `$logo-dark-blue`, sous-titre i18n
- Multi-layer box-shadow premium
- Chevron : `chevron_right` en gris subtil

**Dark :**
- Background : `rgba(18,18,34,0.94)`, `border: rgba(#5c6bc0, 0.18)`
- Icone : gradient `#5c6bc0 → #7e57c2` (indigo→violet lumineux), glow violet
- Chevron et textes adaptes aux couleurs dark

#### Carousel categories mobile (order: 7)

Section en bas du scroll, design harmonise avec "A la une".

**Structure HTML :**
```html
<section class="carousel-section">
  <img class="categories-illustration" />  <!-- masque en mobile -->
  <mat-icon class="categories-icon-mobile">category</mat-icon>
  <div class="carousel-header">
    <h2 class="carousel-title carousel-mobile-title">Catégories</h2>
  </div>
  <div class="categories-scroll-wrap">
    <mat-icon class="scroll-hint scroll-hint-left">chevron_left</mat-icon>
    <app-carousel-categories></app-carousel-categories>
    <mat-icon class="scroll-hint scroll-hint-right">chevron_right</mat-icon>
  </div>
</section>
```

**Icone :** `.categories-icon-mobile` — mat-icon `category`, 38x38px, `position: absolute; top: 10px; left: 14px`. PNG `.categories-illustration` masque. Memes styles que `.alaune-icon-mobile` (gradient, taille, position)

**Titre mobile :** `.carousel-mobile-title` — `font-size: 1.02rem; font-weight: 800; line-height: 38px` (aligne verticalement sur l'icone 38px). `.carousel-header` a `padding: 0 16px 0 60px` pour deporter le texte a droite de l'icone. Memes proportions que `.alaune-title`

**Scroll hints :** fleches chevron gauche/droite, `color: rgba($logo-dark-blue, 0.45)` light / `rgba(#90caf9, 0.45)` dark, fond `rgba($logo-dark-blue, 0.06)`

**Light :**
- Background : `rgba($logo-dark-blue, 0.035)` — surface flat secondaire (differente de "A la une")
- `border: 1px solid rgba($logo-dark-blue, 0.07)`, `border-radius: 18px`
- Pas de box-shadow (flat, ancre)
- `.carousel-icon` masque (icone Material le remplace)

**Dark :**
- Background : `rgba(18, 18, 34, 0.80)` — flat secondaire
- `border: 1px solid rgba(#5c6bc0, 0.12)`
- Pas de box-shadow
- Icone : gradient `#5c6bc0 → #7e57c2` (indigo→violet lumineux)

**i18n `home.categories.mobileTitle` :** FR "Categories", EN "Categories", ES "Categorias"

#### Community Stats (mobile uniquement)

Stats flottantes sans container (order: 3). Header et pillars masques. Visible uniquement en mobile portrait. Separateur gradient bleu→orange (`$logo-dark-blue 70% → $logo-orange 100%`, 85% largeur, opacity 0.25, margin-top 10px) en `::after`.

**Structure :**
```
548 sons · 111 pays · 177 explorateurs
```

Donnees flottantes — `background: transparent`, `border: none`, `box-shadow: none`, `border-radius: 0`, `padding: 20px 0`. Header + pillars masques (`display: none`).

**Community stats :** compteurs dynamiques (sons, pays, contributeurs) via `SoundsService.getCommunityStats()`. Chiffres en `font-weight: 900`, `font-size: 2.15rem`, couleur `$logo-dark-blue` light / `#e8eaf6` dark. Labels en `font-weight: 600`, `font-size: 0.68rem`, couleur `#6b7394` light / `#8b92b0` dark, `letter-spacing: 0.8px`. Separateurs : points ronds 4px (`border-radius: 50%`) en `rgba($logo-dark-blue, 0.20)` light / `rgba(#90caf9, 0.25)` dark

**Count-up animation :** les chiffres s'animent de 0 a la valeur finale en 1.2s (ease-out cubic) via `requestAnimationFrame` hors zone Angular. Signals `displaySounds`, `displayCountries`, `displayContributors` pilotent l'affichage

**Signal :** `communityStats: signal<{ sounds, countries, contributors } | null>(null)`

**i18n :** `home.onboarding.title` — FR "Notre communaute", EN "Our community", ES "Nuestra comunidad"

#### Description cards desktop

- `-webkit-line-clamp: 3` (max 3 lignes de texte)
- `margin-bottom: 1.4em` sur `.hero-card-desc` (desktop only) pour creer un espace d'une ligne vide entre le texte et le CTA
- `.hero-card-cta` a `margin-top: auto` pour etre pousse en bas de la card

#### Desktop XL (`@media min-width: 1920px`)

Layout premium pour grands ecrans. **Ne touche PAS aux autres formats** (mobile, desktop normal).

**Architecture breakpoints :**
- Mobile : `max-width: 700px, orientation: portrait`
- Desktop normal : `min-width: 701px` (gradients, reveal) + `min-width: 701px and max-width: 1919px` (cache 4eme card)
- Desktop XL : `min-width: 1920px` (layout hero + polish)

**Layout :**
- `.hero-actions` : `flex-wrap: wrap; max-width: 1400px; margin: 0 auto; gap: 20px`
- Carte Map : `width: 100%` pleine largeur hero au-dessus des secondary cards
- Secondary cards : `display: flex; gap: 24px` — 4 cards `flex: 1 1 0` sans max-width rigide

**Carte Map hero (sans video) :**
- Video cachee en XL (`.map-card-video { display: none !important }`) — performances
- Gradient premium `$gradient-pos-1` + noise texture + 4 orbs flottants
- Icon glassmorphism 80px (`rgba(255,255,255,0.15)`, backdrop-filter blur)
- Content overlay en bas : gradient `rgba(15,25,60,0.72)` → transparent
- CTA pill compact : glassmorphism blanc, `align-self: flex-start`, `width: fit-content`
- `min-height: 280px`, `border-radius: 22px`
- Accent top bar : gradient `$primary-blue → $primary-indigo → $primary-violet`, 3px

**Secondary cards :**
- Visual gradient compact : `height: 90px` (icone + badge)
- `border-left: none !important` (accent top bar suffit, pas de double accent)
- CTA pills : `width: fit-content; align-self: flex-start`, accent color par type
- `display: flex !important` (force l'affichage meme si un autre media query cache)

**CTA accent par type de card :**

| Card | CTA background/border (light) | CTA color (light) |
|------|------------------------------|-------------------|
| Featured | `rgba(#7c4dff, 0.10)` / `0.18` | `#6a3de8` |
| Journey | `rgba(#5c6a8a, 0.10)` / `0.18` | `#5c6a8a` |
| Article | `rgba($accent-article, 0.10)` / `0.18` | `$accent-article` |
| Quiz | `rgba(#0d7c51, 0.10)` / `0.18` | `#0d7c51` |
| Monthly Zone | `rgba(#b07c10, 0.10)` / `0.18` | `#b07c10` |

**Accent top bars (secondary cards) :** gradient `$primary-indigo → accent color → accent-light` par type.

**Featured distinction :** `border-color: rgba(#7c4dff, 0.14)` + `box-shadow` violet glow + `inset 0 0 0 1px rgba(#7c4dff, 0.04)`

**Hero title compacte :** logo 85px, margins reduits, padding-top: 0

**Carousel section :** separateur gradient renforce (`$primary-blue → $primary-indigo → $primary-violet`), icon/titre colores indigo

### Voyages sonores (`features/journeys/`)

#### Palette Slate-Indigo

| Role | Valeur | Usage |
|------|--------|-------|
| `$accent` | `#5c6a8a` | Accent principal light |
| `$accent-light` | `#8fb4d8` | Accent dark mode |
| `$accent-dark` | `#2e3548` | Extremite sombre des gradients |
| Gradient card | `#2e3548 -> #5c6a8a` | Visual des cards |
| Border-left light | `rgba(#5c6a8a, 0.35)` | Bordure card |
| Border-left dark | `rgba(#8fb4d8, 0.3)` | Bordure card dark |

#### Image de couverture (`coverImage`)

Chaque voyage sonore peut avoir une image de couverture configurable par l'admin, avec cadrage et zoom (meme pattern que les terroirs).

**Schema & modele :**
- `amplify/data/resource.ts` : champs `coverImage: a.string()`, `coverImagePosition: a.string().default('center')`, `coverImageZoom: a.integer().default(100)` sur le modele `SoundJourney`
- `sound-journey.model.ts` : `coverImage?`, `coverImagePosition?`, `coverImageZoom?`
- `MonthlyJourney` : `journeyCoverImage` (denormalise)

**S3 Storage :**
- Chemin : `journeys/images/${sanitizedFilename}`
- Acces : `journeys/*` dans `amplify/storage/resource.ts` (read auth+guest, write/delete ADMIN)
- Service : `uploadJourneyImage()`, `getJourneyFileUrl()` dans `sound-journey.service.ts`

**Admin dialog (`journey-dialog`) :**
- Onglet "Media" entre Info et Traductions
- Drop zone + drag-to-frame (cadrage vertical) + zoom (molette/boutons) — meme UX que zone-dialog
- Signals : `coverImageKey`, `coverImagePreviewUrl`, `coverImagePosition`, `coverImageZoom`, `imageUploadProgress`, `isDraggingImage`
- Migration keywords (`top`/`center`/`bottom`) vers pourcentage a l'init

**Liste publique (`journeys-list`) :**
- `coverImageUrls: signal<Map<string, string>>` — URLs presignees resolues apres chargement
- `getCoverImageUrl(journey)` — methode utilitaire pour le template
- Si image : `<img class="journey-cover">` + `.journey-cover-overlay` (gradient assombrissant) au-dessus du gradient de fond
- Si pas d'image : fallback gradient slate-indigo existant (inchange)
- Image avec `object-fit: cover`, `object-position` et `transform: scale()` depuis les champs du modele

**i18n (`admin.journeys.dialog.*`) :**
| Cle | FR | EN | ES |
|-----|----|----|-----|
| `tabMedia` | Media | Media | Multimedia |
| `coverImage` | Image de couverture | Cover image | Imagen de portada |
| `coverImageHint` | Format paysage recommande (1200x600) | Landscape format recommended (1200x600) | Formato horizontal recomendado (1200x600) |
| `uploadImage` | Deposer ou cliquer pour ajouter une image | Drop or click to add an image | Arrastrar o hacer clic para agregar una imagen |
| `dragToFrame` | Glisser pour cadrer | Drag to frame | Arrastrar para encuadrar |
| `uploadError` | Erreur lors de l'upload | Upload error | Error al subir |

#### Liste des voyages (`journeys-list`)

- Hero icon + journey cards + random card : tous en palette slate-indigo
- Pas de message "Aucun voyage disponible" : le random card est toujours visible, la grille ne s'affiche que si `journeys().length > 0`

#### Voyage aleatoire (`random-journey-sheet`)

- MatBottomSheet ouvert depuis la journeys-list
- Slider pour nombre de sons (1-10), chips pour filtre categorie
- Couleurs inline : header/slider/bouton en slate-indigo (`#2e3548`, `#5c6a8a`, `#8fb4d8`)
- `softenColor(hex)` : adoucit les couleurs vives de categorie pour les popups/indicateurs sur la carte (mix 55% original + 45% dark base `#1e1e2e`)
- Couleur par defaut (toutes categories) : `#5c6a8a`
- Stocke les sons dans `EphemeralJourneyService` puis navigue vers `/mapfly?ephemeralJourney=true`

#### EphemeralJourneyService (`core/services/ephemeral-journey.service.ts`)

- Service pour transmettre les donnees de voyage aleatoire entre composants
- Methodes : `set(sounds, name, color)`, `get()`, `hasData()`, `clear()`
- Utilise par `random-journey-sheet` (ecriture) et `mapfly` (lecture)

### Mapfly (`features/map/pages/mapfly/`)

- `ViewEncapsulation.None` (styles globaux pour popups Leaflet)
- **Featured mode** : animation cinematique fly-in, overlay violet, popup sans limitation de hauteur (maxHeight retire)
- **Journey mode** : navigation multi-etapes, couleur dynamique via `--journey-color`
- Offset popup : `lat + 0.0012` pour centrer popup visible au zoom 17

#### Mobile Bottom Sheet (`sound-popup-sheet.component`)

Popup son mobile via `MatBottomSheet` (au lieu du popup Leaflet desktop). Ouvert au clic d'un marker quand `isMobilePortrait`.

**Layout sheet-top :**
- `.sheet-title-row` : titre + icone clap/compteur sur la meme ligne (`display: flex; flex-wrap: wrap; gap: 6px; padding-right: 32px`)
- WaveSurfer player pleine largeur (waveform + controles play/time/mute)
- `.sheet-actions-bar` : boutons groupes avec dividers (`justify-content: center`) — layout `— | download share radar | +` (voir section "Boutons d'action popups"). Download masque si `license === 'READ_ONLY'`
- Mode journey : like row separee (titre dans le header), navigation prev/next/finish, bouton radar centre sous la navigation (`.sheet-radar-row`)

**Radar mini-carte embarquee (tous les modes) :**
- Bouton `.radar-toggle-btn` (32x32px, icone `radar`) present sur tous les types de bottom sheet (normal, featured, journey)
- Normal/Featured : dans le `.btn-scope` central de la barre d'actions, a cote de download/share
- Journey : dans `.sheet-radar-row` centree sous la navigation prev/next
- Au clic : `radarActive` signal toggle → `@if (radarActive())` rend un `<div class="sheet-radar-map">` (120px, full width, border-radius 10px)
- Mini-carte Leaflet autonome creee dans `initRadarMap()` : tuiles ESRI satellite (`World_Imagery`), zoom 2, `L.circleMarker` rouge (#ef4444) a la position du son, toutes interactions desactivees (dragging, zoom, etc.)
- **Label pays** : tooltip Leaflet permanent (`L.Tooltip`) affiche le nom du pays extrait de `city` (dernier segment apres virgule). Glassmorphism light/dark (`.radar-country-label`)
- **Visibilite** : meme regle que le minimap desktop — radar masque quand zoom < 5. Signal `currentZoom` mis a jour par `zoomIn()`/`zoomOut()`, computed `showRadar = currentZoom() >= 5`. Auto-fermeture du radar au zoom out (vue mondiale)
- Destruction propre dans `destroyRadarMap()` et `ngOnDestroy()`
- Aucune dependance au minimap natif Leaflet — la carte est directement dans le DOM de la bottom sheet (CDK overlay), donc aucun probleme de z-index/stacking context

**Zoom fort (aligne sur desktop) :**
- `onZoomIn` : `centerMarkerAboveSheet(lat, lng, 17)` — zoom directement au niveau 17
- `onZoomOut` : `centerMarkerAboveSheet(latAjuste, lng, 2)` — zoom directement au niveau 2 (vue mondiale). Ajustement latitude : `lat > 20 ? lat : lat + 30` (meme logique que le desktop)
- Journey : zoom in/out fonctionnels (n'etaient que des no-op avant)

**Licence :** badge centre `sheet-license-badge` avec tooltip tap-triggered (signal `showLicenseTooltip`, methode `toggleLicenseTooltip()`). Voir section "Licences de sons".

**Partage :** bouton share dans le groupe central des actions. Methode `share()` : Web Share API + clipboard fallback. Voir section "Partage de son".

**Bouton close contraste :** quand un header colore est present (featured violet, journey), le close button a un fond sombre `rgba(0,0,0,0.30)` et icone blanche via `.featured-header ~ .sheet-close-btn` / `.journey-header ~ .sheet-close-btn`. Positionne a `top: 22px` pour etre centre verticalement sur la banniere coloree (vs `top: 6px` par defaut). Le close button est place APRES les headers dans le DOM pour que le selecteur `~` fonctionne (position absolute donc pas d'impact visuel). Dark theme : fond `rgba(0,0,0,0.40)` (overlay sombre fonctionne sur toute banniere coloree).

**Drapeau :** `::ng-deep .sheet-record-info img` force `18x13px !important` pour eviter les drapeaux surdimensionnes.

**Traduction :** bouton centre (`align-self: center`), `margin-bottom: 6px`.

**Nettoyage ngOnDestroy :** `this.activeSheetRef?.dismiss()` + `this.bottomSheet.dismiss()` pour fermer toute sheet ouverte lors de la navigation hors de mapfly.

#### Centrage marker au-dessus de la bottom sheet

`centerMarkerAboveSheet(lat, lng, zoom?)` : centre le marker dans la zone de carte visible (moitie superieure, au-dessus de la sheet). Utilise `map.project/unproject` pour calculer le decalage pixel (`sheetHeight / 2`). Appele :
- A l'ouverture de la sheet (`openSoundSheet`)
- Au clic des boutons zoom dans la sheet (callbacks `onZoomIn`/`onZoomOut`)

#### Cercle de selection marker (mobile)

`L.circleMarker` ajoute autour du marker actif quand une bottom sheet s'ouvre (`openSoundSheet`). Skip en mode journey et featured (pulse circle deja present).

**Styles :** `radius: 22`, `weight: 3`, `opacity: 0.9`, `fillOpacity: 0.15`, classe CSS `marker-selection-ring` avec animation `selectionPulse` (0.9↔0.5 opacity) + `drop-shadow` halo colore (visibilite sur fonds satellite sombres).

**Race condition (piege connu) :** quand on enchaine 2 sons, le `afterDismissed` de l'ancienne sheet se declenche apres la creation du nouveau cercle. Le callback capture une reference locale (`circleForThisSheet`) et ne nettoie que si `activeSelectionCircle === circleForThisSheet` — ne touche jamais un cercle cree par un appel ulterieur.

#### Overlays cinematiques — pre-chargement i18n

Les overlays featured et journey utilisent `await firstValueFrom(translate.use(currentLang))` avant d'afficher l'overlay (`overlayVisible.set(true)`) pour garantir que les traductions sont chargees et eviter un flash de la langue par defaut.

Le `featuredLabel` passe a la bottom sheet est la cle i18n (`'home.hero.soundOfTheDay'`), traduite dans le template via `{{ data.featuredLabel | translate }}`. Le popup desktop utilise `translate.instant()` (cree apres l'animation, traductions deja chargees).

#### Controles conditionnels par mode

- **Mode categorie** (`isCategoryMode()`) : `groupedLayersControl` (selecteur de layers/categories) masque — inutile puisqu'on est deja dans une categorie filtree
- **Mode zone** (`isZoneMode()`) : bouton recherche par lieu ("places") masque dans la barre de recherche — seule la recherche par son reste disponible
- **Lang change** : la recreation du `groupedLayersControl` est gardee par `if (this.groupedLayersControl)` pour eviter erreur en mode categorie

#### Zone mode - fitBounds polygone

- Apres affichage du polygone dans `displayZoneOnMap()`, `fitBounds` est appele sur les bounds du polygone
- **Mobile portrait** : `paddingTopLeft: [30, 80]`, `paddingBottomRight: [30, 140]` (espace pour barre de recherche en haut + timeline bar + bottom nav en bas)
- **Desktop** : `padding: [60, 60]` uniforme

#### Zone mode - donnees utilisateur dans les popups

- `getSoundsForZone()` utilise la requete GraphQL custom `ListSoundsByZoneWithUser` (dans `amplify-queries.model.ts`) qui inclut `user { username country }`
- Meme pattern que `ListSoundsForMapWithAppUser` pour la carte normale — garantit que le "recorded at by username" s'affiche dans les popups de la carte terroir

#### Journey mode - popups et stepper

- **Popup header** : gradient d'opacite premium (`linear-gradient(180deg, ${color} 0%, ${color}cc 100%)`)
- **Popup contenu** : inclut `shortStory` et liens externes (`url`, `urlTitle`, `secondaryUrl`, `secondaryUrlTitle`)
- **Stepper** (indicateur d'etapes) : dots horizontaux enveloppes dans `.journey-stepper-scroll-wrap` avec fleches de navigation (chevrons gauche/droite)
- **Scrollbar** : masquee (`scrollbar-width: none` + `::-webkit-scrollbar { display: none }`), remplacee par les fleches visibles
- **Scroll desktop** : evenement `wheel` converti en scroll horizontal + clic fleches (80px smooth)
- **Visibilite fleches** : `updateArrows()` masque les fleches aux extremites du scroll
- **Bouton "Terminer"** (derniere etape) : navigue vers `/journeys` (liste des voyages sonores)

### Welcome / Goodbye Overlay (`app.component`)

- **Design premium** : logo (avec drop-shadow halo) → greeting uppercase (letter-spacing 2.5px) → divider gradient bleu→orange (scaleX animation) → nom en gradient text → subtitle discret
- **Animations stagger** : card (0s) → logo (0.1s) → greeting (0.2s) → divider (0.3s) → nom (0.35s) → subtitle (0.5s)
- **Easing** : `cubic-bezier(0.22, 1, 0.36, 1)`
- **Light/Dark** : fond `rgba(255,255,255,0.95)` / `rgba(22,22,38,0.95)`, gradient text adapte
- **Responsive** : `@media (max-width: 480px)` paddings reduits, typo adaptee
- **Timing** : Welcome 2.5s visible + 1s fade, Goodbye 2s visible + 1s fade
- **Signals** : `welcomeVisible`, `welcomeFadingOut`, `welcomeUsername`, `goodbyeVisible`, `goodbyeFadingOut`, `goodbyeUsername`
- **i18n** : `home.welcomeGreeting/welcomeSubtitle/goodbyeGreeting/goodbyeSubtitle` (FR/EN/ES)
- **Goodbye** : capture le username via `appUserService.currentUser` AVANT `clearCurrentUser()`

## Politique d'acces public (mode deconnecte)

### Principe

Toutes les lectures de contenu sont publiques (`authMode: 'apiKey'`). L'ecriture (scores, sons, compte) requiert l'authentification Cognito (`userPool`).

### Services corriges pour acces public

Les appels GraphQL de lecture DOIVENT inclure `{ authMode: 'apiKey' }` pour fonctionner en mode deconnecte :

| Service | Methodes avec `apiKey` |
|---------|----------------------|
| `featured-sound.service.ts` | `getTodayFeatured()` |
| `article.service.ts` | `listPublishedArticles()`, `getArticleBySlug()`, `getMonthlyArticle()` |
| `quiz.service.ts` | `listPublishedQuizzes()`, `getQuiz()`, `getQuizQuestions()`, `getMonthlyQuiz()`, `getSoundFilename()`, `getLeaderboard()`, `getAttempt()` |
| `zone.service.ts` | `listZones()`, `getZoneById()`, `getZoneBySlug()`, `getMonthlyZone()`, `listZoneSoundsByZone()`, `listZoneSoundsBySound()`, `getSoundsForZone()` |
| `sound-journey.service.ts` | `listPublicJourneys()`, `getJourney()`, `listSteps()` |

### Quiz en mode deconnecte

- L'utilisateur peut jouer sans se connecter
- `quiz-play.component.ts` : `finishQuiz()` navigue toujours vers `/quiz/:id/results/local` avec state local (meme flux pour authentifie et guest)
- L'enregistrement du score (`submitAttempt`) requiert l'authentification
- Le schema `QuizAttempt` n'autorise `create` que pour `authenticated`

### Questions par partie (`questionsPerPlay`)

Chaque quiz a un nombre de questions par partie (`questionsPerPlay`, defaut 5) independant du nombre total de questions associees (`questionCount`).

- **Schema** : `Quiz.questionsPerPlay: a.integer().default(5)` dans `amplify/data/resource.ts`
- **Admin dialog** : champ nombre dans l'onglet General, validation a la publication (impossible si `questionCount < questionsPerPlay`)
- **Quiz play** : Fisher-Yates shuffle pour selectionner aleatoirement `questionsPerPlay` questions parmi le pool total
- **Lobby** : affiche `questionsPerPlay` questions + "(sur X)" si pool > questionsPerPlay, temps estime base sur questionsPerPlay
- **Liste publique** : affiche `questionsPerPlay` questions (pas le total)
- **Admin list** : affiche ratio `questionsPerPlay / questionCount`
- **Scoring** : max 150 points par question (100 base + 0-50 bonus vitesse), `maxScore = questionsPerPlay * 150`

### Publication optionnelle du score et classement

Le score n'est plus auto-soumis a la fin du quiz. L'utilisateur choisit de publier ou non depuis la page resultats.

**Flux :**
1. Quiz termine → navigation vers `/quiz/:id/results/local` (state local avec score, answers, questions)
2. Page resultats charge le quiz + leaderboard top 10 (API publique `apiKey`)
3. Position estimee affichee avant publication (comparaison score vs leaderboard)
4. Bouton "Publier mon score" (authentifie uniquement) → `submitAttempt` → refresh leaderboard → position reelle
5. Ligne du joueur highlight en emerald dans le classement
6. Si joueur hors top 10 : separateur "..." + sa ligne en bas du classement
7. Bouton "Voir classement complet" si >= 10 entrees → charge 100 entrees
8. Guest : banniere d'avertissement, pas de bouton publier

**Signals cles (`quiz-results.component.ts`) :**
- `published`, `publishing`, `publishedAttemptId`, `publishedRank` : etat publication
- `showFullLeaderboard`, `fullLeaderboard`, `loadingFull` : classement complet
- `estimatedRank` (computed) : position estimee avant publication
- `displayLeaderboard` (computed) : top 10 ou complet selon `showFullLeaderboard`
- `userInDisplayedList`, `publishedEntry` (computed) : detection/affichage joueur dans le classement

**Styles (`quiz-results.component.scss`) :**
- Palette emerald (`$emerald: #0d7c51`, `$emerald-light: #66bb6a`)
- `.leaderboard-row.current-user` : highlight emerald
- `.rank-1/.rank-2/.rank-3` : or `#ffc107` / argent `#90a4ae` / bronze `#cd7f32`
- Stars animees (bounce staggere)

**i18n :** `quiz.results.estimatedRank`, `quiz.results.publish`, `quiz.results.publishing`, `quiz.results.published`, `quiz.results.showAll`

## Admin — Override manuel des elements mis en valeur

### Principe

Les elements mis en valeur (son du jour, quiz/zone/voyage/article du mois) sont peuples automatiquement par des Lambdas (`pick-daily-featured-sound`, `pick-monthly-quiz`, `pick-monthly-zone`, `pick-monthly-journey`, `pick-monthly-article`). Quand l'admin modifie un element source (ex: nom d'une zone), les donnees denormalisees dans les tables Monthly*/DailyFeatured* ne sont pas mises a jour automatiquement.

Chaque section admin dispose d'un bouton (icone `star` ou `today`) pour forcer manuellement la (re)creation de l'element mis en valeur avec les donnees a jour.

### Services — methodes d'override

| Service | Methode | Action |
|---------|---------|--------|
| `zone.service.ts` | `setMonthlyZone(zone)` | Desactive les MonthlyZone actifs du mois, cree un nouveau avec donnees denormalisees (zoneName, zoneName_i18n, zoneDescription, zoneDescription_i18n, zoneSlug, zoneCoverImage, zoneIcon, zoneColor) |
| `sound-journey.service.ts` | `setMonthlyJourney(journey)` | Desactive les MonthlyJourney actifs du mois, cree un nouveau avec donnees denormalisees (journeyName, journeyName_i18n, journeyDescription, journeyDescription_i18n, journeySlug, journeyColor, journeyCoverImage) |
| `article.service.ts` | `setMonthlyArticle(article)` | Desactive les MonthlyArticle actifs du mois, cree un nouveau avec donnees denormalisees (articleTitle, articleTitle_i18n, articleSlug, articleCoverImageKey, articleAuthorName, articleDescription, articleDescription_i18n) |
| `featured-sound.service.ts` | `forcePickDaily(candidate)` | Supprime le DailyFeaturedSound existant pour aujourd'hui, recup le Sound associe, cree un nouveau DailyFeaturedSound avec donnees denormalisees |
| `quiz.service.ts` | `setMonthlyQuiz(quiz)` | (preexistant) Meme pattern pour le quiz du mois |

### Modele MonthlyArticle

Interface `MonthlyArticle` dans `article.model.ts` : `id`, `articleId`, `month`, `active`, `articleTitle`, `articleTitle_i18n`, `articleSlug`, `articleCoverImageKey`, `articleAuthorName`, `articleDescription`, `articleDescription_i18n`.

Methode `getMonthlyArticle()` dans `article.service.ts` : query par mois courant avec `authMode: 'apiKey'`, filtre actifs, mappe les champs i18n avec `JSON.parse`.

### Composants admin — boutons d'override

| Composant | Bouton | Methode | Icone |
|-----------|--------|---------|-------|
| `zones.component` | Terroir du mois | `setAsMonthly(zone)` | `star` |
| `journeys.component` | Voyage du mois | `setAsMonthly(journey)` | `star` |
| `article-admin-list.component` | Article du mois | `setAsMonthly(article)` | `star` |
| `featured-sound.component` | Son du jour | `setAsDaily(candidate)` | `today` |

Chaque bouton appelle le service, affiche un snackBar de succes, et recharge les donnees.

### Home page — article du mois

`home.component.ts` : `loadArticle()` tente d'abord `getMonthlyArticle()`, convertit le `MonthlyArticle` en `SoundArticle` (mapping des champs prefixes), puis fallback sur `getLatestPublishedArticle()` si pas de monthly article.

### i18n

| Cle | FR | EN | ES |
|-----|----|----|-----|
| `admin.zones.actions.monthly` | Terroir du mois | Monthly zone | Terroir del mes |
| `admin.zones.monthlySet` | Terroir du mois defini | Monthly zone set | Terroir del mes definido |
| `admin.journeys.actions.monthly` | Voyage du mois | Monthly journey | Viaje del mes |
| `admin.journeys.monthlySet` | Voyage du mois defini | Monthly journey set | Viaje del mes definido |
| `admin.articles.actions.monthly` | Article du mois | Monthly article | Articulo del mes |
| `admin.articles.monthlySet` | Article du mois defini | Monthly article set | Articulo del mes definido |
| `admin.featuredSound.actions.setDaily` | Definir son du jour | Set as today's sound | Definir sonido del dia |
| `admin.featuredSound.dailySet` | Son du jour defini | Daily sound set | Sonido del dia definido |

## Icone customisable par quiz

### Principe

Chaque quiz peut avoir une icone Material associee, configurable par l'admin. Meme pattern que les zones (`zone-dialog`).

### Schema & modele

- `amplify/data/resource.ts` : champ `icon: a.string()` sur le modele `Quiz`
- `quiz.model.ts` : `icon?: string` dans l'interface `Quiz`
- `quiz.service.ts` : `mapQuiz()` mappe `icon`, `createQuiz()` et `updateQuiz()` transmettent le champ

### Admin dialog (`quiz-edit-dialog`)

- Tableau `availableIcons` : 16 icones adaptees (quiz, music_note, headphones, graphic_eq, public, terrain, forest, waves, pets, location_city, church, festival, emoji_events, star, explore, psychology)
- `mat-select` avec preview Material icon + label dans l'onglet General
- Form control `icon` avec defaut `'quiz'`
- Style `.icon-option` : inline-flex, gap 8px, icone 20px

### Templates publics (fallback)

- `quiz-list.component.html` : `quiz.icon || (isMonthly(quiz) ? 'emoji_events' : 'quiz')`
- `quiz-lobby.component.html` : `quiz()!.icon || 'quiz'`
- `home.component.html` : `monthlyQuiz()!.icon || 'quiz'`

### i18n

- Cle `admin.quiz.dialog.icon` : FR "Icone", EN "Icon", ES "Icono"

## Community Stats (`SoundsService.getCommunityStats()`)

### Principe

Compteurs communautaires affiches dans la section onboarding de la home page mobile : nombre total de sons publics, nombre de pays, nombre de contributeurs.

### Architecture

- **Methode** : `getCommunityStats()` dans `sounds.service.ts`
- **Interface** : `CommunityStats { soundCount, countryCount, contributorCount }`
- **Source** : pagination complete de `Sound.listSoundsByStatus({ status: 'public' })` avec `authMode: 'apiKey'`, `selectionSet: ['id', 'userId', 'city']`
- **Comptage pays** : extraction du dernier segment de `city` (format "City, Country"), `toLowerCase()` + `Set` pour deduplication
- **Comptage contributeurs** : `Set<string>` sur `userId`
- **Cache** : 5 minutes (`cachedStats.ts` check)
- **Chargement** : inclus dans le `Promise.allSettled` du `ngOnInit` de la home page

## Filtre temporel carte mondiale (Time Filter)

### Principe

Filtrage 100% client-side des markers sur la carte mondiale (mode normal uniquement). Permet de voir les 10 derniers sons, ceux de la semaine, ou du mois. Les chips "Semaine" et "Mois" n'apparaissent que si des sons correspondants existent.

### Pipeline de donnees

- `createdAt` (auto-genere par Amplify/DynamoDB) inclus dans la query GraphQL `ListSoundsForMapWithAppUser`
- Mappe dans `Sound.createdAt` (type `Date`) via `sounds.service.ts`
- Aucun changement backend : la Lambda retourne deja `...sound` (spread de tous les champs)

### Architecture markers (point critique)

Les markers sont ajoutes dans **deux couches** simultanement : `fgAll` (master group) ET un subgroup categorie (`fg1`-`fg9`). Tous sont enfants de `markersCluster` (L.markerClusterGroup). Pour masquer un marker, il faut utiliser `markersCluster.removeLayer()` / `addLayer()` directement — retirer de `fgAll` seul ne suffit pas car le marker reste visible via le subgroup categorie.

### Variable shadowing (piege connu)

Dans la boucle de creation des markers, `const category: CategoryKey = s.category!` shadows le `category` des route params. Le flag `isNormalMode` doit etre calcule **avant** la boucle for pour eviter ce piege.

### Signals

```typescript
timeFilter: signal<'all' | 'latest10' | 'week' | 'month'>('all')
timeFilterCounts: signal<{ all, latest10, week, month }>
hasWeekSounds: signal<boolean>
hasMonthSounds: signal<boolean>
normalModeMarkerMap: { createdAt: Date; marker: L.Marker }[]
```

### Methodes cles

- `computeTimeFilterCounts()` : calcule compteurs et determine visibilite des chips conditionnels
- `toggleTimeFilter(filter)` : toggle (re-clic = retour a 'all'), meme pattern que le filtre saisonnier
- `applyTimeFilter(filter)` : `markersCluster.removeLayer/addLayer` + `flyToBounds` vers markers visibles

### UI

- **Desktop** : chips glassmorphism avec icone + label + compteur, `left: 58px` (apres boutons zoom)
- **Mobile portrait** : icons-only compactes, tooltip au press (`:active::after` avec `attr(data-label)`)
- **Dark/light** : fond opaque sur chips actifs (`rgba(21,101,192,0.85)`, texte blanc) pour lisibilite sur fond satellite
- **Condition d'affichage** : mode normal uniquement (`!zoneId && !category && !secondaryCategory && !userId`)

### i18n

Cles `mapfly.timeFilter.*` : `all`, `latest10`, `week`, `month` (FR/EN/ES)

## Page de connexion (`core/pages/auth/login/`)

### Mobile portrait

- `min-height: calc(100dvh - 48px - 56px - env(safe-area-inset-bottom))` (toolbar + bottom nav)
- `justify-content: flex-start` + `overflow-y: auto` (scrollable si formulaire trop grand)
- **Small phones** (`max-height: 700px`) : logo 60px, titre 1.2rem, paddings compacts

## Toolbar — masquage conditionnel du logo

Le logo de la toolbar est masque sur certaines pages pour eviter la redondance visuelle :

- **Home page** (desktop) : classe `.hide-desktop-home` via `isHomePage()` ou `isCategoryMapPage()`
- **Page de connexion** : classe `.hide-login` via `isLoginPage()` (la page affiche deja le logo Ecnelis FLY dans le formulaire d'authentification)
- **Mobile portrait** : logo toolbar toujours masque (`display: none`), titre `.app-title` stylise en uppercase bold (`font-weight: 800`, `letter-spacing: 1.2px`, `color: #555` light / `#9a9ab0` dark). Toolbar `position: sticky; top: 0; z-index: 50` + glassmorphism (`backdrop-filter: blur(20px)`)

Signals dans `app.component.ts` : `isHomePage`, `isLoginPage`, `isCategoryMapPage` — mis a jour via `Router.events` (`NavigationEnd`).

## Navigation mobile (bottom nav + sidenav)

### Bottom nav (`app.component`)

- **Position** : `position: fixed` **en dehors** de `<mat-sidenav-container>` (evite `overflow: hidden` du container Angular Material)
- **Condition** : `@if (isMobilePortrait() && !sidenavOpened())` — masquee quand sidenav ouverte ou en desktop
- **z-index** : `100` (en dessous du CDK overlay container a `1000`, donc sous les dialogs/bottom-sheets)
- **Hauteur** : `56px` + `padding-bottom: env(safe-area-inset-bottom)`
- **Couleurs inactives** : `#555` light / `#777` dark
- **Couleurs actives** : `#1976d2` light / `#90caf9` dark
- **Content padding** : `mat-sidenav-content { padding-bottom: calc(56px + env(safe-area-inset-bottom)) }` en mobile portrait

### Badges de notifications (`app.component`)

Badges numeriques sur les icones de navigation, geres par deux signals dans `app.component.ts` :

| Signal | Source | Affichage |
|--------|--------|-----------|
| `notificationCount` | `computed(() => appUser()?.newNotificationCount ?? 0)` | Badge rouge sur icone menu (desktop hamburger + bottom nav) |
| `pendingSoundsCount` | `signal(0)` charge via `dashboardService.getPendingSoundsCount()` | Badge orange sur roue crantée admin (desktop gear + bottom nav si `isAdmin()`) |

**Chargement `pendingSoundsCount` :** appele au `ngOnInit` et dans le handler Hub `signedIn`. Query legere `selectionSet: ['id']`, filtre `status: public_to_be_approved`, limit 500. Reset a 0 au `signedOut`.

**Reset `notificationCount` :** `toggleSidenav()` appelle `appUserService.resetNotifications()` quand le sidenav s'ouvre et que `notificationCount() > 0`. Met a jour `newNotificationCount: 0, flashNew: false` en base via `User.update`.

**Structure HTML :** wrapper `.nav-icon-badge-wrap` (relative inline-flex) autour de `<mat-icon>` + `<span class="notif-badge">` en position absolue top-right. Classe `.admin-badge` pour la variante orange.

**Styles (`app.component.scss`) :**
- `.nav-icon-badge-wrap` : `position: relative; display: inline-flex`
- `.notif-badge` : fond `#e53935` (rouge), `10px`, `border-radius: 50%`, `position: absolute; top: -4px; right: -6px`
- `.notif-badge.admin-badge` : fond `#f57c00` (orange)

### Sidenav mobile

- **Position** : `'end'` (droite) en mobile portrait, `'start'` (gauche) en desktop — `[position]="isMobilePortrait() ? 'end' : 'start'"`
- **Plein ecran** : `width: 100vw; max-width: 100vw; box-shadow: none` en mobile portrait
- **Desktop** : `width: 320px; max-width: 85vw`
- **Liens sociaux** (`.sidenav-social`) : icones Facebook + Instagram, visibles desktop ET mobile, placees entre le "Son du jour" et le footer. `flex-shrink: 0` (jamais compressees). URLs : `facebook.com/ecnelisfly`, `instagram.com/ecnelisfly`
- **Footer** (theme toggle + langue + "Sounds of the world") : masque en desktop (`display: none` pour `min-width: 701px`), visible uniquement en mobile. Styles dans `sidenav-menu.component.scss` (`.sidenav-footer`)
- **Nav scrollable** : `.sidenav-nav` a `flex: 1; overflow-y: auto; min-height: 0` — si les items de navigation depassent l'espace disponible, le nav scrolle en interne. Featured sound et liens sociaux restent toujours visibles en bas (`flex-shrink: 0`)
- **Small phones** (`@media max-height: 700px`) : espacements compacts — header padding reduit, close-btn margin reduit, nav padding/gap reduits, nav-item padding compact (11px 16px) + font 0.92rem, featured-sound padding/margin reduits, footer padding reduit. Permet a tout le contenu de tenir sans scroll sur 375x667

### Pages avec elements fixes en bas (compatibilite bottom nav)

- **Quiz lobby** : `.start-section { bottom: 56px }` en mobile portrait
- **Mapfly timeline bar** : `bottom: 70px` en mobile portrait (au-dessus du nav de 56px + marge)

### Leaflet controls — Premium glassmorphism (map.scss)

Zoom (+/-) et layers switcher stylises avec glassmorphism light/dark, proportionnes aux controles natifs Leaflet (30x30px).

- **Zoom** : `border-radius: 10px`, fond `rgba(255,255,255,0.92)` light / `rgba(14,14,28,0.88)` dark, `backdrop-filter: blur(12px)`, hover bleu. Masque en mobile portrait (pinch-to-zoom)
- **Base layers toggle** (bottom-left) : icone carte pliee (map SVG) grise (`#555555` light / `#9a9ab0` dark), 36x36px desktop, `cursor: pointer`. Desktop : `collapsed: !isMobilePortrait` (toggle bouton), ouverture au **clic uniquement** (override `expand()` avec flag `clickTriggered`). Mobile : toujours expanded (chips horizontaux)
- **Categories toggle** (bottom-right) : panneau custom `.desktop-category-panel` (`position: absolute; bottom: 8px; right: 10px`), aligne avec les controles Leaflet bottom-left. Icone stacked layers grise, meme dimensions et couleurs que base layers
- **Layers expanded** : `border-radius: 8px`, padding compact `5px 8px`, font `0.7rem`, radios `12px`, `backdrop-filter: blur(16px)`. Texte `#1a1a2e` light / `#b0b8cc` dark (gris-bleu doux, harmonise avec le fond sombre). Labels avec hover bleu subtil, `accent-color: #1976d2` light / `#90caf9` dark. Inputs non coches : `color-scheme: dark` pour contour gris (pas blanc vif)
- **Popup close button** : `.leaflet-popup-close-button` stylise en bouton circulaire 28px (meme design que le bottom sheet mobile). Light : fond `rgba(0,0,0,0.06)`, icone `#666`, hover `0.12`. Dark : fond `rgba(255,255,255,0.12)`, icone `#ddd`, hover `0.20`
- **Tooltips** : natifs (`title` attribute) sur les 3 boutons (radar, base layers, categories). Pas de tooltips CSS custom (incompatible `overflow: hidden` du minimap container)

### Minimap / Radar (`leaflet-minimap` v3.6.1)

Preview miniature de la carte pour reperage global. Deux implementations distinctes :
- **Desktop** : plugin `leaflet-minimap` natif avec toggle collapse/expand (styles custom dans `map.scss`)
- **Mobile (bottom sheet)** : mini-carte Leaflet autonome embarquee dans `sound-popup-sheet.component.ts` (tuiles ESRI satellite, voir section "Mobile Bottom Sheet" ci-dessus)

#### Configuration (`mapfly.component.ts` — `initMinimap()`)

- **Position** : `bottomleft`
- **Taille** : 150x120 deploye (desktop et mobile identiques), 36x36 collapse desktop, 30x30 collapse mobile
- **Etat initial** : `minimized: true` (toujours collapse au demarrage)
- **Zoom** : `zoomLevelFixed: 2` (vue mondiale fixe pour reperage global)
- **Point indicateur** : `L.circleMarker` rouge (#ef4444, radius 5) ajoute sur le minimap interne (`_miniMap`), suit le centre de la carte principale via `map.on('move')`
- **Masquage auto** : minimap masque quand zoom principal < 5 (vue monde, le radar n'apporte rien). Reapparait a zoom >= 5
- **TypeScript definitions** : `src/types/leaflet-minimap.d.ts`

#### Icones toggle (CSS)

- **Deploye** : overlay sombre semi-transparent (`rgba(0,0,0,0.30)`) coin haut-droit, chevron blanc (CSS border trick, `rotate(-135deg)`), `border-radius: 0 8px 0 0`
- **Collapse** : icone radar SVG grise (`#555555` light / `#9a9ab0` dark), fond glassmorphism transparent, container masque (`:has(a[class*="minimized-"])` → `border: none; background: transparent; box-shadow: none`)
- **Container** : `border-radius: 10px`, overflow hidden, aimingRect rouge (`#ef4444`, dash `4 4`)

#### Positionnement desktop

- Dans le `.leaflet-bottom.leaflet-left` naturel de Leaflet, empile avec le base layers toggle
- Desktop : base layers toggle (36x36) au-dessus du radar toggle (36x36), `margin-bottom: 8px`

#### Positionnement mobile (`map.scss` + `mapfly.component.scss`)

- **Minimap** : `position: fixed; left: 6px; bottom: calc(58px + safe-area); margin: 0; z-index: 600` — bas-gauche juste au-dessus de la bottom nav
- **Base layers chips** : centres horizontalement via flexbox sur `.leaflet-bottom.leaflet-left` (`display: flex; justify-content: center`). Pas de `transform: translateX(-50%)` (casserait `position: fixed` du minimap enfant)
- **Interaction radar/chips** : quand minimap deploye, les chips glissent a droite (`:has(.leaflet-control-minimap a:not([class*="minimized-"])) { justify-content: flex-end }`). Quand collapse, retour au centre. Transition fluide 0.3s

#### i18n

| Cle | FR | EN | ES |
|-----|----|----|-----|
| `mapfly.minimap.toggle` | Carte radar | Radar map | Mapa radar |
| `mapfly.baselayers.title` | Fond de carte | Base map | Mapa base |
| `mapfly.categories.toggle` | Categories | Categories | Categorias |

### Fond de carte automatique mobile

Sur mobile portrait, le fond de carte bascule automatiquement selon le zoom, sans tenir compte du choix manuel de l'utilisateur :
- **Zoom <= 6** : ESRI World Imagery (satellite pur, vue mondiale)
- **Zoom > 6** : Mapbox satellite-streets (satellite avec labels rues)
- Le parametre URL `basemap` est ignore en mobile (toujours auto satellite)
- Desktop : le comportement est inchange (bascule auto sauf si l'utilisateur a choisi manuellement)
- Le handler `zoomend` gere aussi le retrait de la couche OSM si elle etait active

### WaveSurfer Audio Player (`wavesurfer-player.service.ts`)

Remplace le `<audio controls>` HTML5 natif par un player custom avec waveform cliquable. Utilise dans les popups Leaflet desktop ET le bottom sheet mobile.

#### Architecture

- **Utilitaire factory** (pas injectable Angular) : `createWaveSurferPlayer(config)` → `WaveSurferPlayerInstance`
- Pas dans le DI Angular car utilise aussi dans les popups Leaflet (HTML strings + wiring JS post-open)
- Le service cree le DOM complet : `.ws-player` > `.ws-waveform` + `.ws-controls`

#### Structure DOM

```
.ws-player
  .ws-waveform          ← waveform 32px cliquable (seek)
    .ws-skeleton         ← equalizer loader (5 barres animees, retire au ready)
  .ws-controls
    .ws-play-btn         ← play/pause (material-icons)
    .ws-time-current     ← 0:00
    .ws-time-separator   ← /
    .ws-time-total       ← 0:32
    .ws-spacer           ← flex: 1
    .ws-mute-btn         ← mute toggle (material-icons)
```

#### Couleurs

| Element | Light | Dark |
|---------|-------|------|
| Waveform non lue | `rgba(0,0,0,0.20)` | `rgba(255,255,255,0.50)` |
| Waveform lue | `#1976d2` | `#90caf9` |
| Play btn fond | `rgba(25,118,210,0.1)` | `rgba(144,202,249,0.12)` |
| Play btn icone | `#1976d2` | `#90caf9` |
| Mute icone | `#666` | `#aaa` |
| Temps | `#555` | `#bbb` |

#### Skeleton equalizer loader

5 barres animees (`ws-eq-bounce`, stagger 0.12s) aux couleurs accent du player (`#1976d2` light / `#90caf9` dark). S'affichent immediatement a l'ouverture du popup/sheet, disparaissent en fade-out (0.35s) quand wavesurfer emet `ready`. Element retire du DOM apres 400ms.

#### Fallback Chromium WAV 32-bit float

Les navigateurs Chromium (Chrome, Edge, Opera, Brave) ne peuvent pas lire les fichiers WAV 32-bit float via `<audio>`, mais `AudioContext.decodeAudioData()` reussit (la waveform s'affiche normalement).

**Mecanisme :** apres l'evenement `decode` de WaveSurfer, sur les navigateurs Chromium :
1. Re-fetch l'audio original (depuis le cache navigateur)
2. Decodage a la frequence native (48000 Hz) via un `AudioContext` separe (WaveSurfer decode a 8000 Hz par defaut pour la waveform — inutilisable pour la lecture)
3. Re-encodage en WAV 16-bit PCM via `audioBufferToWav16()` (conversion 32→16 bit inaudible, sample rate natif preserve)
4. Swap direct du `<audio>.src` vers le Blob URL 16-bit (`ws.getMediaElement().src = blobUrl`)
5. Suppression des erreurs residuelles de l'ancien `<audio>` src (`chromeFallbackApplied` guard)

**Qualite :** identique a l'original — seule la profondeur de bits change (32-bit float → 16-bit PCM = qualite CD). Le sample rate natif (48000 Hz) est integralement preserve.

**Detection :** `const isChromium = /Chrome/.test(navigator.userAgent)` — couvre Chrome, Edge, Opera, Brave. Firefox n'est pas affecte (gere le WAV 32-bit float nativement).

**Flags :** `chromeFallbackApplied` (evite double application), `chromeFallbackBlobUrl` (revoque via `URL.revokeObjectURL()` au `destroy` et `loadUrl`).

**Fonction utilitaire :** `audioBufferToWav16(buffer: AudioBuffer): Blob` — encode un AudioBuffer en WAV PCM 16-bit. Header RIFF/WAVE standard 44 octets + donnees entrelacees float32→int16 (`sample * 0x7FFF`, clampe [-1, 1]).

#### Integration desktop (popups Leaflet)

- Propriete `activePopupPlayer: WaveSurferPlayerInstance | null`
- HTML : `<div class="ws-popup-player" id="ws-player-${id}"></div>`
- `popupopen` : `requestAnimationFrame(() => { createWaveSurferPlayer(...); startThemeObserver(); })` — attend que le DOM popup soit pret, puis demarre l'observer de theme
- `popupclose` : `stopThemeObserver(); activePopupPlayer.destroy(); null`
- 3 types : normal, featured, journey — meme pattern

#### Encadrement WaveSurfer desktop (`.ws-popup-player`)

Container stylise dans `map.scss` (desktop uniquement, absent du bottom sheet mobile) :
- `border-radius: 10px`, `padding: 10px 12px`, `margin-bottom: 2px`
- Light : fond `rgba(25,118,210,0.04)`, border `rgba(25,118,210,0.12)`, `.ws-waveform { background: rgba(255,255,255,0.82) }` (contraste pour barres grises)
- Dark : fond `rgba(255,255,255,0.04)`, border `rgba(255,255,255,0.08)`, `.ws-waveform { background: rgba(0,0,0,0.28) }` (contraste pour barres blanches)

#### Mise a jour couleurs au changement de theme

`startThemeObserver()` / `stopThemeObserver()` dans `mapfly.component.ts` :
- `MutationObserver` sur `document.body` (`attributeFilter: ['class']`)
- Au changement de classe thème, appelle `activePopupPlayer.ws.setOptions({ waveColor, progressColor, cursorColor })` avec les bonnes couleurs
- Observer demarre au `popupopen` (apres creation WaveSurfer), s'arrete au `popupclose`
- Evite de fermer/rouvrir la popup pour actualiser les couleurs des waves

#### Description tronquee — "Lire plus / Lire moins"

- `p.popup-shortstory` : `max-height: 5.6em; overflow: hidden; transition: max-height 0.35s ease` (4 lignes max)
- `.expanded` : `max-height: 1000px` (expansion)
- Bouton `.popup-read-more-btn` : affiche uniquement si `scrollHeight > clientHeight + 2` (verifie le debordement reel)
- Methode `wireReadMore(storyId, btnId)` dans `mapfly.component.ts` : cable le toggle Lire plus/moins
- Appelee dans les 3 callbacks `popupopen` (normal, featured, journey)
- i18n : `mapfly.popup.readMore` / `mapfly.popup.readLess` (FR/EN/ES)

#### Anti-clustering popup (piege connu)

Quand un marker passe dans un cluster pendant que sa popup est ouverte, Leaflet ferme la popup.

**Solution** : au `popupopen`, le marker est retire de `markersCluster` et ajoute directement au `map` (non-clusterisable). Au `popupclose`, il est remis dans `markersCluster`.

- `_isRepositioningMarker: boolean` — flag pour ignorer le `popupclose` synchrone declenche par `markersCluster.removeLayer(m)`
- `markersCluster.removeLayer(m)` declenche `popupclose` de facon synchrone en JS (single-thread) → le flag est lu avant que la ligne suivante s'execute
- `m.openPopup()` re-declenche `popupopen` sur le marker hors-cluster → WaveSurfer initialise normalement au 2eme appel
- Au `popupclose` reel : `map.removeLayer(m)` + `markersCluster.addLayer(m)` — marker retourne au comportement cluster normal
- Concerne uniquement les markers normaux (fgAll/fg1-fg9) — featured et journey sont deja sur `map` directement

#### Integration mobile (bottom sheet Angular)

- `@ViewChild('waveformContainer')` + `WaveSurferPlayerInstance`
- `ngAfterViewInit` : `createWaveSurferPlayer(...)` avec container, audioUrl, theme, callbacks
- `ngOnDestroy` : `playerInstance.destroy()`

#### Popup action buttons (desktop)

- Separateur fin (`border-top: 1px solid`) entre le player et les boutons d'action
- Layout groupe : `— | download share | +` avec `.btn-scope` et `.btn-divider` (voir section "Boutons d'action popups")
- Boutons zoom/download/share : fond transparent teinte (meme style que play btn), sans bordure
- Light : `rgba(25,118,210,0.08)` fond, `#1976d2` icone
- Dark : `rgba(144,202,249,0.10)` fond, `#90caf9` icone
- Download masque si `license === 'READ_ONLY'`
- Share : Web Share API + clipboard fallback (voir section "Partage de son")
- **Zoom fort** : zoom in → `setView([lat+offset, lng], 17)`, zoom out → `setView([latAjuste, lng], 2)` — meme comportement que mobile

#### Like count (popup desktop)

- Light liked : `#444` (gris fonce discret, pas de couleur vive)
- Dark liked : `#ddd` (gris clair)
- Coherent avec le bottom sheet mobile (`#555` / `#aaa`)

#### Ambient ducking

- Callbacks `onPlay`/`onPause` preserves pour le ducking du son ambient
- `destroy()` appelle `onPause()` avant `ws.destroy()` (wavesurfer n'emet pas pause au destroy)

#### Media Session API (`WaveSurferPlayerConfig.mediaMetadata`)

Champ optionnel `mediaMetadata?: { title: string; artist?: string }` dans `WaveSurferPlayerConfig`. Quand fourni :
- **Au `play`** : `navigator.mediaSession.metadata = new MediaMetadata({ title, artist, album: 'Ecnelis FLY', artwork: [logo 512x512] })` + `playbackState = 'playing'`
- **Au `pause`/`finish`** : `playbackState = 'paused'`
- **Action handlers** : `play`, `pause`, `stop` cables sur `ws.play()`, `ws.pause()`, `ws.stop()`
- Permet l'affichage des controles medias OS (lock screen mobile, barre Chrome desktop)
- Appeles dans `mapfly.component.ts` (3 types de popup) et `sound-popup-sheet.component.ts` (bottom sheet mobile) avec `title: sound.title, artist: sound.city`

#### Rappel casque (`HeadphoneReminderService`)

Service injectable (`core/services/headphone-reminder.service.ts`). Affiche un snackbar bleu une seule fois par session navigateur.

- **Cle sessionStorage** : `'ecnelis_headphone_shown'`
- **Snackbar** : `panelClass: ['headphone-snackbar']`, duration 6s, position center/bottom
- **Style** : fond `#1565c0`, texte blanc, bouton action `#90caf9` — dans `styles.scss`
- **Declenchement** : methode `showIfNeeded()` appelee dans le callback `onPlay` du `createWaveSurferPlayer` (mapfly + bottom sheet)
- **i18n** : `player.headphoneReminder` (message) + `player.headphoneReminderAction` (bouton "OK")

## Conventions SCSS

- Dark theme : toujours via `:host-context(body.dark-theme) &` (pas de media query)
- Mobile portrait : `@media (max-width: 700px) and (orientation: portrait)`
- Desktop only : `@media (min-width: 701px)` pour scoper les styles desktop (eviter fuite sur mobile)
- Desktop XL only : `@media (min-width: 1920px)` pour les grands ecrans (ne pas toucher aux autres formats)
- Non-XL desktop : `@media (min-width: 701px) and (max-width: 1919px)` pour cacher des elements XL-only
- Texture grain : variable `$noise-texture` (SVG feTurbulence inline)
- Animations d'entree : `@keyframes fadeInUp`, `@keyframes slideUpBar`
- **Fil bleu-indigo** : `$primary-indigo` (`#3f51b5`) utilise comme fil conducteur dans les surfaces, borders, shadows, accents de tous les composants mobile (home cards, map, footer, chips) pour creer une coherence visuelle premium

## Couleurs adoucies par categorie (voyages sonores)

`softenColor()` applique un mix 55% couleur originale + 45% base sombre pour les popups/indicateurs de voyage sur la carte :

| Categorie | Couleur vive | Couleur adoucie |
|-----------|-------------|-----------------|
| ambiancefly | `#3AE27A` | `~#2d8a56` (vert sauge) |
| animalfly | `#FF54F9` | `~#9c3ca7` (prune) |
| foodfly | `#E8A849` | `~#8d6c3a` (bronze) |
| humanfly | `#FFC1F7` | `~#9c7ba7` (orchidee) |
| musicfly | `#D60101` | `~#872114` (bordeaux) |
| naturalfly | `#39AFF7` | `~#2d73a7` (azur profond) |
| Toutes | — | `#5c6a8a` (slate-indigo) |

## Gooey Living Logo (`home.component` + `gooey-audio.service`)

Logo interactif avec physique et synthese audio Web Audio API. Fonctionne sur mobile et desktop.

### Interactions

| Geste | Visuel | Son |
|-------|--------|-----|
| **Tap** (< 400ms) | Squish (scaleY 0.7 → rebond CSS) | Boing (oscillateur descendant 400→100Hz) |
| **Drag** | Translation + stretch (scale proportionnel a la distance) | Goo resistance (bruit filtre, pitch lie a la vitesse) |
| **Flick** (relache avec velocite) | Bounce physique (rebond sur bords viewport, friction, gravite) | Whoosh (bruit bande passante etroite) + Plop (a chaque rebond) |
| **Long press** (>= 400ms) | Inflate (scale progressif) + pulse + spin accelerant | Drone (2 oscillateurs exponentiels 60→2500Hz / 120→4000Hz) |

### Architecture

- **Template** : `.hero-logo-tilt` wrapper (cursor grab/grabbing), `<img>` avec pointer events + `(contextmenu)="$event.preventDefault()"` (empeche menu contextuel iOS/Android sur long press)
- **Emplacement** : logo uniquement dans le header hero (supprime de l'interieur de la card map), 64px mobile / 80px desktop
- **Physique** : `requestAnimationFrame` hors zone Angular (`NgZone.runOutsideAngular`)
- **Audio** : `GooeyAudioService` — synthese pure Web Audio (OscillatorNode, GainNode, BiquadFilterNode, LFO)
- **Clone** : pour flick, un clone `<img>` est cree dans le DOM pour animer independamment du layout
- **Long press spin** : classe `.longpress-active` desactive `animation: none !important` pour eviter conflit CSS
- **iOS** : `-webkit-touch-callout: none` sur `.hero-main-logo` pour empecher le callout natif

### Drone (long press) - courbe exponentielle

```typescript
const factor = Math.pow(1.18, elapsed) - 1;
const freq1 = Math.min(60 + 60 * factor, 2500);   // osc1: 60Hz → 2500Hz
const freq2 = Math.min(120 + 120 * factor, 4000);  // osc2: 120Hz → 4000Hz
```

Pas de cap temporel — le son monte en continu tant que le long press dure.

### Hover desktop

Pas de comportement JS au hover (reverted). Seul un `filter` glow CSS subtil est applique au `:hover`.

## Page Compte (`features/users/pages/account/`)

### Titre premium

- Titre i18n : "Mon espace" (FR) / "My space" (EN) / "Mi espacio" (ES)
- Style : uppercase, `letter-spacing: 0.5px`, `font-weight: 700`, icone Material `person` discrete
- Couleurs : `#2c3e50` light / `#e8eaf6` dark, icone `#3f51b5` light / `#7986cb` dark

### Bouton Annuler avec confirmation

- Bouton `mat-stroked-button` a cote de Enregistrer
- Si modifications non sauvegardees (`accountForm.dirty || avatarDirty()`) : ouvre `ConfirmDialogComponent` avec confirmation "Quitter / Rester"
- Sans modifications : navigation directe vers `/home`
- i18n : `account.cancel`, `account.cancelConfirm.*` (title, message, confirm, stay)

### Snackbar de succes

- Apres sauvegarde reussie : snackbar verte 3s avec `account.saveSuccess`
- Style global `.account-snackbar` dans `styles.scss` : fond `#1b5e20` light / `#2e7d32` dark, texte blanc

### Graine de l'avatar (seed)

- Le champ seed (`seedFieldValue`) est independant de la selection de variation
- Cliquer une variation dans la galerie change le rendu de l'avatar (`selectedAvatarSeed`) mais ne met PAS a jour le champ texte
- Seule la saisie manuelle dans le champ met a jour `seedFieldValue` ET `selectedAvatarSeed`
- A l'init, les deux signals sont synchronises avec la valeur sauvegardee de l'utilisateur

## Carte utilisateur (User Map)

### Principe

Cliquer sur un nom d'utilisateur dans un popup mapfly navigue **dans le meme onglet** vers `/mapfly?userId=xxx` (full reload via `window.location.href`). Un bandeau elegant s'affiche en haut de la carte, et un bouton permet de revenir a la carte complete.

### Navigation in-page

- **Popup normal** (lignes ~753) et **popup featured** (lignes ~1858) : `window.location.href` au lieu de `window.open('_blank')`
- Utilise `router.createUrlTree` pour construire l'URL proprement

### Bandeau utilisateur

- **Signals** : `isUserMode`, `userFilterLabel`, `userSoundCount`
- **Setup** : apres le category banner setup, si `userId && !category` → extrait le username du premier son (`sounds[0]?.user?.username ?? userId`)
- **Template** : meme pattern que `.category-banner` — icone `person` + "Sons de {username}" + divider + compteur (singulier/pluriel via `mapfly.category.countOne`/`count`)
- **Style** : glassmorphism, accent bleu `#1976d2`, `border-left: 4px solid #1976d2`
- **fitBounds** : la condition de centrage automatique inclut `userId` en plus de `category`/`secondaryCategory`

### Bouton "Explorer la carte complete"

- Classe `.user-explore-btn`, positionne `top: 16px; left: 58px` (a droite des controles zoom Leaflet)
- Appelle `goToFullMap()` (full reload vers `/mapfly`)
- Meme design que `.featured-explore-btn`

### Elements masques en mode utilisateur

- Search bar : condition `&& !isUserMode()`
- Time filter : condition `&& !isUserMode()`

### Dashboard — Bouton "Ma carte"

- Bouton `mat-stroked-button` dans `.header-actions` du dashboard, avant "Ajouter un son"
- Methode `goToMyMap()` : `router.navigate(['/mapfly'], { queryParams: { userId } })`

### i18n

| Cle | FR | EN | ES |
|-----|----|----|-----|
| `mapfly.user.soundsOf` | Sons de {{username}} | Sounds by {{username}} | Sonidos de {{username}} |
| `mapfly.user.exploreFullMap` | Explorer la carte complete | Explore full map | Explorar el mapa completo |
| `dashboard.myMap` | Ma carte | My map | Mi mapa |

## Quotas d'upload

### Principe

Limites count-based par utilisateur pour eviter les abus. Admins exemptes.

| Limite | Valeur |
|--------|--------|
| Sons par semaine | 10 |
| Sons par mois | 30 |
| Taille max par son | 50 MB (client-side, pre-existant) |

### Architecture — comptage a la volee

Pas de champ en base. `QuotaService` (`core/services/quota.service.ts`) compte les sons crees dans la periode via `createdAt` (auto-genere par DynamoDB). Pas de Lambda de reset necessaire.

### Modele

`QuotaInfo` (`core/models/quota.model.ts`) : `weekCount`, `monthCount`, `weekLimit`, `monthLimit`, `canUpload`, `weekRemaining`, `monthRemaining`.

### Enforcement

- `new-sound.component.ts` : verifie le quota au `ngOnInit`, affiche overlay bloquant si limite atteinte
- `confirmation-step.component.ts` : double-verification avant `Sound.create()`
- Admins : bypass automatique (`quotaService` verifie `isAdmin`)

### Affichage

Barres de progression dans `dashboard-stats.component` (onglet Statistiques du dashboard utilisateur). Couleur verte→orange→rouge selon le pourcentage.

## Moderation des sons (statut public_to_be_approved)

### Workflow

1. Utilisateur non-admin uploade un son en "public" → statut force a `public_to_be_approved` via `resolveStatus()` dans `confirmation-step.component.ts`
2. Admin uploade en "public" → statut reste `public` directement
3. Admin approuve/rejette dans le dashboard admin → statut passe a `public` ou `private`

### Visibilite sur la carte (Lambda `list-sounds-for-map`)

| Utilisateur | Voit ses `public_to_be_approved` | Voit ceux des autres |
|-------------|--------------------------------|---------------------|
| Non connecte | Non | Non |
| Connecte (owner) | Oui | Non |
| Admin | Oui (tous) | Oui (tous) |

La Lambda (`amplify/functions/list-sounds-for-map/handler.ts`) fetch les sons `public_to_be_approved` pour le owner et l'admin. Le filtre de securite final autorise `public_to_be_approved` pour le owner (`sound.userId === currentUserTableId`) et l'admin (`fetchAllPrivate`).

La query GraphQL `ListSoundsForMapWithAppUser` inclut le champ `status` pour que le frontend connaisse le statut du son.

### Redirect post-upload

Toujours vers `/mapfly` avec coordonnees, quel que soit le statut. Snackbar informatif si `public_to_be_approved`.

## Dashboard utilisateur (`features/dashboard/`)

### Onglets

`mat-tab-group` avec 2 onglets :
- **Statistiques** (`bar_chart`) : KPIs + quotas + graphiques ngx-charts. Visible uniquement si l'utilisateur a >= 1 son.
- **Mes Sons** (`library_music`) : filtres + liste de sons. Toujours visible.

Le header (titre + boutons "Ma carte" / "+ Ajouter un son") reste au-dessus des onglets.

### Dark mode (piege connu)

Le `mat-slide-toggle` admin ("Voir tous les sons") necessite `::ng-deep .mdc-label` pour styler le texte du label en dark mode — Angular Material encapsule le label dans un element interne que le selecteur `.admin-toggle { color }` seul ne peut pas atteindre. Selecteur : `:host-context(body.dark-theme)` (pas `.dark-theme` seul).

### Stats visuelles (`dashboard-stats` widget)

Composant `app-dashboard-stats` avec `@swimlane/ngx-charts` :
- **KPIs** : total sons, sons publics, total likes
- **Quotas** : barres de progression semaine/mois (non-admin uniquement)
- **Graphiques** : repartition par categorie (pie donut), statuts (pie), activite mensuelle (bar vertical, 6 mois)

Calculs 100% client-side via `computed()` signals sur le tableau `sounds()`.

### Couleurs categories (graphiques)

Variantes adoucies (muted) des couleurs d'accent de categorie pour les charts :

| Categorie | Couleur muted |
|-----------|--------------|
| ambiancefly | `#5BBF8A` |
| animalfly | `#D97BD5` |
| foodfly | `#D4A05C` |
| humanfly | `#D4A3CC` |
| itemfly | `#8C8C8C` |
| musicfly | `#C04040` |
| naturalfly | `#5A9FD4` |
| sportfly | `#B06B35` |
| transportfly | `#C8B840` |

`categoryColorScheme` est un `computed<Color>` signal qui mappe dynamiquement les categories aux couleurs.

### ngx-charts dark mode

Les graphiques ngx-charts necessitent des styles `::ng-deep` dans le bloc `:host-context(body.dark-theme)` pour etre lisibles en dark mode :
- `text { fill: rgba(255,255,255,0.7) }`, `.gridline-path/.domain { stroke: rgba(255,255,255,0.1) }`, `.tick text { fill: rgba(255,255,255,0.6) }`, `.pie-label-text { fill: rgba(255,255,255,0.8) }`

## Database admin (`features/admin/pages/database.component.ts`)

### Ordre des onglets (`/admin/database/*`)

Ordre defini dans le signal `tabs` du `DatabaseComponent` :

1. Son du jour (`featured-sound`)
2. Voyages sonores (`journeys`)
3. Quiz sonores (`quizzes`)
4. Terroirs sonores (`zones`)
5. Articles (`articles`)
6. Attribution des sons (`sound-attribution`)
7. Importer les sons (`import-sounds`) — en dernier intentionnellement

## Dashboard admin (`features/admin/pages/admin-dashboard/`)

### Route standalone

Route `/admin/dashboard` (pas enfant de database tabs). Accessible via le bouton "Tableau de bord" dans le menu admin du sidenav (`app.component.html`).

### 2 onglets

`mat-tab-group` :
- **Statistiques** (`bar_chart`) : KPIs (total sons, utilisateurs, sons publics, en attente, nouveaux ce mois) + graphiques (sons par categorie, uploads over time, statuts, top contributeurs, top villes)
- **Moderation** (`pending_actions`) : gestion des sons en attente avec badge compteur

### Moderation — preview des metadonnees

Chaque son en attente est cliquable/expandable (`toggleExpand(sound)`) avec :
- Titre (toutes langues), histoire, categorie + sous-categorie, lieu + coordonnees
- Equipement, licence, hashtags (chips), URLs, date d'ajout
- **Lecteur audio** integre (charge l'URL S3 via `StorageService` au clic)
- Boutons approuver/rejeter + "Tout approuver"

### Etat vide

Si aucun son en attente : icone `check_circle` verte + message "Aucun son en attente de validation".

## Upload de son — flux de donnees titre

### Piege connu (corrige)

`emitCompleted()` dans `sound-data-info-step.component.ts` synchronise le titre/histoire brut du formulaire dans `translatedTitle[currentLang]` avant d'emettre. Sans cette synchro, `title_i18n` restait vide si la traduction automatique (blur) n'avait pas encore ete declenchee.

De plus, des listeners `valueChanges` (debounce 300ms) sur les champs `title` et `shortStory` appellent `emitCompleted()` pour garder le parent a jour en continu.

## Admin icon — Hub listener

Le signal `isAdmin` dans `app.component.ts` est mis a jour dans le handler Hub `signedIn` (pas seulement dans `ngOnInit`) via `await authService.loadCurrentUser()` + `isAdmin.set(authService.isInGroup('ADMIN'))`. Reset a `false` dans le handler `signedOut`.

**Piege connu (signedOut) :** le bouton deconnexion appelle `authenticator.signOut()` (Amplify Authenticator), pas `authService.signOut()`. Le handler Hub `signedOut` doit appeler `authService.clearUser()` en plus de `appUserService.clearCurrentUser()` — sinon `authService.user()` reste non-null et `isAuthenticated()` renvoie `true` apres deconnexion, causant des echecs GraphQL (`userPool` avec tokens invalides).

## OAuth Account Linking (`app-user.service.ts`)

### Principe

Un meme utilisateur peut se connecter par email/password ET par Google OAuth. Les deux identites Cognito (sub differents) sont liees par email en base.

### Architecture de liaison

1. **Recherche par cognitoSub** (fast path) via index secondaire `getUserByCognitoSub`
2. **Recherche par email** (normalise lowercase) via index secondaire `getUserByEmail`
3. **Selection du compte principal** : scoring par richesse de donnees (`dataScore`) — avatarSeed (+10), avatarStyle (+5), likedSoundIds (+3), theme dark (+1), firstName/lastName (+1). En cas d'egalite, le plus ancien gagne
4. **Re-fetch par cle primaire** (`User.get({ id })`) — les index secondaires peuvent omettre certains champs (ex: `avatarOptions`)
5. **Liaison cognitoSub** : mise a jour locale uniquement (`userRecord.cognitoSub = cognitoSub`), pas de remplacement du record complet (evite la perte de champs)
6. **Merge des doublons** : fire-and-forget en background, transfert des sons + liked sounds, neutralisation des doublons (`email: merged_xxx@deleted`)

### Admin via OAuth

L'admin est determine par le groupe Cognito `ADMIN` dans le JWT. Chaque identite Cognito est independante : un utilisateur admin par email/password ne sera PAS admin via OAuth (voulu). Admin uniquement par email/password.

### Pieges connus

- **Ne pas remplacer `userRecord`** apres `User.update({ cognitoSub })` — la reponse d'update peut omettre des champs comme `avatarOptions`
- **`avatarOptions` doit etre sauvegarde dans un appel separe** — AppSync retourne `null` si inclus dans la meme mutation que les autres champs
- **`'{}'` au lieu de `null`** pour effacer `avatarOptions` en base — DynamoDB peut ignorer les valeurs `null` dans les updates

## Avatar — Validation cross-style (`avatar.service.ts`)

### Probleme

Les `avatarOptions` (eyes, mouth, hairColor, skinColor...) sont specifiques a chaque style DiceBear. Changer de style sans effacer les options laisse des valeurs incompatibles en base. Exemple : `mouth: "grimace"` (valide pour `avataaars`) est invalide pour `botttsNeutral`, causant un rendu sans yeux/bouche.

### Solution — Filtrage dans `generateAvatarUri()`

Avant de passer les options a DiceBear, le service filtre :
1. **Cles valides** : seules les dimensions definies dans `STYLE_OPTIONS[currentStyle]` sont incluses
2. **Valeurs valides** : pour les dimensions de type `variant`, la valeur doit exister dans `dim.variants[]`
3. Les options invalides sont silencieusement ignorees (DiceBear utilise ses defauts)

### Effacement en base

- Changement de style dans le compte → `selectedAvatarOptions.set({})` (vide)
- Sauvegarde : `avatarOptions: null` → persiste `'{}'` en base (pas `null` car DynamoDB peut l'ignorer)
- Chargement : `avatarOptions === '{}'` → traite comme `null`

### Styles avec options (`STYLE_OPTIONS`)

| Style | Dimensions |
|-------|-----------|
| `initials` | backgroundColor |
| `toonHead` | eyes, mouth, hair, clothes, skinColor, hairColor, clothesColor |
| `bottts` | eyes, mouth, face, baseColor |
| `botttsNeutral` | eyes, mouth, backgroundColor |
| `funEmoji` | eyes, mouth, backgroundColor |
| `personas` | eyes, mouth, body, skinColor, hairColor, clothingColor |
| `avataaars` | eyes, mouth, skinColor, hairColor |
| `avataaarsNeutral` | eyes, mouth, backgroundColor |

6 styles sans options : `adventurer`, `adventurerNeutral`, `identicon`, `pixelArt`, `rings`, `shapes`

## Page Categories (`features/categories/pages/categories-list/`)

### Layout responsive mobile

Grille responsive de cards `app-card-category` (composant reutilisable de la home page).

**Breakpoints :**
- **Desktop** : `grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))` — multi-colonnes auto
- **Grands mobiles (390-700px)** : 1 colonne, gap 8px — layout horizontal (icone a gauche, titre a droite) via `::ng-deep` overrides depuis `categories-list.component.scss`
- **Petits mobiles (< 390px)** : 2 colonnes grille, gap 12px — layout vertical compact (icone centree au-dessus, titre en dessous)

**Card petit mobile (layout vertical, < 390px)** :
- `flex-direction: column` — icone overlay centree au-dessus, titre centre en dessous
- `white-space: normal` — texte sur plusieurs lignes si necessaire (evite troncature)
- Overlay 36px, dot 6px, `font-size: 0.72rem`, `border-radius: 12px`
- Tap → ouvre `SubcategorySheetComponent` (MatBottomSheet)
- `mat-card-content` (champ recherche) masque en mobile (`display: none`)
- Active feedback : `transform: scale(0.97)`

**Card grand mobile (layout horizontal, 390-700px)** :
- `::ng-deep` overrides dans `categories-list.component.scss` (le composant `card-category` est partage avec la home page)
- `mat-card-header: flex-direction: row` — icone 40px a gauche + titre a droite
- `mat-card-title: font-size: 0.88rem; text-align: left; white-space: nowrap`
- `border-radius: 14px`, padding `12px 16px`

**Container :**
- Background light : `#F1F2F6` (coherent home page)
- Background dark : `linear-gradient(180deg, #080a18, #0c0e22, #0a0c1e)` (coherent home)
- Hero compact : icone 40px, titre `1.1rem; font-weight: 800`, couleur `$logo-dark-blue`
- Hero icon : memes couleurs que la home page — light `$logo-dark-blue → #1565c0`, dark `#5c6bc0 → #7e57c2` (indigo→violet)

**Animation :** `fadeInUp` stagger par `nth-child` (0.05s * n), 9 cards

**Desktop** : inchange (cards horizontales avec clip-path, champ recherche sous-categories visible)

## Import de sons — attribution des auteurs originaux

### Probleme

L'ancien projet stockait l'email de l'admin (`tivui64@gmail.com`) pour **tous** les sons, quel que soit l'auteur original. Lors de l'import via la Lambda, les User crees pour chaque auteur (ex: "reinsamba") avaient tous cet email admin. Le systeme de merge OAuth (liaison par email) fusionnait ensuite ces comptes vers l'admin, reassignant tous les sons a tivui64.

### Correctif — Lambdas d'import (`import-sounds`, `process-import`)

Email factice unique par auteur au lieu de l'email du JSON :
```typescript
const safeEmail = `imported_${sound.username.toLowerCase().replace(/[^a-z0-9]/g, '_')}@imported.local`;
```
Empeche le merge OAuth de toucher les comptes importes.

### Drapeaux (flags)

Les fichiers de drapeaux sont en **MAJUSCULES** dans `public/img/flags/` (`DE.png`, `FR.png`, `CA.png`). Le champ `User.country` doit stocker le code en majuscules pour correspondre.

## Attribution des sons admin (`features/admin/pages/sound-attribution/`)

### Principe

Les sons importes de l'ancienne application sont lies a des User avec email factice (`imported_xxx@imported.local`). Quand un ancien utilisateur s'inscrit sur la nouvelle app, ses sons ne lui sont pas automatiquement reattribues (les emails ne correspondent pas). L'admin peut aussi vouloir reattribuer les sons de n'importe quel utilisateur. Onglet "Attribution des sons" dans la database admin.

### Composants

- **`SoundAttributionComponent`** : page principale — tableau de tous les utilisateurs ayant au moins 1 son
- **`ReassignDialogComponent`** : dialog de recherche d'utilisateur cible (inline template)

### Interface `SoundUser`

```typescript
type UserType = 'imported' | 'registered';
interface SoundUser {
  id: string;
  username: string;
  email: string;
  country?: string;
  soundCount: number;
  type: UserType; // 'imported' si email startsWith('imported_')
}
```

### Signals et filtres

| Signal | Type | Defaut | Usage |
|--------|------|--------|-------|
| `allUsers` | `SoundUser[]` | `[]` | Tous les users avec sons (exclut `merged_*`) |
| `searchTerm` | `string` | `''` | Filtre par username/email |
| `typeFilter` | `'all' \| 'imported' \| 'registered'` | `'all'` | Filtre par type |
| `sortBy` | `'username' \| 'sounds'` | `'sounds'` | Tri actif |
| `sortDirection` | `'asc' \| 'desc'` | `'desc'` | Direction du tri |
| `filteredUsers` | computed | — | Combine type + search + sort |

### Chargement (`loadAllUsers()`)

1. Pagination complete de `User.list({ limit: 500 })` — filtre `merged_*`
2. Pour chaque user actif : comptage sons via `Sound.listSoundsByUserAndStatus({ userId })` (pagination)
3. Exclusion des users avec 0 sons

### Reassignation (`reassignSounds()`) — 2 etapes

**Piege GSI** : mettre a jour `Sound.userId` pendant la pagination de `listSoundsByUserAndStatus` deplace les items hors de la partition GSI, causant des sauts de `nextToken`.

1. **Collecte** : pagination complete de tous les `soundId` AVANT toute modification
2. **Transfert** : `Sound.update({ id, userId: targetUserId })` pour chaque son collecte
3. **Neutralisation conditionnelle** : uniquement les users importes → `email: merged_{id}@deleted`, `cognitoSub: merged_{id}` (meme pattern que `mergeDuplicateUsers`)

### Pas de changement backend

`Sound.authorization` a `allow.authenticated().to(['read', 'update'])` — tout utilisateur authentifie (dont l'admin) peut faire `Sound.update({ id, userId })`.

### i18n

Cles `admin.soundAttribution.*` : title, subtitle, search, filter (all/imported/registered), sort (name/sounds), type (imported/registered), table (username/email/type/sounds/actions), actions.reassign, empty, noResults, loadError, dialog (title/soundCount/searchPlaceholder/search/noResults/confirm/cancel), success, error (FR/EN/ES).

## Versioning de l'application

### Source de verite

- `package.json` : version `2.0.0`
- `src/environments/version.ts` : exporte `APP_VERSION` (lit `packageJson.version`)
- Pour bumper la version : modifier uniquement `package.json`, le reste suit automatiquement

### Affichage

- **Sidenav mobile** : footer du menu, `v{{ appVersion }}` via `sidenav-menu.component`
- **Page compte** : affiche dans la section infos
- Import : `import { APP_VERSION } from '../../../../environments/version'`

## Page 404 (`core/pages/not-found/`)

- Composant standalone minimal (stateless, pas de logique)
- Route wildcard : `{ path: '**', loadComponent: () => import(...NotFoundComponent) }` dans `app.routes.ts`
- Design : illustration Material icon `explore_off`, bouton retour accueil
- Dark/light mode supporte
- i18n : `notFound.message`, `notFound.backHome` (FR/EN/ES)

## Licences de sons

### Types de licence

| Licence | Label | Telechargement |
|---------|-------|---------------|
| `READ_ONLY` | Lecture seule | Bloque (bouton masque) |
| `PUBLIC_DOMAIN` | Domaine public | Autorise |
| `CC_BY` | CC BY | Autorise |
| `CC_BY_NC` | CC BY-NC | Autorise |
| `CC_BY_SA` | CC BY-SA | Autorise |

Note : `CC_BY_SA` n'est pas dans l'enum `LicenseType` du schema backend mais existe sur des sons importes de l'ancien projet. Les traductions i18n sont presentes pour toutes les licences.

### Badge et tooltip

- **Desktop (popups Leaflet)** : badge `<span class="popup-license-badge">` avec icone `copyright` + label traduit + `<span class="license-tooltip">` (tooltip CSS custom, hover-triggered)
- **Mobile (bottom sheet)** : badge `<span class="sheet-license-badge">` avec tooltip tap-triggered via signal `showLicenseTooltip` + methode `toggleLicenseTooltip()`
- **Design tooltip** : dark bg / light text en light mode (`#1a1a2e` / `#f0f0f5`), inverse en dark mode (`#e8e8f0` / `#1a1a2e`), fleche CSS (`::after` border trick)
- Badge centre horizontalement (desktop `margin: auto`, mobile `align-self: center`)

### Blocage download READ_ONLY

- Popups desktop (normal + featured) : `${s.license !== 'READ_ONLY' ? '<button class="download-btn...">download</button>' : ''}`
- Bottom sheet mobile : `@if (data.sound.license !== 'READ_ONLY') { <button> }`

### i18n

Cles `sound.licenses.*` et `sound.licenses.*_tooltip` pour chaque type (FR/EN/ES)

## Detection theme systeme (`prefers-color-scheme`)

- Au demarrage (`app.component.ts` `ngOnInit`), detecte `window.matchMedia('(prefers-color-scheme: dark)').matches`
- Applique le theme OS comme defaut initial (`isDark.set(prefersDark)` + `applyTheme()`)
- Ce defaut est ecrase ensuite si l'utilisateur a une preference sauvegardee en base (champ `User.theme`)
- L'ordre dans `ngOnInit` : 1) detecter OS theme → 2) charger user → 3) appliquer preference user si existe

## Partage de son (Share)

### URL de partage

Format : `{origin}/mapfly?lat={lat}&lng={lng}&zoom=17&soundFilename={encodeURIComponent(filename)}`

### Strategie de fallback

1. **Web Share API** (`navigator.share()`) si disponible (mobile natif) — ouvre le dialog de partage natif
2. **Clipboard API** (`navigator.clipboard.writeText()`) en fallback — copie l'URL + snackbar "Lien copie"
3. Si les deux echouent : erreur silencieuse

### Implementation

- **Desktop (popups Leaflet)** : bouton `share-btn` dans `.btn-scope` central, handler post-popup via `getElementById`
- **Mobile (bottom sheet)** : methode `share()` dans `sound-popup-sheet.component.ts`
- 3 popups (normal, featured, journey) + bottom sheet — tous utilisent le meme pattern

### i18n

| Cle | FR | EN | ES |
|-----|----|----|-----|
| `mapfly.share.button` | Partager | Share | Compartir |
| `mapfly.share.copied` | Lien copie ! | Link copied! | Enlace copiado! |

## Boutons d'action popups — layout et hierarchie

### Convention de disposition

**Desktop** : `— | download share | +` (zoom minus a gauche, actions au centre, zoom plus a droite)
**Mobile** : `— | download share radar | +` (idem + bouton radar dans le groupe central)

**Structure HTML (mobile) :**
```
.sheet-actions-bar
  button.sheet-action-btn  ← remove (-)
  .btn-divider             ← separateur vertical 1px
  .btn-scope               ← actions centrales
    button.sheet-action-btn ← download (si license != READ_ONLY)
    button.sheet-action-btn ← share
    button.radar-toggle-btn ← radar (toggle mini-carte satellite)
  .btn-divider             ← separateur vertical 1px
  button.sheet-action-btn  ← add (+)
```

### Dimensions

| Element | Desktop | Mobile |
|---------|---------|--------|
| Boutons | 30x30px | 32x32px |
| Icones | 16px | 18px |
| Divider | 1px × 20px | 1px × 18px |
| Gap intra-groupe | 6px | 8px |
| Gap inter-groupes | 10px | 10px |

### Divider

- Light : `rgba(0,0,0,0.12)`
- Dark : `rgba(255,255,255,0.12)`

## Gestion des scores quiz (admin)

### Composant (`quiz-admin-list.component`)

Section extensible sous le tableau des quiz. Bouton `leaderboard` dans la colonne actions toggle un panneau en dessous.

### Signals

```typescript
expandedQuizId = signal<string | null>(null);
expandedQuiz = computed(() => quizzes().find(q => q.id === expandedQuizId()));
leaderboardAttempts = signal<QuizAttempt[]>([]);
leaderboardLoading = signal(false);
deletingAttemptId = signal<string | null>(null);
```

### Methodes

| Methode | Action |
|---------|--------|
| `toggleLeaderboard(quiz)` | Charge/masque les attempts d'un quiz |
| `deleteAttempt(attempt)` | Supprime un score individuel |
| `deleteAllAttempts(quiz)` | Confirmation dialog + suppression de tous les scores |

### Service (`quiz.service.ts`)

| Methode | Signature | Details |
|---------|-----------|---------|
| `getQuizAttempts(quizId)` | → `Promise<QuizAttempt[]>` | Limit 500, tri score DESC |
| `deleteAttempt(id)` | → `Promise<void>` | Suppression unitaire |
| `deleteAllAttempts(quizId)` | → `Promise<number>` | Boucle sur getQuizAttempts + deleteAttempt, retourne le nombre supprime |

### UI leaderboard panel

- Loading : spinner Material
- Vide : icone `emoji_events` + message
- Liste : rang + username + score/maxScore + etoiles + date + bouton delete
- Header : titre + bouton "Supprimer tous" (avec confirmation dialog)
- Ligne en cours de suppression : `opacity: 0.4; pointer-events: none`

### i18n

Cles `admin.quiz.leaderboard.*` : title, noScores, deleteOne, deleteAll, deleteAllTitle, deleteAllMessage, deleteAllConfirm, deleteSuccess, deleteAllSuccess, deleteError, loadError (FR/EN/ES)

## Page Support (`features/support/support.component`)

Page de soutien financier accessible via `/support` et le sidenav (item "Soutenir", icone `favorite`).

### Structure

- **Hero** : gradient `$primary → $indigo → $violet`, icone `favorite` animee (`heartbeat` keyframe), titre + sous-titre i18n
- **Mission card** : icone `public` + texte mission
- **Pourquoi card** : liste avec icones `cloud_upload`, `map`, `code`, `headphones`
- **CTA section** : boutons Ko-fi (rouge `#ff5e5b`) + Buy Me a Coffee (jaune `#ffdd00`), note sans engagement
- **Support alternatif** : `mic`, `share`, `star` — enregistrer, partager, feedback

### Donations

| Plateforme | URL | Commission | Notes |
|------------|-----|-----------|-------|
| Ko-fi | `https://ko-fi.com/ecnelisfly` | 0% | Recommande — direct PayPal/Stripe |
| Buy Me a Coffee | `https://buymeacoffee.com/ecnelisfly` | 5% | Secondaire |

Boutons ouvrent `_blank` avec `noopener,noreferrer`. Ko-fi : image logo `/img/kofi_cup.png` avec fallback icone `local_cafe` si image manquante.

### i18n

Cles `support.*` : title, subtitle, mission.title/text, why.title/hosting/maps/dev/sounds, cta.intro/kofi/bmc/note, alt.title/record/share/feedback (FR/EN/ES)

Cle sidenav : `sidenav.support` — FR "Soutenir", EN "Support us", ES "Apoyar"

## Lambdas — runtime et configuration

### Runtime Node.js 22

Toutes les Lambdas utilisent `runtime: 22` (Node.js 22.x) dans leur `defineFunction()` (`amplify/functions/*/resource.ts`). Migration effectuee en fevrier 2026 suite a l'annonce AWS de fin de support Node.js 20.x (30 avril 2026).

### Liste des Lambdas (15)

| Lambda | Timeout | Memoire | Schedule |
|--------|---------|---------|----------|
| `cognito-custom-message` | 10s | 128 MB | — |
| `delete-sound-file` | 10s | 128 MB | — |
| `fix-imported-users` | 900s | 1024 MB | — |
| `import-sounds` | 30s | 1024 MB | — |
| `list-cognito-users` | 30s | 256 MB | — |
| `list-sounds-by-zone` | 30s | 1024 MB | — |
| `list-sounds-for-map` | 30s | 1024 MB | — |
| `pick-daily-featured-sound` | 30s | 512 MB | every day |
| `pick-monthly-article` | 30s | 512 MB | every day |
| `pick-monthly-journey` | 30s | 512 MB | every day |
| `pick-monthly-quiz` | 30s | 512 MB | every day |
| `pick-monthly-zone` | 30s | 512 MB | every day |
| `process-import` | 900s | 1024 MB | — |
| `send-sound-confirmation-email` | 15s | 256 MB | — |
| `start-import` | 10s | 256 MB | — |

## Lambda email confirmation son (`amplify/functions/send-sound-confirmation-email/`)

### Principe

Lambda prete mais non enregistree dans `amplify/backend.ts`. Activee uniquement quand `SEND_EMAIL_ENABLED=true` (env var Amplify Console). Sans cette variable, retourne `{ status: 'dry_run' }`.

### Prerequis avant activation

1. Verifier le domaine `ecnelisfly.com` dans AWS SES Console
2. Definir `SENDER_EMAIL` (ex: `noreply@ecnelisfly.com`) dans Amplify Console env vars
3. Definir `SEND_EMAIL_ENABLED=true`
4. Enregistrer la Lambda dans `amplify/backend.ts` (import + `defineBackend`)
5. Câbler l'appel depuis `confirmation-step.component.ts` apres `Sound.create()`

### Interface

```typescript
interface SoundEmailPayload {
  toEmail: string;
  username: string;
  soundTitle: string;
  soundStatus: 'public_to_be_approved' | 'public' | 'private';
  lang?: 'fr' | 'en' | 'es';
}
```

### Email trilingue

Templates HTML inline dans `TRANSLATIONS` constant (FR/EN/ES). Contenu : confirmation creation, statut du son (approuve / en attente / prive), lien vers la carte.

### Dependance npm

`@aws-sdk/client-sesv2` installe en `devDependency` — verifie a la compilation TS meme sans deploiement.

## Pages documentation

### Guide utilisateur (`features/guide/`)

- **Route** : `/guide` (public, pas de guard)
- **Sidenav** : `{ icon: 'help_outline', labelKey: 'sidenav.guide', route: '/guide' }` — avant "Soutenir"
- **Composant** : standalone, pattern identique a `SupportComponent` (hero gradient + cards)
- **Hero** : icone `help_outline`, animation `pulse-icon` (pas heartbeat)
- **Body** : 8 cards avec icone + titre + texte (sections : explorer, ecouter, compte, ajouter, quiz, voyages, terroirs, categories)
- **i18n** : cles `guide.*` (title, subtitle, explore, listen, account, addSound, quiz, journeys, zones, categories)

### Mentions legales (`features/legal/`)

- **Route** : `/legal` (public)
- **Sidenav** : `{ icon: 'gavel', labelKey: 'sidenav.legal', route: '/legal' }` — dernier item
- **Hero** : icone `gavel`, pas d'animation
- **Body** : 4 cards (editeur `business`, CGU `description`, vie privee `security`, copyright `copyright`)
- **i18n** : cles `legal.*` (title, subtitle, editor, terms, privacy, copyright)
- **SCSS** : icones en `$indigo` (#3f51b5) light / `#7986cb` dark (differencie du guide en `$primary`)

### Guide administrateur (`features/admin/pages/admin-guide/`)

- **Route** : `/admin/guide` (protege : `canActivate: [authGuard], data: { requiredGroup: 'ADMIN' }`)
- **PAS dans le sidenav** — accessible uniquement via le mat-menu admin (icone engrenage), 3eme entree apres "Tableau de bord" et "Gerer la bdd"
- **Hero** : icone `admin_panel_settings`
- **Body** : 8 cards (moderation, son du jour, quiz, terroirs, voyages, articles, elements du mois, statistiques)
- **i18n** : cles `adminGuide.*` + `toolbar.admin.guide`
- **SCSS** : icones en `$violet` (#7e57c2) light / `#b39ddb` dark (identite admin)

## Meta tags SEO / Open Graph

`src/index.html` inclut :
- `<meta name="description">` : description FR de l'application
- `<meta name="author">` et `<meta name="copyright">`
- Open Graph : `og:title`, `og:description`, `og:type`, `og:image` (icon-512x512), `og:site_name`
- Twitter Card : `summary_large_image` avec titre, description et image

## Fichiers temporaires a ignorer

- `preview-color-proposals.html` (preview design, pas partie de l'app)
- `preview-glass-discovery.html` (preview design glassmorphism, pas partie de l'app)
