import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from 'lucide-react';
import { useGameStore } from '@/store/gameStore';
import { ParticipantGameCard } from '@/components/ParticipantGameCard';

export const ParticipantDashboard = () => {
  const { games } = useGameStore();
  const now = new Date();
  const upcomingGames = games
    .filter(game => new Date(game.date) > now)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Volleyball Games</h1>
          <p className="text-gray-600">View and register for upcoming games</p>
        </div>

        {/* Games Grid */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-900">Upcoming Games</h2>
          {upcomingGames.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Calendar className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No upcoming games</h3>
                <p className="text-gray-600">Check back later for new games</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {upcomingGames.map(game => (
                <ParticipantGameCard key={game.id} game={game} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
