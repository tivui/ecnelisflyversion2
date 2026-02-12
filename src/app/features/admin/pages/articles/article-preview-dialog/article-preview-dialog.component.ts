import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { ArticleService } from '../../../../articles/services/article.service';
import { SoundsService } from '../../../../../core/services/sounds.service';
import { SoundArticle, ArticleBlock } from '../../../../articles/models/article.model';
import { SafeHtmlPipe } from '../../../../../shared/pipes/safe-html.pipe';

interface SoundPlayerState {
  url: string;
  title: string;
  playing: boolean;
  progress: number;
  duration: number;
}

export interface ArticlePreviewDialogData {
  article: SoundArticle;
  blocks: ArticleBlock[];
}

@Component({
  selector: 'app-article-preview-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslateModule,
    SafeHtmlPipe,
  ],
  templateUrl: './article-preview-dialog.component.html',
  styleUrl: './article-preview-dialog.component.scss',
})
export class ArticlePreviewDialogComponent implements OnInit, OnDestroy {
  private readonly dialogRef = inject(MatDialogRef<ArticlePreviewDialogComponent>);
  private readonly data = inject<ArticlePreviewDialogData>(MAT_DIALOG_DATA);
  private readonly articleService = inject(ArticleService);
  private readonly soundsService = inject(SoundsService);
  private readonly translate = inject(TranslateService);

  article = signal<SoundArticle>(this.data.article);
  blocks = signal<ArticleBlock[]>(this.data.blocks);
  previewLang = signal(this.translate.currentLang || 'fr');
  loadingMedia = signal(true);

  coverUrl = signal<string | null>(null);
  imageUrls = signal<Record<string, string>>({});
  soundPlayers = signal<Record<string, SoundPlayerState>>({});

  private audioElements: Record<string, HTMLAudioElement> = {};

  readonly languages = ['fr', 'en', 'es'];

  headings = computed(() =>
    this.blocks()
      .filter((b) => b.type === 'heading')
      .map((b) => ({
        id: `preview-block-${b.id}`,
        text: this.getLocalizedContent(b),
        level: b.settings?.level ?? 2,
      })),
  );

  async ngOnInit() {
    const article = this.article();
    const blocks = this.blocks();

    // Load cover image
    if (article.coverImageKey) {
      try {
        const url = await this.articleService.getImageUrl(article.coverImageKey);
        this.coverUrl.set(url);
      } catch {
        // ignore
      }
    }

    // Load block images and sounds
    await this.loadBlockMedia(blocks);
    this.loadingMedia.set(false);
  }

  ngOnDestroy() {
    for (const audio of Object.values(this.audioElements)) {
      audio.pause();
      audio.src = '';
    }
  }

  private async loadBlockMedia(blocks: ArticleBlock[]) {
    const urls: Record<string, string> = {};

    for (const block of blocks) {
      if (block.type === 'image' && block.imageKey) {
        try {
          urls[block.id] = await this.articleService.getImageUrl(block.imageKey);
        } catch {
          // ignore
        }
      }
      if (block.type === 'sound' && block.soundId) {
        try {
          const sound = await this.soundsService.getSoundById(block.soundId);
          if (sound) {
            const audioUrl = await this.soundsService.getAudioUrl(sound);
            this.soundPlayers.update((p) => ({
              ...p,
              [block.id]: {
                url: audioUrl,
                title: sound.title ?? block.soundCaption ?? '',
                playing: false,
                progress: 0,
                duration: 0,
              },
            }));
          }
        } catch {
          // ignore
        }
      }
    }

    this.imageUrls.set(urls);
  }

  // ============ LANGUAGE ============

  setPreviewLang(lang: string) {
    this.previewLang.set(lang);
  }

  // ============ LOCALIZATION (uses previewLang instead of translate.currentLang) ============

  getLocalizedArticleTitle(): string {
    const a = this.article();
    const lang = this.previewLang();
    if (a.title_i18n && a.title_i18n[lang]) return a.title_i18n[lang];
    return a.title;
  }

  getLocalizedArticleDescription(): string {
    const a = this.article();
    if (!a?.description) return '';
    const lang = this.previewLang();
    if (a.description_i18n && a.description_i18n[lang])
      return a.description_i18n[lang];
    return a.description;
  }

  getLocalizedContent(block: ArticleBlock): string {
    const lang = this.previewLang();
    if (block.content_i18n && block.content_i18n[lang])
      return block.content_i18n[lang];
    return block.content ?? '';
  }

  getLocalizedCaption(block: ArticleBlock): string {
    const lang = this.previewLang();
    if (block.type === 'sound') {
      if (block.soundCaption_i18n && block.soundCaption_i18n[lang])
        return block.soundCaption_i18n[lang];
      return block.soundCaption ?? '';
    }
    if (block.type === 'image') {
      if (block.imageCaption_i18n && block.imageCaption_i18n[lang])
        return block.imageCaption_i18n[lang];
      return block.imageCaption ?? '';
    }
    return '';
  }

  getLocalizedAlt(block: ArticleBlock): string {
    const lang = this.previewLang();
    if (block.imageAlt_i18n && block.imageAlt_i18n[lang])
      return block.imageAlt_i18n[lang];
    return block.imageAlt ?? '';
  }

  // ============ SOUND PLAYER ============

  togglePlay(blockId: string) {
    const player = this.soundPlayers()[blockId];
    if (!player) return;

    if (!this.audioElements[blockId]) {
      const audio = new Audio(player.url);
      audio.addEventListener('timeupdate', () => {
        this.soundPlayers.update((p) => ({
          ...p,
          [blockId]: {
            ...p[blockId],
            progress: audio.currentTime,
            duration: audio.duration || 0,
          },
        }));
      });
      audio.addEventListener('ended', () => {
        this.soundPlayers.update((p) => ({
          ...p,
          [blockId]: { ...p[blockId], playing: false, progress: 0 },
        }));
      });
      this.audioElements[blockId] = audio;
    }

    const audio = this.audioElements[blockId];

    if (player.playing) {
      audio.pause();
    } else {
      for (const [id, a] of Object.entries(this.audioElements)) {
        if (id !== blockId) {
          a.pause();
          this.soundPlayers.update((p) => ({
            ...p,
            [id]: { ...p[id], playing: false },
          }));
        }
      }
      audio.play().catch(() => {});
    }

    this.soundPlayers.update((p) => ({
      ...p,
      [blockId]: { ...p[blockId], playing: !player.playing },
    }));
  }

  seekSound(blockId: string, event: MouseEvent) {
    const audio = this.audioElements[blockId];
    const player = this.soundPlayers()[blockId];
    if (!audio || !player?.duration) return;

    const bar = event.currentTarget as HTMLElement;
    const rect = bar.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    audio.currentTime = ratio * player.duration;
  }

  formatTime(seconds: number): string {
    if (!seconds || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  getProgress(blockId: string): number {
    const player = this.soundPlayers()[blockId];
    if (!player?.duration) return 0;
    return (player.progress / player.duration) * 100;
  }

  // ============ IMAGE HELPERS ============

  getImageUrl(blockId: string): string | null {
    return this.imageUrls()[blockId] ?? null;
  }

  getImageWidthStyle(block: ArticleBlock): string {
    const w = block.settings?.imageWidth;
    if (w) return `max-width: ${w}%`;
    switch (block.settings?.size) {
      case 'small': return 'max-width: 50%';
      case 'medium': return 'max-width: 80%';
      default: return 'max-width: 100%';
    }
  }

  getImageAlignClass(block: ArticleBlock): string {
    return 'align-' + (block.settings?.align ?? 'center');
  }

  // ============ VARIANT HELPERS ============

  isRichText(block: ArticleBlock): boolean {
    return block.settings?.richText === true
      || /<[a-z][\s\S]*>/i.test(this.getLocalizedContent(block));
  }

  isSeparator(block: ArticleBlock): boolean {
    return !!block.settings?.variant?.startsWith('separator');
  }

  isList(block: ArticleBlock): boolean {
    const v = block.settings?.variant;
    return v === 'list-bullet' || v === 'list-ordered';
  }

  getListItems(block: ArticleBlock): string[] {
    const text = this.getLocalizedContent(block);
    return text.split('\n').filter(l => l.trim());
  }

  getTextAlignStyle(block: ArticleBlock): string {
    const align = block.settings?.align;
    return align && align !== 'left' ? `text-align: ${align}` : '';
  }

  getAttribution(block: ArticleBlock): string {
    return block.settings?.attribution ?? '';
  }

  // ============ ACTIONS ============

  close() {
    this.dialogRef.close();
  }

  scrollToBlock(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }
}
