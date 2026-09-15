import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

test("dedicated mobile deployment blocks platform and development routes", () => {
  const prior = process.env.QUESIQ_DEPLOYMENT;
  process.env.QUESIQ_DEPLOYMENT = "interview-mobile";
  try {
    for (const path of ["/", "/study", "/dpe", "/admin", "/api/study", "/api/dev-auth/session", "/api/mobile/v1/interview/auth/dev-session", "/api/mobile/v1/interview/auth/dev-session/", "/api/mobile/v1/interview-other", "/_next/data/build/study.json"]) {
      assert.equal(proxy(new NextRequest(`https://example.com${path}`)).status, 404, path);
    }
    for (const path of ["/health", "/api/mobile/v1/interview/auth/login", "/api/mobile/v1/interview/bootstrap"]) {
      assert.equal(proxy(new NextRequest(`https://example.com${path}`)).headers.get("x-middleware-next"), "1", path);
    }
    delete process.env.QUESIQ_DEPLOYMENT;
    assert.equal(proxy(new NextRequest("https://example.com/study")).headers.get("x-middleware-next"), "1");
  } finally {
    if (prior === undefined) delete process.env.QUESIQ_DEPLOYMENT;
    else process.env.QUESIQ_DEPLOYMENT = prior;
  }
});
