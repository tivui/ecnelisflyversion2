import { Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import {MatTabsModule} from '@angular/material/tabs';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-database',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatTabsModule, TranslateModule],
  templateUrl: './database.component.html',
  styleUrl: './database.component.scss'
})
export class DatabaseComponent {

  tabs = signal([
    { route: 'import-sounds', label: 'admin.database.importSounds' },
    { route: 'zones', label: 'admin.database.zones' },
    { route: 'featured-sound', label: 'admin.database.featuredSound' },
    { route: 'journeys', label: 'admin.database.journeys' },
    { route: 'quizzes', label: 'admin.database.quizzes' },
    { route: 'articles', label: 'admin.database.articles' },
  ]);

  trackTab = (tab: { route: string; label: string }) => tab.route;

}
