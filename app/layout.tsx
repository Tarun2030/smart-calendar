import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'WhatsApp AI Assistant - Event Manager',
  description: 'Manage your events via WhatsApp with AI-powered extraction. View flights, hotels, meetings, tasks, and deadlines on a beautiful dashboard.',
  keywords: ['whatsapp', 'ai', 'event manager', 'calendar', 'assistant'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        {children}
      </body>
    </html>
  );
}
