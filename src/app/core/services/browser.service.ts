import { Injectable } from '@angular/core';
import { Language } from '../models/i18n.model';

@Injectable({
  providedIn: 'root'
})
export class BrowserService {
  private readonly supportedLanguages: Language[] = ['fr', 'en', 'es'];

  /**
   * Get browser language (short code).
   * Works consistently across Chrome, Edge, Firefox, Safari.
   */
  getBrowserLanguage(): Language {
    // Best-effort: take first preferred language
    const raw = navigator.languages?.[0] ?? navigator.language ?? 'fr';
    const [lang] = raw.split('-'); // → "fr"

    if (this.supportedLanguages.includes(lang as Language)) {
      return lang as Language;
    }
    return 'fr';
  }

  /**
   * Get browser country in uppercase (ex: "FR", "US").
   * If region not available, fallback mapping.
   */
  getBrowserCountry(): string | null {
    const raw = navigator.languages?.[0] ?? navigator.language ?? null;
    if (!raw) return null;

    const parts = raw.split('-');
    if (parts.length > 1) {
      return parts[1].toUpperCase(); // ex: "FR" from "fr-FR"
    }

    // 🔥 Fallback mapping for cases like "fr" (Edge/Firefox)
    switch (parts[0].toLowerCase()) {
      case 'fr': return 'FR';
      case 'en': return 'US'; // or 'GB' depending on your audience
      case 'es': return 'ES';
      default: return null;
    }
  }

  /**
   * Get both language and country consistently
   */
  getLocale(): { language: Language; country: string | null } {
    return {
      language: this.getBrowserLanguage(),
      country: this.getBrowserCountry(),
    };
  }
}
