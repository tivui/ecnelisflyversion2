import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  CdkDropList,
  CdkDrag,
  CdkDragDrop,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { ArticleService } from '../../../../articles/services/article.service';
import {
  SoundArticle,
  ArticleBlock,
  ArticleBlockType,
  BlockVariant,
} from '../../../../articles/models/article.model';
import { BlockEditDialogComponent } from '../block-edit-dialog/block-edit-dialog.component';
import { ArticleSettingsDialogComponent } from '../article-settings-dialog/article-settings-dialog.component';
import { ArticlePreviewDialogComponent } from '../article-preview-dialog/article-preview-dialog.component';
import { ConfirmDialogComponent } from '../../../../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
    selector: 'app-article-editor',
    imports: [
        CommonModule,
        MatButtonModule,
        MatIconModule,
        MatTooltipModule,
        MatDialogModule,
        MatSnackBarModule,
        MatProgressSpinnerModule,
        TranslateModule,
        CdkDropList,
        CdkDrag,
    ],
    templateUrl: './article-editor.component.html',
    styleUrl: './article-editor.component.scss'
})
export class ArticleEditorComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly articleService = inject(ArticleService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);

  article = signal<SoundArticle | null>(null);
  blocks = signal<ArticleBlock[]>([]);
  loading = signal(true);
  activeLang = signal('fr');

  private articleId = '';

  readonly blockTypes: { type: ArticleBlockType; icon: string; labelKey: string; variant?: BlockVariant }[] = [
    { type: 'heading', icon: 'title', labelKey: 'admin.articles.editor.blocks.heading' },
    { type: 'paragraph', icon: 'notes', labelKey: 'admin.articles.editor.blocks.paragraph' },
    { type: 'sound', icon: 'music_note', labelKey: 'admin.articles.editor.blocks.sound' },
    { type: 'image', icon: 'image', labelKey: 'admin.articles.editor.blocks.image' },
    { type: 'quote', icon: 'format_quote', labelKey: 'admin.articles.editor.blocks.quote' },
    { type: 'callout', icon: 'info', labelKey: 'admin.articles.editor.blocks.callout' },
    { type: 'paragraph', icon: 'format_list_bulleted', labelKey: 'admin.articles.editor.blocks.listBullet', variant: 'list-bullet' },
    { type: 'paragraph', icon: 'format_list_numbered', labelKey: 'admin.articles.editor.blocks.listOrdered', variant: 'list-ordered' },
    { type: 'callout', icon: 'horizontal_rule', labelKey: 'admin.articles.editor.blocks.separator', variant: 'separator' },
  ];

  readonly languages = ['fr', 'en', 'es'];

  ngOnInit() {
    this.articleId = this.route.snapshot.params['id'];
    this.loadData();
  }

  async loadData() {
    this.loading.set(true);
    try {
      const [article, blocks] = await Promise.all([
        this.articleService.getArticle(this.articleId),
        this.articleService.getArticleBlocks(this.articleId),
      ]);
      this.article.set(article);
      this.blocks.set(blocks);

      // Auto-sync blockCount
      if (article && article.blockCount !== blocks.length) {
        await this.updateBlockCount();
      }
    } catch (error) {
      console.error('Error loading article:', error);
    } finally {
      this.loading.set(false);
    }
  }

  // ============ BLOCK CRUD ============

  openAddBlockDialog(type: ArticleBlockType, variant?: BlockVariant) {
    const nextOrder = this.blocks().length + 1;
    const dialogRef = this.dialog.open(BlockEditDialogComponent, {
      width: '90vw',
      maxWidth: '800px',
      maxHeight: '90vh',
      data: {
        articleId: this.articleId,
        block: null,
        type,
        order: nextOrder,
        variant,
      },
    });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        await this.loadData();
        await this.updateBlockCount();
      }
    });
  }

  openEditBlockDialog(block: ArticleBlock) {
    const dialogRef = this.dialog.open(BlockEditDialogComponent, {
      width: '90vw',
      maxWidth: '800px',
      maxHeight: '90vh',
      data: {
        articleId: this.articleId,
        block,
        type: block.type,
        order: block.order,
        variant: block.settings?.variant,
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.loadData();
      }
    });
  }

  async deleteBlock(block: ArticleBlock) {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: this.translate.instant('admin.articles.block.delete.title'),
        message: this.translate.instant('admin.articles.block.delete.message'),
        confirmText: this.translate.instant(
          'admin.articles.block.delete.confirm',
        ),
        cancelText: this.translate.instant('common.action.cancel'),
      },
    });

    dialogRef.afterClosed().subscribe(async (confirmed) => {
      if (confirmed) {
        try {
          await this.articleService.deleteBlock(block.id);
          // Reorder remaining
          const remaining = this.blocks()
            .filter((b) => b.id !== block.id)
            .map((b, i) => ({ id: b.id, order: i + 1 }));
          await this.articleService.reorderBlocks(remaining);
          await this.loadData();
          await this.updateBlockCount();
          this.snackBar.open(
            this.translate.instant('admin.articles.block.delete.success'),
            '',
            { duration: 3000 },
          );
        } catch (error) {
          console.error('Error deleting block:', error);
        }
      }
    });
  }

  async onDrop(event: CdkDragDrop<ArticleBlock[]>) {
    if (event.previousIndex === event.currentIndex) return;

    const items = [...this.blocks()];
    moveItemInArray(items, event.previousIndex, event.currentIndex);
    this.blocks.set(items);

    try {
      const updates = items.map((b, i) => ({ id: b.id, order: i + 1 }));
      await this.articleService.reorderBlocks(updates);
    } catch (error) {
      console.error('Error reordering blocks:', error);
      await this.loadData();
    }
  }

  async duplicateBlock(block: ArticleBlock) {
    try {
      const nextOrder = this.blocks().length + 1;
      const payload: Record<string, unknown> = {
        articleId: this.articleId,
        order: nextOrder,
        type: block.type,
      };

      if (block.content) payload['content'] = block.content;
      if (block.content_i18n) payload['content_i18n'] = block.content_i18n;
      if (block.soundId) payload['soundId'] = block.soundId;
      if (block.soundCaption) payload['soundCaption'] = block.soundCaption;
      if (block.soundCaption_i18n) payload['soundCaption_i18n'] = block.soundCaption_i18n;
      if (block.imageKey) payload['imageKey'] = block.imageKey;
      if (block.imageAlt) payload['imageAlt'] = block.imageAlt;
      if (block.imageAlt_i18n) payload['imageAlt_i18n'] = block.imageAlt_i18n;
      if (block.imageCaption) payload['imageCaption'] = block.imageCaption;
      if (block.imageCaption_i18n) payload['imageCaption_i18n'] = block.imageCaption_i18n;
      if (block.settings) payload['settings'] = block.settings;

      await this.articleService.createBlock(payload as any);
      await this.loadData();
      await this.updateBlockCount();
      this.snackBar.open(
        this.translate.instant('admin.articles.block.duplicate.success'),
        '',
        { duration: 3000 },
      );
    } catch (error) {
      console.error('Error duplicating block:', error);
    }
  }

  // ============ ARTICLE ACTIONS ============

  openSettingsDialog() {
    const dialogRef = this.dialog.open(ArticleSettingsDialogComponent, {
      width: '90vw',
      maxWidth: '700px',
      maxHeight: '90vh',
      data: { article: this.article() },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.loadData();
      }
    });
  }

  openPreview() {
    const article = this.article();
    if (!article) return;

    this.dialog.open(ArticlePreviewDialogComponent, {
      width: '95vw',
      maxWidth: '1100px',
      height: '90vh',
      panelClass: 'article-preview-panel',
      data: {
        article,
        blocks: this.blocks(),
      },
    });
  }

  async togglePublish() {
    const article = this.article();
    if (!article) return;

    try {
      if (article.status === 'published') {
        // Unpublish (back to draft)
        await this.articleService.updateArticle(article.id, {
          status: 'draft',
        });
        this.snackBar.open(
          this.translate.instant('admin.articles.editor.unpublish'),
          '',
          { duration: 3000 },
        );
      } else {
        // Publish
        await this.articleService.updateArticle(article.id, {
          status: 'published',
          publishedAt: new Date().toISOString(),
        });
        this.snackBar.open(
          this.translate.instant('admin.articles.editor.publish'),
          '',
          { duration: 3000 },
        );
      }
      await this.loadData();
    } catch (error) {
      console.error('Error toggling publish:', error);
    }
  }

  private async updateBlockCount() {
    try {
      const count = this.blocks().length;
      await this.articleService.updateArticle(this.articleId, {
        blockCount: count,
      });
    } catch {
      // non-critical
    }
  }

  goBack() {
    this.router.navigate(['/admin/database/articles']);
  }

  // ============ DISPLAY HELPERS ============

  getBlockIcon(type: ArticleBlockType, variant?: BlockVariant): string {
    if (variant) {
      const found = this.blockTypes.find((bt) => bt.variant === variant);
      if (found) return found.icon;
    }
    return (
      this.blockTypes.find((bt) => bt.type === type && !bt.variant)?.icon ?? 'help_outline'
    );
  }

  getBlockTypeLabel(type: ArticleBlockType, variant?: BlockVariant): string {
    if (variant) {
      const found = this.blockTypes.find((bt) => bt.variant === variant);
      if (found) return this.translate.instant(found.labelKey);
    }
    const key =
      this.blockTypes.find((bt) => bt.type === type && !bt.variant)?.labelKey ?? '';
    return key ? this.translate.instant(key) : type;
  }

  getBlockPreview(block: ArticleBlock): string {
    const lang = this.activeLang();
    const variant = block.settings?.variant;

    // Separators have no text preview
    if (variant?.startsWith('separator')) return '———';

    // Lists: show first few items
    if (variant === 'list-bullet' || variant === 'list-ordered') {
      const text = block.content_i18n?.[lang] ?? block.content ?? '';
      const items = text.split('\n').filter((l: string) => l.trim());
      return items.slice(0, 3).join(', ') + (items.length > 3 ? '...' : '');
    }

    switch (block.type) {
      case 'heading':
      case 'paragraph':
      case 'quote':
      case 'callout': {
        const text =
          block.content_i18n?.[lang] ?? block.content ?? '';
        return text.length > 100 ? text.substring(0, 100) + '...' : text;
      }
      case 'sound':
        return block.soundCaption_i18n?.[lang] ?? block.soundCaption ?? '(son)';
      case 'image':
        return block.imageCaption_i18n?.[lang] ?? block.imageCaption ?? block.imageAlt ?? '(image)';
      default:
        return '';
    }
  }

  getHeadingLevel(block: ArticleBlock): string {
    if (block.type !== 'heading') return '';
    return `H${block.settings?.level ?? 2}`;
  }

  setActiveLang(lang: string) {
    this.activeLang.set(lang);
  }
}
