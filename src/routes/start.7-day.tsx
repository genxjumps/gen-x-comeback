import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IntakeClosed } from "@/components/intake-closed";
import { readStoredToken } from "@/lib/access-token";
import {
  readLeadIntakeDraft,
  validEmail,
  validFirstName,
  writeLeadIntakeDraft,
} from "@/lib/lead-intake-draft";
import { CONSENT_COPY } from "@/lib/lead-plan";
import { verifyAccessToken } from "@/lib/lead.functions";
import { NEW_PLAN_INTAKE_OPEN } from "@/lib/intake";

export const Route = createFileRoute("/start/7-day")({
  head: () => ({
    meta: [
      { title: "Start Your Free 7-Day Plan | Gen X Jumps" },
      {
        name: "description",
        content: "Sign up and get a personalized Gen X Jumps 7-Day Fitness Plan.",
      },
    ],
  }),
  component: SevenDaySignup,
});

function SevenDaySignup() {
  const navigate = useNavigate();
  const verifyToken = useServerFn(verifyAccessToken);
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);

  useEffect(() => {
    const saved = readLeadIntakeDraft();
    if (saved) {
      setFirstName(saved.firstName);
      setEmail(saved.email);
      setConsent(saved.consentGranted);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const token = readStoredToken();
    if (!token) {
      setCheckingAccess(false);
      return;
    }
    void (async () => {
      try {
        const result = await verifyToken({ data: { token } });
        if (!cancelled && result.ok) {
          navigate({ to: "/your-plan", replace: true });
          return;
        }
      } catch {
        // A failed recognition check must not block a new signup.
      }
      if (!cancelled) setCheckingAccess(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate, verifyToken]);

  if (checkingAccess) return null;

  if (!NEW_PLAN_INTAKE_OPEN) {
    return (
      <div className="mx-auto w-full max-w-lg px-5 py-10 sm:py-16">
        <IntakeClosed />
      </div>
    );
  }

  const nameOk = validFirstName(firstName);
  const emailOk = validEmail(email);

  return (
    <main className="mx-auto w-full max-w-lg px-5 py-10 sm:py-16">
      <p className="gxj-kicker text-xs font-semibold uppercase tracking-[0.16em]">
        Free 7-Day Fitness Plan
      </p>
      <h1 className="gxj-display-title mt-4 text-3xl leading-tight tracking-tight sm:text-4xl">
        Start Your Comeback
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Enter your information, answer a few short questions, and get your personalized plan
        immediately.
      </p>

      <form
        noValidate
        className="mt-7 grid gap-4 rounded-lg border border-border bg-card p-5"
        onSubmit={(event) => {
          event.preventDefault();
          setShowErrors(true);
          if (!nameOk || !emailOk || !consent) {
            const selector = !nameOk
              ? "#signup-first-name"
              : !emailOk
                ? "#signup-email"
                : "#signup-consent";
            window.requestAnimationFrame(() => {
              document.querySelector<HTMLElement>(selector)?.focus();
            });
            return;
          }
          writeLeadIntakeDraft({
            firstName: firstName.trim(),
            email: email.trim(),
            consentGranted: true,
          });
          navigate({ to: "/assessment/start" });
        }}
      >
        <div className="grid gap-1.5">
          <Label htmlFor="signup-first-name">First name</Label>
          <Input
            id="signup-first-name"
            name="firstName"
            autoComplete="given-name"
            value={firstName}
            maxLength={60}
            autoFocus
            onChange={(event) => setFirstName(event.target.value)}
            aria-invalid={showErrors && !nameOk ? true : undefined}
            aria-describedby="signup-first-name-error"
          />
          <div id="signup-first-name-error" aria-live="polite" role="status">
            {showErrors && !nameOk ? (
              <p className="text-xs text-muted-foreground">Enter your first name.</p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="signup-email">Email address</Label>
          <Input
            id="signup-email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={showErrors && !emailOk ? true : undefined}
            aria-describedby="signup-email-error"
          />
          <div id="signup-email-error" aria-live="polite" role="status">
            {showErrors && !emailOk ? (
              <p className="text-xs text-muted-foreground">Enter a valid email address.</p>
            ) : null}
          </div>
        </div>

        <div className="flex items-start gap-2">
          <Checkbox
            id="signup-consent"
            checked={consent}
            onCheckedChange={(value) => setConsent(value === true)}
            className="mt-0.5"
            aria-describedby="signup-consent-error"
          />
          <Label htmlFor="signup-consent" className="text-xs font-normal leading-relaxed">
            {CONSENT_COPY}
          </Label>
        </div>
        <div id="signup-consent-error" aria-live="polite" role="status">
          {showErrors && !consent ? (
            <p className="text-xs text-muted-foreground">You need to agree before continuing.</p>
          ) : null}
        </div>

        <Button type="submit" size="lg" className="w-full">
          Start My Free 7-Day Plan
        </Button>
        <p className="text-xs text-muted-foreground">
          Free. No password required. Your plan opens immediately after the short assessment.
        </p>
      </form>
    </main>
  );
}
