import { Injectable, inject } from '@angular/core';
import * as L from 'leaflet';
import { GeoSearchControl, OpenStreetMapProvider } from 'leaflet-geosearch';
import { TranslateService } from '@ngx-translate/core';

@Injectable({ providedIn: 'root' })
export class GeoSearchService {
  private currentControl?: ReturnType<typeof GeoSearchControl>;
  private translate = inject(TranslateService);

  /**
   * Ajoute un GeoSearchControl à la map avec placeholder traduit
   * Gère la suppression/recréation automatique lors du changement de langue
   */
  addSearchControl(map: L.Map, onLocationFound?: (lat: number, lng: number, label?: string) => void) {
    const provider = new OpenStreetMapProvider();

    const createControl = () => {
      const placeholder = this.translate.instant('new-sound.stepper.place-placeholder');

      const control = GeoSearchControl({
        provider,
        showMarker: false,
        showPopup: false,
        searchLabel: placeholder,
      });

      map.addControl(control);
      this.currentControl = control;

      // Événement quand un lieu est choisi
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map.on('geosearch/showlocation', (result: any) => {
        const { x, y, label } = result.location;
        onLocationFound?.(y, x, label);
      });
    };

    // Supprime l'ancien contrôle s'il existe
    if (this.currentControl) {
      map.removeControl(this.currentControl);
    }

    createControl();

    // Recréation au changement de langue
    this.translate.onLangChange.subscribe(() => {
      if (this.currentControl) {
        map.removeControl(this.currentControl);
      }
      createControl();
    });
  }
}
