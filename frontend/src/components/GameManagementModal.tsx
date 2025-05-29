import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowUp, ArrowDown, X } from 'lucide-react';
import { Game, User, gameApi, userApi } from '../services/api';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '../auth/AuthContext';

interface GameManagementModalProps {
  game: Game;
  onClose: () => void;
  onGameUpdate: () => void;
}

export const GameManagementModal: React.FC<GameManagementModalProps> = ({ game, onClose, onGameUpdate }) => {
  const [selectedParticipant, setSelectedParticipant] = useState<string>('');
  const handleUpdateGame = async (updatedGame: Game) => {
    try {
      await gameApi.update(updatedGame.id, updatedGame);
      onClose();
      onGameUpdate();
    } catch (error) {
      console.error('Failed to update game:', error);
    }
  };

  const handleDeleteGame = async () => {
    try {
      await gameApi.remove(game.id);
      onClose();
      onGameUpdate();
    } catch (error) {
      console.error('Failed to delete game:', error);
    }
  };

  const { user } = useAuth();
  const { toast } = useToast();

  const [participants, setParticipants] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchParticipants = async () => {
      try {
        setLoading(true);
        const users = await userApi.getAll();
        setParticipants(users);
      } catch (error) {
        console.error('Failed to fetch participants:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchParticipants();
  }, []);

  const activeParticipants = game.registrations
    .filter(reg => !reg.isWaitlist)
    .map(reg => participants.find(p => p.id === reg.userId))
    .filter((p): p is User => p !== undefined);

  const waitingParticipants = game.registrations
    .filter(reg => reg.isWaitlist)
    .map(reg => participants.find(p => p.id === reg.userId))
    .filter((p): p is User => p !== undefined);

  const availableParticipants = participants.filter(p => 
    !game.registrations.some(reg => reg.userId === p.id)
  );

  const gameDate = new Date(game.dateTime);

  const handleAddParticipant = async () => {
    if (!selectedParticipant) return;

    try {
      await gameApi.register(game.id, parseInt(selectedParticipant));
      toast({
        title: 'Success',
        description: 'Participant added successfully',
      });
      setSelectedParticipant('');
      onGameUpdate();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to add participant',
        variant: 'destructive',
      });
    }
  };

  const handleRemoveParticipant = async (participantId: number) => {
    try {
      await gameApi.unregister(game.id, participantId);
      toast({
        title: 'Success',
        description: 'Participant removed successfully',
      });
      onGameUpdate();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to remove participant',
        variant: 'destructive',
      });
    }
  };

  const handleMoveToWaiting = async (participantId: number) => {
    try {
      await gameApi.moveToWaitlist(game.id, participantId);
      toast({
        title: 'Success',
        description: 'Participant moved to waiting list',
      });
      onGameUpdate();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to move participant',
        variant: 'destructive',
      });
    }
  };

  const handleMoveToActive = async (participantId: number) => {
    try {
      await gameApi.moveToActive(game.id, participantId);
      toast({
        title: 'Success',
        description: 'Participant moved to active list',
      });
      onGameUpdate();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to move participant',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Game - {gameDate.toLocaleDateString()}</DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="participants" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="participants">
              Participants ({activeParticipants.length}/{game.maxPlayers})
            </TabsTrigger>
            <TabsTrigger value="waiting">
              Waiting List ({waitingParticipants.length})
            </TabsTrigger>
            <TabsTrigger value="add">Add Players</TabsTrigger>
          </TabsList>

          <TabsContent value="participants" className="space-y-4">
            <div className="space-y-2">
              <h3 className="font-medium">Active Participants</h3>
              {activeParticipants.length === 0 ? (
                <p className="text-sm text-gray-500">No participants registered yet</p>
              ) : (
                <div className="space-y-4">
                  {activeParticipants.map((participant) => (
                    <div key={participant.id} className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{participant.username}</div>
                        <div className="text-sm text-gray-500">{participant.telegramId}</div>
                      </div>
                      <div className="space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleMoveToWaiting(participant.id)}
                        >
                          Move to Waiting
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRemoveParticipant(participant.id)}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="waiting" className="space-y-4">
            <div className="space-y-2">
              <h3 className="font-medium">Waiting List</h3>
              {waitingParticipants.length === 0 ? (
                <p className="text-sm text-gray-500">No participants on waiting list</p>
              ) : (
                <div className="space-y-2">
                  {waitingParticipants.map((participant, index) => (
                    <div key={participant.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="font-medium">
                          {participant.username}
                        </div>
                        <div className="text-sm text-gray-500">
                          @{participant.telegramId} • Position #{index + 1}
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleMoveToActive(participant.id)}
                          disabled={activeParticipants.length >= game.maxPlayers}
                        >
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRemoveParticipant(participant.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="add" className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <h3 className="font-medium">Add Participant to Game</h3>
                <div className="flex space-x-2">
                  <Select value={selectedParticipant} onValueChange={setSelectedParticipant}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select participant" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableParticipants.map((participant) => (
                        <SelectItem key={participant.id} value={participant.id.toString()}>
                          {participant.username} ({participant.telegramId})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button 
                    onClick={handleAddParticipant}
                    disabled={!selectedParticipant}
                    className="bg-orange-600 hover:bg-orange-700"
                  >
                    Add
                  </Button>
                </div>
                {availableParticipants.length === 0 && (
                  <p className="text-sm text-gray-500">All participants are already registered for this game</p>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
