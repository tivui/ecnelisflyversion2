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

export type DimensionType = 'variant' | 'color';

export interface StyleDimension {
  key: string;
  labelKey: string;
  type: DimensionType;
  variants?: string[];
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

const STYLE_OPTIONS: Record<string, StyleDimension[]> = {
  initials: [
    { key: 'backgroundColor', labelKey: 'account.avatar.options.backgroundColor', type: 'color' },
  ],
  toonHead: [
    { key: 'eyes', labelKey: 'account.avatar.options.eyes', type: 'variant', variants: ['happy', 'wide', 'bow', 'humble', 'wink'] },
    { key: 'mouth', labelKey: 'account.avatar.options.mouth', type: 'variant', variants: ['laugh', 'angry', 'agape', 'smile', 'sad'] },
    { key: 'hair', labelKey: 'account.avatar.options.hair', type: 'variant', variants: ['sideComed', 'undercut', 'spiky', 'bun'] },
    { key: 'clothes', labelKey: 'account.avatar.options.clothes', type: 'variant', variants: ['turtleNeck', 'openJacket', 'dress', 'shirt', 'tShirt'] },
    { key: 'skinColor', labelKey: 'account.avatar.options.skinColor', type: 'color' },
    { key: 'hairColor', labelKey: 'account.avatar.options.hairColor', type: 'color' },
    { key: 'clothesColor', labelKey: 'account.avatar.options.clothesColor', type: 'color' },
  ],
  bottts: [
    { key: 'eyes', labelKey: 'account.avatar.options.eyes', type: 'variant', variants: ['bulging', 'dizzy', 'eva', 'frame1', 'frame2', 'glow', 'happy', 'hearts', 'robocop', 'round', 'roundFrame01', 'roundFrame02', 'sensor', 'shade01'] },
    { key: 'mouth', labelKey: 'account.avatar.options.mouth', type: 'variant', variants: ['bite', 'diagram', 'grill01', 'grill02', 'grill03', 'smile01', 'smile02', 'square01', 'square02'] },
    { key: 'face', labelKey: 'account.avatar.options.face', type: 'variant', variants: ['round01', 'round02', 'square01', 'square02', 'square03', 'square04'] },
    { key: 'baseColor', labelKey: 'account.avatar.options.baseColor', type: 'color' },
  ],
  botttsNeutral: [
    { key: 'eyes', labelKey: 'account.avatar.options.eyes', type: 'variant', variants: ['bulging', 'dizzy', 'eva', 'frame1', 'frame2', 'glow', 'happy', 'hearts', 'robocop', 'round', 'roundFrame01', 'roundFrame02', 'sensor', 'shade01'] },
    { key: 'mouth', labelKey: 'account.avatar.options.mouth', type: 'variant', variants: ['bite', 'diagram', 'grill01', 'grill02', 'grill03', 'smile01', 'smile02', 'square01', 'square02'] },
    { key: 'backgroundColor', labelKey: 'account.avatar.options.backgroundColor', type: 'color' },
  ],
  funEmoji: [
    { key: 'eyes', labelKey: 'account.avatar.options.eyes', type: 'variant', variants: ['sad', 'tearDrop', 'pissed', 'cute', 'wink', 'wink2', 'plain', 'glasses', 'closed', 'love', 'stars', 'shades', 'closed2', 'crying', 'sleepClose'] },
    { key: 'mouth', labelKey: 'account.avatar.options.mouth', type: 'variant', variants: ['plain', 'lilSmile', 'sad', 'shy', 'cute', 'wideSmile', 'shout', 'smileTeeth', 'smileLol', 'pissed', 'drip', 'tongueOut', 'kissHeart', 'sick', 'faceMask'] },
    { key: 'backgroundColor', labelKey: 'account.avatar.options.backgroundColor', type: 'color' },
  ],
  personas: [
    { key: 'eyes', labelKey: 'account.avatar.options.eyes', type: 'variant', variants: ['open', 'sleep', 'wink', 'glasses', 'happy', 'sunglasses'] },
    { key: 'mouth', labelKey: 'account.avatar.options.mouth', type: 'variant', variants: ['smile', 'frown', 'surprise', 'pacifier', 'bigSmile', 'smirk', 'lips'] },
    { key: 'body', labelKey: 'account.avatar.options.body', type: 'variant', variants: ['squared', 'rounded', 'small', 'checkered'] },
    { key: 'skinColor', labelKey: 'account.avatar.options.skinColor', type: 'color' },
    { key: 'hairColor', labelKey: 'account.avatar.options.hairColor', type: 'color' },
    { key: 'clothingColor', labelKey: 'account.avatar.options.clothingColor', type: 'color' },
  ],
  avataaars: [
    { key: 'eyes', labelKey: 'account.avatar.options.eyes', type: 'variant', variants: ['closed', 'cry', 'default', 'eyeRoll', 'happy', 'hearts', 'side', 'squint', 'surprised', 'winkWacky', 'wink', 'xDizzy'] },
    { key: 'mouth', labelKey: 'account.avatar.options.mouth', type: 'variant', variants: ['concerned', 'default', 'disbelief', 'eating', 'grimace', 'sad', 'screamOpen', 'serious', 'smile', 'tongue', 'twinkle', 'vomit'] },
    { key: 'skinColor', labelKey: 'account.avatar.options.skinColor', type: 'color' },
    { key: 'hairColor', labelKey: 'account.avatar.options.hairColor', type: 'color' },
  ],
  avataaarsNeutral: [
    { key: 'eyes', labelKey: 'account.avatar.options.eyes', type: 'variant', variants: ['closed', 'cry', 'default', 'eyeRoll', 'happy', 'hearts', 'side', 'squint', 'surprised', 'winkWacky', 'wink', 'xDizzy'] },
    { key: 'mouth', labelKey: 'account.avatar.options.mouth', type: 'variant', variants: ['concerned', 'default', 'disbelief', 'eating', 'grimace', 'sad', 'screamOpen', 'serious', 'smile', 'tongue', 'twinkle', 'vomit'] },
    { key: 'backgroundColor', labelKey: 'account.avatar.options.backgroundColor', type: 'color' },
  ],
};

const SKIN_COLORS = ['f8d5c2', 'e8beac', 'd08b5b', 'ae5d29', '614335'];
const HAIR_COLORS = ['f2d35c', 'c68642', '724133', '4a312c', '2c1b18', 'b7b7b7'];
const GENERAL_COLORS = [
  '1976d2', '0d47a1', '3f51b5', '7c4dff', '6a1b9a',
  '00897b', '2e7d32', 'F5A623', 'c2410c', 'b71c1c', '424242',
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

  /** Get the customizable dimensions for a given style */
  getStyleDimensions(styleKey: string): StyleDimension[] {
    return STYLE_OPTIONS[styleKey] ?? [];
  }

  /** Get the color palette appropriate for a given dimension key */
  getColorPalette(dimensionKey: string): string[] {
    if (dimensionKey.includes('skin') || dimensionKey === 'skinColor') return SKIN_COLORS;
    if (dimensionKey.includes('hair') || dimensionKey === 'hairColor') return HAIR_COLORS;
    return GENERAL_COLORS;
  }

  generateAvatarUri(
    style: string | null | undefined,
    seed: string | null | undefined,
    fallbackSeed: string,
    bgColor?: string | null,
    avatarOptions?: Record<string, string> | null,
  ): string {
    const resolvedStyle = style && STYLE_MAP[style] ? style : DEFAULT_STYLE;
    const resolvedSeed = seed || fallbackSeed;
    const resolvedColor = bgColor || DEFAULT_BG_COLOR;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const options: Record<string, any> = { seed: resolvedSeed };

    // Apply custom options: wrap each value in an array for DiceBear
    if (avatarOptions) {
      for (const [key, value] of Object.entries(avatarOptions)) {
        if (value) {
          options[key] = [value];
        }
      }
    }

    // Initials: apply backgroundColor from bgColor if not set via avatarOptions
    if (resolvedStyle === 'initials') {
      if (!options['backgroundColor']) {
        options['backgroundColor'] = [resolvedColor];
      }
      options['textColor'] = ['ffffff'];
    }

    const avatar = createAvatar(STYLE_MAP[resolvedStyle], options);

    return avatar.toDataUri();
  }
}
