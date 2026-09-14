'use client';
import { useState, useEffect, useCallback } from 'react';
import { Link, CheckCircle2, Loader2, ExternalLink, Shield } from 'lucide-react';
import { useAgiStore } from '@/lib/store';

interface ConnectedAccount {
  id: string;
  provider: string;
  label: string;
  description: string;
  icon: string;
  scopes: string[];
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  connectedAt?: number;
  capabilities?: string[];
}

const PROVIDERS: Omit<ConnectedAccount, 'status'>[] = [
  {
    id: 'google',
    provider: 'google',
    label: 'Google Workspace',
    description: 'Drive Sync, Docs, Calendar & Search',
    icon: '🟡',
    scopes: ['drive', 'docs', 'calendar', 'search'],
    capabilities: ['drive_sync', 'doc_read', 'calendar_query', 'web_search'],
  },
  {
    id: 'github',
    provider: 'github',
    label: 'GitHub',
    description: 'Repos, PRs, Issues & Actions',
    icon: '⚫',
    scopes: ['repo', 'workflow', 'read:org'],
    capabilities: ['git_commit', 'create_pull_request', 'manage_issues', 'trigger_workflow'],
  },
  {
    id: 'slack',
    provider: 'slack',
    label: 'Slack',
    description: 'Channels, Messages & Files',
    icon: '🟣',
    scopes: ['channels:read', 'chat:write', 'files:read'],
    capabilities: ['send_message', 'read_channel', 'upload_file'],
  },
  {
    id: 'notion',
    provider: 'notion',
    label: 'Notion',
    description: 'Pages, Databases & Knowledge Base',
    icon: '⬜',
    scopes: ['pages', 'databases', 'search'],
    capabilities: ['read_page', 'write_page', 'query_database'],
  },
  {
    id: 'jira',
    provider: 'jira',
    label: 'Jira',
    description: 'Issues, Sprints & Boards',
    icon: '🔵',
    scopes: ['project', 'issue', 'board'],
    capabilities: ['create_issue', 'update_issue', 'manage_sprint'],
  },
  {
    id: 'linear',
    provider: 'linear',
    label: 'Linear',
    description: 'Issues, Projects & Cycles',
    icon: '🟤',
    scopes: ['issues', 'projects', 'cycles'],
    capabilities: ['create_issue', 'track_project', 'manage_cycle'],
  },
];

export function IntegrationsPanel() {
  const { connectedAccounts, updateAccountStatus } = useAgiStore();
  const [accounts, setAccounts] = useState<ConnectedAccount[]>(() =>
    PROVIDERS.map((p) => {
      const existing = connectedAccounts.find((a) => a.id === p.id);
      return { ...p, status: existing?.status || 'disconnected', connectedAt: existing?.connectedAt };
    })
  );

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch('http://localhost:4000/api/integrations/status');
        if (res.ok) {
          const data = await res.json();
          setAccounts((prev) =>
            prev.map((a) => {
              const server = data.accounts?.find((s: ConnectedAccount) => s.id === a.id);
              if (server) {
                return { ...a, status: server.status, connectedAt: server.connectedAt, capabilities: server.capabilities };
              }
              return a;
            })
          );
        }
      } catch { /* backend offline */ }
    };
    checkStatus();
    const interval = setInterval(checkStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleConnect = useCallback((providerId: string) => {
    setAccounts((prev) => prev.map((a) => a.id === providerId ? { ...a, status: 'connecting' } : a));

    const popup = window.open(
      `/api/auth/${providerId}`,
      `oauth_${providerId}`,
      'width=500,height=600,left=200,top=100'
    );

    const poll = setInterval(() => {
      if (!popup || popup.closed) {
        clearInterval(poll);
        setAccounts((prev) => {
          const acc = prev.find((a) => a.id === providerId);
          if (acc?.status === 'connecting') {
            return prev.map((a) => a.id === providerId ? { ...a, status: 'error' } : a);
          }
          return prev;
        });
      }
    }, 500);

    window.addEventListener('message', (event) => {
      if (event.data?.type === 'oauth_callback' && event.data.provider === providerId) {
        clearInterval(poll);
        setAccounts((prev) =>
          prev.map((a) =>
            a.id === providerId
              ? { ...a, status: 'connected', connectedAt: Date.now() }
              : a
          )
        );
        updateAccountStatus(providerId, 'connected');
        popup?.close();
      }
    });
  }, [updateAccountStatus]);

  const handleDisconnect = useCallback(async (providerId: string) => {
    setAccounts((prev) => prev.map((a) => a.id === providerId ? { ...a, status: 'disconnected', connectedAt: undefined } : a));
    updateAccountStatus(providerId, 'disconnected');
  }, [updateAccountStatus]);

  const connectedCount = accounts.filter((a) => a.status === 'connected').length;
  const totalCapabilities = accounts.filter((a) => a.status === 'connected').reduce((s, a) => s + (a.capabilities?.length || 0), 0);

  return (
    <div className="p-4 space-y-4 text-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-700/50 pb-3">
        <div>
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Link size={16} className="text-agi-cyan" />
            Connected Accounts
          </h3>
          <p className="text-[10px] text-slate-400 mt-0.5">
            OAuth-powered integrations → Auto-registered as Capabilities
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="chip chip-cyan text-[9px]">{connectedCount} active</span>
          <span className="chip chip-green text-[9px]">{totalCapabilities} skills</span>
        </div>
      </div>

      {/* Flow Indicator */}
      <div className="glass p-3 rounded-xl">
        <div className="flex items-center gap-2 text-[10px] text-slate-400">
          <span className="text-agi-cyan font-semibold">OAuth Consent</span>
          <span>→</span>
          <span className="text-agi-green font-semibold">Token Vault</span>
          <span>→</span>
          <span className="text-agi-purple font-semibold">CapabilityRegistry</span>
          <span>→</span>
          <span className="text-agi-orange font-semibold">Agent Planner</span>
        </div>
      </div>

      {/* Provider Cards */}
      <div className="space-y-2">
        {accounts.map((account) => (
          <div
            key={account.id}
            className={`glass p-3 rounded-xl transition-all ${
              account.status === 'connected' ? 'border-emerald-500/30 glow-green' : ''
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xl">{account.icon}</span>
                <div>
                  <p className="text-xs font-semibold">{account.label}</p>
                  <p className="text-[10px] text-slate-400">{account.description}</p>
                  {account.status === 'connected' && account.capabilities && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {account.capabilities.map((cap) => (
                        <span key={cap} className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[8px] border border-emerald-500/20">
                          {cap}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                {account.status === 'connected' ? (
                  <>
                    <div className="flex items-center gap-1 text-emerald-400 text-[10px]">
                      <CheckCircle2 size={10} />
                      Connected
                    </div>
                    <button
                      onClick={() => handleDisconnect(account.id)}
                      className="text-[9px] text-slate-500 hover:text-red-400 transition"
                    >
                      Disconnect
                    </button>
                  </>
                ) : account.status === 'connecting' ? (
                  <div className="flex items-center gap-1 text-agi-cyan text-[10px]">
                    <Loader2 size={10} className="animate-spin" />
                    Authorizing...
                  </div>
                ) : (
                  <button
                    onClick={() => handleConnect(account.id)}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-[10px] font-semibold transition flex items-center gap-1"
                  >
                    <ExternalLink size={10} />
                    Connect
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Security Note */}
      <div className="glass p-3 rounded-xl">
        <div className="flex items-center gap-2 text-[10px] text-slate-400">
          <Shield size={12} className="text-agi-green shrink-0" />
          <span>
            Tokens stored in encrypted vault. All capability access is policy-gated
            via <span className="text-agi-cyan font-semibold">PolicyGate</span> with
            deny-by-default enforcement.
          </span>
        </div>
      </div>
    </div>
  );
}
