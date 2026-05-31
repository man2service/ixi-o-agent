"use client";

import { useMemo, useState } from "react";

type ModeId = "enterprise" | "personal";

type FlowStep = {
  number: string;
  title: string;
  caption: string;
  detail: string;
  artifact: string;
  transcriptPolicy: string;
  agentPayload: string;
  status: string;
};

type FlowMode = {
  id: ModeId;
  label: string;
  title: string;
  summary: string;
  source: string;
  privacy: string;
  handoff: string;
  steps: FlowStep[];
};

const flows: Record<ModeId, FlowMode> = {
  enterprise: {
    id: "enterprise",
    label: "기업용",
    title: "채널톡에서 들어온 고객 음성을 로컬에서 정리",
    summary:
      "Channel Talk 전화/녹음 데이터는 Mac mini M4 로컬 서버에서 처리하고, 개인정보를 마스킹한 뒤 결정 사항만 에이전트 폴더로 넘깁니다.",
    source: "Channel Talk + n8n webhook",
    privacy: "raw audio/transcript local only",
    handoff: "masked decisions only",
    steps: [
      {
        number: "01",
        title: "채널톡 입력 수집",
        caption: "전화, 녹음, 과거 대화 백필",
        detail:
          "채널톡에 남은 통화/상담 데이터를 n8n webhook으로 받고, 누락 대비 polling/manual backfill을 같은 저장 계약으로 맞춥니다.",
        artifact: "source/channel-talk.payload.json",
        transcriptPolicy: "원문은 로컬 저장소에만 유지",
        agentPayload: "source id, call time, customer thread id",
        status: "수집 완료"
      },
      {
        number: "02",
        title: "Mac mini 로컬 AI 처리",
        caption: "Whisper STT + EXAONE 요약",
        detail:
          "오디오가 있으면 Whisper small로 전사하고, EXAONE 로컬 모델로 요약, 긴급도, 담당팀, 결정 사항을 구조화합니다.",
        artifact: "agent/exaone.local-output.json",
        transcriptPolicy: "전사문과 요약 모두 로컬 생성",
        agentPayload: "summary, urgency, owner team, action candidates",
        status: "로컬 처리"
      },
      {
        number: "03",
        title: "개인정보 마스킹",
        caption: "외부 전달 전 검수 경계",
        detail:
          "전화번호, 이름, 주소, 계정 정보처럼 에이전트가 몰라도 되는 값은 제거하고, 업무 결정에 필요한 문장만 남깁니다.",
        artifact: "review/redacted-handoff.json",
        transcriptPolicy: "raw transcript blocked",
        agentPayload: "masked summary and decision points",
        status: "마스킹 완료"
      },
      {
        number: "04",
        title: "에이전트 폴더 전달",
        caption: "결정 사항 중심 context",
        detail:
          "승인된 payload만 Kiya/Hermes와 MISO 제안용 폴더에 저장합니다. 에이전트는 다음 액션을 제안하고 맥락을 이해합니다.",
        artifact: "agent/inbox/enterprise.latest.json",
        transcriptPolicy: "비식별 payload만 외부 workflow 가능",
        agentPayload: "calendar candidate, follow-up task, MISO tool input",
        status: "전달 가능"
      }
    ]
  },
  personal: {
    id: "personal",
    label: "개인용",
    title: "내 회의와 통화를 전체 맥락 그대로 에이전트에게 전달",
    summary:
      "개인 모드는 별도 마스킹 없이 전사문과 요약을 함께 저장합니다. 사용자의 개인 서버에서 처리하고, Kiya가 전체 맥락을 읽고 다음 행동을 제안합니다.",
    source: "local recorder / voice file",
    privacy: "private full-context mode",
    handoff: "full transcript + summary",
    steps: [
      {
        number: "01",
        title: "개인 음성 입력",
        caption: "회의 녹음, 음성 메모, 파일",
        detail:
          "브라우저 녹음 또는 파일 업로드로 개인 음성을 넣습니다. 데모에서는 통화 연결 없이 회의 녹음으로 같은 플로우를 보여줍니다.",
        artifact: "source/local-voice-upload.json",
        transcriptPolicy: "사용자 로컬 저장소에 원본 보관",
        agentPayload: "source label, meeting title, captured audio path",
        status: "입력 완료"
      },
      {
        number: "02",
        title: "Whisper 전사",
        caption: "로컬 STT 우선",
        detail:
          "Mac mini M4에서 Whisper small을 우선 사용해 전사합니다. 긴 오디오는 chunk 단위로 처리해 업로드 불안정성을 줄입니다.",
        artifact: "transcript/local-whisper.json",
        transcriptPolicy: "전사문 전체 보존",
        agentPayload: "speaker turns, timestamps, full transcript",
        status: "전사 완료"
      },
      {
        number: "03",
        title: "EXAONE 전체 요약",
        caption: "요약, 할 일, 일정 후보",
        detail:
          "EXAONE은 전사문 전체를 읽고 요약, 할 일, 질문, 일정 후보를 만듭니다. 개인용은 에이전트가 맥락 손실 없이 읽도록 전체 내용을 같이 넘깁니다.",
        artifact: "agent/personal-exaone-output.json",
        transcriptPolicy: "마스킹 없음",
        agentPayload: "full transcript, full summary, action candidates",
        status: "요약 완료"
      },
      {
        number: "04",
        title: "Kiya 자동 전달",
        caption: "요약 먼저, 액션은 확인 후",
        detail:
          "Kiya Telegram에는 요약이 자동 전송됩니다. 일정 등록처럼 실행이 필요한 액션은 별도 확인 메시지로 제안합니다.",
        artifact: "agent/inbox/personal.latest.json",
        transcriptPolicy: "사용자 개인 에이전트에 전체 전달",
        agentPayload: "summary message, calendar proposal, next actions",
        status: "전달 가능"
      }
    ]
  }
};

export function ShowcaseDemo() {
  const [activeMode, setActiveMode] = useState<ModeId>("enterprise");
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const flow = flows[activeMode];
  const activeStep = flow.steps[activeStepIndex] ?? flow.steps[0];
  const progress = useMemo(
    () => Math.round(((activeStepIndex + 1) / flow.steps.length) * 100),
    [activeStepIndex, flow.steps.length]
  );

  function switchMode(mode: ModeId) {
    setActiveMode(mode);
    setActiveStepIndex(0);
  }

  function nextStep() {
    setActiveStepIndex((current) => Math.min(current + 1, flow.steps.length - 1));
  }

  function previousStep() {
    setActiveStepIndex((current) => Math.max(current - 1, 0));
  }

  return (
    <section className="showcase-demo" id="experience" aria-label="ixi-O Agent experience flow">
      <div className="showcase-section-head">
        <div>
          <h2>체험 플로우</h2>
          <p>기업용과 개인용을 나눠 큰 단계만 따라가며 완료 상태를 확인합니다.</p>
        </div>
        <div className="showcase-mode-switch" role="tablist" aria-label="mode switch">
          {Object.values(flows).map((mode) => (
            <button
              key={mode.id}
              type="button"
              role="tab"
              aria-selected={mode.id === activeMode}
              className={
                mode.id === activeMode
                  ? "showcase-mode-button selected"
                  : "showcase-mode-button"
              }
              onClick={() => switchMode(mode.id)}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      <div className="showcase-experience-card">
        <div className="showcase-experience-summary">
          <div>
            <span className="showcase-label">{flow.source}</span>
            <h3>{flow.title}</h3>
            <p>{flow.summary}</p>
          </div>
          <div className="showcase-progress-box" aria-label="flow progress">
            <span>{progress}%</span>
            <div className="showcase-progress-track">
              <div style={{ width: `${progress}%` }} />
            </div>
            <strong>{activeStep.status}</strong>
          </div>
        </div>

        <div className="showcase-flow-grid">
          <div>
            <div className="showcase-stage-list" role="tablist" aria-label={`${flow.label} stages`}>
              {flow.steps.map((stage, index) => {
                const state =
                  index < activeStepIndex
                    ? "completed"
                    : index === activeStepIndex
                      ? "selected"
                      : "upcoming";
                return (
                  <button
                    key={`${flow.id}-${stage.number}`}
                    type="button"
                    role="tab"
                    aria-selected={index === activeStepIndex}
                    className={`showcase-stage ${state}`}
                    onClick={() => setActiveStepIndex(index)}
                  >
                    <span>{stage.number}</span>
                    <strong>{stage.title}</strong>
                    <em>{stage.caption}</em>
                  </button>
                );
              })}
            </div>

            <div className="showcase-step-controls">
              <button
                type="button"
                className="showcase-control"
                onClick={previousStep}
                disabled={activeStepIndex === 0}
              >
                이전 단계
              </button>
              <button
                type="button"
                className="showcase-control primary"
                onClick={activeStepIndex === flow.steps.length - 1 ? () => setActiveStepIndex(0) : nextStep}
              >
                {activeStepIndex === flow.steps.length - 1 ? "처음부터" : "단계 완료"}
              </button>
            </div>
          </div>

          <article className="showcase-live-panel">
            <div className="showcase-panel-top">
              <div>
                <span className="showcase-label">{flow.label} current step</span>
                <h3>{activeStep.title}</h3>
              </div>
              <code>{activeStep.artifact}</code>
            </div>
            <p className="showcase-panel-detail">{activeStep.detail}</p>
            <div className="showcase-result-grid">
              <div>
                <span>privacy boundary</span>
                <strong>{flow.privacy}</strong>
              </div>
              <div>
                <span>transcript policy</span>
                <strong>{activeStep.transcriptPolicy}</strong>
              </div>
              <div>
                <span>agent handoff</span>
                <strong>{flow.handoff}</strong>
              </div>
            </div>
            <div className="showcase-agent-preview">
              <span className="showcase-label">Agent-readable payload</span>
              <p>{activeStep.agentPayload}</p>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
