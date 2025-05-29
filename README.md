# Volleyball Game Central

A comprehensive volleyball game management system that allows administrators to create games, manage participants, and handle registrations with waiting lists.

## 🏐 Project Overview

Volleyball Game Central is a web application designed to streamline the organization of volleyball games. It provides an intuitive interface for administrators to create games, manage participant registrations, and handle waiting lists when games reach capacity.

## ✨ Features

### Game Management
- **Create Games**: Set up new volleyball games with date, time, and participant limits
- **Game Dashboard**: View all upcoming games in an organized grid layout
- **Participant Limits**: Define maximum participants per game with automatic waiting list management

### Participant Management
- **Add Participants**: Register new participants with Telegram usernames and display names
- **Edit Participants**: Update participant information as needed
- **Remove Participants**: Delete participants and automatically remove them from all games

### Registration System
- **Automatic Registration**: Participants are automatically added to games or waiting lists based on availability
- **Waiting List Management**: When games reach capacity, additional participants are added to a waiting list
- **Smart Promotion**: When a participant leaves a full game, the first person on the waiting list is automatically promoted

### User Interface
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Modern UI**: Built with shadcn/ui components for a clean, professional look
- **Real-time Updates**: State management with Zustand for instant UI updates
- **Persistent Storage**: Data is saved locally in the browser

## 🛠 Technology Stack

- **Frontend Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **UI Components**: shadcn/ui (Radix UI primitives)
- **Styling**: Tailwind CSS
- **State Management**: Zustand with persistence
- **Routing**: React Router DOM
- **Form Handling**: React Hook Form with Zod validation
- **Icons**: Lucide React
- **Data Fetching**: TanStack Query

## 🚀 Local Development Setup

### Prerequisites

- Node.js (version 16 or higher)
- npm or yarn package manager

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd volley-game-central
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```

4. **Open your browser**
   Navigate to `http://localhost:5173` to view the application

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build the project for production
- `npm run build:dev` - Build the project in development mode
- `npm run preview` - Preview the production build locally
- `npm run lint` - Run ESLint for code quality checks

## 📁 Project Structure

```
src/
├── auth/                 # Authentication context and providers
├── components/           # Reusable React components
│   ├── ui/              # shadcn/ui component library
│   ├── AdminDashboard.tsx
│   ├── GameCard.tsx
│   ├── ParticipantDashboard.tsx
│   └── ...
├── hooks/               # Custom React hooks
├── lib/                 # Utility functions and configurations
├── pages/               # Page components for routing
├── store/               # Zustand state management
└── main.tsx            # Application entry point
```

## 🎯 Usage

### For Administrators

1. **Creating a Game**
   - Click "Create New Game" on the dashboard
   - Set the date, time, and maximum participants
   - The game will appear in the upcoming games grid

2. **Managing Participants**
   - Use "Add Participant" to register new players
   - View all participants in the dedicated participants page
   - Edit or remove participants as needed

3. **Game Registration**
   - Participants can be added to games through the game management interface
   - The system automatically handles capacity limits and waiting lists

### For Participants

- Participants can view available games and their registration status
- The system shows whether they're registered, on a waiting list, or if the game is full

## 🚀 Deployment

The application can be deployed to any static hosting service:

1. **Build the project**
   ```bash
   npm run build
   ```

2. **Deploy the `dist` folder** to your hosting service of choice:
   - Vercel
   - Netlify
   - GitHub Pages
   - AWS S3 + CloudFront
   - Any other static hosting provider

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is open source and available under the [MIT License](LICENSE).
