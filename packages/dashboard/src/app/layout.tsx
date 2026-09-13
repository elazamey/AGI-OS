import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Nawah OS',
  description: 'Agent Operating System',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="ltr">
      <body className="h-screen w-screen overflow-hidden">{children}</body>
    </html>
  );
}
