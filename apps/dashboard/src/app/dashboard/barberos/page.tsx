'use client';
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { api, withToken } from '@/lib/api';

interface WorkingHours {
  start: string;
  end: string;
}

interface WeeklySchedule {
  monday?: WorkingHours;
  tuesday?: WorkingHours;
  wednesday?: WorkingHours;
  thursday?: WorkingHours;
  friday?: WorkingHours;
  saturday?: WorkingHours;
  sunday?: WorkingHours;
}

interface Barber {
  id: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
  workingHoursJson: WeeklySchedule | null;
}

const DAYS: { key: keyof WeeklySchedule; label: string }[] = [
  { key: 'monday', label: 'Lunes' },
  { key: 'tuesday', label: 'Martes' },
  { key: 'wednesday', label: 'Miércoles' },
  { key: 'thursday', label: 'Jueves' },
  { key: 'friday', label: 'Viernes' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' },
];

const DEFAULT_HOURS: WeeklySchedule = {
  monday: { start: '09:00', end: '18:00' },
  tuesday: { start: '09:00', end: '18:00' },
  wednesday: { start: '09:00', end: '18:00' },
  thursday: { start: '09:00', end: '18:00' },
  friday: { start: '09:00', end: '18:00' },
  saturday: { start: '09:00', end: '15:00' },
};

export default function BarberosPage() {
  const { getToken } = useAuth();
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Barber | null>(null);
  const [name, setName] = useState('');
  const [schedule, setSchedule] = useState<WeeklySchedule>(DEFAULT_HOURS);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const token = await getToken();
    const data = await api.get<Barber[]>('/barbers', withToken(token ?? ''));
    setBarbers(data);
  }, [getToken]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setName('');
    setSchedule(DEFAULT_HOURS);
    setOpen(true);
  };

  const openEdit = (b: Barber) => {
    setEditing(b);
    setName(b.name);
    setSchedule(b.workingHoursJson ?? DEFAULT_HOURS);
    setOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const token = await getToken();
      const payload = { name, workingHoursJson: schedule };
      if (editing) {
        await api.patch(`/barbers/${editing.id}`, payload, withToken(token ?? ''));
      } else {
        await api.post('/barbers', payload, withToken(token ?? ''));
      }
      setOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async (id: string) => {
    const token = await getToken();
    await api.delete(`/barbers/${id}`, withToken(token ?? ''));
    load();
  };

  const toggleDay = (day: keyof WeeklySchedule) => {
    setSchedule(prev => {
      const next = { ...prev };
      if (next[day]) {
        delete next[day];
      } else {
        next[day] = { start: '09:00', end: '18:00' };
      }
      return next;
    });
  };

  const setDayHours = (day: keyof WeeklySchedule, field: 'start' | 'end', value: string) => {
    setSchedule(prev => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-zinc-900">Barberos</h1>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nuevo barbero
        </Button>
      </div>

      <div className="grid gap-3">
        {barbers.map(b => (
          <div key={b.id} className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-zinc-100 flex items-center justify-center text-sm font-bold text-zinc-600">
                {b.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-medium text-zinc-900">{b.name}</p>
                <div className="flex gap-1 mt-0.5">
                  {DAYS.filter(d => b.workingHoursJson?.[d.key]).map(d => (
                    <span key={d.key} className="text-xs text-zinc-400">{d.label.slice(0, 2)}</span>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={b.status === 'ACTIVE' ? 'success' : 'secondary'}>
                {b.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
              </Badge>
              <Button variant="ghost" size="icon" onClick={() => openEdit(b)}>
                <Pencil className="h-4 w-4" />
              </Button>
              {b.status === 'ACTIVE' && (
                <Button variant="ghost" size="icon" onClick={() => deactivate(b.id)}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              )}
            </div>
          </div>
        ))}
        {barbers.length === 0 && (
          <p className="text-center py-16 text-zinc-400">No hay barberos registrados</p>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar barbero' : 'Nuevo barbero'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Nombre</Label>
              <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="Nombre del barbero" className="mt-1" />
            </div>

            <div>
              <Label>Horario de trabajo</Label>
              <div className="mt-2 space-y-2">
                {DAYS.map(({ key, label }) => {
                  const active = !!schedule[key];
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <button
                        onClick={() => toggleDay(key)}
                        className={`w-24 rounded text-xs py-1 font-medium border transition-colors ${active ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-400 border-zinc-200'}`}
                      >
                        {label}
                      </button>
                      {active && (
                        <div className="flex items-center gap-2 text-sm">
                          <Input
                            type="time"
                            value={schedule[key]?.start ?? '09:00'}
                            onChange={e => setDayHours(key, 'start', e.target.value)}
                            className="h-7 w-28 text-xs"
                          />
                          <span className="text-zinc-400">–</span>
                          <Input
                            type="time"
                            value={schedule[key]?.end ?? '18:00'}
                            onChange={e => setDayHours(key, 'end', e.target.value)}
                            className="h-7 w-28 text-xs"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={!name.trim() || saving}>
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
