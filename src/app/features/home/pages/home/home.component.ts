import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppUserService } from '../../../../core/services/app-user.service';
import { AppUser } from '../../../../core/models/app-user.model';
import { TranslatePipe } from '@ngx-translate/core';
import { toSignal } from '@angular/core/rxjs-interop';

// Amplify Storage test
import { getUrl, list } from 'aws-amplify/storage';
import { AmplifyService } from '../../../../core/services/amplify.service';
import { CategoryKey } from '../../../../../../amplify/data/categories';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent implements OnInit {
  private readonly appUserService = inject(AppUserService);
  private readonly amplifyService = inject(AmplifyService);

  public appUser = toSignal<AppUser | null>(this.appUserService.currentUser$, {
    initialValue: null,
  });

  public audioUrl: string | null = null;
  private audio?: HTMLAudioElement;

  constructor() {
    this.loadAudio();
  }

  async ngOnInit() {
    // const { data, errors } =
    //   await this.amplifyService.client.models.Sound.listSoundsByCategoryAndStatus(
    //     {
    //       category: CategoryKey.ANIMAL,
    //       status: {
    //         eq: 'public',
    //       },
    //     },
    //   );
    // const { data, errors } =  await this.amplifyService.client.models.Sound.list();
    // const { data, errors } = await this.amplifyService.client.queries.listSoundsForMap({});
    const { data, errors } = await this.amplifyService.client.queries.listSoundsForMap({category: CategoryKey.ANIMAL});
    console.log('data', data);
    console.log('errors', errors);
  }

  async loadAudio() {
    try {
      const result = await list({
        path: 'sounds/',
      });
      console.log('result sounds list', result.items);
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
