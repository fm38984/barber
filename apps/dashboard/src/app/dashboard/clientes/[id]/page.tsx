'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api, withToken } from '@/lib/api';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Appointment {
  id: string;
  scheduledAt: string;
  status: string;
  barber: { name: string };
  service: { name: string; priceLocal: number; currency: string };
}

interface CustomerDetail {
  id: string;
  name: string | null;
  whatsappPhone: string;
  createdAt: string;
  appointments: Appointment[];
}

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'success' | 'destructive' | 'warning' | 'secondary' | 'outline' }> = {
  CONFIRMED: { label: 'Confirmada', variant: 'success' },
  PENDING: { label: 'Pendiente', variant: 'warning' },
  CANCELLED: { label: 'Cancelada', variant: 'destructive' },
  NO_SHOW: { label: 'No se presentó', variant: 'secondary' },
  COMPLETED: { label: 'Completada', variant: 'outline' },
};

export default function CustomerDetailPage() {
  const { getToken } = useAuth();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      const data = await api.get<CustomerDetail>(`/customers/${id}`, withToken(token ?? ''));
      setCustomer(data);
    })();
  }, [id, getToken]);

  if (!customer) return <div className="p-6 text-zinc-400">Cargando...</div>;

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">{customer.name ?? 'Cliente sin nombre'}</h1>
          <p className="text-sm text-zinc-500">{customer.whatsappPhone}</p>
        </div>
      </div>

      <div className="mb-4 flex gap-4 text-sm text-zinc-500">
        <span>Registrado: {format(new Date(customer.createdAt), "d 'de' MMMM yyyy", { locale: es })}</span>
        <span>•</span>
        <span>{customer.appointments.length} citas en total</span>
      </div>

      <h2 className="text-sm font-semibold text-zinc-700 mb-3">Historial de citas</h2>

      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50">
              <th className="px-4 py-3 text-left font-medium text-zinc-500">Fecha</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-500">Servicio</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-500">Barbero</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-500">Precio</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-500">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {customer.appointments.map(a => (
              <tr key={a.id}>
                <td className="px-4 py-3 text-zinc-700">
                  {format(new Date(a.scheduledAt), "d MMM yyyy HH:mm", { locale: es })}
                </td>
                <td className="px-4 py-3 text-zinc-700">{a.service.name}</td>
                <td className="px-4 py-3 text-zinc-600">{a.barber.name}</td>
                <td className="px-4 py-3 text-zinc-600">{a.service.priceLocal} {a.service.currency}</td>
                <td className="px-4 py-3">
                  <Badge variant={STATUS_LABELS[a.status]?.variant ?? 'secondary'}>
                    {STATUS_LABELS[a.status]?.label ?? a.status}
                  </Badge>
                </td>
              </tr>
            ))}
            {customer.appointments.length === 0 && (
              <tr>
                <td colSpan={5} className="py-10 text-center text-zinc-400">Sin citas registradas</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
