# Home snapshots

Home shows current account data before asking the customer to open a detail page.

- The next-step panel distinguishes loading, unavailable data, no owned programs, an unstarted Accelerator, paused progress, completed history, and a current assignment. It never treats a failed read as an empty account.
- Workout placeholder media is removed. Rest and calendar waiting retain their existing program rules.
- My Programs shows owned program names, status, and completed days.
- Your Progress shows current program completion and the latest saved weight and waist, including measurement dates and original units. Missing measurements are labeled as not recorded.
- Your Nutrition shows saved daily calorie and macro targets, or the actual setup, locked, loading, or unavailable state. These are targets, not food-consumption totals.
- Each snapshot opens its existing detail screen. Explore Programs is a compact secondary link.

Data comes from existing authenticated read functions. No new storage, tracking, automatic program starts, access changes, or nutrition calculations are introduced. Signed-in production visual acceptance uses Todd's existing session; signed-out smoke checks cannot establish that acceptance.
