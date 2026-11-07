import { useEffect, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { Icon, Link, Wordmark } from './components/ui.tsx';
import { usePath, navigate } from './lib/app.ts';
import { consumeAuthRedirect, loadConfig } from './lib/supabase.ts';
import { initSync, pull } from './lib/store.ts';
import { Home, Onboarding } from './screens/Home.tsx';
import { LiturgyScreen } from './screens/Liturgy.tsx';
import { BibleHome, BibleBook, BibleReader, BibleSearch, VerseHistory } from './screens/Bible.tsx';
import { PrayerHome, PrayerDetail, RosaryScreen, ChapletScreen } from './screens/Prayer.tsx';
import { DiscoverHome, NewsScreen, CalendarScreen, SaintsScreen, SaintDetail, QuotesScreen, ThemedList, ThemedDetail } from './screens/Discover.tsx';
import { TemplesScreen } from './screens/Temples.tsx';
import { RadarScreen } from './screens/Radar.tsx';
import { GuideScreen } from './screens/Guide.tsx';
import { ProfileHome, AuthScreen, SettingsScreen, FavoritesScreen, StatsScreen, HistoryScreen, PrivacyScreen, AdminScreen, PasswordScreen } from './screens/Profile.tsx';

function Router({ path }: { path: string }): ReactNode {
  const [p, qs] = path.split('?');
  const seg = p.split('/').filter(Boolean).map(decodeURIComponent);
  const q = new URLSearchParams(qs);
  switch (seg[0]) {
    case undefined: return <Home />;
    case 'liturgia': return <LiturgyScreen date={seg[1]} />;
    case 'biblia':
      if (seg[1] === 'buscar') return <BibleSearch initial={q.get('q') ?? ''} />;
      if (seg[1] === 'versiculos') return <VerseHistory />;
      if (seg[1] && seg[2]) return <BibleReader code={seg[1]} chapter={+seg[2]} verse={q.get('v') ? +q.get('v')! : undefined} />;
      if (seg[1]) return <BibleBook code={seg[1]} />;
      return <BibleHome />;
    case 'oracion':
      if (seg[1] === 'rosario') return <RosaryScreen />;
      if (seg[1] === 'coronilla') return <ChapletScreen />;
      if (seg[1]) return <PrayerDetail id={seg[1]} />;
      return <PrayerHome />;
    case 'guia': return <GuideScreen id={seg[1]} initial={q.get('p') ?? undefined} />;
    case 'descubrir':
      if (seg[1] === 'noticias') return <NewsScreen />;
      if (seg[1] === 'templos') return <TemplesScreen />;
      if (seg[1] === 'misas') return <RadarScreen />;
      if (seg[1] === 'calendario') return <CalendarScreen />;
      if (seg[1] === 'santos' && seg[2]) return <SaintDetail name={seg[2]} />;
      if (seg[1] === 'santos') return <SaintsScreen />;
      if (seg[1] === 'frases') return <QuotesScreen />;
      if (seg[1] === 'reflexiones' && seg[2]) return <ThemedDetail id={seg[2]} />;
      if (seg[1] === 'reflexiones') return <ThemedList />;
      return <DiscoverHome />;
    case 'perfil':
      if (seg[1] === 'entrar') return <AuthScreen />;
      if (seg[1] === 'ajustes') return <SettingsScreen />;
      if (seg[1] === 'favoritos') return <FavoritesScreen />;
      if (seg[1] === 'estadisticas') return <StatsScreen />;
      if (seg[1] === 'historial') return <HistoryScreen />;
      if (seg[1] === 'admin') return <AdminScreen />;
      if (seg[1] === 'clave') return <PasswordScreen />;
      return <ProfileHome />;
    case 'privacidad': return <PrivacyScreen />;
    default: return <div className="p-10 text-center"><h1 className="text-3xl">Esta página no existe</h1><p className="mt-2"><Link to="/" className="font-bold text-gold underline">Volver al inicio</Link></p></div>;
  }
}

const TABS = [
  { to: '/', icon: 'home', label: 'Inicio', match: (s: string) => s === '' || s === 'liturgia' }, { to: '/biblia', icon: 'book', label: 'Biblia', match: (s: string) => s === 'biblia' },
  { to: '/oracion', icon: 'rosary', label: 'Oración', match: (s: string) => s === 'oracion' || s === 'guia' }, { to: '/descubrir', icon: 'church', label: 'Descubrir', match: (s: string) => s === 'descubrir' },
  { to: '/perfil', icon: 'user', label: 'Perfil', match: (s: string) => s === 'perfil' || s === 'privacidad' },
];

function App() {
  const path = usePath();
  const [, force] = useState(0);
  useEffect(() => {
    void loadConfig().then(async () => {
      const type = await consumeAuthRedirect().catch(() => null);
      force((n) => n + 1);
      if (type === 'recovery') navigate('/perfil/clave', true);
      await pull().catch((e) => console.warn(e));
    });
    if ('serviceWorker' in navigator && !__PREVIEW__ && location.protocol === 'https:') navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);
  const seg = path.split('?')[0].split('/')[1] ?? '';
  const reading = /^\/biblia\/[^/]+\/\d+/.test(path) && path.includes('zen=1');
  return <div className="md:flex">
    {!reading && <nav aria-label="Principal" className="safe-b fixed inset-x-0 bottom-0 z-30 bg-paper/85 backdrop-blur-xl md:sticky md:top-0 md:h-dvh md:w-52 md:shrink-0 md:bg-transparent md:p-6">
      <Wordmark className="mb-8 hidden md:flex" />
      <ul className="grid grid-cols-5 md:flex md:flex-col md:gap-0.5">
        {TABS.map((t) => { const on = t.match(seg); return <li key={t.to}><Link to={t.to} className={`flex flex-col items-center gap-0.5 pb-1 pt-2 text-[10.5px] md:flex-row md:gap-3 md:py-2.5 md:text-[15px] ${on ? 'font-bold text-ink' : 'text-muted hover:text-ink'}`}><Icon name={t.icon} size={24} /><span aria-current={on ? 'page' : undefined}>{t.label}</span></Link></li>; })}
      </ul>
    </nav>}
    <div className="min-w-0 flex-1" key={seg}>
      {__PREVIEW__ && <p className="bg-surface px-4 py-2 text-center text-xs leading-snug text-muted">Vista previa sin servidor. Lecturas, noticias y cuentas se activan al publicar la app.</p>}
      <Router path={path} />
    </div>
    <Onboarding />
  </div>;
}

initSync();
createRoot(document.getElementById('root')!).render(<App />);
