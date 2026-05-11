'use client';
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { api, withToken } from '@/lib/api';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Customer {
  id: string;
  name: string | null;
  whatsappPhone: string;
  createdAt: string;
  _count: { appointments: number };
}

export default function ClientesPage() {
  const { getToken } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const q = search ? `?search=${encodeURIComponent(search)}` : '';
      const data = await api.get<Customer[]>(`/customers${q}`, withToken(token ?? ''));
      setCustomers(data);
    } finally {
      setLoading(false);
    }
  }, [search, getToken]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-zinc-900">Clientes</h1>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
        <Input
          placeholder="Buscar por nombre o teléfono..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50">
              <th className="px-4 py-3 text-left font-medium text-zinc-500">Nombre</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-500">WhatsApp</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-500">Citas</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-500">Registrado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {loading ? (
              <tr>
                <td colSpan={4} className="py-16 text-center text-zinc-400">Cargando...</td>
              </tr>
            ) : customers.map(c => (
              <tr key={c.id} className="hover:bg-zinc-50 cursor-pointer">
                <td className="px-4 py-3">
                  <Link href={`/dashboard/clientes/${c.id}`} className="font-medium text-zinc-900 hover:underline">
                    {c.name ?? <span className="text-zinc-400 italic">Sin nombre</span>}
                  </Link>
                </td>
                <td className="px-4 py-3 text-zinc-600">{c.whatsappPhone}</td>
                <td className="px-4 py-3 text-zinc-600">{c._count.appointments}</td>
                <td className="px-4 py-3 text-zinc-400 text-xs">
                  {format(new Date(c.createdAt), "d MMM yyyy", { locale: es })}
                </td>
              </tr>
            ))}
            {!loading && customers.length === 0 && (
              <tr>
                <td colSpan={4} className="py-16 text-center text-zinc-400">No hay clientes</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
