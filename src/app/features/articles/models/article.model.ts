export type ArticleStatus = 'draft' | 'published' | 'archived';

export type ArticleBlockType =
  | 'heading'
  | 'paragraph'
  | 'sound'
  | 'image'
  | 'quote'
  | 'callout';

export interface SoundArticle {
  id: string;
  title: string;
  title_i18n?: Record<string, string>;
  description?: string;
  description_i18n?: Record<string, string>;
  slug: string;
  coverImageKey?: string;
  tags: string[];
  status: ArticleStatus;
  authorName?: string;
  readingTimeMinutes?: number;
  blockCount: number;
  publishedAt?: string;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ArticleBlock {
  id: string;
  articleId: string;
  order: number;
  type: ArticleBlockType;

  // Text content (heading, paragraph, quote, callout)
  content?: string;
  content_i18n?: Record<string, string>;

  // Sound media
  soundId?: string;
  soundCaption?: string;
  soundCaption_i18n?: Record<string, string>;

  // Image media
  imageKey?: string;
  imageAlt?: string;
  imageAlt_i18n?: Record<string, string>;
  imageCaption?: string;
  imageCaption_i18n?: Record<string, string>;

  // Style options
  settings?: BlockSettings;
}

export interface MonthlyArticle {
  id: string;
  articleId: string;
  month: string;
  active: boolean;
  articleTitle?: string;
  articleTitle_i18n?: Record<string, string>;
  articleSlug?: string;
  articleCoverImageKey?: string;
  articleAuthorName?: string;
  articleDescription?: string;
  articleDescription_i18n?: Record<string, string>;
}

export type BlockVariant =
  | 'default'
  | 'separator'
  | 'separator-dots'
  | 'separator-ornament'
  | 'list-bullet'
  | 'list-ordered';

export interface BlockSettings {
  level?: 1 | 2 | 3;
  align?: 'left' | 'center' | 'right' | 'justify';
  size?: 'small' | 'medium' | 'large';
  variant?: BlockVariant;
  imageWidth?: number;
  richText?: boolean;
  attribution?: string;
}
