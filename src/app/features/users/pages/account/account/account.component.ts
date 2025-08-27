import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AppUserService } from '../../../../../core/services/app-user.service';
import { AppUser, Theme } from '../../../../../core/models/app-user.model';
import { Language } from '../../../../../core/models/i18n.model';
import { Router } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-account',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatDividerModule,
    TranslatePipe,
    MatProgressSpinnerModule,
  ],
  templateUrl: './account.component.html',
  styleUrls: ['./account.component.scss'],
})
export class AccountComponent implements OnInit {
  private readonly appUserService = inject(AppUserService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);

  public appUser = signal<AppUser | null>(null);
  public saving = signal(false);

  public languages: Language[] = ['fr', 'en', 'es'];
  public themes: Theme[] = ['light', 'dark'];

  public accountForm = this.fb.group({
    username: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    firstName: [''],
    lastName: [''],
    country: [''],
    language: ['', Validators.required],
    theme: ['', Validators.required],
  });

  async ngOnInit() {
    const user = await this.appUserService.loadCurrentUser();
    this.appUser.set(user);

    if (user) {
      this.accountForm.patchValue({
        username: user.username ?? '',
        email: user.email ?? '',
        country: user.country ?? '',
        language: user.language,
        theme: user.theme,
      });
    }
  }

  async save() {
    if (!this.accountForm.valid || !this.accountForm.dirty || !this.appUser())
      return;

    this.saving.set(true);
    const values = this.accountForm.value;

    try {
      await this.appUserService.updateLanguage(values.language as Language);
      await this.appUserService.updateTheme(values.theme as Theme);

      const updatedUser = await this.appUserService.updateProfile({
        username: values.username ?? '',
        email: values.email ?? '',
        country: values.country ?? null,
      });

      if (updatedUser) {
        this.translate.use(values.language as Language);
      }

      // Navigate after successful save
      this.router.navigate(['/home']);
    } catch (err) {
      console.error('Failed to save profile', err);
    } finally {
      this.saving.set(false);
    }
  }
}
