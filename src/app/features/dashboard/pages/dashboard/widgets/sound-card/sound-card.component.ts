import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { Sound, SoundStatus } from '../../../../../../core/models/sound.model';

@Component({
  selector: 'app-sound-card',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatMenuModule,
    MatTooltipModule,
    TranslateModule,
  ],
  templateUrl: './sound-card.component.html',
  styleUrl: './sound-card.component.scss',
})
export class SoundCardComponent {
  private readonly translate = inject(TranslateService);

  @Input({ required: true }) sound!: Sound;
  @Input() isPlaying = false;
  @Input() showUser = false;

  @Output() edit = new EventEmitter<Sound>();
  @Output() delete = new EventEmitter<Sound>();
  @Output() play = new EventEmitter<Sound>();
  @Output() stop = new EventEmitter<void>();
  @Output() viewOnMap = new EventEmitter<Sound>();

  get currentLang(): string {
    return this.translate.currentLang || 'fr';
  }

  get displayTitle(): string {
    return this.sound.title_i18n?.[this.currentLang] || this.sound.title || '';
  }

  get displayCategory(): string {
    if (!this.sound.category) return '';
    const key = this.sound.secondaryCategory
      ? `categories.${this.sound.category}.${this.sound.secondaryCategory}`
      : `categories.${this.sound.category}`;
    const translated = this.translate.instant(key);
    return translated !== key ? translated : this.sound.category;
  }

  get statusClass(): string {
    return `status-${this.sound.status || 'unknown'}`;
  }

  get statusText(): string {
    if (!this.sound.status) return '';
    return this.translate.instant(`dashboard.status.${this.sound.status}`);
  }

  formatDate(date: Date | undefined): string {
    if (!date) return '';
    return new Intl.DateTimeFormat(this.currentLang, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  }

  onPlayClick() {
    if (this.isPlaying) {
      this.stop.emit();
    } else {
      this.play.emit(this.sound);
    }
  }

  onEditClick() {
    this.edit.emit(this.sound);
  }

  onDeleteClick() {
    this.delete.emit(this.sound);
  }

  onViewOnMapClick() {
    this.viewOnMap.emit(this.sound);
  }
}
