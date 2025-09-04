import { Component, inject } from '@angular/core';
import { AmplifyService } from '../../../../core/services/amplify.service';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIcon } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-import-sounds',
  standalone: true,
  imports: [MatFormFieldModule, MatInputModule, MatIcon, MatButtonModule],
  templateUrl: './import-sounds.component.html',
  styleUrl: './import-sounds.component.scss',
})
export class ImportSoundsComponent {
  private readonly amplify = inject(AmplifyService);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fileContent: any = null;
  isLoading = false;
  message = '';
  fileName = '';

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    this.fileName = file.name;
    const reader = new FileReader();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    reader.onload = async (e: any) => {
      try {
        const json = JSON.parse(e.target.result as string);

        this.isLoading = true;
        const client = this.amplify.client;

        const result = await client.mutations.importSounds({
          fileContent: JSON.stringify({ sounds: json }),
        });

        this.message = `Import réussi : ${JSON.stringify(result)}`;
      } catch (error) {
        console.error('Erreur import JSON', error);
        this.message = 'Erreur pendant l’import.';
      } finally {
        this.isLoading = false;
      }
    };

    reader.readAsText(file);
  }
}
