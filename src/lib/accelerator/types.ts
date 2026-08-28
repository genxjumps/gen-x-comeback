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
  programVersion: string;
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
