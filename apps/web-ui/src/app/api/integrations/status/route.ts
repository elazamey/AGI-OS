// ═══════════════════════════════════════════════════════
// Integrations Status API — Returns connected account status
// ═══════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { getAllIntegrationStatuses } from '@/lib/integration-store';

export async function GET() {
  const accounts = getAllIntegrationStatuses();
  return NextResponse.json({ accounts });
}
