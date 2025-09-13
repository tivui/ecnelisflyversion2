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
import { GraphQLResult } from 'aws-amplify/api';
import { ListSoundsForMapWithAppUser } from '../../../../core/models/amplify-queries.model';

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
    const category = this.route.snapshot.queryParamMap.get('category') as
      | CategoryKey
      | undefined;

    const result = (await this.amplifyService.client.graphql({
      query: ListSoundsForMapWithAppUser,
      variables: { category, userId },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    })) as GraphQLResult<{ listSoundsForMap: any[] }>;

    // Cast amplify result to sound model client
    const soundsData = result?.data?.listSoundsForMap ?? [];

    const sounds: Sound[] = soundsData.map((raw) =>
      this.soundsService.map(raw),
    );

    for (const s of sounds.filter((s) => s.latitude && s.longitude)) {
      const catTronquee = s.secondaryCategory
        ? s.secondaryCategory.slice(0, -3)
        : 'default';
      const url = await this.storageService.getSoundUrl(s.filename);
      const mimeType = this.soundsService.getMimeType(s.filename);
      const popupTitle = s.title;

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
          <b class="popup-title" id="title-${s.filename}">${popupTitle}</b>
          <div id="btn-container-title-${s.filename}"></div>
          <p class="popup-shortstory" id="shortStory-${s.filename}">
            ${s.shortStory ?? ''}
          </p>
          <div id="btn-container-shortStory-${s.filename}"></div>
          <div id="links-${s.filename}" class="popup-links"></div>
          <audio controls preload="metadata">
            <source src="${url}" type="${mimeType}">
            Your browser does not support the audio element.
          </audio>
        </div>
      `);

      popup.on('popupopen', () => {
        const titleEl = document.getElementById(`title-${s.filename}`);
        const shortStoryEl = document.getElementById(
          `shortStory-${s.filename}`,
        );
        const btnTitleContainer = document.getElementById(
          `btn-container-title-${s.filename}`,
        );
        const btnStoryContainer = document.getElementById(
          `btn-container-shortStory-${s.filename}`,
        );
        const linksContainer = document.getElementById(`links-${s.filename}`);

        if (
          !titleEl ||
          !shortStoryEl ||
          !btnTitleContainer ||
          !btnStoryContainer ||
          !linksContainer
        )
          return;

        // Parse JSON i18n fields (using helper)
        const title_i18n_obj = this.parseI18n(s.title_i18n);
        const story_i18n_obj = this.parseI18n(s.shortStory_i18n);

        // --- 🆕 Add links if present ---
        linksContainer.innerHTML = '';
        const links: string[] = [];
        if (s.url) {
          const text =
            s.urlTitle || this.translate.instant('common.link.moreInfo');
          links.push(
            `<a href="${s.url}" target="_blank" rel="noopener noreferrer">${text}</a>`,
          );
        }
        if (s.secondaryUrl) {
          const text =
            s.secondaryUrlTitle ||
            this.translate.instant('common.link.moreInfo');
          links.push(
            `<a href="${s.secondaryUrl}" target="_blank" rel="noopener noreferrer">${text}</a>`,
          );
        }
        if (links.length) {
          linksContainer.innerHTML = links.join(' | ');
        }

        // Create/update single translate button
        const setupSingleTranslateButton = () => {
          const lang = this.currentUserLanguage.toLowerCase().trim();
          const translatedTitle = title_i18n_obj?.[lang];
          const translatedStory = story_i18n_obj?.[lang];

          const currentTitle = titleEl.textContent?.trim();
          const currentStory = shortStoryEl.textContent?.trim();

          let btn = document.getElementById(
            `translate-all-${s.filename}`,
          ) as HTMLButtonElement | null;

          const shouldShow =
            (translatedTitle && translatedTitle !== currentTitle) ||
            (translatedStory && translatedStory !== currentStory);

          if (shouldShow) {
            if (!btn) {
              btn = document.createElement('button');
              btn.id = `translate-all-${s.filename}`;
              btn.style.marginLeft = '8px';
              btnTitleContainer.appendChild(btn);

              btn.addEventListener('click', () => {
                const currentLang = this.currentUserLanguage
                  .toLowerCase()
                  .trim();

                if (title_i18n_obj?.[currentLang]) {
                  titleEl.textContent = title_i18n_obj[currentLang];
                }
                if (story_i18n_obj?.[currentLang]) {
                  shortStoryEl.textContent = story_i18n_obj[currentLang];
                }

                btn!.style.display = 'none';
              });
            }
            btn.textContent = this.translate.instant('common.action.translate');
            btn.style.display = 'inline-block';
          } else if (btn) {
            btn.style.display = 'none';
          }
        };

        setupSingleTranslateButton();

        // Re-run when user language changes
        const sub = this.appUserService.currentUser$.subscribe(() =>
          setupSingleTranslateButton(),
        );
        popup.on('popupclose', () => sub.unsubscribe());
      });
    }
  }

  private parseI18n(field?: string | Record<string, string>) {
    if (!field) return undefined;
    if (typeof field === 'string') {
      try {
        return JSON.parse(field);
      } catch {
        console.error('Failed to parse i18n field', field);
        return undefined;
      }
    }
    return field;
  }
}
