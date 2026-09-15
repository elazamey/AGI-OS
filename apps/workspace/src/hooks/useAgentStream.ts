import { useCallback, useEffect, useState } from "react";

export interface AgentEvent {
  type:
    | "run_started"
    | "phase"
    | "thought"
    | "tool_call"
    | "tool_result"
    | "terminal_log"
    | "preview_update"
    | "verification"
    | "code_update"
    | "run_completed"
    | "run_cancelled";

  run_id?: string;
  event_id?: number;
  timestamp?: number;

  content?: string;
  name?: string;

  tool?: string;
  status?: string;
  exit_code?: number;

  log?: string;

  format?: string;
  html?: string;

  source?: string;
  bytes?: number;
  reason?: string;
}

interface UseAgentStreamResult {
  events: AgentEvent[];
  previewHtml: string;
  terminalLogs: string[];
  connected: boolean;
  error: string | null;
  sendCode: (code: string) => Promise<void>;
}

export function useAgentStream(
  apiBaseUrl: string,
  runId: string | null,
): UseAgentStreamResult {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [previewHtml, setPreviewHtml] = useState("");
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!runId) {
      return;
    }

    const url =
      `${apiBaseUrl}/api/agent/runs/${runId}/stream`;

    const source = new EventSource(url);

    source.onopen = () => {
      setConnected(true);
      setError(null);
    };

    source.onmessage = handleMessage;

    source.onerror = () => {
      setConnected(false);
      setError("انقطع اتصال SSE");
    };

    function handleMessage(event: MessageEvent) {
      try {
        const parsed = JSON.parse(
          event.data,
        ) as AgentEvent;

        setEvents((prev) => [
          ...prev,
          parsed,
        ]);

        if (
          parsed.type === "preview_update" &&
          parsed.html
        ) {
          setPreviewHtml(parsed.html);
        }

        if (
          parsed.type === "terminal_log" &&
          parsed.log
        ) {
          setTerminalLogs((prev) => [
            ...prev,
            parsed.log!,
          ]);
        }
      } catch (err) {
        console.error(
          "SSE parse error:",
          err,
        );
      }
    }

    return () => {
      source.close();
      setConnected(false);
    };
  }, [apiBaseUrl, runId]);

  const sendCode = useCallback(
    async (code: string) => {
      if (!runId) {
        throw new Error(
          "No active agent run",
        );
      }

      const response = await fetch(
        `${apiBaseUrl}/api/agent/runs/${runId}/update`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            code,
          }),
        },
      );

      if (!response.ok) {
        const body =
          await response.text();

        throw new Error(
          `Code update failed: ${body}`,
        );
      }
    },
    [apiBaseUrl, runId],
  );

  return {
    events,
    previewHtml,
    terminalLogs,
    connected,
    error,
    sendCode,
  };
}
