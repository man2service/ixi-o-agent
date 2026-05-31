const stages = {
  ingest: {
    title: "채널톡 통화 전사문",
    detail: "고객이 내일 오후 3시 납품 가능 여부와 대체 픽업 시간을 문의했습니다.",
    result: "source/channel-talk.payload.json",
    raw: "local only",
    action: "prepare",
    review: "required"
  },
  process: {
    title: "로컬 EXAONE 결과",
    detail: "문의 유형은 일정 조율이며 긴급도는 normal입니다. 담당자는 운영팀입니다.",
    result: "agent/exaone.local-output.json",
    raw: "local only",
    action: "prepare",
    review: "required"
  },
  kiya: {
    title: "Telegram Kiya 메시지",
    detail: "요약을 먼저 보내고, 일정 등록 후보가 있으면 확인/수정 버튼을 따로 제안합니다.",
    result: "agent/kiya-notification.latest.json",
    raw: "local only",
    action: "propose",
    review: "required"
  },
  miso: {
    title: "MISO-facing handoff",
    detail: "원문과 오디오는 포함하지 않고, 승인된 요약/액션아이템만 custom tool로 제공합니다.",
    result: "handoff/miso-payload.redacted.json",
    raw: "blocked",
    action: "pull",
    review: "approved"
  }
};

const buttons = document.querySelectorAll("[data-stage]");
const title = document.querySelector("#stage-title");
const detail = document.querySelector("#stage-detail");
const result = document.querySelector("#stage-result");
const raw = document.querySelector("#stage-raw");
const action = document.querySelector("#stage-action");
const review = document.querySelector("#stage-review");

buttons.forEach((button) => {
  button.addEventListener("click", () => {
    const stage = stages[button.dataset.stage];
    if (!stage) return;

    buttons.forEach((item) => {
      item.classList.remove("selected");
      item.setAttribute("aria-selected", "false");
    });
    button.classList.add("selected");
    button.setAttribute("aria-selected", "true");

    title.textContent = stage.title;
    detail.textContent = stage.detail;
    result.textContent = stage.result;
    raw.textContent = stage.raw;
    action.textContent = stage.action;
    review.textContent = stage.review;
  });
});
