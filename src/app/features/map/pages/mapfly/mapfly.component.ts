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

    // Initialize Leaflet map
    this.map = L.map('map', {
      center: latLng(46.5, 2.5),
      zoom: 5,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(this.map);

    // Get query params from route
    const userId = this.route.snapshot.queryParamMap.get('userId') ?? undefined;
    const category = this.route.snapshot.queryParamMap.get('category') as
      | CategoryKey
      | undefined;

    // Fetch sounds for map
    const { data, errors } =
      await this.amplifyService.client.queries.listSoundsForMap({
        userId,
        category,
      });

    if (errors?.length) {
      console.error('Error listSoundsForMap', errors);
      return;
    }

    // Map raw data to Sound model
    const sounds: Sound[] = (data ?? []).map((raw) =>
      this.soundsService.map(raw),
    );

    // Iterate over sounds with coordinates
    for (const s of sounds.filter((s) => s.latitude && s.longitude)) {
      const catTronquee = s.secondaryCategory
        ? s.secondaryCategory.slice(0, -3)
        : 'default';
      const url = await this.storageService.getSoundUrl(s.filename);
      const mimeType = this.soundsService.getMimeType(s.filename);
      const popupTitle = s.title;

      // Create Leaflet marker
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

      // Bind popup content (basic HTML, will be updated later)
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

      // Listen when popup is opened
      // Listen when the popup is opened
      popup.on('popupopen', () => {
        const btnContainer = document.getElementById(
          `btn-container-${s.filename}`,
        );
        const titleEl = document.getElementById(`title-${s.filename}`);
        if (!btnContainer || !titleEl) return;

        // Parse i18n title once
        let title_i18n_obj: Record<string, string> | undefined;
        if (typeof s.title_i18n === 'string') {
          try {
            title_i18n_obj = JSON.parse(s.title_i18n);
          } catch (err) {
            console.error('Failed to parse title_i18n', err);
          }
        } else {
          title_i18n_obj = s.title_i18n;
        }

        // Function to update the translate button based on current language
        const updateTranslateButton = (lang: string) => {
          // Get translated title for the current language
          const translatedForLang =
            title_i18n_obj && lang in title_i18n_obj
              ? title_i18n_obj[lang]
              : undefined;

          // Get the current displayed title
          const currentTitle = titleEl.textContent?.trim();

          // Get existing button if any
          let btn = document.getElementById(`translate-${s.filename}`);

          // If translation exists and differs from current title, show/update button
          if (translatedForLang && translatedForLang !== currentTitle) {
            if (!btn) {
              // Create button if it doesn't exist
              btn = document.createElement('button');
              btn.id = `translate-${s.filename}`;
              btn.style.marginLeft = '8px';
              btnContainer.appendChild(btn);

              // Add click listener
              btn.addEventListener('click', () => {
                // recalcule la traduction au moment du clic
                const currentLang = this.currentUserLanguage
                  .toLowerCase()
                  .trim();
                const currentTranslation =
                  title_i18n_obj && currentLang in title_i18n_obj
                    ? title_i18n_obj[currentLang]
                    : popupTitle;

                // update title
                titleEl.textContent = currentTranslation;

                // hide button after translation
                btn!.style.display = 'none';
              });
            }

            // Always update button text based on current TranslateService
            btn.textContent = this.translate.instant('common.action.translate');
            btn.style.display = 'inline-block';
          } else {
            // Otherwise hide button
            if (btn) btn.style.display = 'none';
          }
        };

        // Initial render based on current user language
        updateTranslateButton(this.currentUserLanguage.toLowerCase().trim());

        // Subscribe to user language changes dynamically
        const sub = this.appUserService.currentUser$.subscribe((user) => {
          const lang = user?.language?.toLowerCase().trim() ?? 'fr';
          updateTranslateButton(lang);
        });

        // Optional: clean up subscription when popup closes
        popup.on('popupclose', () => sub.unsubscribe());
      });
    }
  }
}
