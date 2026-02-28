import { Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
    selector: 'app-admin-guide',
    imports: [MatIconModule, MatButtonModule, TranslatePipe],
    templateUrl: './admin-guide.component.html',
    styleUrl: './admin-guide.component.scss'
})
export class AdminGuideComponent {
  readonly sections = [
    { icon: 'pending_actions', titleKey: 'adminGuide.sections.moderation.title', textKey: 'adminGuide.sections.moderation.text' },
    { icon: 'today', titleKey: 'adminGuide.sections.featured.title', textKey: 'adminGuide.sections.featured.text' },
    { icon: 'quiz', titleKey: 'adminGuide.sections.quiz.title', textKey: 'adminGuide.sections.quiz.text' },
    { icon: 'location_on', titleKey: 'adminGuide.sections.zones.title', textKey: 'adminGuide.sections.zones.text' },
    { icon: 'route', titleKey: 'adminGuide.sections.journeys.title', textKey: 'adminGuide.sections.journeys.text' },
    { icon: 'menu_book', titleKey: 'adminGuide.sections.articles.title', textKey: 'adminGuide.sections.articles.text' },
    { icon: 'star', titleKey: 'adminGuide.sections.monthly.title', textKey: 'adminGuide.sections.monthly.text' },
    { icon: 'bar_chart', titleKey: 'adminGuide.sections.stats.title', textKey: 'adminGuide.sections.stats.text' },
  ];
}
