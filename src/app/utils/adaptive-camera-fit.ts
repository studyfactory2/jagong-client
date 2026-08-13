const CAMERA_FIT_ATTRIBUTE = "cameraFit";
const PORTRAIT_LIKE_RATIO = 1.15;
const LANDSCAPE_FRAME_RATIO = 1.45;
const STRONG_MISMATCH_RATIO = 0.82;

function shouldContainCameraVideo(
  sourceWidth: number,
  sourceHeight: number,
  frameWidth: number,
  frameHeight: number,
): boolean {
  if (
    sourceWidth <= 0 ||
    sourceHeight <= 0 ||
    frameWidth <= 0 ||
    frameHeight <= 0
  ) {
    return false;
  }

  const sourceRatio = sourceWidth / sourceHeight;
  const frameRatio = frameWidth / frameHeight;
  const portraitLike = sourceRatio < PORTRAIT_LIKE_RATIO;
  const stronglyMismatchedLandscape =
    frameRatio >= LANDSCAPE_FRAME_RATIO &&
    sourceRatio < frameRatio * STRONG_MISMATCH_RATIO;

  return portraitLike || stronglyMismatchedLandscape;
}

/**
 * Keeps fixed workroom cards stable while avoiding aggressive cropping for
 * portrait phone cameras and 4:3 sources shown inside wide preview frames.
 */
export function observeAdaptiveCameraFit(
  element: HTMLVideoElement,
): () => void {
  let animationFrame = 0;
  const frame = element.parentElement;

  const updateFit = () => {
    animationFrame = 0;
    const frameRect = frame?.getBoundingClientRect();
    const contain = shouldContainCameraVideo(
      element.videoWidth,
      element.videoHeight,
      frameRect?.width ?? element.clientWidth,
      frameRect?.height ?? element.clientHeight,
    );
    element.dataset[CAMERA_FIT_ATTRIBUTE] = contain ? "contain" : "cover";
  };

  const scheduleUpdate = () => {
    if (animationFrame) window.cancelAnimationFrame(animationFrame);
    animationFrame = window.requestAnimationFrame(updateFit);
  };

  element.addEventListener("loadedmetadata", scheduleUpdate);
  element.addEventListener("playing", scheduleUpdate);
  element.addEventListener("resize", scheduleUpdate);
  window.addEventListener("resize", scheduleUpdate);
  window.addEventListener("orientationchange", scheduleUpdate);

  const resizeObserver =
    typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(scheduleUpdate);
  if (frame) resizeObserver?.observe(frame);
  scheduleUpdate();

  return () => {
    if (animationFrame) window.cancelAnimationFrame(animationFrame);
    resizeObserver?.disconnect();
    element.removeEventListener("loadedmetadata", scheduleUpdate);
    element.removeEventListener("playing", scheduleUpdate);
    element.removeEventListener("resize", scheduleUpdate);
    window.removeEventListener("resize", scheduleUpdate);
    window.removeEventListener("orientationchange", scheduleUpdate);
    delete element.dataset[CAMERA_FIT_ATTRIBUTE];
  };
}
