import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';
import { Amplify } from 'aws-amplify';
import outputs from '../amplify_outputs.json';
import {register as registerSwiperElements} from 'swiper/element/bundle'

// Configure Amplify avec la sortie backend générée
Amplify.configure(outputs);

registerSwiperElements();

bootstrapApplication(AppComponent, appConfig).catch((err) =>
  console.error(err),
);
