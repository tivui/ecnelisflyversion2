import { Component, inject, Input, signal, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateService } from '@ngx-translate/core';

import { LikeService } from '../../../core/services/like.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-like-button',
  standalone: true,
  imports: [CommonModule, MatTooltipModule],
  templateUrl: './like-button.component.html',
  styleUrl: './like-button.component.scss',
})
export class LikeButtonComponent implements OnInit, OnChanges {
  private readonly likeService = inject(LikeService);
  private readonly authService = inject(AuthService);
  private readonly translate = inject(TranslateService);

  @Input({ required: true }) soundId!: string;
  @Input() likesCount = 0;

  displayCount = signal(0);
  animating = signal(false);

  ngOnInit() {
    this.displayCount.set(this.likesCount);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['likesCount'] && !changes['likesCount'].firstChange) {
      this.displayCount.set(this.likesCount);
    }
  }

  get isAuthenticated(): boolean {
    return !!this.authService.user();
  }

  get isLiked(): boolean {
    return this.likeService.isLiked(this.soundId);
  }

  get tooltip(): string {
    if (!this.isAuthenticated) {
      return this.translate.instant('likes.login_required');
    }
    return '';
  }

  async onToggle() {
    if (!this.isAuthenticated) return;
    if (this.likeService.isProcessing(this.soundId)) return;

    // Trigger animation
    this.animating.set(true);
    setTimeout(() => this.animating.set(false), 300);

    const result = await this.likeService.toggleLike(this.soundId, this.displayCount());
    if (result) {
      this.displayCount.set(result.newCount);
    }
  }
}
