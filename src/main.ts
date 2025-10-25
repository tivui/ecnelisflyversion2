import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';
import { Amplify } from 'aws-amplify';
import outputs from '../amplify_outputs.json';

// Configure Amplify avec la sortie backend générée
Amplify.configure(outputs);

bootstrapApplication(AppComponent, appConfig).catch((err) =>
  console.error(err),
);
