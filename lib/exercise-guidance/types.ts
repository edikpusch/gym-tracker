export type ExerciseGuidanceRenderer =
  | "animation"
  | "video"
  | "image-sequence"
  | "illustration"
  | "custom";

export type ExerciseGuidanceMedia = {
  renderer: ExerciseGuidanceRenderer;
  sourceId: string;
  posterId?: string;
  alt: string;
  aspectRatio?: `${number}/${number}`;
  loop?: boolean;
};

export type ExerciseGuidance = {
  key: string;
  revision: number;
  status: "draft" | "published";
  title: string;
  media?: ExerciseGuidanceMedia;
  setup?: string[];
  execution?: string[];
  cues?: string[];
  warnings?: string[];
};
