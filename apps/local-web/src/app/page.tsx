import { getStorageDir, listStoredVoiceSessions } from "@ixi-o-agent/storage";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LocalVoiceForm } from "./LocalVoiceForm";
import { getIxiOAgentEnv } from "../lib/runtime-config";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (process.env.VERCEL === "1" || getIxiOAgentEnv("SHOWCASE_HOME") === "true") {
    redirect("/showcase");
  }

  const sessions = await listStoredVoiceSessions();
  const storageDir = getStorageDir();
  const latest = sessions[0];
  const demoCandidate = sessions.find((session) => session.utteranceCount > 0) ?? latest;
  const transcriptReadyCount = sessions.filter((session) => session.utteranceCount > 0).length;
  const processedCount = sessions.filter((session) => session.exaoneProcessed).length;
  const approvedCount = sessions.filter((session) => session.review.externalAllowed).length;
  const pendingReviewCount = sessions.filter(
    (session) => session.exaoneProcessed && !session.review.externalAllowed
  ).length;

  return (
    <main className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow">ixi-O Agent</p>
          <h1>일상의 Voice를 에이전트와 함께</h1>
          <p className="lede">
            통화·회의를 로컬 STT/EXAONE으로 처리하고, 검수된 payload만 MISO와 Kiya에 전달합니다.
          </p>
          <Link className="text-button" href="/showcase">
            제출 쇼케이스 열기
          </Link>
        </div>
        <div className="status-strip" aria-label="ingest status">
          <div>
            <span className="label">수집</span>
            <strong>{sessions.length}</strong>
          </div>
          <div>
            <span className="label">EXAONE 처리</span>
            <strong>{processedCount}</strong>
          </div>
          <div>
            <span className="label">MISO 승인</span>
            <strong>{approvedCount}</strong>
          </div>
        </div>
      </section>

      <section className="demo-rail" aria-label="demo flow">
        <div className="demo-copy">
          <p className="eyebrow">Demo Golden Path</p>
          <h2>채널톡 입력부터 MISO 제안 payload까지</h2>
        </div>
        <ol className="stage-list">
          <li className={transcriptReadyCount > 0 ? "stage done" : "stage active"}>
            <span>1</span>
            <div>
              <strong>Voice 수집</strong>
              <p>Channel Talk/n8n 입력을 로컬 세션으로 저장</p>
            </div>
          </li>
          <li className={processedCount > 0 ? "stage done" : "stage active"}>
            <span>2</span>
            <div>
              <strong>EXAONE 후처리</strong>
              <p>요약, 긴급도, 팀, 액션아이템 구조화</p>
            </div>
          </li>
          <li className={pendingReviewCount > 0 || approvedCount > 0 ? "stage done" : "stage"}>
            <span>3</span>
            <div>
              <strong>Human Review</strong>
              <p>외부 전달 전 사람이 승인 또는 보류</p>
            </div>
          </li>
          <li className={approvedCount > 0 ? "stage done" : "stage"}>
            <span>4</span>
            <div>
              <strong>MISO 제안</strong>
              <p>승인된 비식별 payload만 외부 API에 공개</p>
            </div>
          </li>
        </ol>
      </section>

      <section className="local-frontdoor">
        <div>
          <p className="eyebrow">Private Mode</p>
          <h2>로컬 회의 입력</h2>
        </div>
        <LocalVoiceForm />
      </section>

      <section className="workbench">
        <div className="toolbar">
          <div>
            <p className="eyebrow">Local Inbox</p>
            <h2>수집된 Voice 세션</h2>
          </div>
          <div className="toolbar-actions">
            {demoCandidate ? (
              <Link className="text-button" href={`/sessions/${demoCandidate.sessionId}`}>
                데모 세션 열기
              </Link>
            ) : null}
            <code>{storageDir}/sessions</code>
          </div>
        </div>

        {sessions.length === 0 ? (
          <div className="empty">
            아직 저장된 세션이 없습니다. n8n 샘플 또는 채널톡 백필을 실행하면
            여기에 표시됩니다.
          </div>
        ) : (
          <div className="session-list">
            {sessions.map((session) => (
              <article className="session-row" key={session.sessionId}>
                <div>
                  <div className="row-title">
                    <Link href={`/sessions/${session.sessionId}`}>
                      {formatDate(session.sourceStartedAt)}
                    </Link>
                    <span className={`pill ${getStatusTone(session.status)}`}>
                      {formatStatus(session.status)}
                    </span>
                  </div>
                  <p>{session.transcriptPreview || "전사문 내용 없음"}</p>
                  <dl className="row-metrics">
                    <div>
                      <dt>발화</dt>
                      <dd>{session.utteranceCount}</dd>
                    </div>
                    <div>
                      <dt>EXAONE</dt>
                      <dd>{session.exaoneProcessed ? "done" : "waiting"}</dd>
                    </div>
                    <div>
                      <dt>MISO</dt>
                      <dd>{session.review.externalAllowed ? "approved" : "blocked"}</dd>
                    </div>
                    <div>
                      <dt>방향</dt>
                      <dd>{session.callDirection ?? "unknown"}</dd>
                    </div>
                    <div>
                      <dt>UserChat</dt>
                      <dd>{session.userChatId ?? "unknown"}</dd>
                    </div>
                  </dl>
                </div>
                <code className="session-id">{session.sessionId}</code>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function formatDate(value: string) {
  if (!value) return "시간 정보 없음";
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Seoul"
  }).format(new Date(value));
}

function formatStatus(status: string) {
  const labels: Record<string, string> = {
    pending_processing: "처리 대기",
    processed_pending_review: "검수 대기",
    approved_for_external_workflow: "전달 승인",
    skipped_no_transcript: "전사 없음",
    fallback_pending: "보강 필요"
  };
  return labels[status] ?? status;
}

function getStatusTone(status: string) {
  if (status === "approved_for_external_workflow") return "success";
  if (status === "processed_pending_review") return "warning";
  if (status === "skipped_no_transcript" || status === "fallback_pending") return "muted";
  return "neutral";
}
