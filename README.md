# Volleyball Game Central

A modern web application for managing volleyball games, participants, and registrations. This application provides an intuitive interface for administrators to organize games and for participants to register and manage their participation.

## 🏐 Project Overview

Volleyball Game Central is designed to streamline the organization of volleyball games by providing tools for:
- Creating and managing volleyball games
- Participant registration and management
- Automatic waiting list management when games reach capacity
- Real-time updates and notifications

## ✨ Key Features

### Admin Dashboard
- **Game Management**: Create new volleyball games with customizable date, time, and participant limits
- **Participant Management**: Add, edit, and remove participants from the system
- **Registration Overview**: View all upcoming games and their current registration status
- **Waiting List Management**: Automatically manage waiting lists when games reach capacity

### Participant Features
- **Game Registration**: Easy registration for upcoming volleyball games
- **Waiting List**: Automatic placement on waiting lists for full games
- **Profile Management**: Manage personal information and Telegram username
- **Game History**: View participation history and upcoming games

### Smart Registration System
- **Capacity Management**: Automatic handling of game capacity limits
- **Queue System**: Fair waiting list management with automatic promotion
- **Real-time Updates**: Instant updates when spots become available

## 🛠 Technology Stack

This project is built with modern web technologies:

- **Frontend Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **UI Components**: shadcn/ui component library
- **Styling**: Tailwind CSS for responsive design
- **State Management**: Zustand for efficient state management
- **Routing**: React Router for navigation
- **Data Fetching**: TanStack Query for server state management
- **Form Handling**: React Hook Form with Zod validation
- **Icons**: Lucide React for consistent iconography

## 🚀 Getting Started

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

- `npm run dev` - Start the development server with hot reload
- `npm run build` - Build the application for production
- `npm run preview` - Preview the production build locally
- `npm run lint` - Run ESLint for code quality checks

## 📱 Usage

### For Administrators

1. **Creating Games**: Use the "Create New Game" button to set up volleyball games with specific dates and participant limits
2. **Managing Participants**: Add new participants to the system with their Telegram usernames and display names
3. **Monitoring Registrations**: View real-time registration status for all games
4. **Handling Waiting Lists**: The system automatically manages waiting lists and promotes participants when spots open up

### For Participants

1. **Registration**: Browse available games and register with a single click
2. **Waiting Lists**: Get automatically added to waiting lists for full games
3. **Profile Management**: Update personal information and contact details
4. **Game Tracking**: Keep track of registered games and participation history

## 🏗 Project Structure

```
src/
├── components/          # Reusable UI components
├── pages/              # Page components and routing
├── store/              # State management (Zustand)
├── auth/               # Authentication context
├── hooks/              # Custom React hooks
├── lib/                # Utility functions
└── types/              # TypeScript type definitions
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
