import {
  Component,
  inject,
  signal,
  OnInit,
  AfterViewInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  ChangeDetectorRef,
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
  private mapContainerElement: ElementRef | null = null;
  private initMapRetryCount = 0;
  private readonly MAX_INIT_RETRIES = 10;

  @ViewChild('mapContainer', { static: false })
  set mapContainer(element: ElementRef | undefined) {
    if (element) {
      this.mapContainerElement = element;
      // Initialize map when the container becomes available and tab is active
      if (this.selectedTabIndex() === 2 && !this.mapInitialized) {
        this.tryInitMap();
      }
    }
  }

  get mapContainerRef(): ElementRef | null {
    return this.mapContainerElement;
  }

  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<ZoneDialogComponent>);
  private readonly data: DialogData = inject(MAT_DIALOG_DATA);
  private readonly zoneService = inject(ZoneService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);
  private readonly cdr = inject(ChangeDetectorRef);

  form!: FormGroup;
  saving = signal(false);
  isEditMode = signal(false);
  selectedTabIndex = signal(0);
  private mapInitialized = false;

  private map!: L.Map;
  private drawnPolygon: L.Polygon | null = null;
  private drawingMode = signal(false);
  private editingMode = signal(false);
  private drawingPoints: L.LatLng[] = [];
  private drawingMarkers: L.CircleMarker[] = [];
  private editMarkers: L.Marker[] = [];
  private midpointMarkers: L.Marker[] = [];
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
    // Map will be initialized when tab is selected
  }

  onTabChange(index: number) {
    this.selectedTabIndex.set(index);

    // If map tab is selected (index 2), initialize or refresh the map
    if (index === 2) {
      this.cdr.detectChanges();
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        if (!this.mapInitialized) {
          this.tryInitMap();
        } else if (this.map) {
          this.map.invalidateSize();
        }
      });
    }
  }

  private tryInitMap() {
    if (this.mapInitialized) return;

    const container = this.mapContainerElement?.nativeElement;
    if (!container) {
      // Retry if container not yet available
      if (this.initMapRetryCount < this.MAX_INIT_RETRIES) {
        this.initMapRetryCount++;
        setTimeout(() => this.tryInitMap(), 50);
      }
      return;
    }

    // Check if container has dimensions (is visible)
    const rect = container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      // Container not yet sized, retry
      if (this.initMapRetryCount < this.MAX_INIT_RETRIES) {
        this.initMapRetryCount++;
        setTimeout(() => this.tryInitMap(), 50);
      }
      return;
    }

    // Container is ready, initialize map
    this.initMap();
  }

  ngOnDestroy() {
    if (this.map) {
      this.map.remove();
    }
  }

  private initMap() {
    if (!this.mapContainerElement?.nativeElement || this.mapInitialized) {
      return;
    }

    this.mapInitialized = true;

    const center = this.data.zone?.center
      ? L.latLng(this.data.zone.center.lat, this.data.zone.center.lng)
      : L.latLng(46.603354, 1.888334); // France center

    const zoom = this.data.zone?.defaultZoom ?? 6;

    this.map = L.map(this.mapContainerElement.nativeElement, {
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

    // Multiple invalidateSize calls to ensure proper rendering in dialog
    setTimeout(() => this.map.invalidateSize(), 100);
    setTimeout(() => this.map.invalidateSize(), 300);
    setTimeout(() => this.map.invalidateSize(), 500);
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

  editPolygon() {
    // Enable editing mode with draggable markers on existing polygon
    if (this.polygon() && this.drawnPolygon) {
      this.editingMode.set(true);
      this.createEditableMarkers();
      this.snackBar.open(
        this.translate.instant('admin.zones.dialog.editDragHint'),
        '',
        { duration: 5000 }
      );
    }
  }

  redrawPolygon() {
    // Clear existing polygon and start fresh drawing
    if (this.polygon() && this.drawnPolygon) {
      this.drawnPolygon.setStyle({ opacity: 0.3, fillOpacity: 0.1 });
    }
    this.clearEditMarkers();
    this.editingMode.set(false);
    this.drawingMode.set(true);
    this.drawingPoints = [];
    this.snackBar.open(
      this.translate.instant('admin.zones.dialog.editHint'),
      '',
      { duration: 5000 }
    );
  }

  private createEditableMarkers() {
    const polygon = this.polygon();
    if (!polygon) return;

    const color = this.form.get('color')?.value ?? '#1976d2';
    const coords = polygon.coordinates[0];

    // Remove last point (it's the closing point, same as first)
    const uniqueCoords = coords.slice(0, -1);

    // Create vertex markers
    uniqueCoords.forEach((coord) => {
      const latlng = L.latLng(coord[1], coord[0]);
      this.createVertexMarker(latlng, color);
    });

    // Create midpoint markers between vertices
    this.createMidpointMarkers(color);
  }

  private createVertexMarker(latlng: L.LatLng, color: string): L.Marker {
    const marker = L.marker(latlng, {
      draggable: true,
      icon: L.divIcon({
        className: 'edit-polygon-marker vertex-marker',
        html: `<div style="
          width: 16px;
          height: 16px;
          background-color: ${color};
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 6px rgba(0,0,0,0.4);
          cursor: grab;
        "></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      }),
    }).addTo(this.map);

    marker.on('drag', () => {
      this.updatePolygonFromMarkers();
      this.updateMidpointPositions();
    });
    marker.on('dragend', () => {
      this.updatePolygonFromMarkers();
      this.updateMidpointPositions();
    });

    this.editMarkers.push(marker);
    return marker;
  }

  private createMidpointMarkers(color: string) {
    // Clear existing midpoint markers
    this.midpointMarkers.forEach((m) => this.map.removeLayer(m));
    this.midpointMarkers = [];

    const vertices = this.editMarkers;
    if (vertices.length < 2) return;

    for (let i = 0; i < vertices.length; i++) {
      const current = vertices[i].getLatLng();
      const next = vertices[(i + 1) % vertices.length].getLatLng();
      const midLat = (current.lat + next.lat) / 2;
      const midLng = (current.lng + next.lng) / 2;
      const midpoint = L.latLng(midLat, midLng);

      const midMarker = L.marker(midpoint, {
        draggable: true,
        icon: L.divIcon({
          className: 'edit-polygon-marker midpoint-marker',
          html: `<div style="
            width: 12px;
            height: 12px;
            background-color: white;
            border: 2px solid ${color};
            border-radius: 50%;
            box-shadow: 0 1px 4px rgba(0,0,0,0.3);
            cursor: pointer;
            opacity: 0.8;
          "></div>`,
          iconSize: [12, 12],
          iconAnchor: [6, 6],
        }),
      }).addTo(this.map);

      // Store the index for insertion
      (midMarker as any)._insertAfterIndex = i;

      midMarker.on('dragstart', () => {
        // Convert midpoint to vertex on drag start
        this.convertMidpointToVertex(midMarker as L.Marker, color);
      });

      this.midpointMarkers.push(midMarker);
    }
  }

  private convertMidpointToVertex(midMarker: L.Marker, color: string) {
    const insertAfterIndex = (midMarker as any)._insertAfterIndex;
    const latlng = midMarker.getLatLng();

    // Remove the midpoint marker
    this.map.removeLayer(midMarker);
    this.midpointMarkers = this.midpointMarkers.filter((m) => m !== midMarker);

    // Create a new vertex marker at this position
    const newVertex = L.marker(latlng, {
      draggable: true,
      icon: L.divIcon({
        className: 'edit-polygon-marker vertex-marker',
        html: `<div style="
          width: 16px;
          height: 16px;
          background-color: ${color};
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 6px rgba(0,0,0,0.4);
          cursor: grab;
        "></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      }),
    }).addTo(this.map);

    newVertex.on('drag', () => {
      this.updatePolygonFromMarkers();
      this.updateMidpointPositions();
    });
    newVertex.on('dragend', () => {
      this.updatePolygonFromMarkers();
      this.updateMidpointPositions();
    });

    // Insert at the correct position
    this.editMarkers.splice(insertAfterIndex + 1, 0, newVertex);

    // Update polygon and recreate midpoints
    this.updatePolygonFromMarkers();
    this.createMidpointMarkers(color);
  }

  private updateMidpointPositions() {
    const vertices = this.editMarkers;
    if (vertices.length < 2 || this.midpointMarkers.length === 0) return;

    for (let i = 0; i < this.midpointMarkers.length; i++) {
      const current = vertices[i].getLatLng();
      const next = vertices[(i + 1) % vertices.length].getLatLng();
      const midLat = (current.lat + next.lat) / 2;
      const midLng = (current.lng + next.lng) / 2;
      this.midpointMarkers[i].setLatLng(L.latLng(midLat, midLng));
    }
  }

  private updatePolygonFromMarkers() {
    if (this.editMarkers.length < 3) return;

    const newLatLngs = this.editMarkers.map((m) => m.getLatLng());

    // Update drawn polygon
    if (this.drawnPolygon) {
      this.drawnPolygon.setLatLngs(newLatLngs);
    }

    // Update polygon signal
    const coordinates = newLatLngs.map((p) => [p.lng, p.lat]);
    coordinates.push(coordinates[0]); // Close the polygon

    this.polygon.set({
      type: 'Polygon',
      coordinates: [coordinates],
    });
  }

  finishEditing() {
    this.editingMode.set(false);
    this.clearEditMarkers();

    // Make sure polygon is fully opaque
    if (this.drawnPolygon) {
      this.drawnPolygon.setStyle({ opacity: 1, fillOpacity: 0.3 });
    }

    this.snackBar.open(
      this.translate.instant('admin.zones.dialog.polygonUpdated'),
      '',
      { duration: 3000 }
    );
  }

  cancelEditing() {
    this.editingMode.set(false);
    this.clearEditMarkers();

    // Restore original polygon from data
    if (this.data.zone?.polygon) {
      this.polygon.set(this.data.zone.polygon);
      if (this.drawnPolygon) {
        this.map.removeLayer(this.drawnPolygon);
      }
      this.drawExistingPolygon(this.data.zone.polygon);
    }
  }

  private clearEditMarkers() {
    this.editMarkers.forEach((m) => this.map.removeLayer(m));
    this.editMarkers = [];
    this.midpointMarkers.forEach((m) => this.map.removeLayer(m));
    this.midpointMarkers = [];
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

    // Remove old polygon if exists
    if (this.drawnPolygon) {
      this.map.removeLayer(this.drawnPolygon);
      this.drawnPolygon = null;
    }

    // Create new polygon
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

    // Restore original polygon opacity if it was being edited
    if (this.drawnPolygon && this.polygon()) {
      this.drawnPolygon.setStyle({ opacity: 1, fillOpacity: 0.3 });
    }
  }

  clearPolygon() {
    if (this.drawnPolygon) {
      this.map.removeLayer(this.drawnPolygon);
      this.drawnPolygon = null;
    }
    this.polygon.set(null);
    this.clearEditMarkers();
    this.editingMode.set(false);
    this.cancelDrawing();
  }

  isDrawing() {
    return this.drawingMode();
  }

  isEditing() {
    return this.editingMode();
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
