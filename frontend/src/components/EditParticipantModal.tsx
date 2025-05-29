
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useGameStore, Participant } from '../store/gameStore';
import { useToast } from '@/hooks/use-toast';

interface EditParticipantModalProps {
  participant: Participant;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EditParticipantModal: React.FC<EditParticipantModalProps> = ({ 
  participant, 
  open, 
  onOpenChange 
}) => {
  const [formData, setFormData] = useState({
    telegramUsername: '',
    displayName: ''
  });

  const { updateParticipant, participants } = useGameStore();
  const { toast } = useToast();

  useEffect(() => {
    if (participant) {
      setFormData({
        telegramUsername: participant.telegramUsername,
        displayName: participant.displayName
      });
    }
  }, [participant]);

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

    // Check if another participant already has this username
    const existingParticipant = participants.find(
      p => p.id !== participant.id && 
      p.telegramUsername.toLowerCase() === formData.telegramUsername.toLowerCase()
    );

    if (existingParticipant) {
      toast({
        title: "Error",
        description: "Another participant with this Telegram username already exists",
        variant: "destructive",
      });
      return;
    }

    const updatedParticipant = {
      ...participant,
      telegramUsername: formData.telegramUsername.startsWith('@') 
        ? formData.telegramUsername 
        : `@${formData.telegramUsername}`,
      displayName: formData.displayName
    };

    updateParticipant(updatedParticipant);
    
    toast({
      title: "Success",
      description: "Participant updated successfully!",
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Edit Participant</DialogTitle>
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
              Update Participant
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
