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

interface Service {
  id: string;
  name: string;
  durationMin: number;
  priceLocal: number;
  currency: string;
  isActive: boolean;
}

export default function ServiciosPage() {
  const { getToken } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [form, setForm] = useState({ name: '', durationMin: 30, priceLocal: 0, currency: 'USD' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const token = await getToken();
    const data = await api.get<Service[]>('/services', withToken(token ?? ''));
    setServices(data);
  }, [getToken]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', durationMin: 30, priceLocal: 0, currency: 'USD' });
    setOpen(true);
  };

  const openEdit = (s: Service) => {
    setEditing(s);
    setForm({ name: s.name, durationMin: s.durationMin, priceLocal: s.priceLocal, currency: s.currency });
    setOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const token = await getToken();
      if (editing) {
        await api.patch(`/services/${editing.id}`, form, withToken(token ?? ''));
      } else {
        await api.post('/services', form, withToken(token ?? ''));
      }
      setOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async (id: string) => {
    const token = await getToken();
    await api.delete(`/services/${id}`, withToken(token ?? ''));
    load();
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-zinc-900">Servicios</h1>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nuevo servicio
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50">
              <th className="px-4 py-3 text-left font-medium text-zinc-500">Nombre</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-500">Duración</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-500">Precio</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-500">Estado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {services.map(s => (
              <tr key={s.id}>
                <td className="px-4 py-3 font-medium text-zinc-900">{s.name}</td>
                <td className="px-4 py-3 text-zinc-600">{s.durationMin} min</td>
                <td className="px-4 py-3 text-zinc-600">{s.priceLocal} {s.currency}</td>
                <td className="px-4 py-3">
                  <Badge variant={s.isActive ? 'success' : 'secondary'}>
                    {s.isActive ? 'Activo' : 'Inactivo'}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {s.isActive && (
                      <Button variant="ghost" size="icon" onClick={() => deactivate(s.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {services.length === 0 && (
              <tr>
                <td colSpan={5} className="py-16 text-center text-zinc-400">No hay servicios registrados</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar servicio' : 'Nuevo servicio'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Nombre</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Corte clásico" className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Duración (min)</Label>
                <Input type="number" value={form.durationMin} onChange={e => setForm(f => ({ ...f, durationMin: +e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>Precio</Label>
                <Input type="number" step="0.01" value={form.priceLocal} onChange={e => setForm(f => ({ ...f, priceLocal: +e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Moneda</Label>
              <Input value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} className="mt-1" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={!form.name.trim() || saving}>
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
