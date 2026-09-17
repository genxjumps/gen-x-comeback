import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearBrowserAccountData,
  logoutThisBrowser,
  watchLogoutEvents,
  LOGOUT_EVENT_KEY,
} from "../browser-session";

afterEach(() => vi.unstubAllGlobals());

describe("browser account cleanup", () => {
  it("removes credentials, replay tokens, and personal drafts while preserving device preferences", () => {
    const local = new Map([
      ["gxj_plan_token_v1", "credential"],
      ["gxj_assessment_draft_v1", "answers"],
      ["gxj_eligibility_answer_v1", "yes"],
      ["gxj_assessment_owner_v1", "owner"],
      ["gxj_submission_v1", "replay credential"],
      ["unrelated_preference", "keep"],
    ]);
    const session = new Map([["gxj_lead_intake_v1", "name and email"]]);
    vi.stubGlobal("window", {
      localStorage: { removeItem: (key: string) => local.delete(key) },
      sessionStorage: { removeItem: (key: string) => session.delete(key) },
    });
    clearBrowserAccountData();
    expect([...local]).toEqual([["unrelated_preference", "keep"]]);
    expect(session.size).toBe(0);
  });

  it("reports completion only after server, storage, auth, and other-tab notification succeed", async () => {
    const calls: string[] = [];
    expect(
      await logoutThisBrowser("credential", {
        clearServerSession: async (token) => {
          expect(token).toBe("credential");
          calls.push("server");
          return true;
        },
        clearData: () => {
          calls.push("data");
        },
        signOut: async () => {
          calls.push("auth");
          return { error: null };
        },
        announce: () => {
          calls.push("tabs");
        },
      }),
    ).toBe(true);
    expect(calls).toEqual(["server", "data", "auth", "tabs"]);
  });

  it.each(["server", "data", "auth", "tabs"])(
    "attempts all cleanup after a %s failure without false success",
    async (failure) => {
      const calls: string[] = [];
      const step = (name: string) => {
        calls.push(name);
        if (name === failure) throw Error("unavailable");
      };
      expect(
        await logoutThisBrowser(null, {
          clearServerSession: async () => {
            step("server");
            return true;
          },
          clearData: () => step("data"),
          signOut: async () => {
            step("auth");
            return { error: null };
          },
          announce: () => step("tabs"),
        }),
      ).toBe(false);
      expect(calls).toEqual(["server", "data", "auth", "tabs"]);
    },
  );

  it("treats returned provider and server errors as failure, too", async () => {
    expect(
      await logoutThisBrowser(null, {
        clearServerSession: async () => false,
        clearData: () => undefined,
        signOut: async () => ({ error: Error("offline") }),
        announce: () => undefined,
      }),
    ).toBe(false);
  });

  it("still clears remaining personal fields when one storage removal fails", () => {
    const removed: string[] = [];
    vi.stubGlobal("window", {
      localStorage: {
        removeItem: (key: string) => {
          removed.push(key);
          if (key === "gxj_plan_token_v1") throw Error("blocked");
        },
      },
      sessionStorage: { removeItem: (key: string) => removed.push(key) },
    });
    expect(clearBrowserAccountData).toThrow();
    expect(removed).toContain("gxj_submission_v1");
    expect(removed).toContain("gxj_lead_intake_v1");
  });
});

describe("logout across tabs and browser Back", () => {
  function setup(initial: string | null = null) {
    let epoch = initial;
    const events = new EventTarget();
    const tab = new Map([["gxj_lead_intake_v1", "previous email"]]);
    const removeShared = vi.fn();
    const replace = vi.fn();
    const reload = vi.fn();
    const clearCache = vi.fn();
    vi.stubGlobal("window", {
      localStorage: { getItem: () => epoch, removeItem: removeShared },
      sessionStorage: {
        getItem: (key: string) => tab.get(key),
        setItem: (key: string, value: string) => tab.set(key, value),
        removeItem: (key: string) => tab.delete(key),
      },
      location: { replace, reload },
      addEventListener: events.addEventListener.bind(events),
      removeEventListener: events.removeEventListener.bind(events),
    });
    const stop = watchLogoutEvents(clearCache);
    const send = (type: string, props: Record<string, unknown>) =>
      events.dispatchEvent(Object.assign(new Event(type), props));
    return {
      tab,
      replace,
      reload,
      clearCache,
      removeShared,
      stop,
      send,
      setEpoch: (value: string) => {
        epoch = value;
      },
    };
  }

  it("discards another tab's private page and draft without erasing a newer login", () => {
    const f = setup();
    f.setEpoch("logout-1");
    f.send("storage", { key: LOGOUT_EVENT_KEY, newValue: "logout-1" });
    expect(f.tab.has("gxj_lead_intake_v1")).toBe(false);
    expect(f.clearCache).toHaveBeenCalledOnce();
    expect(f.replace).toHaveBeenCalledWith("/account");
    expect(f.removeShared).not.toHaveBeenCalled();
    f.stop();
  });

  it("handles an event missed while the page was frozen in the back-forward cache", () => {
    const f = setup();
    f.setEpoch("logout-2");
    f.send("pageshow", { persisted: true });
    expect(f.replace).toHaveBeenCalledWith("/account");
    expect(f.tab.has("gxj_lead_intake_v1")).toBe(false);
    f.stop();
  });

  it("revalidates a restored page even without a logout event", () => {
    const f = setup();
    f.send("pageshow", { persisted: true });
    expect(f.reload).toHaveBeenCalledOnce();
    expect(f.replace).not.toHaveBeenCalled();
    f.stop();
  });

  it("clears an old tab's session draft on a later full reload", () => {
    const f = setup("already-logged-out");
    expect(f.tab.has("gxj_lead_intake_v1")).toBe(false);
    expect(f.removeShared).not.toHaveBeenCalled();
    f.stop();
  });

  it("ignores unrelated storage updates and removes listeners on unmount", () => {
    const f = setup();
    f.send("storage", { key: "device-preference", newValue: "x" });
    expect(f.replace).not.toHaveBeenCalled();
    f.stop();
    f.send("storage", { key: LOGOUT_EVENT_KEY, newValue: "logout-3" });
    expect(f.replace).not.toHaveBeenCalled();
  });
});
