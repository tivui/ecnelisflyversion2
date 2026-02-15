# Ecnelis FLY - Guide Claude Code

## Projet

Application web PWA d'exploration sonore geolocalise. Angular 18, standalone components, AWS Amplify (backend), Leaflet (carte).

## Build & Dev

```bash
npx ng build          # Build production
npx ng serve          # Dev server (localhost:4200)
```

Warnings pre-existants a ignorer : budget bundle, duplicate Material theming, CommonJS modules (leaflet, qrcode, etc.).
Budget `anyComponentStyle` : `maximumError: 55kb` dans `angular.json` (augmente de 50kb pour mapfly.component.scss).

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
  - Container : `height: calc(100dvh - 48px - 56px - 14px - env(safe-area-inset-bottom, 0px))`, flex column
  - Hero card Map : full-width, `clamp(140px, 30dvh, 240px)`
  - Secondary cards : **grille 2x2** (`display: grid; grid-template-columns: 1fr 1fr; gap: 10px`)
  - Carousel categories : glassmorphism indigo-tinted, `flex: 0 0 auto`
  - Pastilles : grille pyramide 4+5, style premium (border neutre, pas de glow)
- **Small phones** (`max-height: 800px`) : tailles reduites supplementaires
- Chargement : `Promise.allSettled` pour afficher toutes les cards simultanement

#### Orchestrated Reveal (chargement)

Tous les elements demarrent a `opacity: 0` et apparaissent en cascade coordonnee quand `dataLoaded()` passe a `true` (classe `.ready` sur `.home-container`). Easing : `cubic-bezier(0.22, 1, 0.36, 1)`.

- Stagger : logo (0.05s) -> titre (0.12s) -> sous-titre (0.18s) -> carte map (0.25s) -> secondary cards (0.33-0.49s) -> dots (0.45s) -> carousel (0.5s)
- Desktop : `.hero-cards-secondary` utilise `display: contents`, donc les cards individuelles sont ciblees via `nth-child` pour le reveal
- Mobile : accent line `.hero-content::after` a aussi son reveal dedie

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
- **Mobile (4 cards)** : pool de {quiz, monthlyZone, monthlyJourney, article}, on en tire 3 au hasard. Featured en 2e position dans la grille 2x2
- Si `featured` absent : les cards disponibles remplissent les positions sans contrainte
- Logique dans `orderedSecondaryCards` signal, template via `@for` + `@switch`

#### Grille mobile 2x2 (secondary cards)

Design "Light Vibrant" — surfaces blanches pures, accents forts, hierarchie claire :

**Structure d'une tuile :**
```
┌─ accent top bar (3px, gradient $primary-indigo → accent) ─┐
│ [header row: icon circle + badge label]                    │
│ Titre du contenu (1 ligne, ellipsis)                       │
│ Description (2 lignes, visible)                            │
│                                          Action →  (pill)  │
└────────────────────────────────────────────────────────────┘
```

**Surfaces (Light Vibrant) :**
- Light : `background: #FFFFFF`, `border: 1px solid rgba(0, 0, 0, 0.08)`, `box-shadow: 0 2px 8px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.09)`
- Dark : `background: linear-gradient(145deg, rgba(24,24,42,0.94) 40%, rgba($primary-indigo, 0.10) 100%)`, `border: rgba(#5c6bc0, 0.16)`, `box-shadow: rgba(0,0,20,0.40)`

**Background page :** `#F7F8FA` light (neutre propre) / gradients indigo dark

**Header row :** `transparent` light (blanc pur de la card, structure par border-bottom `rgba(0,0,0,0.06)` uniquement) / gradient indigo `0.18` dark. Negative margin bleed (`margin: -14px -12px 0`)

**Icon circles :** 36px, fond teinte accent a 14% (light) / 18-22% (dark), border accent 28% (light), box-shadow glow en dark. Couleurs icones assombries en light pour contraste

**Badges :** pills `rgba($primary-indigo, 0.08)` + micro-border light / `rgba(#5c6bc0, 0.20)` dark, texte accent

**Titres :** `color: #111827`, `font-weight: 800`, `font-size: 1rem` light / `#e8eaf6` dark

**Descriptions :** `color: #6B7280`, `font-size: 0.72rem`, visible (2 lignes) light / `#9fa4be` dark

**Spacing content :** `gap: 6px` entre titre, description et CTA

**CTA pills :** `padding: 5px 14px`, `border-radius: 8px`, `font-weight: 700` avec couleurs d'accent saturees par card :

| Card | CTA bg (light) | CTA border (light) | CTA color (light) |
|------|---------------|--------------------|--------------------|
| Featured | `rgba(#7c4dff, 0.16)` | `rgba(#7c4dff, 0.24)` | `#5a2dd0` |
| Journey | `rgba(#5c6a8a, 0.16)` | `rgba(#5c6a8a, 0.24)` | `#3d4e6e` |
| Article | `rgba($accent-article, 0.16)` | `rgba($accent-article, 0.24)` | `#5e4a30` |
| Quiz | `rgba(#0d7c51, 0.16)` | `rgba(#0d7c51, 0.24)` | `#0a6340` |
| Monthly Zone | `rgba(#b07c10, 0.16)` | `rgba(#b07c10, 0.24)` | `#7a580a` |

Dark mode CTAs : `background: none; border: none` (texte accent uniquement)

**Featured card distinction :** border violet `rgba(#7c4dff, 0.22)` light / `rgba(#b388ff, 0.18)` dark, box-shadow glow violet

**Accent top bars :** gradient `$primary-indigo → accent color`, 3px. Dark: `brightness(1.2)` + glow

#### CTA labels home (i18n)

Le CTA de la card Voyage sur la home utilise `home.hero.startJourney` : FR "Decoller", EN "Take off", ES "Despegar" (court, on-brand "FLY"). La page voyages complete (`journeys.startJourney`) garde "Commencer le voyage" (plus de place).

#### Long Press mobile

- **Tap** (< 400ms) : navigation normale
- **Long press** (>= 400ms) : description apparait en fondu, retour haptique (`navigator.vibrate(10)`), auto-dismiss 3s
- **Signals** : `longPressedCard: signal<string | null>(null)`, `isMobileGrid: signal<boolean>`
- **Events template** : `(pointerdown)` / `(pointerup)` / `(pointerleave)` sur chaque card
- **CSS** : `.hero-card.long-pressed` → `.hero-card-desc { max-height: 60px; opacity: 1 }`
- Les `routerLink` des cards quiz/article sont conditionnels (`[routerLink]="isMobileGrid() ? null : ..."`) pour eviter navigation pendant long-press

#### Carte mondiale mobile (hero card map)

**Light :**
- Video wash : gradient bleu sur toute la surface (`rgba(200,220,255,0.22) → 0.06`)
- Orbs lumineux bleus, shimmer bleu-teinte
- Bottom gradient : indigo profond (`rgba(15,25,60,0.72)`)
- Accent bar top : 2.5px gradient `$primary-blue → $primary-indigo → #5c6bc0`
- CTA "Explorer" : glassmorphism `rgba(255,255,255,0.22)` + border `rgba(255,255,255,0.35)` + double shadow (`rgba(0,0,0,0.15)` + `rgba(255,255,255,0.08)`)
- Shadow 3 couches (dont bottom spread `rgba($primary-indigo, 0.08)` pour transition douce vers grille)

**Dark :**
- Video wash quasi transparent (`rgba(15,20,40,0.10)`)
- Orbs indigo discrets, shimmer indigo
- Bottom gradient : `rgba(12,14,32,0.82)` indigo-deep
- Accent bar top : 3px gradient blue→indigo + `brightness(1.2)` + glow
- Border : `rgba(#5c6bc0, 0.18)` + shadow indigo glow
- CTA : `rgba($primary-indigo, 0.30)` + border `rgba(#5c6bc0, 0.30)`

#### Footer carousel mobile

**Light :**
- Background : gradient indigo-tinted glass (`rgba(248,249,255,0.95) → rgba(255,255,255,0.94)`)
- Accent line : `$primary-blue → $primary-indigo → $logo-orange`
- Header : icon `$primary-indigo` opacity 0.6, titre `#3949ab` opacity 0.6
- Chips : indigo-tinted glass (`carousel-categories.component.scss`)

**Dark :**
- Background : gradient indigo profond (`rgba(16,18,36,0.94) → rgba(20,22,44,0.96)`)
- Accent line : indigo gradient + `brightness(1.1)` + glow
- Header : icon `#7986cb` opacity 0.8, titre `#9fa8da` opacity 0.75
- Chips : indigo-tinted glass, border `rgba(92,107,192,0.18)`, label `#e8eaf6`

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

**Hero title compacte :** logo 64px (au lieu de 80px), margins reduits, padding-top: 0

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
- **Featured mode** : animation cinematique fly-in, overlay violet, popup avec header violet
- **Journey mode** : navigation multi-etapes, couleur dynamique via `--journey-color`
- Offset popup : `lat + 0.0012` pour centrer popup visible au zoom 17

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
| `article.service.ts` | `listPublishedArticles()`, `getArticleBySlug()` |
| `quiz.service.ts` | `listPublishedQuizzes()`, `getQuiz()`, `getQuizQuestions()`, `getMonthlyQuiz()`, `getSoundFilename()`, `getLeaderboard()`, `getAttempt()` |
| `zone.service.ts` | `listZones()`, `getZoneById()`, `getZoneBySlug()`, `getMonthlyZone()`, `listZoneSoundsByZone()`, `listZoneSoundsBySound()`, `getSoundsForZone()` |
| `sound-journey.service.ts` | `listPublicJourneys()`, `getJourney()`, `listSteps()` |

### Quiz en mode deconnecte

- L'utilisateur peut jouer sans se connecter
- `quiz-play.component.ts` : `finishQuiz()` verifie `isAuthenticated()` — si guest, navigue vers `/quiz/:id/results/local` avec state local
- L'enregistrement du score (`submitAttempt`) requiert l'authentification
- Le schema `QuizAttempt` n'autorise `create` que pour `authenticated`

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

## Fichiers temporaires a ignorer

- `preview-color-proposals.html` (preview design, pas partie de l'app)
