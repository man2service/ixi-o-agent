const flows = {
  enterprise: {
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

let activeMode = "enterprise";
let activeStepIndex = 0;

const modeButtons = document.querySelectorAll("[data-mode]");
const stageList = document.querySelector("#stage-list");
const previousButton = document.querySelector("#previous-step");
const nextButton = document.querySelector("#next-step");

const fields = {
  source: document.querySelector("#flow-source"),
  title: document.querySelector("#flow-title"),
  summary: document.querySelector("#flow-summary"),
  progress: document.querySelector("#flow-progress"),
  progressBar: document.querySelector("#flow-progress-bar"),
  status: document.querySelector("#flow-status"),
  modeLabel: document.querySelector("#current-mode-label"),
  stageTitle: document.querySelector("#stage-title"),
  artifact: document.querySelector("#stage-artifact"),
  detail: document.querySelector("#stage-detail"),
  privacy: document.querySelector("#flow-privacy"),
  policy: document.querySelector("#stage-policy"),
  handoff: document.querySelector("#flow-handoff"),
  payload: document.querySelector("#stage-payload")
};

function render() {
  const flow = flows[activeMode];
  const step = flow.steps[activeStepIndex];
  const progress = Math.round(((activeStepIndex + 1) / flow.steps.length) * 100);

  fields.source.textContent = flow.source;
  fields.title.textContent = flow.title;
  fields.summary.textContent = flow.summary;
  fields.progress.textContent = `${progress}%`;
  fields.progressBar.style.width = `${progress}%`;
  fields.status.textContent = step.status;
  fields.modeLabel.textContent = `${flow.label} current step`;
  fields.stageTitle.textContent = step.title;
  fields.artifact.textContent = step.artifact;
  fields.detail.textContent = step.detail;
  fields.privacy.textContent = flow.privacy;
  fields.policy.textContent = step.transcriptPolicy;
  fields.handoff.textContent = flow.handoff;
  fields.payload.textContent = step.agentPayload;

  modeButtons.forEach((button) => {
    const selected = button.dataset.mode === activeMode;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-selected", String(selected));
  });

  stageList.innerHTML = "";
  flow.steps.forEach((stage, index) => {
    const button = document.createElement("button");
    const state = index < activeStepIndex ? "completed" : index === activeStepIndex ? "selected" : "upcoming";
    button.type = "button";
    button.className = `stage ${state}`;
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", String(index === activeStepIndex));
    button.innerHTML = `<span>${stage.number}</span><strong>${stage.title}</strong><em>${stage.caption}</em>`;
    button.addEventListener("click", () => {
      activeStepIndex = index;
      render();
    });
    stageList.append(button);
  });

  previousButton.disabled = activeStepIndex === 0;
  nextButton.textContent = activeStepIndex === flow.steps.length - 1 ? "처음부터" : "단계 완료";
}

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeMode = button.dataset.mode;
    activeStepIndex = 0;
    render();
  });
});

previousButton.addEventListener("click", () => {
  activeStepIndex = Math.max(activeStepIndex - 1, 0);
  render();
});

nextButton.addEventListener("click", () => {
  const flow = flows[activeMode];
  activeStepIndex = activeStepIndex === flow.steps.length - 1 ? 0 : activeStepIndex + 1;
  render();
});

render();
