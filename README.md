# 🎵 ECNELISFLY

A geolocation-based audio recording sharing platform built with **Angular 18**, **AWS Amplify**, and **Leaflet maps**. Discover, share, and interact with audio recordings from around the world.

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Development Guide](#development-guide)
- [Contributing](#contributing)
- [License](#license)

## Overview

ECNELISFLY enables users to record, upload, and discover audio content tied to specific geographic locations. Explore sounds from nature, music, interviews, and more on an interactive map. Built for both contributors and explorers with multilingual support and rich geospatial features.

**Active Version**: V2 (located in `V2/ecnelisflyversion2/`)

## ✨ Features

- **🗺️ Interactive Map Visualization** - Leaflet-based map with marker clustering and advanced filtering
- **🔊 Audio Recording & Upload** - Record and share audio files with location metadata
- **🌍 Geolocation-Based Discovery** - Find sounds based on geographic location
- **👥 User Profiles & Preferences** - Personalized language (FR/EN/ES), theme, and sound collections
- **🔐 Secure Authentication** - Amazon Cognito with group-based access control
- **🔄 Real-time Updates** - GraphQL subscriptions via AWS AppSync
- **📱 Mobile & Desktop Support** - Responsive design with fullscreen mode
- **🌐 Multilingual** - Support for French, English, and Spanish with ngx-translate
- **☁️ Cloud Storage** - Audio files stored securely in AWS S3

## 🛠️ Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Frontend** | Angular | 18.2.13 |
| **Frontend Framework** | Material Design | 18.2.14 |
| **Maps** | Leaflet & ngx-leaflet | 1.9.4 |
| **Backend** | AWS Amplify | 6.6.6 |
| **Database** | DynamoDB (AppSync) | - |
| **Auth** | Amazon Cognito | - |
| **Storage** | AWS S3 | - |
| **i18n** | ngx-translate | 17.0.0 |
| **State** | Angular Signals & RxJS | 7.8.0 |

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- AWS Account with Amplify configured
- Git

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd ECNELISFLY/V2/ecnelisflyversion2

# Install dependencies
npm install

# Configure Amplify (if needed)
amplify pull

# Start the development server
npm start
```

The application will be available at `http://localhost:4200`

### Build & Deployment

```bash
# Production build
npm run build

# Watch mode (development)
npm run watch

# Run tests
npm test

# Lint code
npm lint

# Deploy to AWS
amplify push
```

## 📂 Project Structure

```
V2/ecnelisflyversion2/
├── src/
│   ├── app/
│   │   ├── features/               # Feature modules
│   │   │   ├── home/               # Landing page
│   │   │   ├── map/                # Map visualization (MapflyComponent)
│   │   │   ├── new-sound/          # Audio upload workflow
│   │   │   ├── users/              # User account & preferences
│   │   │   └── admin/              # Admin panel (lazy-loaded)
│   │   ├── core/
│   │   │   ├── services/           # Core services (Auth, Amplify, Storage, etc.)
│   │   │   ├── models/             # Data models & GraphQL types
│   │   │   ├── pages/              # Auth pages
│   │   │   └── scripts/            # Custom utilities (Leaflet plugins, etc.)
│   │   ├── shared/                 # Shared components & styles
│   │   └── app.config.ts           # App configuration
│   ├── public/
│   │   └── i18n/                   # Translation files (en.json, fr.json, es.json)
│   └── index.html
├── amplify/                         # Backend infrastructure as code
│   ├── data/                        # GraphQL schema & categories
│   ├── auth/                        # Cognito configuration
│   ├── storage/                     # S3 configuration
│   └── functions/                   # Lambda functions
├── angular.json                     # Angular CLI configuration
├── tsconfig.json                    # TypeScript configuration
└── README.md
```

## 👨‍💻 Development Guide

### Key Services

- **AmplifyService** - GraphQL client initialization and management
- **AppUserService** - Current user state management with real-time updates
- **SoundsService** - Audio data transformation and MIME type detection
- **AuthService** - Authentication state and Cognito group management
- **StorageService** - S3 file management and presigned URL generation
- **TranslateService** - Multilingual support (ngx-translate)

### Component Architecture

All components follow **standalone component pattern** with explicit imports:

```typescript
@Component({
  selector: 'app-my-component',
  standalone: true,
  imports: [CommonModule, TranslatePipe, MatButtonModule],
  templateUrl: './my-component.html',
  styleUrls: ['./my-component.scss'],
})
export class MyComponent implements OnInit {
  private readonly myService = inject(MyService);
  public myState = signal(initialValue);

  ngOnInit() {
    // Component logic
  }
}
```

### Adding Features

1. **Create Feature Directory** - `src/app/features/my-feature/pages/`
2. **Define Models** - Add types to `/core/models/`
3. **Create Service** - Add data access logic to `/core/services/`
4. **Build Components** - Use standalone pattern with injected services
5. **Update Routes** - Add to `app.routes.ts` with lazy loading if needed

### GraphQL Operations

Define queries in `/core/models/amplify-queries.model.ts` and call via:

```typescript
const result = await this.amplifyService.client.graphql({
  query: MyQuery,
  variables: { id: '123' },
  authMode: 'userPool' // or 'apiKey' for public
});
```

### Internationalization

- Translation files: `/public/i18n/{en,fr,es}.json`
- In templates: `{{ 'key.path' | translate }}`
- In components: `this.translate.instant('key.path')`

## 🔧 Common Development Tasks

### Add a New Sound Property
1. Update `/amplify/data/resource.ts` schema
2. Run `amplify pull` to regenerate GraphQL types
3. Update `Sound` model in `/core/models/sound.model.ts`
4. Add mapping in `SoundsService.map()`

### Create an Admin Feature
1. Add route to `/features/admin/database/database.routes.ts`
2. Add `data: { requiredGroup: 'ADMIN' }` to route config
3. Implement guard checks in component logic

### Update Translations
1. Add new keys to `/public/i18n/en.json`
2. Add translations for `/public/i18n/fr.json` and `/public/i18n/es.json`
3. Use `TranslatePipe` in templates or `TranslateService` in components

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in headless mode
npm test -- --watch=false --browsers=ChromeHeadless
```

Test files are colocated with components using `.spec.ts` suffix. Focus on:
- Auth guard functionality
- Data transformation logic
- Service interactions
- Component lifecycle

## 🔒 Security

- **Authentication** - Amazon Cognito with MFA support
- **Authorization** - Cognito groups for role-based access control
- **API Security** - AppSync with auth modes (userPool, apiKey)
- **Data Privacy** - User-owned sound records with proper scoping

See [CONTRIBUTING.md](CONTRIBUTING.md#security-issue-notifications) for security policies.

## 🤝 Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Follow code conventions in [CONTRIBUTING.md](CONTRIBUTING.md)
4. Ensure tests pass: `npm test`
5. Lint code: `npm run lint`
6. Submit a pull request

For detailed guidelines, see [CONTRIBUTING.md](CONTRIBUTING.md).

## 📄 License

This project is licensed under the MIT-0 License. See the [LICENSE](LICENSE) file for details.

## 📞 Support

For issues, questions, or feature requests, please open an issue on the repository or check existing documentation in [CONTRIBUTING.md](CONTRIBUTING.md).

---

**Version**: V2 (Feb 2, 2026)  
**Built with ❤️ by the ECNELISFLY Team**

**To Update**
