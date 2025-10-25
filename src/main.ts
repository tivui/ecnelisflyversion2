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

// 🔹 Cette partie JS permet de corriger le problème des barres de navigation mobiles
// qui recouvrent parfois le contenu. On calcule la vraie hauteur visible du viewport.
function setRealVh() {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--real-vh', `${vh}px`);
}
setRealVh();
window.addEventListener('resize', setRealVh);
window.addEventListener('orientationchange', setRealVh);
