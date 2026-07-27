export const loadEffectImage = async (
  url: string,
): Promise<CanvasImageSource> => {
  if (typeof createImageBitmap === "function") {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Unable to load effect asset: ${url}`);
    return createImageBitmap(await response.blob());
  }

  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error(`Unable to load effect asset: ${url}`));
    image.src = url;
  });
};

export const closeEffectImage = (image: CanvasImageSource) => {
  if (typeof ImageBitmap !== "undefined" && image instanceof ImageBitmap) {
    image.close();
  }
};
