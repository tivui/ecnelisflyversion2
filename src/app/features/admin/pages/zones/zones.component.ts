import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { TranslateModule, TranslateService } from '@ngx-translate/core';


import { ZoneService } from '../../../../core/services/zone.service';
import { Zone } from '../../../../core/models/zone.model';
import { ZoneDialogComponent } from './zone-dialog/zone-dialog.component';
import { ZoneSoundsDialogComponent } from './zone-sounds-dialog/zone-sounds-dialog.component';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
    selector: 'app-zones',
    imports: [
        CommonModule,
        MatTableModule,
        MatButtonModule,
        MatIconModule,
        MatTooltipModule,
        MatDialogModule,
        MatSnackBarModule,
        MatProgressSpinnerModule,
        MatChipsModule,
        TranslateModule,
    ],
    templateUrl: './zones.component.html',
    styleUrl: './zones.component.scss'
})
export class ZonesComponent implements OnInit {
  private readonly zoneService = inject(ZoneService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);

  zones = signal<Zone[]>([]);
  loading = signal(true);
  displayedColumns = ['name', 'slug', 'isPublic', 'sortOrder', 'actions'];

  ngOnInit() {
    this.loadZones();
  }

  async loadZones() {
    this.loading.set(true);
    try {
      const zones = await this.zoneService.listZones();
      this.zones.set(zones.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)));
    } catch (error) {
      console.error('Error loading zones:', error);
      this.snackBar.open(
        this.translate.instant('admin.zones.loadError'),
        this.translate.instant('common.action.cancel'),
        { duration: 3000 }
      );
    } finally {
      this.loading.set(false);
    }
  }

  openCreateDialog() {
    const dialogRef = this.dialog.open(ZoneDialogComponent, {
      width: '90vw',
      maxWidth: '900px',
      maxHeight: '90vh',
      data: { zone: null },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.loadZones();
      }
    });
  }

  openEditDialog(zone: Zone) {
    const dialogRef = this.dialog.open(ZoneDialogComponent, {
      width: '90vw',
      maxWidth: '900px',
      maxHeight: '90vh',
      data: { zone },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.loadZones();
      }
    });
  }

  openSoundsDialog(zone: Zone) {
    const dialogRef = this.dialog.open(ZoneSoundsDialogComponent, {
      width: '90vw',
      maxWidth: '800px',
      maxHeight: '90vh',
      data: { zone },
    });

    dialogRef.afterClosed().subscribe(() => {
      // No need to reload zones, just sounds association
    });
  }

  async deleteZone(zone: Zone) {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: this.translate.instant('admin.zones.delete.title'),
        message: this.translate.instant('admin.zones.delete.message', {
          name: zone.name,
        }),
        confirmText: this.translate.instant('admin.zones.delete.confirm'),
        cancelText: this.translate.instant('common.action.cancel'),
      },
    });

    dialogRef.afterClosed().subscribe(async (confirmed) => {
      if (confirmed) {
        try {
          await this.zoneService.deleteZone(zone.id!);
          this.snackBar.open(
            this.translate.instant('admin.zones.delete.success'),
            '',
            { duration: 3000 }
          );
          this.loadZones();
        } catch (error) {
          console.error('Error deleting zone:', error);
          this.snackBar.open(
            this.translate.instant('admin.zones.delete.error'),
            '',
            { duration: 3000 }
          );
        }
      }
    });
  }

  async setAsMonthly(zone: Zone) {
    try {
      await this.zoneService.setMonthlyZone(zone);
      this.snackBar.open(
        this.translate.instant('admin.zones.monthlySet'),
        '',
        { duration: 3000 },
      );
    } catch (error) {
      console.error('Error setting monthly zone:', error);
    }
  }

  viewOnMap(zone: Zone) {
    window.open(`/mapfly?zoneId=${zone.id}`, '_blank');
  }

  getLocalizedName(zone: Zone): string {
    const lang = this.translate.currentLang;
    if (zone.name_i18n && zone.name_i18n[lang]) {
      return zone.name_i18n[lang];
    }
    return zone.name;
  }
}
