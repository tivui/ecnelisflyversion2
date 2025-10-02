/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Component,
  OnInit,
  ViewEncapsulation,
  inject,
  signal,
} from '@angular/core';
import L from 'leaflet';
import { ActivatedRoute, Router } from '@angular/router';
import { AmplifyService } from '../../../../core/services/amplify.service';
import { CategoryKey } from '../../../../../../amplify/data/categories';
import { Sound } from '../../../../core/models/sound.model';
import { SoundsService } from '../../../../core/services/sounds.service';
import { StorageService } from '../../../../core/services/storage.service';
import { AppUserService } from '../../../../core/services/app-user.service';
import { TranslateService } from '@ngx-translate/core';
import { GraphQLResult } from 'aws-amplify/api';
import { ListSoundsForMapWithAppUser } from '../../../../core/models/amplify-queries.model';
import 'leaflet.markercluster';
import 'leaflet-search';
import 'leaflet.featuregroup.subgroup/dist/leaflet.featuregroup.subgroup.js';
import Fuse from 'fuse.js';
import { environment } from '../../../../../environments/environment';

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
  private readonly router = inject(Router);

  private map!: L.Map;
  private currentUserLanguage = 'fr';

  public isLoading = signal(false);

  // --- Fonds de carte ---
  osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 21,
    maxNativeZoom: 18,
  });

  esri = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    {
      attribution:
        'Tiles © Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
      maxZoom: 21,
      maxNativeZoom: 19,
    },
  );

  mapbox = L.tileLayer(
    `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v9/tiles/256/{z}/{x}/{y}?access_token=${environment.mapboxToken}`,
    {
      attribution: '© Mapbox © OpenStreetMap © Esri — Satellite & Streets',
      maxZoom: 21,
      maxNativeZoom: 19,
    },
  );

  baseMaps = {
    OpenStreetMap: this.osm,
    'Esri Satellite': this.esri,
    'Mapbox Satellite+Streets': this.mapbox,
  };

  async ngOnInit() {
    // Listen to user language changes
    this.appUserService.currentUser$.subscribe((user) => {
      if (user?.language) this.currentUserLanguage = user.language;
    });

    // Initialize Leaflet map
    this.map = L.map('map', { center: L.latLng(30, 2.5), zoom: 3 });
    this.osm.addTo(this.map);

    L.control
      .layers(this.baseMaps, {}, { collapsed: false, position: 'topleft' })
      .addTo(this.map);

    // Get query params
    const userId = this.route.snapshot.queryParamMap.get('userId') ?? undefined;
    const category = this.route.snapshot.queryParamMap.get('category') as
      | CategoryKey
      | undefined;

    try {
      this.isLoading.set(true);

      const result = (await this.amplifyService.client.graphql({
        query: ListSoundsForMapWithAppUser,
        variables: { category, userId },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      })) as GraphQLResult<{ listSoundsForMap: any[] }>;

      const soundsData = result?.data?.listSoundsForMap ?? [];
      const sounds: Sound[] = soundsData.map((raw) =>
        this.soundsService.map(raw),
      );

      // --- MarkerCluster ---
      const markersCluster = L.markerClusterGroup({
        iconCreateFunction: (cluster) => {
          const count = cluster.getChildCount();
          let digitsClass = '';
          if (count < 10) digitsClass = 'digits-1';
          else if (count < 100) digitsClass = 'digits-2';
          else if (count < 1000) digitsClass = 'digits-3';
          else digitsClass = 'digits-4';
          return L.divIcon({
            html: `<div class="cluster ${digitsClass}">${count}</div>`,
            className: '',
            iconSize: L.point(40, 40),
          });
        },
      });

      // --- Subgroups pour chaque catégorie ---
      const fgAll = (L.featureGroup as any)
        .subGroup(markersCluster)
        .addTo(this.map); // "TOUT"
      const fg1 = (L.featureGroup as any)
        .subGroup(markersCluster)
        .addTo(this.map); // ANIMALFLY
      const fg2 = (L.featureGroup as any)
        .subGroup(markersCluster)
        .addTo(this.map); // NATURALFLY
      const fg3 = (L.featureGroup as any)
        .subGroup(markersCluster)
        .addTo(this.map); // AMBIANCEFLY
      const fg4 = (L.featureGroup as any)
        .subGroup(markersCluster)
        .addTo(this.map); // MUSICFLY
      const fg5 = (L.featureGroup as any)
        .subGroup(markersCluster)
        .addTo(this.map); // HUMANFLY
      const fg6 = (L.featureGroup as any)
        .subGroup(markersCluster)
        .addTo(this.map); // FOODFLY
      const fg7 = (L.featureGroup as any)
        .subGroup(markersCluster)
        .addTo(this.map); // ITEMFLY
      const fg8 = (L.featureGroup as any)
        .subGroup(markersCluster)
        .addTo(this.map); // SPORTFLY
      const fg9 = (L.featureGroup as any)
        .subGroup(markersCluster)
        .addTo(this.map); // TRANSPORTFLY

      // --- 4️⃣ Préparation markers ---
      const markerLookup: Record<string, L.Marker> = {};

      // FeatureGroup pour recherche (invisible)
      const fgSearch = L.featureGroup().addTo(this.map);

      for (const s of sounds.filter((s) => s.latitude && s.longitude)) {
        const catTronquee = s.secondaryCategory
          ? s.secondaryCategory.slice(0, -3)
          : 'default';
        const category: CategoryKey = s.category!;
        const url = await this.storageService.getSoundUrl(s.filename);
        const mimeType = this.soundsService.getMimeType(s.filename);

        // Create marker
        const m = L.marker([s.latitude!, s.longitude!], {
          icon: L.icon({
            ...L.Icon.Default.prototype.options,
            iconUrl: `img/markers/marker_${catTronquee}.png`,
            iconRetinaUrl: `img/markers/marker_${catTronquee}.png`,
            shadowUrl: 'img/markers/markers-shadow.png',
            iconSize: [32, 43],
            iconAnchor: [15, 40],
            shadowAnchor: [8, 10],
            popupAnchor: [0, -35],
          }),
        });

        m.bindPopup(`
        <div class="popup-container">
          <b class="popup-title" id="title-${s.filename}">${s.title}</b>
          <p class="popup-shortstory" id="shortStory-${s.filename}">${s.shortStory ?? ''}</p>
          <div id="btn-container-title-${s.filename}"></div>
          <div id="btn-container-shortStory-${s.filename}"></div>
          <div id="links-${s.filename}" class="popup-links"></div>
          <p id="record-info-${s.filename}" class="popup-record-info" style="font-style: italic; font-size: 0.9em; margin-top: 6px;"></p>
          <audio controls controlsList="nodownload noplaybackrate" preload="metadata">
            <source src="${url}" type="${mimeType}">
            Your browser does not support the audio element.
          </audio>
          <div id="btn-container-${s.filename}" class="popup-btn-group">
            <button class="zoom-btn material-icons" id="zoom-out-${s.filename}">remove</button>
            <button class="download-btn material-icons" id="download-${s.filename}">download</button>
            <button class="zoom-btn material-icons" id="zoom-in-${s.filename}">add</button>
          </div>
        </div>
      `);

        // Ajout au groupe correct
        fgAll.addLayer(m); // toujours dans "TOUT"
        switch (category) {
          case 'animalfly':
            fg1.addLayer(m);
            break;
          case 'naturalfly':
            fg2.addLayer(m);
            break;
          case 'ambiancefly':
            fg3.addLayer(m);
            break;
          case 'musicfly':
            fg4.addLayer(m);
            break;
          case 'humanfly':
            fg5.addLayer(m);
            break;
          case 'foodfly':
            fg6.addLayer(m);
            break;
          case 'itemfly':
            fg7.addLayer(m);
            break;
          case 'sportfly':
            fg8.addLayer(m);
            break;
          case 'transportfly':
            fg9.addLayer(m);
            break;
        }

        // --- Popup logic ---
        m.on('popupopen', () => {
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

          // --- External links ---
          if (linksContainer) {
            const links: string[] = [];

            if (s.url) {
              const text = s.urlTitle?.trim() || s.url;
              if (text) {
                links.push(
                  `<a href="${s.url}" target="_blank" rel="noopener noreferrer">${text}</a>`,
                );
              }
            }

            if (s.secondaryUrl) {
              const text = s.secondaryUrlTitle?.trim() || s.secondaryUrl;
              if (text) {
                links.push(
                  `<a href="${s.secondaryUrl}" target="_blank" rel="noopener noreferrer">${text}</a>`,
                );
              }
            }

            if (links.length) {
              linksContainer.innerHTML = links.join(' | ');
            } else {
              linksContainer.innerHTML = ''; // nothing if link empty (null)
            }
          }

          const recordInfoEl = document.getElementById(
            `record-info-${s.filename}`,
          );
          if (
            !titleEl ||
            !shortStoryEl ||
            !btnTitleContainer ||
            !btnStoryContainer ||
            !recordInfoEl ||
            !linksContainer
          )
            return;

          const title_i18n_obj = this.parseI18n(s.title_i18n);
          const story_i18n_obj = this.parseI18n(s.shortStory_i18n);

          // --- Update record info ---
          const updateRecordInfo = () => {
            if (!recordInfoEl || !s.user?.username) return;
            const flagImg = s.user.country
              ? `<img src="/img/flags/${s.user.country}.png" alt="${s.user.country}" style="width:16px; height:12px; margin-left:4px; vertical-align:middle;" />`
              : '';
            const clickableId = `record-link-${s.filename}`;
            const userLinkHtml = `<span id="${clickableId}" class="router-link-style">${s.user.username}${flagImg}</span>`;
            recordInfoEl.innerHTML = this.translate.instant(
              'mapfly.record-info',
              { city: s.city ?? '', username: userLinkHtml },
            );

            const linkEl = document.getElementById(clickableId);
            if (linkEl) {
              linkEl.addEventListener('click', (e) => {
                e.preventDefault();
                const tree = this.router.createUrlTree(['/mapfly'], {
                  queryParams: { userId: s.userId },
                });
                const newWindow = window.open(
                  window.location.origin + this.router.serializeUrl(tree),
                  '_blank',
                );
                if (newWindow) {
                  newWindow.opener = null;
                }
              });
            }
          };

          updateRecordInfo();

          // --- Translate button ---
          let btn = document.getElementById(
            `translate-all-${s.filename}`,
          ) as HTMLButtonElement | null;
          const updateTranslateButton = () => {
            const lang = this.currentUserLanguage.toLowerCase().trim();
            const translatedTitle = title_i18n_obj?.[lang];
            const translatedStory = story_i18n_obj?.[lang];
            const currentTitle = titleEl.textContent?.trim();
            const currentStory = shortStoryEl.textContent?.trim();
            const shouldShow =
              (translatedTitle && translatedTitle !== currentTitle) ||
              (translatedStory && translatedStory !== currentStory);

            if (shouldShow) {
              if (!btn) {
                btn = document.createElement('button');
                btn.id = `translate-all-${s.filename}`;
                btn.classList.add('translate-btn');
                btn.style.marginLeft = '8px';

                const iconSpan = document.createElement('span');
                iconSpan.classList.add('material-icons');
                iconSpan.textContent = 'translate';

                const textSpan = document.createElement('span');
                textSpan.classList.add('btn-label');
                textSpan.textContent = this.translate.instant(
                  'common.action.translate',
                );

                btn.appendChild(iconSpan);
                btn.appendChild(textSpan);
                btnTitleContainer.appendChild(btn);

                btn.addEventListener('click', () => {
                  const lang = this.currentUserLanguage.toLowerCase().trim();
                  if (title_i18n_obj?.[lang])
                    titleEl.textContent = title_i18n_obj[lang];
                  if (story_i18n_obj?.[lang])
                    shortStoryEl.textContent = story_i18n_obj[lang];
                  btn!.style.display = 'none';
                });
              } else {
                const textSpan = btn.querySelector('.btn-label');
                if (textSpan)
                  textSpan.textContent = this.translate.instant(
                    'common.action.translate',
                  );
              }
              btn.style.display = 'inline-flex';
            } else if (btn) {
              btn.style.display = 'none';
            }
          };

          updateTranslateButton();

          // --- Zoom & Download buttons ---
          const zoomInBtn = document.getElementById(`zoom-in-${s.filename}`);
          const zoomOutBtn = document.getElementById(`zoom-out-${s.filename}`);
          const downloadBtn = document.getElementById(`download-${s.filename}`);

          if (zoomInBtn)
            zoomInBtn.addEventListener('click', () =>
              this.map.setView([s.latitude! + 0.0015, s.longitude!], 17),
            );
          if (zoomOutBtn)
            zoomOutBtn.addEventListener('click', () =>
              this.map.setView(
                [
                  s.latitude! > 20 ? s.latitude! : s.latitude! + 30,
                  s.longitude!,
                ],
                2,
              ),
            );
          if (downloadBtn)
            downloadBtn.addEventListener('click', () => {
              const a = document.createElement('a');
              a.href = url;
              a.download = s.filename;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
            });

          // --- Subscriptions ---
          const recordSub = this.appUserService.currentUser$.subscribe(() =>
            updateRecordInfo(),
          );
          const translateSub = this.appUserService.currentUser$.subscribe(() =>
            updateTranslateButton(),
          );

          // --- Cleanup ---
          m.on('popupclose', () => {
            recordSub.unsubscribe();
            translateSub.unsubscribe();
          });
        });

        // --- Add marker to cluster ---
        markerLookup[s.title] = m; // lookup pour Fuse.js

        // Marker invisible pour la recherche
        const searchMarker = L.marker([s.latitude!, s.longitude!], {
          opacity: 0,
          title: s.title,
        });
        fgSearch.addLayer(searchMarker);
      }

      // --- Add cluster to map ---
      this.map.addLayer(markersCluster);

      // --- 5️⃣ Contrôle des layers ---
      const overlays = {
        TOUT: fgAll,
        ANIMALFLY: fg1,
        NATURALFLY: fg2,
        AMBIANCEFLY: fg3,
        MUSICFLY: fg4,
        HUMANFLY: fg5,
        FOODFLY: fg6,
        ITEMFLY: fg7,
        SPORTFLY: fg8,
        TRANSPORTFLY: fg9,
      };

      L.control
        .layers({}, overlays, { collapsed: false, position: 'bottomright' })
        .addTo(this.map);

      // Fuse.js
      const fuse = new Fuse(sounds, {
        keys: ['title', 'shortStory', 'keywords'],
        threshold: 0.4,
      });

      // Contrôle recherche
      const controlSearch = new (L.Control as any).Search({
        layer: fgSearch,
        sourceData: (text: string, callResponse: any) => {
          const results = fuse.search(text).slice(0, 5);

          // clé = texte à afficher, valeur = objet contenant loc (marker)
          const ret: Record<string, { loc: L.LatLng }> = {};
          results.forEach((r) => {
            const marker = markerLookup[r.item.title];
            if (marker) {
              ret[r.item.title] = { loc: marker.getLatLng() };
              console.log('Fuse result:', r.item.title, marker.getLatLng());
            }
          });

          callResponse(ret);
        },
        position: 'topright',
        zoom: 17,
        initial: false,
        collapsed: false,
        textPlaceholder: 'RECHERCHE PAR TITRE OU #MOTSCLÉS',

        // buildTip reçoit la key et l'objet {loc} et retourne le texte à afficher
        buildTip: (text: string) => {
          return `<span>${text}</span>`; // afficher le titre
        },
      }).on('search:locationfound', (e: any) => {
        const realMarker = markerLookup[e.text];
        if (realMarker)
          markersCluster.zoomToShowLayer(realMarker, () =>
            realMarker.openPopup(),
          );
      });

      this.map.addControl(controlSearch);
    } finally {
      this.isLoading.set(false);
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
