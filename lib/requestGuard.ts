// Design Ref: §9 — 다른 사이트가 로그인한 직원의 브라우저로 이 앱의 API를 몰래 부르는 것(CSRF)을 막는다.
// 브라우저는 요청마다 Sec-Fetch-Site를 붙이므로, 같은 사이트가 아닌 요청은 거절한다.
// (헤더가 없는 요청은 브라우저가 아닌 도구라 CSRF와 관계없어 통과시킨다.)

export function rejectCrossSite(request: Request): Response | null {
  const site = request.headers.get("sec-fetch-site");
  if (site !== null && site !== "same-origin" && site !== "none") {
    return Response.json(
      { status: "error", code: "INVALID_INPUT", message: "허용되지 않은 요청입니다." },
      { status: 403 },
    );
  }
  return null;
}

export function requireJson(request: Request): Response | null {
  const type = request.headers.get("content-type") ?? "";
  if (!type.toLowerCase().includes("application/json")) {
    return Response.json(
      { status: "error", code: "INVALID_INPUT", message: "요청 형식이 올바르지 않습니다." },
      { status: 415 },
    );
  }
  return null;
}
