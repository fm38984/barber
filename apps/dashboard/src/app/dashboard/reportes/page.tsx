'use client';
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { api, withToken } from '@/lib/api';

interface Summary {
  total: number;
  confirmed: number;
  cancelled: number;
  noShow: number;
  noShowRate: number;
  topServices: Array<{ service: { name: string } | undefined; count: number }>;
  byBarber: Array<{ barber: { name: string } | undefined; count: number }>;
}

interface DayData {
  date: string;
  confirmed: number;
  noShow: number;
}

export default function ReportesPage() {
  const { getToken } = useAuth();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [daily, setDaily] = useState<DayData[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const headers = withToken(token ?? '');
      const [s, d] = await Promise.all([
        api.get<Summary>('/reports/summary', headers),
        api.get<DayData[]>('/reports/daily', headers),
      ]);
      setSummary(s);
      setDaily(d);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => { load(); }, [load]);

  const exportCsv = async () => {
    const token = await getToken();
    const res = await fetch(`${process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/api/v1'}/reports/export/csv`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'include',
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'reporte.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="p-6 text-zinc-400">Cargando...</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-900">Reportes</h1>
        <Button variant="outline" onClick={exportCsv}>
          <Download className="h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      {summary && (
        <>
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Total citas', value: summary.total },
              { label: 'Confirmadas', value: summary.confirmed },
              { label: 'Canceladas', value: summary.cancelled },
              { label: 'Tasa no-show', value: `${summary.noShowRate}%` },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
                <p className="text-xs text-zinc-500">{label}</p>
                <p className="mt-1 text-2xl font-bold text-zinc-900">{value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-zinc-700">Citas por día (últimos 30 días)</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={daily}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="confirmed" name="Confirmadas" fill="#18181b" radius={[3, 3, 0, 0]} />
                <Bar dataKey="noShow" name="No se presentó" fill="#fca5a5" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold text-zinc-700">Servicios más populares</h2>
              <div className="space-y-2">
                {summary.topServices.map((s, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-zinc-700">{s.service?.name ?? '–'}</span>
                    <span className="font-medium text-zinc-900">{s.count}</span>
                  </div>
                ))}
                {summary.topServices.length === 0 && <p className="text-zinc-400 text-sm">Sin datos</p>}
              </div>
            </div>

            <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold text-zinc-700">Citas por barbero</h2>
              <div className="space-y-2">
                {summary.byBarber.map((b, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-zinc-700">{b.barber?.name ?? '–'}</span>
                    <span className="font-medium text-zinc-900">{b.count}</span>
                  </div>
                ))}
                {summary.byBarber.length === 0 && <p className="text-zinc-400 text-sm">Sin datos</p>}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
