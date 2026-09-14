import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AGI-OS — Cognitive Operating System',
  description: 'Enterprise AI Agent Platform with Governance, Tool Calling, and Real-Time Streaming',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-agi-bg text-agi-text antialiased">
        {children}
      </body>
    </html>
  );
}
