/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
  computed,
  inject,
  signal,
} from '@angular/core';
import L from 'leaflet';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
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
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../../core/services/auth.service';
import { GeoSearchService } from '../../../../core/services/geo-search.service';
import { ZoneService } from '../../../../core/services/zone.service';
import { Zone } from '../../../../core/models/zone.model';
import { SoundJourneyService } from '../../../../core/services/sound-journey.service';
import { LikeService } from '../../../../core/services/like.service';
import { SoundJourney, SoundJourneyStep } from '../../../../core/models/sound-journey.model';

@Component({
  selector: 'app-mapfly',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './mapfly.component.html',
  styleUrls: ['./mapfly.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class MapflyComponent implements OnInit, OnDestroy {
  private readonly appUserService = inject(AppUserService);
  private readonly route = inject(ActivatedRoute);
  private readonly amplifyService = inject(AmplifyService);
  private readonly soundsService = inject(SoundsService);
  private readonly storageService = inject(StorageService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private geoSearchService = inject(GeoSearchService);
  private readonly zoneService = inject(ZoneService);
  private readonly soundJourneyService = inject(SoundJourneyService);
  private readonly likeService = inject(LikeService);

  private map!: L.Map;
  private currentZone = signal<Zone | null>(null);
  private zonePolygonLayer: L.Polygon | null = null;
  private zoneMaskLayer: L.Polygon | null = null;
  private zoneTitleControl: L.Control | null = null;
  private currentUserLanguage = 'fr';
  private currentZoneId: string | null = null;
  private queryParamsSub?: Subscription;

  // Convertit ton currentUser$ en signal Angular
  currentUser = toSignal(this.appUserService.currentUser$, {
    initialValue: null,
  });

  isAuthenticated = computed(() => !!this.auth.user());

  public isLoading = signal(false);
  public isFeaturedMode = signal(false);
  public featuredOverlayVisible = signal(false);

  // Journey mode
  public isJourneyMode = signal(false);
  public journeyOverlayVisible = signal(false);
  public currentJourneyStep = signal(0);
  public totalJourneySteps = signal(0);
  public journeyColor = signal('#1976d2');
  public journeyName = signal('');

  // Empty state
  public isEmptyResults = signal(false);
  public emptyCategoryLabel = signal('');

  // Category filter info
  public isCategoryMode = signal(false);
  public categoryFilterLabel = signal('');
  public categoryFilterColor = signal('');
  public categoryFilterOverlay = signal('');
  public categorySoundCount = signal(0);

  private readonly categoryColors: Record<string, string> = {
    ambiancefly: '#3AE27A',
    animalfly: '#FF54F9',
    foodfly: '#E8A849',
    humanfly: '#FFC1F7',
    itemfly: '#888888',
    musicfly: '#D60101',
    naturalfly: '#39AFF7',
    sportfly: '#A24C06',
    transportfly: '#E8D000',
  };

  private journeyData: SoundJourney | null = null;
  private journeySteps: SoundJourneyStep[] = [];
  private journeySounds: any[] = [];
  private journeyMarkers: L.Marker[] = [];
  private journeyPulseCircles: L.CircleMarker[] = [];
  private journeyStepperControl: L.Control | null = null;

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
  private markersCluster!: L.MarkerClusterGroup;
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
    const zoneId = params.get('zoneId') ?? undefined;
    const soundFilename = params.get('soundFilename') ?? undefined;
    const featuredMode = params.get('featuredMode') === 'true';

    // --- Paramètres initiaux de la carte ---
    const lat = parseFloat(params.get(MAP_QUERY_KEYS.lat) ?? '30');
    const lng = parseFloat(params.get(MAP_QUERY_KEYS.lng) ?? '2.5');
    const zoom = parseInt(params.get(MAP_QUERY_KEYS.zoom) ?? '3', 10);
    const basemapKey = params.get(MAP_QUERY_KEYS.basemap) ?? 'osm';

    // Featured mode: lightweight path with single marker + cinematic animation
    if (featuredMode && soundFilename) {
      this.isFeaturedMode.set(true);
      this.initFeaturedMode(params);
      return;
    }

    // Journey mode: multi-step cinematic journey
    const journeyMode = params.get('journeyMode') === 'true';
    const journeyId = params.get('journeyId') ?? undefined;
    if (journeyMode && journeyId) {
      this.isJourneyMode.set(true);
      this.initJourneyMode(journeyId);
      return;
    }

    let isSearchActive = false;

    this.map = L.map('mapfly', {
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

    // --- Load zone if zoneId is provided ---
    this.currentZoneId = zoneId ?? null;
    if (zoneId) {
      this.loadZone(zoneId);
    }

    // --- Subscribe to query params changes for zone switching ---
    this.queryParamsSub = this.route.queryParamMap.subscribe((params) => {
      const newZoneId = params.get('zoneId') ?? null;

      // Only react if zoneId actually changed
      if (newZoneId !== this.currentZoneId) {
        const previousZoneId = this.currentZoneId;
        this.currentZoneId = newZoneId;

        if (newZoneId) {
          // New zone to load
          this.loadZone(newZoneId);
        } else if (previousZoneId) {
          // Zone was cleared (navigated to world map)
          // Need to reload the page to get all sounds instead of zone-filtered sounds
          this.forceReload();
        }
      }
    });

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

      let sounds: Sound[] = [];

      // If zoneId is provided, load only zone sounds
      if (zoneId) {
        sounds = await this.zoneService.getSoundsForZone(zoneId);
        console.log('Zone sounds loaded:', sounds.length);
      } else {
        // Load all sounds (normal mode)
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
        sounds = soundsData.map((raw) => this.soundsService.map(raw));
      }

      // --- Category filter info banner ---
      if (category) {
        const catLabel = this.translate.instant(`categories.${category}`);
        const subLabel = secondaryCategory
          ? this.translate.instant(`categories.${category}.${secondaryCategory}`)
          : '';
        this.categoryFilterLabel.set(subLabel || catLabel);
        this.categoryFilterColor.set(this.categoryColors[category] ?? '#1976d2');
        this.categoryFilterOverlay.set(`/img/logos/overlays/layer_control_${category}.png`);
        this.categorySoundCount.set(sounds.length);
        this.isCategoryMode.set(true);

        // --- Empty state detection ---
        if (sounds.length === 0) {
          this.emptyCategoryLabel.set(subLabel || catLabel);
          this.isEmptyResults.set(true);
        }
      }

      // --- MarkerCluster ---
      this.markersCluster = L.markerClusterGroup({
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
        .subGroup(this.markersCluster)
        .addTo(this.map); // "TOUT"
      this.fg1 = (L.featureGroup as any)
        .subGroup(this.markersCluster)
        .addTo(this.map); // ANIMALFLY
      this.fg2 = (L.featureGroup as any)
        .subGroup(this.markersCluster)
        .addTo(this.map); // NATURALFLY
      this.fg3 = (L.featureGroup as any)
        .subGroup(this.markersCluster)
        .addTo(this.map); // AMBIANCEFLY
      this.fg4 = (L.featureGroup as any)
        .subGroup(this.markersCluster)
        .addTo(this.map); // MUSICFLY
      this.fg5 = (L.featureGroup as any)
        .subGroup(this.markersCluster)
        .addTo(this.map); // HUMANFLY
      this.fg6 = (L.featureGroup as any)
        .subGroup(this.markersCluster)
        .addTo(this.map); // FOODFLY
      this.fg7 = (L.featureGroup as any)
        .subGroup(this.markersCluster)
        .addTo(this.map); // ITEMFLY
      this.fg8 = (L.featureGroup as any)
        .subGroup(this.markersCluster)
        .addTo(this.map); // SPORTFLY
      this.fg9 = (L.featureGroup as any)
        .subGroup(this.markersCluster)
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
          <div class="popup-header-row">
            <b class="popup-title" id="title-${s.filename}">${s.title}</b>
            <div id="like-btn-${s.id}" class="popup-like-btn" data-sound-id="${s.id}" data-likes-count="${s.likesCount ?? 0}">
              <img src="img/icon/${this.likeService.isLiked(s.id!) ? 'clapping_hands_like_2' : 'clapping_hands_no_like'}.png" class="popup-like-icon" />
              <span class="popup-like-count">${s.likesCount ?? 0}</span>
            </div>
          </div>
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

          // --- Like button ---
          const likeBtn = document.getElementById(`like-btn-${s.id}`);
          if (likeBtn && s.id) {
            const likeIcon = likeBtn.querySelector('.popup-like-icon') as HTMLImageElement;
            const likeCount = likeBtn.querySelector('.popup-like-count') as HTMLElement;

            // Update visual state based on current liked status
            const updateLikeVisual = () => {
              if (!likeIcon || !likeCount) return;
              const liked = this.likeService.isLiked(s.id!);
              likeIcon.src = `img/icon/${liked ? 'clapping_hands_like_2' : 'clapping_hands_no_like'}.png`;
              likeBtn.classList.toggle('liked', liked);
            };
            updateLikeVisual();

            likeBtn.addEventListener('click', async () => {
              if (!this.isAuthenticated()) return;
              const currentCount = parseInt(likeCount?.textContent || '0', 10);
              const result = await this.likeService.toggleLike(s.id!, currentCount);
              if (result && likeCount) {
                likeCount.textContent = String(result.newCount);
              }
              updateLikeVisual();
            });
          }

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
      this.map.addLayer(this.markersCluster);

      // --- Fit bounds when filtering by category ---
      if ((category || secondaryCategory) && sounds.length > 0) {
        const bounds = this.markersCluster.getBounds();
        if (bounds.isValid()) {
          this.map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
        }
      }

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
          this.markersCluster.zoomToShowLayer(found, () => found.openPopup());
        }

        // 🕒 après un petit délai, on réactive la logique automatique
        setTimeout(() => (isSearchActive = false), 1500);
      });

      this.map.addControl(controlSearch);

      // Utilisation du service GeoSearchService
      this.geoSearchService.addSearchControl(this.map, (lat, lng) => {
        isSearchActive = true; // bloque temporairement le baselayer automatique

        // Centrer la carte sur le résultat
        this.map.setView([lat, lng], 17);

        // Trouver le marker correspondant si tu veux l'ouvrir
        // Ici on suppose que fgAll contient tous les markers
        this.fgAll.eachLayer((marker: any) => {
          const mLatLng = marker.getLatLng();
          if (
            Math.abs(mLatLng.lat - lat) < 0.0001 &&
            Math.abs(mLatLng.lng - lng) < 0.0001
          ) {
            marker.openPopup();
          }
        });

        // Après un petit délai, réactive le changement de base layer automatique
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

  // --- Zone management ---
  private async loadZone(zoneId: string) {
    try {
      // Clear any existing zone before loading new one (don't reset view)
      if (this.zonePolygonLayer || this.zoneMaskLayer || this.zoneTitleControl) {
        this.clearZoneVisuals(false);
      }

      const zone = await this.zoneService.getZoneById(zoneId);
      if (zone) {
        this.currentZone.set(zone);
        this.displayZoneOnMap(zone);
      }
    } catch (error) {
      console.error('Error loading zone:', error);
    }
  }

  private displayZoneOnMap(zone: Zone) {
    if (!zone.polygon || !this.map) return;

    const color = zone.color ?? '#1976d2';
    const coords = zone.polygon.coordinates[0].map((c) => L.latLng(c[1], c[0]));

    // Create zone polygon border
    this.zonePolygonLayer = L.polygon(coords, {
      color,
      weight: 3,
      fillOpacity: 0,
      dashArray: '10, 5',
    }).addTo(this.map);

    // Create mask outside the zone (gray overlay)
    this.createZoneMask(coords, color);

    // Add zone title control
    this.addZoneTitleControl(zone);

    // Fit map to zone bounds
    const bounds = this.zonePolygonLayer.getBounds();
    this.map.fitBounds(bounds, { padding: [50, 50] });
  }

  private createZoneMask(zoneCoords: L.LatLng[], color: string) {
    // Create a large rectangle covering the world
    const worldBounds: L.LatLngTuple[] = [
      [-90, -180],
      [-90, 180],
      [90, 180],
      [90, -180],
      [-90, -180],
    ];

    // Create polygon with hole (the zone area)
    const outerRing = worldBounds.map((c) => L.latLng(c[0], c[1]));
    const innerRing = [...zoneCoords, zoneCoords[0]]; // Close the ring

    this.zoneMaskLayer = L.polygon([outerRing, innerRing], {
      color: 'transparent',
      fillColor: '#000',
      fillOpacity: 0.4,
      interactive: false,
    }).addTo(this.map);
  }

  private addZoneTitleControl(zone: Zone) {
    const lang = this.currentUserLanguage;
    const title = zone.name_i18n?.[lang] ?? zone.name;

    const ZoneTitleControl = L.Control.extend({
      options: { position: 'topleft' as L.ControlPosition },
      onAdd: () => {
        const container = L.DomUtil.create('div', 'zone-title-control');
        container.innerHTML = `
          <div class="zone-title-content" style="background-color: ${zone.color ?? '#1976d2'}">
            <span class="zone-title-text">${title}</span>
            <button class="zone-info-btn" title="${this.translate.instant('mapfly.zone.showInfo')}">
              <span class="material-icons">info</span>
            </button>
          </div>
        `;

        // Handle info button click
        const infoBtn = container.querySelector('.zone-info-btn') as HTMLElement;
        if (infoBtn) {
          L.DomEvent.on(infoBtn, 'click', (e: Event) => {
            L.DomEvent.stopPropagation(e);
            this.showZoneInfoModal(zone);
          });
        }

        L.DomEvent.disableClickPropagation(container);
        return container;
      },
    });

    this.zoneTitleControl = new ZoneTitleControl();
    this.zoneTitleControl.addTo(this.map);
  }

  private showZoneInfoModal(zone: Zone) {
    const lang = this.currentUserLanguage;
    const title = zone.name_i18n?.[lang] ?? zone.name;
    const description = zone.description_i18n?.[lang] ?? zone.description ?? '';
    const color = zone.color ?? '#1976d2';

    // Check if there's a translation in user's language that differs from original
    const translatedTitle = zone.name_i18n?.[lang];
    const translatedDesc = zone.description_i18n?.[lang];
    const hasTranslation =
      (translatedTitle && translatedTitle !== zone.name) ||
      (translatedDesc && translatedDesc !== zone.description);

    // Remove existing modal if any
    const existingModal = document.querySelector('.zone-info-modal-overlay');
    if (existingModal) {
      existingModal.remove();
    }

    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'zone-info-modal-overlay';
    overlay.innerHTML = `
      <div class="zone-info-modal" style="--zone-color: ${color}">
        <div class="zone-modal-header" style="background-color: ${color}">
          <h2 class="zone-modal-title" id="zone-modal-title">${title}</h2>
          <button class="zone-modal-close-btn" aria-label="Close">
            <span class="material-icons">close</span>
          </button>
        </div>
        <div class="zone-modal-content">
          ${description ? `<p class="zone-modal-description" id="zone-modal-description">${description}</p>` : `<p class="zone-modal-no-description">${this.translate.instant('mapfly.zone.noDescription')}</p>`}
          ${hasTranslation ? `
            <button class="zone-modal-translate-btn" id="zone-translate-btn">
              <span class="material-icons">translate</span>
              <span>${this.translate.instant('common.action.translate')}</span>
            </button>
          ` : ''}
        </div>
        <div class="zone-modal-footer">
          <button class="zone-modal-explore-btn" style="background-color: ${color}">
            <span class="material-icons">explore</span>
            <span>${this.translate.instant('mapfly.zone.exploreZone')}</span>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.add('closing');
        setTimeout(() => overlay.remove(), 200);
      }
    });

    // Close button
    const closeBtn = overlay.querySelector('.zone-modal-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        overlay.classList.add('closing');
        setTimeout(() => overlay.remove(), 200);
      });
    }

    // Explore button - close modal
    const exploreBtn = overlay.querySelector('.zone-modal-explore-btn');
    if (exploreBtn) {
      exploreBtn.addEventListener('click', () => {
        overlay.classList.add('closing');
        setTimeout(() => overlay.remove(), 200);
      });
    }

    // Translate button - toggles between original and user's language
    const translateBtn = overlay.querySelector('#zone-translate-btn') as HTMLButtonElement;
    if (translateBtn && hasTranslation) {
      let showingUserLang = true;
      // Content in user's language (currently displayed)
      const userLangTitle = zone.name_i18n?.[lang] ?? zone.name;
      const userLangDescription = zone.description_i18n?.[lang] ?? zone.description ?? '';
      // Original content (without translation)
      const originalTitle = zone.name;
      const originalDescription = zone.description ?? '';

      translateBtn.addEventListener('click', () => {
        const titleEl = document.getElementById('zone-modal-title');
        const descEl = document.getElementById('zone-modal-description');

        if (showingUserLang) {
          // Show original content (base language)
          if (titleEl) titleEl.textContent = originalTitle;
          if (descEl) descEl.textContent = originalDescription;
          showingUserLang = false;
        } else {
          // Show content in user's language
          if (titleEl) titleEl.textContent = userLangTitle;
          if (descEl) descEl.textContent = userLangDescription;
          showingUserLang = true;
        }
      });
    }

    // Animate in
    requestAnimationFrame(() => {
      overlay.classList.add('visible');
    });
  }

  private clearZoneVisuals(resetView = true) {
    // Remove zone layers without navigating (called when URL already changed)
    if (this.zonePolygonLayer) {
      this.map.removeLayer(this.zonePolygonLayer);
      this.zonePolygonLayer = null;
    }
    if (this.zoneMaskLayer) {
      this.map.removeLayer(this.zoneMaskLayer);
      this.zoneMaskLayer = null;
    }
    if (this.zoneTitleControl) {
      this.map.removeControl(this.zoneTitleControl);
      this.zoneTitleControl = null;
    }

    this.currentZone.set(null);

    // Reset map view to world view (only when going back to world map)
    if (resetView) {
      this.map.setView([30, 2.5], 3);
    }
  }

  // =====================================================
  // Featured Sound Mode — lightweight single-marker path
  // =====================================================
  private async initFeaturedMode(params: any) {
    const lat = parseFloat(params.get(MAP_QUERY_KEYS.lat) ?? '30');
    const lng = parseFloat(params.get(MAP_QUERY_KEYS.lng) ?? '2.5');
    const soundFilename = params.get('soundFilename') ?? '';
    const soundTitle = params.get('soundTitle') ?? '';
    const soundCity = params.get('soundCity') ?? '';
    const soundCategory = params.get('soundCategory') ?? '';
    const soundSecondaryCategory = params.get('soundSecondaryCategory') ?? '';
    const soundId = params.get('soundId') ?? '';

    // Start zoomed out for cinematic fly-in
    this.map = L.map('mapfly', {
      center: L.latLng(30, 2.5),
      zoom: 3,
      attributionControl: false,
      zoomControl: false,
    });

    // Use satellite for the cinematic effect
    this.esri.addTo(this.map);

    // Show cinematic overlay
    this.featuredOverlayVisible.set(true);

    // Load the full sound record for popup details
    let s: any = null;
    if (soundId) {
      try {
        const soundResult = await (this.amplifyService.client.models.Sound.get as any)(
          { id: soundId },
          {
            authMode: 'apiKey',
            selectionSet: [
              'id', 'userId', 'title', 'title_i18n', 'shortStory', 'shortStory_i18n',
              'filename', 'city', 'latitude', 'longitude', 'category', 'secondaryCategory',
              'url', 'urlTitle', 'secondaryUrl', 'secondaryUrlTitle',
              'user.username', 'user.country',
            ],
          },
        );
        s = soundResult.data;
      } catch { /* ignore */ }
    }

    // Load audio URL
    const url = await this.storageService.getSoundUrl(soundFilename);
    const mimeType = this.soundsService.getMimeType(soundFilename);

    // Resolve secondary category for marker icon
    const secondaryCat = soundSecondaryCategory || s?.secondaryCategory || '';
    const catTronquee = secondaryCat
      ? secondaryCat.slice(0, -3)
      : 'city';
    const targetLatLng = L.latLng(lat, lng);
    const marker = L.marker(targetLatLng, {
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

    const featuredLabel = this.translate.instant('home.hero.soundOfTheDay');
    marker.bindPopup(`
      <div class="popup-container featured-popup">
        <div class="featured-popup-header">
          <span class="material-icons featured-popup-icon">headphones</span>
          <span class="featured-popup-badge">${featuredLabel}</span>
        </div>
        <div class="popup-header-row">
          <b class="popup-title" id="title-${soundFilename}">${soundTitle}</b>
          <div id="like-btn-featured-${soundId}" class="popup-like-btn" data-sound-id="${soundId}" data-likes-count="${s?.likesCount ?? 0}">
            <img src="img/icon/${soundId && this.likeService.isLiked(soundId) ? 'clapping_hands_like_2' : 'clapping_hands_no_like'}.png" class="popup-like-icon" />
            <span class="popup-like-count">${s?.likesCount ?? 0}</span>
          </div>
        </div>
        <p class="popup-shortstory" id="shortStory-${soundFilename}">${s?.shortStory ?? ''}</p>
        <div id="btn-container-title-${soundFilename}"></div>
        <div id="btn-container-shortStory-${soundFilename}"></div>
        <div id="links-${soundFilename}" class="popup-links"></div>
        <p id="record-info-${soundFilename}" class="popup-record-info" style="font-style: italic; font-size: 0.9em; margin-top: 6px;"></p>
        <audio controls controlsList="nodownload noplaybackrate" preload="metadata">
          <source src="${url}" type="${mimeType}">
        </audio>
        <div id="btn-container-${soundFilename}" class="popup-btn-group">
          <button class="zoom-btn material-icons" id="zoom-out-${soundFilename}">remove</button>
          <button class="download-btn material-icons" id="download-${soundFilename}">download</button>
          <button class="zoom-btn material-icons" id="zoom-in-${soundFilename}">add</button>
        </div>
      </div>
    `);

    // Popup open logic (same as normal mode)
    marker.on('popupopen', () => {
      if (!s) return;

      const titleEl = document.getElementById(`title-${soundFilename}`);
      const shortStoryEl = document.getElementById(`shortStory-${soundFilename}`);
      const btnTitleContainer = document.getElementById(`btn-container-title-${soundFilename}`);
      const btnStoryContainer = document.getElementById(`btn-container-shortStory-${soundFilename}`);
      const linksContainer = document.getElementById(`links-${soundFilename}`);
      const recordInfoEl = document.getElementById(`record-info-${soundFilename}`);

      // --- External links ---
      if (linksContainer) {
        const links: string[] = [];
        if (s.url) {
          const text = s.urlTitle?.trim() || s.url;
          if (text) {
            links.push(`<a href="${s.url}" target="_blank" rel="noopener noreferrer">${text}</a>`);
          }
        }
        if (s.secondaryUrl) {
          const text = s.secondaryUrlTitle?.trim() || s.secondaryUrl;
          if (text) {
            links.push(`<a href="${s.secondaryUrl}" target="_blank" rel="noopener noreferrer">${text}</a>`);
          }
        }
        linksContainer.innerHTML = links.length ? links.join(' | ') : '';
      }

      // --- Record info (author + city) ---
      if (recordInfoEl && s.user?.username) {
        const flagImg = s.user.country
          ? `<img src="/img/flags/${s.user.country}.png" alt="${s.user.country}" style="width:16px; height:12px; margin-left:4px; vertical-align:middle;" />`
          : '';
        const clickableId = `record-link-${soundFilename}`;
        const userLinkHtml = `<span id="${clickableId}" class="router-link-style">${s.user.username}${flagImg}</span>`;
        recordInfoEl.innerHTML = this.translate.instant(
          'mapfly.record-info',
          { city: s.city ?? soundCity ?? '', username: userLinkHtml },
        );

        const linkEl = document.getElementById(clickableId);
        if (linkEl) {
          linkEl.addEventListener('click', (e) => {
            e.preventDefault();
            const tree = this.router.createUrlTree(['/mapfly'], {
              queryParams: { userId: s.userId },
            });
            window.open(window.location.origin + this.router.serializeUrl(tree), '_blank');
          });
        }
      }

      // --- Translate button ---
      if (titleEl && shortStoryEl && btnTitleContainer) {
        const title_i18n_obj = this.parseI18n(s.title_i18n);
        const story_i18n_obj = this.parseI18n(s.shortStory_i18n);
        const lang = this.currentUserLanguage.toLowerCase().trim();
        const translatedTitle = title_i18n_obj?.[lang];
        const translatedStory = story_i18n_obj?.[lang];
        const shouldShow =
          (translatedTitle && translatedTitle !== titleEl.textContent?.trim()) ||
          (translatedStory && translatedStory !== shortStoryEl.textContent?.trim());

        if (shouldShow) {
          const btn = document.createElement('button');
          btn.classList.add('translate-btn');
          btn.style.marginLeft = '8px';

          const iconSpan = document.createElement('span');
          iconSpan.classList.add('material-icons');
          iconSpan.textContent = 'translate';

          const textSpan = document.createElement('span');
          textSpan.classList.add('btn-label');
          textSpan.textContent = this.translate.instant('common.action.translate');

          btn.appendChild(iconSpan);
          btn.appendChild(textSpan);
          btnTitleContainer.appendChild(btn);

          btn.addEventListener('click', () => {
            if (title_i18n_obj?.[lang]) titleEl.textContent = title_i18n_obj[lang];
            if (story_i18n_obj?.[lang]) shortStoryEl.textContent = story_i18n_obj[lang];
            btn.style.display = 'none';
          });
        }
      }

      // --- Like button (featured popup) ---
      const featuredLikeBtn = document.getElementById(`like-btn-featured-${soundId}`);
      if (featuredLikeBtn && soundId) {
        const likeIcon = featuredLikeBtn.querySelector('.popup-like-icon') as HTMLImageElement;
        const likeCount = featuredLikeBtn.querySelector('.popup-like-count') as HTMLElement;

        const updateLikeVisual = () => {
          if (!likeIcon) return;
          const liked = this.likeService.isLiked(soundId);
          likeIcon.src = `img/icon/${liked ? 'clapping_hands_like_2' : 'clapping_hands_no_like'}.png`;
          featuredLikeBtn.classList.toggle('liked', liked);
        };
        updateLikeVisual();

        featuredLikeBtn.addEventListener('click', async () => {
          if (!this.isAuthenticated()) return;
          const currentCount = parseInt(likeCount?.textContent || '0', 10);
          const result = await this.likeService.toggleLike(soundId, currentCount);
          if (result && likeCount) {
            likeCount.textContent = String(result.newCount);
          }
          updateLikeVisual();
        });
      }

      // --- Zoom & Download buttons ---
      const zoomInBtn = document.getElementById(`zoom-in-${soundFilename}`);
      const zoomOutBtn = document.getElementById(`zoom-out-${soundFilename}`);
      const downloadBtn = document.getElementById(`download-${soundFilename}`);

      if (zoomInBtn)
        zoomInBtn.addEventListener('click', () =>
          this.map.setView([lat + 0.0015, lng], 17),
        );
      if (zoomOutBtn)
        zoomOutBtn.addEventListener('click', () =>
          this.map.setView([lat > 20 ? lat : lat + 30, lng], 2),
        );
      if (downloadBtn)
        downloadBtn.addEventListener('click', () => {
          const a = document.createElement('a');
          a.href = url;
          a.download = soundFilename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        });
    });

    marker.addTo(this.map);

    // Add pulsating circle at target location
    const pulseCircle = L.circleMarker(targetLatLng, {
      radius: 30,
      color: '#7c4dff',
      fillColor: '#7c4dff',
      fillOpacity: 0.2,
      weight: 2,
      className: 'featured-pulse-circle',
    });

    // --- Cinematic fly-in animation ---
    // Step 1: Pause for overlay title to be read
    setTimeout(() => {
      // Step 2: Fly from world → continent level
      this.map.flyTo(targetLatLng, 6, {
        duration: 2.5,
        easeLinearity: 0.2,
      });

      this.map.once('moveend', () => {
        // Step 3: Switch to satellite+streets for detail
        this.map.removeLayer(this.esri);
        this.mapbox.addTo(this.map);

        // Step 4: Brief pause, then zoom to street level
        // Offset center northward so popup has room above the marker
        setTimeout(() => {
          const offsetLat = L.latLng(lat + 0.0012, lng);
          this.map.flyTo(offsetLat, 17, {
            duration: 2,
            easeLinearity: 0.4,
          });

          this.map.once('moveend', () => {
            // Step 5: Hide overlay, add pulse effect, open popup
            this.featuredOverlayVisible.set(false);

            pulseCircle.addTo(this.map);

            setTimeout(() => {
              marker.openPopup();
            }, 400);

            // Add zoom control after animation
            L.control.zoom({ position: 'bottomright' }).addTo(this.map);
          });
        }, 500);
      });
    }, 1800);
  }

  // =====================================================
  // Journey Mode — multi-step cinematic journey
  // =====================================================
  private async initJourneyMode(journeyId: string) {
    // Start zoomed out for cinematic fly-in
    this.map = L.map('mapfly', {
      center: L.latLng(30, 2.5),
      zoom: 3,
      attributionControl: false,
      zoomControl: false,
    });

    this.esri.addTo(this.map);

    try {
      // Load journey data
      const journey = await this.soundJourneyService.getJourneyByIdPublic(journeyId);
      if (!journey) {
        console.error('Journey not found');
        this.goToFullMap();
        return;
      }
      this.journeyData = journey;
      this.journeyColor.set(journey.color ?? '#1976d2');

      // Get localized name
      const lang = this.currentUserLanguage;
      this.journeyName.set(
        journey.name_i18n?.[lang] ?? journey.name
      );

      // Load steps
      const steps = await this.soundJourneyService.listStepsByJourneyPublic(journeyId);
      if (steps.length === 0) {
        console.error('Journey has no steps');
        this.goToFullMap();
        return;
      }
      this.journeySteps = steps;
      this.totalJourneySteps.set(steps.length);

      // Load sounds for all steps in parallel
      const soundPromises = steps.map(async (step) => {
        try {
          const result = await (this.amplifyService.client.models.Sound.get as any)(
            { id: step.soundId },
            {
              authMode: 'apiKey',
              selectionSet: [
                'id', 'userId', 'title', 'title_i18n', 'shortStory', 'shortStory_i18n',
                'filename', 'city', 'latitude', 'longitude', 'category', 'secondaryCategory',
                'url', 'urlTitle', 'secondaryUrl', 'secondaryUrlTitle',
                'user.username', 'user.country',
              ],
            },
          );
          return result.data;
        } catch {
          return null;
        }
      });
      this.journeySounds = await Promise.all(soundPromises);

      // Show overlay
      this.journeyOverlayVisible.set(true);

      // Create stepper control
      this.createJourneyStepperControl();

      // Start cinematic fly to first step
      setTimeout(() => {
        this.flyToJourneyStep(0);
      }, 1800);
    } catch (error) {
      console.error('Error initializing journey mode:', error);
      this.goToFullMap();
    }
  }

  private async flyToJourneyStep(stepIndex: number) {
    const sound = this.journeySounds[stepIndex];
    if (!sound || !sound.latitude || !sound.longitude) return;

    const step = this.journeySteps[stepIndex];
    const targetLatLng = L.latLng(sound.latitude, sound.longitude);
    const color = this.journeyColor();

    this.currentJourneyStep.set(stepIndex);
    this.updateJourneyStepper();

    // Load audio
    const url = await this.storageService.getSoundUrl(sound.filename);
    const mimeType = this.soundsService.getMimeType(sound.filename);

    // Create marker for this step
    const secondaryCat = sound.secondaryCategory || '';
    const catTronquee = secondaryCat ? secondaryCat.slice(0, -3) : 'city';
    const marker = L.marker(targetLatLng, {
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

    // Build journey popup
    const lang = this.currentUserLanguage;
    const themeText_i18n = step.themeText_i18n;
    const themeText = (themeText_i18n && themeText_i18n[lang]) ? themeText_i18n[lang] : (step.themeText ?? '');
    const title = sound.title;
    const stepLabel = `${stepIndex + 1}/${this.totalJourneySteps()}`;
    const isFirst = stepIndex === 0;
    const isLast = stepIndex === this.totalJourneySteps() - 1;

    const prevBtnHtml = !isFirst ? `
      <button class="journey-nav-btn journey-nav-prev" id="journey-prev-${stepIndex}" style="border-color: ${color}; color: ${color};">
        <span class="material-icons">arrow_back</span>
        <span>${this.translate.instant('mapfly.journey.previous')}</span>
      </button>
    ` : '<div></div>';

    const nextBtnHtml = !isLast ? `
      <button class="journey-nav-btn journey-nav-next" id="journey-next-${stepIndex}" style="background-color: ${color}; border-color: ${color};">
        <span>${this.translate.instant('mapfly.journey.next')}</span>
        <span class="material-icons">arrow_forward</span>
      </button>
    ` : `
      <button class="journey-nav-btn journey-nav-next journey-nav-finish" id="journey-finish-${stepIndex}" style="background-color: ${color}; border-color: ${color};">
        <span>${this.translate.instant('mapfly.journey.finish')}</span>
        <span class="material-icons">check</span>
      </button>
    `;

    marker.bindPopup(`
      <div class="popup-container journey-popup">
        <div class="journey-popup-header" style="background-color: ${color};">
          <span class="journey-step-badge">${stepLabel}</span>
          <div class="popup-header-row">
            <b class="journey-popup-title">${title}</b>
            <div id="like-btn-journey-${sound.id}" class="popup-like-btn popup-like-btn-journey" data-sound-id="${sound.id}" data-likes-count="${sound.likesCount ?? 0}">
              <img src="${this.likeService.isLiked(sound.id!) ? 'img/icon/clapping_hands_like_2.png' : 'img/icon/clapping_hands_no_like.png'}" class="popup-like-icon" alt="like" />
              <span class="popup-like-count">${sound.likesCount ?? 0}</span>
            </div>
          </div>
        </div>
        ${themeText ? `<p class="journey-theme-text">${themeText}</p>` : ''}
        <p id="journey-record-info-${stepIndex}" class="popup-record-info" style="font-style: italic; font-size: 0.9em; margin-top: 6px;"></p>
        <audio controls controlsList="nodownload noplaybackrate" preload="metadata">
          <source src="${url}" type="${mimeType}">
        </audio>
        <div class="journey-nav-buttons">
          ${prevBtnHtml}
          ${nextBtnHtml}
        </div>
      </div>
    `, { maxWidth: 350, minWidth: 280 });

    // Popup open logic
    marker.on('popupopen', () => {
      // Record info
      const recordInfoEl = document.getElementById(`journey-record-info-${stepIndex}`);
      if (recordInfoEl && sound.user?.username) {
        const flagImg = sound.user.country
          ? `<img src="/img/flags/${sound.user.country}.png" alt="${sound.user.country}" style="width:16px; height:12px; margin-left:4px; vertical-align:middle;" />`
          : '';
        recordInfoEl.innerHTML = this.translate.instant(
          'mapfly.record-info',
          { city: sound.city ?? '', username: `${sound.user.username}${flagImg}` },
        );
      }

      // Like button
      const likeBtn = document.getElementById(`like-btn-journey-${sound.id}`);
      if (likeBtn) {
        const currentIsLiked = this.likeService.isLiked(sound.id!);
        const imgEl = likeBtn.querySelector('.popup-like-icon') as HTMLImageElement;
        if (imgEl) {
          imgEl.src = currentIsLiked ? 'img/icon/clapping_hands_like_2.png' : 'img/icon/clapping_hands_no_like.png';
        }
        likeBtn.addEventListener('click', async () => {
          if (!this.isAuthenticated()) return;
          const countEl = likeBtn.querySelector('.popup-like-count');
          const btnImg = likeBtn.querySelector('.popup-like-icon') as HTMLImageElement;
          const currentCount = parseInt(countEl?.textContent || '0', 10);
          const result = await this.likeService.toggleLike(sound.id!, currentCount);
          if (result && countEl) {
            countEl.textContent = String(result.newCount);
          }
          if (btnImg) {
            btnImg.src = this.likeService.isLiked(sound.id!) ? 'img/icon/clapping_hands_like_2.png' : 'img/icon/clapping_hands_no_like.png';
          }
        });
      }

      // Navigation buttons
      const prevBtn = document.getElementById(`journey-prev-${stepIndex}`);
      const nextBtn = document.getElementById(`journey-next-${stepIndex}`);
      const finishBtn = document.getElementById(`journey-finish-${stepIndex}`);

      if (prevBtn) {
        prevBtn.addEventListener('click', () => {
          marker.closePopup();
          this.flyToJourneyStep(stepIndex - 1);
        });
      }
      if (nextBtn) {
        nextBtn.addEventListener('click', () => {
          marker.closePopup();
          this.flyToJourneyStep(stepIndex + 1);
        });
      }
      if (finishBtn) {
        finishBtn.addEventListener('click', () => {
          marker.closePopup();
          this.goToFullMap();
        });
      }
    });

    this.journeyMarkers.push(marker);

    // Create pulse circle
    const pulseCircle = L.circleMarker(targetLatLng, {
      radius: 30,
      color,
      fillColor: color,
      fillOpacity: 0.2,
      weight: 2,
      className: 'journey-pulse-circle',
    });
    this.journeyPulseCircles.push(pulseCircle);

    const currentZoom = this.map.getZoom();

    if (stepIndex === 0 && currentZoom <= 4) {
      // First step: cinematic fly-in from world view
      this.map.flyTo(targetLatLng, 6, {
        duration: 2.5,
        easeLinearity: 0.2,
      });

      this.map.once('moveend', () => {
        // Switch to satellite+streets
        this.map.removeLayer(this.esri);
        this.mapbox.addTo(this.map);

        // Hide overlay
        this.journeyOverlayVisible.set(false);

        setTimeout(() => {
          this.map.flyTo(targetLatLng, 17, {
            duration: 2,
            easeLinearity: 0.4,
          });

          this.map.once('moveend', () => {
            marker.addTo(this.map);
            pulseCircle.addTo(this.map);
            setTimeout(() => marker.openPopup(), 400);

            // Add zoom control after animation
            L.control.zoom({ position: 'bottomright' }).addTo(this.map);
          });
        }, 500);
      });
    } else {
      // Subsequent steps: direct fly
      this.map.flyTo(targetLatLng, 15, {
        duration: 1.8,
        easeLinearity: 0.3,
      });

      this.map.once('moveend', () => {
        this.map.flyTo(targetLatLng, 17, {
          duration: 0.8,
          easeLinearity: 0.4,
        });

        this.map.once('moveend', () => {
          marker.addTo(this.map);
          pulseCircle.addTo(this.map);
          setTimeout(() => marker.openPopup(), 300);
        });
      });
    }
  }

  private createJourneyStepperControl() {
    const color = this.journeyColor();
    const name = this.journeyName();
    const total = this.totalJourneySteps();

    const JourneyStepperControl = L.Control.extend({
      options: { position: 'topleft' as L.ControlPosition },
      onAdd: () => {
        const container = L.DomUtil.create('div', 'journey-stepper-control');

        const dotsHtml = Array.from({ length: total }, (_, i) => {
          const dotClass = i === 0 ? 'active' : '';
          const lineHtml = i < total - 1 ? `<div class="journey-step-line" data-index="${i}"></div>` : '';
          return `
            <div class="journey-step-dot ${dotClass}" data-index="${i}" style="--journey-color: ${color};">
              <span>${i + 1}</span>
            </div>
            ${lineHtml}
          `;
        }).join('');

        container.innerHTML = `
          <div class="journey-stepper-content" style="--journey-color: ${color};">
            <div class="journey-stepper-header">
              <span class="material-icons journey-stepper-icon">route</span>
              <span class="journey-stepper-title">${name}</span>
              <button class="journey-stepper-close" title="Close">
                <span class="material-icons">close</span>
              </button>
            </div>
            <div class="journey-stepper-dots">
              ${dotsHtml}
            </div>
          </div>
        `;

        // Handle dot clicks
        const dots = container.querySelectorAll('.journey-step-dot');
        dots.forEach((dot: any) => {
          L.DomEvent.on(dot, 'click', (e: Event) => {
            L.DomEvent.stopPropagation(e);
            const index = parseInt(dot.getAttribute('data-index')!, 10);
            if (index !== this.currentJourneyStep()) {
              this.flyToJourneyStep(index);
            }
          });
        });

        // Handle close button
        const closeBtn = container.querySelector('.journey-stepper-close') as HTMLElement;
        if (closeBtn) {
          L.DomEvent.on(closeBtn, 'click', (e: Event) => {
            L.DomEvent.stopPropagation(e);
            this.goToFullMap();
          });
        }

        L.DomEvent.disableClickPropagation(container);

        // Store reference for updates
        (container as any).__updateStepper = (currentStep: number) => {
          const dots = container.querySelectorAll('.journey-step-dot');
          const lines = container.querySelectorAll('.journey-step-line');

          dots.forEach((dot: any, i: number) => {
            dot.classList.toggle('active', i === currentStep);
            dot.classList.toggle('passed', i < currentStep);
          });

          lines.forEach((line: any, i: number) => {
            line.classList.toggle('passed', i < currentStep);
          });
        };

        return container;
      },
    });

    this.journeyStepperControl = new JourneyStepperControl();
    this.journeyStepperControl.addTo(this.map);
  }

  private updateJourneyStepper() {
    if (!this.journeyStepperControl) return;
    const container = (this.journeyStepperControl as any)._container;
    if (container?.__updateStepper) {
      container.__updateStepper(this.currentJourneyStep());
    }
  }

  goToFullMap() {
    window.location.href = '/mapfly';
  }

  goBack() {
    this.router.navigate(['/']);
  }

  private forceReload() {
    // Force a full page reload to reinitialize the component with all sounds
    // This is the simplest and most reliable way to switch from zone view to world view
    window.location.href = '/mapfly';
  }

  private clearZone() {
    // Clear visuals
    this.clearZoneVisuals();

    // Remove zoneId from URL
    this.currentZoneId = null;
    this.router.navigate([], {
      queryParamsHandling: 'merge',
      queryParams: { zoneId: null },
      replaceUrl: true,
    });
  }

  ngOnDestroy() {
    this.queryParamsSub?.unsubscribe();
    this.map?.remove();
  }
}
