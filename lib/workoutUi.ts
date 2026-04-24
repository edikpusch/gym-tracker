export const EXERCISE_LABELS: Record<string, string> = {
  benchpress: "Bankdruecken",
  pullups: "Klimmzuege",
  pullups_wide: "Klimmzuege breit",
  shoulderpress: "Schulterdruecken",
  dips: "Dips",
  bulgarian: "Bulgarische Split Squats",
  core: "Core",
  rows: "Rudern",
  latpulldown: "Lat Pulldown",
  biceps: "Bizeps Curls",
  rear_delt: "Rear Delt",
  squat: "Kniebeugen",
  legpress: "Beinpresse",
  legcurl: "Leg Curl",
  calves: "Waden",
  lunges: "Lunges",
  pushups: "Push-ups",
  romanian_deadlift: "Rumaenisches Kreuzheben",
  face_pulls: "Face Pulls",
  walking_lunges: "Walking Lunges",
  hanging_leg_raises: "Hanging Leg Raises",
  shoulderpress_pushups: "Schulterdruecken + Push-ups",
};

export function getExerciseLabel(exercise: string) {
  return EXERCISE_LABELS[exercise] ?? fallbackLabel(exercise);
}

function fallbackLabel(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
