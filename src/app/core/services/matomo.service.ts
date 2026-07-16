// src/app/core/services/matomo.service.ts
import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import 'tslib';

// Déclaration globale pour TypeScript
declare global {
  interface Window {
    _paq: Array<Array<string | number | boolean | undefined>>;
  }
}

/**
 * Service d'intégration Matomo pour Ecnelis FLY.
 *
 * Centralise toutes les interactions avec le tracker Matomo :
 * - Pages vues (SPA)
 * - Événements personnalisés (lecture son, like, partage, carte)
 * - Objectifs (goals)
 * - Dimensions personnalisées
 * - Recherche interne
 */
@Injectable({ providedIn: 'root' })
export class MatomoService {

  // ──────────────────────────────────────────────
  // CONFIGURATION
  // ──────────────────────────────────────────────
  private readonly MATOMO_URL = environment.matomo.url;
  private readonly SITE_ID = environment.matomo.siteId;

  private initialized = false;

  private lastEventFired = new Map<string, number>();
  private readonly DEDUPE_WINDOW_MS = 500;


  /**
   * Initialise le tracker Matomo.
   * À appeler UNE SEULE FOIS dans AppComponent.ngOnInit().
   */
  init(): void {
    if (this.initialized || !environment.matomo.enabled) return;

    window._paq = window._paq || [];

    // ── Configuration vie privée (RGPD) ──
    // Désactiver les cookies par défaut (mode sans consentement CNIL)
    // Décommenter la ligne ci-dessous si vous souhaitez fonctionner SANS cookies :
    // window._paq.push(['disableCookies']);

    // Anonymiser les 2 derniers octets de l'IP
    // (se configure côté serveur Matomo, mais on le rappelle ici)

    // Ne pas suivre les utilisateurs ayant activé Do Not Track
    // window._paq.push(['setDoNotTrack', true]);

    // ── Première page vue ──
    window._paq.push(['trackPageView']);
    window._paq.push(['enableLinkTracking']);

    // ── Chargement du script tracker ──
    window._paq.push(['setTrackerUrl', this.MATOMO_URL + 'matomo.php']);
    window._paq.push(['setSiteId', String(this.SITE_ID)]);

    const d = document;
    const g = d.createElement('script');
    const s = d.getElementsByTagName('script')[0];
    g.async = true;
    g.src = this.MATOMO_URL + 'matomo.js';
    s.parentNode?.insertBefore(g, s);

    this.initialized = true;
    console.log('[Matomo] Tracker initialisé');
  }

  // ──────────────────────────────────────────────
  // PAGES VUES (SPA)
  // ──────────────────────────────────────────────

  /**
   * Enregistre une page vue. Indispensable pour les SPA Angular
   * car Matomo ne détecte pas automatiquement les changements de route.
   *
   * @param url  URL courante (ex. '/mapfly?category=nature')
   * @param title Titre optionnel de la page
   */
  trackPageView(url: string, title?: string): void {
    window._paq = window._paq || [];
    window._paq.push(['setCustomUrl', url]);
    window._paq.push(['setDocumentTitle', title || document.title]);

    // Effacer le référent interne pour ne pas fausser les stats
    window._paq.push(['setReferrerUrl', document.referrer]);

    window._paq.push(['trackPageView']);
    console.log(`[Matomo] Page vue : ${url}`);
  }

  // ──────────────────────────────────────────────
  // ÉVÉNEMENTS PERSONNALISÉS
  // ──────────────────────────────────────────────

  /**
   * Enregistre un événement personnalisé.
   *
   * @param category  Catégorie de l'événement (ex. 'Son', 'Carte', 'Quiz')
   * @param action    Action effectuée (ex. 'Lecture', 'Pause', 'Zoom')
   * @param name      Nom optionnel (ex. titre du son, nom de la zone)
   * @param value     Valeur numérique optionnelle (ex. durée en secondes)
   */
  trackEvent(
    category: string,
    action: string,
    name?: string,
    value?: number,
  ): void {
    // Ignore les déclenchements identiques trop rapprochés (doublons techniques)
    const key = `${category}|${action}|${name ?? ''}`;
    const now = Date.now();
    const lastFired = this.lastEventFired.get(key);
    if (lastFired && now - lastFired < this.DEDUPE_WINDOW_MS) {
      console.log(`[Matomo] Doublon ignoré : ${key}`);
      return;
    }
    this.lastEventFired.set(key, now);

    window._paq = window._paq || [];
    window._paq.push(['trackEvent', category, action, name, value]);
    console.log(`[Matomo] Événement : ${category} / ${action} / ${name ?? ''}`);
  }

  // ──────────────────────────────────────────────
  // OBJECTIFS (GOALS)
  // ──────────────────────────────────────────────

  /**
   * Enregistre la conversion d'un objectif.
   * Les objectifs doivent être créés au préalable dans l'interface Matomo.
   *
   * @param goalId  ID numérique de l'objectif (défini dans Matomo)
   * @param revenue Revenu optionnel associé
   */
  trackGoal(goalId: number, revenue?: number): void {
    window._paq = window._paq || [];
    window._paq.push(['trackGoal', goalId, revenue]);
    console.log(`[Matomo] Objectif atteint : #${goalId}`);
  }

  // ──────────────────────────────────────────────
  // RECHERCHE INTERNE
  // ──────────────────────────────────────────────

  /**
   * Enregistre une recherche effectuée dans le site.
   *
   * @param keyword      Terme recherché
   * @param category     Catégorie de recherche (ex. 'Sons', 'Zones', 'Pays')
   * @param resultsCount Nombre de résultats affichés
   */
  trackSiteSearch(
    keyword: string,
    category?: string,
    resultsCount?: number,
  ): void {
    window._paq = window._paq || [];
    window._paq.push(['trackSiteSearch', keyword, category, resultsCount]);
    console.log(`[Matomo] Recherche : "${keyword}" (${resultsCount ?? '?'} résultats)`);
  }

  // ──────────────────────────────────────────────
  // DIMENSIONS PERSONNALISÉES
  // ──────────────────────────────────────────────

  /**
   * Définit une dimension personnalisée.
   * Les dimensions doivent être créées au préalable dans Matomo
   * (Administration > Dimensions personnalisées).
   *
   * @param dimensionId  ID de la dimension (1, 2, 3...)
   * @param value        Valeur à assigner
   * @param scope        'visit' ou 'action'
   */
  setCustomDimension(dimensionId: number, value: string): void {
    window._paq = window._paq || [];
    window._paq.push(['setCustomDimension', dimensionId, value]);
  }

  // ──────────────────────────────────────────────
  // CONSENTEMENT (RGPD)
  // ──────────────────────────────────────────────

  /** L'utilisateur accepte le suivi */
  grantConsent(): void {
    window._paq = window._paq || [];
    window._paq.push(['setConsentGiven']);
  }

  /** L'utilisateur refuse le suivi */
  revokeConsent(): void {
    window._paq = window._paq || [];
    window._paq.push(['forgetConsentGiven']);
  }

  /** Active le mode "consentement requis" — aucune donnée collectée avant accord */
  requireConsent(): void {
    window._paq = window._paq || [];
    window._paq.push(['requireConsent']);
  }
}
