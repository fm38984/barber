'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { api, withToken } from '@/lib/api';

interface Settings {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  welcomeMessage: string | null;
  status: string;
  plan: { name: string; maxBarbers: number; maxAppointmentsMonth: number };
}

const TIMEZONES = [
  'America/Mexico_City',
  'America/Bogota',
  'America/Lima',
  'America/Santiago',
  'America/Buenos_Aires',
  'America/Caracas',
  'America/Guayaquil',
  'America/La_Paz',
  'America/Asuncion',
  'America/Montevideo',
  'America/Panama',
  'America/Costa_Rica',
  'America/Guatemala',
  'America/Managua',
  'America/Tegucigalpa',
  'America/El_Salvador',
  'America/Honduras',
  'America/Santo_Domingo',
  'America/Puerto_Rico',
];

export default function ConfiguracionPage() {
  const { getToken } = useAuth();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [timezone, setTimezone] = useState('');
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      const data = await api.get<Settings>('/settings', withToken(token ?? ''));
      setSettings(data);
      setTimezone(data.timezone);
      setWelcomeMessage(data.welcomeMessage ?? '');
    })();
  }, [getToken]);

  const save = async () => {
    setSaving(true);
    try {
      const token = await getToken();
      await api.patch('/settings', { timezone, welcomeMessage: welcomeMessage || undefined }, withToken(token ?? ''));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  if (!settings) return <div className="p-6 text-zinc-400">Cargando...</div>;

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-semibold text-zinc-900 mb-6">Configuración</h1>

      <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm mb-4">
        <h2 className="text-sm font-semibold text-zinc-700 mb-1">Plan actual</h2>
        <p className="text-zinc-900 font-medium">{settings.plan.name}</p>
        <p className="text-xs text-zinc-500 mt-0.5">
          Hasta {settings.plan.maxBarbers} barberos · {settings.plan.maxAppointmentsMonth} citas/mes
        </p>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm space-y-5">
        <div>
          <Label htmlFor="tz">Zona horaria</Label>
          <select
            id="tz"
            value={timezone}
            onChange={e => setTimezone(e.target.value)}
            className="mt-1 flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-900"
          >
            {TIMEZONES.map(tz => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="welcome">Mensaje de bienvenida</Label>
          <Textarea
            id="welcome"
            value={welcomeMessage}
            onChange={e => setWelcomeMessage(e.target.value)}
            placeholder="Mensaje que envía el bot al iniciar una conversación..."
            className="mt-1 min-h-[100px]"
          />
          <p className="mt-1 text-xs text-zinc-400">Deja vacío para usar el mensaje predeterminado.</p>
        </div>

        <div>
          <Label>Nombre de la barbería</Label>
          <Input value={settings.name} disabled className="mt-1 bg-zinc-50" />
        </div>

        <div>
          <Label>Slug</Label>
          <Input value={settings.slug} disabled className="mt-1 bg-zinc-50" />
        </div>

        <div className="flex items-center justify-between pt-2">
          {saved && <span className="text-sm text-green-600">Cambios guardados ✓</span>}
          <div className="ml-auto">
            <Button onClick={save} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
