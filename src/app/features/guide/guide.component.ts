import { Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-guide',
  standalone: true,
  imports: [MatIconModule, MatButtonModule, TranslatePipe],
  templateUrl: './guide.component.html',
  styleUrl: './guide.component.scss',
})
export class GuideComponent {
  readonly sections = [
    { icon: 'public', titleKey: 'guide.sections.explore.title', textKey: 'guide.sections.explore.text' },
    { icon: 'headphones', titleKey: 'guide.sections.listen.title', textKey: 'guide.sections.listen.text' },
    { icon: 'person_add', titleKey: 'guide.sections.account.title', textKey: 'guide.sections.account.text' },
    { icon: 'add_location', titleKey: 'guide.sections.addSound.title', textKey: 'guide.sections.addSound.text' },
    { icon: 'quiz', titleKey: 'guide.sections.quiz.title', textKey: 'guide.sections.quiz.text' },
    { icon: 'route', titleKey: 'guide.sections.journeys.title', textKey: 'guide.sections.journeys.text' },
    { icon: 'location_on', titleKey: 'guide.sections.zones.title', textKey: 'guide.sections.zones.text' },
    { icon: 'category', titleKey: 'guide.sections.categories.title', textKey: 'guide.sections.categories.text' },
  ];
}
