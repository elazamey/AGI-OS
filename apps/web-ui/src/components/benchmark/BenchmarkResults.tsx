'use client';
import { LATEST_SCORECARD } from '@/lib/benchmark-data';
import { Shield, Heart, Coins, Trophy, TrendingUp, Crown, Medal, Award } from 'lucide-react';

export function BenchmarkResults() {
  const data = LATEST_SCORECARD;

  const scoreColor = (score: number) => {
    if (score >= 90) return 'text-emerald-400';
    if (score >= 70) return 'text-amber-400';
    if (score >= 50) return 'text-orange-400';
    return 'text-red-400';
  };

  const scoreBg = (score: number) => {
    if (score >= 90) return 'bg-emerald-500/10 border-emerald-500/20';
    if (score >= 70) return 'bg-amber-500/10 border-amber-500/20';
    if (score >= 50) return 'bg-orange-500/10 border-orange-500/20';
    return 'bg-red-500/10 border-red-500/20';
  };

  const rankIcon = (i: number) => {
    if (i === 0) return <Crown size={16} className="text-yellow-400" />;
    if (i === 1) return <Medal size={16} className="text-slate-300" />;
    if (i === 2) return <Award size={16} className="text-amber-600" />;
    return <span className="text-xs text-slate-500 w-4 text-center">{i + 1}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Trophy size={24} className="text-yellow-400" />
          <h1 className="text-2xl font-bold text-white">Arena Evaluation Scorecard</h1>
          <Trophy size={24} className="text-yellow-400" />
        </div>
        <p className="text-sm text-slate-400">
          {data.version} — {new Date(data.timestamp).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Overall Score */}
      <div className="glass-strong p-6 rounded-2xl text-center">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-2">Overall Score</p>
        <div className="text-6xl font-black text-emerald-400">{data.overallScore}</div>
        <p className="text-sm text-slate-400 mt-1">out of 100</p>
        <div className="flex justify-center gap-2 mt-3">
          <span className="chip chip-green">Verified</span>
          <span className="chip chip-cyan">Live Benchmark</span>
        </div>
      </div>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className={`glass p-4 rounded-xl border ${scoreBg(data.scores.redTeamBlockRate)}`}>
          <div className="flex items-center gap-2 mb-2">
            <Shield size={16} className="text-red-400" />
            <span className="text-xs font-semibold text-slate-300">Red Team</span>
          </div>
          <div className={`text-2xl font-bold ${scoreColor(data.scores.redTeamBlockRate)}`}>
            {data.scores.redTeamBlockRate}%
          </div>
          <p className="text-[10px] text-slate-500 mt-1">{data.redTeam.blocked}/{data.redTeam.totalScenarios} attacks blocked</p>
        </div>

        <div className={`glass p-4 rounded-xl border ${scoreBg(100 - data.scores.governanceBypassRate)}`}>
          <div className="flex items-center gap-2 mb-2">
            <Shield size={16} className="text-purple-400" />
            <span className="text-xs font-semibold text-slate-300">Governance</span>
          </div>
          <div className={`text-2xl font-bold ${scoreColor(100 - data.scores.governanceBypassRate)}`}>
            {(100 - data.scores.governanceBypassRate)}%
          </div>
          <p className="text-[10px] text-slate-500 mt-1">{data.governance.correctlyHandled}/{data.governance.totalScenarios} correct</p>
        </div>

        <div className={`glass p-4 rounded-xl border ${scoreBg(data.scores.selfHealingSuccess)}`}>
          <div className="flex items-center gap-2 mb-2">
            <Heart size={16} className="text-green-400" />
            <span className="text-xs font-semibold text-slate-300">Self-Healing</span>
          </div>
          <div className={`text-2xl font-bold ${scoreColor(data.scores.selfHealingSuccess)}`}>
            {data.scores.selfHealingSuccess}%
          </div>
          <p className="text-[10px] text-slate-500 mt-1">{data.selfHealing.recovered}/{data.selfHealing.totalScenarios} recovered</p>
        </div>

        <div className={`glass p-4 rounded-xl border ${scoreBg(data.scores.tokenEfficiencyRatio)}`}>
          <div className="flex items-center gap-2 mb-2">
            <Coins size={16} className="text-amber-400" />
            <span className="text-xs font-semibold text-slate-300">Efficiency</span>
          </div>
          <div className={`text-2xl font-bold ${scoreColor(data.scores.tokenEfficiencyRatio)}`}>
            {data.scores.tokenEfficiencyRatio}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">${data.tokenEfficiency.totalCostUsd.toFixed(4)} total cost</p>
        </div>
      </div>

      {/* Competitive Leaderboard */}
      <div className="glass-strong p-4 rounded-xl">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={16} className="text-agi-cyan" />
          <span className="text-sm font-bold text-white">Competitive Ranking</span>
        </div>
        <div className="space-y-2">
          {data.competitiveRanking.map((r, i) => (
            <div
              key={r.framework}
              className={`flex items-center gap-3 p-3 rounded-lg ${
                i === 0 ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-white/5'
              }`}
            >
              {rankIcon(i)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-semibold ${i === 0 ? 'text-emerald-400' : 'text-white'}`}>
                    {r.framework}
                  </span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                    r.type === 'commercial' ? 'bg-purple-500/10 text-purple-400' : 'bg-blue-500/10 text-blue-400'
                  }`}>
                    {r.type}
                  </span>
                </div>
                <div className="flex gap-3 mt-1">
                  <span className="text-[10px] text-slate-400">Gov: {r.governanceScore}</span>
                  <span className="text-[10px] text-slate-400">Sec: {r.securityScore}</span>
                  <span className="text-[10px] text-slate-400">Eff: {r.efficiencyScore}</span>
                  <span className="text-[10px] text-slate-400">Cap: {r.capabilityScore}</span>
                </div>
              </div>
              <span className={`text-lg font-bold ${i === 0 ? 'text-emerald-400' : 'text-slate-300'}`}>
                {r.overallScore}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Red Team Breakdown */}
      <div className="glass p-4 rounded-xl">
        <div className="flex items-center gap-2 mb-3">
          <Shield size={14} className="text-red-400" />
          <span className="text-xs font-bold text-white">Red Team Category Breakdown</span>
        </div>
        <div className="space-y-2">
          {Object.entries(data.redTeam.categoryBreakdown).map(([cat, stats]) => {
            const pct = Math.round((stats.blocked / stats.total) * 100);
            return (
              <div key={cat}>
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-slate-300">{cat.replace(/_/g, ' ')}</span>
                  <span className={scoreColor(pct)}>{stats.blocked}/{stats.total}</span>
                </div>
                <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      pct >= 90 ? 'bg-emerald-500' : pct >= 70 ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
