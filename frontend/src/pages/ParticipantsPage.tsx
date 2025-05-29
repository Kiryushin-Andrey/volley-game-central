
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, UserPlus, Edit, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { User, userApi } from '../services/api';
import { AddParticipantModal } from '../components/AddParticipantModal';
import { EditParticipantModal } from '../components/EditParticipantModal';
import { useToast } from '@/hooks/use-toast';

const ParticipantsPage = () => {
  const [showAddParticipant, setShowAddParticipant] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState<User | null>(null);
  const navigate = useNavigate();
  const [participants, setParticipants] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchParticipants = async () => {
    try {
      setLoading(true);
      const users = await userApi.getAll();
      setParticipants(users);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load participants",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchParticipants();
  }, []);
  const { toast } = useToast();

  React.useEffect(() => {
    fetchParticipants();
  }, [fetchParticipants]);

  const handleRemoveParticipant = async (participantId: number) => {
    if (window.confirm('Are you sure you want to remove this participant?')) {
      try {
        await userApi.remove(participantId);
        await fetchParticipants();
        toast({
          title: "Success",
          description: "Participant removed successfully",
        });
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to remove participant",
          variant: "destructive",
        });
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-blue-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Button
              variant="outline"
              onClick={() => navigate('/')}
              className="border-gray-300"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </div>
          
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">Participants Management</h1>
              <p className="text-gray-600">Manage all registered participants</p>
            </div>
            
            <Button 
              onClick={() => setShowAddParticipant(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Add New Participant
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Participants ({participants.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {participants.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">No participants registered yet</p>
                <Button 
                  onClick={() => setShowAddParticipant(true)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  Add First Participant
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Display Name</TableHead>
                    <TableHead>Telegram Username</TableHead>
                    <TableHead>Registration Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {participants.map((participant) => (
                    <TableRow key={participant.id}>
                      <TableCell className="font-medium">
                        {participant.username}
                      </TableCell>
                      <TableCell>@{participant.telegramId}</TableCell>
                      <TableCell>
                        {new Date(participant.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingParticipant(participant)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRemoveParticipant(participant.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <AddParticipantModal 
          open={showAddParticipant} 
          onOpenChange={setShowAddParticipant} 
        />
        
        {editingParticipant && (
          <EditParticipantModal 
            participant={editingParticipant}
            open={!!editingParticipant} 
            onOpenChange={(open) => !open && setEditingParticipant(null)} 
          />
        )}
      </div>
    </div>
  );
};

export default ParticipantsPage;
