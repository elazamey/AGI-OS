export function ChatInput() {
  return (
    <div className="border-t border-[var(--border)] p-3 shrink-0">
      <div className="max-w-3xl mx-auto">
        <div className="bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-xl flex items-center gap-2 px-3 py-2">
          <input
            type="text"
            placeholder="اكتب أمرًا أو ملاحظة..."
            className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none"
          />
          <button className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs px-2">📎</button>
          <button className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs px-3 py-1 rounded-lg">إرسال</button>
        </div>
      </div>
    </div>
  );
}
