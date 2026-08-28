import type { AcceleratorProgramSnapshot, AcceleratorWeek } from "@/lib/accelerator/program";

export type AcceleratorCheckIn = {
  week: AcceleratorWeek;
  weight: { value: number; unit: "lb" | "kg" };
  waist: { value: number; unit: "in" | "cm" };
  notes: string | null;
  recordedAt: string;
};

export type AcceleratorHubData = {
  firstName: string;
  programVersion: string;
  snapshot: AcceleratorProgramSnapshot;
  completedDays: number[];
  progress: AcceleratorProgressState;
  checkIns: AcceleratorCheckIn[];
};

export type AcceleratorHubResult = { ok: true; data: AcceleratorHubData } | { ok: false };

export type AcceleratorProgressResult =
  | {
      ok: true;
      completedDays: number[];
      newlyCompleted: boolean;
      progress: AcceleratorProgressState;
    }
  | { ok: false };

export type AcceleratorProgressState = {
  currentDay: number | null;
  availableOn: string | null;
  canCompleteCurrent: boolean;
  undoDay: number | null;
  undoUntil: string | null;
  programCompleted: boolean;
};

export type UndoAcceleratorDayResult =
  | { ok: true; completedDays: number[]; undone: true; progress: AcceleratorProgressState }
  | { ok: false };

export type AcceleratorVideoView = {
  day: number;
  mediaKey: string;
  firstViewedAt: string;
  lastViewedAt: string;
  viewCount: number;
};

export type RecordAcceleratorVideoViewResult =
  | { ok: true; view: AcceleratorVideoView }
  | { ok: false };

export type SaveAcceleratorCheckInResult =
  | { ok: true; checkIn: AcceleratorCheckIn }
  | { ok: false };
