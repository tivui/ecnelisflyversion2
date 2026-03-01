import { inject, Injectable } from '@angular/core';
import { getUrl, uploadData } from 'aws-amplify/storage';
import { Observable } from 'rxjs';
import { AmplifyService } from '../../../core/services/amplify.service';
import {
  SoundArticle,
  ArticleBlock,
  ArticleStatus,
  ArticleBlockType,
  BlockSettings,
  MonthlyArticle,
} from '../models/article.model';
import { v4 as uuidv4 } from 'uuid';

@Injectable({
  providedIn: 'root',
})
export class ArticleService {
  private readonly amplifyService = inject(AmplifyService);

  private get client() {
    return this.amplifyService.client;
  }

  // ============ MAPPERS ============

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapArticle(raw: any): SoundArticle {
    let tags: string[] = [];
    if (raw.tags) {
      const parsed =
        typeof raw.tags === 'string' ? JSON.parse(raw.tags) : raw.tags;
      tags = Array.isArray(parsed) ? parsed : [];
    }

    return {
      id: raw.id,
      title: raw.title,
      title_i18n: raw.title_i18n ? JSON.parse(raw.title_i18n) : undefined,
      description: raw.description ?? undefined,
      description_i18n: raw.description_i18n
        ? JSON.parse(raw.description_i18n)
        : undefined,
      slug: raw.slug,
      coverImageKey: raw.coverImageKey ?? undefined,
      tags,
      status: raw.status as ArticleStatus,
      authorName: raw.authorName ?? undefined,
      readingTimeMinutes: raw.readingTimeMinutes ?? undefined,
      blockCount: raw.blockCount ?? 0,
      publishedAt: raw.publishedAt ?? undefined,
      sortOrder: raw.sortOrder ?? 0,
      createdAt: raw.createdAt ?? undefined,
      updatedAt: raw.updatedAt ?? undefined,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapBlock(raw: any): ArticleBlock {
    let settings: BlockSettings | undefined;
    if (raw.settings) {
      settings =
        typeof raw.settings === 'string'
          ? JSON.parse(raw.settings)
          : raw.settings;
    }

    return {
      id: raw.id,
      articleId: raw.articleId,
      order: raw.order,
      type: raw.type as ArticleBlockType,
      content: raw.content ?? undefined,
      content_i18n: raw.content_i18n
        ? JSON.parse(raw.content_i18n)
        : undefined,
      soundId: raw.soundId ?? undefined,
      soundCaption: raw.soundCaption ?? undefined,
      soundCaption_i18n: raw.soundCaption_i18n
        ? JSON.parse(raw.soundCaption_i18n)
        : undefined,
      imageKey: raw.imageKey ?? undefined,
      imageAlt: raw.imageAlt ?? undefined,
      imageAlt_i18n: raw.imageAlt_i18n
        ? JSON.parse(raw.imageAlt_i18n)
        : undefined,
      imageCaption: raw.imageCaption ?? undefined,
      imageCaption_i18n: raw.imageCaption_i18n
        ? JSON.parse(raw.imageCaption_i18n)
        : undefined,
      settings,
    };
  }

  // ============ ARTICLE CRUD (Admin) ============

  async listArticles(): Promise<SoundArticle[]> {
    const result = await this.client.models.SoundArticle.list();
    if (result.errors?.length) {
      console.error('Error listing articles:', result.errors);
      throw new Error('Failed to list articles');
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (result.data ?? []).map((a: any) => this.mapArticle(a));
  }

  async listPublishedArticles(): Promise<SoundArticle[]> {
    const result = await (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.client.models.SoundArticle.listArticlesByStatus as any
    )({ status: 'published' }, { authMode: 'apiKey' });
    if (result.errors?.length) {
      console.error('Error listing published articles:', result.errors);
      throw new Error('Failed to list published articles');
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (result.data ?? []).map((a: any) => this.mapArticle(a));
  }

  async getArticle(id: string): Promise<SoundArticle | null> {
    const result = await this.client.models.SoundArticle.get({ id });
    if (result.errors?.length) {
      console.error('Error getting article:', result.errors);
      throw new Error('Failed to get article');
    }
    return result.data ? this.mapArticle(result.data) : null;
  }

  async getArticleBySlug(slug: string): Promise<SoundArticle | null> {
    const result = await (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.client.models.SoundArticle.getArticleBySlug as any
    )({ slug }, { authMode: 'apiKey' });
    if (result.errors?.length) {
      console.error('Error getting article by slug:', result.errors);
      throw new Error('Failed to get article by slug');
    }
    const items = result.data ?? [];
    return items.length > 0 ? this.mapArticle(items[0]) : null;
  }

  async createArticle(data: {
    title: string;
    title_i18n?: Record<string, string>;
    description?: string;
    description_i18n?: Record<string, string>;
    slug?: string;
    coverImageKey?: string;
    tags?: string[];
    status: ArticleStatus;
    authorName?: string;
    sortOrder?: number;
  }): Promise<SoundArticle> {
    const slug = data.slug || this.generateSlug(data.title);
    const now = new Date().toISOString();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await this.client.models.SoundArticle.create({
      id: uuidv4(),
      title: data.title,
      title_i18n: data.title_i18n
        ? JSON.stringify(data.title_i18n)
        : undefined,
      description: data.description,
      description_i18n: data.description_i18n
        ? JSON.stringify(data.description_i18n)
        : undefined,
      slug,
      coverImageKey: data.coverImageKey,
      tags: data.tags ? JSON.stringify(data.tags) : JSON.stringify([]),
      status: data.status,
      authorName: data.authorName,
      blockCount: 0,
      sortOrder: data.sortOrder ?? 0,
      createdAt: now,
      updatedAt: now,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    if (result.errors?.length) {
      console.error('Error creating article:', result.errors);
      throw new Error('Failed to create article');
    }
    return this.mapArticle(result.data);
  }

  async updateArticle(
    id: string,
    updates: Partial<{
      title: string;
      title_i18n: Record<string, string>;
      description: string;
      description_i18n: Record<string, string>;
      slug: string;
      coverImageKey: string;
      tags: string[];
      status: ArticleStatus;
      authorName: string;
      readingTimeMinutes: number;
      blockCount: number;
      publishedAt: string;
      sortOrder: number;
    }>,
  ): Promise<SoundArticle> {
    const input: Record<string, unknown> = {
      id,
      updatedAt: new Date().toISOString(),
    };

    if (updates.title !== undefined) input['title'] = updates.title;
    if (updates.title_i18n !== undefined)
      input['title_i18n'] = JSON.stringify(updates.title_i18n);
    if (updates.description !== undefined)
      input['description'] = updates.description;
    if (updates.description_i18n !== undefined)
      input['description_i18n'] = JSON.stringify(updates.description_i18n);
    if (updates.slug !== undefined) input['slug'] = updates.slug;
    if (updates.coverImageKey !== undefined)
      input['coverImageKey'] = updates.coverImageKey;
    if (updates.tags !== undefined)
      input['tags'] = JSON.stringify(updates.tags);
    if (updates.status !== undefined) input['status'] = updates.status;
    if (updates.authorName !== undefined)
      input['authorName'] = updates.authorName;
    if (updates.readingTimeMinutes !== undefined)
      input['readingTimeMinutes'] = updates.readingTimeMinutes;
    if (updates.blockCount !== undefined)
      input['blockCount'] = updates.blockCount;
    if (updates.publishedAt !== undefined)
      input['publishedAt'] = updates.publishedAt;
    if (updates.sortOrder !== undefined)
      input['sortOrder'] = updates.sortOrder;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await this.client.models.SoundArticle.update(input as any);
    if (result.errors?.length) {
      console.error('Error updating article:', result.errors);
      throw new Error('Failed to update article');
    }
    return this.mapArticle(result.data);
  }

  async deleteArticle(id: string): Promise<void> {
    // Cascade delete all blocks first
    const blocks = await this.getArticleBlocks(id);
    for (const block of blocks) {
      await this.deleteBlock(block.id);
    }

    const result = await this.client.models.SoundArticle.delete({ id });
    if (result.errors?.length) {
      console.error('Error deleting article:', result.errors);
      throw new Error('Failed to delete article');
    }
  }

  // ============ BLOCK CRUD ============

  async getArticleBlocks(articleId: string): Promise<ArticleBlock[]> {
    const result = await (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.client.models.ArticleBlock.listBlocksByArticle as any
    )({ articleId });
    if (result.errors?.length) {
      console.error('Error listing blocks:', result.errors);
      throw new Error('Failed to list blocks');
    }
    return (result.data ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((b: any) => this.mapBlock(b))
      .sort((a: ArticleBlock, b: ArticleBlock) => a.order - b.order);
  }

  async createBlock(data: {
    articleId: string;
    order: number;
    type: ArticleBlockType;
    content?: string;
    content_i18n?: Record<string, string>;
    soundId?: string;
    soundCaption?: string;
    soundCaption_i18n?: Record<string, string>;
    imageKey?: string;
    imageAlt?: string;
    imageAlt_i18n?: Record<string, string>;
    imageCaption?: string;
    imageCaption_i18n?: Record<string, string>;
    settings?: BlockSettings;
  }): Promise<ArticleBlock> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await this.client.models.ArticleBlock.create({
      id: uuidv4(),
      articleId: data.articleId,
      order: data.order,
      type: data.type,
      content: data.content,
      content_i18n: data.content_i18n
        ? JSON.stringify(data.content_i18n)
        : undefined,
      soundId: data.soundId,
      soundCaption: data.soundCaption,
      soundCaption_i18n: data.soundCaption_i18n
        ? JSON.stringify(data.soundCaption_i18n)
        : undefined,
      imageKey: data.imageKey,
      imageAlt: data.imageAlt,
      imageAlt_i18n: data.imageAlt_i18n
        ? JSON.stringify(data.imageAlt_i18n)
        : undefined,
      imageCaption: data.imageCaption,
      imageCaption_i18n: data.imageCaption_i18n
        ? JSON.stringify(data.imageCaption_i18n)
        : undefined,
      settings: data.settings ? JSON.stringify(data.settings) : undefined,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    if (result.errors?.length) {
      console.error('Error creating block:', result.errors);
      throw new Error('Failed to create block');
    }
    return this.mapBlock(result.data);
  }

  async updateBlock(
    id: string,
    updates: Partial<{
      order: number;
      type: ArticleBlockType;
      content: string;
      content_i18n: Record<string, string>;
      soundId: string;
      soundCaption: string;
      soundCaption_i18n: Record<string, string>;
      imageKey: string;
      imageAlt: string;
      imageAlt_i18n: Record<string, string>;
      imageCaption: string;
      imageCaption_i18n: Record<string, string>;
      settings: BlockSettings;
    }>,
  ): Promise<ArticleBlock> {
    const input: Record<string, unknown> = { id };

    if (updates.order !== undefined) input['order'] = updates.order;
    if (updates.type !== undefined) input['type'] = updates.type;
    if (updates.content !== undefined) input['content'] = updates.content;
    if (updates.content_i18n !== undefined)
      input['content_i18n'] = JSON.stringify(updates.content_i18n);
    if (updates.soundId !== undefined) input['soundId'] = updates.soundId;
    if (updates.soundCaption !== undefined)
      input['soundCaption'] = updates.soundCaption;
    if (updates.soundCaption_i18n !== undefined)
      input['soundCaption_i18n'] = JSON.stringify(updates.soundCaption_i18n);
    if (updates.imageKey !== undefined) input['imageKey'] = updates.imageKey;
    if (updates.imageAlt !== undefined) input['imageAlt'] = updates.imageAlt;
    if (updates.imageAlt_i18n !== undefined)
      input['imageAlt_i18n'] = JSON.stringify(updates.imageAlt_i18n);
    if (updates.imageCaption !== undefined)
      input['imageCaption'] = updates.imageCaption;
    if (updates.imageCaption_i18n !== undefined)
      input['imageCaption_i18n'] = JSON.stringify(updates.imageCaption_i18n);
    if (updates.settings !== undefined)
      input['settings'] = JSON.stringify(updates.settings);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await this.client.models.ArticleBlock.update(input as any);
    if (result.errors?.length) {
      console.error('Error updating block:', result.errors);
      throw new Error('Failed to update block');
    }
    return this.mapBlock(result.data);
  }

  async deleteBlock(id: string): Promise<void> {
    const result = await this.client.models.ArticleBlock.delete({ id });
    if (result.errors?.length) {
      console.error('Error deleting block:', result.errors);
      throw new Error('Failed to delete block');
    }
  }

  async reorderBlocks(
    blocks: { id: string; order: number }[],
  ): Promise<void> {
    for (const b of blocks) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await this.client.models.ArticleBlock.update({
        id: b.id,
        order: b.order,
      } as any);
    }
  }

  // ============ MONTHLY ARTICLE ============

  async getMonthlyArticle(): Promise<MonthlyArticle | null> {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const result = await (
      this.client.models.MonthlyArticle as any
    ).getMonthlyArticleByMonth({ month }, { authMode: 'apiKey' });

    if (result.errors?.length) {
      console.error('Error getting monthly article:', result.errors);
      return null;
    }

    const actives = (result.data ?? []).filter((m: any) => m.active);
    if (actives.length === 0) return null;

    const raw = actives[0];
    return {
      id: raw.id,
      articleId: raw.articleId,
      month: raw.month,
      active: raw.active,
      articleTitle: raw.articleTitle,
      articleTitle_i18n: raw.articleTitle_i18n ? JSON.parse(raw.articleTitle_i18n) : undefined,
      articleSlug: raw.articleSlug,
      articleCoverImageKey: raw.articleCoverImageKey,
      articleAuthorName: raw.articleAuthorName,
      articleDescription: raw.articleDescription,
      articleDescription_i18n: raw.articleDescription_i18n ? JSON.parse(raw.articleDescription_i18n) : undefined,
    };
  }

  async setMonthlyArticle(article: SoundArticle): Promise<void> {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Deactivate existing active entries for this month
    const existing = await (
      this.client.models.MonthlyArticle as any
    ).getMonthlyArticleByMonth({ month });
    if (existing.data) {
      for (const m of existing.data) {
        if (m.active) {
          await this.client.models.MonthlyArticle.update({
            id: m.id,
            active: false,
          } as any);
        }
      }
    }

    // Create new MonthlyArticle with denormalized data
    const result = await this.client.models.MonthlyArticle.create({
      id: uuidv4(),
      articleId: article.id,
      month,
      active: true,
      articleTitle: article.title ?? undefined,
      articleTitle_i18n: article.title_i18n ? JSON.stringify(article.title_i18n) : undefined,
      articleSlug: article.slug ?? undefined,
      articleCoverImageKey: article.coverImageKey ?? undefined,
      articleAuthorName: article.authorName ?? undefined,
      articleDescription: article.description ?? undefined,
      articleDescription_i18n: article.description_i18n ? JSON.stringify(article.description_i18n) : undefined,
    } as any);

    if (result.errors?.length) {
      console.error('Error setting monthly article:', result.errors);
      throw new Error('Failed to set monthly article');
    }
  }

  // ============ UTILITIES ============

  async getLatestPublishedArticle(): Promise<SoundArticle | null> {
    const articles = await this.listPublishedArticles();
    if (articles.length === 0) return null;
    // Sort by publishedAt DESC, fallback to createdAt
    articles.sort((a, b) => {
      const dateA = a.publishedAt || a.createdAt || '';
      const dateB = b.publishedAt || b.createdAt || '';
      return dateB.localeCompare(dateA);
    });
    return articles[0];
  }

  generateSlug(title: string): string {
    return title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
      .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
      .replace(/\s+/g, '-') // Spaces to hyphens
      .replace(/-+/g, '-') // Collapse multiple hyphens
      .replace(/^-|-$/g, '') // Trim hyphens
      .substring(0, 80); // Limit length
  }

  // ============ READING TIME ============

  calculateReadingTime(blocks: ArticleBlock[]): number {
    const textTypes: ArticleBlockType[] = ['heading', 'paragraph', 'quote', 'callout'];
    let totalWords = 0;

    for (const block of blocks) {
      if (!textTypes.includes(block.type)) continue;

      // Count words from all language versions + default content
      const texts: string[] = [];
      if (block.content) texts.push(block.content);
      if (block.content_i18n) {
        const frText = block.content_i18n['fr'];
        if (frText) texts.push(frText);
      }

      // Use the longest version (FR or default) for word count
      const longestText = texts.reduce((a, b) => a.length > b.length ? a : b, '');
      const words = longestText
        .replace(/<[^>]*>/g, '') // Strip HTML tags
        .split(/\s+/)
        .filter(w => w.length > 0);
      totalWords += words.length;
    }

    return Math.max(1, Math.round(totalWords / 200));
  }

  // ============ IMAGE UPLOAD (S3) ============

  uploadArticleImage(
    file: File,
  ): { progress$: Observable<number>; result: Promise<{ key: string }> } {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let progressObserver: any;

    const progress$ = new Observable<number>((observer) => {
      progressObserver = observer;
    });

    const key = `articles/images/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    const uploadTask = uploadData({
      path: key,
      data: file,
      options: {
        contentType: file.type,
        onProgress: ({ transferredBytes, totalBytes }) => {
          if (totalBytes && progressObserver) {
            const percent = Math.round(
              (transferredBytes / totalBytes) * 100,
            );
            progressObserver.next(percent);
          }
        },
      },
    });

    const result = uploadTask.result
      .then(() => ({ key }))
      .finally(() => {
        progressObserver?.complete();
      });

    return { progress$, result };
  }

  uploadArticleCover(
    file: File,
  ): { progress$: Observable<number>; result: Promise<{ key: string }> } {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let progressObserver: any;

    const progress$ = new Observable<number>((observer) => {
      progressObserver = observer;
    });

    const key = `articles/covers/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    const uploadTask = uploadData({
      path: key,
      data: file,
      options: {
        contentType: file.type,
        onProgress: ({ transferredBytes, totalBytes }) => {
          if (totalBytes && progressObserver) {
            const percent = Math.round(
              (transferredBytes / totalBytes) * 100,
            );
            progressObserver.next(percent);
          }
        },
      },
    });

    const result = uploadTask.result
      .then(() => ({ key }))
      .finally(() => {
        progressObserver?.complete();
      });

    return { progress$, result };
  }

  async getImageUrl(key: string): Promise<string> {
    const { url } = await getUrl({ path: key });
    return url.toString();
  }
}
