# Home snapshots

Home answers what the customer should do today before summarizing the rest of the account.

- The main card distinguishes loading, unavailable data, no programs, a program that has not
  started, paused progress, completed history, an active workout, active recovery, rest, and the
  calendar wait after completing a day. A failed read is never presented as an empty account.
- The main card gives one next action without repeating save behavior or exposing technical error
  details.
- Programs shows the number of owned programs or a short path to available programs. Program names,
  statuses, and completed-day details remain on Programs.
- Progress shows the latest recorded weight and waist in their original units. Measurement dates and
  history remain on Progress. When neither value exists, Home shows **No measurements yet**.
- Nutrition shows the saved daily calorie and macro targets or a short setup, locked, loading, or
  retry state. These are targets, not food-consumption totals.
- Each summary card opens its existing detail screen.

Data comes from existing authenticated read functions. No new storage, tracking, automatic program
starts, access changes, or nutrition calculations are introduced. Signed-in production visual
acceptance uses Todd's existing session; signed-out smoke checks cannot establish that acceptance.
