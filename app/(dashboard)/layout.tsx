import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen">
      <Sidebar />
      <div className="md:ml-64">
        <Header />
        <main className="min-h-[calc(100vh-4rem)]">{children}</main>
      </div>
    </div>
  );
}
