import { Component, OnInit, ViewEncapsulation, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import L, { icon, latLng, marker } from 'leaflet';
import { AmplifyService } from '../../../../core/services/amplify.service';
import { CategoryKey } from '../../../../../../amplify/data/categories';
import { Sound } from '../../../../core/models/sound.model';
import { SoundsService } from '../../../../core/services/sounds.service';
import { StorageService } from '../../../../core/services/storage.service';
import { AppUserService } from '../../../../core/services/app-user.service';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-mapfly',
  standalone: true,
  templateUrl: './mapfly.component.html',
  styleUrls: ['./mapfly.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class MapflyComponent implements OnInit {
  private readonly appUserService = inject(AppUserService);
  private readonly route = inject(ActivatedRoute);
  private readonly amplifyService = inject(AmplifyService);
  private readonly soundsService = inject(SoundsService);
  private readonly storageService = inject(StorageService);
  private readonly translate = inject(TranslateService);

  private map!: L.Map;
  private currentUserLanguage = 'fr';

  async ngOnInit() {
    // Listen to current user and language changes
    this.appUserService.currentUser$.subscribe((user) => {
      if (user?.language) {
        this.currentUserLanguage = user.language;
      }
    });

    // Initialize map
    this.map = L.map('map', {
      center: latLng(46.5, 2.5),
      zoom: 5,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(this.map);

    // Get query params
    const userId = this.route.snapshot.queryParamMap.get('userId') ?? undefined;
    const category = this.route.snapshot.queryParamMap.get('category') as
      | CategoryKey
      | undefined;

    const { data, errors } =
      await this.amplifyService.client.queries.listSoundsForMap({
        userId,
        category,
      });

    if (errors?.length) {
      console.error('Erreur listSoundsForMap', errors);
      return;
    }

    const sounds: Sound[] = (data ?? []).map((raw) => this.soundsService.map(raw));

    for (const s of sounds.filter((s) => s.latitude && s.longitude)) {
      const catTronquee = s.secondaryCategory
        ? s.secondaryCategory.slice(0, -3)
        : 'default';
      const url = await this.storageService.getSoundUrl(s.filename);
      const mimeType = this.soundsService.getMimeType(s.filename);
      const popupTitle = s.title;

      const popup = marker([s.latitude!, s.longitude!], {
        icon: icon({
          ...L.Icon.Default.prototype.options,
          iconUrl: `img/markers/marker_${catTronquee}.png`,
          iconRetinaUrl: `img/markers/marker_${catTronquee}.png`,
          shadowUrl: 'img/markers/markers-shadow.png',
          iconSize: [32, 43],
          iconAnchor: [15, 40],
          shadowAnchor: [8, 10],
          popupAnchor: [0, -35],
        }),
      }).addTo(this.map);

      // Bind popup with translate button
      popup.bindPopup(`
        <div class="popup-container">
          <b id="title-${s.filename}">${popupTitle}</b>
          <button id="translate-${s.filename}" style="margin-left:8px;">${this.translate.instant(
            'common.action.translate'
          )}</button>
          <br>
          <audio controls preload="metadata" style="width:100%">
            <source src="${url}" type="${mimeType}">
            Your browser does not support the audio element.
          </audio>
        </div>
      `);

      // Add event listener for translate button
      popup.on('popupopen', () => {
        const btn = document.getElementById(`translate-${s.filename}`);
        const titleEl = document.getElementById(`title-${s.filename}`);
        if (!btn || !titleEl) return;

        // Reactive translation of the button
        this.translate.stream('common.action.translate').subscribe((translated) => {
          btn.textContent = translated;
        });

        btn.addEventListener('click', () => {
          let title_i18n_obj: Record<string, string> | undefined;
          if (typeof s.title_i18n === 'string') {
            try {
              title_i18n_obj = JSON.parse(s.title_i18n);
            } catch (err) {
              console.error('Failed to parse title_i18n', err);
              title_i18n_obj = undefined;
            }
          } else {
            title_i18n_obj = s.title_i18n;
          }

          const lang = this.currentUserLanguage.toLowerCase().trim();
          if (title_i18n_obj && lang in title_i18n_obj) {
            titleEl.textContent = title_i18n_obj[lang];
          } else {
            // Use translated alert message
            alert(this.translate.instant('common.message.translation_not_available'));
          }
        });
      });
    }
  }
}
