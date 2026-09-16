import { BenchmarkResults } from '@/components/benchmark/BenchmarkResults';

export default function LeaderboardPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0f] p-4 md:p-8 max-w-2xl mx-auto">
      <BenchmarkResults />
    </main>
  );
}
