export function emailHealthIsReady(
  input: {
    sending: boolean;
    paidSending: boolean;
    unresolvedIncidents: boolean;
    lastCron: {
      completed_at: string | null;
      invoked_at: string;
      dispatch_succeeded: boolean | null;
    } | null;
  },
  now = Date.now(),
) {
  const completed = input.lastCron?.completed_at ? Date.parse(input.lastCron.completed_at) : NaN;
  return (
    input.sending &&
    input.paidSending &&
    !input.unresolvedIncidents &&
    input.lastCron?.dispatch_succeeded === true &&
    Number.isFinite(completed) &&
    completed <= now &&
    now - completed <= 12 * 60_000
  );
}
