import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { AdminShell } from './admin-shell';

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations('admin');
  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <Link href={`/${locale}`} className="text-sm text-neutral-500 hover:underline">
        VOLTSTAR
      </Link>
      <h1 className="mb-4 mt-2 text-3xl font-bold">{t('title')}</h1>
      <AdminShell>{children}</AdminShell>
    </main>
  );
}
