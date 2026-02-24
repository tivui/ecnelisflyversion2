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
import { Subscription, firstValueFrom } from 'rxjs';
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
import { OpenStreetMapProvider } from 'leaflet-geosearch';
import { ZoneService } from '../../../../core/services/zone.service';
import { Zone } from '../../../../core/models/zone.model';
import { SoundJourneyService } from '../../../../core/services/sound-journey.service';
import { LikeService } from '../../../../core/services/like.service';
import { AmbientAudioService } from '../../../../core/services/ambient-audio.service';
import { SoundJourney, SoundJourneyStep } from '../../../../core/models/sound-journey.model';
import { EphemeralJourneyService } from '../../../../core/services/ephemeral-journey.service';
import { MatBottomSheet, MatBottomSheetModule, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { TimeFilterSheetComponent, TimeFilterSheetData, CategoryToggle } from './time-filter-sheet.component';
import { SoundPopupSheetComponent, SoundPopupSheetData } from './sound-popup-sheet.component';
import { createWaveSurferPlayer, WaveSurferPlayerInstance } from '../../../../core/services/wavesurfer-player.service';
import 'leaflet-minimap';

@Component({
  selector: 'app-mapfly',
  standalone: true,
  imports: [TranslatePipe, MatBottomSheetModule],
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
  private readonly zoneService = inject(ZoneService);
  private readonly soundJourneyService = inject(SoundJourneyService);
  private readonly likeService = inject(LikeService);
  private readonly ambientAudio = inject(AmbientAudioService);
  private readonly ephemeralJourneyService = inject(EphemeralJourneyService);
  private readonly bottomSheet = inject(MatBottomSheet);

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

  // Zone (Terroir) cinematic entry
  public zoneOverlayVisible = signal(false);
  public zoneOverlayFading = signal(false);
  public zoneOverlayTitle = signal('');
  public zoneOverlayDescription = signal('');
  public zoneOverlayCoverUrl = signal<string | null>(null);
  public zoneOverlayGradient = signal('linear-gradient(135deg, #5c3d0a, #b07c10)');
  public zoneOverlayIcon = signal('terrain');
  public hasAmbientSound = signal(false);
  public isAmbientMuted = signal(false);
  public ambientSoundLabel = signal('');
  public ambientLabelExpanded = signal(false);
  private zonePolygonGlowLayer: L.Polygon | null = null;

  // Timeline mode
  public timelineEnabled = signal(false);
  public timelineVisible = signal(false);
  public timelineMin = signal(0);       // earliest timestamp
  public timelineMax = signal(0);       // latest timestamp
  public timelineCurrent = signal(0);   // current cursor timestamp
  public timelinePlaying = signal(false);
  public timelineLabel = signal('');
  public timelineMarkerMap: { date: Date; marker: L.Marker }[] = [];
  private timelineInterval: ReturnType<typeof setInterval> | null = null;

  // Zone stats
  public zoneSoundCount = signal(0);
  public zoneSeasonFilter = signal<string | null>(null); // 'spring' | 'summer' | 'autumn' | 'winter' | null
  private zoneSounds: Sound[] = [];

  // Empty state
  public isEmptyResults = signal(false);
  public emptyCategoryLabel = signal('');

  // Category filter info
  public isCategoryMode = signal(false);
  public isZoneMode = signal(false);
  public categoryFilterLabel = signal('');
  public categoryFilterColor = signal('');
  public categoryFilterOverlay = signal('');
  public categorySoundCount = signal(0);

  // User filter info
  public isUserMode = signal(false);
  public userFilterLabel = signal('');
  public userSoundCount = signal(0);

  // Time-based filter (normal mode only)
  public timeFilter = signal<'all' | 'latest10' | 'week' | 'month'>('all');
  public timeFilterCounts = signal<{ all: number; latest10: number; week: number; month: number }>({
    all: 0, latest10: 0, week: 0, month: 0,
  });
  public hasWeekSounds = signal(false);
  public hasMonthSounds = signal(false);
  public normalModeMarkerMap: { createdAt: Date; marker: L.Marker }[] = [];
  // Category visibility state (synced with Leaflet layers)
  public categoryVisibility = signal<Record<string, boolean>>({
    [CategoryKey.ANIMAL]: true,
    [CategoryKey.NATURAL]: true,
    [CategoryKey.AMBIANCE]: true,
    [CategoryKey.MUSIC]: true,
    [CategoryKey.HUMAN]: true,
    [CategoryKey.FOOD]: true,
    [CategoryKey.ITEM]: true,
    [CategoryKey.SPORT]: true,
    [CategoryKey.TRANSPORT]: true,
  });
  // Computed label for mobile trigger button
  public activeTimeFilterLabel = computed(() => {
    const key = `mapfly.timeFilter.${this.timeFilter()}`;
    return this.translate.instant(key);
  });
  // Badge: count of hidden categories
  public hiddenCategoryCount = computed(() => {
    const vis = this.categoryVisibility();
    return Object.values(vis).filter(v => !v).length;
  });
  // Desktop category panel
  public desktopPanelOpen = signal(false);
  public allCategoriesEnabled = computed(() => {
    const vis = this.categoryVisibility();
    return Object.values(vis).every(v => v);
  });
  public desktopCategories = computed(() => {
    const vis = this.categoryVisibility();
    return [
      { key: CategoryKey.ANIMAL, labelKey: `categories.${CategoryKey.ANIMAL}`, iconUrl: `img/logos/overlays/layer_control_${CategoryKey.ANIMAL}.png`, enabled: vis[CategoryKey.ANIMAL] },
      { key: CategoryKey.NATURAL, labelKey: `categories.${CategoryKey.NATURAL}`, iconUrl: `img/logos/overlays/layer_control_${CategoryKey.NATURAL}.png`, enabled: vis[CategoryKey.NATURAL] },
      { key: CategoryKey.AMBIANCE, labelKey: `categories.${CategoryKey.AMBIANCE}`, iconUrl: `img/logos/overlays/layer_control_${CategoryKey.AMBIANCE}.png`, enabled: vis[CategoryKey.AMBIANCE] },
      { key: CategoryKey.MUSIC, labelKey: `categories.${CategoryKey.MUSIC}`, iconUrl: `img/logos/overlays/layer_control_${CategoryKey.MUSIC}.png`, enabled: vis[CategoryKey.MUSIC] },
      { key: CategoryKey.HUMAN, labelKey: `categories.${CategoryKey.HUMAN}`, iconUrl: `img/logos/overlays/layer_control_${CategoryKey.HUMAN}.png`, enabled: vis[CategoryKey.HUMAN] },
      { key: CategoryKey.FOOD, labelKey: `categories.${CategoryKey.FOOD}`, iconUrl: `img/logos/overlays/layer_control_${CategoryKey.FOOD}.png`, enabled: vis[CategoryKey.FOOD] },
      { key: CategoryKey.ITEM, labelKey: `categories.${CategoryKey.ITEM}`, iconUrl: `img/logos/overlays/layer_control_${CategoryKey.ITEM}.png`, enabled: vis[CategoryKey.ITEM] },
      { key: CategoryKey.SPORT, labelKey: `categories.${CategoryKey.SPORT}`, iconUrl: `img/logos/overlays/layer_control_${CategoryKey.SPORT}.png`, enabled: vis[CategoryKey.SPORT] },
      { key: CategoryKey.TRANSPORT, labelKey: `categories.${CategoryKey.TRANSPORT}`, iconUrl: `img/logos/overlays/layer_control_${CategoryKey.TRANSPORT}.png`, enabled: vis[CategoryKey.TRANSPORT] },
    ];
  });

  // Unified search bar
  public searchMode = signal<'sounds' | 'places'>('sounds');
  public searchQuery = signal('');
  public searchResults = signal<{ label: string; filename?: string; lat?: number; lng?: number }[]>([]);
  public searchFocused = signal(false);
  private fuseInstance: Fuse<{ filename: string; combinedText: string }> | null = null;
  private markerLookup: Record<string, L.Marker> = {};
  private geoProvider = new (OpenStreetMapProvider as any)();
  private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private isSearchActive = false;

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

  // Mobile popup sheet
  private readonly isMobilePortrait = window.matchMedia('(max-width: 700px) and (orientation: portrait)').matches;
  private activeSheetRef: MatBottomSheetRef<SoundPopupSheetComponent> | null = null;
  private activeSelectionCircle: L.CircleMarker | null = null;

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
  private minimapControl: L.Control.MiniMap | null = null;
  private minimapTileLayer: L.TileLayer | null = null;

  private createMinimapTileLayer(): L.TileLayer {
    if (this.map.hasLayer(this.mapbox)) {
      return L.tileLayer(
        `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v9/tiles/256/{z}/{x}/{y}?access_token=${environment.mapboxToken}`,
        { maxZoom: 21, maxNativeZoom: 19 },
      );
    }
    if (this.map.hasLayer(this.esri)) {
      return L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 21, maxNativeZoom: 19 },
      );
    }
    return L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 21,
      maxNativeZoom: 18,
    });
  }

  private initMinimap(): void {
    if (this.minimapControl || !this.map) return;

    this.minimapTileLayer = this.createMinimapTileLayer();

    this.minimapControl = new L.Control.MiniMap(this.minimapTileLayer, {
      position: 'bottomleft',
      toggleDisplay: true,
      minimized: true,
      width: this.isMobilePortrait ? 150 : 150,
      height: this.isMobilePortrait ? 120 : 120,
      collapsedWidth: this.isMobilePortrait ? 30 : 36,
      collapsedHeight: this.isMobilePortrait ? 30 : 36,
      zoomLevelFixed: 2,
      zoomAnimation: true,
      autoToggleDisplay: false,
      aimingRectOptions: {
        color: '#ef4444',
        weight: 2,
        fillColor: '#ef4444',
        fillOpacity: 0.15,
        dashArray: '4 4',
        interactive: false,
      },
      shadowRectOptions: {
        color: '#1976d2',
        weight: 1,
        fillOpacity: 0.05,
        interactive: false,
      },
      strings: { hideText: '', showText: '' },
      mapOptions: {
        attributionControl: false,
        zoomControl: false,
      },
    });

    this.minimapControl.addTo(this.map);

    // Native tooltip + accessibility, remove href to avoid localhost URL in status bar
    const toggleBtn = document.querySelector('.leaflet-control-minimap a[class*="minimap-toggle"]');
    if (toggleBtn) {
      const label = this.translate.instant('mapfly.minimap.toggle');
      toggleBtn.setAttribute('title', label);
      toggleBtn.setAttribute('aria-label', label);
      toggleBtn.removeAttribute('href');
    }

    // Hide minimap at low zoom levels (world view) — it adds no value
    const minimapContainer = (this.minimapControl as any).getContainer() as HTMLElement;
    const MINIMAP_MIN_ZOOM = 5;
    const updateMinimapVisibility = () => {
      if (!minimapContainer) return;
      const zoom = this.map.getZoom();
      minimapContainer.style.display = zoom >= MINIMAP_MIN_ZOOM ? '' : 'none';
    };
    updateMinimapVisibility();
    this.map.on('zoomend', updateMinimapVisibility);

    // Center dot indicator on the minimap — always visible even when aimingRect is tiny
    const miniMap = (this.minimapControl as any)._miniMap as L.Map;
    if (miniMap) {
      const centerDot = L.circleMarker(this.map.getCenter(), {
        radius: 5,
        color: '#ef4444',
        fillColor: '#ef4444',
        fillOpacity: 0.9,
        weight: 2,
        interactive: false,
      }).addTo(miniMap);

      this.map.on('move', () => {
        centerDot.setLatLng(this.map.getCenter());
      });
    }
  }

  private syncMinimapLayer(): void {
    if (!this.minimapControl) return;
    const newLayer = this.createMinimapTileLayer();
    this.minimapControl.changeLayer(newLayer);
    this.minimapTileLayer = newLayer;
  }

  /** Desktop: replace hover expand with click-only toggle on base layers control */
  private setupClickOnlyBaseLayers(): void {
    if (this.isMobilePortrait || !this.baseLayersControl) return;
    const ctrl = this.baseLayersControl as any;
    const container = ctrl.getContainer() as HTMLElement;
    if (!container) return;

    // Override expand at method level — only allow when triggered by our click handler
    const originalExpand = ctrl.expand.bind(ctrl);
    const originalCollapse = ctrl.collapse.bind(ctrl);
    let clickTriggered = false;

    ctrl.expand = function () {
      if (clickTriggered) {
        clickTriggered = false;
        return originalExpand();
      }
      return this;
    };

    // Native tooltip on toggle button
    const toggle = container.querySelector('.leaflet-control-layers-toggle') as HTMLElement;
    if (toggle) {
      const layerLabel = this.translate.instant('mapfly.baselayers.title');
      toggle.setAttribute('title', layerLabel);
      toggle.setAttribute('aria-label', layerLabel);
      toggle.removeAttribute('href');

      toggle.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (container.classList.contains('leaflet-control-layers-expanded')) {
          originalCollapse();
        } else {
          clickTriggered = true;
          originalExpand();
        }
      });
    }

    // Collapse after selecting a base layer
    container.querySelectorAll('input[type="radio"]').forEach((input) => {
      input.addEventListener('change', () => {
        setTimeout(() => originalCollapse(), 250);
      });
    });

    // Collapse when clicking elsewhere on the map
    this.map.on('click', () => {
      if (container.classList.contains('leaflet-control-layers-expanded')) {
        originalCollapse();
      }
    });
  }

  /** Native tooltip on categories toggle (bottom-right) */
  private setupCategoriesToggleTooltip(): void {
    if (!this.groupedLayersControl) return;
    const container = (this.groupedLayersControl as any).getContainer() as HTMLElement;
    if (!container) return;
    const toggle = container.querySelector('.leaflet-control-layers-toggle') as HTMLElement;
    if (toggle) {
      const label = this.translate.instant('mapfly.categories.toggle');
      toggle.setAttribute('title', label);
      toggle.setAttribute('aria-label', label);
    }
  }

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

    // Ephemeral journey mode (random)
    const ephemeralJourney = params.get('ephemeralJourney') === 'true';
    if (ephemeralJourney) {
      this.isJourneyMode.set(true);
      this.initEphemeralJourneyMode();
      return;
    }

    this.isSearchActive = false;

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
      this.isZoneMode.set(true);
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
          .layers(baseMaps, {}, { collapsed: !this.isMobilePortrait, position: 'bottomleft' })
          .addTo(this.map);
        this.setupClickOnlyBaseLayers();
      });

    // Met à jour dynamiquement les libellés si la langue change
    this.translate.onLangChange.subscribe(() => {
      if (this.groupedLayersControl) {
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
        this.setupCategoriesToggleTooltip();
      }

      // Supprime le contrôle existant
      this.baseLayersControl.remove();

      // Crée un nouveau avec les traductions mises à jour
      this.baseLayersControl = L.control
        .layers(
          this.getTranslatedBaseMaps(),
          {},
          { collapsed: !this.isMobilePortrait, position: 'bottomleft' },
        )
        .addTo(this.map);
      this.setupClickOnlyBaseLayers();

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
      // Sync minimap tile layer (both manual and auto switches)
      this.syncMinimapLayer();

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
      if (userHasSelectedBase || this.isSearchActive) return;

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
        this.zoneSounds = sounds;
        this.zoneSoundCount.set(sounds.length);
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

      // --- User filter info banner ---
      if (userId && !category) {
        this.isUserMode.set(true);
        this.userSoundCount.set(sounds.length);
        const username = sounds[0]?.user?.username ?? userId;
        this.userFilterLabel.set(username);

        if (sounds.length === 0) {
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
      this.markerLookup = {};

      const isNormalMode = !zoneId && !category && !secondaryCategory && !userId;

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

        // --- Mobile: BottomSheet instead of Leaflet popup ---
        if (this.isMobilePortrait) {
          const sheetData: SoundPopupSheetData = {
            type: 'normal',
            sound: {
              id: s.id, filename: s.filename, title: s.title, title_i18n: s.title_i18n,
              shortStory: s.shortStory, shortStory_i18n: s.shortStory_i18n,
              city: s.city, url: s.url, urlTitle: s.urlTitle,
              secondaryUrl: s.secondaryUrl, secondaryUrlTitle: s.secondaryUrlTitle,
              likesCount: s.likesCount, userId: s.userId, user: s.user,
              latitude: s.latitude, longitude: s.longitude,
            },
            audioUrl: url, mimeType,
            markerColor: this.categoryColors[category] || '#1976d2',
            onZoomIn: () => this.centerMarkerAboveSheet(s.latitude!, s.longitude!, Math.min(this.map.getZoom() + 2, 18)),
            onZoomOut: () => this.centerMarkerAboveSheet(s.latitude!, s.longitude!, Math.max(this.map.getZoom() - 2, 3)),
            onAudioPlay: () => this.ambientAudio?.duck?.(),
            onAudioPause: () => this.ambientAudio?.unduck?.(),
          };
          (m as any).__soundSheetData = sheetData;
          m.on('click', () => this.openSoundSheet(sheetData));
        } else {
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
            <div class="ws-popup-player" id="ws-player-${s.filename}"></div>
            <div id="btn-container-${s.filename}" class="popup-btn-group">
              <button class="zoom-btn material-icons" id="zoom-out-${s.filename}">remove</button>
              <button class="download-btn material-icons" id="download-${s.filename}">download</button>
              <button class="zoom-btn material-icons" id="zoom-in-${s.filename}">add</button>
            </div>
          </div>
        `, {
            maxWidth: 340,
            minWidth: 280,
            ...(window.innerWidth <= 700 ? { maxHeight: Math.round(window.innerHeight * 0.55) } : {}),
          });
        }

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

        // Store timeline mapping for zone mode
        if (zoneId && s.recordDateTime) {
          const d = s.recordDateTime instanceof Date ? s.recordDateTime : new Date(s.recordDateTime);
          if (!isNaN(d.getTime())) {
            this.timelineMarkerMap.push({ date: d, marker: m });
          }
        }

        // Store createdAt mapping for normal mode time filter
        if (isNormalMode && s.createdAt) {
          const ca = s.createdAt instanceof Date ? s.createdAt : new Date(s.createdAt as any);
          if (!isNaN(ca.getTime())) {
            this.normalModeMarkerMap.push({ createdAt: ca, marker: m });
          }
        }

        // --- Popup logic (desktop only — mobile uses BottomSheet) ---
        if (!this.isMobilePortrait) {
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
                window.location.href = window.location.origin + this.router.serializeUrl(tree);
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

          // --- WaveSurfer player ---
          const wsContainer = document.getElementById(`ws-player-${s.filename}`);
          if (wsContainer) {
            this.activePopupPlayer?.destroy();
            requestAnimationFrame(() => {
              const isDark = document.body.classList.contains('dark-theme');
              this.activePopupPlayer = createWaveSurferPlayer({
                container: wsContainer,
                audioUrl: url,
                isDarkTheme: isDark,
                onPlay: () => this.ambientAudio?.duck?.(),
                onPause: () => this.ambientAudio?.unduck?.(),
              });
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
            this.activePopupPlayer?.destroy();
            this.activePopupPlayer = null;
          });
        });
        } // end if (!this.isMobilePortrait)

        // --- Add marker to cluster ---
        this.markerLookup[s.filename] = m; // lookup pour Fuse.js
      }

      // --- Add cluster to map ---
      this.map.addLayer(this.markersCluster);

      // --- Initialize timeline if zone has it enabled ---
      if (zoneId && this.timelineMarkerMap.length > 0) {
        this.initTimeline();
      }

      // --- Compute time filter counts (normal mode only) ---
      if (isNormalMode) {
        this.computeTimeFilterCounts();
      }

      // --- Fit bounds when filtering by category or user ---
      if ((category || secondaryCategory || userId) && sounds.length > 0) {
        const bounds = this.markersCluster.getBounds();
        if (bounds.isValid()) {
          this.map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
        }
      }

      // Layers control: hidden in category mode (already filtered)
      if (!this.isCategoryMode()) {
        const categoryOverlays = this.buildCategoryOverlays();

        this.groupedLayersControl = (L as any).control.groupedLayers(
          {},
          categoryOverlays,
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
        this.setupCategoriesToggleTooltip();
      }

      // 🛰 MiniMap radar
      this.initMinimap();

      // --- 🔍 Préparation des données pour Fuse (unified search bar) ---
      const soundsForSearch = sounds.map((s) => {
        const title = (s.title || '').trim();
        const hashtags = (s.hashtags || '')
          .replace(/[#,@]/g, ' ')
          .replace(/,/g, ' ')
          .trim();
        return {
          filename: s.filename,
          combinedText: `${title} ${hashtags}`.trim(),
        };
      });

      this.fuseInstance = new Fuse(soundsForSearch, {
        keys: ['combinedText'],
        threshold: 0.3,
        ignoreLocation: true,
        distance: 1000,
      });
    } finally {
      this.isLoading.set(false);
    }
  }

  // =====================================================
  // Unified Search Bar
  // =====================================================
  onSearchInput(event: Event) {
    const query = (event.target as HTMLInputElement).value;
    this.searchQuery.set(query);

    if (this.searchDebounceTimer) clearTimeout(this.searchDebounceTimer);

    if (!query || query.length < 2) {
      this.searchResults.set([]);
      return;
    }

    this.searchDebounceTimer = setTimeout(() => {
      if (this.searchMode() === 'sounds') {
        this.searchSounds(query);
      } else {
        this.searchPlaces(query);
      }
    }, 250);
  }

  private searchSounds(query: string) {
    if (!this.fuseInstance) return;
    const results = this.fuseInstance.search(query).slice(0, 8);
    this.searchResults.set(
      results
        .filter(r => this.markerLookup[r.item.filename])
        .map(r => ({
          label: r.item.combinedText,
          filename: r.item.filename,
        }))
    );
  }

  private async searchPlaces(query: string) {
    try {
      const results = await this.geoProvider.search({ query });
      this.searchResults.set(
        results.slice(0, 8).map((r: any) => ({
          label: r.label,
          lat: r.y,
          lng: r.x,
        }))
      );
    } catch {
      this.searchResults.set([]);
    }
  }

  selectSearchResult(result: { label: string; filename?: string; lat?: number; lng?: number }) {
    this.searchQuery.set('');
    this.searchResults.set([]);
    this.searchFocused.set(false);

    if (this.searchMode() === 'sounds' && result.filename) {
      // Sound search: zoom to marker and open popup
      const marker = this.markerLookup[result.filename];
      if (marker) {
        this.isSearchActive = true;
        this.markersCluster.zoomToShowLayer(marker, () => {
          if (this.isMobilePortrait) {
            const sheetData = (marker as any).__soundSheetData;
            if (sheetData) this.openSoundSheet(sheetData);
          } else {
            marker.openPopup();
            // On mobile, shift map up so popup is well centered below search bar
            if (window.innerWidth <= 700) {
              setTimeout(() => {
                // Shift up by 15% of viewport height to center popup visually
                const offsetY = -Math.round(window.innerHeight * 0.15);
                this.map.panBy([0, offsetY], { animate: true });
              }, 300);
            }
          }
        });
        setTimeout(() => (this.isSearchActive = false), 2000);
      }
    } else if (result.lat != null && result.lng != null) {
      // Place search: fly to location
      this.isSearchActive = true;
      this.map.setView([result.lat, result.lng], 17);

      // Try to open nearest marker popup/sheet
      this.fgAll.eachLayer((marker: any) => {
        const mLatLng = marker.getLatLng();
        if (
          Math.abs(mLatLng.lat - result.lat!) < 0.0001 &&
          Math.abs(mLatLng.lng - result.lng!) < 0.0001
        ) {
          if (this.isMobilePortrait) {
            const sheetData = (marker as any).__soundSheetData;
            if (sheetData) this.openSoundSheet(sheetData);
          } else {
            marker.openPopup();
          }
        }
      });
      setTimeout(() => (this.isSearchActive = false), 1500);
    }
  }

  switchSearchMode(mode: 'sounds' | 'places') {
    this.searchMode.set(mode);
    this.searchQuery.set('');
    this.searchResults.set([]);
  }

  clearSearch() {
    this.searchQuery.set('');
    this.searchResults.set([]);
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

  // =====================================================
  // Mobile popup BottomSheet
  // =====================================================
  private openSoundSheet(data: SoundPopupSheetData) {
    if (this.activeSheetRef) {
      this.activeSheetRef.dismiss();
    }

    // Remove previous selection circle
    if (this.activeSelectionCircle) {
      this.map.removeLayer(this.activeSelectionCircle);
      this.activeSelectionCircle = null;
    }

    this.activeSheetRef = this.bottomSheet.open(SoundPopupSheetComponent, {
      data,
      hasBackdrop: false,
      disableClose: true,
      panelClass: 'sound-popup-sheet-panel',
    });

    // Add selection circle around the active marker (skip for journey/featured — pulse circle already present)
    if (data.type !== 'journey' && data.type !== 'featured' && data.sound.latitude && data.sound.longitude) {
      const color = data.markerColor || '#1976d2';
      this.activeSelectionCircle = L.circleMarker(
        [data.sound.latitude, data.sound.longitude],
        {
          radius: 22,
          color,
          weight: 3,
          opacity: 0.9,
          fillColor: color,
          fillOpacity: 0.15,
          className: 'marker-selection-ring',
        }
      ).addTo(this.map);
    }

    // Center marker in visible map area (above the sheet)
    if (data.sound.latitude && data.sound.longitude) {
      setTimeout(() => {
        this.centerMarkerAboveSheet(data.sound.latitude!, data.sound.longitude!);
      }, 100);
    }

    // Capture reference to THIS circle so the callback only cleans up its own circle
    const circleForThisSheet = this.activeSelectionCircle;
    this.activeSheetRef.afterDismissed().subscribe(() => {
      // Only clean up if the circle hasn't been replaced by a newer openSoundSheet call
      if (this.activeSelectionCircle === circleForThisSheet) {
        this.activeSheetRef = null;
        if (this.activeSelectionCircle) {
          this.map.removeLayer(this.activeSelectionCircle);
          this.activeSelectionCircle = null;
        }
      }
    });
  }

  /** Center a marker in the visible map area (top half, above the bottom sheet). */
  private centerMarkerAboveSheet(lat: number, lng: number, zoom?: number) {
    const mapSize = this.map.getSize();
    const sheetHeight = mapSize.y * 0.5; // bottom sheet max-height: 50vh
    const targetZoom = zoom ?? this.map.getZoom();

    // Project marker to pixel coords at target zoom
    const markerPoint = this.map.project(L.latLng(lat, lng), targetZoom);
    // Offset center downward so marker sits at center of visible area
    const offsetY = sheetHeight / 2;
    const newCenterPoint = L.point(markerPoint.x, markerPoint.y + offsetY);
    const newCenter = this.map.unproject(newCenterPoint, targetZoom);

    this.map.setView(newCenter, targetZoom, { animate: true, duration: 0.4 });
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

  // --- Zone management (cinematic entry) ---
  private async loadZone(zoneId: string) {
    try {
      // Clear any existing zone before loading new one
      if (this.zonePolygonLayer || this.zoneMaskLayer || this.zoneTitleControl) {
        this.clearZoneVisuals(false);
      }

      const zone = await this.zoneService.getZoneById(zoneId);
      if (!zone) return;

      this.currentZone.set(zone);

      const lang = this.currentUserLanguage;
      const title = zone.name_i18n?.[lang] ?? zone.name;
      const description = zone.description_i18n?.[lang] ?? zone.description ?? '';
      const color = zone.color ?? '#b07c10';

      // Setup overlay signals
      this.zoneOverlayTitle.set(title);
      this.zoneOverlayDescription.set(description);
      this.zoneOverlayGradient.set(
        `linear-gradient(135deg, ${this.darkenColor(color)} 0%, ${color} 100%)`
      );
      this.zoneOverlayIcon.set(zone.icon ?? 'terrain');

      // Resolve cover image URL (used in zone info modal)
      if (zone.coverImage) {
        this.zoneService
          .getZoneFileUrl(zone.coverImage)
          .then((url) => this.zoneOverlayCoverUrl.set(url))
          .catch(() => this.zoneOverlayCoverUrl.set(null));
      } else {
        this.zoneOverlayCoverUrl.set(null);
      }

      // Check ambient sound — start early during cinematic for immersive fade-in
      this.hasAmbientSound.set(!!zone.ambientSound);
      this.ambientSoundLabel.set(zone.ambientSoundLabel ?? '');
      if (zone.ambientSound) {
        this.isAmbientMuted.set(this.ambientAudio.isUserMuted());
        this.zoneService
          .getZoneFileUrl(zone.ambientSound)
          .then((url) => this.ambientAudio.play(url, 4000))
          .catch(() => console.warn('Failed to load ambient sound'));
      }

      // ===== CINEMATIC ENTRY SEQUENCE =====

      // t=0: Show overlay
      this.zoneOverlayVisible.set(true);
      this.zoneOverlayFading.set(false);

      // t=1500ms: Start fly-in from world to continent
      setTimeout(() => {
        if (!this.map) return;
        this.map.setView([30, 10], 3, { animate: false }); // World view
        this.map.flyTo(
          zone.center ? [zone.center.lat, zone.center.lng] : [46.6, 1.9],
          6,
          { duration: 2, easeLinearity: 0.4 }
        );
      }, 1500);

      // t=3500ms: Switch base layer to satellite
      setTimeout(() => {
        if (!this.map) return;
        if (this.map.hasLayer(this.esri)) {
          this.map.removeLayer(this.esri);
          this.map.addLayer(this.mapbox);
        }
      }, 3500);

      // t=4000ms: Fly to zone level
      setTimeout(() => {
        if (!this.map || !zone.center) return;
        this.map.flyTo(
          [zone.center.lat, zone.center.lng],
          zone.defaultZoom ?? 12,
          { duration: 2, easeLinearity: 0.3 }
        );
      }, 4000);

      // t=6000ms: Reveal — hide overlay, show zone visuals
      setTimeout(() => {
        this.zoneOverlayFading.set(true);

        // t=6600ms: Remove overlay, display zone polygon + mask + title
        setTimeout(() => {
          this.zoneOverlayVisible.set(false);
          this.zoneOverlayFading.set(false);
          this.displayZoneOnMap(zone);
        }, 600);
      }, 6000);

    } catch (error) {
      console.error('Error loading zone:', error);
      // Fallback: hide overlay if error
      this.zoneOverlayVisible.set(false);
    }
  }

  /**
   * Darken a hex color for gradient start
   */
  private darkenColor(hex: string): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const factor = 0.4;
    return `#${Math.round(r * factor).toString(16).padStart(2, '0')}${Math.round(g * factor).toString(16).padStart(2, '0')}${Math.round(b * factor).toString(16).padStart(2, '0')}`;
  }

  /**
   * Toggle ambient sound from the map control
   */
  public toggleAmbient() {
    this.ambientAudio.toggleMute();
    this.isAmbientMuted.set(this.ambientAudio.isUserMuted());
  }

  private displayZoneOnMap(zone: Zone) {
    if (!zone.polygon || !this.map) return;

    const color = zone.color ?? '#1976d2';
    const coords = zone.polygon.coordinates[0].map((c) => L.latLng(c[1], c[0]));

    // Premium polygon: outer glow layer (wider, blurred effect)
    this.zonePolygonGlowLayer = L.polygon(coords, {
      color,
      weight: 8,
      fillOpacity: 0,
      opacity: 0,
      lineCap: 'round',
      lineJoin: 'round',
      className: 'zone-polygon-glow',
    }).addTo(this.map);

    // Premium polygon: main border (crisp dashed line)
    this.zonePolygonLayer = L.polygon(coords, {
      color: '#fff',
      weight: 2,
      fillOpacity: 0,
      dashArray: '8, 6',
      opacity: 0,
      className: 'zone-polygon-main',
    }).addTo(this.map);

    // Fit map to polygon bounds with padding for UI elements
    const isMobile = window.innerWidth <= 700 && window.matchMedia('(orientation: portrait)').matches;
    const bounds = this.zonePolygonLayer.getBounds();
    if (bounds.isValid()) {
      const opts: L.FitBoundsOptions = isMobile
        ? { paddingTopLeft: [30, 80], paddingBottomRight: [30, 140], maxZoom: 15, animate: true }
        : { padding: [60, 60], maxZoom: 15, animate: true };
      this.map.fitBounds(bounds, opts);
    }

    // Animate polygon appearance
    let opacity = 0;
    const fadeIn = setInterval(() => {
      opacity += 0.04;
      if (opacity >= 1) {
        opacity = 1;
        clearInterval(fadeIn);
      }
      this.zonePolygonGlowLayer?.setStyle({ opacity: opacity * 0.5 });
      this.zonePolygonLayer?.setStyle({ opacity });
    }, 40);

    // Create mask outside the zone with animated opacity
    this.createZoneMaskAnimated(coords, color);

    // Note: cover image activation moved to URL resolution callback (avoids race condition)

    // Add zone title control
    this.addZoneTitleControl(zone);

    // Setup popup audio ducking (auto-mute ambient when popup sound plays)
    this.setupPopupAudioDucking();
  }

  private popupAudioPlayHandler: ((e: Event) => void) | null = null;
  private popupAudioPauseHandler: ((e: Event) => void) | null = null;
  private activePopupPlayer: WaveSurferPlayerInstance | null = null;
  private popupFadeTimer: ReturnType<typeof setInterval> | null = null;
  private fadingOutAudio: HTMLAudioElement | null = null;

  private clearPopupFade(): void {
    if (this.popupFadeTimer) {
      clearInterval(this.popupFadeTimer);
      this.popupFadeTimer = null;
    }
  }

  private setupPopupAudioDucking() {
    // Remove previous listeners if any
    this.removePopupAudioDucking();

    const container = this.map.getContainer();

    this.popupAudioPlayHandler = (e: Event) => {
      if (!(e.target instanceof HTMLAudioElement)) return;
      const audio = e.target;

      // Skip if this play was triggered by our fade-out mechanism
      if (audio === this.fadingOutAudio) return;

      this.clearPopupFade();

      // Smooth fade-in for popup audio
      audio.volume = 0;
      const steps = 20;
      const stepMs = 40; // ~800ms total
      let step = 0;

      this.popupFadeTimer = setInterval(() => {
        step++;
        if (step >= steps || audio.paused) {
          if (!audio.paused) audio.volume = 1;
          this.clearPopupFade();
          return;
        }
        // Ease-in curve: gentle start, natural ramp up
        const progress = step / steps;
        audio.volume = Math.pow(progress, 2);
      }, stepMs);

      // Duck ambient simultaneously
      this.ambientAudio.duck();
    };

    this.popupAudioPauseHandler = (e: Event) => {
      if (!(e.target instanceof HTMLAudioElement)) return;
      const audio = e.target;

      // Skip if this is our own fade-out completing its final pause()
      if (audio === this.fadingOutAudio) {
        this.fadingOutAudio = null;
        this.ambientAudio.unduck();
        return;
      }

      this.clearPopupFade();

      // If audio ended naturally or volume is already 0, just unduck
      if (audio.ended || audio.volume === 0) {
        this.ambientAudio.unduck();
        return;
      }

      // Fade-out: resume playback briefly, lower volume, then truly pause
      const startVol = audio.volume;
      this.fadingOutAudio = audio;

      audio.play().then(() => {
        const steps = 12;
        const stepMs = 40; // ~500ms total
        let step = 0;

        this.popupFadeTimer = setInterval(() => {
          step++;
          if (step >= steps || !this.fadingOutAudio) {
            if (this.fadingOutAudio) {
              this.fadingOutAudio.volume = 0;
              this.fadingOutAudio.pause(); // triggers pause event, handled by guard above
            }
            this.clearPopupFade();
            return;
          }
          // Ease-out curve: fades quickly then tapers off
          const progress = step / steps;
          const eased = 1 - Math.pow(1 - progress, 3);
          audio.volume = Math.max(0, startVol * (1 - eased));
        }, stepMs);
      }).catch(() => {
        this.fadingOutAudio = null;
        this.ambientAudio.unduck();
      });
    };

    container.addEventListener('play', this.popupAudioPlayHandler, true);
    container.addEventListener('pause', this.popupAudioPauseHandler, true);
    container.addEventListener('ended', this.popupAudioPauseHandler, true);
  }

  private removePopupAudioDucking() {
    this.clearPopupFade();
    this.fadingOutAudio = null;
    if (!this.map) return;
    const container = this.map.getContainer();
    if (this.popupAudioPlayHandler) {
      container.removeEventListener('play', this.popupAudioPlayHandler, true);
    }
    if (this.popupAudioPauseHandler) {
      container.removeEventListener('pause', this.popupAudioPauseHandler, true);
      container.removeEventListener('ended', this.popupAudioPauseHandler, true);
    }
    this.popupAudioPlayHandler = null;
    this.popupAudioPauseHandler = null;
  }

  private createZoneMaskAnimated(zoneCoords: L.LatLng[], color: string) {
    const worldBounds: L.LatLngTuple[] = [
      [-90, -180], [-90, 180], [90, 180], [90, -180], [-90, -180],
    ];
    const outerRing = worldBounds.map((c) => L.latLng(c[0], c[1]));
    const innerRing = [...zoneCoords, zoneCoords[0]];

    this.zoneMaskLayer = L.polygon([outerRing, innerRing], {
      color: 'transparent',
      fillColor: '#000',
      fillOpacity: 0,
      interactive: false,
    }).addTo(this.map);

    // Animate mask fill opacity from 0 to 0.4
    let fillOp = 0;
    const maskFade = setInterval(() => {
      fillOp += 0.02;
      if (fillOp >= 0.4) {
        fillOp = 0.4;
        clearInterval(maskFade);
      }
      this.zoneMaskLayer?.setStyle({ fillOpacity: fillOp });
    }, 50);
  }

  private addZoneTitleControl(zone: Zone) {
    const lang = this.currentUserLanguage;
    const title = zone.name_i18n?.[lang] ?? zone.name;
    const color = zone.color ?? '#1976d2';
    const icon = zone.icon ?? 'terrain';

    const ZoneTitleControl = L.Control.extend({
      options: { position: 'topleft' as L.ControlPosition },
      onAdd: () => {
        const container = L.DomUtil.create('div', 'zone-title-control');
        container.innerHTML = `
          <div class="zone-title-content" style="--zone-color: ${color}">
            <span class="zone-title-icon" style="background: ${color}">
              <span class="material-icons">${icon}</span>
            </span>
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

    // Compute zone stats
    const soundCount = this.zoneSounds.length;
    const datedSounds = this.zoneSounds.filter(s => s.recordDateTime);
    const dates = datedSounds.map(s => new Date(s.recordDateTime!).getTime()).sort((a, b) => a - b);
    const locale = lang === 'fr' ? 'fr-FR' : lang === 'es' ? 'es-ES' : 'en-US';
    const dateRangeHtml = dates.length >= 2
      ? `<span>${new Date(dates[0]).toLocaleDateString(locale, { year: 'numeric', month: 'short' })} — ${new Date(dates[dates.length - 1]).toLocaleDateString(locale, { year: 'numeric', month: 'short' })}</span>`
      : '';

    // Top categories
    const catCount: Record<string, number> = {};
    for (const s of this.zoneSounds) {
      if (s.category) catCount[s.category] = (catCount[s.category] || 0) + 1;
    }
    const topCats = Object.entries(catCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([key, count]) => `<span class="zone-stat-cat"><img src="img/logos/overlays/layer_control_${key}.png" width="18" /> ${this.translate.instant('categories.' + key)} (${count})</span>`)
      .join('');

    const statsHtml = soundCount > 0 ? `
      <div class="zone-stats-section">
        <div class="zone-stat-row">
          <span class="material-icons zone-stat-icon" style="color: ${color}">graphic_eq</span>
          <span class="zone-stat-value">${soundCount} ${this.translate.instant(soundCount === 1 ? 'mapfly.zone.soundSingular' : 'mapfly.zone.soundPlural')}</span>
        </div>
        ${dateRangeHtml ? `
        <div class="zone-stat-row">
          <span class="material-icons zone-stat-icon" style="color: ${color}">date_range</span>
          ${dateRangeHtml}
        </div>` : ''}
        ${topCats ? `
        <div class="zone-stat-row zone-stat-cats">
          <span class="material-icons zone-stat-icon" style="color: ${color}">category</span>
          <div class="zone-stat-cats-list">${topCats}</div>
        </div>` : ''}
      </div>
    ` : '';

    // Cover image for modal hero
    const coverUrl = this.zoneOverlayCoverUrl();
    const coverPosition = zone.coverImagePosition ?? 'center';
    const coverZoom = zone.coverImageZoom ?? 100;

    const heroImageHtml = coverUrl ? `
      <div class="zone-modal-hero">
        <img src="${coverUrl}" alt="${title}" style="object-position: center ${coverPosition}; transform: scale(${coverZoom / 100})" />
        <div class="zone-modal-hero-gradient" style="background: linear-gradient(to top, ${color} 0%, transparent 60%)"></div>
        <div class="zone-modal-hero-title">
          <h2 class="zone-modal-title" id="zone-modal-title">${title}</h2>
        </div>
        <button class="zone-modal-close-btn" aria-label="Close">
          <span class="material-icons">close</span>
        </button>
      </div>
    ` : `
      <div class="zone-modal-header" style="background-color: ${color}">
        <h2 class="zone-modal-title" id="zone-modal-title">${title}</h2>
        <button class="zone-modal-close-btn" aria-label="Close">
          <span class="material-icons">close</span>
        </button>
      </div>
    `;

    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'zone-info-modal-overlay';
    overlay.innerHTML = `
      <div class="zone-info-modal" style="--zone-color: ${color}">
        ${heroImageHtml}
        <div class="zone-modal-content">
          ${description ? `<p class="zone-modal-description" id="zone-modal-description">${description}</p>` : `<p class="zone-modal-no-description">${this.translate.instant('mapfly.zone.noDescription')}</p>`}
          ${hasTranslation ? `
            <button class="zone-modal-translate-btn" id="zone-translate-btn">
              <span class="material-icons">translate</span>
              <span>${this.translate.instant('common.action.translate')}</span>
            </button>
          ` : ''}
          ${statsHtml}
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
    // Remove popup audio ducking
    this.removePopupAudioDucking();

    // Stop ambient sound with fade-out
    this.ambientAudio.stop();
    this.hasAmbientSound.set(false);
    this.ambientSoundLabel.set('');

    // Stop and reset timeline
    this.stopTimeline();
    this.timelineEnabled.set(false);
    this.timelineVisible.set(false);
    this.timelineMarkerMap = [];
    this.zoneSounds = [];
    this.zoneSoundCount.set(0);
    this.zoneSeasonFilter.set(null);

    // Reset cover image URL
    this.zoneOverlayCoverUrl.set(null);

    // Remove zone layers without navigating (called when URL already changed)
    if (this.zonePolygonGlowLayer) {
      this.map.removeLayer(this.zonePolygonGlowLayer);
      this.zonePolygonGlowLayer = null;
    }
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
    const soundTeasing = params.get('soundTeasing') ?? '';
    let soundTeasingI18n: Record<string, string> | null = null;
    try {
      const raw = params.get('soundTeasingI18n');
      if (raw) soundTeasingI18n = JSON.parse(raw);
    } catch { /* ignore */ }

    // Start zoomed out for cinematic fly-in
    this.map = L.map('mapfly', {
      center: L.latLng(30, 2.5),
      zoom: 3,
      attributionControl: false,
      zoomControl: false,
    });

    // Use satellite for the cinematic effect
    this.esri.addTo(this.map);

    // Ensure translations are loaded before showing overlay (avoids language flash)
    await firstValueFrom(this.translate.use(this.translate.currentLang || 'fr'));
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

    // Resolve teasing text for the current language
    const lang = this.currentUserLanguage.toLowerCase().trim();
    const displayTeasing = (soundTeasingI18n?.[lang]) || soundTeasing;

    const featuredLabel = 'home.hero.soundOfTheDay'; // i18n key — translated in template

    // --- Build featured sheet data for mobile ---
    const featuredSheetData: SoundPopupSheetData = {
      type: 'featured',
      sound: {
        id: soundId, filename: soundFilename, title: soundTitle,
        title_i18n: s?.title_i18n, shortStory: s?.shortStory, shortStory_i18n: s?.shortStory_i18n,
        city: s?.city ?? soundCity, url: s?.url, urlTitle: s?.urlTitle,
        secondaryUrl: s?.secondaryUrl, secondaryUrlTitle: s?.secondaryUrlTitle,
        likesCount: s?.likesCount, userId: s?.userId, user: s?.user,
        latitude: lat, longitude: lng,
      },
      audioUrl: url, mimeType,
      featuredLabel, displayTeasing, soundTeasingI18n: soundTeasingI18n ?? undefined,
      markerColor: '#7c4dff',
      onZoomIn: () => this.centerMarkerAboveSheet(lat, lng, Math.min(this.map.getZoom() + 2, 18)),
      onZoomOut: () => this.centerMarkerAboveSheet(lat, lng, Math.max(this.map.getZoom() - 2, 3)),
    };

    if (!this.isMobilePortrait) {
    marker.bindPopup(`
      <div class="popup-container featured-popup">
        <div class="featured-popup-header">
          <span class="material-icons featured-popup-icon">headphones</span>
          <span class="featured-popup-badge">${this.translate.instant(featuredLabel)}</span>
        </div>
        <div class="popup-header-row">
          <b class="popup-title" id="title-${soundFilename}">${soundTitle}</b>
          <div id="like-btn-featured-${soundId}" class="popup-like-btn" data-sound-id="${soundId}" data-likes-count="${s?.likesCount ?? 0}">
            <img src="img/icon/${soundId && this.likeService.isLiked(soundId) ? 'clapping_hands_like_2' : 'clapping_hands_no_like'}.png" class="popup-like-icon" />
            <span class="popup-like-count">${s?.likesCount ?? 0}</span>
          </div>
        </div>
        <p class="popup-shortstory" id="shortStory-${soundFilename}">${displayTeasing}</p>
        <div id="btn-container-title-${soundFilename}"></div>
        <div id="btn-container-shortStory-${soundFilename}"></div>
        <div id="links-${soundFilename}" class="popup-links"></div>
        <p id="record-info-${soundFilename}" class="popup-record-info" style="font-style: italic; font-size: 0.9em; margin-top: 6px;"></p>
        <div class="ws-popup-player" id="ws-player-featured-${soundFilename}"></div>
        <div id="btn-container-${soundFilename}" class="popup-btn-group">
          <button class="zoom-btn material-icons" id="zoom-out-${soundFilename}">remove</button>
          <button class="download-btn material-icons" id="download-${soundFilename}">download</button>
          <button class="zoom-btn material-icons" id="zoom-in-${soundFilename}">add</button>
        </div>
      </div>
    `, {
      maxWidth: 340,
      minWidth: 280,
      autoPanPaddingTopLeft: L.point(10, 60),
      autoPanPaddingBottomRight: L.point(10, 70),
    });

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
            window.location.href = window.location.origin + this.router.serializeUrl(tree);
          });
        }
      }

      // --- Translate button (uses teasing i18n instead of shortStory for featured popup) ---
      if (titleEl && shortStoryEl && btnTitleContainer) {
        const title_i18n_obj = this.parseI18n(s.title_i18n);
        const teasingLang = this.currentUserLanguage.toLowerCase().trim();
        const translatedTitle = title_i18n_obj?.[teasingLang];
        const translatedTeasing = soundTeasingI18n?.[teasingLang];
        const shouldShow =
          (translatedTitle && translatedTitle !== titleEl.textContent?.trim()) ||
          (translatedTeasing && translatedTeasing !== shortStoryEl.textContent?.trim());

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
            if (title_i18n_obj?.[teasingLang]) titleEl.textContent = title_i18n_obj[teasingLang];
            if (soundTeasingI18n?.[teasingLang]) shortStoryEl.textContent = soundTeasingI18n[teasingLang];
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

      // --- WaveSurfer player ---
      const wsContainer = document.getElementById(`ws-player-featured-${soundFilename}`);
      if (wsContainer) {
        this.activePopupPlayer?.destroy();
        requestAnimationFrame(() => {
          const isDark = document.body.classList.contains('dark-theme');
          this.activePopupPlayer = createWaveSurferPlayer({
            container: wsContainer,
            audioUrl: url,
            isDarkTheme: isDark,
            onPlay: () => this.ambientAudio?.duck?.(),
            onPause: () => this.ambientAudio?.unduck?.(),
          });
        });
      }
    });

    marker.on('popupclose', () => {
      this.activePopupPlayer?.destroy();
      this.activePopupPlayer = null;
    });
    } // end if (!this.isMobilePortrait) — featured popup

    // Mobile: allow reopening sheet on marker click
    if (this.isMobilePortrait) {
      marker.on('click', () => this.openSoundSheet(featuredSheetData));
    }

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
        // Larger offset on mobile where popup takes more vertical space
        setTimeout(() => {
          const isMobile = window.innerWidth <= 700;
          const offsetLat = L.latLng(lat + (isMobile ? 0.0018 : 0.0012), lng);
          this.map.flyTo(offsetLat, 17, {
            duration: 2,
            easeLinearity: 0.4,
          });

          this.map.once('moveend', () => {
            // Step 5: Hide overlay, add pulse effect, open popup
            this.featuredOverlayVisible.set(false);

            pulseCircle.addTo(this.map);

            setTimeout(() => {
              if (this.isMobilePortrait) {
                this.openSoundSheet(featuredSheetData);
              } else {
                marker.openPopup();
              }
            }, 400);

            // Add zoom control after animation
            L.control.zoom({ position: 'bottomright' }).addTo(this.map);
          });
        }, 500);
      });
    }, 1800);
  }

  // =====================================================
  // Ephemeral Journey Mode — random journey (not persisted)
  // =====================================================
  private async initEphemeralJourneyMode() {
    if (!this.ephemeralJourneyService.hasData()) {
      this.goToFullMap();
      return;
    }

    // Create map (same cinematic start as regular journey)
    this.map = L.map('mapfly', {
      center: L.latLng(30, 2.5),
      zoom: 3,
      attributionControl: false,
      zoomControl: false,
    });
    this.esri.addTo(this.map);

    // Set journey signals from ephemeral data
    const sounds = this.ephemeralJourneyService.sounds();
    this.journeyColor.set(this.ephemeralJourneyService.color());
    this.journeyName.set(this.ephemeralJourneyService.name());

    // Create pseudo-steps
    this.journeySteps = sounds.map((s, i) => ({
      id: `ephemeral-${i}`,
      journeyId: 'ephemeral',
      soundId: s.id!,
      stepOrder: i,
    } as SoundJourneyStep));
    this.journeySounds = sounds;
    this.totalJourneySteps.set(sounds.length);

    // Clean up ephemeral data
    this.ephemeralJourneyService.clear();

    // Show overlay + stepper + fly (same as regular journey)
    await firstValueFrom(this.translate.use(this.translate.currentLang || 'fr'));
    this.journeyOverlayVisible.set(true);
    this.createJourneyStepperControl();
    setTimeout(() => {
      this.flyToJourneyStep(0);
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
      await firstValueFrom(this.translate.use(this.translate.currentLang || 'fr'));
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
    const isMobile = window.innerWidth <= 700;
    const flyToLatLng = L.latLng(sound.latitude + (isMobile ? 0.0020 : 0.0012), sound.longitude);
    const flyToZoom = isMobile ? 16 : 17;

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

    // --- Build journey sheet data for mobile ---
    const journeySheetData: SoundPopupSheetData = {
      type: 'journey',
      sound: {
        id: sound.id, filename: sound.filename, title,
        title_i18n: sound.title_i18n, shortStory: sound.shortStory, shortStory_i18n: sound.shortStory_i18n,
        city: sound.city, url: sound.url, urlTitle: sound.urlTitle,
        secondaryUrl: sound.secondaryUrl, secondaryUrlTitle: sound.secondaryUrlTitle,
        likesCount: sound.likesCount, userId: sound.userId, user: sound.user,
        latitude: sound.latitude, longitude: sound.longitude,
      },
      audioUrl: url, mimeType,
      stepIndex, totalSteps: this.totalJourneySteps(), journeyColor: color, themeText,
      markerColor: color,
      onZoomIn: () => {},
      onZoomOut: () => {},
      onJourneyPrev: () => { this.activeSheetRef?.dismiss(); this.flyToJourneyStep(stepIndex - 1); },
      onJourneyNext: () => { this.activeSheetRef?.dismiss(); this.flyToJourneyStep(stepIndex + 1); },
      onJourneyFinish: () => { this.activeSheetRef?.dismiss(); this.router.navigate(['/journeys']); },
    };

    if (!this.isMobilePortrait) {
    marker.bindPopup(`
      <div class="popup-container journey-popup">
        <div class="journey-popup-header" style="background: linear-gradient(180deg, ${color} 0%, ${color}cc 100%);">
          <span class="journey-step-badge">${stepLabel}</span>
          <div class="popup-header-row">
            <b class="journey-popup-title" id="journey-title-${stepIndex}">${title}</b>
            <div id="like-btn-journey-${sound.id}" class="popup-like-btn popup-like-btn-journey" data-sound-id="${sound.id}" data-likes-count="${sound.likesCount ?? 0}">
              <img src="${this.likeService.isLiked(sound.id!) ? 'img/icon/clapping_hands_like_2.png' : 'img/icon/clapping_hands_no_like.png'}" class="popup-like-icon" alt="like" />
              <span class="popup-like-count">${sound.likesCount ?? 0}</span>
            </div>
          </div>
        </div>
        ${themeText ? `<p class="journey-theme-text">${themeText}</p>` : ''}
        ${sound.shortStory ? `<p class="popup-shortstory" id="journey-story-${stepIndex}">${sound.shortStory}</p>` : ''}
        <div id="journey-translate-container-${stepIndex}"></div>
        <div id="journey-links-${stepIndex}" class="popup-links"></div>
        <p id="journey-record-info-${stepIndex}" class="popup-record-info" style="font-style: italic; font-size: 0.9em; margin-top: 6px;"></p>
        <div class="ws-popup-player" id="ws-player-journey-${stepIndex}"></div>
        <div class="journey-nav-buttons">
          ${prevBtnHtml}
          ${nextBtnHtml}
        </div>
      </div>
    `, { maxWidth: 350, minWidth: 280 });

    // Popup open logic
    marker.on('popupopen', () => {
      // Record info
      // External links
      const linksEl = document.getElementById(`journey-links-${stepIndex}`);
      if (linksEl) {
        const links: string[] = [];
        if (sound.url) {
          const text = sound.urlTitle?.trim() || sound.url;
          links.push(`<a href="${sound.url}" target="_blank" rel="noopener noreferrer">${text}</a>`);
        }
        if (sound.secondaryUrl) {
          const text = sound.secondaryUrlTitle?.trim() || sound.secondaryUrl;
          links.push(`<a href="${sound.secondaryUrl}" target="_blank" rel="noopener noreferrer">${text}</a>`);
        }
        if (links.length) linksEl.innerHTML = links.join(' | ');
      }

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

      // Translate button
      const titleEl = document.getElementById(`journey-title-${stepIndex}`);
      const storyEl = document.getElementById(`journey-story-${stepIndex}`);
      const translateContainer = document.getElementById(`journey-translate-container-${stepIndex}`);
      if (translateContainer && titleEl) {
        const title_i18n_obj = this.parseI18n(sound.title_i18n);
        const story_i18n_obj = this.parseI18n(sound.shortStory_i18n);
        const userLang = this.currentUserLanguage.toLowerCase().trim();
        const translatedTitle = title_i18n_obj?.[userLang];
        const translatedStory = story_i18n_obj?.[userLang];
        const currentTitle = titleEl.textContent?.trim();
        const currentStory = storyEl?.textContent?.trim();
        const shouldShow =
          (translatedTitle && translatedTitle !== currentTitle) ||
          (translatedStory && translatedStory !== currentStory);

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
          translateContainer.appendChild(btn);
          btn.addEventListener('click', () => {
            if (title_i18n_obj?.[userLang]) titleEl.textContent = title_i18n_obj[userLang];
            if (storyEl && story_i18n_obj?.[userLang]) storyEl.textContent = story_i18n_obj[userLang];
            btn.style.display = 'none';
          });
        }
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
          this.router.navigate(['/journeys']);
        });
      }

      // --- WaveSurfer player ---
      const wsContainer = document.getElementById(`ws-player-journey-${stepIndex}`);
      if (wsContainer) {
        this.activePopupPlayer?.destroy();
        requestAnimationFrame(() => {
          const isDark = document.body.classList.contains('dark-theme');
          this.activePopupPlayer = createWaveSurferPlayer({
            container: wsContainer,
            audioUrl: url,
            isDarkTheme: isDark,
            onPlay: () => this.ambientAudio?.duck?.(),
            onPause: () => this.ambientAudio?.unduck?.(),
          });
        });
      }
    });

    marker.on('popupclose', () => {
      this.activePopupPlayer?.destroy();
      this.activePopupPlayer = null;
    });
    } // end if (!this.isMobilePortrait) — journey popup

    // Mobile: allow reopening sheet on marker click
    if (this.isMobilePortrait) {
      marker.on('click', () => this.openSoundSheet(journeySheetData));
    }

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
          this.map.flyTo(flyToLatLng, flyToZoom, {
            duration: 2,
            easeLinearity: 0.4,
          });

          this.map.once('moveend', () => {
            marker.addTo(this.map);
            pulseCircle.addTo(this.map);
            setTimeout(() => {
              if (this.isMobilePortrait) {
                this.openSoundSheet(journeySheetData);
              } else {
                marker.openPopup();
              }
            }, 400);

            // Add zoom control after animation
            L.control.zoom({ position: 'bottomright' }).addTo(this.map);
          });
        }, 500);
      });
    } else {
      // Subsequent steps: direct fly
      this.map.flyTo(flyToLatLng, Math.min(flyToZoom - 1, 15), {
        duration: 1.8,
        easeLinearity: 0.3,
      });

      this.map.once('moveend', () => {
        this.map.flyTo(flyToLatLng, flyToZoom, {
          duration: 0.8,
          easeLinearity: 0.4,
        });

        this.map.once('moveend', () => {
          marker.addTo(this.map);
          pulseCircle.addTo(this.map);
          setTimeout(() => {
            if (this.isMobilePortrait) {
              this.openSoundSheet(journeySheetData);
            } else {
              marker.openPopup();
            }
          }, 300);
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
            <div class="journey-stepper-scroll-wrap">
              <button class="stepper-arrow stepper-arrow-left" aria-label="Scroll left">
                <span class="material-icons">chevron_left</span>
              </button>
              <div class="journey-stepper-dots">
                ${dotsHtml}
              </div>
              <button class="stepper-arrow stepper-arrow-right" aria-label="Scroll right">
                <span class="material-icons">chevron_right</span>
              </button>
            </div>
          </div>
        `;

        // Scroll arrows logic
        const dotsRow = container.querySelector('.journey-stepper-dots') as HTMLElement;
        const arrowL = container.querySelector('.stepper-arrow-left') as HTMLElement;
        const arrowR = container.querySelector('.stepper-arrow-right') as HTMLElement;

        const updateArrows = () => {
          if (!dotsRow) return;
          const canScroll = dotsRow.scrollWidth > dotsRow.clientWidth + 2;
          if (arrowL) arrowL.style.display = canScroll && dotsRow.scrollLeft > 2 ? '' : 'none';
          if (arrowR) arrowR.style.display = canScroll && dotsRow.scrollLeft < dotsRow.scrollWidth - dotsRow.clientWidth - 2 ? '' : 'none';
        };

        if (arrowL) {
          L.DomEvent.on(arrowL, 'click', (e: Event) => {
            L.DomEvent.stopPropagation(e);
            dotsRow.scrollBy({ left: -80, behavior: 'smooth' });
          });
        }
        if (arrowR) {
          L.DomEvent.on(arrowR, 'click', (e: Event) => {
            L.DomEvent.stopPropagation(e);
            dotsRow.scrollBy({ left: 80, behavior: 'smooth' });
          });
        }

        if (dotsRow) {
          dotsRow.addEventListener('scroll', updateArrows);
          // Wheel → horizontal scroll
          L.DomEvent.on(dotsRow, 'wheel', (e: Event) => {
            const we = e as WheelEvent;
            if (dotsRow.scrollWidth > dotsRow.clientWidth) {
              we.preventDefault();
              dotsRow.scrollLeft += we.deltaY;
            }
          });
        }
        setTimeout(updateArrows, 100);

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

  // =====================================================
  // Time-Based Filter — normal mode only
  // =====================================================
  private computeTimeFilterCounts(): void {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const all = this.normalModeMarkerMap.length;
    const weekCount = this.normalModeMarkerMap.filter(e => e.createdAt >= oneWeekAgo).length;
    const monthCount = this.normalModeMarkerMap.filter(e => e.createdAt >= oneMonthAgo).length;

    this.timeFilterCounts.set({
      all,
      latest10: Math.min(10, all),
      week: weekCount,
      month: monthCount,
    });
    this.hasWeekSounds.set(weekCount > 0);
    this.hasMonthSounds.set(monthCount > 0);
  }

  public openTimeFilterSheet(): void {
    const vis = this.categoryVisibility();
    const categoryToggles: CategoryToggle[] = [
      { key: CategoryKey.ANIMAL, labelKey: `categories.${CategoryKey.ANIMAL}`, iconUrl: `img/logos/overlays/layer_control_${CategoryKey.ANIMAL}.png`, enabled: vis[CategoryKey.ANIMAL] },
      { key: CategoryKey.NATURAL, labelKey: `categories.${CategoryKey.NATURAL}`, iconUrl: `img/logos/overlays/layer_control_${CategoryKey.NATURAL}.png`, enabled: vis[CategoryKey.NATURAL] },
      { key: CategoryKey.AMBIANCE, labelKey: `categories.${CategoryKey.AMBIANCE}`, iconUrl: `img/logos/overlays/layer_control_${CategoryKey.AMBIANCE}.png`, enabled: vis[CategoryKey.AMBIANCE] },
      { key: CategoryKey.MUSIC, labelKey: `categories.${CategoryKey.MUSIC}`, iconUrl: `img/logos/overlays/layer_control_${CategoryKey.MUSIC}.png`, enabled: vis[CategoryKey.MUSIC] },
      { key: CategoryKey.HUMAN, labelKey: `categories.${CategoryKey.HUMAN}`, iconUrl: `img/logos/overlays/layer_control_${CategoryKey.HUMAN}.png`, enabled: vis[CategoryKey.HUMAN] },
      { key: CategoryKey.FOOD, labelKey: `categories.${CategoryKey.FOOD}`, iconUrl: `img/logos/overlays/layer_control_${CategoryKey.FOOD}.png`, enabled: vis[CategoryKey.FOOD] },
      { key: CategoryKey.ITEM, labelKey: `categories.${CategoryKey.ITEM}`, iconUrl: `img/logos/overlays/layer_control_${CategoryKey.ITEM}.png`, enabled: vis[CategoryKey.ITEM] },
      { key: CategoryKey.SPORT, labelKey: `categories.${CategoryKey.SPORT}`, iconUrl: `img/logos/overlays/layer_control_${CategoryKey.SPORT}.png`, enabled: vis[CategoryKey.SPORT] },
      { key: CategoryKey.TRANSPORT, labelKey: `categories.${CategoryKey.TRANSPORT}`, iconUrl: `img/logos/overlays/layer_control_${CategoryKey.TRANSPORT}.png`, enabled: vis[CategoryKey.TRANSPORT] },
    ];

    this.bottomSheet.open(TimeFilterSheetComponent, {
      data: {
        current: this.timeFilter(),
        counts: this.timeFilterCounts(),
        hasWeek: this.hasWeekSounds(),
        hasMonth: this.hasMonthSounds(),
        categories: categoryToggles,
        onTimeFilterChange: (filter: 'all' | 'latest10' | 'week' | 'month') => this.toggleTimeFilter(filter),
        onCategoryToggle: (key: string, enabled: boolean) => this.setCategoryVisibility(key, enabled),
        onCategoryToggleAll: (enabled: boolean) => this.setAllCategoriesVisibility(enabled),
      } as TimeFilterSheetData,
      panelClass: 'time-filter-sheet-panel',
    });
  }

  private getCategoryFeatureGroup(key: string): L.FeatureGroup | null {
    switch (key) {
      case CategoryKey.ANIMAL: return this.fg1;
      case CategoryKey.NATURAL: return this.fg2;
      case CategoryKey.AMBIANCE: return this.fg3;
      case CategoryKey.MUSIC: return this.fg4;
      case CategoryKey.HUMAN: return this.fg5;
      case CategoryKey.FOOD: return this.fg6;
      case CategoryKey.ITEM: return this.fg7;
      case CategoryKey.SPORT: return this.fg8;
      case CategoryKey.TRANSPORT: return this.fg9;
      default: return null;
    }
  }

  private setCategoryVisibility(key: string, enabled: boolean): void {
    const fg = this.getCategoryFeatureGroup(key);
    if (!fg) return;
    if (enabled) {
      if (!this.map.hasLayer(fg)) this.map.addLayer(fg);
    } else {
      if (this.map.hasLayer(fg)) this.map.removeLayer(fg);
    }
    this.categoryVisibility.update(v => ({ ...v, [key]: enabled }));
  }

  private setAllCategoriesVisibility(enabled: boolean): void {
    const keys = Object.values(CategoryKey);
    for (const key of keys) {
      const fg = this.getCategoryFeatureGroup(key);
      if (!fg) continue;
      if (enabled) {
        if (!this.map.hasLayer(fg)) this.map.addLayer(fg);
      } else {
        if (this.map.hasLayer(fg)) this.map.removeLayer(fg);
      }
    }
    const vis: Record<string, boolean> = {};
    for (const key of keys) vis[key] = enabled;
    this.categoryVisibility.set(vis);
  }

  public toggleDesktopCategory(key: string): void {
    const current = this.categoryVisibility()[key];
    this.setCategoryVisibility(key, !current);
  }

  public toggleAllDesktopCategories(): void {
    this.setAllCategoriesVisibility(!this.allCategoriesEnabled());
  }

  public toggleTimeFilter(filter: 'all' | 'latest10' | 'week' | 'month'): void {
    if (this.timeFilter() === filter && filter !== 'all') {
      this.timeFilter.set('all');
      this.applyTimeFilter('all');
      return;
    }
    this.timeFilter.set(filter);
    this.applyTimeFilter(filter);
  }

  private applyTimeFilter(filter: 'all' | 'latest10' | 'week' | 'month'): void {
    if (filter === 'all') {
      for (const entry of this.normalModeMarkerMap) {
        if (!this.markersCluster.hasLayer(entry.marker)) {
          this.markersCluster.addLayer(entry.marker);
        }
      }
      return;
    }

    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    let passingSet: Set<L.Marker>;

    if (filter === 'latest10') {
      const sorted = [...this.normalModeMarkerMap].sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      );
      passingSet = new Set(sorted.slice(0, 10).map(e => e.marker));
    } else if (filter === 'week') {
      passingSet = new Set(
        this.normalModeMarkerMap.filter(e => e.createdAt >= oneWeekAgo).map(e => e.marker)
      );
    } else {
      passingSet = new Set(
        this.normalModeMarkerMap.filter(e => e.createdAt >= oneMonthAgo).map(e => e.marker)
      );
    }

    for (const entry of this.normalModeMarkerMap) {
      if (passingSet.has(entry.marker)) {
        if (!this.markersCluster.hasLayer(entry.marker)) {
          this.markersCluster.addLayer(entry.marker);
        }
      } else {
        if (this.markersCluster.hasLayer(entry.marker)) {
          this.markersCluster.removeLayer(entry.marker);
        }
      }
    }

    // Fly to bounds of visible markers
    if (passingSet.size > 0) {
      const bounds = L.latLngBounds(
        Array.from(passingSet).map(m => m.getLatLng())
      );
      if (bounds.isValid()) {
        this.map.flyToBounds(bounds, { padding: [50, 50], maxZoom: 15, duration: 1.2 });
      }
    }
  }

  // =====================================================
  // Timeline Mode — time-travel through sounds
  // =====================================================
  private initTimeline() {
    const zone = this.currentZone();
    if (!zone?.timelineEnabled) return;

    // Sort by date ascending
    this.timelineMarkerMap.sort((a, b) => a.date.getTime() - b.date.getTime());

    const minTs = this.timelineMarkerMap[0].date.getTime();
    const maxTs = this.timelineMarkerMap[this.timelineMarkerMap.length - 1].date.getTime();

    // Need at least 2 distinct dates for a timeline
    if (minTs === maxTs) return;

    this.timelineMin.set(minTs);
    this.timelineMax.set(maxTs);
    this.timelineCurrent.set(maxTs); // Start showing all sounds
    this.timelineEnabled.set(true);
    this.updateTimelineLabel(maxTs);
  }

  public showTimeline() {
    this.timelineVisible.set(true);
    // Start with all markers visible (cursor at max)
    this.timelineCurrent.set(this.timelineMax());
    this.updateTimelineLabel(this.timelineMax());
    this.applyTimelineFilter();
  }

  public hideTimeline() {
    this.stopTimeline();
    this.timelineVisible.set(false);
    // Show all markers again
    for (const entry of this.timelineMarkerMap) {
      if (!this.map.hasLayer(entry.marker)) {
        this.fgAll.addLayer(entry.marker);
      }
    }
  }

  public onTimelineChange(event: Event) {
    const value = parseInt((event.target as HTMLInputElement).value, 10);
    this.timelineCurrent.set(value);
    this.updateTimelineLabel(value);
    this.applyTimelineFilter();
  }

  public playTimeline() {
    if (this.timelinePlaying()) {
      this.stopTimeline();
      return;
    }

    this.timelinePlaying.set(true);
    // Start from beginning
    this.timelineCurrent.set(this.timelineMin());
    this.applyTimelineFilter();

    const range = this.timelineMax() - this.timelineMin();
    const stepMs = range / 100; // 100 steps
    const intervalMs = 120; // advance every 120ms → ~12s total

    this.timelineInterval = setInterval(() => {
      const next = this.timelineCurrent() + stepMs;
      if (next >= this.timelineMax()) {
        this.timelineCurrent.set(this.timelineMax());
        this.updateTimelineLabel(this.timelineMax());
        this.applyTimelineFilter();
        this.stopTimeline();
        return;
      }
      this.timelineCurrent.set(next);
      this.updateTimelineLabel(next);
      this.applyTimelineFilter();
    }, intervalMs);
  }

  private stopTimeline() {
    this.timelinePlaying.set(false);
    if (this.timelineInterval) {
      clearInterval(this.timelineInterval);
      this.timelineInterval = null;
    }
  }

  private applyTimelineFilter() {
    const cutoff = this.timelineCurrent();
    for (const entry of this.timelineMarkerMap) {
      const ts = entry.date.getTime();
      if (ts <= cutoff) {
        if (!this.map.hasLayer(entry.marker)) {
          this.fgAll.addLayer(entry.marker);
        }
      } else {
        if (this.map.hasLayer(entry.marker)) {
          this.fgAll.removeLayer(entry.marker);
        }
      }
    }
  }

  private updateTimelineLabel(timestamp: number) {
    const d = new Date(timestamp);
    const lang = this.currentUserLanguage;
    const locale = lang === 'fr' ? 'fr-FR' : lang === 'es' ? 'es-ES' : 'en-US';
    this.timelineLabel.set(d.toLocaleDateString(locale, { year: 'numeric', month: 'short' }));
  }

  // =====================================================
  // Seasonal Filter — filter sounds by season
  // =====================================================
  public toggleSeasonFilter(season: string) {
    if (this.zoneSeasonFilter() === season) {
      this.zoneSeasonFilter.set(null);
      // Show all markers
      for (const entry of this.timelineMarkerMap) {
        if (!this.map.hasLayer(entry.marker)) {
          this.fgAll.addLayer(entry.marker);
        }
      }
      return;
    }

    this.zoneSeasonFilter.set(season);
    this.applySeasonFilter(season);
  }

  private applySeasonFilter(season: string) {
    for (const entry of this.timelineMarkerMap) {
      const month = entry.date.getMonth(); // 0-11
      const inSeason = this.isInSeason(month, season);
      if (inSeason) {
        if (!this.map.hasLayer(entry.marker)) {
          this.fgAll.addLayer(entry.marker);
        }
      } else {
        if (this.map.hasLayer(entry.marker)) {
          this.fgAll.removeLayer(entry.marker);
        }
      }
    }
  }

  private isInSeason(month: number, season: string): boolean {
    switch (season) {
      case 'spring': return month >= 2 && month <= 4;   // Mar-May
      case 'summer': return month >= 5 && month <= 7;   // Jun-Aug
      case 'autumn': return month >= 8 && month <= 10;  // Sep-Nov
      case 'winter': return month <= 1 || month === 11;  // Dec-Feb
      default: return true;
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
    // Dismiss any open bottom sheet to prevent it persisting after navigation
    this.activeSheetRef?.dismiss();
    this.activeSheetRef = null;
    this.bottomSheet.dismiss();

    this.activePopupPlayer?.destroy();
    this.activePopupPlayer = null;

    if (this.minimapControl) {
      this.minimapControl.remove();
      this.minimapControl = null;
      this.minimapTileLayer = null;
    }

    this.stopTimeline();
    this.ambientAudio.destroy();
    this.queryParamsSub?.unsubscribe();
    this.map?.remove();
  }
}
