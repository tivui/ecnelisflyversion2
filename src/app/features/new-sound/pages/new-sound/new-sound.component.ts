import { Component, inject, signal, OnDestroy, HostListener } from '@angular/core';
import {
  FormBuilder,
  Validators,
  FormsModule,
  ReactiveFormsModule,
} from '@angular/forms';
import { BreakpointObserver } from '@angular/cdk/layout';
import {
  StepperOrientation,
  MatStepperModule,
} from '@angular/material/stepper';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { AsyncPipe } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { SoundUploadStepComponent } from './widgets/sound-upload-step/sound-upload-step.component';
import {
  PlaceSelection,
  PlaceStepComponent,
} from './widgets/place-step/place-step.component';
import { SoundDataStepComponent } from "./widgets/sound-data-step/sound-data-step.component";
import { SoundDataMetaStepComponent } from "./widgets/sound-data-meta-step/sound-data-meta-step.component";
import { SoundDataInfoStepComponent } from "./widgets/sound-data-info-step/sound-data-info-step.component";
import { ConfirmationStepComponent } from "./widgets/confirmation-step/confirmation-step.component";
import { StorageService } from '../../../../core/services/storage.service';

@Component({
  selector: 'app-new-sound',
  standalone: true,
  imports: [
    MatStepperModule,
    FormsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    AsyncPipe,
    TranslateModule,
    SoundUploadStepComponent,
    PlaceStepComponent,
    SoundDataStepComponent,
    SoundDataMetaStepComponent,
    SoundDataInfoStepComponent,
    ConfirmationStepComponent
],
  templateUrl: './new-sound.component.html',
  styleUrl: './new-sound.component.scss',
})
export class NewSoundComponent implements OnDestroy {
  private _formBuilder = inject(FormBuilder);
  private storageService = inject(StorageService);

  readonly soundUploaded = signal(false);
  readonly soundPath = signal<string | null>(null);
  readonly confirmed = signal(false);

  readonly selectedPlace = signal<PlaceSelection | null>(null);

  readonly highlightedSteps = signal<number[]>([]);

  firstFormGroup = this._formBuilder.group({
    firstCtrl: ['', Validators.required],
  });
  secondFormGroup = this._formBuilder.group({
    secondCtrl: ['', Validators.required],
  });
  thirdFormGroup = this._formBuilder.group({
    thirdCtrl: ['', Validators.required],
  });
  fourthFormGroup = this._formBuilder.group({
    fourthCtrl: ['', Validators.required],
  });
  stepperOrientation: Observable<StepperOrientation>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  soundInfoData: any = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  soundMetaData: any = {};

  constructor() {
    const breakpointObserver = inject(BreakpointObserver);

    this.stepperOrientation = breakpointObserver
      .observe('(min-width: 800px)')
      .pipe(map(({ matches }) => (matches ? 'horizontal' : 'vertical')));
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.soundPath() && !this.confirmed()) {
      event.preventDefault();
    }
  }

  ngOnDestroy(): void {
    if (this.soundPath() && !this.confirmed()) {
      this.cleanupFile(this.soundPath()!);
    }
  }

  onSoundUploaded(path: string) {
    // Si un fichier précédent existe (re-upload), supprimer l'ancien
    const previousPath = this.soundPath();
    if (previousPath && previousPath !== path) {
      this.cleanupFile(previousPath);
    }

    this.soundPath.set(path);
    this.soundUploaded.set(true);
  }

  onPlaceSelected(place: PlaceSelection) {
    console.log('Place selected:', place);
    this.selectedPlace.set(place);
  }

  
  // Step 3A : Sound Info
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSoundDataInfoCompleted(data: any) {
    console.log('Sound Info:', data);
    this.soundInfoData = data;
    // Marquer stepGroup valide si nécessaire
    this.thirdFormGroup.setValue({ thirdCtrl: '' });
  }

  // Step 3B : Links & Meta
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSoundDataMetaCompleted(data: any) {
    console.log('Sound Meta:', data);
    this.soundMetaData = data;
    this.fourthFormGroup.setValue({ fourthCtrl: '' });
  }

  // Optionnel : récupérer toutes les données avant confirmation
  getAllSoundData() {
    return {
      soundPath: this.soundPath(),
      place: this.selectedPlace(),
      ...this.soundInfoData,
      ...this.soundMetaData,
    };
  }

  // Confirmation callbacks
  onConfirmed() {
    console.log('Sound confirmed and saved!');
    this.confirmed.set(true);
  }

  onCancelled() {
    console.log('Sound creation cancelled');
    if (this.soundPath()) {
      this.cleanupFile(this.soundPath()!);
      this.soundPath.set(null);
      this.soundUploaded.set(false);
    }
  }

  onHighlightSteps(stepIndices: number[]) {
    this.highlightedSteps.set(stepIndices);
  }

  isStepHighlighted(index: number): boolean {
    return this.highlightedSteps().includes(index);
  }

  /**
   * Supprime un fichier S3 orphelin via Lambda (fire-and-forget)
   */
  private cleanupFile(filename: string): void {
    this.storageService.deleteSound(filename).then((success) => {
      if (success) {
        console.log(`[NewSound] Cleaned up orphan file: ${filename}`);
      } else {
        console.warn(`[NewSound] Failed to clean up: ${filename}`);
      }
    });
  }
}
