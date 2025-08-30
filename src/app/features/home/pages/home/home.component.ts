import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppUserService } from '../../../../core/services/app-user.service';
import { AppUser } from '../../../../core/models/app-user.model';
import { TranslatePipe } from '@ngx-translate/core';
import { toSignal } from '@angular/core/rxjs-interop';

// Amplify Storage test
import { getUrl, list } from 'aws-amplify/storage';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent {
  private readonly appUserService = inject(AppUserService);

  public appUser = toSignal<AppUser | null>(this.appUserService.currentUser$, {
    initialValue: null,
  });

  public audioUrl: string | null = null;
  private audio?: HTMLAudioElement;

  constructor() {
    this.loadAudio();
  }

  async loadAudio() {
    try {
      const result = await list({
        path: 'sounds/',
      });
      console.log("result sounds list", result.items)
      const { url } = await getUrl({
        path: 'sounds/test-peche-lancer.mp3',
      });
      this.audioUrl = url.toString();
      this.audio = new Audio(this.audioUrl);
    } catch (err) {
      console.error('Erreur lors du chargement du son :', err);
    }
  }

  play() {
    this.audio?.play();
  }

  stop() {
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
    }
  }
}
