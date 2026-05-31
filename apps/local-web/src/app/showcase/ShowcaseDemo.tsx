"use client";

import { useState } from "react";

type ModeId = "enterprise" | "personal";

type FlowStep = {
  number: string;
  title: string;
  eventLabel: string;
  detail: string;
  result: string;
  status: string;
};

type FlowMode = {
  id: ModeId;
  label: string;
  headline: string;
  summary: string;
  source: string;
  boundaryTitle: string;
  boundaryCopy: string;
  localOnly: string[];
  agentHandoff: string[];
  steps: FlowStep[];
};

const flows: Record<ModeId, FlowMode> = {
  enterprise: {
    id: "enterprise",
    label: "기업용",
    headline: "채널톡 전화가 로컬에서 정리됩니다",
    summary: "검수된 payload만 MISO와 Kiya로 갑니다.",
    source: "Channel Talk",
    boundaryTitle: "기업용: 마스킹 후 전달",
    boundaryCopy: "개인정보는 로컬에 두고, 결정만 보냅니다.",
    localOnly: ["원문", "전화번호", "이름/주소"],
    agentHandoff: ["요약", "결정", "다음 액션"],
    steps: [
      {
        number: "01",
        title: "수집",
        eventLabel: "Channel Talk",
        detail: "전화 이벤트가 n8n으로 들어옵니다.",
        result: "로컬 inbox 생성",
        status: "수집"
      },
      {
        number: "02",
        title: "로컬 처리",
        eventLabel: "Whisper + EXAONE",
        detail: "로컬 STT/EXAONE이 정리합니다.",
        result: "요약 초안 생성",
        status: "처리"
      },
      {
        number: "03",
        title: "마스킹",
        eventLabel: "Privacy gate",
        detail: "전화번호와 이름을 지웁니다.",
        result: "검수 대기",
        status: "검수"
      },
      {
        number: "04",
        title: "전달",
        eventLabel: "Kiya / MISO",
        detail: "필요한 결정만 에이전트가 읽습니다.",
        result: "액션 제안",
        status: "전달"
      }
    ]
  },
  personal: {
    id: "personal",
    label: "개인용",
    headline: "회의 녹음이 내 에이전트 기억이 됩니다",
    summary: "Voice를 안전한 업무 맥락으로 바꿉니다.",
    source: "Local recorder",
    boundaryTitle: "개인용: 전체 맥락 전달",
    boundaryCopy: "마스킹 없이 내 에이전트에게 보냅니다.",
    localOnly: ["음성 파일", "전사문", "개인 메모"],
    agentHandoff: ["전체 요약", "전체 전사", "일정 후보"],
    steps: [
      {
        number: "01",
        title: "녹음",
        eventLabel: "Voice",
        detail: "회의나 통화를 녹음합니다.",
        result: "음성 파일 저장",
        status: "녹음"
      },
      {
        number: "02",
        title: "전사",
        eventLabel: "Whisper",
        detail: "로컬 STT가 전사합니다.",
        result: "전사문 생성",
        status: "전사"
      },
      {
        number: "03",
        title: "요약",
        eventLabel: "EXAONE",
        detail: "에이전트가 바로 읽게 정리합니다.",
        result: "액션 후보 생성",
        status: "요약"
      },
      {
        number: "04",
        title: "확인",
        eventLabel: "Kiya",
        detail: "실행 전 한 번 더 묻습니다.",
        result: "확인 후 실행",
        status: "확인"
      }
    ]
  }
};

const proofPoints = [
  { title: "Voice AI", detail: "통화/회의 입력" },
  { title: "EXAONE", detail: "요약과 액션" },
  { title: "Local-first", detail: "원문 로컬 보관" }
];

export function ShowcaseDemo() {
  const [activeMode, setActiveMode] = useState<ModeId>("enterprise");
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const flow = flows[activeMode];
  const activeStep = flow.steps[activeStepIndex] ?? flow.steps[0];
  const progress = Math.round(((activeStepIndex + 1) / flow.steps.length) * 100);

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

  const modeSwitch = (className = "showcase-mode-switch") => (
    <div className={className} role="tablist" aria-label="mode switch">
      {Object.values(flows).map((mode) => (
        <button
          key={mode.id}
          type="button"
          role="tab"
          aria-selected={mode.id === activeMode}
          className={
            mode.id === activeMode ? "showcase-mode-button selected" : "showcase-mode-button"
          }
          onClick={() => switchMode(mode.id)}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );

  return (
    <>
      <section className="showcase-hero" id="experience" aria-label="ixi-O Agent demo">
        <div className="showcase-hero-copy">
          {modeSwitch("showcase-mode-switch showcase-mode-switch-hero")}
          <h1>
            일상의 Voice를
            <span>에이전트와 함께</span>
          </h1>
          <p>Voice를 에이전트가 바로 쓸 수 있는 안전한 업무 맥락으로 바꿉니다.</p>

          <div className="showcase-security-callout">
            <strong>{flow.boundaryTitle}</strong>
            <span>{flow.boundaryCopy}</span>
          </div>

          <div className="showcase-actions">
            <a className="showcase-primary showcase-tds-button fill" href="#guided-flow">
              시연 시작
            </a>
            <a
              className="showcase-secondary showcase-tds-button weak"
              href="https://github.com/man2service/ixi-o-agent"
            >
              GitHub
            </a>
          </div>

          <div className="showcase-proof-strip" aria-label="proof points">
            {proofPoints.map((point) => (
              <div key={point.title}>
                <span>{point.title}</span>
                <strong>{point.detail}</strong>
              </div>
            ))}
          </div>
        </div>

        <aside className="showcase-live-board" aria-label={`${flow.label} demo board`}>
          <div className="showcase-live-board-header">
            <div>
              <span className="showcase-label">{flow.source}</span>
              <h2>{flow.headline}</h2>
            </div>
            <strong>{activeStep.status}</strong>
          </div>

          <p>{flow.summary}</p>

          <div className="showcase-pipeline" aria-label="voice to agent pipeline">
            {flow.steps.map((stage, index) => {
              const state =
                index < activeStepIndex ? "completed" : index === activeStepIndex ? "selected" : "upcoming";
              return (
                <button
                  key={`hero-${flow.id}-${stage.number}`}
                  type="button"
                  className={`showcase-pipeline-step ${state}`}
                  onClick={() => setActiveStepIndex(index)}
                >
                  <span>{stage.number}</span>
                  <strong>{stage.eventLabel}</strong>
                  <em>{stage.title}</em>
                </button>
              );
            })}
          </div>

          <div className="showcase-boundary" aria-label="privacy boundary">
            <div>
              <span>Local</span>
              <ul>
                {flow.localOnly.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="showcase-boundary-arrow">review</div>
            <div>
              <span>Agent</span>
              <ul>
                {flow.agentHandoff.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="showcase-simulated-output">
            <span className="showcase-label">{activeStep.result}</span>
            <p>{activeStep.detail}</p>
          </div>
        </aside>
      </section>

      <section className="showcase-demo" id="guided-flow" aria-label="guided flow">
        <div className="showcase-section-head">
          <div>
            <h2>흐름 보기</h2>
          </div>
          {modeSwitch()}
        </div>

        <div className="showcase-experience-card">
          <div className="showcase-experience-summary">
            <div>
              <span className="showcase-label">{flow.source}</span>
              <h3>{flow.headline}</h3>
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
                      <em>{stage.eventLabel}</em>
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
                  이전
                </button>
                <button
                  type="button"
                  className="showcase-control primary"
                  onClick={activeStepIndex === flow.steps.length - 1 ? () => setActiveStepIndex(0) : nextStep}
                >
                  {activeStepIndex === flow.steps.length - 1 ? "처음" : "다음"}
                </button>
              </div>
            </div>

            <article className="showcase-live-panel">
              <div className="showcase-panel-top">
                <div>
                  <span className="showcase-label">{activeStep.eventLabel}</span>
                  <h3>{activeStep.title}</h3>
                </div>
              </div>
              <p className="showcase-panel-detail">{activeStep.detail}</p>
              <div className="showcase-result-grid">
                <div>
                  <span>Result</span>
                  <strong>{activeStep.result}</strong>
                </div>
                <div>
                  <span>Next</span>
                  <strong>{flow.agentHandoff.join(" / ")}</strong>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>
    </>
  );
}
