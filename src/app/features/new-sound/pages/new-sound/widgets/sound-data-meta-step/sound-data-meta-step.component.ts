import { Component, EventEmitter, Output, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  FormControl,
} from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import {
  DateAdapter,
  MAT_DATE_LOCALE,
  MatNativeDateModule,
} from '@angular/material/core';

import { AmplifyService } from '../../../../../../core/services/amplify.service';
import { LanguageDetectionService } from '../../../../../../core/services/language-detection.service';

import {
  LicenseType,
  SoundStatus,
} from '../../../../../../core/models/sound.model';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'app-sound-data-meta-step',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatAutocompleteModule,
    TranslateModule,
    MatSelectModule,
    MatTooltipModule,
    MatDatepickerModule,
    MatNativeDateModule
  ],
  providers: [
    {
      provide: MAT_DATE_LOCALE,
      useFactory: (translate: TranslateService) => translate.getCurrentLang(),
      deps: [TranslateService],
    },
  ],
  templateUrl: './sound-data-meta-step.component.html',
  styleUrl: './sound-data-meta-step.component.scss',
})
export class SoundDataMetaStepComponent implements OnInit {
  private fb = inject(FormBuilder);
  private snackBar = inject(MatSnackBar);
  private languageDetectionService = inject(LanguageDetectionService);
  private dialog = inject(MatDialog);
  private amplifyService = inject(AmplifyService);
  private translate = inject(TranslateService);
  private dateAdapter = inject(DateAdapter<Date>);

  /* ================= OUTPUT ================= */

  @Output() completed = new EventEmitter<{
    url?: string;
    urlTitle?: string;
    secondaryUrl?: string;
    secondaryUrlTitle?: string;
    license: LicenseType;
    status: SoundStatus;
    hashtags?: string;
  }>();

  /* ================= FORM ================= */

  statusControl = new FormControl<SoundStatus>('public', Validators.required);
  licenseControl = new FormControl<LicenseType | null>(
    'CC_BY',
    Validators.required,
  );

  form: FormGroup = this.fb.group({
    url: ['', [Validators.pattern('https?://.+')]],
    urlTitle: ['', [Validators.maxLength(100)]],
    secondaryUrl: ['', [Validators.pattern('https?://.+')]],
    secondaryUrlTitle: ['', [Validators.maxLength(100)]],
    status: this.statusControl,
    license: this.licenseControl,
    hashtags: ['', [Validators.maxLength(200)]],
  });

  /* ================= INIT ================= */

  ngOnInit() {
    // Subscribe to form value changes to emit completed data
    this.form.valueChanges.subscribe(() => {
      this.emitCompleted();
    });

    // Subscribe to license control changes
    this.licenseControl.valueChanges.subscribe(() => {
      this.emitCompleted();
    });

    // Emit initial values
    this.emitCompleted();
  }

  /* ================= EMIT ================= */

  private emitCompleted() {
    this.completed.emit({
      url: this.form.value.url?.trim() || undefined,
      urlTitle: this.form.value.urlTitle?.trim() || undefined,
      secondaryUrl: this.form.value.secondaryUrl?.trim() || undefined,
      secondaryUrlTitle: this.form.value.secondaryUrlTitle?.trim() || undefined,
      license: this.licenseControl.value || 'CC_BY',
      status: this.statusControl.value || 'public',
      hashtags: this.form.value.hashtags?.trim() || undefined,
    });
  }

  onStatusChange() {
    const value = this.statusControl.value;
    // If user selects "public", change to "public_to_be_approved" and show a snackbar
    if (value === 'public') {
      this.statusControl.setValue('public_to_be_approved', {
        emitEvent: false,
      });
      this.snackBar.open(
        this.translate.instant('categories.statusPending'),
        'OK',
        { duration: 3000 },
      );
    }
    this.emitCompleted();
  }

  licenseOptions = [
    {
      value: 'READ_ONLY' as LicenseType,
      label: 'sound.licenses.READ_ONLY',
      tooltip: 'sound.licenses.READ_ONLY_tooltip',
    },
    {
      value: 'PUBLIC_DOMAIN' as LicenseType,
      label: 'sound.licenses.PUBLIC_DOMAIN',
      tooltip: 'sound.licenses.PUBLIC_DOMAIN_tooltip',
    },
    {
      value: 'CC_BY' as LicenseType,
      label: 'sound.licenses.CC_BY',
      tooltip: 'sound.licenses.CC_BY_tooltip',
    },
    {
      value: 'CC_BY_NC' as LicenseType,
      label: 'sound.licenses.CC_BY_NC',
      tooltip: 'sound.licenses.CC_BY_NC_tooltip',
    },
  ];

  onHashtagInput(event: Event) {
    const input = event.target as HTMLInputElement;
    let value = input.value;

    // If user has typed a space, add # at the beginning of each word except the last one
    const words = value.split(' ');

    for (let i = 0; i < words.length - 1; i++) {
      if (!words[i].startsWith('#') && words[i].trim() !== '') {
        words[i] = `#${words[i]}`;
      }
    }

    // Reconstruct the value with the last word intact (in progress of typing)
    value = words.join(' ');

    this.form.get('hashtags')?.setValue(value, { emitEvent: false });
  }
}
