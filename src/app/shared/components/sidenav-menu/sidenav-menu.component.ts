import { Component, inject, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { MatIconModule } from '@angular/material/icon';
import { MatRippleModule } from '@angular/material/core';

@Component({
  selector: 'app-sidenav-menu',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    TranslateModule,
    MatIconModule,
    MatRippleModule,
  ],
  templateUrl: './sidenav-menu.component.html',
  styleUrl: './sidenav-menu.component.scss',
})
export class SidenavMenuComponent {
  closed = output<void>();

  menuItems = [
    {
      icon: 'public',
      labelKey: 'sidenav.worldMap',
      route: '/mapfly',
      queryParams: {},
    },
    {
      icon: 'location_on',
      labelKey: 'sidenav.discoverZones',
      route: '/zones',
      queryParams: {},
    },
  ];

  close() {
    this.closed.emit();
  }

  onItemClick() {
    this.close();
  }
}
