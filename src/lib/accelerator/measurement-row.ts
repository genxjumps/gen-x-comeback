import type { CustomerMeasurement } from "@/lib/accelerator/types";

export function toCustomerMeasurement(row: {
  id: string;
  enrollment_id: string | null;
  measurement_kind: string;
  value: number;
  unit: string;
  measurement_context: string;
  notes: string | null;
  measured_at: string;
  created_at: string;
}): CustomerMeasurement {
  return {
    id: row.id,
    enrollmentId: row.enrollment_id,
    kind: row.measurement_kind as CustomerMeasurement["kind"],
    value: Number(row.value),
    unit: row.unit as CustomerMeasurement["unit"],
    context: row.measurement_context as CustomerMeasurement["context"],
    notes: row.notes,
    measuredAt: row.measured_at,
    createdAt: row.created_at,
  };
}
