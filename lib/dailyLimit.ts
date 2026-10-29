// Design Ref: §6·§13 — 하루 질문·업로드 수 세기. 내용은 저장하지 않고 { 날짜, 건수 }만 서버 메모리에 둔다.
// 서버가 다시 시작되면 0으로 돌아간다 (배포 시 Part 5에서 다시 검토).
import "server-only";

export const DAILY_QUESTION_LIMIT = 100;
export const DAILY_UPLOAD_LIMIT = 20;

// 날짜는 한국 시간 기준으로 바꾼다 (예: 2026-10-28).
const seoulDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" });

export function todayInSeoul(now: Date = new Date()): string {
  return seoulDate.format(now);
}

function createDailyCounter(limit: number) {
  let counter = { date: "", count: 0 };

  // 오늘 한도가 남아 있으면 1건을 쓰고 true, 다 썼으면 false를 돌려준다.
  // 확인과 차감을 한 번에 해서, 동시에 들어온 요청이 한도를 넘지 않게 한다.
  return (now: Date = new Date()): boolean => {
    const today = todayInSeoul(now);
    if (counter.date !== today) counter = { date: today, count: 0 };

    if (counter.count >= limit) return false;
    counter.count += 1;
    return true;
  };
}

export const tryConsumeDailyQuestion = createDailyCounter(DAILY_QUESTION_LIMIT);
export const tryConsumeDailyUpload = createDailyCounter(DAILY_UPLOAD_LIMIT);
