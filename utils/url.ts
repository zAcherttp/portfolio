export const getDomainName = (url: string): string => {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
};

export const fetchFaviconBlob = async (domain: string): Promise<string> => {
  const url = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  return new Promise((resolve) => {
    const img = new Image();
    img.src = url;
    img.onload = () => resolve(url);
    img.onerror = () => resolve(url);
  });
};
