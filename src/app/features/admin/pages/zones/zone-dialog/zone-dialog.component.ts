import {
  Component,
  inject,
  signal,
  OnInit,
  AfterViewInit,
  OnDestroy,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import * as L from 'leaflet';

import { ZoneService } from '../../../../../core/services/zone.service';
import { Zone, ZonePolygon } from '../../../../../core/models/zone.model';

interface DialogData {
  zone: Zone | null;
}

@Component({
  selector: 'app-zone-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSlideToggleModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    TranslateModule,
  ],
  templateUrl: './zone-dialog.component.html',
  styleUrl: './zone-dialog.component.scss',
})
export class ZoneDialogComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapContainer') mapContainer!: ElementRef;

  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<ZoneDialogComponent>);
  private readonly data: DialogData = inject(MAT_DIALOG_DATA);
  private readonly zoneService = inject(ZoneService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);

  form!: FormGroup;
  saving = signal(false);
  isEditMode = signal(false);

  private map!: L.Map;
  private drawnPolygon: L.Polygon | null = null;
  private drawingMode = signal(false);
  private drawingPoints: L.LatLng[] = [];
  private drawingMarkers: L.CircleMarker[] = [];
  private drawingPolyline: L.Polyline | null = null;

  polygon = signal<ZonePolygon | null>(null);

  ngOnInit() {
    this.isEditMode.set(!!this.data.zone);

    this.form = this.fb.group({
      name: [this.data.zone?.name ?? '', Validators.required],
      name_fr: [this.data.zone?.name_i18n?.['fr'] ?? ''],
      name_en: [this.data.zone?.name_i18n?.['en'] ?? ''],
      name_es: [this.data.zone?.name_i18n?.['es'] ?? ''],
      description: [this.data.zone?.description ?? ''],
      description_fr: [this.data.zone?.description_i18n?.['fr'] ?? ''],
      description_en: [this.data.zone?.description_i18n?.['en'] ?? ''],
      description_es: [this.data.zone?.description_i18n?.['es'] ?? ''],
      slug: [this.data.zone?.slug ?? '', Validators.required],
      color: [this.data.zone?.color ?? '#1976d2', Validators.required],
      defaultZoom: [this.data.zone?.defaultZoom ?? 12],
      isPublic: [this.data.zone?.isPublic ?? true],
      sortOrder: [this.data.zone?.sortOrder ?? 0],
    });

    if (this.data.zone?.polygon) {
      this.polygon.set(this.data.zone.polygon);
    }

    // Auto-generate slug from name
    this.form.get('name')?.valueChanges.subscribe((name) => {
      if (!this.isEditMode() && name) {
        const slug = this.zoneService.generateSlug(name);
        this.form.patchValue({ slug }, { emitEvent: false });
      }
    });
  }

  ngAfterViewInit() {
    setTimeout(() => this.initMap(), 100);
  }

  ngOnDestroy() {
    if (this.map) {
      this.map.remove();
    }
  }

  private initMap() {
    const center = this.data.zone?.center
      ? L.latLng(this.data.zone.center.lat, this.data.zone.center.lng)
      : L.latLng(46.603354, 1.888334); // France center

    const zoom = this.data.zone?.defaultZoom ?? 6;

    this.map = L.map(this.mapContainer.nativeElement, {
      center,
      zoom,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(this.map);

    // Load existing polygon if editing
    if (this.data.zone?.polygon) {
      this.drawExistingPolygon(this.data.zone.polygon);
    }

    // Map click handler for drawing
    this.map.on('click', (e: L.LeafletMouseEvent) => {
      if (this.drawingMode()) {
        this.addDrawingPoint(e.latlng);
      }
    });

    setTimeout(() => this.map.invalidateSize(), 200);
  }

  private drawExistingPolygon(polygon: ZonePolygon) {
    const coords = polygon.coordinates[0].map((c) => L.latLng(c[1], c[0]));
    this.drawnPolygon = L.polygon(coords, {
      color: this.form.get('color')?.value ?? '#1976d2',
      fillOpacity: 0.3,
    }).addTo(this.map);
    this.map.fitBounds(this.drawnPolygon.getBounds(), { padding: [20, 20] });
  }

  startDrawing() {
    this.clearPolygon();
    this.drawingMode.set(true);
    this.drawingPoints = [];
    this.snackBar.open(
      this.translate.instant('admin.zones.dialog.drawHint'),
      '',
      { duration: 5000 }
    );
  }

  private addDrawingPoint(latlng: L.LatLng) {
    this.drawingPoints.push(latlng);

    // Add marker
    const marker = L.circleMarker(latlng, {
      radius: 6,
      color: this.form.get('color')?.value ?? '#1976d2',
      fillColor: '#fff',
      fillOpacity: 1,
    }).addTo(this.map);
    this.drawingMarkers.push(marker);

    // Update polyline
    if (this.drawingPolyline) {
      this.map.removeLayer(this.drawingPolyline);
    }
    if (this.drawingPoints.length > 1) {
      this.drawingPolyline = L.polyline(this.drawingPoints, {
        color: this.form.get('color')?.value ?? '#1976d2',
        dashArray: '5, 5',
      }).addTo(this.map);
    }
  }

  finishDrawing() {
    if (this.drawingPoints.length < 3) {
      this.snackBar.open(
        this.translate.instant('admin.zones.dialog.minPoints'),
        '',
        { duration: 3000 }
      );
      return;
    }

    this.drawingMode.set(false);

    // Clear drawing helpers
    this.drawingMarkers.forEach((m) => this.map.removeLayer(m));
    this.drawingMarkers = [];
    if (this.drawingPolyline) {
      this.map.removeLayer(this.drawingPolyline);
      this.drawingPolyline = null;
    }

    // Create polygon
    const color = this.form.get('color')?.value ?? '#1976d2';
    this.drawnPolygon = L.polygon(this.drawingPoints, {
      color,
      fillOpacity: 0.3,
    }).addTo(this.map);

    // Convert to GeoJSON format
    const coordinates = this.drawingPoints.map((p) => [p.lng, p.lat]);
    coordinates.push(coordinates[0]); // Close the polygon

    this.polygon.set({
      type: 'Polygon',
      coordinates: [coordinates],
    });

    this.snackBar.open(
      this.translate.instant('admin.zones.dialog.polygonCreated'),
      '',
      { duration: 3000 }
    );
  }

  cancelDrawing() {
    this.drawingMode.set(false);
    this.drawingMarkers.forEach((m) => this.map.removeLayer(m));
    this.drawingMarkers = [];
    if (this.drawingPolyline) {
      this.map.removeLayer(this.drawingPolyline);
      this.drawingPolyline = null;
    }
    this.drawingPoints = [];
  }

  clearPolygon() {
    if (this.drawnPolygon) {
      this.map.removeLayer(this.drawnPolygon);
      this.drawnPolygon = null;
    }
    this.polygon.set(null);
    this.cancelDrawing();
  }

  isDrawing() {
    return this.drawingMode();
  }

  async save() {
    if (!this.form.valid) {
      this.snackBar.open(
        this.translate.instant('admin.zones.dialog.formInvalid'),
        '',
        { duration: 3000 }
      );
      return;
    }

    if (!this.polygon()) {
      this.snackBar.open(
        this.translate.instant('admin.zones.dialog.polygonRequired'),
        '',
        { duration: 3000 }
      );
      return;
    }

    this.saving.set(true);

    try {
      const formValue = this.form.value;
      const name_i18n: Record<string, string> = {};
      if (formValue.name_fr) name_i18n['fr'] = formValue.name_fr;
      if (formValue.name_en) name_i18n['en'] = formValue.name_en;
      if (formValue.name_es) name_i18n['es'] = formValue.name_es;

      const description_i18n: Record<string, string> = {};
      if (formValue.description_fr)
        description_i18n['fr'] = formValue.description_fr;
      if (formValue.description_en)
        description_i18n['en'] = formValue.description_en;
      if (formValue.description_es)
        description_i18n['es'] = formValue.description_es;

      const zoneData: Partial<Zone> = {
        name: formValue.name,
        name_i18n: Object.keys(name_i18n).length > 0 ? name_i18n : undefined,
        description: formValue.description,
        description_i18n:
          Object.keys(description_i18n).length > 0
            ? description_i18n
            : undefined,
        slug: formValue.slug,
        polygon: this.polygon()!,
        center: this.zoneService.calculateCenter(this.polygon()!),
        defaultZoom: formValue.defaultZoom,
        color: formValue.color,
        isPublic: formValue.isPublic,
        sortOrder: formValue.sortOrder,
      };

      if (this.isEditMode()) {
        await this.zoneService.updateZone(this.data.zone!.id!, zoneData);
        this.snackBar.open(
          this.translate.instant('admin.zones.dialog.updateSuccess'),
          '',
          { duration: 3000 }
        );
      } else {
        await this.zoneService.createZone(zoneData);
        this.snackBar.open(
          this.translate.instant('admin.zones.dialog.createSuccess'),
          '',
          { duration: 3000 }
        );
      }

      this.dialogRef.close(true);
    } catch (error) {
      console.error('Error saving zone:', error);
      this.snackBar.open(
        this.translate.instant('admin.zones.dialog.saveError'),
        '',
        { duration: 3000 }
      );
    } finally {
      this.saving.set(false);
    }
  }

  cancel() {
    this.dialogRef.close(false);
  }
}
