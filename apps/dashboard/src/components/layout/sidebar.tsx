'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Calendar,
  Users,
  Scissors,
  MessageSquare,
  BarChart2,
  Settings,
  Layers,
  LogOut,
} from 'lucide-react';
import { useClerk } from '@clerk/nextjs';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/dashboard/agenda', label: 'Agenda', icon: Calendar },
  { href: '/dashboard/barberos', label: 'Barberos', icon: Users },
  { href: '/dashboard/servicios', label: 'Servicios', icon: Scissors },
  { href: '/dashboard/clientes', label: 'Clientes', icon: Users },
  { href: '/dashboard/conversaciones', label: 'Conversaciones', icon: MessageSquare },
  { href: '/dashboard/reportes', label: 'Reportes', icon: BarChart2 },
  { href: '/dashboard/configuracion', label: 'Configuración', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { signOut } = useClerk();

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-zinc-200 bg-white">
      <div className="flex h-14 items-center gap-2 border-b border-zinc-200 px-4">
        <Layers className="h-5 w-5 text-zinc-900" />
        <span className="font-semibold text-zinc-900">BarberFlow</span>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              pathname.startsWith(href)
                ? 'bg-zinc-900 text-white'
                : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900',
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="border-t border-zinc-200 p-3">
        <button
          onClick={() => signOut({ redirectUrl: '/sign-in' })}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
