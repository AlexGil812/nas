
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
