import { Component, computed, inject, input } from '@angular/core';
import { AvatarService } from '../../../core/services/avatar.service';

@Component({
  selector: 'app-user-avatar',
  standalone: true,
  template: `
    <img
      [src]="avatarUri()"
      [alt]="username()"
      [style.width]="size()"
      [style.height]="size()"
    />
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      line-height: 0;
      vertical-align: middle;
    }
    img {
      border-radius: 50%;
      object-fit: cover;
      display: block;
    }
  `,
})
export class UserAvatarComponent {
  private readonly avatarService = inject(AvatarService);

  username = input.required<string>();
  avatarStyle = input<string | null | undefined>(null);
  avatarSeed = input<string | null | undefined>(null);
  avatarBgColor = input<string | null | undefined>(null);
  size = input<string>('32px');

  avatarUri = computed(() =>
    this.avatarService.generateAvatarUri(
      this.avatarStyle(),
      this.avatarSeed(),
      this.username(),
      this.avatarBgColor(),
    ),
  );
}
