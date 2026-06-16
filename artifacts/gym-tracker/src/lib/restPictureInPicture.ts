import { registerPlugin } from "@capacitor/core";
import { supportsRestOverlay } from "@/lib/platform";

type RestPictureInPicturePlugin = {
  setEnabled(options: {
    enabled: boolean;
    exercise?: string;
    endsAt?: number;
  }): Promise<void>;
  enterNow(options: { exercise: string; endsAt: number }): Promise<void>;
  stop(): Promise<void>;
};

const RestPictureInPicture = registerPlugin<RestPictureInPicturePlugin>(
  "RestPictureInPicture"
);

export async function setRestPictureInPictureEnabled(enabled: boolean) {
  await setRestOverlayState(enabled);
}

export async function setRestOverlayState(
  enabled: boolean,
  exercise = "Pause",
  endsAt = 0
) {
  if (!supportsRestOverlay()) {
    return;
  }

  try {
    await RestPictureInPicture.setEnabled({ enabled, exercise, endsAt });
  } catch (error) {
    console.warn("RestPictureInPicture unavailable", error);
  }
}

export async function enterRestPictureInPictureNow(
  exercise: string,
  endsAt: number
) {
  if (!supportsRestOverlay()) {
    return;
  }

  try {
    await RestPictureInPicture.enterNow({ exercise, endsAt });
  } catch (error) {
    console.warn("RestPictureInPicture enterNow unavailable", error);
  }
}

export async function stopRestOverlay() {
  if (!supportsRestOverlay()) {
    return;
  }

  try {
    await RestPictureInPicture.stop();
  } catch (error) {
    console.warn("RestPictureInPicture stop unavailable", error);
  }
}
