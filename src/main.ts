/* eslint-disable @typescript-eslint/no-explicit-any */
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config'
import { Amplify } from 'aws-amplify';
import outputs from '../amplify_outputs.json';
import 'leaflet';
import 'leaflet.markercluster';
import * as L from 'leaflet';
(window as any).L = L;
import 'leaflet-search';
import 'leaflet.featuregroup.subgroup/dist/leaflet.featuregroup.subgroup.js';

const Lc = (L as any).markerClusterGroup;
if (!Lc) {
  console.warn('MarkerClusterGroup not found on L, trying global');
  (L as any).markerClusterGroup = (window as any).L.markerClusterGroup;
}

// Configure Amplify avec la sortie backend générée
Amplify.configure(outputs);

bootstrapApplication(AppComponent, appConfig)
  .catch(err => console.error(err));
