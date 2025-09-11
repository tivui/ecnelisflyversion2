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
    // Listen to user language changes
    this.appUserService.currentUser$.subscribe((user) => {
      if (user?.language) this.currentUserLanguage = user.language;
    });

    // Initialize Leaflet map
    this.map = L.map('map', {
      center: latLng(46.5, 2.5),
      zoom: 5,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(this.map);

    // Get query params
    const userId = this.route.snapshot.queryParamMap.get('userId') ?? undefined;
    const category = this.route.snapshot.queryParamMap.get('category') as CategoryKey | undefined;

    const { data, errors } = await this.amplifyService.client.queries.listSoundsForMap({ userId, category });

    if (errors?.length) {
      console.error('Error listSoundsForMap', errors);
      return;
    }

    const sounds: Sound[] = (data ?? []).map((raw) => this.soundsService.map(raw));

    for (const s of sounds.filter((s) => s.latitude && s.longitude)) {
      const catTronquee = s.secondaryCategory ? s.secondaryCategory.slice(0, -3) : 'default';
      const url = await this.storageService.getSoundUrl(s.filename);
      const mimeType = this.soundsService.getMimeType(s.filename);
      const popupTitle = s.title;

      // Parse i18n titles once
      let title_i18n_obj: Record<string, string> | undefined;
      if (typeof s.title_i18n === 'string') {
        try { title_i18n_obj = JSON.parse(s.title_i18n); }
        catch (err) { console.error('Failed to parse title_i18n', err); }
      } else {
        title_i18n_obj = s.title_i18n;
      }

      // Create marker
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

      // Bind popup HTML
      popup.bindPopup(`
        <div class="popup-container">
          <b id="title-${s.filename}">${popupTitle}</b>
          <div id="btn-container-${s.filename}"></div>
          <br>
          <audio controls preload="metadata" style="width:100%">
            <source src="${url}" type="${mimeType}">
            Your browser does not support the audio element.
          </audio>
        </div>
      `);

      popup.on('popupopen', () => {
        const btnContainer = document.getElementById(`btn-container-${s.filename}`);
        const titleEl = document.getElementById(`title-${s.filename}`);
        if (!btnContainer || !titleEl) return;

        // Utility function to handle translation logic
        const refreshTranslateButton = () => {
          const lang = this.currentUserLanguage.toLowerCase().trim();
          const translated = title_i18n_obj && lang in title_i18n_obj ? title_i18n_obj[lang] : undefined;
          const currentTitle = titleEl.textContent?.trim();
          let btn = document.getElementById(`translate-${s.filename}`);

          if (translated && translated !== currentTitle) {
            if (!btn) {
              btn = document.createElement('button');
              btn.id = `translate-${s.filename}`;
              btn.style.marginLeft = '8px';
              btnContainer.appendChild(btn);

              btn.addEventListener('click', () => {
                // Calculate translation dynamically on click
                const clickLang = this.currentUserLanguage.toLowerCase().trim();
                const clickTranslated = title_i18n_obj && clickLang in title_i18n_obj ? title_i18n_obj[clickLang] : popupTitle;
                titleEl.textContent = clickTranslated;
                btn!.style.display = 'none';
              });
            }
            // Always update button text according to current language
            btn.textContent = this.translate.instant('common.action.translate');
            btn.style.display = 'inline-block';
          } else if (btn) {
            btn.style.display = 'none';
          }
        };

        // Initial render
        refreshTranslateButton();

        // React to dynamic language changes
        const sub = this.appUserService.currentUser$.subscribe(() => refreshTranslateButton());
        popup.on('popupclose', () => sub.unsubscribe());
      });
    }
  }
}
