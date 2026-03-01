import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import {
  MatDialogRef,
  MAT_DIALOG_DATA,
  MatDialogModule,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { MatChipInputEvent, MatChipsModule } from '@angular/material/chips';
import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { ArticleService } from '../../../../articles/services/article.service';
import {
  SoundArticle,
  ArticleStatus,
} from '../../../../articles/models/article.model';

interface DialogData {
  article: SoundArticle | null;
  calculatedReadingTime?: number;
}

@Component({
    selector: 'app-article-settings-dialog',
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatDialogModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatButtonModule,
        MatIconModule,
        MatSnackBarModule,
        MatProgressSpinnerModule,
        MatTabsModule,
        MatChipsModule,
        TranslateModule,
    ],
    templateUrl: './article-settings-dialog.component.html',
    styleUrl: './article-settings-dialog.component.scss'
})
export class ArticleSettingsDialogComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(
    MatDialogRef<ArticleSettingsDialogComponent>,
  );
  private readonly data: DialogData = inject(MAT_DIALOG_DATA);
  private readonly articleService = inject(ArticleService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);

  form!: FormGroup;
  saving = signal(false);
  isEditMode = signal(false);
  tags = signal<string[]>([]);
  coverPreviewUrl = signal<string | null>(null);
  uploadingCover = signal(false);
  calculatedReadingTime = signal<number | null>(null);

  statuses: ArticleStatus[] = ['draft', 'published', 'archived'];
  readonly separatorKeyCodes = [ENTER, COMMA] as const;

  ngOnInit() {
    const article = this.data.article;
    this.isEditMode.set(!!article);
    this.tags.set(article?.tags ?? []);

    this.form = this.fb.group({
      title: [article?.title ?? '', Validators.required],
      title_fr: [article?.title_i18n?.['fr'] ?? ''],
      title_en: [article?.title_i18n?.['en'] ?? ''],
      title_es: [article?.title_i18n?.['es'] ?? ''],
      description: [article?.description ?? ''],
      description_fr: [article?.description_i18n?.['fr'] ?? ''],
      description_en: [article?.description_i18n?.['en'] ?? ''],
      description_es: [article?.description_i18n?.['es'] ?? ''],
      slug: [article?.slug ?? ''],
      authorName: [article?.authorName ?? ''],
      status: [article?.status ?? 'draft', Validators.required],
      sortOrder: [article?.sortOrder ?? 0],
      readingTimeMinutes: [article?.readingTimeMinutes ?? null],
    });

    if (article?.coverImageKey) {
      this.loadCoverPreview(article.coverImageKey);
    }

    if (this.data.calculatedReadingTime) {
      this.calculatedReadingTime.set(this.data.calculatedReadingTime);
    }
  }

  private async loadCoverPreview(key: string) {
    try {
      const url = await this.articleService.getImageUrl(key);
      this.coverPreviewUrl.set(url);
    } catch {
      // ignore
    }
  }

  addTag(event: MatChipInputEvent) {
    const value = (event.value || '').trim();
    if (value) {
      this.tags.update((t) => [...t, value]);
    }
    event.chipInput!.clear();
  }

  removeTag(tag: string) {
    this.tags.update((t) => t.filter((x) => x !== tag));
  }

  async onCoverFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.uploadingCover.set(true);
    try {
      const { result } = this.articleService.uploadArticleCover(file);
      const { key } = await result;

      // Store key in form for save
      this.form.addControl(
        'coverImageKey',
        this.fb.control(key),
      );
      this.form.get('coverImageKey')?.setValue(key);

      const url = await this.articleService.getImageUrl(key);
      this.coverPreviewUrl.set(url);
    } catch (error) {
      console.error('Error uploading cover:', error);
    } finally {
      this.uploadingCover.set(false);
    }
  }

  async save() {
    if (!this.form.valid) return;

    this.saving.set(true);

    try {
      const v = this.form.value;

      const title_i18n: Record<string, string> = {};
      if (v.title_fr) title_i18n['fr'] = v.title_fr;
      if (v.title_en) title_i18n['en'] = v.title_en;
      if (v.title_es) title_i18n['es'] = v.title_es;

      const description_i18n: Record<string, string> = {};
      if (v.description_fr) description_i18n['fr'] = v.description_fr;
      if (v.description_en) description_i18n['en'] = v.description_en;
      if (v.description_es) description_i18n['es'] = v.description_es;

      const slug =
        v.slug || this.articleService.generateSlug(v.title);

      const payload: Record<string, unknown> = {
        title: v.title,
        title_i18n:
          Object.keys(title_i18n).length > 0 ? title_i18n : undefined,
        description: v.description || undefined,
        description_i18n:
          Object.keys(description_i18n).length > 0
            ? description_i18n
            : undefined,
        slug,
        authorName: v.authorName || undefined,
        status: v.status as ArticleStatus,
        sortOrder: v.sortOrder ?? 0,
        readingTimeMinutes: v.readingTimeMinutes ?? undefined,
        tags: this.tags(),
      };

      if (v.coverImageKey) {
        payload['coverImageKey'] = v.coverImageKey;
      }

      // Handle publish / unpublish
      if (
        v.status === 'published' &&
        this.data.article?.status !== 'published'
      ) {
        payload['publishedAt'] = new Date().toISOString();
      }

      if (this.isEditMode()) {
        await this.articleService.updateArticle(
          this.data.article!.id,
          payload as any,
        );
      } else {
        await this.articleService.createArticle(payload as any);
      }

      this.snackBar.open(
        this.translate.instant('admin.articles.save.success'),
        '',
        { duration: 3000 },
      );
      this.dialogRef.close(true);
    } catch (error) {
      console.error('Error saving article:', error);
      this.snackBar.open(
        this.translate.instant('admin.articles.save.error'),
        '',
        { duration: 3000 },
      );
    } finally {
      this.saving.set(false);
    }
  }

  cancel() {
    this.dialogRef.close(false);
  }
}
