// The starting exercise library and the six workout templates. Everything here is a default:
// he can rename exercises, set the exact machine, mark what his gym actually has, and add his own.

export type Muscle = "Chest" | "Back" | "Shoulders" | "Biceps" | "Triceps" | "Quads" | "Hamstrings" | "Glutes" | "Calves" | "Core" | "Cardio";
export type Equipment = "Technogym Biostrength" | "Technogym machine" | "Cable" | "Dumbbell" | "Barbell" | "Bodyweight" | "Cardio machine";
export type WorkoutType = "Push" | "Pull" | "Legs" | "Core" | "Cardio";

export const MUSCLES: Muscle[] = ["Chest", "Back", "Shoulders", "Biceps", "Triceps", "Quads", "Hamstrings", "Glutes", "Calves", "Core", "Cardio"];
export const EQUIPMENT: Equipment[] = ["Technogym Biostrength", "Technogym machine", "Cable", "Dumbbell", "Barbell", "Bodyweight", "Cardio machine"];
export const WORKOUT_TYPES: WorkoutType[] = ["Push", "Pull", "Legs", "Core", "Cardio"];

export type LibraryExercise = {
  key: string;
  name: string;
  muscle: Muscle;
  equipment: Equipment;
  pattern: string;
  type: WorkoutType;
  increment: number; // smallest weight jump, in his unit; he can change it per exercise
  caution?: string; // shown for movements that load the shoulder at end range
};

const SHOULDER = "Watch shoulder position: stop short of a deep stretch, keep it controlled, and swap it out if it feels unstable.";

const ex = (key: string, name: string, muscle: Muscle, equipment: Equipment, pattern: string, type: WorkoutType, extra: Partial<LibraryExercise> = {}): LibraryExercise =>
  ({ key, name, muscle, equipment, pattern, type, increment: equipment === "Dumbbell" ? 5 : equipment === "Bodyweight" || equipment === "Cardio machine" ? 0 : 5, ...extra });

export const LIBRARY: LibraryExercise[] = [
  // Push
  ex("tg-bio-chest-press", "Biostrength Chest Press", "Chest", "Technogym Biostrength", "Horizontal press", "Push", { increment: 2 }),
  ex("tg-incline-press", "Incline Chest Press", "Chest", "Technogym machine", "Incline press", "Push"),
  ex("tg-chest-press", "Chest Press", "Chest", "Technogym machine", "Horizontal press", "Push"),
  ex("tg-pec-deck", "Pec Deck / Chest Fly", "Chest", "Technogym machine", "Fly", "Push", { caution: SHOULDER }),
  ex("tg-lateral-raise", "Lateral Raise Machine", "Shoulders", "Technogym machine", "Lateral raise", "Push"),
  ex("tg-shoulder-press", "Shoulder Press", "Shoulders", "Technogym machine", "Vertical press", "Push", { caution: "Only if pain-free and stable. Never force overhead pressing; swap for an incline press or lateral raise." }),
  ex("tg-triceps-ext", "Triceps Extension Machine", "Triceps", "Technogym machine", "Elbow extension", "Push"),
  ex("cable-pushdown", "Cable Triceps Pushdown", "Triceps", "Cable", "Elbow extension", "Push"),
  ex("cable-lateral-raise", "Cable Lateral Raise", "Shoulders", "Cable", "Lateral raise", "Push", { increment: 2.5 }),
  ex("cable-fly", "Cable Fly (mid height)", "Chest", "Cable", "Fly", "Push", { caution: SHOULDER }),
  ex("cable-overhead-triceps", "Cable Overhead Triceps Extension", "Triceps", "Cable", "Elbow extension", "Push", { caution: "Arms overhead. Skip it if the shoulder feels loose." }),
  ex("db-incline-press", "Incline Dumbbell Press", "Chest", "Dumbbell", "Incline press", "Push", { caution: SHOULDER }),
  ex("db-bench", "Dumbbell Bench Press", "Chest", "Dumbbell", "Horizontal press", "Push", { caution: SHOULDER }),
  ex("db-lateral-raise", "Dumbbell Lateral Raise", "Shoulders", "Dumbbell", "Lateral raise", "Push", { increment: 2.5 }),
  ex("bb-bench", "Barbell Bench Press", "Chest", "Barbell", "Horizontal press", "Push", { caution: SHOULDER }),
  ex("pushup", "Push-up", "Chest", "Bodyweight", "Horizontal press", "Push"),
  ex("dips", "Dips", "Chest", "Bodyweight", "Vertical press", "Push", { caution: "Puts the shoulder in deep extension. Generally best avoided with instability." }),
  // Pull
  ex("tg-bio-lat-pulldown", "Biostrength Lat Pulldown", "Back", "Technogym Biostrength", "Vertical pull", "Pull", { increment: 2 }),
  ex("tg-seated-row", "Seated Row", "Back", "Technogym machine", "Horizontal pull", "Pull"),
  ex("tg-high-row", "High Row", "Back", "Technogym machine", "Vertical pull", "Pull"),
  ex("tg-reverse-pec-deck", "Reverse Pec Deck", "Shoulders", "Technogym machine", "Rear delt", "Pull"),
  ex("tg-chest-supported-row", "Chest-Supported Row", "Back", "Technogym machine", "Horizontal pull", "Pull"),
  ex("tg-neutral-pulldown", "Neutral-Grip Lat Pulldown", "Back", "Technogym machine", "Vertical pull", "Pull"),
  ex("tg-rear-delt", "Rear Delt Machine", "Shoulders", "Technogym machine", "Rear delt", "Pull"),
  ex("tg-biceps-curl", "Biceps Curl Machine", "Biceps", "Technogym machine", "Elbow flexion", "Pull"),
  ex("cable-curl", "Cable Biceps Curl", "Biceps", "Cable", "Elbow flexion", "Pull", { increment: 2.5 }),
  ex("cable-hammer-curl", "Cable Hammer Curl (rope)", "Biceps", "Cable", "Elbow flexion", "Pull", { increment: 2.5 }),
  ex("cable-row", "Cable Seated Row", "Back", "Cable", "Horizontal pull", "Pull"),
  ex("cable-face-pull", "Cable Face Pull", "Shoulders", "Cable", "Rear delt", "Pull", { increment: 2.5 }),
  ex("db-row", "One-Arm Dumbbell Row", "Back", "Dumbbell", "Horizontal pull", "Pull"),
  ex("db-curl", "Dumbbell Curl", "Biceps", "Dumbbell", "Elbow flexion", "Pull", { increment: 2.5 }),
  ex("db-hammer-curl", "Dumbbell Hammer Curl", "Biceps", "Dumbbell", "Elbow flexion", "Pull", { increment: 2.5 }),
  ex("pullup", "Assisted Pull-up", "Back", "Bodyweight", "Vertical pull", "Pull", { caution: "Hanging stretches the shoulder. Use assistance and stay in control at the top and bottom." }),
  // Legs
  ex("tg-leg-press", "Leg Press", "Quads", "Technogym machine", "Squat", "Legs", { increment: 10 }),
  ex("tg-leg-extension", "Leg Extension", "Quads", "Technogym machine", "Knee extension", "Legs"),
  ex("tg-seated-leg-curl", "Seated Leg Curl", "Hamstrings", "Technogym machine", "Knee flexion", "Legs"),
  ex("tg-lying-leg-curl", "Lying Leg Curl", "Hamstrings", "Technogym machine", "Knee flexion", "Legs"),
  ex("tg-calf-raise", "Calf Raise Machine", "Calves", "Technogym machine", "Calf raise", "Legs", { increment: 10 }),
  ex("tg-glute-drive", "Glute Drive / Hip Thrust", "Glutes", "Technogym machine", "Hip extension", "Legs", { increment: 10 }),
  ex("tg-hack-squat", "Hack Squat / Squat Machine", "Quads", "Technogym machine", "Squat", "Legs", { increment: 10 }),
  ex("tg-adductor", "Adductor Machine", "Glutes", "Technogym machine", "Hip adduction", "Legs"),
  ex("tg-abductor", "Abductor Machine", "Glutes", "Technogym machine", "Hip abduction", "Legs"),
  ex("db-rdl", "Dumbbell Romanian Deadlift", "Hamstrings", "Dumbbell", "Hinge", "Legs"),
  ex("db-split-squat", "Dumbbell Split Squat", "Quads", "Dumbbell", "Lunge", "Legs"),
  ex("goblet-squat", "Goblet Squat", "Quads", "Dumbbell", "Squat", "Legs"),
  ex("bb-squat", "Barbell Back Squat", "Quads", "Barbell", "Squat", "Legs", { caution: "Holding the bar puts the shoulder in external rotation. The squat machine or leg press is gentler." }),
  ex("bodyweight-lunge", "Walking Lunge", "Quads", "Bodyweight", "Lunge", "Legs"),
  // Core
  ex("cable-crunch", "Cable Crunch", "Core", "Cable", "Trunk flexion", "Core"),
  ex("tg-ab-crunch", "Abdominal Crunch Machine", "Core", "Technogym machine", "Trunk flexion", "Core"),
  ex("plank", "Plank", "Core", "Bodyweight", "Anti-extension", "Core"),
  ex("dead-bug", "Dead Bug", "Core", "Bodyweight", "Anti-extension", "Core"),
  // Cardio
  ex("bike", "Bike", "Cardio", "Cardio machine", "Cycling", "Cardio"),
  ex("incline-walk", "Incline Walk", "Cardio", "Cardio machine", "Walking", "Cardio"),
  ex("elliptical", "Elliptical", "Cardio", "Cardio machine", "Elliptical", "Cardio"),
  ex("outdoor-walk", "Outdoor Walk", "Cardio", "Bodyweight", "Walking", "Cardio"),
];

export const CARDIO_OPTIONS = ["Bike", "Incline Walk", "Elliptical", "Outdoor Walk"];

// One prescribed exercise in a workout.
export type PlanItem = { key: string; sets: number; repLow: number; repHigh: number; rest: number };

export type TemplateDef = { code: string; name: string; focus: string; items: PlanItem[]; cardio: { min: number; max: number; options: string[] } };

const COMPOUND = 120, ISOLATION = 75;
const p = (key: string, sets: number, repLow: number, repHigh: number, rest = ISOLATION): PlanItem => ({ key, sets, repLow, repHigh, rest });

export const TEMPLATES: TemplateDef[] = [
  { code: "push_a", name: "Push A", focus: "Chest", cardio: { min: 10, max: 15, options: ["Bike", "Incline Walk"] }, items: [
    p("tg-bio-chest-press", 3, 8, 12, COMPOUND), p("tg-incline-press", 3, 8, 12, COMPOUND), p("tg-pec-deck", 2, 12, 15), p("tg-lateral-raise", 3, 12, 15), p("cable-pushdown", 3, 10, 15),
  ] },
  { code: "pull_a", name: "Pull A", focus: "Lats", cardio: { min: 10, max: 15, options: ["Bike", "Elliptical"] }, items: [
    p("tg-bio-lat-pulldown", 3, 8, 12, COMPOUND), p("tg-seated-row", 3, 8, 12, COMPOUND), p("tg-high-row", 2, 10, 12), p("tg-reverse-pec-deck", 3, 12, 15), p("cable-curl", 3, 10, 15),
  ] },
  { code: "legs_a", name: "Legs A", focus: "Quads", cardio: { min: 10, max: 15, options: ["Bike"] }, items: [
    p("tg-leg-press", 3, 8, 12, COMPOUND), p("tg-leg-extension", 3, 10, 15), p("tg-seated-leg-curl", 3, 10, 15), p("tg-calf-raise", 3, 12, 15), p("cable-crunch", 2, 12, 15),
  ] },
  { code: "push_b", name: "Push B", focus: "Shoulders and upper chest", cardio: { min: 10, max: 15, options: ["Incline Walk", "Bike"] }, items: [
    p("tg-incline-press", 3, 8, 12, COMPOUND), p("tg-shoulder-press", 2, 8, 12, COMPOUND), p("tg-chest-press", 2, 10, 12, COMPOUND), p("cable-lateral-raise", 3, 12, 15), p("tg-triceps-ext", 3, 10, 15),
  ] },
  { code: "pull_b", name: "Pull B", focus: "Back thickness and arms", cardio: { min: 10, max: 15, options: ["Bike", "Elliptical"] }, items: [
    p("tg-chest-supported-row", 3, 8, 12, COMPOUND), p("tg-neutral-pulldown", 3, 10, 12, COMPOUND), p("tg-rear-delt", 3, 12, 15), p("tg-biceps-curl", 3, 10, 12), p("cable-hammer-curl", 2, 12, 15),
  ] },
  { code: "legs_b", name: "Legs B", focus: "Posterior chain", cardio: { min: 10, max: 15, options: ["Bike"] }, items: [
    p("tg-seated-leg-curl", 3, 8, 12), p("tg-glute-drive", 3, 8, 12, COMPOUND), p("tg-hack-squat", 3, 10, 12, COMPOUND), p("tg-calf-raise", 3, 12, 15), p("tg-ab-crunch", 2, 12, 15),
  ] },
];

export const RECOVERY_CARDIO = { min: 20, max: 30, options: ["Outdoor Walk", "Bike"] };
