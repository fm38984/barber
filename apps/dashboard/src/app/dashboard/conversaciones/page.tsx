'use client';
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { MessageSquare, UserCheck, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api, withToken } from '@/lib/api';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Conversation {
  id: string;
  status: 'ACTIVE' | 'ESCALATED' | 'CLOSED';
  lastMessageAt: string;
  stateJson: { state: string };
  customer: { id: string; name: string | null; whatsappPhone: string };
}

const STATUS_CONFIG = {
  ESCALATED: { label: 'Escalada', variant: 'destructive' as const },
  ACTIVE: { label: 'Activa', variant: 'success' as const },
  CLOSED: { label: 'Cerrada', variant: 'secondary' as const },
};

export default function ConversacionesPage() {
  const { getToken } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [filter, setFilter] = useState<'ESCALATED' | 'ACTIVE' | ''>('ESCALATED');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const q = filter ? `?status=${filter}` : '';
      const data = await api.get<Conversation[]>(`/conversations${q}`, withToken(token ?? ''));
      setConversations(data);
    } finally {
      setLoading(false);
    }
  }, [filter, getToken]);

  useEffect(() => { load(); }, [load]);

  const release = async (id: string) => {
    const token = await getToken();
    await api.patch(`/conversations/${id}/release`, {}, withToken(token ?? ''));
    load();
  };

  const takeControl = async (id: string) => {
    const token = await getToken();
    await api.patch(`/conversations/${id}/take-control`, {}, withToken(token ?? ''));
    load();
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-zinc-900">Conversaciones</h1>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="h-4 w-4" />
          Actualizar
        </Button>
      </div>

      <div className="flex gap-2 mb-4">
        {([['ESCALATED', 'Escaladas'], ['ACTIVE', 'Activas'], ['', 'Todas']] as const).map(([val, label]) => (
          <button
            key={val}
            onClick={() => setFilter(val as typeof filter)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${filter === val ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {loading ? (
          <p className="text-center py-16 text-zinc-400">Cargando...</p>
        ) : conversations.length === 0 ? (
          <p className="text-center py-16 text-zinc-400">Sin conversaciones</p>
        ) : conversations.map(conv => (
          <div key={conv.id} className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-zinc-100 flex items-center justify-center">
                <MessageSquare className="h-4 w-4 text-zinc-500" />
              </div>
              <div>
                <p className="font-medium text-zinc-900">
                  {conv.customer.name ?? conv.customer.whatsappPhone}
                </p>
                <p className="text-xs text-zinc-400">
                  {conv.customer.whatsappPhone} · Estado bot: {conv.stateJson?.state ?? '–'}
                </p>
                <p className="text-xs text-zinc-300">
                  Último mensaje: {format(new Date(conv.lastMessageAt), "d MMM, HH:mm", { locale: es })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={STATUS_CONFIG[conv.status]?.variant ?? 'secondary'}>
                {STATUS_CONFIG[conv.status]?.label ?? conv.status}
              </Badge>
              {conv.status === 'ESCALATED' && (
                <Button size="sm" variant="outline" onClick={() => release(conv.id)}>
                  <UserCheck className="h-3.5 w-3.5" />
                  Liberar bot
                </Button>
              )}
              {conv.status === 'ACTIVE' && (
                <Button size="sm" variant="outline" onClick={() => takeControl(conv.id)}>
                  Tomar control
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
