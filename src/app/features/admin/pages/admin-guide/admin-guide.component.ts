import { Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-admin-guide',
  standalone: true,
  imports: [MatIconModule, MatButtonModule, TranslatePipe],
  templateUrl: './admin-guide.component.html',
  styleUrl: './admin-guide.component.scss',
})
export class AdminGuideComponent {
  readonly sections = [
    { icon: 'pending_actions', titleKey: 'adminGuide.moderation.title', textKey: 'adminGuide.moderation.text' },
    { icon: 'today', titleKey: 'adminGuide.featured.title', textKey: 'adminGuide.featured.text' },
    { icon: 'quiz', titleKey: 'adminGuide.quiz.title', textKey: 'adminGuide.quiz.text' },
    { icon: 'location_on', titleKey: 'adminGuide.zones.title', textKey: 'adminGuide.zones.text' },
    { icon: 'route', titleKey: 'adminGuide.journeys.title', textKey: 'adminGuide.journeys.text' },
    { icon: 'menu_book', titleKey: 'adminGuide.articles.title', textKey: 'adminGuide.articles.text' },
    { icon: 'star', titleKey: 'adminGuide.monthly.title', textKey: 'adminGuide.monthly.text' },
    { icon: 'bar_chart', titleKey: 'adminGuide.stats.title', textKey: 'adminGuide.stats.text' },
  ];
}
