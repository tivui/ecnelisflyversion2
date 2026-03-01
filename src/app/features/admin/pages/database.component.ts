import { Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import {MatTabsModule} from '@angular/material/tabs';
import { TranslateModule } from '@ngx-translate/core';

@Component({
    selector: 'app-database',
    imports: [RouterOutlet, RouterLink, RouterLinkActive, MatTabsModule, TranslateModule],
    templateUrl: './database.component.html',
    styleUrl: './database.component.scss'
})
export class DatabaseComponent {

  tabs = signal([
    { route: 'featured-sound', label: 'admin.database.featuredSound' },
    { route: 'journeys', label: 'admin.database.journeys' },
    { route: 'quizzes', label: 'admin.database.quizzes' },
    { route: 'zones', label: 'admin.database.zones' },
    { route: 'articles', label: 'admin.database.articles' },
    { route: 'sound-attribution', label: 'admin.database.soundAttribution' },
    { route: 'import-sounds', label: 'admin.database.importSounds' },
    { route: 'email-templates', label: 'admin.database.emailTemplates' },
    { route: 'storage', label: 'admin.database.storage' },
  ]);

  trackTab = (tab: { route: string; label: string }) => tab.route;

}
