import { theme } from "./theme.js";

interface ResultsViewProps {
  title: string;
  data: unknown;
}

export function ResultsView({ title, data }: ResultsViewProps) {
  const formatted = JSON.stringify(data, null, 2);
  const lines = formatted.split("\n");

  return (
    <box flexDirection="column" padding={1}>
      <text fg={theme.accent}>
        <b>{title}</b>
      </text>
      <box height={1} />
      {lines.map((line, i) => (
        <text key={i} fg={theme.fg.secondary}>
          {line}
        </text>
      ))}
    </box>
  );
}
