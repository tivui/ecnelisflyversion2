import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import { PwaInstallService } from '../../../core/services/pwa-install.service';

@Component({
  selector: 'app-pwa-install-banner',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, TranslatePipe],
  templateUrl: './pwa-install-banner.component.html',
  styleUrls: ['./pwa-install-banner.component.scss'],
})
export class PwaInstallBannerComponent {
  private readonly pwaService = inject(PwaInstallService);

  readonly visible = computed(
    () =>
      this.pwaService.canInstall() &&
      !this.pwaService.dismissed() &&
      !this.pwaService.isStandalone()
  );

  async install() {
    await this.pwaService.promptInstall();
  }

  dismiss() {
    this.pwaService.dismiss();
  }
}
