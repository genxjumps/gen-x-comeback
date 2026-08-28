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
  checkIns: AcceleratorCheckIn[];
};

export type AcceleratorHubResult = { ok: true; data: AcceleratorHubData } | { ok: false };

export type AcceleratorProgressResult =
  | {
      ok: true;
      completedDays: number[];
      newlyCompleted: boolean;
      programCompleted: boolean;
    }
  | { ok: false };

export type SaveAcceleratorCheckInResult =
  | { ok: true; checkIn: AcceleratorCheckIn }
  | { ok: false };
