import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AmplifyAuthenticatorModule } from '@aws-amplify/ui-angular';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, AmplifyAuthenticatorModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent {}
