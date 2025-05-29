
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, userApi } from '../services/api';
import { useToast } from '@/hooks/use-toast';

interface EditParticipantModalProps {
  participant: User;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EditParticipantModal: React.FC<EditParticipantModalProps> = ({ 
  participant, 
  open, 
  onOpenChange 
}) => {
  const [formData, setFormData] = useState({
    telegramId: '',
    username: ''
  });

  const [participants, setParticipants] = useState<User[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    const loadParticipants = async () => {
      const users = await userApi.getAll();
      setParticipants(users);
    };
    loadParticipants();
  }, []);

  useEffect(() => {
    if (participant) {
      setFormData({
        telegramId: participant.telegramId,
        username: participant.username
      });
    }
  }, [participant]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.telegramId || !formData.username) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    // Clean up telegramId (remove @ if present)
    const telegramId = formData.telegramId.startsWith('@')
      ? formData.telegramId.substring(1)
      : formData.telegramId;

    // Check if another participant already has this username
    const existingParticipant = participants.find(
      p => p.id !== participant.id && 
      p.telegramId.toLowerCase() === telegramId.toLowerCase()
    );

    if (existingParticipant) {
      toast({
        title: "Error",
        description: "Another participant with this Telegram ID already exists",
        variant: "destructive",
      });
      return;
    }

    try {
      await userApi.update(participant.id, {
        telegramId,
        username: formData.username
      });

      toast({
        title: "Success",
        description: "Participant updated successfully!",
      });

      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update participant",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Edit Participant</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="telegramId">Telegram ID *</Label>
            <Input
              id="telegramId"
              value={formData.telegramId}
              onChange={(e) => setFormData(prev => ({ ...prev, telegramId: e.target.value }))}
              placeholder="@username or username"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">Name *</Label>
            <Input
              id="username"
              value={formData.username}
              onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
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
