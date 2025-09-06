import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import L, { icon, latLng, marker } from 'leaflet';
import { AmplifyService } from '../../../../core/services/amplify.service';
import { CategoryKey } from '../../../../../../amplify/data/categories';
import { Sound } from '../../../../core/models/sound.model';
import { SoundsService } from '../../../../core/services/sounds.service';

@Component({
  selector: 'app-mapfly',
  standalone: true,
  templateUrl: './mapfly.component.html',
  styleUrls: ['./mapfly.component.scss'],
})
export class MapflyComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly amplifyService = inject(AmplifyService);
  private readonly soundsService = inject(SoundsService);

  map!: L.Map;

  async ngOnInit() {
    // Initialiser la carte
    this.map = L.map('map', {
      center: latLng(46.5, 2.5), // France
      zoom: 5,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(this.map);

    // récupérer query params
    const userId = this.route.snapshot.queryParamMap.get('userId') ?? undefined;
    const category = this.route.snapshot.queryParamMap.get('category') as
      | CategoryKey
      | undefined;

    const { data, errors } =
      await this.amplifyService.client.queries.listSoundsForMap({
        userId,
        category,
      });

    if (errors?.length) {
      console.error('Erreur listSoundsForMap', errors);
      return;
    }

    const sounds: Sound[] = (data ?? []).map((raw) =>
      this.soundsService.map(raw),
    );

        sounds
      .filter((s) => s.latitude !== undefined && s.longitude !== undefined)
      .forEach((s) => {
        const catTronquee = s.secondaryCategory
          ? s.secondaryCategory.slice(0, -3)
          : 'default';

        marker([s.latitude!, s.longitude!], {
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
        })
          .bindPopup(`<b>${s.title}</b><br>${s.filename}`)
          .addTo(this.map);
      });
  }

}
