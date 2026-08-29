# V1.1 Accelerator program-content readiness audit

Date: 2026-08-28

Status: Read-only source audit complete. Checkpoint 5 is not complete and no launch requirement is
verified yet.

This audit compares the available Gen X Jumps YouTube source videos with the canonical product
contract. It does not publish media, change video visibility, apply a migration, open enrollment,
or change customer-facing behavior. Private source URLs and video identifiers are intentionally
excluded from the repository.

## Outcome

- Workouts A through E are present and playable.
- The spoken workout content broadly matches the approved A-E formats and focus.
- A-E use a jump rope and bodyweight only. No dumbbells, bench, or gym equipment appear in the
  audited workout prescriptions.
- The video whose spoken introduction identifies it as Workout D is incorrectly titled as a second
  Workout C upload.
- Several A-E recordings contain timer-label, rep-count, or format-name inconsistencies. Some are
  corrected verbally in the recording, but the final paid experience should not depend on a
  customer noticing an improvised correction.
- No purpose-built Accelerator Workout F was found. The only close candidate is an older unlisted
  active-recovery video made for the free 7-Day plan. It is not suitable as the final Accelerator F
  without replacement or a deliberate edit.
- No Accelerator welcome/orientation video or weekly coaching videos were found.
- No final source has been transferred to Cloudflare Stream.

The safe conclusion is that the approved program structure is supported by the A-E source material,
but the paid content package is not ready to upload or snapshot.

## Source-video findings

The runtime below is the duration reported by the signed-in YouTube player. It is source evidence,
not the final Cloudflare-encoded runtime.

| Assignment                  | Source runtime | Contract fit                                                                                | Required content work before final upload                                                                                                                                                                                                |
| --------------------------- | -------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workout A                   | 25:43          | Classic intervals with push and leg work                                                    | Correct or deliberately accept conflicting timer labels for squat pulses and alternating double hops.                                                                                                                                    |
| Workout B                   | 27:30          | EMOM with conditioning and core work                                                        | Add a clear pre-video warm-up instruction because the source begins the EMOM immediately; use final written instructions to resolve live rep-count changes.                                                                              |
| Workout C                   | 24:07          | Lower-body ladder with squats, reverse lunges, glute bridges, and a finisher                | Reconcile timer and spoken counts for reverse lunges, glute bridges, and the finisher.                                                                                                                                                   |
| Workout D                   | 26:25          | Intervals with jump, upper-body, lower-body, and posterior-chain work                       | Correct the source title, then review and trim non-program nutrition and future-program commentary if this is the final paid edit.                                                                                                       |
| Workout E                   | 25:07          | An up-and-down total-body sequence that functionally matches the approved pyramid challenge | Correct the spoken ladder/pyramid naming and reconcile counting and cue inconsistencies, including the final glute-bridge variation.                                                                                                     |
| Active Recovery F candidate | 14:09          | Light rope work, marching, shoulder mobility, and torso mobility                            | Replace with an Accelerator-specific recovery video, or deliberately edit out the free 7-Day framing, paid-program promotion, unsupported claims, and incorrect contact wording. Add an appropriate warm-up or clear pre-video guidance. |

The source videos include timers. The app should not duplicate those timers. The app still needs a
short, accurate written summary for each assignment so the customer knows the structure,
modification rule, equipment, and completion standard before pressing play.

## Missing required content

The canonical contract requires the following content that is not currently present:

1. Todd's short welcome and orientation video.
2. Equivalent written orientation.
3. Week 1 coaching primer: Set Your Baseline.
4. Week 2 coaching primer: Clean It Up.
5. Week 3 coaching primer: Raise Your Output.
6. Week 4 coaching primer: Finish Strong.
7. A final Accelerator-specific Active Recovery F video.
8. Short practical written instructions for A-F and the rest day.

Starting weight and waist remain independently optional. The orientation must not imply that either
measurement is required to begin Day 1.

## Verification status

| Launch requirement           | Audit result                                                          | Status       |
| ---------------------------- | --------------------------------------------------------------------- | ------------ |
| Correct A-E source files     | Located and playable, with repair items above                         | Not verified |
| Correct Active Recovery F    | No final Accelerator-specific source found                            | Not verified |
| Final workout runtimes       | YouTube source runtimes recorded; Cloudflare encodes do not exist     | Not verified |
| Rope/bodyweight/no-gym claim | Supported by A-E; must be rechecked against final F and final exports | Not verified |
| Orientation                  | Missing                                                               | Not verified |
| Four weekly coaching primers | Missing                                                               | Not verified |
| Cloudflare Stream media      | Not uploaded                                                          | Not verified |
| Complete V1 program snapshot | Blocked by final content and Stream identifiers                       | Not verified |

## Safest completion order

1. Repair or deliberately replace the identified A-E source issues.
2. Produce the Accelerator-specific F, orientation, and four weekly coaching primers.
3. Author the written orientation and practical A-F/rest instructions from the final videos.
4. Review the complete package once for naming, sequence, equipment, claims, timers, and runtime.
5. Upload the approved final files to Cloudflare Stream once.
6. Record the final Stream identifiers, encoded runtimes, and equipment in the immutable V1 program
   snapshot.
7. Add snapshot and rendering tests, run the complete local quality gate, and use one GitHub pull
   request and one Actions gate for the finished checkpoint.

Uploading before the source package is final would create avoidable storage, transcoding, and
verification work. Cloudflare transfer therefore follows content approval rather than preceding it.

## Recommended default

Use A-E as the foundation, repair the customer-visible cue problems, create a new Accelerator F,
and record the five short supporting videos. Do not lower the approved product requirements to fit
the incomplete source package.
