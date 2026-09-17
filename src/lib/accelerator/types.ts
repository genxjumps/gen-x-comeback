import type { AcceleratorProgramSnapshot } from "@/lib/accelerator/program";

export type MeasurementKind = "weight" | "waist";
export type MeasurementUnit = "lb" | "kg" | "in" | "cm";
export type MeasurementContext = "general" | "starting" | "progress" | "final";

export type CustomerMeasurement = {
  id: string;
  enrollmentId: string | null;
  kind: MeasurementKind;
  value: number;
  unit: MeasurementUnit;
  context: MeasurementContext;
  notes: string | null;
  measuredAt: string;
  createdAt: string;
};

export type MeasurementPair = {
  weight: CustomerMeasurement | null;
  waist: CustomerMeasurement | null;
};

export type MeasurementSummary = {
  globalLatest: MeasurementPair;
  runStarting: MeasurementPair;
  runNewest: MeasurementPair;
  runFinal: MeasurementPair;
};

export type AcceleratorHubData = {
  firstName: string;
  entitlementId: string;
  enrollmentId: string;
  programVersion: string;
  runStatus: "active" | "paused" | "completed";
  snapshot: AcceleratorProgramSnapshot;
  completedDays: number[];
  progress: AcceleratorProgressState;
  measurements: CustomerMeasurement[];
  measurementSummary: MeasurementSummary;
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
  daysWaiting: number;
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

export type SaveMeasurementResult = { ok: true; measurement: CustomerMeasurement } | { ok: false };
export type RemoveMeasurementResult =
  | { ok: true; measurementId: string; removed: true }
  | { ok: false };

export type CustomerProgramStatus = "not_started" | "active" | "paused" | "completed";

export type CustomerProgramRunSummary = {
  enrollmentId: string;
  runNumber: number;
  programVersion: string;
  status: Exclude<CustomerProgramStatus, "not_started">;
  completedDays: number;
  startedAt: string;
  completedAt: string | null;
  measurementSummary: MeasurementSummary;
};

export type AcceleratorProgramCard = {
  entitlementId: string;
  status: CustomerProgramStatus;
  currentRun: CustomerProgramRunSummary | null;
  previousRuns: CustomerProgramRunSummary[];
};

export type LeadPlanCard = {
  leadPlanId: string;
  status: "active" | "paused" | "completed";
  completedDays: number;
  totalDays: number;
};

export type MyProgramsResult =
  | {
      ok: true;
      firstName: string;
      accelerator: AcceleratorProgramCard | null;
      leadPlans: LeadPlanCard[];
      activeProgram: "accelerator" | "lead_plan" | "other_program" | null;
      latestMeasurements: MeasurementPair;
    }
  | { ok: false };

export type BeginAcceleratorResult =
  | { ok: true; enrollmentId: string }
  | { ok: false; reason: "unauthorized" | "rejected" };

export type ProgramRunActionResult =
  | { ok: true; enrollmentId: string; pausedAnotherProgram: boolean }
  | { ok: false };
