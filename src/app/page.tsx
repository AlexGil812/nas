
"use client";
import { useState, useEffect } from "react";
import { fetchNasaPhotos } from "./nasaApi";

export default function Home() {
  const [selected, setSelected] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [nasaImages, setNasaImages] = useState<Array<{src: string; alt: string}>>([]);

  // Smooth scroll handler
  const handleSmoothScroll = (id: string) => {
    setMenuOpen(false);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Infinite NASA photo loading every 10 seconds
  useEffect(() => {
    let isMounted = true;
    // Initial fetch
    fetchNasaPhotos().then(images => {
      if (isMounted) setNasaImages(images);
    }).catch(() => setNasaImages([]));

    // Interval fetch
    const interval = setInterval(() => {
      fetchNasaPhotos().then(images => {
        if (isMounted) setNasaImages(prev => [...prev, ...images]);
      });
    }, 10000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-100 to-gray-300 dark:from-gray-900 dark:to-gray-800 flex flex-col items-center py-0 px-0">
      {/* Burger Menu */}
      <header className="w-full flex items-center justify-between px-6 py-4 bg-gray-50 dark:bg-gray-900 shadow-md">
        <h1 className="text-2xl font-bold text-gray-700 dark:text-gray-200 tracking-tight">Monotone Photo Gallery</h1>
        <button
          className="md:hidden flex flex-col justify-center items-center w-10 h-10 rounded focus:outline-none"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <span className={`block w-7 h-1 bg-gray-700 dark:bg-gray-200 rounded transition-all duration-300 ${menuOpen ? 'rotate-45 translate-y-2' : ''}`}></span>
          <span className={`block w-7 h-1 bg-gray-700 dark:bg-gray-200 rounded my-1 transition-all duration-300 ${menuOpen ? 'opacity-0' : ''}`}></span>
          <span className={`block w-7 h-1 bg-gray-700 dark:bg-gray-200 rounded transition-all duration-300 ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`}></span>
        </button>
        <nav className="hidden md:flex gap-8">
          <a href="#gallery" className="text-gray-700 dark:text-gray-200 hover:underline">Gallery</a>
          <a href="#contact" className="text-gray-700 dark:text-gray-200 hover:underline">Contact</a>
        </nav>
      </header>
      {/* Mobile Menu */}
      {menuOpen && (
        <nav className="md:hidden w-full bg-gray-100 dark:bg-gray-900 flex flex-col items-center py-4 gap-4 border-b border-gray-300 dark:border-gray-700">
          <a
            href="#gallery"
            className="text-gray-700 dark:text-gray-200 hover:underline"
            onClick={e => {
              e.preventDefault();
              handleSmoothScroll("gallery");
            }}
          >Gallery</a>
          <a
            href="#contact"
            className="text-gray-700 dark:text-gray-200 hover:underline"
            onClick={e => {
              e.preventDefault();
              handleSmoothScroll("contact");
            }}
          >Contact</a>
        </nav>
      )}

      {/* Gallery Section */}
      <section id="gallery" className="flex flex-col items-center justify-center py-12 px-4 w-full">
        <h2 className="text-3xl font-bold mb-8 text-gray-700 dark:text-gray-200 tracking-tight md:hidden">Gallery</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 w-full max-w-5xl">
          {nasaImages.length === 0 ? (
            <div className="col-span-3 text-center text-gray-500 dark:text-gray-400">Loading NASA photos...</div>
          ) : (
            nasaImages.map((img, idx) => (
              <button
                key={img.src + '-' + idx}
                className="group relative overflow-hidden rounded-xl shadow-lg focus:outline-none focus:ring-2 focus:ring-gray-500"
                onClick={() => setSelected(idx)}
                aria-label={`View ${img.alt}`}
              >
                <img
                  src={img.src}
                  alt={img.alt}
                  className="w-full h-64 object-cover grayscale group-hover:scale-105 group-hover:grayscale-0 transition-all duration-300 ease-in-out"
                />
                <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/60 to-transparent p-4">
                  <span className="text-white text-lg font-medium drop-shadow">{img.alt}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </section>

      {/* Modal for enlarged image */}
      {selected !== null && nasaImages[selected] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm transition-all"
          onClick={() => setSelected(null)}
        >
          <div
            className="relative bg-gray-900 rounded-xl shadow-2xl p-6 max-w-2xl w-full flex flex-col items-center"
            onClick={e => e.stopPropagation()}
          >
            <img
              src={nasaImages[selected].src}
              alt={nasaImages[selected].alt}
              className="w-full h-[400px] object-cover rounded-lg grayscale"
            />
            <span className="mt-4 text-white text-xl font-semibold">{nasaImages[selected].alt}</span>
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

      {/* Contact Section */}
      <section id="contact" className="w-full max-w-xl mx-auto mt-16 mb-12 bg-gray-50 dark:bg-gray-900 rounded-xl shadow-lg p-8">
        <h2 className="text-2xl font-bold mb-4 text-gray-700 dark:text-gray-200">Send Your Photo</h2>
        <form className="flex flex-col gap-4">
          <input
            type="email"
            required
            placeholder="Your Email"
            className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
          />
          <input
            type="file"
            accept="image/*"
            required
            className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
          />
          <textarea
            placeholder="Message (optional)"
            className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
            rows={3}
          />
          <button
            type="submit"
            className="mt-2 px-6 py-2 rounded bg-gray-700 dark:bg-gray-200 text-white dark:text-gray-900 font-semibold hover:bg-gray-900 dark:hover:bg-gray-300 transition"
            disabled
            title="Form submission requires backend integration."
          >
            Send Photo (Coming Soon)
          </button>
        </form>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">* Form submission will send your photo via email (feature coming soon).</p>
      </section>
    </div>
  );
}
