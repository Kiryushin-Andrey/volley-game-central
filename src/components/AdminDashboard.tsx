
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Calendar, Clock, Plus, UserPlus } from 'lucide-react';
import { CreateGameModal } from './CreateGameModal';
import { AddParticipantModal } from './AddParticipantModal';
import { GameCard } from './GameCard';
import { useGameStore } from '../store/gameStore';

export const AdminDashboard = () => {
  const [showCreateGame, setShowCreateGame] = useState(false);
  const [showAddParticipant, setShowAddParticipant] = useState(false);
  const { games, participants } = useGameStore();

  const upcomingGames = games.filter(game => new Date(game.date) > new Date());
  const activeRegistrations = games.filter(game => {
    const now = new Date();
    const gameDate = new Date(game.date);
    const registrationOpen = new Date(gameDate.getTime() - 5 * 24 * 60 * 60 * 1000);
    return now >= registrationOpen && now < gameDate;
  }).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Volleyball Admin Dashboard</h1>
          <p className="text-gray-600">Manage games, participants, and registrations</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Participants</CardTitle>
              <Users className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{participants.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Upcoming Games</CardTitle>
              <Calendar className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{upcomingGames.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Registrations</CardTitle>
              <Clock className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeRegistrations}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Games</CardTitle>
              <Calendar className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{games.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-4 mb-8">
          <Button 
            onClick={() => setShowCreateGame(true)}
            className="bg-orange-600 hover:bg-orange-700"
          >
            <Plus className="mr-2 h-4 w-4" />
            Create New Game
          </Button>
          <Button 
            onClick={() => setShowAddParticipant(true)}
            variant="outline"
            className="border-blue-600 text-blue-600 hover:bg-blue-50"
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Add Participant
          </Button>
        </div>

        {/* Games Grid */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-900">Upcoming Games</h2>
          {upcomingGames.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Calendar className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No upcoming games</h3>
                <p className="text-gray-600 mb-4">Create your first game to get started</p>
                <Button 
                  onClick={() => setShowCreateGame(true)}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  Create Game
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {upcomingGames.map(game => (
                <GameCard key={game.id} game={game} />
              ))}
            </div>
          )}
        </div>

        {/* Modals */}
        <CreateGameModal 
          open={showCreateGame} 
          onOpenChange={setShowCreateGame} 
        />
        <AddParticipantModal 
          open={showAddParticipant} 
          onOpenChange={setShowAddParticipant} 
        />
      </div>
    </div>
  );
};
