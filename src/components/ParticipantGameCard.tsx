import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Users } from 'lucide-react';
import { Game, useGameStore } from '@/store/gameStore';
import { useAuth } from '@/auth/AuthContext';

interface ParticipantGameCardProps {
  game: Game;
}

export const ParticipantGameCard: React.FC<ParticipantGameCardProps> = ({ game }) => {
  const { participants, addParticipantToGame, removeParticipantFromGame } = useGameStore();
  const { user } = useAuth();

  const gameDate = new Date(game.date);
  const now = new Date();
  const registrationOpen = new Date(gameDate.getTime() - 5 * 24 * 60 * 60 * 1000);
  const registrationCloses = new Date(gameDate.getTime() - 6 * 60 * 60 * 1000);

  const isRegistrationOpen = now >= registrationOpen && now < registrationCloses;
  const registeredCount = game.participants.length;
  const waitingCount = game.waitingList.length;

  const isParticipant = game.participants.includes(user?.id || '');
  const isOnWaitingList = game.waitingList.includes(user?.id || '');

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

  const handleRegistration = () => {
    if (isParticipant) {
      removeParticipantFromGame(game.id, user?.id || '');
    } else if (isOnWaitingList) {
      removeParticipantFromGame(game.id, user?.id || '', true);
    } else {
      addParticipantToGame(game.id, user?.id || '');
    }
  };

  const getRegistrationButton = () => {
    if (!isRegistrationOpen) {
      return null;
    }

    if (isParticipant) {
      return (
        <Button 
          onClick={handleRegistration}
          variant="destructive"
          className="w-full mt-4"
        >
          Cancel Registration
        </Button>
      );
    }

    if (isOnWaitingList) {
      return (
        <Button 
          onClick={handleRegistration}
          variant="destructive"
          className="w-full mt-4"
        >
          Leave Waiting List
        </Button>
      );
    }

    return (
      <Button 
        onClick={handleRegistration}
        className="w-full mt-4 bg-orange-600 hover:bg-orange-700"
      >
        {registeredCount >= game.maxParticipants ? 'Join Waiting List' : 'Register for Game'}
      </Button>
    );
  };

  const registrationStatus = getRegistrationStatus();

  return (
    <Card className="hover:shadow-lg transition-shadow duration-200">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg font-semibold">
            Volleyball Game - {gameDate.toLocaleDateString()}
          </CardTitle>
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

        {/* Participants List */}
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold mb-1">Registered Participants:</h3>
            <div className="text-sm text-gray-600">
              {game.participants.length > 0 ? (
                <div className="grid grid-cols-2 gap-1">
                  {game.participants.map(participantId => {
                    const participant = participants.find(p => p.id === participantId);
                    return (
                      <div key={participantId} className="truncate">
                        {participant?.displayName || 'Unknown'}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p>No participants yet</p>
              )}
            </div>
          </div>

          {waitingCount > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-1">Waiting List:</h3>
              <div className="text-sm text-gray-600">
                <div className="grid grid-cols-2 gap-1">
                  {game.waitingList.map(participantId => {
                    const participant = participants.find(p => p.id === participantId);
                    return (
                      <div key={participantId} className="truncate">
                        {participant?.displayName || 'Unknown'}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {getRegistrationButton()}
      </CardContent>
    </Card>
  );
};
