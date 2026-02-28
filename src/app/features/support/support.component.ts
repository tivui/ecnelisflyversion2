import { Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
    selector: 'app-support',
    imports: [MatIconModule, MatButtonModule, TranslatePipe],
    templateUrl: './support.component.html',
    styleUrl: './support.component.scss'
})
export class SupportComponent {
  readonly kofiUrl = 'https://ko-fi.com/ecnelisfly';
  readonly bmcUrl = 'https://buymeacoffee.com/ecnelisfly';

  openKofi() {
    window.open(this.kofiUrl, '_blank', 'noopener,noreferrer');
  }

  openBmc() {
    window.open(this.bmcUrl, '_blank', 'noopener,noreferrer');
  }
}
