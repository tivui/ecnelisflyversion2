import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { ArticleService } from '../../../../articles/services/article.service';
import { SoundArticle } from '../../../../articles/models/article.model';
import { ArticleSettingsDialogComponent } from '../article-settings-dialog/article-settings-dialog.component';
import { ConfirmDialogComponent } from '../../../../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-article-admin-list',
  standalone: true,
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
  templateUrl: './article-admin-list.component.html',
  styleUrl: './article-admin-list.component.scss',
})
export class ArticleAdminListComponent implements OnInit {
  private readonly articleService = inject(ArticleService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);

  articles = signal<SoundArticle[]>([]);
  loading = signal(true);
  displayedColumns = [
    'title',
    'status',
    'tags',
    'blockCount',
    'readingTime',
    'publishedAt',
    'actions',
  ];

  ngOnInit() {
    this.loadArticles();
  }

  async loadArticles() {
    this.loading.set(true);
    try {
      const articles = await this.articleService.listArticles();
      this.articles.set(
        articles.sort((a, b) => {
          const statusOrder: Record<string, number> = {
            draft: 0,
            published: 1,
            archived: 2,
          };
          return (statusOrder[a.status] ?? 0) - (statusOrder[b.status] ?? 0);
        }),
      );
    } catch (error) {
      console.error('Error loading articles:', error);
    } finally {
      this.loading.set(false);
    }
  }

  async createArticle() {
    try {
      const article = await this.articleService.createArticle({
        title: this.translate.instant('admin.articles.list.new'),
        status: 'draft',
      });
      this.router.navigate([
        '/admin/database/articles',
        article.id,
        'edit',
      ]);
    } catch (error) {
      console.error('Error creating article:', error);
      this.snackBar.open(
        this.translate.instant('admin.articles.save.error'),
        '',
        { duration: 3000 },
      );
    }
  }

  async setAsMonthly(article: SoundArticle) {
    try {
      await this.articleService.setMonthlyArticle(article);
      this.snackBar.open(
        this.translate.instant('admin.articles.monthlySet'),
        '',
        { duration: 3000 },
      );
    } catch (error) {
      console.error('Error setting monthly article:', error);
    }
  }

  openEditor(article: SoundArticle) {
    this.router.navigate([
      '/admin/database/articles',
      article.id,
      'edit',
    ]);
  }

  openSettings(article: SoundArticle) {
    const dialogRef = this.dialog.open(ArticleSettingsDialogComponent, {
      width: '90vw',
      maxWidth: '700px',
      maxHeight: '90vh',
      data: { article },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.loadArticles();
      }
    });
  }

  async deleteArticle(article: SoundArticle) {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: this.translate.instant('admin.articles.delete.title'),
        message: this.translate.instant('admin.articles.delete.message'),
        confirmText: this.translate.instant('admin.articles.delete.confirm'),
        cancelText: this.translate.instant('common.action.cancel'),
      },
    });

    dialogRef.afterClosed().subscribe(async (confirmed) => {
      if (confirmed) {
        try {
          await this.articleService.deleteArticle(article.id);
          this.snackBar.open(
            this.translate.instant('admin.articles.delete.success'),
            '',
            { duration: 3000 },
          );
          this.loadArticles();
        } catch (error) {
          console.error('Error deleting article:', error);
        }
      }
    });
  }

  getLocalizedTitle(article: SoundArticle): string {
    const lang = this.translate.currentLang;
    if (article.title_i18n && article.title_i18n[lang]) {
      return article.title_i18n[lang];
    }
    return article.title;
  }

  formatDate(date?: string): string {
    if (!date) return '—';
    return new Date(date).toLocaleDateString();
  }
}
