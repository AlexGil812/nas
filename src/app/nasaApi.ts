export async function fetchNasaPhotos(): Promise<Array<{src: string; alt: string; description: string; date: string; copyright?: string; hdurl?: string}>> {
  const API_KEY = process.env.NEXT_PUBLIC_NASA_API_KEY || "DEMO_KEY";
  const url = `https://api.nasa.gov/planetary/apod?api_key=${API_KEY}&count=6`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to fetch NASA photos: ${res.status} ${res.statusText} - ${errorText}`);
    }
    const data = await res.json();
    // Only use images, not videos
    return data.filter((item: any) => item.media_type === "image").map((item: any) => ({
      src: item.url,
      alt: item.title || "NASA Photo",
      description: item.explanation || "No description available.",
      date: item.date || "",
      copyright: item.copyright,
      hdurl: item.hdurl
    }));
  } catch (err) {
    console.error("NASA API fetch error:", err);
    throw err;
  }
}

// Add this helper to fetch a single APOD by date (YYYY-MM-DD)
export async function fetchNasaPhotoByDate(date: string) {
  const API_KEY = process.env.NEXT_PUBLIC_NASA_API_KEY || "DEMO_KEY";
  const url = `https://api.nasa.gov/planetary/apod?api_key=${API_KEY}&date=${encodeURIComponent(
    date
  )}`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch APOD for ${date}: ${res.status} ${res.statusText} - ${text}`);
  }
  const data = await res.json();
  // return only when it's an image
  if (data.media_type !== "image") throw new Error("APOD for this date is not an image");
  return data;
}
