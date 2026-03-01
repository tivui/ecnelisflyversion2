import { Component, inject, signal, OnInit, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormControl,
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
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { debounceTime, distinctUntilChanged } from 'rxjs';

import { ArticleService } from '../../../../articles/services/article.service';
import {
  ArticleBlock,
  ArticleBlockType,
  BlockSettings,
  BlockVariant,
} from '../../../../articles/models/article.model';
import { SoundsService } from '../../../../../core/services/sounds.service';
import { Sound } from '../../../../../core/models/sound.model';

interface DialogData {
  articleId: string;
  block: ArticleBlock | null;
  type: ArticleBlockType;
  order: number;
  variant?: BlockVariant;
}

@Component({
    selector: 'app-block-edit-dialog',
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
        MatTooltipModule,
        MatAutocompleteModule,
        TranslateModule,
    ],
    templateUrl: './block-edit-dialog.component.html',
    styleUrl: './block-edit-dialog.component.scss'
})
export class BlockEditDialogComponent implements OnInit, AfterViewInit {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<BlockEditDialogComponent>);
  private readonly data: DialogData = inject(MAT_DIALOG_DATA);
  private readonly articleService = inject(ArticleService);
  private readonly soundsService = inject(SoundsService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);

  form!: FormGroup;
  saving = signal(false);
  isEditMode = signal(false);
  blockType = signal<ArticleBlockType>('paragraph');
  blockVariant = signal<BlockVariant | undefined>(undefined);

  // Sound search
  soundSearchControl = new FormControl('');
  allSounds = signal<Sound[]>([]);
  filteredSounds = signal<Sound[]>([]);
  selectedSound = signal<Sound | null>(null);

  // Image upload
  imagePreviewUrl = signal<string | null>(null);
  uploadingImage = signal(false);

  // Rich text editors
  @ViewChild('mainEditor') mainEditorRef?: ElementRef<HTMLDivElement>;
  @ViewChild('editorFr') editorFrRef?: ElementRef<HTMLDivElement>;
  @ViewChild('editorEn') editorEnRef?: ElementRef<HTMLDivElement>;
  @ViewChild('editorEs') editorEsRef?: ElementRef<HTMLDivElement>;
  private translationEditorsInit = false;

  headingLevels = [
    { value: 1, label: 'H1' },
    { value: 2, label: 'H2' },
    { value: 3, label: 'H3' },
  ];

  alignments = [
    { value: 'left', label: 'Left', icon: 'format_align_left' },
    { value: 'center', label: 'Center', icon: 'format_align_center' },
    { value: 'right', label: 'Right', icon: 'format_align_right' },
    { value: 'justify', label: 'Justify', icon: 'format_align_justify' },
  ];

  imageSizes = [
    { value: 10, label: '10%' },
    { value: 15, label: '15%' },
    { value: 20, label: '20%' },
    { value: 25, label: '25%' },
    { value: 33, label: '33%' },
    { value: 40, label: '40%' },
    { value: 50, label: '50%' },
    { value: 60, label: '60%' },
    { value: 66, label: '66%' },
    { value: 75, label: '75%' },
    { value: 80, label: '80%' },
    { value: 90, label: '90%' },
    { value: 100, label: '100%' },
  ];

  separatorStyles: { value: BlockVariant; label: string }[] = [
    { value: 'separator', label: 'Line' },
    { value: 'separator-dots', label: 'Dots' },
    { value: 'separator-ornament', label: 'Ornament' },
  ];

  ngOnInit() {
    const block = this.data.block;
    this.isEditMode.set(!!block);
    this.blockType.set(block?.type ?? this.data.type);

    // Determine variant from existing block or from dialog data
    const variant = block?.settings?.variant ?? this.data.variant;
    this.blockVariant.set(variant);

    const settings = block?.settings ?? {};

    // Default imageWidth: migrate from old size or default to 100
    const defaultImageWidth = settings.imageWidth
      ?? (settings.size === 'small' ? 50 : settings.size === 'medium' ? 75 : 100);

    this.form = this.fb.group({
      // Text content
      content: [block?.content ?? ''],
      content_fr: [block?.content_i18n?.['fr'] ?? ''],
      content_en: [block?.content_i18n?.['en'] ?? ''],
      content_es: [block?.content_i18n?.['es'] ?? ''],

      // Sound
      soundCaption: [block?.soundCaption ?? ''],
      soundCaption_fr: [block?.soundCaption_i18n?.['fr'] ?? ''],
      soundCaption_en: [block?.soundCaption_i18n?.['en'] ?? ''],
      soundCaption_es: [block?.soundCaption_i18n?.['es'] ?? ''],

      // Image
      imageAlt: [block?.imageAlt ?? ''],
      imageAlt_fr: [block?.imageAlt_i18n?.['fr'] ?? ''],
      imageAlt_en: [block?.imageAlt_i18n?.['en'] ?? ''],
      imageAlt_es: [block?.imageAlt_i18n?.['es'] ?? ''],
      imageCaption: [block?.imageCaption ?? ''],
      imageCaption_fr: [block?.imageCaption_i18n?.['fr'] ?? ''],
      imageCaption_en: [block?.imageCaption_i18n?.['en'] ?? ''],
      imageCaption_es: [block?.imageCaption_i18n?.['es'] ?? ''],

      // Settings
      level: [settings.level ?? 2],
      align: [settings.align ?? 'left'],
      imageWidth: [defaultImageWidth],
      attribution: [settings.attribution ?? ''],

      // Separator variant style
      separatorStyle: [variant ?? 'separator'],
    });

    // Init for specific types
    if (this.isTypeSound()) {
      this.loadSounds();
      if (block?.soundId) {
        this.loadSelectedSound(block.soundId);
      }

      this.soundSearchControl.valueChanges
        .pipe(debounceTime(300), distinctUntilChanged())
        .subscribe((val) => {
          const search = (val ?? '').toLowerCase();
          this.filteredSounds.set(
            this.allSounds()
              .filter(
                (s) =>
                  s.title.toLowerCase().includes(search) ||
                  s.city?.toLowerCase().includes(search),
              )
              .slice(0, 20),
          );
        });
    }

    if (this.isTypeImage() && block?.imageKey) {
      this.loadImagePreview(block.imageKey);
    }
  }

  ngAfterViewInit() {
    if (this.mainEditorRef && this.isRichTextBlock()) {
      this.mainEditorRef.nativeElement.innerHTML = this.form.get('content')?.value || '';
    }
  }

  // ============ TYPE HELPERS ============

  isTypeText(): boolean {
    // Text blocks but NOT list or separator variants
    if (this.isSeparator() || this.isList()) return false;
    return ['heading', 'paragraph', 'quote', 'callout'].includes(
      this.blockType(),
    );
  }

  isTypeSound(): boolean {
    return this.blockType() === 'sound';
  }

  isTypeImage(): boolean {
    return this.blockType() === 'image';
  }

  isTypeHeading(): boolean {
    return this.blockType() === 'heading';
  }

  isSeparator(): boolean {
    const v = this.blockVariant();
    return !!v && v.startsWith('separator');
  }

  isList(): boolean {
    const v = this.blockVariant();
    return v === 'list-bullet' || v === 'list-ordered';
  }

  isTypeQuote(): boolean {
    return this.blockType() === 'quote';
  }

  isRichTextBlock(): boolean {
    if (this.isSeparator() || this.isList()) return false;
    return this.blockType() === 'paragraph' || this.blockType() === 'quote';
  }

  hasAlignOption(): boolean {
    return this.isRichTextBlock() || this.blockType() === 'heading';
  }

  getDialogTitle(): string {
    const v = this.blockVariant();
    if (v === 'list-bullet') return this.translate.instant('admin.articles.editor.blocks.listBullet');
    if (v === 'list-ordered') return this.translate.instant('admin.articles.editor.blocks.listOrdered');
    if (v?.startsWith('separator')) return this.translate.instant('admin.articles.editor.blocks.separator');
    return this.translate.instant(
      'admin.articles.editor.blocks.' + this.blockType(),
    );
  }

  // ============ RICH TEXT ============

  execCommand(event: MouseEvent, command: string) {
    event.preventDefault();
    document.execCommand(command, false);
  }

  insertLink(event: MouseEvent) {
    event.preventDefault();
    const url = prompt('URL :');
    if (url) {
      document.execCommand('createLink', false, url);
    }
  }

  onRichTextInput(event: Event, controlName: string) {
    const el = event.target as HTMLDivElement;
    this.form.get(controlName)?.setValue(el.innerHTML, { emitEvent: false });
  }

  onTabChange(index: number) {
    if (index === 1 && this.isRichTextBlock() && !this.translationEditorsInit) {
      setTimeout(() => {
        if (this.editorFrRef) this.editorFrRef.nativeElement.innerHTML = this.form.get('content_fr')?.value || '';
        if (this.editorEnRef) this.editorEnRef.nativeElement.innerHTML = this.form.get('content_en')?.value || '';
        if (this.editorEsRef) this.editorEsRef.nativeElement.innerHTML = this.form.get('content_es')?.value || '';
        this.translationEditorsInit = true;
      }, 50);
    }
  }

  // ============ SOUND SEARCH ============

  private async loadSounds() {
    try {
      const sounds = await this.soundsService.fetchAllPublicSounds();
      this.allSounds.set(sounds);
      this.filteredSounds.set(sounds.slice(0, 20));
    } catch (error) {
      console.error('Error loading sounds:', error);
    }
  }

  private async loadSelectedSound(soundId: string) {
    try {
      const sounds = await this.soundsService.fetchAllPublicSounds();
      const found = sounds.find((s) => s.id === soundId);
      if (found) {
        this.selectedSound.set(found);
        this.soundSearchControl.setValue(found.title, { emitEvent: false });
      }
    } catch {
      // ignore
    }
  }

  selectSound(sound: Sound) {
    this.selectedSound.set(sound);
    this.soundSearchControl.setValue(sound.title, { emitEvent: false });
  }

  clearSound() {
    this.selectedSound.set(null);
    this.soundSearchControl.setValue('', { emitEvent: false });
  }

  // ============ IMAGE UPLOAD ============

  private async loadImagePreview(key: string) {
    try {
      const url = await this.articleService.getImageUrl(key);
      this.imagePreviewUrl.set(url);
    } catch {
      // ignore
    }
  }

  private imageKey: string | null = null;

  async onImageFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.uploadingImage.set(true);
    try {
      const { result } = this.articleService.uploadArticleImage(file);
      const { key } = await result;
      this.imageKey = key;

      const url = await this.articleService.getImageUrl(key);
      this.imagePreviewUrl.set(url);
    } catch (error) {
      console.error('Error uploading image:', error);
    } finally {
      this.uploadingImage.set(false);
    }
  }

  // ============ SAVE ============

  async save() {
    this.saving.set(true);

    try {
      const v = this.form.value;
      const type = this.blockType();

      // Build i18n records
      const buildI18n = (
        fr: string,
        en: string,
        es: string,
      ): Record<string, string> | undefined => {
        const obj: Record<string, string> = {};
        if (fr) obj['fr'] = fr;
        if (en) obj['en'] = en;
        if (es) obj['es'] = es;
        return Object.keys(obj).length > 0 ? obj : undefined;
      };

      // Build settings
      const settings: BlockSettings = {};
      if (type === 'heading') settings.level = v.level;
      if (type === 'image') {
        settings.align = v.align;
        settings.imageWidth = v.imageWidth;
      }

      // Text alignment for paragraphs, quotes, headings
      if (['paragraph', 'quote', 'heading'].includes(type) && v.align && v.align !== 'left') {
        settings.align = v.align;
      }

      // Quote attribution
      if (type === 'quote' && v.attribution) {
        settings.attribution = v.attribution;
      }

      // Variant (separator / list)
      const variant = this.blockVariant();
      if (variant) {
        // For separators, the user picks the sub-style in the dialog
        if (this.isSeparator()) {
          settings.variant = v.separatorStyle ?? 'separator';
        } else {
          settings.variant = variant;
        }
      }

      // Rich text detection: if content contains HTML tags, mark it
      if (this.isTypeText() && v.content && /<[a-z][\s\S]*>/i.test(v.content)) {
        settings.richText = true;
      }

      const payload: Record<string, unknown> = {
        articleId: this.data.articleId,
        order: this.data.order,
        type,
      };

      // Text content (heading, paragraph, quote, callout, lists)
      if (this.isTypeText() || this.isList()) {
        payload['content'] = v.content || undefined;
        payload['content_i18n'] = buildI18n(
          v.content_fr,
          v.content_en,
          v.content_es,
        );
      }

      // Sound block
      if (this.isTypeSound()) {
        payload['soundId'] = this.selectedSound()?.id ?? undefined;
        payload['soundCaption'] = v.soundCaption || undefined;
        payload['soundCaption_i18n'] = buildI18n(
          v.soundCaption_fr,
          v.soundCaption_en,
          v.soundCaption_es,
        );
      }

      // Image block
      if (this.isTypeImage()) {
        payload['imageKey'] =
          this.imageKey ?? this.data.block?.imageKey ?? undefined;
        payload['imageAlt'] = v.imageAlt || undefined;
        payload['imageAlt_i18n'] = buildI18n(
          v.imageAlt_fr,
          v.imageAlt_en,
          v.imageAlt_es,
        );
        payload['imageCaption'] = v.imageCaption || undefined;
        payload['imageCaption_i18n'] = buildI18n(
          v.imageCaption_fr,
          v.imageCaption_en,
          v.imageCaption_es,
        );
      }

      // Settings (only if relevant)
      if (Object.keys(settings).length > 0) {
        payload['settings'] = settings;
      }

      if (this.isEditMode()) {
        await this.articleService.updateBlock(
          this.data.block!.id,
          payload as any,
        );
      } else {
        await this.articleService.createBlock(payload as any);
      }

      this.dialogRef.close(true);
    } catch (error) {
      console.error('Error saving block:', error);
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
