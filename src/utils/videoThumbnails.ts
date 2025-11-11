export const getYouTubeId = (url: string): string | null => {
  const match = url.match(/(?:shorts\/|v=|embed\/|youtu\.be\/)([^&?\/\s]+)/);
  return match ? match[1] : null;
};

export const getYouTubeThumbnail = (url: string, quality: 'default' | 'hq' | 'maxres' = 'maxres'): string | null => {
  const videoId = getYouTubeId(url);
  if (!videoId) return null;

  const qualityMap = {
    default: 'default',
    hq: 'hqdefault',
    maxres: 'maxresdefault'
  };

  return `https://img.youtube.com/vi/${videoId}/${qualityMap[quality]}.jpg`;
};

export const getInstagramPlaceholder = (): string => {
  return 'https://via.placeholder.com/640x360/E1306C/ffffff?text=📹+Instagram';
};

export const getVideoThumbnail = (youtubeUrl?: string): string => {
  if (youtubeUrl) {
    return getYouTubeThumbnail(youtubeUrl) || getInstagramPlaceholder();
  }
  return getInstagramPlaceholder();
};
