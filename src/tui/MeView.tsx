import { useState, useEffect } from "react";
import type { MatterAPI, Account, ReadingSession } from "../api.js";
import { theme } from "./theme.js";

interface MeViewProps {
  api: MatterAPI;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function aggregateByDay(sessions: ReadingSession[]): Map<string, number> {
  const days = new Map<string, number>();
  for (const s of sessions) {
    const day = new Date(s.date).toLocaleDateString("en-CA");
    days.set(day, (days.get(day) ?? 0) + s.seconds_read);
  }
  return days;
}

function computeStreak(dailyTotals: Map<string, number>, goalSeconds: number): number {
  let streak = 0;
  const d = new Date();
  d.setDate(d.getDate() - 1);

  while (true) {
    const key = d.toLocaleDateString("en-CA");
    if ((dailyTotals.get(key) ?? 0) >= goalSeconds) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }

  const todayKey = new Date().toLocaleDateString("en-CA");
  if ((dailyTotals.get(todayKey) ?? 0) >= goalSeconds) {
    streak++;
  }

  return streak;
}

const BAR_CHARS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];

function barChar(value: number, max: number): string {
  if (max === 0 || value === 0) return " ";
  const idx = Math.min(BAR_CHARS.length - 1, Math.round((value / max) * (BAR_CHARS.length - 1)));
  return BAR_CHARS[idx];
}

function memberSince(createdAt: string): string {
  const d = new Date(createdAt);
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export function MeView({ api }: MeViewProps) {
  const [account, setAccount] = useState<Account | null>(null);
  const [sessions, setSessions] = useState<ReadingSession[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const since = new Date();
        since.setDate(since.getDate() - 30);

        const [acct, allSessions] = await Promise.all([
          api.getAccount(),
          api.listAll((cursor) =>
            api.listReadingSessions({ since: since.toISOString(), limit: 100, cursor }),
          ),
        ]);

        setAccount(acct);
        setSessions(allSessions);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [api]);

  if (loading) return <text fg={theme.fg.muted}>Loading...</text>;
  if (error) return <text fg={theme.error}>Error: {error}</text>;
  if (!account) return <text fg={theme.fg.muted}>No data.</text>;

  // Profile
  const name = account.name || account.email;

  // Reading stats
  const dailyTotals = sessions ? aggregateByDay(sessions) : new Map<string, number>();
  const todayKey = new Date().toLocaleDateString("en-CA");
  const todaySeconds = dailyTotals.get(todayKey) ?? 0;
  const totalSeconds = sessions?.reduce((sum, s) => sum + s.seconds_read, 0) ?? 0;
  const goalSeconds = 300;
  const streak = computeStreak(dailyTotals, goalSeconds);

  // 7-day chart
  const last7: { label: string; seconds: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toLocaleDateString("en-CA");
    last7.push({
      label: d.toLocaleDateString(undefined, { weekday: "short" }),
      seconds: dailyTotals.get(key) ?? 0,
    });
  }
  const max7 = Math.max(...last7.map((d) => d.seconds), 1);
  const chartBars = last7.map((d) => barChar(d.seconds, max7).padEnd(2)).join(" ");
  const chartLabels = last7.map((d) => d.label.slice(0, 2)).join(" ");

  return (
    <box flexDirection="column" padding={1} flexGrow={1}>
      {/* Profile */}
      <text fg={theme.fg.primary}><b>{name}</b></text>
      <text fg={theme.fg.dim}>{account.email}{account.name ? "" : ""}</text>
      <text fg={theme.fg.faint}>Member since {memberSince(account.created_at)}</text>

      <box height={1} />

      {/* Stats summary */}
      <box flexDirection="row" gap={4}>
        <box flexDirection="column">
          <text fg={theme.fg.dim}>Today</text>
          <text fg={todaySeconds > 0 ? theme.fg.primary : theme.fg.muted}>
            <b>{todaySeconds > 0 ? formatDuration(todaySeconds) : "—"}</b>
          </text>
        </box>
        <box flexDirection="column">
          <text fg={theme.fg.dim}>Streak</text>
          <text fg={streak > 0 ? theme.success : theme.fg.muted}>
            <b>{streak > 0 ? `${streak} day${streak !== 1 ? "s" : ""}` : "—"}</b>
          </text>
        </box>
        <box flexDirection="column">
          <text fg={theme.fg.dim}>Last 30 days</text>
          <text fg={totalSeconds > 0 ? theme.fg.primary : theme.fg.muted}>
            <b>{totalSeconds > 0 ? formatDuration(totalSeconds) : "—"}</b>
          </text>
        </box>
      </box>

      <box height={1} />

      {/* 7-day chart */}
      <text fg={theme.fg.dim}>Past 7 days</text>
      <text fg={theme.accent}> {chartBars}</text>
      <text fg={theme.fg.faint}> {chartLabels}</text>
    </box>
  );
}
