'use client';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import posthog from 'posthog-js';
import { useSession } from 'next-auth/react';
import { CONSENT_COOKIE, CONSENT_MAX_AGE, readConsent, analyticsPath, type CookieConsent } from '@/lib/cookie-consent';
import { enableAnalytics, disableAnalytics } from '@/lib/consented-analytics';

const ConsentContext = createContext<{ consent: CookieConsent | null; openSettings: () => void }>({ consent: null, openSettings: () => {} });
export const useCookieConsent = () => useContext(ConsentContext);
export function CookieSettingsButton() {
  const { openSettings } = useCookieConsent();
  return <button type="button" onClick={openSettings} className="underline underline-offset-4">Cookie settings</button>;
}
export default function CookiePreferences({ children }: { children: React.ReactNode }) {
  const [consent, setConsent] = useState<CookieConsent | null>(null);
  const [visible, setVisible] = useState(false);
  const [settings, setSettings] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [chat, setChat] = useState(false);
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const userId = session?.user?.id;
  const identifiedUser = useRef<string | null>(null);
  const lastPage = useRef<string | null>(null);
  useEffect(() => {
    function sync() {
      const saved = readConsent();
      if (!saved?.chat && window.Tawk_API?.showWidget) { window.location.reload(); return; }
      setConsent(saved); setAnalytics(saved?.analytics ?? false); setChat(saved?.chat ?? false);
      setVisible(!saved);
      if (!saved?.analytics) { disableAnalytics(); lastPage.current = null; }
    }
    sync();
    window.addEventListener('focus', sync);
    return () => window.removeEventListener('focus', sync);
  }, []);
  useEffect(() => {
    if (!consent?.analytics || !pathname || !enableAnalytics()) return;
    if (status === "authenticated" && userId && identifiedUser.current !== userId) {
      posthog.identify(userId);
      identifiedUser.current = userId;
    } else if (status === "unauthenticated" && identifiedUser.current) {
      posthog.reset();
      identifiedUser.current = null;
    }
    if (lastPage.current !== pathname) {
      posthog.capture('$pageview', { $current_url: window.location.origin + analyticsPath(pathname), $pathname: analyticsPath(pathname) });
      lastPage.current = pathname;
    }
  }, [consent, pathname, status, userId]);
  function openSettings() {
    setAnalytics(consent?.analytics ?? false); setChat(consent?.chat ?? false);
    setSettings(true); setVisible(true);
  }
  function save(allowAnalytics: boolean, allowChat: boolean) {
    const next: CookieConsent = { version: 1, analytics: allowAnalytics, chat: allowChat, savedAt: Date.now() };
    document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(next))}; Path=/; Max-Age=${CONSENT_MAX_AGE}; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
    if (!allowAnalytics) { disableAnalytics(); lastPage.current = null; }
    setConsent(next); setVisible(false); setSettings(false);
    // A loaded third-party chat cannot be stopped by merely hiding its iframe.
    if (consent?.chat && !allowChat) window.location.reload();
  }
  const button = 'rounded-full border-2 border-[#342044] px-5 py-3 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#342044]';
  return <ConsentContext.Provider value={{ consent, openSettings }}>
    {children}
    {!visible && <div className="fixed bottom-2 left-2 z-[9998] rounded-full bg-white px-3 py-2 text-xs text-[#342044] shadow-md"><CookieSettingsButton /></div>}
    {visible && <section role="region" aria-label="Cookie preferences" className="fixed inset-x-3 bottom-3 z-[10000] mx-auto max-h-[85dvh] max-w-3xl overflow-y-auto rounded-3xl border-2 border-[#342044] bg-white p-5 text-[#342044] shadow-2xl sm:p-7">
      <h2 className="m-0 text-xl font-bold">A little choice about cookies</h2>
      <p className="my-3 text-sm leading-relaxed">Essential cookies keep FlipWhizz working. With your permission, PostHog helps us understand page visits and improve book creation, and tawk.to enables live chat. You can change your mind any time. <a href="/privacy" className="underline">Privacy policy</a></p>
      {settings && <div className="my-4 space-y-4 rounded-2xl bg-[#F5EFFA] p-4 text-sm">
        <p className="m-0"><strong>Essential — always on.</strong> Sign-in, checkout and remembering this choice for six months.</p>
        <label className="flex items-start gap-3"><input type="checkbox" className="mt-1 h-5 w-5 accent-[#6836A2]" checked={analytics} onChange={e => setAnalytics(e.target.checked)} /><span><strong>Analytics</strong><br />Page views and product events. No session recordings, story text or photos.</span></label>
        <label className="flex items-start gap-3"><input type="checkbox" className="mt-1 h-5 w-5 accent-[#6836A2]" checked={chat} onChange={e => setChat(e.target.checked)} /><span><strong>Live chat</strong><br />Loads tawk.to and its cookies to support your conversation. You can also email hello@flipwhizz.com.</span></label>
      </div>}
      <div className="flex flex-wrap gap-3">
        <button type="button" className={button} onClick={() => save(true, true)}>Accept all</button>
        <button type="button" className={button} onClick={() => save(false, false)}>Reject optional</button>
        <button type="button" className={button} onClick={() => settings ? save(analytics, chat) : setSettings(true)}>{settings ? 'Save preferences' : 'Settings'}</button>
        {consent && <button type="button" className="px-3 text-sm underline" onClick={() => setVisible(false)}>Cancel</button>}
      </div>
    </section>}
  </ConsentContext.Provider>;
}
