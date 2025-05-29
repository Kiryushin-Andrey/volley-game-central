import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Users } from 'lucide-react';
import { Game, gameApi } from '@/services/api';
import { useAuth } from '@/auth/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface ParticipantGameCardProps {
  game: Game;
}

export const ParticipantGameCard: React.FC<ParticipantGameCardProps> = ({ game }) => {
  const [loading, setLoading] = useState(false);

  const { toast } = useToast();

  const handleRegister = async () => {
    try {
      setLoading(true);
      await gameApi.register(game.id, user.id);
      toast({
        title: 'Success',
        description: 'Successfully registered for the game',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to register for the game',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUnregister = async () => {
    try {
      setLoading(true);
      await gameApi.unregister(game.id, user.id);
      toast({
        title: 'Success',
        description: 'Successfully unregistered from the game',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to unregister from the game',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const { user } = useAuth();

  const gameDate = new Date(game.dateTime);
  const now = new Date();
  const registrationOpen = new Date(gameDate.getTime() - 5 * 24 * 60 * 60 * 1000);
  const registrationCloses = new Date(gameDate.getTime() - 6 * 60 * 60 * 1000);

  const isRegistrationOpen = now >= registrationOpen && now < registrationCloses;
  const registeredCount = game.registrations.filter(reg => !reg.isWaitlist).length;
  const waitingCount = game.registrations.filter(reg => reg.isWaitlist).length;

  const isRegistered = game.registrations.some(reg => reg.userId === user.id);
  const isWaitlisted = game.registrations.some(reg => reg.userId === user.id && reg.isWaitlist);


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

  const handleRegistration = async () => {
    if (!user?.id) return;

    try {
      if (isRegistered) {
        await handleUnregister();
      } else {
        await handleRegister();
      }
    } catch (error) {
      console.error('Error handling registration:', error);
    }
  };

  const getRegistrationText = () => {
    if (isRegistered) {
      return isWaitlisted ? 'Leave Waiting List' : 'Unregister';
    } else {
      return 'Register';
    }
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
            {registeredCount}/{game.maxPlayers} registered
            {waitingCount > 0 && `, ${waitingCount} waiting`}
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

        {/* Participants List */}
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold mb-1">Registered Participants:</h3>
            <div className="text-sm text-gray-600">
              {registeredCount > 0 ? (
                <div className="grid grid-cols-2 gap-1">
                  {game.registrations
                    .filter(reg => !reg.isWaitlist)
                    .map((registration) => (
                    <div key={registration.id} className="text-sm">
                      {registration.user?.username || 'Unknown'}
                    </div>
                  ))}
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
                  {game.registrations
                    .filter(reg => reg.isWaitlist)
                    .map((registration) => (
                    <div key={registration.id} className="text-sm">
                      {registration.user?.username || 'Unknown'}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <Button 
          onClick={handleRegistration}
          variant={isRegistered ? 'destructive' : 'default'}
          className="w-full mt-4"
          disabled={loading}
        >
          {getRegistrationText()}
        </Button>
      </CardContent>
    </Card>
  );
};
