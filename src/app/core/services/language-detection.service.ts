import { Injectable } from '@angular/core';
import { franc } from 'franc-min';

/**
 * Detects the source language using franc-min and
 * returns a valid Amazon Translate language code.
 * Returns null if the detected language is not supported by Amazon Translate.
 */
@Injectable({
  providedIn: 'root',
})
export class LanguageDetectionService {
  /**
   * franc-min supported languages (ISO 639-3)
   */
  /**
   * ISO 639-3 codes that can be mapped to Amazon Translate
   */
  private readonly FRANC_TO_AMAZON: Record<string, string> = {
    eng: 'en',
    fra: 'fr',
    spa: 'es',
    deu: 'de',
    ita: 'it',
    por: 'pt',
    jpn: 'ja',
    kor: 'ko', // Korean
    cmn: 'zh', // Mandarin Chinese
  };

  /**
   * Amazon Translate validated language codes
   */
  private readonly AMAZON_SUPPORTED = new Set([
    'de',
    'en',
    'es',
    'fr',
    'it',
    'ja',
    'ko',
    'pt',
    'zh',
    'zh-TW',
  ]);

  /**
   * Detects the source language and returns an Amazon Translate
   * compatible language code, or null if unsupported.
   */
  detect(text: string): string | null {
    console.log('text to detect:', text);
    if (!text || text.length < 10) {
      return null;
    }

    const iso6393 = franc(text, {
      only: Object.keys(this.FRANC_TO_AMAZON),
      minLength: 10,
    });

    console.log('Detected ISO 639-3 code:', iso6393);

    if (iso6393 === 'und') {
      return null;
    }

    const amazonLang = this.mapToAmazonTranslate(iso6393);

    return amazonLang && this.AMAZON_SUPPORTED.has(amazonLang)
      ? amazonLang
      : null;
  }

  /**
   * Maps ISO 639-3 codes to Amazon Translate language codes
   */
  private mapToAmazonTranslate(code: string): string | null {
    const map: Record<string, string> = {
      eng: 'en',
      fra: 'fr',
      spa: 'es',
      deu: 'de',
      ita: 'it',
      por: 'pt',
      jpn: 'ja',
      kor: 'ko',
      cmn: 'zh', // Mandarin Chinese
    };

    return map[code] ?? null;
  }
}
