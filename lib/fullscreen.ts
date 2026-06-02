type OrientationLockType = "landscape" | "landscape-primary" | "landscape-secondary";

type ScreenOrientationWithLock = ScreenOrientation & {
  lock?: (orientation: OrientationLockType) => Promise<void>;
};

export async function enterPresentationFullscreen(element: HTMLElement) {
  if (!document.fullscreenElement && element.requestFullscreen) {
    await element.requestFullscreen();
  }
  await lockLandscapeOrientation();
}

export async function exitPresentationFullscreen() {
  unlockLandscapeOrientation();
  if (document.fullscreenElement && document.exitFullscreen) {
    await document.exitFullscreen();
  }
}

async function lockLandscapeOrientation() {
  const orientation = screen.orientation as ScreenOrientationWithLock | undefined;
  if (!orientation?.lock) return;

  const modes: OrientationLockType[] = [
    "landscape",
    "landscape-primary",
    "landscape-secondary",
  ];

  for (const mode of modes) {
    try {
      await orientation.lock(mode);
      return;
    } catch {
      // Not supported on this device or without fullscreen gesture
    }
  }
}

function unlockLandscapeOrientation() {
  try {
    screen.orientation.unlock();
  } catch {
    // ignore when unlock is unavailable
  }
}
