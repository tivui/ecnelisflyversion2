import { SeoConfig } from '../services/seo.service';

/**
 * SEO metadata per route, keyed by language.
 * Each page targets specific keywords for search engines.
 */
export const SEO_ROUTES: Record<string, Record<string, SeoConfig>> = {
  '/home': {
    fr: {
      title: 'Ecnelis FLY — Carte sonore mondiale | Sons du monde',
      description: 'Carte sonore mondiale interactive : explorez et ecoutez plus de 548 sons geolocalisés de 111 pays. Ambiances, nature, musique, animaux, villes. Partagez vos decouvertes sonores.',
      url: '/',
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: 'Ecnelis FLY',
        alternateName: ['Carte sonore mondiale', 'World Sound Map', 'Soundmap World', 'Mapa sonoro mundial'],
        url: 'https://www.ecnelisfly.com',
        description: 'Carte sonore mondiale interactive — explorez, ecoutez et partagez des sons geolocalisés de plus de 111 pays. World sound map with sounds of the world.',
        applicationCategory: 'MultimediaApplication',
        operatingSystem: 'Web',
        keywords: 'carte sonore mondiale, world sound map, soundmap world, sounds of the world, sons du monde, mapa sonoro mundial, field recording, soundscape',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
        author: { '@type': 'Organization', name: 'Ecnelis FLY', url: 'https://www.ecnelisfly.com' },
        inLanguage: ['fr', 'en', 'es'],
      },
    },
    en: {
      title: 'Ecnelis FLY — World Sound Map | Sounds of the World',
      description: 'World sound map & soundmap of the world — explore sounds of the world geolocated from 111 countries. Nature, music, cities, wildlife. Free interactive soundmap.',
      url: '/',
    },
    es: {
      title: 'Ecnelis FLY — Mapa sonoro mundial | Sonidos del mundo',
      description: 'Mapa sonoro mundial interactivo : explora sonidos geolocalizados de 111 paises. Naturaleza, musica, ciudades, animales. Comparte tus descubrimientos sonoros.',
      url: '/',
    },
  },

  '/mapfly': {
    fr: {
      title: 'Carte sonore mondiale interactive — Sons du monde | Ecnelis FLY',
      description: 'Explorez la carte sonore mondiale interactive. Plus de 548 sons geolocalisés : ambiances urbaines, nature sauvage, musiques du monde, chants d\'oiseaux de 111 pays.',
      url: '/mapfly',
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: 'Ecnelis FLY — Carte sonore mondiale',
        alternateName: ['World Sound Map', 'Soundmap World', 'Sounds of the World'],
        url: 'https://www.ecnelisfly.com/mapfly',
        description: 'Interactive world sound map. Explore and listen to geolocated sounds from 111 countries: carte sonore mondiale, soundmap world, sounds of the world.',
        applicationCategory: 'MultimediaApplication',
        operatingSystem: 'Web',
      },
    },
    en: {
      title: 'World Soundmap — Sounds of the World | Ecnelis FLY',
      description: 'Explore the world soundmap. Listen to sounds of the world geolocated from 111 countries: urban soundscapes, wildlife, world music, birdsong. Free sound map.',
      url: '/mapfly',
    },
    es: {
      title: 'Mapa sonoro mundial interactivo — Sonidos del mundo | Ecnelis FLY',
      description: 'Navega por el mapa sonoro mundial interactivo. Mas de 548 sonidos del mundo geolocalizados: paisajes urbanos, naturaleza, musica, cantos de aves.',
      url: '/mapfly',
    },
  },

  '/journeys': {
    fr: {
      title: 'Voyages sonores — Ecnelis FLY',
      description: 'Embarquez pour des voyages sonores guides a travers le monde. Itineraires thematiques avec sons geolocalisés, histoires et decouvertes culturelles.',
      url: '/journeys',
    },
    en: {
      title: 'Sound Journeys — Ecnelis FLY',
      description: 'Embark on guided sound journeys around the world. Thematic itineraries with geolocated sounds, stories and cultural discoveries.',
      url: '/journeys',
    },
    es: {
      title: 'Viajes sonoros — Ecnelis FLY',
      description: 'Embarcate en viajes sonoros guiados por el mundo. Itinerarios tematicos con sonidos geolocalizados, historias y descubrimientos culturales.',
      url: '/viajes',
    },
  },

  '/quiz': {
    fr: {
      title: 'Quiz sonores — Ecnelis FLY',
      description: 'Testez vos connaissances avec nos quiz sonores interactifs. Reconnaissez des sons du monde entier et defiez vos amis au classement.',
      url: '/quiz',
    },
    en: {
      title: 'Sound Quizzes — Ecnelis FLY',
      description: 'Test your knowledge with interactive sound quizzes. Recognize sounds from around the world and challenge your friends on the leaderboard.',
      url: '/quiz',
    },
    es: {
      title: 'Quiz sonoros — Ecnelis FLY',
      description: 'Pon a prueba tus conocimientos con nuestros quiz sonoros interactivos. Reconoce sonidos del mundo entero y desafia a tus amigos.',
      url: '/quiz',
    },
  },

  '/zones': {
    fr: {
      title: 'Terroirs sonores — Ecnelis FLY',
      description: 'Decouvrez les terroirs sonores du monde. Regions et territoires avec leurs ambiances acoustiques uniques, de la campagne francaise aux forets tropicales.',
      url: '/zones',
    },
    en: {
      title: 'Sound Territories — Ecnelis FLY',
      description: 'Discover the world\'s sound territories. Regions with unique acoustic landscapes, from French countryside to tropical forests.',
      url: '/zones',
    },
    es: {
      title: 'Terroirs sonoros — Ecnelis FLY',
      description: 'Descubre los terroirs sonoros del mundo. Regiones con paisajes acusticos unicos, del campo frances a las selvas tropicales.',
      url: '/zones',
    },
  },

  '/articles': {
    fr: {
      title: 'Articles — Ecnelis FLY',
      description: 'Lisez nos articles sur l\'exploration sonore, la cartographie du son et les decouvertes acoustiques a travers le monde.',
      url: '/articles',
    },
    en: {
      title: 'Articles — Ecnelis FLY',
      description: 'Read our articles about sound exploration, sound mapping and acoustic discoveries around the world.',
      url: '/articles',
    },
    es: {
      title: 'Articulos — Ecnelis FLY',
      description: 'Lee nuestros articulos sobre exploracion sonora, cartografia del sonido y descubrimientos acusticos por el mundo.',
      url: '/articles',
    },
  },

  '/categories': {
    fr: {
      title: 'Categories de sons — Ecnelis FLY',
      description: 'Parcourez les categories sonores : ambiances, animaux, nature, musique, gastronomie, transports, sports et plus encore. Filtrez la carte mondiale par type de son.',
      url: '/categories',
    },
    en: {
      title: 'Sound Categories — Ecnelis FLY',
      description: 'Browse sound categories: ambiances, animals, nature, music, food, transport, sports and more. Filter the world map by sound type.',
      url: '/categories',
    },
    es: {
      title: 'Categorias de sonidos — Ecnelis FLY',
      description: 'Explora las categorias sonoras: ambientes, animales, naturaleza, musica, gastronomia, transportes, deportes y mas.',
      url: '/categories',
    },
  },

  '/support': {
    fr: {
      title: 'Soutenir le projet — Ecnelis FLY',
      description: 'Soutenez Ecnelis FLY, la carte sonore mondiale gratuite. Contribuez au developpement d\'un projet independant et passionné.',
      url: '/support',
    },
    en: {
      title: 'Support the Project — Ecnelis FLY',
      description: 'Support Ecnelis FLY, the free world sound map. Contribute to an independent and passionate project.',
      url: '/support',
    },
    es: {
      title: 'Apoyar el proyecto — Ecnelis FLY',
      description: 'Apoya Ecnelis FLY, el mapa sonoro mundial gratuito. Contribuye a un proyecto independiente y apasionado.',
      url: '/support',
    },
  },

  '/guide': {
    fr: {
      title: 'Guide utilisateur — Ecnelis FLY',
      description: 'Apprenez a utiliser Ecnelis FLY : explorer la carte, ecouter les sons, creer un compte, ajouter vos propres sons et bien plus.',
      url: '/guide',
    },
    en: {
      title: 'User Guide — Ecnelis FLY',
      description: 'Learn how to use Ecnelis FLY: explore the map, listen to sounds, create an account, add your own sounds and much more.',
      url: '/guide',
    },
    es: {
      title: 'Guia de usuario — Ecnelis FLY',
      description: 'Aprende a usar Ecnelis FLY: explorar el mapa, escuchar sonidos, crear una cuenta, agregar tus propios sonidos y mucho mas.',
      url: '/guide',
    },
  },

  '/legal': {
    fr: {
      title: 'Mentions legales — Ecnelis FLY',
      description: 'Mentions legales, conditions d\'utilisation et politique de confidentialite d\'Ecnelis FLY.',
      url: '/legal',
    },
    en: {
      title: 'Legal Notice — Ecnelis FLY',
      description: 'Legal notice, terms of use and privacy policy of Ecnelis FLY.',
      url: '/legal',
    },
    es: {
      title: 'Aviso legal — Ecnelis FLY',
      description: 'Aviso legal, condiciones de uso y politica de privacidad de Ecnelis FLY.',
      url: '/legal',
    },
  },

  '/login': {
    fr: {
      title: 'Connexion — Ecnelis FLY',
      description: 'Connectez-vous a Ecnelis FLY pour ajouter vos sons, participer aux quiz et rejoindre la communaute.',
      url: '/login',
    },
    en: {
      title: 'Sign In — Ecnelis FLY',
      description: 'Sign in to Ecnelis FLY to add your sounds, take quizzes and join the community.',
      url: '/login',
    },
    es: {
      title: 'Iniciar sesion — Ecnelis FLY',
      description: 'Inicia sesion en Ecnelis FLY para agregar tus sonidos, participar en quiz y unirte a la comunidad.',
      url: '/login',
    },
  },
};

/** Extract the base route path from a URL (e.g., '/quiz/123/play' → '/quiz') */
export function getRouteKey(url: string): string {
  const clean = url.split('?')[0].split('#')[0];
  // Match known routes first
  const known = Object.keys(SEO_ROUTES);
  const exact = known.find(k => clean === k);
  if (exact) return exact;
  // Fallback: first segment
  const segments = clean.split('/').filter(Boolean);
  return segments.length ? `/${segments[0]}` : '/home';
}
