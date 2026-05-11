'use client';
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { format, startOfWeek, addDays, addWeeks, subWeeks } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api, withToken } from '@/lib/api';

interface Appointment {
  id: string;
  scheduledAt: string;
  durationMin: number;
  status: string;
  customer: { name: string | null; whatsappPhone: string };
  barber: { name: string };
  service: { name: string; durationMin: number };
}

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'success' | 'destructive' | 'warning' | 'secondary' | 'outline' }> = {
  CONFIRMED: { label: 'Confirmada', variant: 'success' },
  PENDING: { label: 'Pendiente', variant: 'warning' },
  CANCELLED: { label: 'Cancelada', variant: 'destructive' },
  NO_SHOW: { label: 'No se presentó', variant: 'secondary' },
  COMPLETED: { label: 'Completada', variant: 'outline' },
};

export default function AgendaPage() {
  const { getToken } = useAuth();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const start = format(weekStart, 'yyyy-MM-dd');
      const data = await api.get<Appointment[]>(`/appointments/week?start=${start}`, withToken(token ?? ''));
      setAppointments(data);
    } catch {
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, [weekStart, getToken]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id: string, status: string) => {
    const token = await getToken();
    await api.patch(`/appointments/${id}`, { status }, withToken(token ?? ''));
    load();
  };

  const weekEnd = addDays(weekStart, 6);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-zinc-900">Agenda semanal</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setWeekStart(w => subWeeks(w, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-zinc-600 min-w-[200px] text-center">
            {format(weekStart, "d 'de' MMMM", { locale: es })} – {format(weekEnd, "d 'de' MMMM yyyy", { locale: es })}
          </span>
          <Button variant="outline" size="icon" onClick={() => setWeekStart(w => addWeeks(w, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-zinc-400">Cargando...</div>
      ) : (
        <div className="grid grid-cols-7 gap-2">
          {days.map(day => {
            const dayStr = format(day, 'yyyy-MM-dd');
            const dayAppts = appointments.filter(a => a.scheduledAt.startsWith(dayStr));
            const isToday = format(new Date(), 'yyyy-MM-dd') === dayStr;

            return (
              <div key={dayStr} className="min-h-[300px]">
                <div className={`text-center py-2 mb-2 rounded-md text-sm font-medium ${isToday ? 'bg-zinc-900 text-white' : 'text-zinc-500'}`}>
                  <div>{format(day, 'EEE', { locale: es })}</div>
                  <div className="text-lg font-bold">{format(day, 'd')}</div>
                </div>

                <div className="space-y-1.5">
                  {dayAppts.length === 0 && (
                    <p className="text-xs text-zinc-300 text-center py-4">Sin citas</p>
                  )}
                  {dayAppts.map(appt => (
                    <div key={appt.id} className="rounded-md border border-zinc-200 bg-white p-2 text-xs shadow-sm">
                      <div className="font-medium text-zinc-900">{format(new Date(appt.scheduledAt), 'HH:mm')}</div>
                      <div className="text-zinc-600 truncate">{appt.customer.name ?? appt.customer.whatsappPhone}</div>
                      <div className="text-zinc-500 truncate">{appt.service.name}</div>
                      <div className="text-zinc-400 truncate">{appt.barber.name}</div>
                      <div className="mt-1 flex items-center gap-1 flex-wrap">
                        <Badge variant={STATUS_LABELS[appt.status]?.variant ?? 'secondary'} className="text-[10px] px-1.5 py-0">
                          {STATUS_LABELS[appt.status]?.label ?? appt.status}
                        </Badge>
                      </div>
                      {appt.status === 'CONFIRMED' && (
                        <div className="mt-1.5 flex gap-1">
                          <button
                            onClick={() => updateStatus(appt.id, 'COMPLETED')}
                            className="flex-1 rounded bg-green-50 text-green-700 py-0.5 text-[10px] hover:bg-green-100"
                          >
                            ✓ Completar
                          </button>
                          <button
                            onClick={() => updateStatus(appt.id, 'NO_SHOW')}
                            className="flex-1 rounded bg-red-50 text-red-600 py-0.5 text-[10px] hover:bg-red-100"
                          >
                            ✗ No vino
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
