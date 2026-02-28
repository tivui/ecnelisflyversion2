# Ecnelis FLY

Application web PWA d'exploration sonore geolocalisee. Decouvrez, ecoutez et partagez des sons du monde entier sur une carte interactive.

## Fonctionnalites

### Public (sans compte)

- Carte mondiale interactive (Leaflet) avec markers clusteres par categorie
- Ecoute des sons avec player waveform (WaveSurfer.js)
- Filtres temporels (derniers, semaine, mois) et par categorie
- Son du jour avec animation cinematique fly-in
- Quiz sonores avec classement
- Voyages sonores multi-etapes
- Terroirs sonores (zones geographiques)
- Articles edito
- Recherche par lieu ou par son
- 3 langues : francais, anglais, espagnol
- Mode clair / sombre

### Authentifie

- Ajout de sons geolocalises (enregistrement + upload)
- Like / telechargement (selon licence)
- Partage de sons (Web Share API + clipboard)
- Dashboard personnel (statistiques, mes sons)
- Carte personnelle (`/mapfly?userId=xxx`)
- Publication de scores quiz
- Avatar personnalisable (DiceBear, 14 styles)
- Quotas d'upload (10/semaine, 30/mois)

### Administration

- Tableau de bord admin (KPIs, graphiques, moderation)
- Gestion BDD : son du jour, voyages, quiz, terroirs, articles, import
- Override manuel des elements mis en valeur (mois/jour)
- Templates email (editeur admin)
- Guide administrateur (`/admin/guide`)

## Stack technique

| Couche | Technologie |
|--------|------------|
| Frontend | Angular 20 (standalone components, signals, TypeScript 5.9) |
| UI | Angular Material |
| Carte | Leaflet + MarkerCluster + MiniMap |
| Audio | WaveSurfer.js v7 |
| Backend | AWS Amplify Gen2 (AppSync GraphQL, DynamoDB) |
| Auth | Amazon Cognito (email + Google OAuth) |
| Storage | AWS S3 |
| i18n | @ngx-translate (FR / EN / ES) |
| Deploiement | AWS Amplify Hosting |

## Demarrage

```bash
npm install
npx ng serve        # Dev server (localhost:4200)
npx ng build        # Build production
```

Prerequis : Node.js 22+, npm, compte AWS avec Amplify configure.

## Structure du projet

```
src/app/
  features/
    home/           # Page d'accueil (hero cards, carousel 3D, stats)
    map/            # Carte interactive (mapfly, popups, bottom sheet)
    new-sound/      # Workflow d'ajout de son
    dashboard/      # Dashboard utilisateur
    admin/          # Administration (dashboard, BDD, guide admin)
    quiz/           # Quiz sonores (liste, lobby, jeu, resultats)
    journeys/       # Voyages sonores
    zones/          # Terroirs sonores
    articles/       # Articles
    categories/     # Page categories
    users/          # Page compte
    support/        # Page soutien
    guide/          # Guide utilisateur
    legal/          # Mentions legales
  core/
    services/       # Services metier (auth, sons, quiz, etc.)
    models/         # Modeles TypeScript et queries GraphQL
    pages/          # Pages systeme (login, 404)
  shared/
    components/     # Composants partages (sidenav, carousel, etc.)
amplify/
  data/             # Schema GraphQL + categories
  auth/             # Configuration Cognito
  storage/          # Configuration S3
  functions/        # Lambdas (featured, monthly picks, import, email)
public/
  i18n/             # Fichiers de traduction (fr.json, en.json, es.json)
```

## i18n

Trois langues supportees via `@ngx-translate` :
- Fichiers JSON dans `public/i18n/`
- Templates : `{{ 'cle' | translate }}`
- Services : `translate.instant('cle')`

## PWA

L'application est installable en tant que PWA :
- Manifest dans `src/manifest.json`
- Icones dans `public/img/logos/`
- Mode `standalone`, orientation portrait

## Licence

(c) 2021-2026 Ecnelis FLY — Tous droits reserves.
