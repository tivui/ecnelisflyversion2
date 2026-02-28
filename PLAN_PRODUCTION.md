# Plan de mise en production Ecnelis FLY — 4 jours

## Contexte

L'application est fonctionnellement riche mais il manque des finitions essentielles pour une mise en production professionnelle : versioning, gestion des licences, pages d'erreur, partage de sons, notifications, documentation. Ce plan organise ~25 taches en 4 jours, du plus critique (securite, stabilite) au plus optionnel (docs, liens sociaux).

---

## Jour 1 — Fondations & Securite

> Objectif : tout ce qui est indispensable avant une mise en prod.

### 1.1 Versioning de l'application (~30min)
- Mettre `package.json` version a `1.0.0`
- Creer `src/environments/version.ts` exporte depuis `package.json`
- Afficher la version dans le footer du sidenav mobile + page compte
- **Fichiers** : `package.json`, `src/environments/`, `sidenav-menu.component.*`, `account.component.*`

### 1.2 Page 404 (~45min)
- Creer un composant `NotFoundComponent` standalone avec design coherent (illustration Material icon `explore_off`, bouton retour accueil)
- Remplacer `{ path: '**', redirectTo: 'home' }` par `{ path: '**', component: NotFoundComponent }`
- Dark/light mode
- **Fichiers** : nouveau `core/pages/not-found/`, `app.routes.ts`

### 1.3 Gestion des licences de sons (~2h)
- **Tooltip licence** : afficher un chip/badge de licence sur les popups desktop et bottom sheet mobile (READ_ONLY, CC_BY, CC_BY_NC, PUBLIC_DOMAIN) avec tooltip explicatif
- **Desactiver download** : masquer le bouton download si `license === 'READ_ONLY'` (mapfly popups desktop + sound-popup-sheet mobile)
- Ajouter i18n pour les labels de licence (FR/EN/ES)
- **Fichiers** : `mapfly.component.ts` (popups HTML), `sound-popup-sheet.component.*`, `map.scss`, fichiers i18n

### 1.4 prefers-color-scheme par defaut (~30min)
- Au premier chargement (pas de theme sauvegarde en base), detecter `window.matchMedia('(prefers-color-scheme: dark)')` et appliquer le theme correspondant
- Ne pas ecraser la preference user si elle existe deja en base
- **Fichiers** : `app.component.ts` (section theme dans ngOnInit)

### 1.5 Partage de son — copier le lien (~1h)
- Ajouter un bouton "Partager" (icone `share`) a cote du download dans les popups desktop et bottom sheet mobile
- Clic → construit l'URL `/mapfly?lat=X&lng=Y&zoom=17&basemap=mapbox&soundFilename=XXX` et copie dans le presse-papier (`navigator.clipboard.writeText`)
- Snackbar de confirmation "Lien copie"
- Utiliser `navigator.share()` en fallback sur mobile si disponible (Web Share API)
- **Fichiers** : `mapfly.component.ts`, `sound-popup-sheet.component.*`, `map.scss`, i18n

### 1.6 Suppression des scores quiz par l'admin (~1h)
- Ajouter dans la page admin quiz detail un onglet/section "Leaderboard" avec la liste des attempts
- Bouton supprimer par attempt + bouton "Supprimer tous les scores" avec confirmation dialog
- Methode `deleteAttempt(id)` et `deleteAllAttempts(quizId)` dans `quiz.service.ts`
- Le schema autorise deja `delete` pour ADMIN
- **Fichiers** : `quiz.service.ts`, `quiz-admin-list.component.*` ou nouveau composant de gestion des scores

---

## Jour 2 — Experience Utilisateur

> Objectif : polish UX, rappels, feedback utilisateur.

### 2.1 Rappel casque audio (~1h)
- Au premier play audio (WaveSurfer `onPlay` callback), afficher un snackbar/bottom-sheet elegant une seule fois par session : "Pour une meilleure experience, utilisez un casque"
- Icone `headphones` + bouton "Compris"
- Stocker un flag `sessionStorage` pour ne pas reafficher
- **Fichiers** : `wavesurfer-player.service.ts` (callback onPlay), nouveau composant ou snackbar global, i18n

### 2.2 Audio ne coupe pas les autres apps (~45min)
- Implementer `navigator.mediaSession` (Media Session API) pour declarer les metadata du son en cours de lecture
- Configurer les action handlers (play, pause, stop)
- Cela permet a l'OS mobile de gerer correctement la coexistence audio (ne pas couper Spotify etc. sauf si l'utilisateur joue un son)
- Note : le comportement "couper les autres apps" est le defaut du navigateur — on peut attenuer avec `AudioContext` en mode `playback` mais le controle total n'est pas possible en PWA
- **Fichiers** : `wavesurfer-player.service.ts`

### 2.3 Badges de notifications (base) (~2h)
- Le modele `User` a deja `newNotificationCount` et `flashNew`
- Afficher un badge rouge sur l'icone menu du sidenav (ou bottom nav) quand `newNotificationCount > 0`
- Pour l'admin : badge sur le menu "Admin" quand il y a des sons en attente de moderation (`pending_count`)
- Incrementer `newNotificationCount` quand un son est like (via la Lambda ou cote client)
- Reset du compteur quand l'utilisateur ouvre le menu/notifications
- **Fichiers** : `app.component.*`, `app-user.service.ts`, `app-user.model.ts`, bottom nav template

### 2.4 Email de confirmation creation de son (~1h)
- Apres `Sound.create()` reussi dans `confirmation-step.component.ts`, envoyer un email via SES (ou Cognito custom message) a l'auteur
- Template simple : "Votre son [titre] a ete ajoute avec succes" / "est en attente de validation" selon le statut
- Si SES pas encore configure (domaine OVH pas cable) : preparer le code, activer plus tard
- **Fichiers** : nouvelle Lambda `send-sound-confirmation-email/`, `confirmation-step.component.ts`, `amplify/data/resource.ts`

### 2.5 Fenetre de don / soutien (~1h30)
- Page simple ou dialog accessible depuis le sidenav : "Soutenir Ecnelis FLY"
- Lien externe vers un service de don (Ko-fi, Buy Me a Coffee, ou PayPal.me — pas besoin de Stripe pour demarrer)
- Design soigne avec texte expliquant le projet, bouton CTA vers le lien de don
- Optionnel : petit rappel discret apres X sessions (pas intrusif)
- **Fichiers** : nouveau composant `features/support/`, route, sidenav-menu, i18n

---

## Jour 3 — Admin & Backend

> Objectif : outils admin, securite des donnees, configuration production.

### 3.1 Dashboard connexions Cognito pour admin (~2h)
- Nouvelle section dans admin-dashboard : statistiques de connexion
- Utiliser `aws-amplify/auth` pour lister les users Cognito via Lambda (AdminListUsers API)
- Afficher : nombre de connexions recentes, nouveaux inscrits par semaine/mois, repartition email/Google OAuth
- Graphique ngx-charts (line chart connexions over time)
- **Fichiers** : nouvelle Lambda `list-cognito-users/`, `admin-dashboard.component.*`

### 3.2 Templates email Cognito (~1h)
- Preparer les templates HTML pour les emails Cognito : verification, reset password, welcome
- Configurer dans `amplify/auth/resource.ts` les `emailSubject` et `emailBody` customises
- Design coherent avec la marque Ecnelis FLY (logo, couleurs)
- **Fichiers** : `amplify/auth/resource.ts`, templates HTML inline ou dans un dossier `amplify/auth/emails/`

### 3.3 Politique de sauvegarde S3 (~30min)
- Activer le versioning S3 dans `amplify/storage/resource.ts` (via CDK override)
- Configurer une lifecycle rule : suppression des anciennes versions apres 90 jours
- Documenter la procedure de restauration
- **Fichiers** : `amplify/storage/resource.ts`, `amplify/backend.ts` (CDK overrides)

### 3.4 Cablage domaine OVH (~1h, partiellement hors code)
- Mettre a jour les callback URLs Cognito dans `amplify/auth/resource.ts` pour inclure `https://ecnelisfly.com`
- Activer le bloc SES commente dans `amplify/backend.ts`
- **Hors code** (AWS Console + OVH) : ajouter le domaine custom dans Amplify Hosting, configurer les records DNS CNAME/ALIAS sur OVH, valider le certificat SSL
- **Fichiers** : `amplify/auth/resource.ts`, `amplify/backend.ts`

### 3.5 Liens sociaux Facebook / Instagram (~45min)
- Ajouter les liens vers la page Facebook et Instagram dans le footer du sidenav
- Icones SVG ou Material : `facebook`, lien externe
- Deep links : pour passer d'un profil perso a une Page Facebook, l'URL est `https://www.facebook.com/VOTRE_PAGE` — sur mobile le navigateur redirige vers l'app Facebook automatiquement
- **Fichiers** : `sidenav-menu.component.*`, i18n

---

## Jour 4 — Documentation & Finitions

> Objectif : documentation, protection, derniers ajustements.

### 4.1 Notice administrateur (~2h)
- Document PDF/page web orientee gestion : comment moderer les sons, gerer les quiz/zones/voyages/articles, overrider les elements du mois, consulter les stats
- Format : page Angular dediee `/admin/guide` ou PDF genere
- Screenshots des interfaces admin, workflows etape par etape
- **Fichiers** : nouveau composant ou document statique dans `public/docs/`

### 4.2 Notice utilisateur (~2h)
- Guide user-friendly : comment explorer la carte, ecouter les sons, creer un compte, ajouter un son, jouer aux quiz
- Design convivial avec illustrations/icones Material
- Accessible depuis le sidenav ("Aide" ou "Guide")
- Format : page Angular scrollable ou PDF telechargeble
- **Fichiers** : nouveau composant `features/guide/`, route, sidenav

### 4.3 Protection des droits (~1h, mixte code/legal)
- Ajouter mentions legales / CGU dans une page accessible depuis le sidenav
- Footer avec copyright "© 2021-2026 Ecnelis FLY - Tous droits reserves"
- `<meta>` tags pour la protection des images (desactiver clic droit sur les logos n'est pas efficace, mais les meta + watermark digital sont possibles)
- Licence de l'application clairement affichee
- **Fichiers** : nouveau composant `features/legal/`, sidenav, `index.html` meta tags

### 4.4 Mise a jour documentation developpeur (~1h)
- Mettre a jour CLAUDE.md avec tous les nouveaux composants/services ajoutes pendant les 4 jours
- Verifier que les conventions documentees correspondent au code actuel
- Ajouter les nouvelles sections (versioning, licences, notifications, etc.)

### 4.5 Tests finaux pre-prod (~1h)
- Verifier tous les flux en mode deconnecte (apiKey)
- Verifier tous les flux admin
- Tester sur mobile reel (375x667, 390x844)
- Verifier dark/light mode sur toutes les nouvelles pages
- Build production final + verification du bundle size

---

## Elements hors-scope code (a faire en parallele cote infra/admin)

| Tache | Outil | Notes |
|-------|-------|-------|
| Configurer le domaine OVH → AWS | OVH Manager + AWS Console | DNS CNAME, certificat SSL ACM |
| Activer SES production | AWS Console | Sortir du sandbox, verifier le domaine |
| Creer la page Facebook | Facebook | Page pro, pas profil perso |
| Creer le compte Instagram | Instagram | Lien vers le profil |
| Choisir un service de don | Ko-fi / BMC / PayPal | Creer le compte, obtenir le lien |
| Backup DynamoDB | AWS Console | Activer PITR (Point-in-Time Recovery) |

---

## Priorites si le temps manque

**Indispensable (Jour 1)** : Versioning, 404, licences, partage son, suppression scores

**Important (Jour 2)** : prefers-color-scheme, casque, badges admin, don

**Utile (Jour 3)** : Templates email, S3 backup, liens sociaux, domaine OVH

**Bonus (Jour 4)** : Notices PDF, dashboard connexions, protection droits

---

## Verification

Apres chaque jour :
- `npx ng build` sans erreurs
- Test manuel des flux modifies sur mobile (375x667) et desktop
- Verification dark/light mode
- Commit avec message descriptif
