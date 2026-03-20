// src/components/maps/MapSearchBar.tsx
//
// Geocoding search bar using OpenStreetMap Nominatim (free, no API key).
// Must be rendered inside a <MapContainer> — uses useMap() to fly to results.

import { useState, useRef, useCallback, useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { Search, X, MapPin, Loader2 } from 'lucide-react';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface NominatimResult {
  place_id:     number;
  display_name: string;
  lat:          string;
  lon:          string;
  type:         string;
  importance:   number;
}

interface MapSearchBarProps {
  placeholder?: string;
  className?:   string;
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export function MapSearchBar({
  placeholder = 'Search city, landmark, or area…',
  className   = '',
}: MapSearchBarProps) {
  const map = useMap();

  const [query,     setQuery]     = useState('');
  const [results,   setResults]   = useState<NominatimResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen,    setIsOpen]    = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef    = useRef<AbortController | null>(null);
  const inputRef    = useRef<HTMLInputElement>(null);
  const wrapperRef  = useRef<HTMLDivElement>(null);

  // ── FIX 1: Block Leaflet native events on the search bar ──
  // React stopPropagation only blocks synthetic events.
  // Leaflet listens on raw DOM events, so clicks pass right through.
  // L.DomEvent.disableClickPropagation stops it at the DOM level.
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    L.DomEvent.disableClickPropagation(el);
    L.DomEvent.disableScrollPropagation(el);
  }, []);

  // ── Close dropdown on outside click ──
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── FIX 2: Better search — no country lock, keep stale results while loading ──
  const search = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!q.trim() || q.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      // Cancel in-flight request
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();

      setIsLoading(true);
      // Do NOT clear results here — keep showing the previous list
      // while the new request is in-flight so the dropdown never flickers

      try {
        const params = new URLSearchParams({
          q:       q,
          format:  'json',
          limit:   '8',
          // Prefer India but don't restrict — countrycodes:'in' misses many places
          viewbox: '68.1,37.1,97.4,8.0',
          bounded: '0',   // prefer viewbox, fall back to global
          addressdetails: '0',
        });

        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?${params}`,
          {
            signal:  abortRef.current.signal,
            headers: { 'Accept-Language': 'en' },
          }
        );

        const data: NominatimResult[] = await res.json();
        data.sort((a, b) => b.importance - a.importance);

        if (data.length > 0) {
          // Good results — replace list
          setResults(data);
          setIsOpen(true);
        } else if (q.length <= 3) {
          // Short query with no results — clear
          setResults([]);
          setIsOpen(false);
        }
        // Longer query with no results → keep previous results visible
        // (common mid-typing scenario, e.g. "Mumba" → "Mumbai")
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== 'AbortError') {
          setResults([]);
          setIsOpen(false);
        }
      } finally {
        setIsLoading(false);
      }
    }, 400);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    search(val);
  };

  const handleSelect = (result: NominatimResult) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    map.flyTo([lat, lng], 14, { duration: 1.2 });
    setQuery(result.display_name.split(',').slice(0, 2).join(', '));
    setIsOpen(false);
    setResults([]);
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    if (abortRef.current) abortRef.current.abort();
    inputRef.current?.focus();
  };

  return (
    <div ref={wrapperRef} className={`relative z-[1100] ${className}`}>
      {/* Input */}
      <div className="flex items-center gap-2 bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
        {isLoading
          ? <Loader2 className="w-4 h-4 text-slate-400 animate-spin flex-shrink-0" />
          : <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
        }
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          className="flex-1 text-sm bg-transparent text-slate-800 dark:text-slate-100 placeholder-slate-400 outline-none min-w-0"
        />
        {query && (
          <button
            onClick={handleClear}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex-shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* FIX 3: Scrollable dropdown ── */}
      {isOpen && results.length > 0 && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="max-h-52 overflow-y-auto overscroll-contain">
            {results.map((r) => (
              <button
                key={r.place_id}
                onClick={() => handleSelect(r)}
                className="w-full flex items-start gap-2.5 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left border-b border-slate-100 dark:border-slate-800 last:border-b-0"
              >
                <MapPin className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
                <span className="text-xs text-slate-700 dark:text-slate-300 leading-snug">
                  {r.display_name}
                </span>
              </button>
            ))}
          </div>
          <p className="text-[10px] text-slate-400 text-right px-3 py-1.5 border-t border-slate-100 dark:border-slate-800">
            © OpenStreetMap contributors
          </p>
        </div>
      )}
    </div>
  );
}