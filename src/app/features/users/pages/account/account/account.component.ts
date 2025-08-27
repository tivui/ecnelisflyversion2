import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AppUserService } from '../../../../../core/services/app-user.service';
import { AppUser, Theme } from '../../../../../core/models/app-user.model';
import { Language } from '../../../../../core/models/i18n.model';
import { Router } from '@angular/router';

import * as countries from 'i18n-iso-countries';
import enLocale from 'i18n-iso-countries/langs/en.json';
import frLocale from 'i18n-iso-countries/langs/fr.json';
import esLocale from 'i18n-iso-countries/langs/es.json';

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
    MatAutocompleteModule,
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

  // Main form definition
  public accountForm = this.fb.group({
    username: ['', Validators.required],
    firstName: [''],
    lastName: [''],
    country: ['', Validators.required],
    language: ['', Validators.required],
    theme: ['', Validators.required],
  });

  // Country options and filtered results for autocomplete
  public countryOptions: { code: string; name: string }[] = [];
  public filteredCountriesSignal = signal<{ code: string; name: string }[]>([]);

  ngOnInit() {
    // Register available locales
    countries.registerLocale(enLocale);
    countries.registerLocale(frLocale);
    countries.registerLocale(esLocale);

    // Load default country list in English
    this.updateCountryList('en');

    // Load current user and patch form values
    this.appUserService.loadCurrentUser().then((user) => {
      this.appUser.set(user);
      if (user) {
        this.accountForm.patchValue({
          username: user.username ?? '',
          firstName: user.firstName ?? '',
          lastName: user.lastName ?? '',
          country: user.country ?? '',
          language: user.language,
          theme: user.theme,
        });
      }
    });

    // Listen to country input changes for filtering
    this.accountForm.get('country')!.valueChanges.subscribe((val: string | null) => {
      const filter = (val ?? '').toLowerCase();
      this.filteredCountriesSignal.set(
        this.countryOptions.filter((c) => c.name.toLowerCase().includes(filter))
      );
    });

    // Update country names when language changes
    this.accountForm.get('language')?.valueChanges.subscribe((lang) => {
      this.updateCountryList(lang as Language);
    });
  }

  // Build the list of countries for the given language
  private updateCountryList(lang: Language) {
    let locale = 'en';
    if (lang === 'fr') locale = 'fr';
    if (lang === 'es') locale = 'es';

    this.countryOptions = Object.entries(countries.getNames(locale)).map(
      ([code, name]) => ({ code, name })
    );

    // Apply filtering based on current country field value
    const val = this.accountForm.get('country')?.value || '';
    this.filteredCountriesSignal.set(
      this.countryOptions.filter((c) =>
        c.name.toLowerCase().includes(val.toLowerCase())
      )
    );
  }

  // Save the form and update user profile
  async save() {
    if (!this.accountForm.valid || !this.accountForm.dirty || !this.appUser()) return;

    this.saving.set(true);
    const values = this.accountForm.value;

    try {
      await this.appUserService.updateLanguage(values.language as Language);
      await this.appUserService.updateTheme(values.theme as Theme);

      const updatedUser = await this.appUserService.updateProfile({
        username: values.username ?? '',
        country: values.country ?? null,
      });

      if (updatedUser) {
        this.translate.use(values.language as Language);
      }

      this.router.navigate(['/home']);
    } catch (err) {
      console.error('Failed to save profile', err);
    } finally {
      this.saving.set(false);
    }
  }

  // Get country name by its code
  countryName(code?: string | null): string {
    return this.countryOptions.find((c) => c.code === code)?.name || '';
  }

  // Called when a country is selected from the dropdown
  onCountrySelected(code: string) {
    this.accountForm.get('country')?.setValue(code);
  }
}
