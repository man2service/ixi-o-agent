import type { ChannelTalkN8nPayload, TranscriptUtterance } from "./schemas/channel-talk";

export function normalizeTranscript(
  utterances: TranscriptUtterance[]
): TranscriptUtterance[] {
  return [...utterances].sort((left, right) => {
    if (left.timestampMs == null && right.timestampMs == null) return 0;
    if (left.timestampMs == null) return 1;
    if (right.timestampMs == null) return -1;
    return left.timestampMs - right.timestampMs;
  });
}

export function transcriptToMarkdown(payload: ChannelTalkN8nPayload): string {
  const lines = [
    `# Channel Talk Transcript`,
    ``,
    `- Channel ID: ${payload.channelId}`,
    `- User Chat ID: ${payload.userChatId}`,
    `- Meet Message ID: ${payload.meetMessageId ?? "unknown"}`,
    `- Started At: ${payload.startedAt}`,
    `- Ended At: ${payload.endedAt ?? "unknown"}`,
    ``
  ];

  const utterances = normalizeTranscript(payload.transcript);
  if (utterances.length === 0) {
    lines.push(`_No transcript is available yet._`);
    return `${lines.join("\n")}\n`;
  }

  for (const utterance of utterances) {
    const timestamp =
      utterance.timestampMs == null ? "" : ` [${formatTimestamp(utterance.timestampMs)}]`;
    lines.push(`- **${utterance.speaker}**${timestamp}: ${utterance.text}`);
  }

  return `${lines.join("\n")}\n`;
}

function formatTimestamp(timestampMs: number): string {
  const totalSeconds = Math.floor(timestampMs / 1000);
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

