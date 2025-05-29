
import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Plus, UserPlus, Users } from 'lucide-react';
import { CreateGameModal } from './CreateGameModal';
import { AddParticipantModal } from './AddParticipantModal';
import { GameCard } from './GameCard';
import { Game, gameApi } from '../services/api';
import { useNavigate } from 'react-router-dom';

export const AdminDashboard = () => {
  const [showCreateGame, setShowCreateGame] = useState(false);
  const [showAddParticipant, setShowAddParticipant] = useState(false);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchGames = async () => {
    try {
      setLoading(true);
      const allGames = await gameApi.getAll();
      setGames(allGames);
    } catch (error) {
      console.error('Failed to fetch games:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGames();
  }, []);

  const navigate = useNavigate();

  const upcomingGames = games.filter(game => new Date(game.dateTime) > new Date());

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Volleyball Admin Dashboard</h1>
          <p className="text-gray-600">Manage games, participants, and registrations</p>
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
          <Button 
            onClick={() => navigate('/participants')}
            variant="outline"
            className="border-green-600 text-green-600 hover:bg-green-50"
          >
            <Users className="mr-2 h-4 w-4" />
            View Participants
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
              {games.map((game) => (
                <GameCard key={game.id} game={game} onGameUpdate={fetchGames} />
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
