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
  const hasTranscript = session.utteranceCount > 0;

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
            <strong>{formatStatus(session.status)}</strong>
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

      <section className="session-flow" aria-label="session workflow">
        <ol className="stage-list compact-list">
          <li className={hasTranscript ? "stage done" : "stage active"}>
            <span>1</span>
            <div>
              <strong>수집 완료</strong>
              <p>채널 원본과 전사문은 로컬 폴더에만 저장</p>
            </div>
          </li>
          <li className={hasProcessedOutput ? "stage done" : "stage active"}>
            <span>2</span>
            <div>
              <strong>EXAONE 구조화</strong>
              <p>업무 에이전트가 읽을 수 있는 JSON 초안 생성</p>
            </div>
          </li>
          <li className={session.review.reviewed ? "stage done" : "stage"}>
            <span>3</span>
            <div>
              <strong>사람 검수</strong>
              <p>전달 전 승인 또는 보류를 명시</p>
            </div>
          </li>
          <li className={approved ? "stage done" : "stage"}>
            <span>4</span>
            <div>
              <strong>MISO 공개</strong>
              <p>승인 후에만 외부 API가 payload를 반환</p>
            </div>
          </li>
        </ol>
      </section>

      <section className="detail-grid">
        <article className="panel primary-panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Local Transcript</p>
              <h2>{session.source === "local_voice_upload" ? "로컬 전사문" : "채널톡 전사문"}</h2>
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
          <div className="review-state">
            <div>
              <span className="label">현재 단계</span>
              <strong>{approved ? "MISO 전달 가능" : nextActionLabel(hasTranscript, hasProcessedOutput)}</strong>
            </div>
            <p>
              원문은 로컬 UI와 파일에만 남기고, 외부 워크플로우에는 요약된 비식별
              payload만 열립니다.
            </p>
          </div>
          <div className="action-stack">
            <form action={`/api/sessions/${session.sessionId}/process`} method="post">
              <button className="button primary" type="submit" disabled={!hasTranscript}>
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
          {!hasTranscript ? (
            <p className="hint">이 세션은 전사문이 없어 백필 또는 다른 입력 보강이 먼저 필요합니다.</p>
          ) : null}
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
              <h3>담당 후보</h3>
              {session.exaone.requiredTeams.length === 0 ? (
                <p className="muted">추정된 담당 팀이 없습니다.</p>
              ) : (
                <ul>
                  {session.exaone.requiredTeams.map((team) => (
                    <li key={team}>{team}</li>
                  ))}
                </ul>
              )}
              <h3>확인 질문</h3>
              {session.exaone.openQuestions.length === 0 ? (
                <p className="muted">추가 확인 질문이 없습니다.</p>
              ) : (
                <ul>
                  {session.exaone.openQuestions.map((question) => (
                    <li key={question}>{question}</li>
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
          <p className={approved ? "handoff-status success-text" : "handoff-status warning-text"}>
            {approved
              ? "외부 MISO-facing API에서 이 redacted payload를 조회할 수 있습니다."
              : "아직 외부 API는 payload를 숨깁니다. 아래 내용은 로컬 운영자용 미리보기입니다."}
          </p>
          <pre>{formatJson(session.handoff)}</pre>
        </article>

        <article className="panel wide-panel">
          <p className="eyebrow">Source Metadata</p>
          <h2>{session.source === "local_voice_upload" ? "로컬 원본 참조" : "채널톡 원본 참조"}</h2>
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

function nextActionLabel(hasTranscript: boolean, hasProcessedOutput: boolean) {
  if (!hasTranscript) return "전사문 보강 필요";
  if (!hasProcessedOutput) return "EXAONE 처리 필요";
  return "사람 검수 필요";
}

function formatJson(value: unknown) {
  return value ? JSON.stringify(value, null, 2) : "아직 생성된 payload가 없습니다.";
}
