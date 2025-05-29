
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useGameStore } from '../store/gameStore';
import { useToast } from '@/hooks/use-toast';

interface CreateGameModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CreateGameModal: React.FC<CreateGameModalProps> = ({ open, onOpenChange }) => {
  const { games, addGame } = useGameStore();
  const { toast } = useToast();

  const getNextSunday = () => {
    // Get all upcoming games
    const upcomingGames = games
      .filter(game => new Date(game.date) > new Date())
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // Start from either the last upcoming game date or today
    const startDate = upcomingGames.length > 0 
      ? new Date(upcomingGames[upcomingGames.length - 1].date)
      : new Date();
    
    // Find next Sunday after the start date
    const nextSunday = new Date(startDate);
    const daysUntilSunday = (7 - nextSunday.getDay()) % 7;
    
    if (daysUntilSunday === 0) {
      // If start date is Sunday, move to next Sunday
      nextSunday.setDate(nextSunday.getDate() + 7);
    } else {
      nextSunday.setDate(nextSunday.getDate() + daysUntilSunday);
    }
    
    return nextSunday.toISOString().split('T')[0];
  };
  const [formData, setFormData] = useState({
    date: '',
    time: '17:00',
    maxParticipants: 14
  });



  useEffect(() => {
    if (open) {
      setFormData(prev => ({
        ...prev,
        date: getNextSunday()
      }));
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.date || !formData.time) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    const gameDate = new Date(`${formData.date}T${formData.time}`);
    
    if (gameDate <= new Date()) {
      toast({
        title: "Error",
        description: "Game date must be in the future",
        variant: "destructive",
      });
      return;
    }

    const newGame = {
      id: Date.now().toString(),
      date: gameDate.toISOString(),
      maxParticipants: formData.maxParticipants,
      participants: [],
      waitingList: [],
      createdAt: new Date().toISOString(),
      createdBy: 'admin' // In a real app, this would be the logged-in admin ID
    };

    addGame(newGame);
    
    toast({
      title: "Success",
      description: "Game created successfully!",
    });

    // Reset form
    setFormData({
      date: getNextSunday(),
      time: '17:00',
      maxParticipants: 14
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Create New Game</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Date *</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="time">Time *</Label>
              <Input
                id="time"
                type="time"
                value={formData.time}
                onChange={(e) => setFormData(prev => ({ ...prev, time: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxParticipants">Maximum Participants</Label>
            <Input
              id="maxParticipants"
              type="number"
              min="1"
              value={formData.maxParticipants}
              onChange={(e) => setFormData(prev => ({ ...prev, maxParticipants: parseInt(e.target.value) || 14 }))}
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="bg-orange-600 hover:bg-orange-700">
              Create Game
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
