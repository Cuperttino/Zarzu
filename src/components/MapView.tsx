/** Mapa de teselas ligero (OpenStreetMap): arrastrar, pellizcar, rueda y doble toque. Sin dependencias. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './ui.tsx';

export interface Marker { id: string; lat: number; lon: number; label: string }
const TILE = 256;
const project = (lat: number, lon: number, z: number) => {
  const s = TILE * 2 ** z, r = (Math.min(85, Math.max(-85, lat)) * Math.PI) / 180;
  return { x: ((lon + 180) / 360) * s, y: ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * s };
};
const unproject = (x: number, y: number, z: number) => {
  const s = TILE * 2 ** z;
  return { lon: (x / s) * 360 - 180, lat: (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / s))) * 180) / Math.PI };
};

export function MapView({ center, zoom: z0, markers, me, selected, onSelect, tileUrl, onMove }: {
  center: { lat: number; lon: number }; zoom: number; markers: Marker[]; me?: { lat: number; lon: number } | null; selected?: string | null;
  onSelect: (id: string) => void; tileUrl: string; onMove?: (c: { lat: number; lon: number }, zoom: number) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 360, h: 320 });
  const [view, setView] = useState({ lat: center.lat, lon: center.lon, z: z0 });
  const drag = useRef<{ pts: Map<number, { x: number; y: number }>; startDist?: number; startZ?: number; moved: boolean }>({ pts: new Map(), moved: false });
  const [tileError, setTileError] = useState(false);

  useEffect(() => setView((v) => ({ lat: center.lat, lon: center.lon, z: z0 ?? v.z })), [center.lat, center.lon, z0]);
  useEffect(() => { const o = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height })); if (el.current) o.observe(el.current); return () => o.disconnect(); }, []);

  const iz = Math.round(view.z), k = 2 ** (view.z - iz), c = project(view.lat, view.lon, iz);
  const left = c.x - size.w / 2 / k, top = c.y - size.h / 2 / k;
  const tiles = useMemo(() => {
    const out: { key: string; src: string; x: number; y: number }[] = [], n = 2 ** iz;
    for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + size.w / k) / TILE); tx++) for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + size.h / k) / TILE); ty++) {
      if (ty < 0 || ty >= n) continue;
      const wx = ((tx % n) + n) % n;
      out.push({ key: `${iz}/${tx}/${ty}`, src: tileUrl.replace('{z}', String(iz)).replace('{x}', String(wx)).replace('{y}', String(ty)), x: (tx * TILE - left) * k, y: (ty * TILE - top) * k });
    }
    return out;
  }, [iz, k, left, top, size, tileUrl]);
  const toScreen = (lat: number, lon: number) => { const p = project(lat, lon, view.z); const cc = project(view.lat, view.lon, view.z); return { x: p.x - cc.x + size.w / 2, y: p.y - cc.y + size.h / 2 }; };
  const setZoom = (z: number) => setView((v) => ({ ...v, z: Math.min(18, Math.max(3, z)) }));
  const panBy = (dx: number, dy: number) => setView((v) => { const p = project(v.lat, v.lon, v.z); const u = unproject(p.x - dx, p.y - dy, v.z); return { ...v, lat: u.lat, lon: u.lon }; });

  useEffect(() => { const t = setTimeout(() => onMove?.({ lat: view.lat, lon: view.lon }, view.z), 400); return () => clearTimeout(t); }, [view.lat, view.lon, view.z]); // eslint-disable-line

  useEffect(() => { // la rueda necesita un oyente no pasivo
    const n = el.current; if (!n) return;
    const f = (e: WheelEvent) => { e.preventDefault(); setZoom(view.z - e.deltaY * 0.002); };
    n.addEventListener('wheel', f, { passive: false }); return () => n.removeEventListener('wheel', f);
  }, [view.z]); // eslint-disable-line

  return <div ref={el} className="relative h-full w-full touch-none select-none overflow-hidden bg-sand" role="application" aria-label="Mapa de templos"
    onPointerDown={(e) => { (e.target as Element).setPointerCapture?.(e.pointerId); drag.current.pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); drag.current.moved = false; if (drag.current.pts.size === 2) { const [a, b] = [...drag.current.pts.values()]; drag.current.startDist = Math.hypot(a.x - b.x, a.y - b.y); drag.current.startZ = view.z; } }}
    onPointerMove={(e) => { const d = drag.current, p = d.pts.get(e.pointerId); if (!p) return; const dx = e.clientX - p.x, dy = e.clientY - p.y; d.pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (Math.abs(dx) + Math.abs(dy) > 1) d.moved = true; if (d.pts.size === 1) panBy(dx, dy); else if (d.pts.size === 2 && d.startDist) { const [a, b] = [...d.pts.values()]; setZoom(d.startZ! + Math.log2(Math.hypot(a.x - b.x, a.y - b.y) / d.startDist)); } }}
    onPointerUp={(e) => { drag.current.pts.delete(e.pointerId); }} onPointerCancel={(e) => { drag.current.pts.delete(e.pointerId); }}
    onDoubleClick={() => setZoom(view.z + 1)}>
    {tiles.map((t) => <img key={t.key} src={t.src} alt="" draggable={false} onError={() => setTileError(true)} className="pointer-events-none absolute max-w-none dark:brightness-[.72] dark:contrast-[1.05]" style={{ left: t.x, top: t.y, width: TILE * k + 0.5, height: TILE * k + 0.5 }} />)}
    {me && (() => { const s = toScreen(me.lat, me.lon); return <span className="absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#2f6fd6] shadow" style={{ left: s.x, top: s.y }} aria-label="Tu ubicación" />; })()}
    {markers.map((m) => { const s = toScreen(m.lat, m.lon); if (s.x < -30 || s.y < -30 || s.x > size.w + 30 || s.y > size.h + 30) return null; const on = m.id === selected;
      return <button key={m.id} aria-label={m.label} title={m.label} onPointerDown={(e) => e.stopPropagation()} onClick={() => onSelect(m.id)} className={`bead absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 shadow-md ${on ? 'z-10 size-10 border-white bg-gold text-white' : 'size-8 border-white bg-black text-white'}`} style={{ left: s.x, top: s.y }}><Icon name="pray" size={on ? 20 : 15} /></button>; })}
    <div className="absolute right-2 top-2 flex flex-col overflow-hidden rounded-lg border border-line bg-surface shadow">
      <button aria-label="Acercar" className="grid size-10 place-items-center text-ink" onPointerDown={(e) => e.stopPropagation()} onClick={() => setZoom(Math.round(view.z) + 1)}><Icon name="plus" size={18} /></button>
      <button aria-label="Alejar" className="grid size-10 place-items-center border-t border-line text-ink" onPointerDown={(e) => e.stopPropagation()} onClick={() => setZoom(Math.round(view.z) - 1)}><span className="block h-px w-4 bg-current" /></button>
    </div>
    {tileError && <p className="absolute left-2 top-2 max-w-[70%] rounded bg-surface/95 px-2 py-1 text-xs text-muted">El mapa de fondo no carga. Revisa tu conexión; la lista sigue disponible.</p>}
    <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" onPointerDown={(e) => e.stopPropagation()} className="absolute bottom-0 right-0 bg-white/85 px-1.5 py-0.5 text-[11px] text-[#333]">© OpenStreetMap</a>
  </div>;
}
