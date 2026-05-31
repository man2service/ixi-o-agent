import { NextResponse } from "next/server";
import { readStoredVoiceSessionDetail } from "@ixi-o-agent/storage";
import { isAuthorizedByIngestSecret } from "../../../../../lib/runtime-config";
import {
  recordKiyaCalendarResult,
  type KiyaCalendarResultInput,
  type KiyaCalendarResultStatus
} from "../../../../../lib/kiya";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_STATUSES = new Set<KiyaCalendarResultStatus>([
  "proposed",
  "confirmed",
  "edited",
  "created",
  "cancelled",
  "failed"
]);

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> }
) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { sessionId } = await context.params;
  const session = await readStoredVoiceSessionDetail(sessionId);
  if (!session) {
    return NextResponse.json({ ok: false, error: "session_not_found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const status = getString(body.status);
  if (!isKiyaCalendarResultStatus(status)) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_calendar_result_status",
        validStatuses: [...VALID_STATUSES]
      },
      { status: 400 }
    );
  }

  const input: KiyaCalendarResultInput = {
    status,
    title: getString(body.title),
    startsAt: getString(body.startsAt),
    endsAt: getString(body.endsAt),
    note: getString(body.note),
    hermesRunId: getString(body.hermesRunId)
  };
  const result = await recordKiyaCalendarResult(session, input);
  return NextResponse.json({ ok: true, result });
}

function isAuthorized(request: Request): boolean {
  return isAuthorizedByIngestSecret(request);
}

function isKiyaCalendarResultStatus(value: string | undefined): value is KiyaCalendarResultStatus {
  return value ? VALID_STATUSES.has(value as KiyaCalendarResultStatus) : false;
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
