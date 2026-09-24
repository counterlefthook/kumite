// Shared values for pages and server actions.

export const ZONE = "America/Chicago";

/** Holds today's local date when "Gym today?" was answered yes. */
export const GYM_COOKIE = "kumite_gym";

/** Rung 1 of each dumbbell ladder, by the template it is calibrated in. */
export const CALIBRATION = {
  A: ["db_romanian_deadlift", "db_split_squat", "db_bench_press", "db_curl", "db_overhead_triceps_extension"],
  B: ["goblet_box_squat", "db_seated_shoulder_press", "db_chest_supported_row", "db_hip_thrust"],
} as const;
