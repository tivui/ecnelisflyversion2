import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config'
import { Amplify } from 'aws-amplify';
import outputs from '../amplify_outputs.json';
import 'leaflet';
import 'leaflet.markercluster';
import * as L from 'leaflet';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).L = L;
import 'leaflet-search';
import 'leaflet.featuregroup.subgroup/dist/leaflet.featuregroup.subgroup.js';

// Configure Amplify avec la sortie backend générée
Amplify.configure(outputs);

bootstrapApplication(AppComponent, appConfig)
  .catch(err => console.error(err));
