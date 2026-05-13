import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { esES } from '@clerk/localizations';
import './globals.css';

export const metadata: Metadata = {
  title: 'BarberFlow — Panel de gestión',
  description: 'Sistema de gestión de citas para barberías',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider localization={esES as any}>
      <html lang="es">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
