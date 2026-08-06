'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, Plus, Loader2 } from 'lucide-react';
import { useConfirm } from '@/contexts/confirm.context';
import { useStaffMembers } from '@/hooks/use-production-staff';
import StaffCreateDialog from './staff-create-dialog';

export default function StaffList() {
  const confirm = useConfirm();
  const { staff, isLoading, createStaffMember, isCreating, updateStaffMember } = useStaffMembers();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const handleToggleActive = async (staffId: string, name: string, isActive: boolean) => {
    const ok = await confirm({
      title: isActive ? 'Desactivar personal' : 'Reactivar personal',
      description: `¿${isActive ? 'Desactivar' : 'Reactivar'} a ${name}?`,
    });
    if (!ok) return;
    await updateStaffMember({ staffId, input: { isActive: !isActive } });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Personal</h2>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo miembro
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : staff.length === 0 ? (
        <Card className="p-8 flex flex-col items-center justify-center">
          <Users className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">Sin personal registrado</p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {staff.map((member) => (
            <Card key={member.id} className="p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium">{member.name}</span>
                  <Badge variant={member.isActive ? 'default' : 'secondary'}>
                    {member.isActive ? 'Activo' : 'Inactivo'}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  {member.role} · {member.assignedTasks}/{member.maxTasks} tareas
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleToggleActive(member.id, member.name, member.isActive)}
              >
                {member.isActive ? 'Desactivar' : 'Reactivar'}
              </Button>
            </Card>
          ))}
        </div>
      )}

      {isCreateOpen && (
        <StaffCreateDialog
          isSubmitting={isCreating}
          onClose={() => setIsCreateOpen(false)}
          onSubmit={async (input) => {
            await createStaffMember(input);
            setIsCreateOpen(false);
          }}
        />
      )}
    </div>
  );
}
