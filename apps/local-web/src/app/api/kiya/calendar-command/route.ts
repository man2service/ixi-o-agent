import { NextResponse } from "next/server";
import { readStoredVoiceSessionDetail } from "@phone-claw/storage";
import { recordKiyaCalendarResult, type KiyaCalendarResultStatus } from "../../../../lib/kiya";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CalendarCommandAction = "confirm" | "edit" | "cancel";

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const parsed = parseCommand(body);
  if (!parsed) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_calendar_command",
        expected:
          "Provide sessionId plus action=confirm|edit|cancel, or command=pc:cal:ok:{sessionId}"
      },
      { status: 400 }
    );
  }

  const session = await readStoredVoiceSessionDetail(parsed.sessionId);
  if (!session) {
    return NextResponse.json({ ok: false, error: "session_not_found" }, { status: 404 });
  }

  const result = await recordKiyaCalendarResult(session, {
    status: toResultStatus(parsed.action),
    title: getString(body.title) ?? buildDefaultTitle(session),
    startsAt: getString(body.startsAt),
    endsAt: getString(body.endsAt),
    note: buildNote(parsed.action, body),
    hermesRunId: getString(body.hermesRunId)
  });

  return NextResponse.json({
    ok: true,
    toy: true,
    action: parsed.action,
    result,
    message: buildResponseMessage(parsed.action),
    realCalendarCreated: false,
    nextIntegration:
      "Kiya/Hermes can map this same command to a real calendar.create_event tool, then call /api/sessions/{sessionId}/kiya-calendar-result with the final status."
  });
}

function parseCommand(body: Record<string, unknown>):
  | {
      sessionId: string;
      action: CalendarCommandAction;
    }
  | undefined {
  const directSessionId = getString(body.sessionId);
  const directAction = normalizeAction(getString(body.action));
  if (directSessionId && directAction) {
    return { sessionId: directSessionId, action: directAction };
  }

  const command = getString(body.command);
  if (!command) return undefined;

  const match = command.match(/^pc:cal:(ok|edit|cancel):([a-zA-Z0-9_.-]+)$/);
  if (!match) return undefined;

  const action = match[1] === "ok" ? "confirm" : normalizeAction(match[1]);
  if (!action) return undefined;

  return {
    action,
    sessionId: match[2]
  };
}

function normalizeAction(value: string | undefined): CalendarCommandAction | undefined {
  if (value === "confirm" || value === "ok" || value === "create") return "confirm";
  if (value === "edit" || value === "change") return "edit";
  if (value === "cancel" || value === "skip") return "cancel";
  return undefined;
}

function toResultStatus(action: CalendarCommandAction): KiyaCalendarResultStatus {
  if (action === "confirm") return "created";
  if (action === "edit") return "edited";
  return "cancelled";
}

function buildDefaultTitle(session: Awaited<ReturnType<typeof readStoredVoiceSessionDetail>>): string {
  const summary = session?.exaone?.summary ?? session?.transcript.rawText ?? "";
  const short = summary.replace(/\s+/g, " ").slice(0, 48).trim();
  return short ? `Phone-Claw: ${short}` : "Phone-Claw 후속 일정";
}

function buildNote(action: CalendarCommandAction, body: Record<string, unknown>): string {
  const text = getString(body.text);
  const note = getString(body.note);
  const base =
    action === "confirm"
      ? "Kiya calendar toy command confirmed."
      : action === "edit"
        ? "Kiya calendar toy command edited."
        : "Kiya calendar toy command cancelled.";

  return [base, note, text].filter(Boolean).join(" ");
}

function buildResponseMessage(action: CalendarCommandAction): string {
  if (action === "confirm") {
    return "캘린더 등록 확인을 기록했습니다. 현재 toy 모드라 실제 외부 캘린더 생성은 Kiya/Hermes 쪽 액션에 위임됩니다.";
  }
  if (action === "edit") {
    return "캘린더 수정 요청을 기록했습니다. Kiya/Hermes가 수정된 시간/제목으로 실제 캘린더 액션을 실행하면 됩니다.";
  }
  return "캘린더 등록 취소를 기록했습니다.";
}

function isAuthorized(request: Request): boolean {
  const expected = process.env.PHONE_CLAW_INGEST_SECRET;
  if (!expected) return true;
  const headerSecret = request.headers.get("x-phone-claw-ingest-secret");
  const bearerSecret = parseBearerToken(request.headers.get("authorization"));
  return headerSecret === expected || bearerSecret === expected;
}

function parseBearerToken(value: string | null): string | undefined {
  if (!value) return undefined;
  const [scheme, token] = value.split(/\s+/, 2);
  if (scheme?.toLowerCase() !== "bearer") return undefined;
  return token;
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
