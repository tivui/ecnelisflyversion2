# Ecnelis FLY - Guide Claude Code

## Projet

Application web PWA d'exploration sonore geolocalise. Angular 18, standalone components, AWS Amplify (backend), Leaflet (carte).

## Build & Dev

```bash
npx ng build          # Build production
npx ng serve          # Dev server (localhost:4200)
```

Warnings pre-existants a ignorer : budget bundle, duplicate Material theming, CommonJS modules (leaflet, qrcode, etc.).
Budget `anyComponentStyle` : `maximumError: 70kb` dans `angular.json` (augmente pour mapfly.component.scss avec le panneau categories desktop).

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

### Accents CTA et border-left par type de card

| Card | Accent CTA (light/dark) | Border-left |
|------|------------------------|-------------|
| Map | `#1976d2` / `#90caf9` | blue |
| Featured (Son du jour) | `#6a3de8` / `#b388ff` | violet `#7c4dff` |
| Journey (Voyages sonores) | `#5c6a8a` / `#a0b0cc` | slate-indigo `#5c6a8a` |
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
- **Mobile portrait** (`@media max-width: 700px, orientation: portrait`) :
  - **Layout scroll natif** : `height: auto`, `min-height: calc(100dvh - ...)`, `overflow-y: auto` (plus de viewport-fit)
  - **Aplatissement CSS** : `.hero-section` et `.hero-actions` en `display: contents`, reordonnancement via `order` :
    1. `.hero-content` (order: 1) — Header : logo 64px + titre + sous-titre
    2. `.hero-card-map` (order: 2) — Carte mondiale : icon 52px avec halo bleu, padding genereux
    3. `.carousel-section` (order: 3) — Carousel categories avec accent top line
    4. `.onboarding-section` (order: 4) — Header "NOTRE COMMUNAUTÉ" + 3 piliers + community stats
    5. `.hero-cards-secondary` (order: 5) — Grille 2x2 (`grid-template-columns: 1fr 1fr`)
  - **Scroll dots** : masques (`display: none`)
  - **Blue side rails** : `border-left/right: 3px solid rgba($primary-blue, 0.18)`, `border-radius: 14px 14px 0 0` — cadrage brand premium
  - **Background light** : clean cool gradient (`radial-gradient(#e3ecff 0.6) + linear-gradient(#f7f8fc → #f3f4f8 → #f7f8fc)`)
  - **Titres premium** : `color: #2c3e6b`, `font-weight: 700` (adouci, pas noir)
  - **CTA buttons** : `align-self: center; width: fit-content` (centres, compacts)
- **Small phones** (`max-height: 800px`) : tailles reduites supplementaires (logo, gap, padding)
- Chargement : `Promise.allSettled` pour afficher toutes les cards simultanement

#### Orchestrated Reveal (chargement)

Tous les elements demarrent a `opacity: 0` et apparaissent en cascade coordonnee quand `dataLoaded()` passe a `true` (classe `.ready` sur `.home-container`). Easing : `cubic-bezier(0.22, 1, 0.36, 1)`.

- Stagger : logo (0.05s) -> titre (0.12s) -> sous-titre (0.18s) -> carte map (0.25s) -> carousel (0.33s) -> onboarding (0.40s) -> secondary cards staggerees (0.47s-0.62s)
- Desktop : `.hero-cards-secondary` utilise `display: contents`, donc les cards individuelles sont ciblees via `nth-child` pour le reveal
- Mobile : animation `fadeInRight` (translateX) pour les secondary cards (scroll horizontal), `fadeInUp` pour le reste
- Mobile : jusqu'a 5 cards staggerees (`nth-child(1)` a 0.35s jusqu'a `nth-child(5)` a 0.63s)

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

#### Grille 2x2 mobile (secondary cards)

Design clean — surfaces blanches avec accents forts, grille 2x2 :

**Layout :** `display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 4px 10px 6px` (hauteur naturelle, pas de overflow hidden)

**Structure d'une card :**
```
┌─ accent top bar (3px, gradient, border-radius top) ──────┐
│ [header row: icon circle + badge label]                   │
│ Titre du contenu (1 ligne, ellipsis)                      │
│ Description (2 lignes, visible)                           │
│                    Action → (pill, centered)               │
└───────────────────────────────────────────────────────────┘
```

**Surfaces :**
- Light : `background: #ffffff`, `border: 1px solid rgba(0,0,0,0.06)`, soft shadows, pas de backdrop-filter
- Dark : `background: linear-gradient(145deg, rgba(24,24,42,0.94) 40%, rgba($primary-indigo, 0.10) 100%)`, `border: rgba(#5c6bc0, 0.16)`, `box-shadow: rgba(0,0,20,0.40)`

**Titres :** `color: #2c3e6b`, `font-weight: 700`, `font-size: 1.02rem` light / `#e8eaf6` dark

**Descriptions :** `color: #6B7280`, `font-size: 0.76rem`, visible (2 lignes) light / `#9fa4be` dark

**CTA pills :** `padding: 5px 14px`, `border-radius: 8px`, `font-weight: 700`, `font-size: 0.82rem`, `align-self: center; width: fit-content` avec couleurs d'accent saturees par card :

| Card | CTA bg (light) | CTA border (light) | CTA color (light) |
|------|---------------|--------------------|--------------------|
| Featured | `rgba(#7c4dff, 0.16)` | `rgba(#7c4dff, 0.24)` | `#5a2dd0` |
| Journey | `rgba(#5c6a8a, 0.16)` | `rgba(#5c6a8a, 0.24)` | `#3d4e6e` |
| Article | `rgba($accent-article, 0.16)` | `rgba($accent-article, 0.24)` | `#5e4a30` |
| Quiz | `rgba(#0d7c51, 0.16)` | `rgba(#0d7c51, 0.24)` | `#0a6340` |
| Monthly Zone | `rgba(#b07c10, 0.16)` | `rgba(#b07c10, 0.24)` | `#7a580a` |

Dark mode CTAs : `background: none; border: none` (texte accent uniquement)

**Featured card distinction :** border violet `rgba(#7c4dff, 0.18)` light / `rgba(#b388ff, 0.18)` dark, box-shadow glow violet

**Accent top bars :** gradient `$primary-indigo → accent color`, 3px, `border-radius: 16px 16px 2px 2px` + `box-shadow` subtle. Dark: `brightness(1.2)` + glow

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

#### Long Press mobile

- **Tap** (< 400ms) : navigation normale
- **Long press** (>= 400ms) : description apparait en fondu, retour haptique (`navigator.vibrate(10)`), auto-dismiss 3s
- **Signals** : `longPressedCard: signal<string | null>(null)`, `isMobileGrid: signal<boolean>`
- **Events template** : `(pointerdown)` / `(pointerup)` / `(pointerleave)` sur chaque card
- **CSS** : `.hero-card.long-pressed` → `.hero-card-desc { max-height: 60px; opacity: 1 }`
- Les `routerLink` des cards quiz/article sont conditionnels (`[routerLink]="isMobileGrid() ? null : ..."`) pour eviter navigation pendant long-press

#### Carte mondiale mobile (hero card map)

Design glassmorphism blue-tinted (video globe supprimee, logo supprime de la card).

**Light :**
- Background : `linear-gradient(135deg, rgba($primary-blue, 0.08) → rgba($primary-indigo, 0.04) → rgba(255,255,255,0.80))` + `backdrop-filter: blur(20px) saturate(1.4)`
- Icon : `mat-icon public` 52px dans cercle bleu avec triple halo (`box-shadow: 0 0 0 6px rgba(blue,0.06), 0 0 0 12px rgba(blue,0.03), 0 4px 12px rgba(blue,0.12)`)
- Accent bar top : 2.5px gradient `$primary-blue → $primary-indigo → $primary-violet`
- Border : `rgba($primary-blue, 0.18)` + `inset 0 1px 0 rgba(255,255,255,0.7)`
- Pas d'orbs, pas de shimmer, pas de video

**Dark :**
- Background : `linear-gradient(145deg, rgba(14,20,48,0.96) → rgba($primary-blue, 0.12))`, pas de backdrop-filter
- Icon : fond `rgba(#90caf9, 0.14)`, border `rgba(#90caf9, 0.25)`, glow bleu
- Accent bar top : 3px gradient blue→indigo + `brightness(1.2)` + glow
- Border : `rgba(#5c6bc0, 0.25)` + shadow indigo glow

#### Carousel categories mobile (order: 3)

Section modernisee avec accent top line premium.

**Light :**
- Background : `#ffffff`, `border-radius: 16px`, `overflow: hidden`
- Accent top line : `::before` gradient `$primary-blue → $primary-indigo → $logo-orange` (2.5px, opacity 0.5)
- Header : icon `$primary-indigo` opacity 0.6, titre `#3949ab` opacity 0.6
- Chips : clean soft surface `background: #f5f6fa`, `border: 1px solid rgba(0,0,0,0.06)`, pas de backdrop-filter, shadow douce (`carousel-categories.component.scss`)
- Chip label : `color: #374151`, `font-weight: 600`

**Dark :**
- Background : gradient indigo profond (`rgba(16,18,36,0.94) → rgba(20,22,44,0.96)`)
- Accent top line : gradient indigo + `brightness(1.1)` + glow
- Header : icon `#7986cb` opacity 0.8, titre `#9fa8da` opacity 0.75
- Chips : indigo-tinted glass, border `rgba(92,107,192,0.18)`, label `#e8eaf6`

#### Onboarding + Community Stats (mobile uniquement)

Section entre le carousel et les secondary cards (order: 4). Visible uniquement en mobile portrait (`display: none` en desktop, `display: flex !important` en mobile).

**Structure :**
```
┌─ accent top line (gradient blue→indigo→violet) ──────┐
│ 🌍 NOTRE COMMUNAUTÉ  (header icon + titre uppercase) │
│                                                       │
│ [explore icon]   [headphones icon]   [mic icon]       │
│  Explorez...      Ecoutez...          Partagez...     │
├───────────────────────────────────────────────────────┤
│ 548 sons · 111 pays · 177 explorateurs                │
└───────────────────────────────────────────────────────┘
```

**Card :** `background: #ffffff`, `border-radius: 16px`, accent top line `::before` gradient `$primary-blue → $primary-indigo → $primary-violet` (2.5px, opacity 0.45). Dark : `rgba(20,20,38,0.70)` + `border: rgba(#5c6bc0, 0.14)`

**Header :** icon `public` 14px `$primary-indigo` opacity 0.6, titre `0.7rem` uppercase `#3949ab` opacity 0.6, `letter-spacing: 0.06em`

**Pillars :** 3 colonnes (explore, listen, contribute), icone 34px dans cercle `rgba($primary-indigo, 0.08)`, label `0.66rem` bold

**Community stats :** compteurs dynamiques (sons, pays, contributeurs) via `SoundsService.getCommunityStats()`. Chiffres en `font-weight: 800`, couleur `#1a237e` light / `#e8eaf6` dark. Separateurs `·` en `rgba($primary-indigo, 0.3)`

**Small phones** (`max-height: 800px`) : piliers masques (`display: none`), stats seules sans card wrapper (pas de glassmorphism, pas de border)

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
| `$accent-light` | `#a0b0cc` | Accent dark mode |
| `$accent-dark` | `#2e3548` | Extremite sombre des gradients |
| Gradient card | `#2e3548 -> #5c6a8a` | Visual des cards |
| Border-left light | `rgba(#5c6a8a, 0.35)` | Bordure card |
| Border-left dark | `rgba(#a0b0cc, 0.3)` | Bordure card dark |

#### Liste des voyages (`journeys-list`)

- Hero icon + journey cards + random card : tous en palette slate-indigo
- Pas de message "Aucun voyage disponible" : le random card est toujours visible, la grille ne s'affiche que si `journeys().length > 0`

#### Voyage aleatoire (`random-journey-sheet`)

- MatBottomSheet ouvert depuis la journeys-list
- Slider pour nombre de sons (1-10), chips pour filtre categorie
- Couleurs inline : header/slider/bouton en slate-indigo (`#2e3548`, `#5c6a8a`, `#a0b0cc`)
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

## Toolbar — masquage conditionnel du logo

Le logo de la toolbar est masque sur certaines pages pour eviter la redondance visuelle :

- **Home page** (desktop) : classe `.hide-desktop-home` via `isHomePage()` ou `isCategoryMapPage()`
- **Page de connexion** : classe `.hide-login` via `isLoginPage()` (la page affiche deja le logo Ecnelis FLY dans le formulaire d'authentification)
- **Mobile portrait** : logo toolbar toujours masque (`display: none`), titre `.app-title` stylise en uppercase bold (`font-weight: 800`, `letter-spacing: 1.2px`, `color: #555` light / `#9a9ab0` dark)

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

### Sidenav mobile

- **Position** : `'end'` (droite) en mobile portrait, `'start'` (gauche) en desktop — `[position]="isMobilePortrait() ? 'end' : 'start'"`
- **Plein ecran** : `width: 100vw; max-width: 100vw; box-shadow: none` en mobile portrait
- **Desktop** : `width: 320px; max-width: 85vw`
- **Footer** (theme toggle + langue + "Sounds of the world") : masque en desktop (`display: none` pour `min-width: 701px`), visible uniquement en mobile. Styles dans `sidenav-menu.component.scss` (`.sidenav-footer`)

### Pages avec elements fixes en bas (compatibilite bottom nav)

- **Quiz lobby** : `.start-section { bottom: 56px }` en mobile portrait
- **Mapfly timeline bar** : `bottom: 70px` en mobile portrait (au-dessus du nav de 56px + marge)

### Leaflet dark mode (map.scss)

- **Layers control container** : `body.dark-theme .leaflet-control-layers { background: rgba(14, 14, 28, 0.92) }`
- **Layers toggle icon** : SVG blanc data URI remplacant le sprite Leaflet sombre (invisible sur fond dark)

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

## Fichiers temporaires a ignorer

- `preview-color-proposals.html` (preview design, pas partie de l'app)
- `preview-glass-discovery.html` (preview design glassmorphism, pas partie de l'app)
