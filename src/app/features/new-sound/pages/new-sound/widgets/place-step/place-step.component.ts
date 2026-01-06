import {
  Component,
  EventEmitter,
  Output,
  AfterViewInit,
  OnDestroy,
  ViewEncapsulation,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';
import 'leaflet-search';
import { GeoSearchControl, OpenStreetMapProvider } from 'leaflet-geosearch';
import { environment } from '../../../../../../../environments/environment';
import { TranslateService } from '@ngx-translate/core';
import { GeoSearchService } from '../../../../../../core/services/geo-search.service';

export interface PlaceSelection {
  lat: number;
  lng: number;
  name?: string;
}

@Component({
  selector: 'app-place-step',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './place-step.component.html',
  styleUrl: './place-step.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class PlaceStepComponent implements AfterViewInit, OnDestroy {
  @Output() placeSelected = new EventEmitter<PlaceSelection>();

  private map!: L.Map;
  private marker!: L.Marker;

  private currentPlaceName?: string;

  private translateService = inject(TranslateService);
  private geoSearchService = inject(GeoSearchService);

  private searchControl!: ReturnType<typeof GeoSearchControl>;

  ngAfterViewInit() {
    this.initMap();
    this.initSearch();
    this.initCenterTracking();
    // Ajoute GeoSearch avec callback
    this.geoSearchService.addSearchControl(this.map, (lat, lng, label) => {
      this.marker.setLatLng([lat, lng]);
      this.map.setView([lat, lng], 16);
      console.log('Lieu sélectionné :', lat, lng, label);
    });
  }

  ngOnDestroy() {
    this.map?.remove();
  }

  // --------------------
  // Map initialization
  // --------------------
  private initMap() {
    this.map = L.map('map-newsound', {
      center: [48.8566, 2.3522], // default Paris
      zoom: 13,
    });

    L.tileLayer(
      `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v9/tiles/256/{z}/{x}/{y}?access_token=${environment.mapboxToken}`,
      {
        attribution: '© Mapbox © OpenStreetMap © Esri — Satellite & Streets',
        maxZoom: 21,
        maxNativeZoom: 19,
      },
    ).addTo(this.map);

    // Marker centered
    this.marker = L.marker(this.map.getCenter(), {
      draggable: true,
    }).addTo(this.map);

    // When we move manually the marker
    this.marker.on('dragend', () => {
      const position = this.marker.getLatLng();
      this.map.panTo(position);
      this.emitPlace(position.lat, position.lng);
    });
  }

  // --------------------
  // GeoSearch
  // --------------------
  private initSearch() {
    // const provider = new OpenStreetMapProvider();

    // this.createSearchControl(provider);

    // // Écoute le changement de langue
    // this.translateService.onLangChange.subscribe(() => {
    //   this.map.removeControl(this.searchControl);

    //   // Crée un nouveau contrôle avec la nouvelle langue
    //   this.createSearchControl(provider);
    // });

    // this.map.addControl(this.searchControl);

    // // Event on search result selection
    // // eslint-disable-next-line @typescript-eslint/no-explicit-any
    // this.map.on('geosearch/showlocation', (result: any) => {
    //   const { x, y, label } = result.location;

    //   this.currentPlaceName = label;

    //   this.map.setView([y, x], 16);
    //   this.marker.setLatLng([y, x]);

    //   this.emitPlace(y, x, label);
    // });
  }

  // --------------------
  // Marker always centered
  // --------------------
  private initCenterTracking() {
    this.map.on('move', () => {
      const center = this.map.getCenter();
      this.marker.setLatLng(center);
    });

    this.map.on('moveend', () => {
      const center = this.map.getCenter();
      this.emitPlace(center.lat, center.lng);
    });
  }

  // --------------------
  // Emit selection
  // --------------------
  private emitPlace(lat: number, lng: number, name?: string) {
    this.placeSelected.emit({
      lat,
      lng,
      name: name ?? this.currentPlaceName,
    });
  }

  private createSearchControl(provider: OpenStreetMapProvider) {
    const placeholder = this.translateService.instant(
      'new-sound.stepper.place-placeholder',
    );

    this.searchControl = GeoSearchControl({
      provider,
      showMarker: false,
      showPopup: false,
      searchLabel: placeholder,
    });

    this.map.addControl(this.searchControl);
  }
}
