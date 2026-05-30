import Link from "next/link";
import { notFound } from "next/navigation";
import { readStoredVoiceSessionDetail } from "@phone-claw/storage";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    sessionId: string;
  }>;
};

export default async function SessionDetailPage({ params }: PageProps) {
  const { sessionId } = await params;
  const session = await readStoredVoiceSessionDetail(sessionId);
  if (!session) notFound();

  const approved = session.review.reviewed && session.review.externalAllowed;
  const hasProcessedOutput = Boolean(session.exaone);

  return (
    <main className="shell">
      <section className="detail-header">
        <div>
          <Link className="nav-link" href="/">
            Back to inbox
          </Link>
          <p className="eyebrow">Voice Session</p>
          <h1>{formatDate(session.sourceStartedAt)}</h1>
          <p className="lede">
            원문 전사문은 로컬 검수 화면에서만 확인하고, MISO 쪽에는 EXAONE
            후처리 결과를 비식별화한 payload만 전달하도록 분리합니다.
          </p>
        </div>
        <div className="status-strip compact" aria-label="session status">
          <div>
            <span className="label">상태</span>
            <strong>{session.status}</strong>
          </div>
          <div>
            <span className="label">EXAONE</span>
            <strong>{hasProcessedOutput ? session.exaone?.engine : "대기"}</strong>
          </div>
          <div>
            <span className="label">MISO</span>
            <strong>{approved ? "승인됨" : "보류"}</strong>
          </div>
        </div>
      </section>

      <section className="detail-grid">
        <article className="panel primary-panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Local Transcript</p>
              <h2>채널톡 전사문</h2>
            </div>
            <code>{session.utteranceCount} utterances</code>
          </div>
          <div className="transcript-box">
            {session.transcript.utterances.length === 0 ? (
              <p>전사문이 아직 없습니다.</p>
            ) : (
              session.transcript.utterances.map((utterance, index) => (
                <div className="utterance" key={`${utterance.speaker}-${index}`}>
                  <span>{utterance.speaker}</span>
                  <p>{utterance.text}</p>
                </div>
              ))
            )}
          </div>
        </article>

        <aside className="panel">
          <p className="eyebrow">Actions</p>
          <h2>처리와 검수</h2>
          <div className="action-stack">
            <form action={`/api/sessions/${session.sessionId}/process`} method="post">
              <button className="button primary" type="submit">
                EXAONE 로컬 후처리 실행
              </button>
            </form>
            <form action={`/api/sessions/${session.sessionId}/review`} method="post">
              <input name="externalAllowed" type="hidden" value="true" />
              <button className="button" type="submit" disabled={!hasProcessedOutput}>
                MISO 전달 승인
              </button>
            </form>
            <form action={`/api/sessions/${session.sessionId}/review`} method="post">
              <input name="externalAllowed" type="hidden" value="false" />
              <button className="button secondary" type="submit">
                외부 전달 보류
              </button>
            </form>
          </div>
          {!hasProcessedOutput ? (
            <p className="hint">먼저 EXAONE 후처리를 실행해야 전달 승인 버튼이 열립니다.</p>
          ) : null}
        </aside>

        <article className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">EXAONE Output</p>
              <h2>에이전트 입력 초안</h2>
            </div>
            <code>{session.exaone?.urgency ?? "unknown"}</code>
          </div>
          {session.exaone ? (
            <div className="structured-output">
              <h3>요약</h3>
              <p>{session.exaone.summary}</p>
              <h3>액션아이템</h3>
              {session.exaone.actionItems.length === 0 ? (
                <p className="muted">추출된 액션아이템이 없습니다.</p>
              ) : (
                <ul>
                  {session.exaone.actionItems.map((item, index) => (
                    <li key={`${item.text}-${index}`}>{item.text}</li>
                  ))}
                </ul>
              )}
              <h3>검수 사유</h3>
              <p>{session.exaone.reviewReason}</p>
            </div>
          ) : (
            <p className="muted">
              아직 로컬 EXAONE 후처리를 실행하지 않았습니다. 모델을 찾지 못해도
              fallback-local 결과로 전체 플로우를 확인할 수 있습니다.
            </p>
          )}
        </article>

        <article className="panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">MISO Handoff</p>
              <h2>비식별 전달 payload</h2>
            </div>
            <code>{session.handoff?.reviewStatus ?? "pending_human_review"}</code>
          </div>
          <pre>{formatJson(session.handoff)}</pre>
        </article>

        <article className="panel wide-panel">
          <p className="eyebrow">Source Metadata</p>
          <h2>채널톡 원본 참조</h2>
          <dl className="metadata-grid">
            <div>
              <dt>Session ID</dt>
              <dd>
                <code>{session.sessionId}</code>
              </dd>
            </div>
            <div>
              <dt>UserChat</dt>
              <dd>{session.metadata.userChatId ?? "unknown"}</dd>
            </div>
            <div>
              <dt>CallLog</dt>
              <dd>{session.metadata.callLogId ?? "unknown"}</dd>
            </div>
            <div>
              <dt>방향</dt>
              <dd>{session.metadata.callDirection ?? "unknown"}</dd>
            </div>
            <div>
              <dt>로컬 저장 위치</dt>
              <dd>
                <code>{session.files.sessionPath}</code>
              </dd>
            </div>
            <div>
              <dt>검수</dt>
              <dd>
                {session.review.reviewed
                  ? `reviewed / externalAllowed=${session.review.externalAllowed}`
                  : "not reviewed"}
              </dd>
            </div>
          </dl>
        </article>
      </section>
    </main>
  );
}

function formatDate(value: string) {
  if (!value) return "시간 정보 없음";
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Seoul"
  }).format(new Date(value));
}

function formatJson(value: unknown) {
  return value ? JSON.stringify(value, null, 2) : "아직 생성된 payload가 없습니다.";
}
