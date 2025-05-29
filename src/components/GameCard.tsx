
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Users, MapPin, Settings } from 'lucide-react';
import { Game, useGameStore } from '../store/gameStore';
import { GameManagementModal } from './GameManagementModal';

interface GameCardProps {
  game: Game;
}

export const GameCard: React.FC<GameCardProps> = ({ game }) => {
  const [showManagement, setShowManagement] = useState(false);
  const { participants } = useGameStore();

  const gameDate = new Date(game.date);
  const now = new Date();
  const registrationOpen = new Date(gameDate.getTime() - 5 * 24 * 60 * 60 * 1000);
  const registrationCloses = new Date(gameDate.getTime() - 6 * 60 * 60 * 1000);

  const isRegistrationOpen = now >= registrationOpen && now < registrationCloses;
  const registeredCount = game.participants.length;
  const waitingCount = game.waitingList.length;

  const getRegistrationStatus = () => {
    if (now < registrationOpen) {
      return { status: 'upcoming', color: 'bg-yellow-100 text-yellow-800', text: 'Registration Opens Soon' };
    }
    if (now >= registrationOpen && now < registrationCloses) {
      return { status: 'open', color: 'bg-green-100 text-green-800', text: 'Registration Open' };
    }
    if (now >= registrationCloses && now < gameDate) {
      return { status: 'closed', color: 'bg-red-100 text-red-800', text: 'Registration Closed' };
    }
    return { status: 'finished', color: 'bg-gray-100 text-gray-800', text: 'Game Finished' };
  };

  const registrationStatus = getRegistrationStatus();

  return (
    <>
      <Card className="hover:shadow-lg transition-shadow duration-200">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start">
            <CardTitle className="text-lg font-semibold">{game.title}</CardTitle>
            <Badge className={registrationStatus.color}>
              {registrationStatus.text}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center text-sm text-gray-600">
              <Calendar className="mr-2 h-4 w-4" />
              {gameDate.toLocaleDateString()} at {gameDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
            
            {game.location && (
              <div className="flex items-center text-sm text-gray-600">
                <MapPin className="mr-2 h-4 w-4" />
                {game.location}
              </div>
            )}

            <div className="flex items-center text-sm text-gray-600">
              <Users className="mr-2 h-4 w-4" />
              {registeredCount}/{game.maxParticipants} registered
              {waitingCount > 0 && `, ${waitingCount} waiting`}
            </div>
          </div>

          {/* Participants Progress Bar */}
          <div className="space-y-2">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-orange-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min((registeredCount / game.maxParticipants) * 100, 100)}%` }}
              />
            </div>
            {registeredCount >= game.maxParticipants && (
              <p className="text-xs text-orange-600 font-medium">Game is full - new registrations go to waiting list</p>
            )}
          </div>

          {game.description && (
            <p className="text-sm text-gray-600 line-clamp-2">{game.description}</p>
          )}

          <div className="flex items-center justify-between pt-2">
            <div className="text-xs text-gray-500">
              Registration opens: {registrationOpen.toLocaleDateString()}
            </div>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => setShowManagement(true)}
              className="text-blue-600 border-blue-600 hover:bg-blue-50"
            >
              <Settings className="mr-1 h-3 w-3" />
              Manage
            </Button>
          </div>
        </CardContent>
      </Card>

      <GameManagementModal 
        game={game}
        open={showManagement}
        onOpenChange={setShowManagement}
      />
    </>
  );
};
