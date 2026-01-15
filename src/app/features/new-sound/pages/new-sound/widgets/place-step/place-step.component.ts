import {
  Component,
  EventEmitter,
  Output,
  AfterViewInit,
  OnDestroy,
  ViewEncapsulation,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';
import 'leaflet-search';
import { environment } from '../../../../../../../environments/environment';
import { TranslatePipe } from '@ngx-translate/core';
import { GeoSearchService } from '../../../../../../core/services/geo-search.service';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

export interface PlaceSelection {
  lat: number;
  lng: number;
  name?: string;
}

@Component({
  selector: 'app-place-step',
  standalone: true,
  imports: [CommonModule, MatFormFieldModule, MatInputModule, TranslatePipe],
  templateUrl: './place-step.component.html',
  styleUrl: './place-step.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class PlaceStepComponent implements AfterViewInit, OnDestroy {
  @Output() placeSelected = new EventEmitter<PlaceSelection>();

  private map!: L.Map;
  private marker!: L.Marker;

  private geoSearchService = inject(GeoSearchService);

  nameSelection = signal<string>('');

  ngAfterViewInit() {
    this.initMap();
    this.initCenterTracking();
    // Ajoute GeoSearch avec callback
    this.geoSearchService.addSearchControl(this.map, (lat, lng, label) => {
      this.marker.setLatLng([lat, lng]);
      this.map.setView([lat, lng], 16);
      if (label) {
        this.nameSelection.set(label); // ✅ valeur par défaut dans l'input
      }
      this.emitPlace(lat, lng);
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
  private emitPlace(lat: number, lng: number) {
    this.placeSelected.emit({
      lat,
      lng,
      name: this.nameSelection().trim() || undefined,
    });
  }
}
