import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Users, Settings } from 'lucide-react';
import { Game, gameApi } from '../services/api';
import { GameManagementModal } from './GameManagementModal';

interface GameCardProps {
  game: Game;
  onGameUpdate: () => void;
}

export const GameCard: React.FC<GameCardProps> = ({ game, onGameUpdate }) => {
  const [showManagement, setShowManagement] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAddParticipant = async (gameId: number, participantId: number) => {
    try {
      setLoading(true);
      await gameApi.register(gameId, participantId);
      onGameUpdate();
    } catch (error) {
      console.error('Failed to add participant:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveParticipant = async (gameId: number, participantId: number) => {
    try {
      setLoading(true);
      await gameApi.unregister(gameId, participantId);
      onGameUpdate();
    } catch (error) {
      console.error('Failed to remove participant:', error);
    } finally {
      setLoading(false);
    }
  };

  const gameDate = new Date(game.dateTime);
  const now = new Date();
  const registrationOpen = new Date(gameDate.getTime() - 5 * 24 * 60 * 60 * 1000);
  const registrationCloses = new Date(gameDate.getTime() - 6 * 60 * 60 * 1000);

  const activeParticipants = game.registrations.filter(reg => !reg.isWaitlist).length;
  const waitingParticipants = game.registrations.filter(reg => reg.isWaitlist).length;

  const getRegistrationStatus = () => {
    if (now < registrationOpen) {
      return 'Not open yet';
    }
    if (now >= registrationCloses) {
      return 'Registration closed';
    }
    if (activeParticipants >= game.maxPlayers) {
      return 'Full';
    }
    return 'Open';
  };

  const registrationStatus = getRegistrationStatus();

  return (
    <>
      <Card className="hover:shadow-lg transition-shadow duration-200">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start">
            <CardTitle className="text-lg font-semibold">
              Volleyball Game - {gameDate.toLocaleDateString()}
            </CardTitle>
            <Badge className="bg-gray-100 text-gray-800">
              {registrationStatus}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center text-sm text-gray-600">
              <Calendar className="mr-2 h-4 w-4" />
              {gameDate.toLocaleDateString()} at {gameDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>

            <div className="flex items-center text-sm text-gray-600">
              <div className="text-sm text-gray-500">
                {activeParticipants} registered
                {waitingParticipants > 0 && ` (${waitingParticipants} waiting)`}
              </div>
            </div>
          </div>

          {/* Participants Progress Bar */}
          <div className="space-y-2">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-orange-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min((registeredCount / game.maxPlayers) * 100, 100)}%` }}
              />
            </div>
            {registeredCount >= game.maxPlayers && (
              <p className="text-xs text-orange-600 font-medium">Game is full - new registrations go to waiting list</p>
            )}
          </div>

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

      {showManagement && (
        <GameManagementModal
          game={game}
          onClose={() => setShowManagement(false)}
          onGameUpdate={onGameUpdate}
        />
      )}
    </>
  );
};
