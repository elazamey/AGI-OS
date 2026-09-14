// ═══════════════════════════════════════════════════════
// OAuth Callback Handler — Exchange code, register capability
// ═══════════════════════════════════════════════════════

import type { NextRequest } from 'next/server';
import { exchangeCodeForToken, OAUTH_PROVIDERS } from '@/lib/oauth-providers';
import { storeToken } from '@/lib/token-store';
import { setIntegrationStatus } from '@/lib/integration-store';

function htmlResponse(body: string): Response {
  return new Response(body, { headers: { 'Content-Type': 'text/html' } });
}

function errorPage(providerId: string, error: string): Response {
  return htmlResponse(`
    <html><body><script>
      window.opener?.postMessage({ type: 'oauth_error', provider: '${providerId}', error: '${error}' }, '*');
      document.body.innerHTML = '<div style="font-family:sans-serif;text-align:center;padding:40px;background:#0a0a0f;color:#ef4444"><h2>❌ Authorization Failed</h2><p style="color:#94a3b8;margin-top:10px">${error}</p></div>';
      setTimeout(() => window.close(), 3000);
    </script></body></html>
  `);
}

function successPage(providerId: string, providerName: string, capabilities: string[]): Response {
  return htmlResponse(`
    <html><body><script>
      window.opener?.postMessage({
        type: 'oauth_callback',
        provider: '${providerId}',
        connected: true,
        capabilities: ${JSON.stringify(capabilities)},
        connectedAt: Date.now()
      }, '*');
      document.body.innerHTML = '<div style="font-family:sans-serif;text-align:center;padding:40px;background:#0a0a0f;color:#10b981"><h2>✅ ${providerName} Connected</h2><p style="color:#94a3b8;margin-top:10px">This window will close automatically.</p></div>';
      setTimeout(() => window.close(), 1500);
    </script></body></html>
  `);
}

function getCapabilitiesForProvider(providerId: string): string[] {
  const map: Record<string, string[]> = {
    google: ['drive_sync', 'doc_read', 'calendar_query', 'web_search'],
    github: ['git_commit', 'create_pull_request', 'manage_issues', 'trigger_workflow'],
    slack: ['send_message', 'read_channel', 'upload_file'],
    notion: ['read_page', 'write_page', 'query_database'],
    jira: ['create_issue', 'update_issue', 'manage_sprint'],
    linear: ['create_issue', 'track_project', 'manage_cycle'],
  };
  return map[providerId] || [];
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const providerId = searchParams.get('provider') || state?.split('_')[0];

  if (!code || !providerId) {
    return errorPage(providerId || 'unknown', 'Missing authorization code');
  }

  const provider = OAUTH_PROVIDERS[providerId];
  if (!provider) {
    return errorPage(providerId, `Unknown provider: ${providerId}`);
  }

  try {
    const tokens = await exchangeCodeForToken(providerId, code);

    storeToken(providerId, {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      connectedAt: Date.now(),
      provider: providerId,
    });

    const capabilities = getCapabilitiesForProvider(providerId);
    setIntegrationStatus(providerId, 'connected', capabilities);

    return successPage(providerId, provider.name, capabilities);
  } catch (error) {
    return errorPage(providerId, String(error));
  }
}
