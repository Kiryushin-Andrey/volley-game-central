
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowUp, ArrowDown, X } from 'lucide-react';
import { Game, useGameStore } from '../store/gameStore';
import { useToast } from '@/hooks/use-toast';

interface GameManagementModalProps {
  game: Game;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const GameManagementModal: React.FC<GameManagementModalProps> = ({ 
  game, 
  open, 
  onOpenChange 
}) => {
  const [selectedParticipant, setSelectedParticipant] = useState<string>('');
  const { participants, addParticipantToGame, removeParticipantFromGame, moveParticipantToWaiting, moveParticipantToActive } = useGameStore();
  const { toast } = useToast();

  const gameParticipants = participants.filter(p => game.participants.includes(p.id));
  const waitingParticipants = participants.filter(p => game.waitingList.includes(p.id));
  const availableParticipants = participants.filter(p => 
    !game.participants.includes(p.id) && !game.waitingList.includes(p.id)
  );

  const handleAddParticipant = () => {
    if (!selectedParticipant) return;

    addParticipantToGame(game.id, selectedParticipant);
    setSelectedParticipant('');
    
    toast({
      title: "Success",
      description: "Participant added to game",
    });
  };

  const handleRemoveParticipant = (participantId: string, fromWaiting = false) => {
    removeParticipantFromGame(game.id, participantId, fromWaiting);
    
    toast({
      title: "Success",
      description: "Participant removed from game",
    });
  };

  const handleMoveToWaiting = (participantId: string) => {
    moveParticipantToWaiting(game.id, participantId);
    
    toast({
      title: "Success",
      description: "Participant moved to waiting list",
    });
  };

  const handleMoveToActive = (participantId: string) => {
    moveParticipantToActive(game.id, participantId);
    
    toast({
      title: "Success",
      description: "Participant moved to active list",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Game: {game.title}</DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="participants" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="participants">
              Participants ({gameParticipants.length}/{game.maxParticipants})
            </TabsTrigger>
            <TabsTrigger value="waiting">
              Waiting List ({waitingParticipants.length})
            </TabsTrigger>
            <TabsTrigger value="add">Add Players</TabsTrigger>
          </TabsList>

          <TabsContent value="participants" className="space-y-4">
            <div className="space-y-2">
              <h3 className="font-medium">Active Participants</h3>
              {gameParticipants.length === 0 ? (
                <p className="text-sm text-gray-500">No participants registered yet</p>
              ) : (
                <div className="space-y-2">
                  {gameParticipants.map((participant, index) => (
                    <div key={participant.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="font-medium">
                          {participant.displayName}
                        </div>
                        <div className="text-sm text-gray-500">
                          {participant.telegramUsername}
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleMoveToWaiting(participant.id)}
                        >
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
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
                          {participant.displayName}
                        </div>
                        <div className="text-sm text-gray-500">
                          {participant.telegramUsername} • Position #{index + 1}
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleMoveToActive(participant.id)}
                          disabled={gameParticipants.length >= game.maxParticipants}
                        >
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRemoveParticipant(participant.id, true)}
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
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select a participant" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableParticipants.map(participant => (
                        <SelectItem key={participant.id} value={participant.id}>
                          {participant.displayName} ({participant.telegramUsername})
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
