import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { ArticleService } from '../../services/article.service';
import { SoundArticle } from '../../models/article.model';

@Component({
    selector: 'app-article-list',
    imports: [
        CommonModule,
        MatButtonModule,
        MatIconModule,
        MatProgressSpinnerModule,
        TranslateModule,
    ],
    templateUrl: './article-list.component.html',
    styleUrl: './article-list.component.scss'
})
export class ArticleListComponent implements OnInit {
  private readonly articleService = inject(ArticleService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);

  articles = signal<SoundArticle[]>([]);
  loading = signal(true);
  coverUrls = signal<Record<string, string>>({});
  searchTerm = signal('');
  activeTag = signal<string | null>(null);
  monthlyArticleId = signal<string | null>(null);

  allTags = computed(() => {
    const tags = new Set<string>();
    for (const article of this.articles()) {
      for (const tag of article.tags ?? []) {
        tags.add(tag);
      }
    }
    return [...tags].sort();
  });

  filteredArticles = computed(() => {
    let result = this.articles();
    const search = this.searchTerm().toLowerCase().trim();
    if (search) {
      result = result.filter(a => {
        const title = this.getLocalizedTitle(a).toLowerCase();
        const desc = this.getLocalizedDescription(a).toLowerCase();
        return title.includes(search) || desc.includes(search);
      });
    }
    const tag = this.activeTag();
    if (tag) {
      result = result.filter(a => a.tags?.includes(tag));
    }
    return result;
  });

  async ngOnInit() {
    try {
      const [articles, monthlyArticle] = await Promise.all([
        this.articleService.listPublishedArticles(),
        this.articleService.getMonthlyArticle().catch(() => null),
      ]);

      // Sort by publishedAt DESC
      articles.sort((a, b) => {
        const dateA = a.publishedAt || a.createdAt || '';
        const dateB = b.publishedAt || b.createdAt || '';
        return dateB.localeCompare(dateA);
      });
      this.articles.set(articles);

      if (monthlyArticle) {
        this.monthlyArticleId.set(monthlyArticle.articleId);
      }

      // Load cover images
      const urls: Record<string, string> = {};
      for (const article of articles) {
        if (article.coverImageKey) {
          try {
            urls[article.id] = await this.articleService.getImageUrl(
              article.coverImageKey,
            );
          } catch {
            // ignore
          }
        }
      }
      this.coverUrls.set(urls);
    } catch (error) {
      console.error('Error loading articles:', error);
    } finally {
      this.loading.set(false);
    }
  }

  getLocalizedTitle(article: SoundArticle): string {
    const lang = this.translate.currentLang;
    if (article.title_i18n && article.title_i18n[lang])
      return article.title_i18n[lang];
    return article.title;
  }

  getLocalizedDescription(article: SoundArticle): string {
    const lang = this.translate.currentLang;
    if (article.description_i18n && article.description_i18n[lang])
      return article.description_i18n[lang];
    return article.description ?? '';
  }

  getCoverUrl(article: SoundArticle): string | null {
    return this.coverUrls()[article.id] ?? null;
  }

  formatDate(date?: string): string {
    if (!date) return '';
    return new Date(date).toLocaleDateString(this.translate.currentLang, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  isMonthlyArticle(article: SoundArticle): boolean {
    return this.monthlyArticleId() === article.id;
  }

  toggleTag(tag: string) {
    this.activeTag.set(this.activeTag() === tag ? null : tag);
  }

  onSearchInput(event: Event) {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  goToArticle(article: SoundArticle) {
    this.router.navigate(['/articles', article.slug]);
  }
}
