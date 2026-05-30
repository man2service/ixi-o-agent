import { z } from "zod";

export const channelTalkStatusSchema = z
  .enum(["ready", "pending_processing", "skipped_no_transcript", "fallback_pending"])
  .default("ready");

export const participantSchema = z.object({
  id: z.string().min(1),
  role: z.enum(["counterparty", "user", "manager", "bot", "unknown"]),
  displayName: z.string().optional()
});

export const transcriptUtteranceSchema = z.object({
  speaker: z.string().min(1),
  text: z.string(),
  timestampMs: z.number().int().nonnegative().optional()
});

export const channelTalkN8nPayloadSchema = z.object({
  source: z.enum(["channel_talk_n8n", "local_voice_upload"]),
  status: channelTalkStatusSchema.optional(),
  reason: z.string().optional(),
  mode: z.enum(["call", "meeting", "voice_note"]),
  channelId: z.string().min(1),
  userChatId: z.string().min(1),
  meetMessageId: z.string().optional(),
  callLogId: z.string().optional(),
  callDirection: z.enum(["inbound", "outbound", "unknown"]).default("unknown"),
  startedAt: z.string().datetime({ offset: true }),
  endedAt: z.string().datetime({ offset: true }).optional(),
  participants: z.array(participantSchema).min(1),
  transcript: z.array(transcriptUtteranceSchema),
  recordingUrl: z.string().url().nullable().optional(),
  rawEvent: z.unknown().optional()
});

export type ChannelTalkN8nPayload = z.infer<typeof channelTalkN8nPayloadSchema>;
export type ChannelTalkStatus = z.infer<typeof channelTalkStatusSchema>;
export type TranscriptUtterance = z.infer<typeof transcriptUtteranceSchema>;

export type IngestResult =
  | "created"
  | "duplicate"
  | "updated"
  | "skipped_no_transcript"
  | "fallback_pending";
