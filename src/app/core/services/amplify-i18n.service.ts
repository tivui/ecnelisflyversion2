import { Injectable } from '@angular/core';
import { I18n } from 'aws-amplify/utils';
import { translations } from '@aws-amplify/ui-angular';
import { Language } from '../models/i18n.model';

/**
 * Centralizes Amplify Authenticator i18n:
 * - Load base vocabularies from @aws-amplify/ui-angular
 * - Overlay our custom keys (only the ones we want)
 * - Keep it in sync with ngx-translate selected language
 */
@Injectable({ providedIn: 'root' })
export class AmplifyI18nService {
  private initialized = false;

  // Only override the keys you care about
  private readonly overrides: Record<string, Record<string, string>> = {
    en: {
      'Sign In': 'Sign in',
      'Sign Up': 'Create account',
      'Create Account': 'Create account',
      'Create account': 'Create account',
      'Email': 'Email',
      'Enter your email': 'Enter your email',
      'Password': 'Password',
      'Enter your password': 'Enter your password',
      'Confirm Password': 'Confirm password',
      'Please confirm your Password': 'Please confirm your password',
      'Forgot your password?': 'Forgot your password?',
      'Forgot Password?': 'Forgot your password?',
    },
    fr: {
      'Sign In': 'Se connecter',
      'Sign Up': 'Créer un compte',
      'Create Account': 'Créer un compte',
      'Create account': 'Créer un compte',
      'Email': 'E-mail',
      'Enter your email': 'Saisissez votre adresse e-mail',
      'Password': 'Mot de passe',
      'Enter your password': 'Saisissez votre mot de passe',
      'Confirm Password': 'Confirmez le mot de passe',
      'Please confirm your Password': 'Confirmez votre mot de passe',
      'Forgot your password?': 'Mot de passe oublié ?',
      'Forgot Password?': 'Mot de passe oublié ?',
    },
    es: {
      'Sign In': 'Iniciar sesión',
      'Sign Up': 'Crear cuenta',
      'Create Account': 'Crear cuenta',
      'Create account': 'Crear cuenta',
      'Email': 'Correo electrónico',
      'Enter your email': 'Introduce tu correo electrónico',
      'Password': 'Contraseña',
      'Enter your password': 'Introduce tu contraseña',
      'Confirm Password': 'Confirmar contraseña',
      'Please confirm your Password': 'Confirma tu contraseña',
      'Forgot your password?': '¿Has olvidado tu contraseña?',
      'Forgot Password?': '¿Has olvidado tu contraseña?',
    },
  };

  /** Initialize Amplify vocabularies once and set initial language */
  init(lang: Language) {
    if (!this.initialized) {
      // Load built-in translations for many locales
      I18n.putVocabularies(translations);
      // Overlay our custom keys
      I18n.putVocabularies(this.overrides);
      this.initialized = true;
    }
    I18n.setLanguage(lang);
  }

  /** Keep Authenticator language in sync with ngx-translate */
  setLanguage(lang: Language) {
    I18n.setLanguage(lang);
  }
}
