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
    { icon: 'public', titleKey: 'guide.explore.title', textKey: 'guide.explore.text' },
    { icon: 'headphones', titleKey: 'guide.listen.title', textKey: 'guide.listen.text' },
    { icon: 'person_add', titleKey: 'guide.account.title', textKey: 'guide.account.text' },
    { icon: 'add_location', titleKey: 'guide.addSound.title', textKey: 'guide.addSound.text' },
    { icon: 'quiz', titleKey: 'guide.quiz.title', textKey: 'guide.quiz.text' },
    { icon: 'route', titleKey: 'guide.journeys.title', textKey: 'guide.journeys.text' },
    { icon: 'location_on', titleKey: 'guide.zones.title', textKey: 'guide.zones.text' },
    { icon: 'category', titleKey: 'guide.categories.title', textKey: 'guide.categories.text' },
  ];
}
