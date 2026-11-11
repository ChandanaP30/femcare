# FemCare+

<div align="center">

A comprehensive mobile health app for menstrual cycle tracking, health insights, and women's wellness — built with React, TypeScript, and Capacitor for both web and Android platforms.

**[Features](#features)** • **[Getting Started](#getting-started)** • **[Development](#development)** • **[Building](#building)** • **[Contributing](#contributing)**

</div>

---

## Overview

**FemCare+** is a holistic women's health companion that empowers users to track their menstrual cycles, log daily symptoms, receive personalized health insights, and access educational resources. The app combines cycle prediction, mood tracking, health reporting, and emergency services in a single, privacy-focused platform.

- **Cross-Platform**: Works on web browsers and Android devices via Capacitor
- **Offline-First**: Core functionality available without internet connectivity
- **Multi-Language**: Supports English, Hindi, and Kannada
- **Privacy-Focused**: Local encryption and secure authentication with Supabase
- **Accessible**: Built with accessibility standards in mind

---

## Features

### 📊 Cycle Tracking & Insights
- **Period Logging**: Record period dates, flow levels, and symptoms
- **Cycle Prediction**: AI-powered cycle length and period duration prediction
- **Fertility Window**: Automatic calculation of fertile window and ovulation dates
- **Cycle Phases**: Track body phase (menstrual, follicular, ovulation, luteal)
- **Health Reports**: Generate comprehensive health reports based on cycle history

### 📝 Daily Health Logging
- Log mood, symptoms, pain levels, and notes
- Track medication and hydration reminders
- View historical logs and identify patterns
- Symptom trend analysis

### 💬 AI-Powered Chatbot
- Multilingual health chatbot for questions and guidance
- Context-aware responses based on cycle phase
- Offline support with cached responses

### 🗺️ Healthcare Locator
- Find nearby hospitals, clinics, and pharmacies
- Location-based search powered by Overpass API
- View healthcare facility details and availability

### 📚 Health Education
- Curated educational resources on menstrual health
- Age-appropriate information on cycle phases
- Period leave policy guides for different regions

### 🆘 Emergency Features
- Quick SOS access with customizable emergency contacts
- One-tap emergency contact notifications

### 🔔 Smart Notifications
- Customizable period, medication, and hydration reminders
- Local notifications even when offline
- Smart alert system based on cycle predictions

### 🔒 Privacy & Security
- End-to-end encryption for sensitive data
- Biometric unlock support
- Privacy controls and data management
- Secure authentication

---

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Mobile**: Capacitor 8 (Android support)
- **Backend**: Supabase (PostgreSQL + Auth)
- **Build Tool**: Vite
- **Testing**: Vitest
- **Linting**: ESLint
- **Maps**: Leaflet
- **UI Components**: Lucide React icons

---

## Getting Started

### Prerequisites

- **Node.js** >= 18 and **npm**
- **Git**
- For Android builds: Java Development Kit (JDK) and Android SDK

### Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd project
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   Create a `.env` file in the project root:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_key
   ```

### Running Locally

**Development Server**:
```bash
npm run dev
```
Opens the app at `http://localhost:5173`

**Build for Production**:
```bash
npm run build
```
Creates optimized build in the `dist/` directory

**Preview Production Build**:
```bash
npm run preview
```

### Usage Examples

#### Basic Development Workflow
```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# In another terminal, run tests
npm run test

# Lint code
npm run lint
```

#### Building for Android
```bash
# Build web app first
npm run build

# Sync with Capacitor
npx cap sync android

# Build APK in Android Studio or via Gradle
npx cap open android
```

---

## Development

### Project Structure

```
project/
├── src/
│   ├── App.tsx                    # Main app component with routing
│   ├── main.tsx                   # Entry point
│   ├── index.css                  # Global styles
│   ├── components/                # Reusable components
│   │   ├── AppShell.tsx          # Main navigation shell
│   │   ├── SosQuick.tsx          # Emergency SOS quick access
│   │   └── ...
│   ├── screens/                   # Page-level components
│   │   ├── HomeDashboard.tsx     # Main dashboard
│   │   ├── CalendarScreen.tsx    # Calendar view
│   │   ├── ChatScreen.tsx        # Chatbot interface
│   │   ├── LocatorScreen.tsx     # Healthcare finder
│   │   ├── ProfileScreen.tsx     # User profile
│   │   └── ...
│   └── lib/                       # Core business logic
│       ├── auth-context.tsx      # Authentication state
│       ├── cycle.ts              # Cycle calculation logic
│       ├── chatbot.ts            # AI chatbot logic
│       ├── overpass.ts           # Healthcare location queries
│       ├── reminders.ts          # Notification scheduling
│       ├── supabase.ts           # Database client
│       └── types.ts              # TypeScript types
├── vite.config.ts                # Vite configuration
├── capacitor.config.ts           # Capacitor configuration
├── tailwind.config.js            # Tailwind CSS config
├── eslint.config.js              # ESLint configuration
└── package.json                  # Project dependencies
```

### Key Concepts

#### Authentication Flow
- User signs up/logs in via Supabase Auth
- Auth state managed via `AuthContext`
- Profile setup on first login
- Encrypted data storage for sensitive information

#### Cycle Prediction
- Tracks historical period data to calculate average cycle length
- Uses `CycleModel` for intelligent predictions
- Confidence scoring based on data regularity
- Real-time phase calculation

#### Navigation
- Custom in-app navigation with back stack management
- Deep linking support for notifications
- Platform-aware routing (web vs native)

#### Offline Support
- Local data persistence via browser storage
- Cached chatbot responses
- Queue-based sync for remote updates
- Offline banner notification

### Running Tests

```bash
npm run test
```

Tests are located alongside source files with `.test.ts` or `.test.tsx` extensions.

### Code Quality

**Lint Code**:
```bash
npm run lint
```

**Fix Linting Issues**:
```bash
npm run lint -- --fix
```

---

## Building

### Web Build

```bash
npm run build
```

Creates a production build in `dist/` directory optimized for deployment.

### Android Build

1. **Prepare the build**:
   ```bash
   npm run build
   npx cap sync android
   ```

2. **Open in Android Studio**:
   ```bash
   npx cap open android
   ```

3. **Build APK**:
   - Use Android Studio's Build menu
   - Or via command line:
     ```bash
     cd android
     ./gradlew build
     ```

For detailed Android build instructions, see `APK_BUILD_GUIDE.md`

---

## Configuration

### Supabase Setup

1. Create a project at [supabase.com](https://supabase.com)
2. Set up authentication (Email/Password)
3. Create database tables matching types in `src/lib/types.ts`
4. Get your URL and anon key from Project Settings
5. Add to `.env` file

### Capacitor Configuration

Edit `capacitor.config.ts` to customize:
- App ID and name
- Android-specific settings
- Server configuration

For more info: [Capacitor Docs](https://capacitorjs.com/docs/config)

---

## Contributing

Contributions are welcome! Here's how you can help:

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/your-feature-name`
3. **Commit** your changes: `git commit -am 'Add feature'`
4. **Push** to the branch: `git push origin feature/your-feature-name`
5. **Open** a Pull Request

### Code Standards
- Follow ESLint rules (run `npm run lint`)
- Use TypeScript for type safety
- Write tests for new features
- Keep components focused and reusable

---

## Troubleshooting

### "Module not found" errors
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Capacitor Android build issues
```bash
# Sync Capacitor files
npx cap sync android

# Update Gradle
cd android
./gradlew clean
./gradlew build
```

### Supabase connection issues
- Verify `.env` credentials
- Check Supabase project is active
- Review network settings for CORS

For more help, check existing issues or create a new one on GitHub.

---

## Support

- **Documentation**: Check the project wiki for detailed guides
- **Issues**: Report bugs and request features on GitHub
- **Discussions**: Join conversations in GitHub Discussions
- **Email**: Contact maintainers for urgent issues

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

## Acknowledgments

- Built with [React](https://react.dev)
- Powered by [Supabase](https://supabase.com)
- Cross-platform via [Capacitor](https://capacitorjs.com)
- UI by [Tailwind CSS](https://tailwindcss.com) & [Lucide Icons](https://lucide.dev)

---

<div align="center">

Made with ❤️ for women's health and wellness

</div>
