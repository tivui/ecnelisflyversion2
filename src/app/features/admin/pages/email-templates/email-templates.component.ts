import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DomSanitizer } from '@angular/platform-browser';

import { AmplifyService } from '../../../../core/services/amplify.service';

type TemplateType = 'VERIFY_EMAIL' | 'FORGOT_PASSWORD';

interface TemplateOption {
  value: TemplateType;
  labelKey: string;
}

const DEFAULT_SUBJECT_VERIFY = 'Vérifiez votre compte Ecnelis FLY 🎧';
const DEFAULT_BODY_VERIFY = `<html><head><meta charset="UTF-8"><style>
body{font-family:sans-serif;background:#f1f2f6;margin:0;padding:20px}
.card{max-width:480px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.1)}
.header{background:linear-gradient(135deg,#1976d2,#3f51b5,#7e57c2);padding:32px 24px;text-align:center}
.logo{height:52px}
.title{color:#fff;font-size:1.3rem;font-weight:800;margin:10px 0 0}
.body{padding:32px 24px;color:#333}
.code{display:block;font-size:2rem;font-weight:900;text-align:center;letter-spacing:10px;color:#1976d2;background:#e3f2fd;border-radius:12px;padding:16px;margin:24px 0}
.note{font-size:.82rem;color:#888}
.footer{background:#f8f9fa;padding:12px 24px;text-align:center;font-size:.75rem;color:#aaa}
a{color:#1976d2;text-decoration:none}
</style></head><body>
<div class="card">
  <div class="header">
    <img src="https://www.ecnelisfly.com/img/logos/logo_blue_orange_left_round.png" alt="Ecnelis FLY" class="logo">
    <div class="title">🎧 Ecnelis FLY</div>
  </div>
  <div class="body">
    <p>Merci de rejoindre <strong>Ecnelis FLY</strong>, la plateforme d'exploration sonore géolocalisée.</p>
    <p>Votre code de vérification est :</p>
    <span class="code">{####}</span>
    <p class="note">Ce code expire dans 24 heures. Si vous n'avez pas créé de compte, ignorez cet email.</p>
  </div>
  <div class="footer">© 2021-2026 Ecnelis FLY · <a href="https://www.ecnelisfly.com">ecnelisfly.com</a></div>
</div>
</body></html>`;

const DEFAULT_SUBJECT_FORGOT = 'Réinitialisez votre mot de passe Ecnelis FLY';
const DEFAULT_BODY_FORGOT = `<html><head><meta charset="UTF-8"><style>
body{font-family:sans-serif;background:#f1f2f6;margin:0;padding:20px}
.card{max-width:480px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.1)}
.header{background:linear-gradient(135deg,#1976d2,#3f51b5,#7e57c2);padding:32px 24px;text-align:center}
.logo{height:52px}
.title{color:#fff;font-size:1.3rem;font-weight:800;margin:10px 0 0}
.body{padding:32px 24px;color:#333}
.code{display:block;font-size:2rem;font-weight:900;text-align:center;letter-spacing:10px;color:#1976d2;background:#e3f2fd;border-radius:12px;padding:16px;margin:24px 0}
.note{font-size:.82rem;color:#888}
.footer{background:#f8f9fa;padding:12px 24px;text-align:center;font-size:.75rem;color:#aaa}
a{color:#1976d2;text-decoration:none}
</style></head><body>
<div class="card">
  <div class="header">
    <img src="https://www.ecnelisfly.com/img/logos/logo_blue_orange_left_round.png" alt="Ecnelis FLY" class="logo">
    <div class="title">🎧 Ecnelis FLY</div>
  </div>
  <div class="body">
    <p>Vous avez demandé la réinitialisation de votre mot de passe <strong>Ecnelis FLY</strong>.</p>
    <p>Votre code de réinitialisation est :</p>
    <span class="code">{####}</span>
    <p class="note">Ce code expire dans 1 heure. Si vous n'avez pas fait cette demande, ignorez cet email.</p>
  </div>
  <div class="footer">© 2021-2026 Ecnelis FLY · <a href="https://www.ecnelisfly.com">ecnelisfly.com</a></div>
</div>
</body></html>`;

@Component({
    selector: 'app-email-templates',
    imports: [
        CommonModule,
        FormsModule,
        MatFormFieldModule,
        MatSelectModule,
        MatInputModule,
        MatButtonModule,
        MatIconModule,
        MatProgressSpinnerModule,
        MatTooltipModule,
        TranslateModule,
    ],
    templateUrl: './email-templates.component.html',
    styleUrl: './email-templates.component.scss'
})
export class EmailTemplatesComponent implements OnInit {
  private readonly amplify = inject(AmplifyService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);
  private readonly sanitizer = inject(DomSanitizer);

  readonly templateOptions: TemplateOption[] = [
    { value: 'VERIFY_EMAIL', labelKey: 'admin.emailTemplates.verifyEmail' },
    { value: 'FORGOT_PASSWORD', labelKey: 'admin.emailTemplates.forgotPassword' },
  ];

  selectedType = signal<TemplateType>('VERIFY_EMAIL');
  subject = signal('');
  bodyHtml = signal('');
  loading = signal(false);
  saving = signal(false);
  showPreview = signal(false);
  existingTemplateFound = signal(false);

  hasPlaceholder = computed(() => this.bodyHtml().includes('{####}'));

  previewSrcdoc = computed(() =>
    this.sanitizer.bypassSecurityTrustHtml(
      this.bodyHtml().replace(/{####}/g, '123456'),
    ),
  );

  private getDefaults(type: TemplateType): { subject: string; bodyHtml: string } {
    if (type === 'VERIFY_EMAIL') {
      return { subject: DEFAULT_SUBJECT_VERIFY, bodyHtml: DEFAULT_BODY_VERIFY };
    }
    return { subject: DEFAULT_SUBJECT_FORGOT, bodyHtml: DEFAULT_BODY_FORGOT };
  }

  async ngOnInit() {
    await this.loadTemplate();
  }

  async onTypeChange(type: TemplateType) {
    this.selectedType.set(type);
    this.showPreview.set(false);
    await this.loadTemplate();
  }

  async loadTemplate() {
    this.loading.set(true);
    this.existingTemplateFound.set(false);
    try {
      const result = await (this.amplify.client as any).models.EmailTemplate.get({
        templateType: this.selectedType(),
      });
      if (result?.data) {
        this.subject.set(result.data.subject ?? '');
        this.bodyHtml.set(result.data.bodyHtml ?? '');
        this.existingTemplateFound.set(true);
      } else {
        const defaults = this.getDefaults(this.selectedType());
        this.subject.set(defaults.subject);
        this.bodyHtml.set(defaults.bodyHtml);
      }
    } catch (e) {
      console.error('[EmailTemplates] load failed:', e);
      const defaults = this.getDefaults(this.selectedType());
      this.subject.set(defaults.subject);
      this.bodyHtml.set(defaults.bodyHtml);
    } finally {
      this.loading.set(false);
    }
  }

  async save() {
    if (!this.hasPlaceholder()) return;
    this.saving.set(true);
    try {
      const payload = {
        templateType: this.selectedType(),
        subject: this.subject(),
        bodyHtml: this.bodyHtml(),
        updatedBy: 'admin',
      };
      if (this.existingTemplateFound()) {
        await (this.amplify.client as any).models.EmailTemplate.update(payload);
      } else {
        await (this.amplify.client as any).models.EmailTemplate.create(payload);
        this.existingTemplateFound.set(true);
      }
      this.snackBar.open(
        this.translate.instant('admin.emailTemplates.saveSuccess'),
        undefined,
        { duration: 3000 },
      );
    } catch (e) {
      console.error('[EmailTemplates] save failed:', e);
      this.snackBar.open(
        this.translate.instant('admin.emailTemplates.saveError'),
        undefined,
        { duration: 3000 },
      );
    } finally {
      this.saving.set(false);
    }
  }

  restoreDefault() {
    const defaults = this.getDefaults(this.selectedType());
    this.subject.set(defaults.subject);
    this.bodyHtml.set(defaults.bodyHtml);
    this.existingTemplateFound.set(false);
  }

  togglePreview() {
    this.showPreview.update(v => !v);
  }
}
