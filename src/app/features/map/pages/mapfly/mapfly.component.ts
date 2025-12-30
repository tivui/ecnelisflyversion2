/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Component,
  OnInit,
  ViewEncapsulation,
  computed,
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
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { GraphQLResult } from 'aws-amplify/api';
import { ListSoundsForMapWithAppUser } from '../../../../core/models/amplify-queries.model';
import 'leaflet.markercluster';
import 'leaflet-search';
import 'leaflet.featuregroup.subgroup/dist/leaflet.featuregroup.subgroup.js';
import Fuse from 'fuse.js';
import { environment } from '../../../../../environments/environment';
import '../../../../core/scripts/leaflet/grouped-layers';
import {
  ALL_GROUP_KEYS,
  MAP_QUERY_KEYS,
} from '../../../../core/models/map.model';
import { GeoSearchControl, OpenStreetMapProvider } from 'leaflet-geosearch';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-mapfly',
  standalone: true,
  imports: [TranslatePipe],
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
  private readonly auth = inject(AuthService);

  private map!: L.Map;
  private currentUserLanguage = 'fr';

  // Convertit ton currentUser$ en signal Angular
  currentUser = toSignal(this.appUserService.currentUser$, {
    initialValue: null,
  });

  isAuthenticated = computed(() => !!this.auth.user());

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

  private baseLayersControl!: L.Control.Layers;
  private getTranslatedBaseMaps(): Record<string, L.TileLayer> {
    return {
      [this.translate.instant('mapfly.baselayers.esri')]: this.esri,
      [this.translate.instant('mapfly.baselayers.osm')]: this.osm,
      [this.translate.instant('mapfly.baselayers.mapbox')]: this.mapbox,
    };
  }

  private groupedLayersControl: any;
  private fgAll!: L.FeatureGroup;
  private fg1!: L.FeatureGroup;
  private fg2!: L.FeatureGroup;
  private fg3!: L.FeatureGroup;
  private fg4!: L.FeatureGroup;
  private fg5!: L.FeatureGroup;
  private fg6!: L.FeatureGroup;
  private fg7!: L.FeatureGroup;
  private fg8!: L.FeatureGroup;
  private fg9!: L.FeatureGroup;

  async ngOnInit() {
    // Listen to user language changes
    this.appUserService.currentUser$.subscribe((user) => {
      if (user?.language) this.currentUserLanguage = user.language;
    });

    console.log('signal isAuthenticated', this.isAuthenticated());

    // Get query params (user + map)
    const params = this.route.snapshot.queryParamMap;

    const userId = params.get(MAP_QUERY_KEYS.userId) ?? undefined;
    const category = params.get(MAP_QUERY_KEYS.category) as
      | CategoryKey
      | undefined;
    const secondaryCategory =
      params.get(MAP_QUERY_KEYS.secondaryCategory) ?? undefined;

    // --- Paramètres initiaux de la carte ---
    const lat = parseFloat(params.get(MAP_QUERY_KEYS.lat) ?? '30');
    const lng = parseFloat(params.get(MAP_QUERY_KEYS.lng) ?? '2.5');
    const zoom = parseInt(params.get(MAP_QUERY_KEYS.zoom) ?? '3', 10);
    const basemapKey = params.get(MAP_QUERY_KEYS.basemap) ?? 'osm';

    let isSearchActive = false;

    this.map = L.map('map', {
      center: L.latLng(lat, lng),
      zoom,
      attributionControl: false,
    });

    // --- Base layers object ---
    const baseLayers = { esri: this.esri, osm: this.osm, mapbox: this.mapbox };

    // --- Choix du fond initial avec logique dynamique ---
    let userHasSelectedBase = false; // ⚑ drapeau
    let activeBaseLayer: L.TileLayer;

    // Si un basemap est passé dans les query params → on le respecte
    if (params.has(MAP_QUERY_KEYS.basemap)) {
      activeBaseLayer =
        baseLayers[basemapKey as keyof typeof baseLayers] ?? this.osm;
      userHasSelectedBase = true;
    } else {
      // Pas de param → comportement automatique selon le zoom initial
      if (zoom <= 4) {
        activeBaseLayer = this.esri; // satellite lointain
      } else {
        activeBaseLayer = this.mapbox; // satellite + rues proche
      }
    }

    // Ajoute le fond de carte initial
    activeBaseLayer.addTo(this.map);

    // --- ✅ Attendre la traduction avant d'initialiser le contrôle ---
    this.translate
      .get([
        'mapfly.baselayers.esri',
        'mapfly.baselayers.osm',
        'mapfly.baselayers.mapbox',
      ])
      .subscribe((t) => {
        const baseMaps = {
          [t['mapfly.baselayers.esri']]: this.esri,
          [t['mapfly.baselayers.osm']]: this.osm,
          [t['mapfly.baselayers.mapbox']]: this.mapbox,
        };

        this.baseLayersControl = L.control
          .layers(baseMaps, {}, { collapsed: false, position: 'bottomleft' })
          .addTo(this.map);
      });

    // Met à jour dynamiquement les libellés si la langue change
    this.translate.onLangChange.subscribe(() => {
      this.groupedLayersControl.remove();

      const newCategoryOverlays = this.buildCategoryOverlays();
      this.groupedLayersControl = (L as any).control.groupedLayers(
        {},
        newCategoryOverlays,
        {
          collapsed: true,
          position: 'bottomright',
          autoZIndex: false,
          groupCheckboxes: true,
          exclusiveGroups: [],
          groupKey: 'all',
        },
      );
      this.groupedLayersControl.addTo(this.map);

      // Supprime le contrôle existant
      this.baseLayersControl.remove();

      // Crée un nouveau avec les traductions mises à jour
      this.baseLayersControl = L.control
        .layers(
          this.getTranslatedBaseMaps(),
          {},
          { collapsed: false, position: 'bottomleft' },
        )
        .addTo(this.map);

      // Mise à jour label controleur overlays

      if (!this.groupedLayersControl) return;

      const newLabel = this.translate.instant('mapfly.categories.all');
      const layers = this.groupedLayersControl._layers;
      layers.forEach((l: any) => {
        if (l.overlay && ALL_GROUP_KEYS.includes(l.group.key)) {
          l.name = newLabel;
          const groupContainer =
            this.groupedLayersControl._domGroups[l.group.id];
          if (groupContainer) {
            const span = groupContainer.querySelector(
              '.leaflet-control-layers-group-name',
            );
            if (span) span.textContent = newLabel;
          }
        }
      });
    });

    // 🧭 Met à jour les query params quand la carte bouge
    this.map.on('moveend zoomend', () => {
      const center = this.map.getCenter();
      const zoom = this.map.getZoom();

      this.router.navigate([], {
        queryParamsHandling: 'merge',
        queryParams: {
          [MAP_QUERY_KEYS.lat]: center.lat.toFixed(4),
          [MAP_QUERY_KEYS.lng]: center.lng.toFixed(4),
          [MAP_QUERY_KEYS.zoom]: zoom,
        },
        replaceUrl: true,
      });
    });

    let isAutoBaseSwitch = false;

    // 🎨 Écoute changement de fond de carte
    this.map.on('baselayerchange', (e: any) => {
      if (isAutoBaseSwitch) {
        // ✅ ignore les changements automatiques dus au zoom
        isAutoBaseSwitch = false;
        return;
      }

      userHasSelectedBase = true; // ⚑ l’utilisateur a choisi manuellement

      let newBasemapKey = 'osm'; // fallback
      if (e.layer === this.esri) newBasemapKey = 'esri';
      else if (e.layer === this.mapbox) newBasemapKey = 'mapbox';
      else if (e.layer === this.osm) newBasemapKey = 'osm';

      this.router.navigate([], {
        queryParamsHandling: 'merge',
        queryParams: { [MAP_QUERY_KEYS.basemap]: newBasemapKey },
        replaceUrl: true,
      });
    });

    // 🔭 Changement automatique du fond si l’utilisateur n’a pas choisi manuellement
    this.map.on('zoomend', () => {
      if (userHasSelectedBase || isSearchActive) return;

      const currentZoom = this.map.getZoom();
      const thresholdZoom = 6;

      // Recalcule à chaque fois quelle couche est réellement visible
      const hasEsri = this.map.hasLayer(this.esri);
      const hasMapbox = this.map.hasLayer(this.mapbox);

      // Si on est trop zoomé → Mapbox
      if (currentZoom > thresholdZoom && !hasMapbox) {
        if (hasEsri) this.map.removeLayer(this.esri);
        isAutoBaseSwitch = true;
        this.map.addLayer(this.mapbox);
        activeBaseLayer = this.mapbox;
      }

      // Si on dézoome → Esri
      else if (currentZoom <= thresholdZoom && !hasEsri) {
        if (hasMapbox) this.map.removeLayer(this.mapbox);
        isAutoBaseSwitch = true;
        this.map.addLayer(this.esri);
        activeBaseLayer = this.esri;
      }
    });

    try {
      this.isLoading.set(true);

      const result = (await this.amplifyService.client.graphql({
        query: ListSoundsForMapWithAppUser,
        variables: {
          ...(category ? { category } : {}),
          ...(secondaryCategory ? { secondaryCategory } : {}),
          ...(userId ? { userId } : {}),
        },

        authMode: this.isAuthenticated() ? 'userPool' : 'apiKey',

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      })) as GraphQLResult<{ listSoundsForMap: any[] }>;
      console.log('result', result);
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
      this.fgAll = (L.featureGroup as any)
        .subGroup(markersCluster)
        .addTo(this.map); // "TOUT"
      this.fg1 = (L.featureGroup as any)
        .subGroup(markersCluster)
        .addTo(this.map); // ANIMALFLY
      this.fg2 = (L.featureGroup as any)
        .subGroup(markersCluster)
        .addTo(this.map); // NATURALFLY
      this.fg3 = (L.featureGroup as any)
        .subGroup(markersCluster)
        .addTo(this.map); // AMBIANCEFLY
      this.fg4 = (L.featureGroup as any)
        .subGroup(markersCluster)
        .addTo(this.map); // MUSICFLY
      this.fg5 = (L.featureGroup as any)
        .subGroup(markersCluster)
        .addTo(this.map); // HUMANFLY
      this.fg6 = (L.featureGroup as any)
        .subGroup(markersCluster)
        .addTo(this.map); // FOODFLY
      this.fg7 = (L.featureGroup as any)
        .subGroup(markersCluster)
        .addTo(this.map); // ITEMFLY
      this.fg8 = (L.featureGroup as any)
        .subGroup(markersCluster)
        .addTo(this.map); // SPORTFLY
      this.fg9 = (L.featureGroup as any)
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
        this.fgAll.addLayer(m); // toujours dans "TOUT"
        switch (category) {
          case 'animalfly':
            this.fg1.addLayer(m);
            break;
          case 'naturalfly':
            this.fg2.addLayer(m);
            break;
          case 'ambiancefly':
            this.fg3.addLayer(m);
            break;
          case 'musicfly':
            this.fg4.addLayer(m);
            break;
          case 'humanfly':
            this.fg5.addLayer(m);
            break;
          case 'foodfly':
            this.fg6.addLayer(m);
            break;
          case 'itemfly':
            this.fg7.addLayer(m);
            break;
          case 'sportfly':
            this.fg8.addLayer(m);
            break;
          case 'transportfly':
            this.fg9.addLayer(m);
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
        markerLookup[s.filename] = m; // lookup pour Fuse.js

        // Marker invisible pour la recherche
        const searchMarker = L.marker([s.latitude!, s.longitude!], {
          opacity: 0,
          title:
            `${s.title} ${s.hashtags?.replace(/[#,@]/g, ' ').replace(/,/g, ' ').trim() || ''}`.trim(),
        });
        fgSearch.addLayer(searchMarker);
      }

      // --- Add cluster to map ---
      this.map.addLayer(markersCluster);

      const categoryOverlays = this.buildCategoryOverlays();

      // Ajout d'un paramètre `groupKey` pour la logique interne
      this.groupedLayersControl = (L as any).control.groupedLayers(
        {},
        categoryOverlays,
        {
          collapsed: true,
          position: 'bottomright',
          autoZIndex: false,
          groupCheckboxes: true,
          exclusiveGroups: [],
          // clé logique du groupe parent
          groupKey: 'all',
        },
      );
      this.groupedLayersControl.addTo(this.map);

      // --- 🔍 Préparation des données pour Fuse ---
      const soundsForSearch = sounds.map((s) => {
        const title = (s.title || '').trim();
        const hashtags = (s.hashtags || '')
          .replace(/[#,@]/g, ' ')
          .replace(/,/g, ' ')
          .trim();
        return {
          filename: s.filename, // identifiant interne
          // Texte complet combiné pour indexation et affichage
          combinedText: `${title} ${hashtags}`.trim(),
        };
      });

      // --- Fuse.js ---
      const fuse = new Fuse(soundsForSearch, {
        keys: ['combinedText'],
        threshold: 0.3,
        ignoreLocation: true,
        distance: 1000,
      });

      // --- Contrôle de recherche ---
      const controlSearch = new (L.Control as any).Search({
        layer: fgSearch,
        sourceData: (text: string, callResponse: any) => {
          const results = fuse.search(text).slice(0, 10);

          // Clé affichée = titre + hashtags
          const ret: Record<string, { loc: L.LatLng; filename: string }> = {};
          results.forEach((r) => {
            const marker = markerLookup[r.item.filename];
            if (marker) {
              const key = r.item.combinedText; // affichage + clé unique
              ret[key] = {
                loc: marker.getLatLng(),
                filename: r.item.filename,
              };
            }
          });
          callResponse(ret);
        },
        position: 'topright',
        zoom: 17,
        initial: false,
        collapsed: false,
        textPlaceholder: 'Titre ou #Hashtags...',
        buildTip: (text: string) => `<span>${text}</span>`,
      }).on('search:locationfound', (e: any) => {
        isSearchActive = true; // 🚫 bloque le changement de base layer automatique
        // retrouver le bon marker à partir du texte combiné
        const found = markerLookup[e.layer?.options.filename || e.text];
        if (found) {
          markersCluster.zoomToShowLayer(found, () => found.openPopup());
        }

        // 🕒 après un petit délai, on réactive la logique automatique
        setTimeout(() => (isSearchActive = false), 1500);
      });

      this.map.addControl(controlSearch);

      const provider = new OpenStreetMapProvider();

      const searchControl = GeoSearchControl({
        provider: provider,
      });

      this.map.addControl(searchControl);

      this.map.on('geosearch/showlocation', () => {
        isSearchActive = true;
        setTimeout(() => (isSearchActive = false), 1500);
      });
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

  private buildCategoryOverlays(): Record<
    string,
    Record<string, L.FeatureGroup>
  > {
    const allGroupName = this.translate.instant('mapfly.categories.all');

    const categories: { key: CategoryKey; fg: L.FeatureGroup }[] = [
      { key: CategoryKey.ANIMAL, fg: this.fg1 },
      { key: CategoryKey.NATURAL, fg: this.fg2 },
      { key: CategoryKey.AMBIANCE, fg: this.fg3 },
      { key: CategoryKey.MUSIC, fg: this.fg4 },
      { key: CategoryKey.HUMAN, fg: this.fg5 },
      { key: CategoryKey.FOOD, fg: this.fg6 },
      { key: CategoryKey.ITEM, fg: this.fg7 },
      { key: CategoryKey.SPORT, fg: this.fg8 },
      { key: CategoryKey.TRANSPORT, fg: this.fg9 },
    ];

    const overlayEntries = categories.map(({ key, fg }) => {
      const translated = this.translate.instant(`categories.${key}`);
      const label = `
      <img src="img/logos/overlays/layer_control_${key}.png" width="30" />
      <span>${translated}</span>
    `;
      return [label, fg];
    });

    return { [allGroupName]: Object.fromEntries(overlayEntries) };
  }
}
