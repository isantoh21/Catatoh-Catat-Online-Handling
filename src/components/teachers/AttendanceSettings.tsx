import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Save, Loader2, AlertCircle, CheckCircle2, MapPin, ExternalLink, Globe, ShieldCheck, Sparkles, Copy, Check, Terminal } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet's default icon path issue in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function LocationPicker({ position, setPosition }: { position: {lat: number, lng: number} | null, setPosition: any }) {
  useMapEvents({
    click(e) {
      setPosition({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });

  return position ? <Marker position={[position.lat, position.lng]} /> : null;
}

function RecenterMap({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  React.useEffect(() => {
    map.setView([lat, lng], 17);
  }, [lat, lng, map]);
  return null;
}

function FreeMapSearch({ onSelect }: { onSelect: (lat: number, lng: number) => void }) {
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<any[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setIsSearching(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`);
      const data = await res.json();
      setResults(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  return (
    <div className="absolute top-4 left-4 right-4 z-[1000] bg-white p-2 rounded-xl shadow-md border border-slate-200 backdrop-blur-sm bg-white/90">
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Cari lokasi (contoh: Jakarta, SD N 1...)"
          className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500"
        />
        <button type="button" onClick={handleSearch} disabled={isSearching} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 flex items-center justify-center">
          {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Cari'}
        </button>
      </div>
      {results.length > 0 && (
        <ul className="mt-2 max-h-48 overflow-y-auto bg-white rounded-lg border border-slate-100 shadow-sm">
          {results.map((r, i) => (
            <li
              key={i}
              className="p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-50 text-sm text-slate-700 last:border-0"
              onClick={() => {
                onSelect(parseFloat(r.lat), parseFloat(r.lon));
                setResults([]);
                setQuery('');
              }}
            >
              {r.display_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function parseGoogleMapsUrl(input: string): { lat: number; lng: number } | null {
  if (!input) return null;
  const trimmed = input.trim();

  // Pattern 1: Direct coordinates e.g. "-6.2087634, 106.845599"
  const directCoordRegex = /^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/;
  const directMatch = trimmed.match(directCoordRegex);
  if (directMatch) {
    const lat = parseFloat(directMatch[1]);
    const lng = parseFloat(directMatch[2]);
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
  }

  // Pattern 2: @lat,lng in Google Maps URL (e.g. https://www.google.com/maps/@-6.2087634,106.845599,17z)
  const atRegex = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
  const atMatch = trimmed.match(atRegex);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
    if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
  }

  // Pattern 3: Query parameter q=lat,lng or query=lat,lng or ll=lat,lng or center=lat,lng
  const paramRegex = /[?&](?:q|query|ll|center)=(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/;
  const paramMatch = trimmed.match(paramRegex);
  if (paramMatch) {
    const lat = parseFloat(paramMatch[1]);
    const lng = parseFloat(paramMatch[2]);
    if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
  }

  // Pattern 4: /place/.../@lat,lng or /place/lat,lng
  const pathRegex = /\/(?:place|destination|dir)\/(-?\d+\.\d+),(-?\d+\.\d+)/;
  const pathMatch = trimmed.match(pathRegex);
  if (pathMatch) {
    const lat = parseFloat(pathMatch[1]);
    const lng = parseFloat(pathMatch[2]);
    if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
  }

  // Pattern 5: Generic pair of decimal numbers lat, lng in string
  const genericMatch = trimmed.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
  if (genericMatch) {
    const lat = parseFloat(genericMatch[1]);
    const lng = parseFloat(genericMatch[2]);
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
  }

  return null;
}

export default function AttendanceSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [timezone, setTimezone] = useState('Asia/Jakarta');
  const [arrivalStart, setArrivalStart] = useState('06:00');
  const [arrivalEnd, setArrivalEnd] = useState('07:30');
  const [departureStart, setDepartureStart] = useState('15:00');
  const [departureEnd, setDepartureEnd] = useState('18:00');
  
  const [locationLat, setLocationLat] = useState<number | null>(null);
  const [locationLng, setLocationLng] = useState<number | null>(null);
  const [locationRadius, setLocationRadius] = useState<number>(50);
  const [faceMatchThreshold, setFaceMatchThreshold] = useState<number>(0.44);
  const [gmapsInput, setGmapsInput] = useState('');
  const [parseStatus, setParseStatus] = useState<{ success: boolean; msg: string } | null>(null);

  const [sqlNotice, setSqlNotice] = useState<string | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const currentUser = (await supabase.auth.getSession()).data.session?.user;
      if (!currentUser) return;

      let { data, error } = await supabase
        .from('attendance_settings')
        .select('*')
        .eq('user_id', currentUser.id)
        .maybeSingle();

      if (error && (error.code === 'PGRST204' || error.message?.includes('user_id'))) {
        // Fallback for DB without user_id column
        const res = await supabase.from('attendance_settings').select('*').limit(1).maybeSingle();
        data = res.data;
        error = res.error;
      }

      if (error) {
        if (error.code === '42P01') {
          setErrorMsg('Tabel attendance_settings belum dibuat. Silakan jalankan script SQL.');
        }
      } else if (!data) {
        // Create initial settings row for this user in Cloud
        const initPayload: any = {
          user_id: currentUser.id,
          timezone: 'Asia/Jakarta',
          arrival_start: '06:00',
          arrival_end: '07:30',
          departure_start: '15:00',
          departure_end: '18:00',
          location_radius: 50
        };
        let ins = await supabase.from('attendance_settings').insert([initPayload]);
        if (ins.error && (ins.error.code === '23502' || ins.error.message?.includes('id'))) {
          // Fallback if id column has no default generator in PostgreSQL
          initPayload.id = Math.floor(Math.random() * 2000000000) + 1;
          ins = await supabase.from('attendance_settings').insert([initPayload]);
          if (ins.error) {
            initPayload.id = crypto.randomUUID();
            ins = await supabase.from('attendance_settings').insert([initPayload]);
          }
        }
        if (ins.error && (ins.error.code === 'PGRST204' || ins.error.message?.includes('user_id'))) {
          delete initPayload.user_id;
          delete initPayload.id;
          await supabase.from('attendance_settings').insert([initPayload]);
        }
      } else {
        setTimezone(data.timezone || 'Asia/Jakarta');
        setArrivalStart(data.arrival_start || '06:00');
        setArrivalEnd(data.arrival_end || '07:30');
        setDepartureStart(data.departure_start || '15:00');
        setDepartureEnd(data.departure_end || '18:00');
        setLocationLat(data.location_lat || null);
        setLocationLng(data.location_lng || null);
        setLocationRadius(data.location_radius || 50);
        setFaceMatchThreshold(data.face_match_threshold !== undefined && data.face_match_threshold !== null ? Number(data.face_match_threshold) : 0.44);

        if (data.location_lat && data.location_lng) {
          setGmapsInput(`https://www.google.com/maps?q=${data.location_lat},${data.location_lng}`);
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleGmapsInputChange = (value: string) => {
    setGmapsInput(value);
    if (!value.trim()) {
      setParseStatus(null);
      return;
    }

    const parsed = parseGoogleMapsUrl(value);
    if (parsed) {
      setLocationLat(parsed.lat);
      setLocationLng(parsed.lng);
      setParseStatus({
        success: true,
        msg: `Koordinat terdeteksi: ${parsed.lat.toFixed(6)}, ${parsed.lng.toFixed(6)}`
      });
    } else {
      setParseStatus({
        success: false,
        msg: 'Link tidak memuat koordinat otomatis. Pastikan link menyertakan titik lokasi atau tempel angka koordinat langsung (misal: -6.2087, 106.8455).'
      });
    }
  };

  const handleGetCurrentLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setLocationLat(lat);
          setLocationLng(lng);
          const link = `https://www.google.com/maps?q=${lat},${lng}`;
          setGmapsInput(link);
          setParseStatus({
            success: true,
            msg: `Lokasi perangkat saat ini berhasil digunakan (${lat.toFixed(6)}, ${lng.toFixed(6)})`
          });
        },
        (err) => {
          alert('Gagal mengambil lokasi perangkat: ' + err.message);
        },
        { enableHighAccuracy: true }
      );
    } else {
      alert('Browser Anda tidak mendukung fitur lokasi (Geolocation).');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');

    const currentUser = (await supabase.auth.getSession()).data.session?.user;
    if (!currentUser) {
      setSaving(false);
      setErrorMsg('Sesi login telah berakhir. Silakan login kembali.');
      return;
    }

    const settingsPayload: any = {
      user_id: currentUser.id,
      timezone,
      arrival_start: arrivalStart,
      arrival_end: arrivalEnd,
      departure_start: departureStart,
      departure_end: departureEnd,
      location_lat: locationLat,
      location_lng: locationLng,
      location_radius: locationRadius,
      face_match_threshold: faceMatchThreshold
    };

    // 1. Check if row already exists for this user
    let existingId: string | null = null;
    const { data: userRow } = await supabase
      .from('attendance_settings')
      .select('id')
      .eq('user_id', currentUser.id)
      .maybeSingle();

    if (userRow?.id) {
      existingId = userRow.id;
    } else {
      // 2. Fallback check for any existing setting row (if user_id column doesn't exist yet)
      const { data: anyRow } = await supabase
        .from('attendance_settings')
        .select('id')
        .limit(1)
        .maybeSingle();
      if (anyRow?.id) {
        existingId = anyRow.id;
      }
    }

    let saveError: any = null;
    let missingFaceColumn = false;

    // Helper for saving with retry capability
    const executeSave = async (payload: any) => {
      if (existingId) {
        let { error } = await supabase
          .from('attendance_settings')
          .update(payload)
          .eq('id', existingId);

        if (error && (error.code === 'PGRST204' || error.message?.includes('user_id'))) {
          const fallbackPayload = { ...payload };
          delete fallbackPayload.user_id;
          const res = await supabase
            .from('attendance_settings')
            .update(fallbackPayload)
            .eq('id', existingId);
          error = res.error;
        }
        return error;
      } else {
        let { error } = await supabase
          .from('attendance_settings')
          .insert([payload]);

        if (error && (error.code === '23502' || error.message?.includes('id'))) {
          const payloadWithInt = { ...payload, id: Math.floor(Math.random() * 2000000000) + 1 };
          const resInt = await supabase.from('attendance_settings').insert([payloadWithInt]);
          if (resInt.error) {
            const payloadWithUuid = { ...payload, id: crypto.randomUUID() };
            const resUuid = await supabase.from('attendance_settings').insert([payloadWithUuid]);
            error = resUuid.error;
          } else {
            error = null;
          }
        }

        if (error && (error.code === 'PGRST204' || error.message?.includes('user_id'))) {
          const fallbackPayload = { ...payload };
          delete fallbackPayload.user_id;
          delete fallbackPayload.id;
          const res = await supabase.from('attendance_settings').insert([fallbackPayload]);
          return res.error;
        }
        return error;
      }
    };

    saveError = await executeSave(settingsPayload);

    // If face_match_threshold column is not yet added in Supabase schema cache:
    if (saveError && (saveError.message?.includes('face_match_threshold') || saveError.code === 'PGRST204')) {
      const payloadWithoutFace = { ...settingsPayload };
      delete payloadWithoutFace.face_match_threshold;
      const retryError = await executeSave(payloadWithoutFace);
      if (!retryError) {
        saveError = null;
        missingFaceColumn = true;
        setSqlNotice('ALTER TABLE IF EXISTS attendance_settings ADD COLUMN IF NOT EXISTS face_match_threshold NUMERIC DEFAULT 0.44;');
      }
    }

    setSaving(false);

    if (saveError) {
      if (saveError.message?.includes('face_match_threshold')) {
        setSqlNotice('ALTER TABLE IF EXISTS attendance_settings ADD COLUMN IF NOT EXISTS face_match_threshold NUMERIC DEFAULT 0.44;');
      }
      setErrorMsg(`Gagal menyimpan pengaturan ke Cloud: ${saveError.message || 'Terjadi kesalahan'}`);
    } else if (missingFaceColumn) {
      setSuccessMsg('Pengaturan jam & lokasi berhasil disimpan di Cloud! Namun kolom sensitivitas wajah belum ada di database Supabase Anda.');
    } else {
      setSqlNotice(null);
      setSuccessMsg('Pengaturan jam, lokasi, dan sensitivitas wajah berhasil disimpan di Cloud! Akses dari perangkat mana saja akan selalu sinkron.');
      setTimeout(() => setSuccessMsg(''), 4000);
    }
  };

  if (loading) {
    return <div className="text-center py-10 text-slate-500">Memuat pengaturan...</div>;
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 sm:p-8 max-w-2xl">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-800">Pengaturan Jam Absensi & Lokasi</h2>
        <p className="text-slate-500 text-sm mt-1">Atur batas waktu kehadiran, sensitivitas biometrik wajah, serta titik geofencing lokasi sekolah.</p>
      </div>

      {errorMsg && (
        <div className="mb-6 p-4 bg-rose-50 text-rose-700 rounded-xl flex items-start gap-3 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p>{errorMsg}</p>
        </div>
      )}

      {successMsg && (
        <div className="mb-6 p-4 bg-emerald-50 text-emerald-700 rounded-xl flex items-start gap-3 text-sm">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <p>{successMsg}</p>
        </div>
      )}

      {sqlNotice && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
          <div className="flex items-start gap-3">
            <Terminal className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-bold text-amber-900">Perintah SQL Tambahan Supabase</h3>
              <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                Jalankan baris SQL ini di <strong>SQL Editor</strong> Supabase Anda agar kolom <code>face_match_threshold</code> aktif:
              </p>
              <div className="mt-2.5 flex items-center justify-between gap-2 p-2.5 bg-slate-900 text-emerald-400 font-mono text-xs rounded-xl border border-slate-800">
                <span className="truncate">{sqlNotice}</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(sqlNotice);
                    setCopiedSql(true);
                    setTimeout(() => setCopiedSql(false), 2500);
                  }}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-sans text-xs font-semibold rounded-lg flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
                >
                  {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedSql ? 'Tersalin!' : 'Salin SQL'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Zona Waktu (Time Zone)</label>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="Asia/Jakarta">WIB (Asia/Jakarta)</option>
            <option value="Asia/Makassar">WITA (Asia/Makassar)</option>
            <option value="Asia/Jayapura">WIT (Asia/Jayapura)</option>
          </select>
          <p className="text-xs text-slate-500 mt-1">Zona waktu ini digunakan untuk mencatat dan mencocokkan jam masuk/pulang di server.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Mulai Absen Masuk</label>
            <input
              type="time"
              value={arrivalStart}
              onChange={(e) => setArrivalStart(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Batas Akhir Absen Masuk (Toleransi)</label>
            <input
              type="time"
              value={arrivalEnd}
              onChange={(e) => setArrivalEnd(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-xs text-rose-500 mt-1">Lewat dari jam ini dianggap <b>Terlambat</b>.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Mulai Absen Pulang</label>
            <input
              type="time"
              value={departureStart}
              onChange={(e) => setDepartureStart(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Batas Akhir Absen Pulang</label>
            <input
              type="time"
              value={departureEnd}
              onChange={(e) => setDepartureEnd(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-bold text-slate-800 flex items-center gap-2">
                <Globe className="w-4 h-4 text-indigo-600" /> Kunci Lokasi Sekolah via Google Maps
              </label>
              <a
                href={locationLat && locationLng ? `https://www.google.com/maps?q=${locationLat},${locationLng}` : 'https://maps.google.com'}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
              >
                Buka Google Maps <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p className="text-xs text-slate-500 mb-2">
              Salin/Tempel (paste) link Google Maps atau angka koordinat titik sekolah Anda di sini.
            </p>

            <div className="relative">
              <input
                type="text"
                value={gmapsInput}
                onChange={(e) => handleGmapsInputChange(e.target.value)}
                placeholder="Paste link Google Maps di sini (contoh: https://maps.app.goo.gl/... atau -6.2088, 106.8456)"
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-mono pr-28"
              />
              <button
                type="button"
                onClick={handleGetCurrentLocation}
                className="absolute right-2 top-2 bottom-2 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg transition-colors flex items-center gap-1 border border-indigo-200"
                title="Gunakan lokasi posisi Anda saat ini"
              >
                <MapPin className="w-3.5 h-3.5" /> Posisi Saya
              </button>
            </div>

            {parseStatus && (
              <div className={`mt-2 p-3 rounded-xl text-xs flex items-start gap-2 ${parseStatus.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200'}`}>
                {parseStatus.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />}
                <span>{parseStatus.msg}</span>
              </div>
            )}
          </div>

          <div className="h-[380px] w-full rounded-2xl overflow-hidden border border-slate-200 relative z-0 shadow-inner">

            <div className="h-full w-full relative">
              <MapContainer 
                center={locationLat && locationLng ? [locationLat, locationLng] : [-6.2088, 106.8456]} 
                zoom={17} 
                style={{ height: '100%', width: '100%' }}
                className="z-0"
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                />
                <FreeMapSearch onSelect={(lat, lng) => {
                  setLocationLat(lat);
                  setLocationLng(lng);
                  const newLink = `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}`;
                  setGmapsInput(newLink);
                  setParseStatus({
                    success: true,
                    msg: `Lokasi ditemukan: ${lat.toFixed(6)}, ${lng.toFixed(6)}`
                  });
                }} />
                
                {locationLat && locationLng && (
                  <>
                    <RecenterMap lat={locationLat} lng={locationLng} />
                    <Circle 
                      center={[locationLat, locationLng]} 
                      radius={locationRadius} 
                      pathOptions={{ color: '#4f46e5', fillColor: '#6366f1', fillOpacity: 0.25, weight: 2 }} 
                    />
                  </>
                )}
                
                <LocationPicker 
                  position={locationLat && locationLng ? {lat: locationLat, lng: locationLng} : null}
                  setPosition={(pos: any) => {
                    setLocationLat(pos.lat);
                    setLocationLng(pos.lng);
                    const newLink = `https://www.google.com/maps?q=${pos.lat.toFixed(6)},${pos.lng.toFixed(6)}`;
                    setGmapsInput(newLink);
                    setParseStatus({
                      success: true,
                      msg: `Koordinat dipilih dari peta: ${pos.lat.toFixed(6)}, ${pos.lng.toFixed(6)}`
                    });
                  }} 
                />
              </MapContainer>
            </div>

<div className="absolute top-3 right-3 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-xl shadow-sm text-[11px] font-bold text-slate-700 z-[1000] border border-slate-200/80">
              💡 Bisa klik pada peta untuk menentukan titik
            </div>
          </div>

          <div className="flex gap-4 items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
            <MapPin className="w-5 h-5 text-indigo-600 flex-shrink-0" />
            <div className="flex-1">
              <div className="text-xs font-semibold text-slate-500">Koordinat Aktif Terpilih</div>
              <div className="text-sm text-slate-800 font-mono font-bold">
                {locationLat != null && locationLng != null && !isNaN(Number(locationLat)) && !isNaN(Number(locationLng)) ? `${Number(locationLat).toFixed(6)}, ${Number(locationLng).toFixed(6)}` : 'Belum diatur'}
              </div>
            </div>
            {locationLat && locationLng && (
              <button
                type="button"
                onClick={() => {
                  setLocationLat(null);
                  setLocationLng(null);
                  setGmapsInput('');
                  setParseStatus(null);
                }}
                className="text-xs text-rose-600 hover:text-rose-700 font-bold px-2 py-1 rounded hover:bg-rose-50 transition-colors"
              >
                Hapus
              </button>
            )}
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-sm font-bold text-slate-700">Radius Toleransi Geofencing (Meter)</label>
              <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                {locationRadius} Meter
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-2">
              Batas jarak maksimal guru dari titik sekolah saat melakukan pemindaian absen.
            </p>

            <div className="flex items-center gap-3">
              <input
                type="range"
                min="10"
                max="500"
                step="5"
                value={locationRadius}
                onChange={(e) => setLocationRadius(parseInt(e.target.value) || 10)}
                className="flex-1 accent-indigo-600 h-2 bg-slate-200 rounded-lg cursor-pointer"
              />
              <input
                type="number"
                min="5"
                max="1000"
                value={locationRadius}
                onChange={(e) => setLocationRadius(parseInt(e.target.value) || 10)}
                className="w-20 px-3 py-1.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold text-center"
              />
            </div>

            <div className="flex gap-2 mt-2">
              <span className="text-xs text-slate-400 self-center">Pilihan Cepat:</span>
              {[25, 50, 100, 150, 200].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setLocationRadius(val)}
                  className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors ${locationRadius === val ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                >
                  {val}m
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Facial Biometric Recognition Precision Settings */}
        <div className="pt-5 border-t border-slate-100 space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-bold text-slate-800 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" /> Presisi Pengenalan Wajah (Anti-Joki / Anti Titip Absen)
            </label>
            <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              Ambang Jarak: {faceMatchThreshold}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Mengontrol seberapa ketat sistem memvalidasi kemiripan wajah guru asli terhadap data pendaftaran. Mencegah orang lain/orang yang mirip melakukan absensi.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <button
              type="button"
              onClick={() => setFaceMatchThreshold(0.40)}
              className={`p-3 rounded-2xl border text-left transition-all ${faceMatchThreshold === 0.40 ? 'bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-800">Sangat Ketat</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-bold">0.40</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Zero tolerance. Menolak siapapun yang tidak 100% identik. Membutuhkan pencahayaan bagus.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setFaceMatchThreshold(0.44)}
              className={`p-3 rounded-2xl border text-left transition-all ${faceMatchThreshold === 0.44 ? 'bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-emerald-900 flex items-center gap-1">
                  Presisi Tinggi <Sparkles className="w-3 h-3 text-amber-500" />
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">0.44</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                <strong>Rekomendasi.</strong> Mencegah orang lain absen, tetap mengenali guru asli dengan akurasi 99.8%.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setFaceMatchThreshold(0.48)}
              className={`p-3 rounded-2xl border text-left transition-all ${faceMatchThreshold === 0.48 ? 'bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-800">Fleksibel</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-bold">0.48</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Toleransi ekstra untuk perangkat kamera HP resolusi rendah atau ruangan berbayang.
              </p>
            </button>
          </div>

          <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
            <span className="text-slate-600 font-mono text-[11px] truncate mr-2">
              ALTER TABLE IF EXISTS attendance_settings ADD COLUMN IF NOT EXISTS face_match_threshold NUMERIC DEFAULT 0.44;
            </span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText('ALTER TABLE IF EXISTS attendance_settings ADD COLUMN IF NOT EXISTS face_match_threshold NUMERIC DEFAULT 0.44;');
                setCopiedSql(true);
                setTimeout(() => setCopiedSql(false), 2500);
              }}
              className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
            >
              {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
              <span>{copiedSql ? 'Tersalin' : 'Salin SQL Kolom'}</span>
            </button>
          </div>
        </div>

        <div className="pt-6">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors disabled:opacity-70 shadow-sm"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
          </button>
        </div>
      </form>
    </div>
  );
}

