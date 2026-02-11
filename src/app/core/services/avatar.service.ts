import { Injectable } from '@angular/core';
import { createAvatar, Style } from '@dicebear/core';
import * as collection from '@dicebear/collection';

export interface AvatarStyleOption {
  key: string;
  label: string;
}

export interface AvatarColorOption {
  hex: string;
  label: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const STYLE_MAP: Record<string, Style<any>> = {
  initials: collection.initials,
  adventurer: collection.adventurer,
  adventurerNeutral: collection.adventurerNeutral,
  avataaars: collection.avataaars,
  avataaarsNeutral: collection.avataaarsNeutral,
  bottts: collection.bottts,
  botttsNeutral: collection.botttsNeutral,
  funEmoji: collection.funEmoji,
  identicon: collection.identicon,
  personas: collection.personas,
  pixelArt: collection.pixelArt,
  rings: collection.rings,
  shapes: collection.shapes,
  toonHead: collection.toonHead,
};

const DEFAULT_STYLE = 'initials';
const DEFAULT_BG_COLOR = '1976d2';

/** Predefined seeds used to generate variation galleries */
const VARIATION_SEEDS = [
  'Felix', 'Luna', 'Milo', 'Aria', 'Leo', 'Nova',
  'Zara', 'Kai', 'Iris', 'Axel', 'Cleo', 'Finn',
  'Sage', 'Ruby', 'Orion', 'Jade',
];

@Injectable({
  providedIn: 'root',
})
export class AvatarService {
  readonly availableStyles: AvatarStyleOption[] = [
    { key: 'initials', label: 'Initiales' },
    { key: 'adventurer', label: 'Adventurer' },
    { key: 'adventurerNeutral', label: 'Adventurer Neutral' },
    { key: 'avataaars', label: 'Avataaars' },
    { key: 'avataaarsNeutral', label: 'Avataaars Neutral' },
    { key: 'bottts', label: 'Bottts' },
    { key: 'botttsNeutral', label: 'Bottts Neutral' },
    { key: 'funEmoji', label: 'Fun Emoji' },
    { key: 'identicon', label: 'Identicon' },
    { key: 'personas', label: 'Personas' },
    { key: 'pixelArt', label: 'Pixel Art' },
    { key: 'rings', label: 'Rings' },
    { key: 'shapes', label: 'Shapes' },
    { key: 'toonHead', label: 'Toon Head' },
  ];

  readonly availableColors: AvatarColorOption[] = [
    { hex: '1976d2', label: 'Blue' },
    { hex: '0d47a1', label: 'Dark Blue' },
    { hex: '1e3a5f', label: 'Navy' },
    { hex: '3f51b5', label: 'Indigo' },
    { hex: '7c4dff', label: 'Violet' },
    { hex: '6a1b9a', label: 'Purple' },
    { hex: '00897b', label: 'Teal' },
    { hex: '2e7d32', label: 'Green' },
    { hex: 'F5A623', label: 'Orange' },
    { hex: 'c2410c', label: 'Coral' },
    { hex: 'b71c1c', label: 'Red' },
    { hex: '424242', label: 'Grey' },
  ];

  /** Get the list of predefined seeds for generating variations */
  getVariationSeeds(): string[] {
    return VARIATION_SEEDS;
  }

  generateAvatarUri(
    style: string | null | undefined,
    seed: string | null | undefined,
    fallbackSeed: string,
    bgColor?: string | null,
  ): string {
    const resolvedStyle = style && STYLE_MAP[style] ? style : DEFAULT_STYLE;
    const resolvedSeed = seed || fallbackSeed;
    const resolvedColor = bgColor || DEFAULT_BG_COLOR;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const options: Record<string, any> = { seed: resolvedSeed };

    if (resolvedStyle === 'initials') {
      options['backgroundColor'] = [resolvedColor];
      options['textColor'] = ['ffffff'];
    }

    const avatar = createAvatar(STYLE_MAP[resolvedStyle], options);

    return avatar.toDataUri();
  }
}
