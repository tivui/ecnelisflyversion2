import { Language } from "./i18n.model";

export interface AppUser {
  id: string;                  // Cognito sub
  username: string;
  email: string;
  language: Language;
  newNotificationCount: number;
  flashNew: boolean;
}
