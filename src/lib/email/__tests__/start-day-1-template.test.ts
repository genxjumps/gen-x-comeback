// Focused Start Day 1 template tests (checkpoint 4).
// Pure rendering only: no dispatch, provider, or database involvement.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  START_DAY_1_FOOTER,
  START_DAY_1_GREETING_FALLBACK,
  START_DAY_1_RESUME_CTA_LABEL,
  START_DAY_1_RESUME_FALLBACK_SUBJECT,
  START_DAY_1_RESUME_PREVIEW_TEXT,
  START_DAY_1_START_CTA_LABEL,
  START_DAY_1_START_FALLBACK_SUBJECT,
  START_DAY_1_START_PREVIEW_TEXT,
  renderStartDayOne,
  startDayOneBodyParagraphs,
  type StartDayOneRenderInput,
} from "@/lib/email/start-day-1-template";
import { PROHIBITED_TEMPLATE_PATTERNS } from "@/lib/email/plan-ready-template";
import type { StartDayOneResolution } from "@/lib/email/start-day-1-resolver";

const TOKEN = "3f0a9c1d4b6e8f2a5c7b9d1e3f5a7c9b";
const RETURN_URL = `https://app.genxjumps.com/return?token=${TOKEN}`;
const PREFERENCES_URL = "https://app.genxjumps.com/email-preferences";

const START: StartDayOneResolution = { action: "START" };
const RESUME: StartDayOneResolution = { action: "RESUME" };

function input(firstName: string | null | undefined = "Dana"): StartDayOneRenderInput {
  return { firstName, returnUrl: RETURN_URL, preferencesUrl: PREFERENCES_URL };
}

const START_BODY = [
  "Hey Dana,",
  "You\u2019ve got your 7-Day Comeback Plan.",
  "Now it\u2019s time to start.",
  "Day 1: Full Body Flush & Fire",
  "Your first jump rope + total-body workout is ready.",
  "These workouts are supposed to challenge you. Work hard, rest when needed, and scale things when you need to.",
  "Don\u2019t overthink it. Start.",
];

const RESUME_BODY = [
  "Hey Dana,",
  "You already got Day 1 started. Now let\u2019s finish it.",
  "Day 1: Full Body Flush & Fire",
  "Your jump rope + total-body workout is waiting for you.",
  "You don\u2019t need to start over. Pick up where you left off, work hard, rest when needed, and scale things when you need to.",
  "Finish what you started.",
];

function orderedIndexes(haystack: string, needles: string[]): number[] {
  return needles.map((needle) => haystack.indexOf(needle));
}

function isAscending(values: number[]): boolean {
  return values.every((value, index) => value >= 0 && (index === 0 || value > values[index - 1]!));
}

describe("Start Day 1 template - START variant", () => {
  it("renders the exact personalized subject, preview, ordered body, and CTA", () => {
    const rendered = renderStartDayOne(START, input())!;
    expect(rendered.subject).toBe("Dana, Day 1: Full Body Flush & Fire");
    expect(rendered.previewText).toBe(START_DAY_1_START_PREVIEW_TEXT);
    expect(rendered.previewText).toBe("Your first workout is waiting.");
    expect(rendered.variant).toBe("start");
    expect(rendered.ctaLabel).toBe(START_DAY_1_START_CTA_LABEL);
    expect(rendered.ctaLabel).toBe("Start Day 1");
    expect(startDayOneBodyParagraphs("start", "Hey Dana,")).toEqual(START_BODY);
  });

  it("uses the fallback subject when the name is unusable", () => {
    const rendered = renderStartDayOne(START, input(null))!;
    expect(rendered.subject).toBe(START_DAY_1_START_FALLBACK_SUBJECT);
    expect(rendered.subject).toBe("Day 1: Full Body Flush & Fire");
    expect(rendered.personalizedName).toBeNull();
    expect(rendered.text.startsWith(`${START_DAY_1_GREETING_FALLBACK}\n`)).toBe(true);
    expect(rendered.html).toContain("Hey there,");
  });

  it("emits the ordered body plus sign-off in HTML and plain text", () => {
    const rendered = renderStartDayOne(START, input())!;
    expect(isAscending(orderedIndexes(rendered.text, START_BODY))).toBe(true);
    expect(isAscending(orderedIndexes(rendered.html, START_BODY.map(escapeForHtml)))).toBe(true);
    for (const line of ["Move or Rust.", "Todd", "Gen X Jumps"]) {
      expect(rendered.text).toContain(line);
      expect(rendered.html).toContain(line);
    }
    expect(rendered.text).toContain(`Start Day 1: ${RETURN_URL}`);
  });
});

describe("Start Day 1 template - RESUME variant", () => {
  it("renders the exact personalized subject, preview, ordered body, and CTA", () => {
    const rendered = renderStartDayOne(RESUME, input())!;
    expect(rendered.subject).toBe("Dana, finish Day 1: Full Body Flush & Fire");
    expect(rendered.previewText).toBe(START_DAY_1_RESUME_PREVIEW_TEXT);
    expect(rendered.previewText).toBe("Pick up where you left off.");
    expect(rendered.variant).toBe("resume");
    expect(rendered.ctaLabel).toBe(START_DAY_1_RESUME_CTA_LABEL);
    expect(rendered.ctaLabel).toBe("Resume Day 1");
    expect(startDayOneBodyParagraphs("resume", "Hey Dana,")).toEqual(RESUME_BODY);
  });

  it("uses the fallback subject and greeting when the name is unusable", () => {
    const rendered = renderStartDayOne(RESUME, input("   <script>  "))!;
    expect(rendered.subject).toBe(START_DAY_1_RESUME_FALLBACK_SUBJECT);
    expect(rendered.subject).toBe("Finish Day 1: Full Body Flush & Fire");
    expect(rendered.personalizedName).toBeNull();
    expect(rendered.html).toContain("Hey there,");
  });

  it("emits the ordered body plus sign-off in HTML and plain text", () => {
    const rendered = renderStartDayOne(RESUME, input())!;
    expect(isAscending(orderedIndexes(rendered.text, RESUME_BODY))).toBe(true);
    expect(isAscending(orderedIndexes(rendered.html, RESUME_BODY.map(escapeForHtml)))).toBe(true);
    expect(rendered.text).toContain(`Resume Day 1: ${RETURN_URL}`);
  });
});

function escapeForHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

describe("Start Day 1 template - non-sendable and purity guarantees", () => {
  it("cannot render a sendable message for any CANCEL resolution", () => {
    const cancels: StartDayOneResolution[] = [
      { action: "CANCEL", reason: "day_1_complete", disposition: "cancel" },
      { action: "CANCEL", reason: "marketing_unsubscribed", disposition: "suppress" },
      {
        action: "CANCEL",
        reason: "lifecycle_24h_cap",
        disposition: "defer",
        eligibleAt: "2026-08-03T00:00:00.000Z",
      },
    ];
    for (const cancel of cancels) {
      expect(renderStartDayOne(cancel, input())).toBeNull();
    }
  });

  it("does not mutate frozen resolver or input state and is deterministic", () => {
    const resolution = Object.freeze({ action: "START" }) as StartDayOneResolution;
    const renderInput = Object.freeze(input()) as StartDayOneRenderInput;
    const first = renderStartDayOne(resolution, renderInput)!;
    const second = renderStartDayOne(resolution, renderInput)!;
    expect(second).toEqual(first);
    expect(renderInput.firstName).toBe("Dana");
    expect(renderInput.returnUrl).toBe(RETURN_URL);
  });

  it("has no IO, environment, database, or provider access at source level", () => {
    const source = readFileSync("src/lib/email/start-day-1-template.ts", "utf8");
    for (const pattern of [
      /process\.env/,
      /import\.meta\.env/,
      /\bfetch\(/,
      /supabase/i,
      /resend/i,
      /node:fs|node:crypto/,
      /Date\.now|new Date\(/,
      /Math\.random/,
      /window\.|location\./,
    ]) {
      expect(source).not.toMatch(pattern);
    }
  });

  it("keeps the deliberate POST exchange in the existing return route untouched", () => {
    const route = readFileSync("src/routes/return.ts", "utf8");
    expect(route).toMatch(/POST:\s*async/);
    expect(route).toMatch(/method="post"/i);
  });
});

describe("Start Day 1 template - link, footer, and data limits", () => {
  it("uses the supplied opaque return URL exactly with only a token parameter", () => {
    for (const resolution of [START, RESUME]) {
      const rendered = renderStartDayOne(resolution, input())!;
      for (const output of [rendered.html, rendered.text]) {
        const urls = output.match(/https:\/\/app\.genxjumps\.com\/return\?[^\s"'<)]+/g) ?? [];
        expect(urls.length).toBeGreaterThan(0);
        for (const url of urls) {
          expect(url).toBe(RETURN_URL);
          const params = new URL(url).searchParams;
          expect([...params.keys()]).toEqual(["token"]);
          expect(params.get("token")).toBe(TOKEN);
        }
      }
    }
  });

  it("includes the app-owned footer and preferences link in HTML and text", () => {
    for (const resolution of [START, RESUME]) {
      const rendered = renderStartDayOne(resolution, input())!;
      expect(rendered.text).toContain(START_DAY_1_FOOTER);
      expect(rendered.html).toContain(escapeForHtml(START_DAY_1_FOOTER));
      expect(rendered.text).toContain(`Manage email preferences: ${PREFERENCES_URL}`);
      expect(rendered.html).toContain(`href="${PREFERENCES_URL}"`);
      expect(rendered.html).toContain(">Manage email preferences<");
    }
  });

  it("has accessible structure, hidden preview text, fallback link, and no images", () => {
    const rendered = renderStartDayOne(START, input())!;
    expect(rendered.html).toContain('<html lang="en">');
    expect(rendered.html).toContain('role="presentation"');
    expect(rendered.html).toContain("display:none;max-height:0");
    expect(rendered.html).toContain("Or open this link directly:");
    expect(rendered.html).not.toMatch(/<img|background-image/i);
  });

  it("exposes only the allowed keys and no prohibited or promotional content", () => {
    for (const resolution of [START, RESUME]) {
      const rendered = renderStartDayOne(resolution, input())!;
      expect(Object.keys(rendered).sort()).toEqual([
        "ctaLabel",
        "html",
        "personalizedName",
        "previewText",
        "subject",
        "text",
        "variant",
      ]);
      for (const pattern of PROHIBITED_TEMPLATE_PATTERNS) {
        expect(rendered.html).not.toMatch(pattern);
        expect(rendered.text).not.toMatch(pattern);
        expect(rendered.subject).not.toMatch(pattern);
      }
      for (const pattern of [/@/, /lead_plan|plan_id|planId/i, /day_number|progress/i]) {
        expect(rendered.text).not.toMatch(pattern);
      }
    }
  });
});
