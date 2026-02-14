import { Injectable, signal } from '@angular/core';
import { Sound } from '../models/sound.model';

@Injectable({ providedIn: 'root' })
export class EphemeralJourneyService {
  private _sounds = signal<Sound[]>([]);
  private _name = signal('');
  private _color = signal('#e67e22');

  readonly sounds = this._sounds.asReadonly();
  readonly name = this._name.asReadonly();
  readonly color = this._color.asReadonly();

  set(sounds: Sound[], name: string, color: string): void {
    this._sounds.set(sounds);
    this._name.set(name);
    this._color.set(color);
  }

  clear(): void {
    this._sounds.set([]);
    this._name.set('');
    this._color.set('#e67e22');
  }

  hasData(): boolean {
    return this._sounds().length > 0;
  }
}
