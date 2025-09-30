"use client";
import { useEffect, useRef, useState } from "react";
import { fetchNasaPhotos, fetchNasaPhotoByDate } from "./nasaApi";

type NasaImage = {
  src: string;
  alt: string;
  date?: string;
  copyright?: string;
  hdurl?: string;
  explanation?: string;
};

export default function Home() {
  const [selected, setSelected] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [nasaImages, setNasaImages] = useState<NasaImage[]>([]);
  const trackRef = useRef<HTMLDivElement | null>(null);

  // Search state (Apple-like glass control)
  const [searchQuery, setSearchQuery] = useState<string>("");
  const clearSearch = () => setSearchQuery("");

  useEffect(() => {
    const track = document.getElementById("image-track");
    if (!track) return;

    // initialize dataset values
    track.dataset.mouseDownAt = "0";
    track.dataset.prevPercentage = "0";
    track.dataset.percentage = "0";

    const handleOnDown = (e: MouseEvent | Touch) => {
      const clientX = (e as MouseEvent).clientX ?? (e as Touch).clientX;
      track.dataset.mouseDownAt = String(clientX);
    };

    const handleOnUp = () => {
      track.dataset.mouseDownAt = "0";
      track.dataset.prevPercentage = track.dataset.percentage ?? "0";
    };

    const handleOnMove = (e: MouseEvent | Touch) => {
      if (track.dataset.mouseDownAt === "0") return;

      const clientX = (e as MouseEvent).clientX ?? (e as Touch).clientX;
      const mouseDelta = parseFloat(track.dataset.mouseDownAt ?? "0") - clientX;
      const maxDelta = window.innerWidth / 2;

      const percentage = (mouseDelta / maxDelta) * -100;
      const nextPercentageUnconstrained = parseFloat(track.dataset.prevPercentage ?? "0") + percentage;
      const nextPercentage = Math.max(Math.min(nextPercentageUnconstrained, 0), -100);

      track.dataset.percentage = String(nextPercentage);

      track.animate(
        { transform: `translate(${nextPercentage}%, -50%)` },
        { duration: 1200, fill: "forwards" }
      );

      const images = Array.from(track.getElementsByClassName("image")) as HTMLImageElement[];
      for (const image of images) {
        image.animate(
          { objectPosition: `${100 + nextPercentage}% center` },
          { duration: 1200, fill: "forwards" }
        );
      }
    };

    const onMouseDown = (e: MouseEvent) => handleOnDown(e);
    const onTouchStart = (e: TouchEvent) => handleOnDown(e.touches[0]);
    const onMouseUp = () => handleOnUp();
    const onTouchEnd = (e: TouchEvent) => handleOnUp();
    const onMouseMove = (e: MouseEvent) => handleOnMove(e);
    const onTouchMove = (e: TouchEvent) => handleOnMove(e.touches[0]);

    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("touchmove", onTouchMove, { passive: true });

    // support mouse wheel / trackpad horizontal scrolling (and vertical => horizontal)
    const onWheel = (e: WheelEvent) => {
      // allow touchpad/wheel to nudge the track; prevent page scroll
      e.preventDefault();
      const delta = e.deltaY || e.deltaX;
      const maxDelta = window.innerWidth / 2;

      // smaller multiplier for subtle movement (tweak scale to taste)
      const stepPercent = (delta / maxDelta) * -8;
      const prev = parseFloat(track.dataset.percentage ?? "0");
      const next = Math.max(Math.min(prev + stepPercent, 0), -100);
      track.dataset.percentage = String(next);

      // faster, shorter animation for wheel input
      track.animate({ transform: `translate(${next}%, -50%)` }, { duration: 300, fill: "forwards" });
      const images = Array.from(track.getElementsByClassName("image")) as HTMLImageElement[];
      for (const image of images) {
        image.animate({ objectPosition: `${100 + next}% center` }, { duration: 300, fill: "forwards" });
      }
    };
    window.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("wheel", onWheel);
    };
  }, [nasaImages.length]);

  const [fetchError, setFetchError] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const playRef = useRef<number | null>(null);
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const seenRef = useRef<Set<string>>(new Set());
  const timeoutRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const [datePicker, setDatePicker] = useState<string>("");

  // mouse-driven horizontal gallery refs & RAF
  const galleryRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);

  // smooth animation state
  const targetTxRef = useRef(0);
  const currentTxRef = useRef(0);
  // even slower easing for calmer motion
  const easingRef = useRef(0.015);
  // lower sensitivity so pointer moves produce smaller track movement
  const sensitivityRef = useRef(0.4);
  // width of a single copy when we render 3 copies for seamless looping
  const singleWidthRef = useRef(0);
  const isAnimatingRef = useRef(false);

  const runAnimation = () => {
    if (!trackRef.current) return;
    const diff = targetTxRef.current - currentTxRef.current;
    // tighter threshold so animation finishes smoothly
    if (Math.abs(diff) < 0.08) {
      currentTxRef.current = targetTxRef.current;
      trackRef.current.style.transform = `translateX(${Math.round(currentTxRef.current)}px)`;
      isAnimatingRef.current = false;
      return;
    }
    // apply easing, but cap per-frame movement so very large jumps are softened
    const step = diff * easingRef.current;
    const maxStep = 40; // smaller max step for calmer motion
    currentTxRef.current += Math.max(-maxStep, Math.min(maxStep, step));
    trackRef.current.style.transform = `translateX(${Math.round(currentTxRef.current)}px)`;
    isAnimatingRef.current = true;
    rafRef.current = requestAnimationFrame(runAnimation);
  };

  const setTargetFromPointer = (clientX: number) => {
    if (!galleryRef.current || !trackRef.current) return;
    const rect = galleryRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const ratio = rect.width === 0 ? 0.5 : x / rect.width;
    // use single-copy width so movement stays in center copy and looks infinite
    const singleWidth = singleWidthRef.current || Math.max(0, trackRef.current.scrollWidth / 3);
    const singleMaxTranslate = Math.max(0, singleWidth - rect.width);
    // keep a little padding at edges so items aren't flush to the edge
    const padding = 48;
    const adjRatio = Math.min(1, Math.max(0, ratio * sensitivityRef.current));
    // anchor movement inside the middle copy: base at -singleWidth
    const tx = -singleWidth - Math.round(singleMaxTranslate * adjRatio) + padding;
    const minTx = -singleWidth - singleMaxTranslate - padding;
    const maxTx = -singleWidth + padding;
    targetTxRef.current = Math.min(maxTx, Math.max(minTx, tx));
    if (!isAnimatingRef.current) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(runAnimation);
    }
  };

  // center track on load / when images change
  useEffect(() => {
    if (!galleryRef.current || !trackRef.current) return;
    const rect = galleryRef.current.getBoundingClientRect();
    const total = trackRef.current.scrollWidth;
    const single = total / 3 || 0;
    singleWidthRef.current = single;
    // place the visible area over the middle copy
    const center = -Math.round(single);
    targetTxRef.current = center;
    currentTxRef.current = center;
    if (trackRef.current) trackRef.current.style.transform = `translateX(${center}px)`;
  }, [nasaImages.length]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // initialize dark mode from localStorage / OS pref
  useEffect(() => {
    try {
      const stored = localStorage.getItem("dark");
      if (stored != null) setDarkMode(stored === "1");
      else setDarkMode(window.matchMedia && window.matchMedia("(prefers-color-scheme:dark)").matches);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    // apply dark mode in multiple ways so it works even if Tailwind config wasn't updated yet
    try {
      if (darkMode) {
        document.documentElement.classList.add("dark");
        document.documentElement.setAttribute("data-theme", "dark");
        document.body.setAttribute("data-theme", "dark");
      } else {
        document.documentElement.classList.remove("dark");
        document.documentElement.setAttribute("data-theme", "light");
        document.body.setAttribute("data-theme", "light");
      }
      localStorage.setItem("dark", darkMode ? "1" : "0");
    } catch {}
  }, [darkMode]);

  // fetch APOD by date and prepend (handles dedupe + validation)
  const fetchByDate = async (d: string) => {
    if (!d) {
      setFetchError("Please choose a date.");
      return;
    }

    // API supported range: Jun 16, 1995 -> today (or API max)
    const MIN_DATE = "1995-06-16";
    const MAX_DATE = new Date().toISOString().slice(0, 10); // today, e.g. "2025-09-20"

    if (d < MIN_DATE || d > MAX_DATE) {
      setFetchError(`Date must be between ${MIN_DATE} and ${MAX_DATE}.`);
      return;
    }

    try {
      const data = await fetchNasaPhotoByDate(d);
      const src = data.url || data.hdurl;
      if (!src) throw new Error("No image URL returned");
      if (seenRef.current.has(src)) {
        setFetchError("This image is already in the gallery.");
        return;
      }
      seenRef.current.add(src);
      const mapped: NasaImage = {
        src,
        alt: data.title || "APOD",
        date: data.date,
        copyright: data.copyright,
        hdurl: data.hdurl,
        explanation: data.explanation,
      };
      setNasaImages((prev) => [mapped, ...prev]);
      setFetchError(null);
    } catch (err: any) {
      console.error(err);
      // show friendly message (use server error details if available)
      setFetchError(err?.message || "Failed to fetch by date");
    }
  };

  // autoplay slideshow (4s per image) when isPlaying is true
  useEffect(() => {
    if (!isPlaying) {
      if (playRef.current) {
        clearInterval(playRef.current);
        playRef.current = null;
      }
      return;
    }
    playRef.current = window.setInterval(() => {
      setSelected((s) => {
        if (nasaImages.length === 0) return s;
        if (s === null) return 0;
        return Math.min(nasaImages.length - 1, s + 1);
      });
    }, 4000);
    return () => {
      if (playRef.current) {
        clearInterval(playRef.current);
        playRef.current = null;
      }
    };
  }, [isPlaying, nasaImages.length]);

  // load favorites from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("nasa_favs");
      if (raw) setFavorites(JSON.parse(raw));
    } catch {
      setFavorites({});
    }
  }, []);

  const saveFavorites = (next: Record<string, boolean>) => {
    setFavorites(next);
    try {
      localStorage.setItem("nasa_favs", JSON.stringify(next));
    } catch {}
  };

  const toggleFavorite = (src: string) => {
    const next = { ...favorites };
    if (next[src]) delete next[src];
    else next[src] = true;
    saveFavorites(next);
  };

  // Smooth scroll handler
  const handleSmoothScroll = (id: string) => {
    setMenuOpen(false);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  // Fetch loop using setTimeout (10s) with deduplication
  useEffect(() => {
    mountedRef.current = true;

    const fetchLoop = async () => {
      try {
        const imagesRaw = await fetchNasaPhotos();
        setFetchError(null);
        // normalize and dedupe
        const mapped: NasaImage[] = imagesRaw
          .map((it: any) => ({
            src: it.url || it.src || it.hdurl || "",
            alt: it.title || it.alt || "NASA photo",
            date: it.date,
            copyright: it.copyright,
            hdurl: it.hdurl,
            explanation: it.explanation,
          }))
          .filter((it: NasaImage) => it.src) // remove invalid
          .filter((it: NasaImage) => {
            if (seenRef.current.has(it.src)) return false;
            seenRef.current.add(it.src);
            return true;
          });

        if (mountedRef.current && mapped.length > 0) {
          setNasaImages((prev) => [...prev, ...mapped]);
        }
      } catch (err: any) {
        console.error("NASA fetch error:", err);
        setFetchError(typeof err === "string" ? err : err?.message || "Failed to fetch NASA photos");
      } finally {
        // schedule next fetch if still mounted
        if (mountedRef.current) {
          timeoutRef.current = window.setTimeout(fetchLoop, 10000);
        }
      }
    };

    // initial start
    fetchLoop();

    return () => {
      mountedRef.current = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // Modal keyboard controls
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (selected === null) return;
      if (e.key === "Escape") setSelected(null);
      if (e.key === "ArrowLeft") setSelected((s) => (s !== null ? Math.max(0, s - 1) : s));
      if (e.key === "ArrowRight") setSelected((s) => (s !== null ? Math.min(nasaImages.length - 1, s + 1) : s));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, nasaImages.length]);

  // utility: download favorites as JSON
  const downloadFavoritesJSON = () => {
    const favImgs = nasaImages.filter((img) => favorites[img.src]);
    const blob = new Blob([JSON.stringify(favImgs, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "nasa-favorites.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // utility: copy image link to clipboard
  const copyImageLink = async (url?: string) => {
    if (!url) return alert("No image URL available");
    try {
      await navigator.clipboard.writeText(url);
      alert("Image URL copied to clipboard");
    } catch {
      alert("Copy failed");
    }
  };

  // prefetch HD image on hover
  const prefetchHd = (url?: string) => {
    if (!url) return;
    const link = document.createElement("link");
    link.rel = "prefetch";
    link.href = url;
    link.as = "image";
    document.head.appendChild(link);
    setTimeout(() => {
      try {
        document.head.removeChild(link);
      } catch {}
    }, 60_000);
  };

  // ---- Notifications (simple toast system) ----
  type Notif = { id: number; message: string; type?: "info" | "error" | "warning" };
  const [notifications, setNotifications] = useState<Notif[]>([]);
  const nextNotifId = useRef(1);
  const pushNotification = (message: string, type: Notif["type"] = "info", duration = 6000) => {
    const id = nextNotifId.current++;
    setNotifications((n) => [...n, { id, message, type }]);
    // debug log so you can see the notification was created
    // remove/comment this in production
    // eslint-disable-next-line no-console
    console.log("pushNotification:", { id, message, type });
    if (duration > 0) {
      window.setTimeout(() => setNotifications((n) => n.filter((x) => x.id !== id)), duration);
    }
  };
  const dismissNotification = (id: number) => setNotifications((n) => n.filter((x) => x.id !== id));

  // show a slow-load notification if initial images haven't arrived within 1.5s
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (nasaImages.length === 0) {
        // directly push (safe from stale closures) and ensure visibility
        pushNotification(
          "Images may take a while to load — this can be due to network speed or the NASA API. They will appear automatically.",
          "info",
          10000
        );
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [nasaImages.length, pushNotification]);
  // ---------------------------------------------

  // filter images by search query (move this out of JSX)
  const filteredImages = nasaImages.filter((img: NasaImage) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (img.alt ?? "").toLowerCase().includes(q) || (img.date ?? "").includes(q);
  });

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center py-6 px-0">
      {/* Notifications (toasts) - inline styles so they always show even if Tailwind not applied */}
      <div style={{ position: "fixed", top: 16, right: 16, zIndex: 9999, display: "flex", flexDirection: "column", gap: 12 }}>
        {notifications.map((n) => (
          <div
            key={n.id}
            role="status"
            aria-live="polite"
            style={{
              maxWidth: 360,
              padding: "12px 16px",
              borderRadius: 10,
              boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
              background: n.type === "error" ? "linear-gradient(90deg,#ef4444,#dc2626)" : "rgba(255,255,255,0.06)",
              color: n.type === "error" ? "#fff" : "#fff",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div style={{ fontSize: 13, lineHeight: "1.2" }}>{n.message}</div>
            <button onClick={() => dismissNotification(n.id)} style={{ color: "rgba(255,255,255,0.85)", background: "transparent", border: 0, cursor: "pointer", fontSize: 16 }}>✕</button>
          </div>
        ))}
      </div>

      {/* Burger Menu */}
      <header className="w-full flex items-center justify-between px-6 py-4 bg-transparent backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-white tracking-tight">Monotone Photo Gallery</h1>
          {/* Apple-like search */}
          <div className="ml-4">
            <div className="relative">
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search title or date (YYYY‑MM‑DD)"
                aria-label="Search images"
                className="w-72 md:w-96 px-4 py-2 rounded-lg bg-white/6 text-white placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-white/20 backdrop-blur-sm"
              />
              {searchQuery && (
                <button
                  onClick={clearSearch}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-white/80 hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            className="md:hidden flex flex-col justify-center items-center w-10 h-10 rounded focus:outline-none"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            <span className={`block w-7 h-1 bg-gray-700 dark:bg-gray-200 rounded transition-all duration-300 ${menuOpen ? 'rotate-45 translate-y-2' : ''}`}></span>
            <span className={`block w-7 h-1 bg-gray-700 dark:bg-gray-200 rounded my-1 transition-all duration-300 ${menuOpen ? 'opacity-0' : ''}`}></span>
            <span className={`block w-7 h-1 bg-gray-700 dark:bg-gray-200 rounded transition-all duration-300 ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`}></span>
          </button>

          <button
            className="hidden md:inline-flex items-center gap-2 px-3 py-1 rounded bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-700"
            onClick={() => setIsPlaying((s) => !s)}
            title="Play / Pause slideshow"
          >
            {isPlaying ? "Pause" : "Play"}
          </button>

          <button
            className="hidden md:inline-flex items-center gap-2 px-3 py-1 rounded bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-700"
            onClick={() => setShowFavoritesOnly((s) => !s)}
            title="Toggle favorites view"
          >
            {showFavoritesOnly ? "All photos" : "Favorites"} <span className="text-sm text-gray-500">({Object.keys(favorites).length})</span>
          </button>

          <button
            className="hidden md:inline-flex px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-sm"
            onClick={downloadFavoritesJSON}
            title="Download favorites JSON"
          >
            Export
          </button>

          <button
            className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
            onClick={() => setDarkMode((d) => !d)}
            title="Toggle dark mode"
          >
            {darkMode ? "🌙" : "☀️"}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={datePicker}
            onChange={(e) => setDatePicker(e.target.value)}
            min="1995-06-16"
            max={new Date().toISOString().slice(0, 10)}
            className="px-2 py-1 rounded bg-white dark:bg-gray-800 text-sm"
            title="Choose a date (APOD)"
          />
          <button
            onClick={() => fetchByDate(datePicker)}
            className="px-3 py-1 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-sm"
          >
            Fetch APOD
          </button>
        </div>
         <nav className="hidden md:flex gap-8">
           <a href="#gallery" className="text-gray-700 dark:text-gray-200 hover:underline">Gallery</a>
         </nav>
       </header>

      {/* Mobile Menu */}
      {menuOpen && (
        <nav className="md:hidden w-full bg-gray-100 dark:bg-gray-900 flex flex-col items-center py-4 gap-4 border-b border-gray-300 dark:border-gray-700">
          <a
            href="#gallery"
            className="text-gray-700 dark:text-gray-200 hover:underline"
            onClick={(e) => {
              e.preventDefault();
              handleSmoothScroll("gallery");
            }}
          >
            Gallery
          </a>
        </nav>
      )}

      {/* optional error banner */}
      {fetchError && (
        <div className="w-full max-w-5xl mt-4 px-6">
          <div className="rounded-md bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 p-3 text-sm">
            {fetchError}
          </div>
        </div>
      )}

      {/* Mouse-driven horizontal gallery (images move with pointer) */}
      <section id="gallery" className="w-full relative h-screen">
        {/* container removed to allow full-screen image-track layout */}
        <div id="image-track" ref={trackRef}>
          {filteredImages.length === 0 ? (
            <div className="min-h-[120px] flex items-center justify-center text-gray-400 px-6">Loading NASA photos...</div>
          ) : (
            filteredImages.map((img: NasaImage, idx: number) => (
              <img
                key={`${img.src}-${idx}`}
                src={img.src}
                alt={img.alt}
                className="image"
                onClick={() => setSelected(idx)}
                onMouseEnter={() => prefetchHd?.(img.hdurl)}
                loading="lazy"
              />
            ))
          )}
        </div>
      </section>

      {/* Modal for enlarged image */}
      {selected !== null && nasaImages[selected] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm transition-all p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="modal-panel relative rounded-xl shadow-2xl p-6 max-w-4xl w-full flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-grid w-full">
              <div className="modal-visual">
                <img
                  src={nasaImages[selected].hdurl || nasaImages[selected].src}
                  alt={nasaImages[selected].alt}
                  className="w-full modal-visual-img rounded-lg object-contain max-h-[80vh] bg-black/5"
                />
              </div>
              <div className="p-2">
                <h3 className="text-2xl font-bold mb-2">{nasaImages[selected].alt}</h3>
                <div className="kicker mb-4">{nasaImages[selected].date} {nasaImages[selected].copyright ? `• © ${nasaImages[selected].copyright}` : ""}</div>
                <p className="text-sm text-gray-400">{nasaImages[selected].explanation}</p>
                <div className="flex gap-3 mt-4">
                  <a className="btn btn-primary" href={nasaImages[selected].hdurl || nasaImages[selected].src} target="_blank" rel="noreferrer">Open HD</a>
                  <a className="btn btn-ghost" href={nasaImages[selected].src} download>Download</a>
                </div>
              </div>
            </div>

            <button
              className="absolute top-2 right-2 text-white bg-gray-700 rounded-full px-3 py-1 hover:bg-gray-600 transition"
              onClick={() => setSelected(null)}
              aria-label="Close"
            >
              &times;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
