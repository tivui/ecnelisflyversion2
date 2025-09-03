import { Component, signal } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import {MatTabsModule} from '@angular/material/tabs';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-database',
  standalone: true,
  imports: [RouterOutlet, RouterLink, MatTabsModule, TranslateModule],
  templateUrl: './database.component.html',
  styleUrl: './database.component.scss'
})
export class DatabaseComponent {

  tabs = signal([
    { route: 'import-sounds', label: 'admin.database.importSounds' },
  ]);

  activeTab = this.tabs()[0].route;

  trackTab = (tab: { route: string; label: string }) => tab.route;

}
