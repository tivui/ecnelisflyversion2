import { Language } from "./i18n.model";

export type Theme = 'light' | 'dark'

export interface AppUser {
  id: string;                  // Cognito sub
  username: string;
  email: string;
  language: Language;
  theme: Theme;
  newNotificationCount: number;
  flashNew: boolean;
  country: string | null;
}
export { Language };

