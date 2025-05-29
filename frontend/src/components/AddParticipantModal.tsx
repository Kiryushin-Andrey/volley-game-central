
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useGameStore } from '../store/gameStore';
import { useToast } from '@/hooks/use-toast';

interface AddParticipantModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AddParticipantModal: React.FC<AddParticipantModalProps> = ({ open, onOpenChange }) => {
  const [formData, setFormData] = useState({
    telegramUsername: '',
    displayName: ''
  });

  const { addParticipant, participants } = useGameStore();
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.telegramUsername || !formData.displayName) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    // Check if participant already exists
    const existingParticipant = participants.find(
      p => p.telegramUsername.toLowerCase() === formData.telegramUsername.toLowerCase()
    );

    if (existingParticipant) {
      toast({
        title: "Error",
        description: "A participant with this Telegram username already exists",
        variant: "destructive",
      });
      return;
    }

    const newParticipant = {
      id: Date.now().toString(),
      telegramUsername: formData.telegramUsername.startsWith('@') 
        ? formData.telegramUsername 
        : `@${formData.telegramUsername}`,
      displayName: formData.displayName,
      createdAt: new Date().toISOString()
    };

    addParticipant(newParticipant);
    
    toast({
      title: "Success",
      description: "Participant added successfully!",
    });

    // Reset form
    setFormData({
      telegramUsername: '',
      displayName: ''
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Add New Participant</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="telegramUsername">Telegram Username *</Label>
            <Input
              id="telegramUsername"
              value={formData.telegramUsername}
              onChange={(e) => setFormData(prev => ({ ...prev, telegramUsername: e.target.value }))}
              placeholder="@username or username"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name *</Label>
            <Input
              id="displayName"
              value={formData.displayName}
              onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
              placeholder="John Doe"
              required
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
              Add Participant
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
