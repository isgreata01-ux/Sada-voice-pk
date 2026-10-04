import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ClerkProvider, SignIn, SignUp, useAuth, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { Route, Switch, Redirect, Link, useLocation, Router as WouterRouter } from 'wouter';
import {
  Activity, ArrowDownToLine, ArrowRight, AudioLines, Check, ChevronDown, CircleHelp,
  Clock3, CreditCard, FileAudio2, Headphones, LayoutDashboard, LogOut, Menu, Mic2,
  Play, Plus, Search, Settings2, ShieldCheck,
  Sparkles, Trash2, Users, Volume2, WandSparkles, X, Zap,
} from 'lucide-react';
import {
  getGetAccountQueryKey, getGetAdminSummaryQueryKey, getListAdminUsersQueryKey,
  getListVoicesQueryKey, useGetAccount,
  useGetAdminSummary, useHealthCheck, useInviteAdminUser, useListAdminUsers,
  useListVoiceModels, useListVoices, useCloneVoice, useGenerateSpeech,
  useDeleteVoice, useRemoveAdminUser, useSetAdminUserTokens,
} from '@workspace/api-client-react';
import type { SpeechGeneration, Voice } from '@workspace/api-client-react';
import NotFound from '@/pages/not-found';
import { ErrorBoundary } from '@/components/error-boundary';
import TokenPackagesPanel from '@/components/TokenPackagesPanel';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import './index.css';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const stripBase = (path: string) => basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
const appearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: { logoPlacement: 'inside' as const, logoLinkUrl: basePath || '/', logoImageUrl: `${window.location.origin}${basePath}/logo.svg` },
  variables: {
    colorPrimary: '#d88a63', colorForeground: '#21383c', colorMutedForeground: '#667777',
    colorDanger: '#b94e49', colorBackground: '#f8f6ef', colorInput: '#fffefa',
    colorInputForeground: '#21383c', colorNeutral: '#dcd8cc', fontFamily: 'DM Sans, sans-serif', borderRadius: '12px',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#f8f6ef] rounded-2xl w-[440px] max-w-full overflow-hidden shadow-[0_24px_70px_rgba(26,48,50,.12)]',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#21383c] font-bold tracking-tight', headerSubtitle: 'text-[#667777]',
    socialButtonsBlockButtonText: 'text-[#21383c] font-semibold', formFieldLabel: 'text-[#21383c] font-semibold',
    footerActionLink: 'text-[#b76d4a] font-semibold', footerActionText: 'text-[#667777]',
    dividerText: 'text-[#667777]', identityPreviewEditButton: 'text-[#b76d4a]',
    formFieldSuccessText: 'text-[#31725e]', alertText: 'text-[#21383c]',
    logoBox: 'mb-3', logoImage: 'rounded-md', socialButtonsBlockButton: 'border-[#dcd8cc] bg-[#fffefa]',
    formButtonPrimary: 'bg-[#21383c] hover:bg-[#2c4a4d] text-[#faf8f1] shadow-none',
    formFieldInput: 'bg-[#fffefa] border-[#dcd8cc] text-[#21383c] focus:border-[#d88a63]',
    footerAction: 'text-[#667777]', dividerLine: 'bg-[#dcd8cc]', alert: 'bg-[#f1e9de] border-[#e2d4c3]',
    otpCodeFieldInput: 'bg-[#fffefa] border-[#dcd8cc] text-[#21383c]', formFieldRow: 'gap-2', main: 'gap-5',
  },
};

function Mark({ inverse = false }: { inverse?: boolean }) {
  return <span className={`inline-flex h-9 w-9 items-center justify-center rounded-[12px] ${inverse ? 'bg-[#d88a63] text-[#183033]' : 'bg-[#203a3d] text-[#f4eadb]'}`}><AudioLines size={20} strokeWidth={2.1} /></span>;
}

function Logo({ inverse = false }: { inverse?: boolean }) {
  return <span className="inline-flex items-center gap-2 sm:gap-3"><Mark inverse={inverse} /><span aria-label="Sada.Voice.PK" className={`brand-display whitespace-nowrap text-[16px] font-extrabold tracking-[-.06em] sm:text-[19px] ${inverse ? 'text-[#f4eadb]' : 'text-[#203a3d]'}`}>Sada.<span className="font-medium">Voice.PK</span></span></span>;
}

function LoadingScreen() {
  return <div className="min-h-[100dvh] bg-[#f6f4ed] p-6"><div className="mx-auto max-w-6xl animate-pulse space-y-6"><div className="h-10 w-48 rounded-xl bg-[#e8e5db]" /><div className="h-28 rounded-2xl bg-[#ebe8df]" /><div className="grid gap-4 md:grid-cols-3">{[1, 2, 3].map((n) => <div key={n} className="h-52 rounded-2xl bg-[#ebe8df]" />)}</div></div></div>;
}

function PublicHome() {
  const { isLoaded, isSignedIn } = useAuth();
  const health = useHealthCheck();
  if (!isLoaded) return <LoadingScreen />;
  if (isSignedIn) return <Redirect to="/studio" />;
  return <main className="min-h-[100dvh] overflow-hidden bg-[#f6f4ed] text-[#20383c]">
    <header className="relative z-10 mx-auto flex max-w-[1320px] items-center justify-between gap-2 px-4 py-4 sm:px-6 sm:py-6 lg:px-12">
      <Link href="/" className="no-underline" data-testid="link-home-logo"><Logo /></Link>
      <nav className="hidden items-center gap-9 text-[13px] font-semibold text-[#6e7b78] md:flex">
        <a href="#studio" className="transition hover:text-[#20383c]" data-testid="link-studio-section">The studio</a><a href="#workflow" className="transition hover:text-[#20383c]" data-testid="link-workflow-section">How it works</a><a href="#principles" className="transition hover:text-[#20383c]" data-testid="link-principles-section">Our standard</a>
      </nav>
      <div className="flex shrink-0 items-center gap-1 sm:gap-3"><Link href="/sign-in" className="whitespace-nowrap rounded-full px-2.5 py-2.5 text-xs font-semibold text-[#20383c] hover:bg-[#e9e6dc] sm:px-4 sm:text-sm" data-testid="link-sign-in">Sign in</Link><Link href="/sign-up" className="whitespace-nowrap rounded-full bg-[#20383c] px-3 py-2.5 text-xs font-semibold text-[#fbf8ef] transition hover:bg-[#345457] sm:px-5 sm:text-sm" data-testid="link-get-started">Get started <ArrowRight className="ml-1.5 inline" size={15} /></Link></div>
    </header>
    <section className="studio-grid relative mx-auto grid min-h-[690px] max-w-[1440px] grid-cols-1 items-center gap-12 px-6 pb-20 pt-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,.92fr)] lg:px-16 lg:pb-28 lg:pt-16">
      <div className="relative z-[1] w-full min-w-0 max-w-[670px] rise-in">
        <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#c9d5ce] bg-[#f9f7f0]/80 px-3.5 py-2 text-[11px] font-bold uppercase tracking-[.12em] text-[#52716c]"><span className="h-1.5 w-1.5 rounded-full bg-[#75a58d]" />A clear voice, beautifully made</div>
        <h1 className="brand-display max-w-[760px] text-[clamp(2.6rem,11.8vw,7rem)] font-bold leading-[.97] text-[#20383c]">Words deserve<br />a <span className="relative inline-block text-[#c87550]">voice.<span className="absolute -bottom-1 left-0 h-[5px] w-full rounded-full bg-[#dcaa84]/65" /></span></h1>
        <p className="mt-8 max-w-[510px] break-words text-base leading-7 text-[#637472] sm:text-lg sm:leading-8">Turn the voices you’re authorized to use into thoughtful, studio-quality audio. One calm workspace, from first sample to final file.</p>
        <div className="mt-9 flex flex-wrap items-center gap-4"><Link href="/sign-up" className="group rounded-full bg-[#20383c] px-6 py-4 text-sm font-semibold text-[#f9f5eb] shadow-[0_12px_24px_rgba(31,57,60,.13)] transition hover:-translate-y-0.5 hover:bg-[#315356]" data-testid="link-create-account">Create your workspace <ArrowRight className="ml-4 inline transition group-hover:translate-x-1" size={17} /></Link><span className="inline-flex items-center gap-2 text-xs font-medium text-[#76827e]"><ShieldCheck size={15} className="text-[#6d9c80]" />Built around consent</span></div>
        <div className="mt-14 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[#d9d9cf] pt-5 text-xs text-[#77837f]"><span className="font-mono-ui uppercase tracking-[.12em]">One workspace</span><span className="h-1 w-1 rounded-full bg-[#bdc3b9]" /><span className="min-w-0 break-words">Voice library · generation · account tools</span></div>
      </div>
      <div className="relative mx-auto w-full min-w-0 max-w-[620px] rise-in lg:mt-0" style={{ animationDelay: '.12s' }}>
        <div className="absolute -right-4 -top-8 h-44 w-44 rounded-full bg-[#e6ba91]/35 blur-3xl" />
        <div className="relative overflow-hidden rounded-[30px] border border-[#d9d7cb] bg-[#f9f7f0] p-5 shadow-[0_36px_80px_rgba(42,65,63,.13)] sm:p-7">
          <div className="flex items-start justify-between"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.17em] text-[#84908b]">Voice session · 014</p><h2 className="brand-display mt-2 text-2xl font-bold">The morning read</h2></div><span className="rounded-full border border-[#dfddd2] p-2.5 text-[#526866]" aria-hidden="true"><Play size={16} fill="currentColor" /></span></div>
          <div className="studio-grid mt-6 flex h-[185px] items-center justify-center overflow-hidden rounded-[19px] bg-[#e8eee7] px-6">
            <div className="flex h-24 w-full items-center justify-center gap-[4px]" aria-label="Decorative audio waveform">{Array.from({ length: 68 }, (_, i) => <span key={i} className="wave-bar block w-[3px] rounded-full" style={{ height: `${12 + Math.abs(Math.sin(i * .44) * Math.cos(i * .16)) * 82}px`, background: i > 48 ? '#d88a63' : '#39716b', animationDelay: `${(i % 7) * .07}s` }} />)}</div>
          </div>
          <div className="mt-5 flex items-center justify-between border-b border-[#e4e1d7] pb-5"><div><p className="text-sm font-bold">Mara · warm, measured</p><p className="mt-1 text-xs text-[#7d8984]">Narration voice · authorized sample</p></div><span className="font-mono-ui text-[11px] text-[#73817c]">00:18</span></div>
          <div className="mt-4 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f0ded0] text-[#ae6645]"><Sparkles size={17} /></div><div className="min-w-0 flex-1"><div className="flex justify-between text-xs"><span className="font-semibold">Ready for your next line</span><span className="font-mono-ui text-[#82908a]">WAV</span></div><div className="mt-2 h-1.5 rounded-full bg-[#e7e3d9]"><div className="h-full w-[72%] rounded-full bg-[#6b9b85]" /></div></div><ArrowDownToLine size={17} className="text-[#667a73]" /></div>
        </div>
        <div className="absolute -bottom-7 -left-6 hidden items-center gap-3 rounded-2xl border border-[#dedacf] bg-[#fbf9f2] px-4 py-3 shadow-[0_14px_40px_rgba(42,65,63,.1)] sm:flex"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#dce8df] text-[#4b7968]"><ShieldCheck size={17} /></span><span><span className="block text-xs font-bold">Consent, always</span><span className="mt-0.5 block text-[10px] text-[#7e8a85]">A human-first voice workflow</span></span><Check size={16} className="ml-4 text-[#6c9a81]" /></div>
      </div>
    </section>
    <section id="studio" className="mx-auto max-w-[1320px] px-6 py-24 lg:px-12 lg:py-32">
      <div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr] lg:items-end"><div><p className="font-mono-ui text-[11px] uppercase tracking-[.17em] text-[#bd7450]">A quieter kind of production</p><h2 className="brand-display mt-5 text-4xl font-bold leading-[1.08] sm:text-5xl">The tools you need.<br /><span className="text-[#72837e]">Nothing in the way.</span></h2></div><p className="max-w-[470px] text-[16px] leading-7 text-[#697773] lg:justify-self-end">A dedicated room for the small decisions that make audio feel finished: a voice that fits, a script with its own cadence, and a clean export ready to go.</p></div>
      <div className="mt-14 grid gap-4 md:grid-cols-3">
        {[{ n: '01', icon: <Headphones size={20} />, title: 'Your voice library', body: 'Find the right presence for every project. Keep the voices you use close and organized.' }, { n: '02', icon: <WandSparkles size={20} />, title: 'A considered take', body: 'Shape stability, likeness and delivery. Then generate the line, with the controls in reach.' }, { n: '03', icon: <FileAudio2 size={20} />, title: 'Ready to deliver', body: 'Listen back in the room and download the audio file directly. No extra handoff.' }].map((item) => <article key={item.n} className="group rounded-[22px] border border-[#dedbd1] bg-[#fbf9f3] p-7 transition hover:-translate-y-1 hover:border-[#c6cabe]"><div className="flex items-center justify-between"><span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[#e8eee7] text-[#3f7068]">{item.icon}</span><span className="font-mono-ui text-[11px] text-[#a1a8a0]">{item.n} / 03</span></div><h3 className="brand-display mt-7 text-xl font-bold">{item.title}</h3><p className="mt-3 text-sm leading-6 text-[#75817d]">{item.body}</p></article>)}
      </div>
    </section>
    <section id="workflow" className="relative overflow-hidden bg-[#20383c] px-6 py-24 text-[#f5f0e4] lg:py-28"><div className="absolute right-[-7rem] top-[-10rem] h-[34rem] w-[34rem] rounded-full border border-[#52706d]/35" /><div className="absolute right-[-4rem] top-[-7rem] h-[28rem] w-[28rem] rounded-full border border-[#52706d]/35" /><div className="relative mx-auto grid max-w-[1260px] gap-12 lg:grid-cols-[.85fr_1.15fr]"><div><p className="font-mono-ui text-[11px] uppercase tracking-[.17em] text-[#e0a17c]">A simple rhythm</p><h2 className="brand-display mt-5 max-w-[480px] text-4xl font-bold leading-[1.06] sm:text-5xl">From sample<br />to sound, with care.</h2><p className="mt-6 max-w-[410px] leading-7 text-[#bdc9c0]">Use voices responsibly. Every clone begins with an explicit confirmation that you have the right to use the recording.</p></div><div className="grid gap-0 self-center">{[{ n: '01', title: 'Choose or create', body: 'Select a voice or upload an authorized audio sample.' }, { n: '02', title: 'Write the words', body: 'Bring your script and tune how it should be delivered.' }, { n: '03', title: 'Listen, then download', body: 'Preview the rendered audio and take the file with you.' }].map((item) => <div key={item.n} className="flex gap-5 border-b border-[#506765]/70 py-5 first:pt-0 last:border-0"><span className="font-mono-ui pt-1 text-[11px] text-[#d99a75]">{item.n}</span><div><h3 className="font-semibold">{item.title}</h3><p className="mt-1 text-sm text-[#b8c6bd]">{item.body}</p></div><ArrowRight size={16} className="ml-auto mt-1 text-[#809b8f]" /></div>)}</div></div></section>
    <section id="principles" className="mx-auto max-w-[1320px] px-6 py-24 lg:px-12 lg:py-28"><div className="grid gap-12 border-b border-[#dbd8ce] pb-16 lg:grid-cols-[1fr_1.3fr]"><div><p className="font-mono-ui text-[11px] uppercase tracking-[.17em] text-[#bd7450]">Studio standard</p><h2 className="brand-display mt-5 text-4xl font-bold">Respect is part<br />of the signal.</h2></div><div className="grid gap-8 sm:grid-cols-2"><div><ShieldCheck className="text-[#62947e]" size={22} /><h3 className="mt-4 font-bold">Permission, before production</h3><p className="mt-2 text-sm leading-6 text-[#73807b]">A voice is someone’s identity. Cloning asks you to confirm you have rights and consent first.</p></div><div><Volume2 className="text-[#c47b57]" size={22} /><h3 className="mt-4 font-bold">Quality you can hear</h3><p className="mt-2 text-sm leading-6 text-[#73807b]">Purposeful controls and instant playback keep the focus on how the words actually sound.</p></div></div></div><div className="flex flex-col gap-5 pt-8 text-xs text-[#83908b] sm:flex-row sm:items-center sm:justify-between"><Logo /><span>Quiet tools for thoughtful audio.</span><span className="font-mono-ui">{health.isError ? 'STUDIO STATUS · CHECKING' : 'VOICE STUDIO · READY'}</span></div></section>
  </main>;
}

function SignInPage() {
  return <AuthFrame><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></AuthFrame>;
}
function SignUpPage() {
  return <AuthFrame><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></AuthFrame>;
}
function AuthFrame({ children }: { children: ReactNode }) {
  return <main className="studio-grid flex min-h-[100dvh] flex-col items-center justify-center bg-[#f1efe7] px-4 py-12"><div className="mb-8"><Link href="/" data-testid="link-auth-home"><Logo /></Link></div>{children}<p className="mt-8 text-center text-xs text-[#74827d]">An intentional space for voices and stories.</p></main>;
}

function ClerkCacheSync() {
  const { addListener } = useClerk();
  const cache = useQueryClient();
  useEffect(() => addListener(() => cache.clear()), [addListener, cache]);
  return null;
}

function Guard({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { isLoaded, isSignedIn } = useAuth();
  const account = useGetAccount({ query: { enabled: !!isSignedIn, queryKey: getGetAccountQueryKey(), retry: false } });
  const [, setLocation] = useLocation();
  if (!isLoaded) return <LoadingScreen />;
  if (!isSignedIn) return <Redirect to="/" />;
  if (account.isLoading) return <LoadingScreen />;
  if (account.isError) return <main className="flex min-h-[100dvh] items-center justify-center p-8"><div className="max-w-sm rounded-2xl border border-[#dfd9cb] bg-[#fbf9f3] p-8 text-center"><ShieldCheck size={27} className="mx-auto text-[#b97250]" /><h1 className="brand-display mt-4 text-2xl font-bold">Workspace unavailable</h1><p className="mt-2 text-sm leading-6 text-[#74817c]">We could not load your account. Try again in a moment.</p><button onClick={() => account.refetch()} className="mt-5 rounded-full bg-[#20383c] px-5 py-2.5 text-sm font-semibold text-white" data-testid="button-retry-account">Try again</button></div></main>;
  if (admin && account.data?.role !== 'admin') return <Redirect to="/studio" />;
  return <>{children}</>;
}

function AppShell({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const account = useGetAccount({ query: { queryKey: getGetAccountQueryKey() } });
  const { signOut } = useClerk();
  const [menuOpen, setMenuOpen] = useState(false);
  const isAdmin = account.data?.role === 'admin';
  const nav = [{ href: '/studio', label: 'Voice studio', icon: <Mic2 size={17} /> }, ...(account.data?.role === 'admin' ? [{ href: '/admin', label: 'Administration', icon: <LayoutDashboard size={17} /> }] : [])];
  return <div className="min-h-[100dvh] bg-[#f6f4ed] text-[#20383c]">
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-[248px] flex-col bg-[#20383c] px-5 py-6 text-[#f5f1e6] md:flex">
      <Link href="/studio" className="mb-10 px-2" data-testid="link-studio-brand"><Logo inverse /></Link>
      <p className="px-3 font-mono-ui text-[9px] uppercase tracking-[.18em] text-[#849994]">Workspace</p>
      <nav className="mt-3 space-y-1">{nav.map((item) => <Link key={item.href} href={item.href} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-[13px] font-semibold transition ${admin === (item.href === '/admin') ? 'bg-[#365451] text-[#fff8eb]' : 'text-[#afc0b8] hover:bg-[#2b4848] hover:text-white'}`} data-testid={`link-nav-${item.href.slice(1)}`}>{item.icon}{item.label}</Link>)}</nav>
      <div className="mt-9 rounded-2xl border border-[#48605d] bg-[#294447] p-4"><div className="flex items-center gap-2 text-[#e2aa85]"><Zap size={15} /><span className="font-mono-ui text-[10px] uppercase tracking-[.14em]">Your balance</span></div><p className="mt-3 text-2xl font-bold tracking-tight" data-testid="text-token-balance">{isAdmin ? 'Unlimited' : (account.data?.tokenBalance ?? 0).toLocaleString()} <span className="text-sm font-medium text-[#a9b8b0]">tokens</span></p><p className="mt-1 text-[10px] text-[#9db0a8]">{isAdmin ? 'Administrator · no token deductions' : 'Used as you generate audio'}</p></div>
      <div className="mt-auto border-t border-[#405a57] pt-4"><div className="flex items-center gap-3 px-2"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#d88a63] text-xs font-bold text-[#20383c]">{account.data?.displayName?.slice(0, 1).toUpperCase() ?? 'V'}</span><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{account.data?.displayName || 'Your workspace'}</p><p className="truncate text-[10px] text-[#a1b1a9]">{account.data?.email}</p></div><button onClick={() => signOut({ redirectUrl: basePath || '/' })} aria-label="Sign out" className="rounded-lg p-2 text-[#a9b8b0] hover:bg-[#365451] hover:text-white" data-testid="button-sign-out"><LogOut size={16} /></button></div></div>
    </aside>
    <header className="sticky top-0 z-10 flex h-[65px] items-center justify-between border-b border-[#dedbd1] bg-[#f7f5ee]/95 px-5 backdrop-blur md:ml-[248px] md:px-9"><Link href="/studio" className="md:hidden" data-testid="link-mobile-logo"><Logo /></Link><div className="hidden items-center gap-2 text-[11px] text-[#80908a] md:flex"><span className="h-1.5 w-1.5 rounded-full bg-[#76a287]" />Private studio <span className="mx-1 text-[#c1c5bc]">/</span> {admin ? 'Administration' : 'Voice workspace'}</div><button onClick={() => setMenuOpen(!menuOpen)} className="flex items-center gap-2 rounded-full border border-[#dedbd1] bg-[#fbf9f3] px-3 py-2 text-xs font-semibold md:hidden" data-testid="button-mobile-menu"><Menu size={15} /> Menu <ChevronDown size={13} /></button><div className="hidden items-center gap-3 md:flex"><span className="font-mono-ui text-[10px] uppercase tracking-[.14em] text-[#89938d]">{admin ? 'Admin console' : 'Session secure'}</span><span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e4ece4] text-[#477467]"><ShieldCheck size={16} /></span></div>
      {menuOpen && <div className="absolute left-3 right-3 top-[58px] rounded-2xl border border-[#dedbd1] bg-[#fbf9f3] p-2 shadow-xl md:hidden">{nav.map((item) => <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold hover:bg-[#eeece3]" data-testid={`link-mobile-${item.href.slice(1)}`}>{item.icon}{item.label}</Link>)}<button onClick={() => signOut({ redirectUrl: basePath || '/' })} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm text-[#9d544a]" data-testid="button-mobile-sign-out"><LogOut size={16} /> Sign out</button></div>}
    </header>
    <main className="mx-auto max-w-[1520px] px-5 py-7 md:ml-[248px] md:px-9 md:py-9">{children}</main>
  </div>;
}

function SectionHeading({ overline, title, detail, action }: { overline: string; title: string; detail: string; action?: ReactNode }) {
  return <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.17em] text-[#b87552]">{overline}</p><h1 className="brand-display mt-2 text-[34px] font-bold leading-tight tracking-tight sm:text-[40px]">{title}</h1><p className="mt-2 max-w-xl text-sm text-[#73817d]">{detail}</p></div>{action}</div>;
}

function ErrorNotice({ retry }: { retry: () => void }) {
  return <div className="flex flex-col items-start gap-3 rounded-2xl border border-[#e1c9bd] bg-[#f7eee7] p-5 sm:flex-row sm:items-center"><div className="flex-1"><p className="text-sm font-bold text-[#844a3b]">This part of the studio didn’t load.</p><p className="mt-1 text-xs text-[#907368]">Your work is safe. Check your connection and try once more.</p></div><button onClick={retry} className="rounded-full border border-[#d9b7a6] px-4 py-2 text-xs font-bold text-[#844a3b] hover:bg-[#f1e2d8]" data-testid="button-retry-query">Retry</button></div>;
}

function apiErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'data' in error) {
    const data = (error as { data?: unknown }).data;
    if (data && typeof data === 'object' && 'error' in data) {
      const message = (data as { error?: unknown }).error;
      if (typeof message === 'string') return message;
    }
  }
  return fallback;
}

function VoiceCard({ voice, selected, onSelect, onPreview, onDelete, deleting }: {
  voice: Voice;
  selected: boolean;
  onSelect: () => void;
  onPreview: (url: string) => void;
  onDelete?: () => void;
  deleting?: boolean;
}) {
  return <article className={`rounded-2xl border bg-[#fbf9f3] p-4 transition ${selected ? 'border-[#bd7551] ring-1 ring-[#bd7551]/25' : 'border-[#dfdcd2] hover:border-[#bbc7bd]'}`} data-testid={`card-voice-${voice.voiceId}`}>
    <div className="flex items-start justify-between">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e7eee7] text-[#4d796d]"><AudioLines size={18} /></span>
      <div className="flex items-center gap-2">
        {voice.previewUrl && <button onClick={() => onPreview(voice.previewUrl!)} className="rounded-full border border-[#dddcd2] p-2 text-[#526b64] hover:bg-[#edf0e9]" aria-label={`Play ${voice.name} preview`} data-testid={`button-preview-${voice.voiceId}`}><Play size={14} fill="currentColor" /></button>}
        {voice.isAppClone && onDelete && <button onClick={onDelete} disabled={deleting} className="rounded-full border border-[#ead7ce] p-2 text-[#a45e4b] hover:bg-[#f5e8e2] disabled:opacity-50" aria-label={`Delete cloned voice ${voice.name}`} title="Delete cloned voice" data-testid={`button-delete-voice-${voice.voiceId}`}><Trash2 size={14} /></button>}
      </div>
    </div>
    <h3 className="mt-4 text-sm font-bold">{voice.name}</h3>
    <p className="mt-1 line-clamp-2 min-h-9 text-xs leading-5 text-[#7a8680]">{voice.description || 'A voice ready for your next script.'}</p>
    <div className="mt-4 flex items-center justify-between">
      <span className="rounded-full bg-[#ecefe7] px-2.5 py-1 text-[10px] font-semibold text-[#657b71]">{voice.isAppClone ? 'Cloned voice' : voice.category}</span>
      <button onClick={onSelect} className={`rounded-full px-3 py-1.5 text-[10px] font-bold ${selected ? 'bg-[#e8d5c7] text-[#93583b]' : 'bg-[#20383c] text-[#f9f5e9] hover:bg-[#365451]'}`} data-testid={`button-select-${voice.voiceId}`}>{selected ? 'Selected' : 'Use voice'}</button>
    </div>
  </article>;
}

function StudioPage() {
  const voices = useListVoices();
  const models = useListVoiceModels();
  const generation = useGenerateSpeech();
  const clone = useCloneVoice();
  const deleteVoice = useDeleteVoice();
  const cache = useQueryClient();
  const account = useGetAccount();
  const [voiceId, setVoiceId] = useState('');
  const [text, setText] = useState('');
  const [modelId, setModelId] = useState('');
  const [stability, setStability] = useState(.5);
  const [similarity, setSimilarity] = useState(.75);
  const [style, setStyle] = useState(.2);
  const [speakerBoost, setSpeakerBoost] = useState(true);
  const [showClone, setShowClone] = useState(false);
  const [cloneName, setCloneName] = useState('');
  const [cloneDescription, setCloneDescription] = useState('');
  const [cloneFile, setCloneFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [generated, setGenerated] = useState<SpeechGeneration | null>(null);
  const [previewAudio, setPreviewAudio] = useState('');
  const [formError, setFormError] = useState('');
  const voiceList = voices.data ?? [];
  const modelList = models.data ?? [];
  const outputUrl = generated ? `data:${generated.mimeType};base64,${generated.audioBase64}` : '';
  const fileToBase64 = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(new Error('Could not read audio file.'));
    reader.readAsDataURL(file);
  });
  const doGenerate = () => {
    setFormError('');
    if (!voiceId || !modelId || !text.trim()) { setFormError('Choose a voice and model, then add your script.'); return; }
    generation.mutate({ data: { voiceId, text: text.trim(), modelId, stability, similarityBoost: similarity, style, useSpeakerBoost: speakerBoost } }, {
      onSuccess: (result) => { setGenerated(result); cache.invalidateQueries({ queryKey: getGetAccountQueryKey() }); },
      onError: (error) => setFormError(apiErrorMessage(error, 'Audio could not be generated. Please try again.')),
    });
  };
  const doClone = async () => {
    setFormError('');
    if (!cloneName.trim() || !cloneFile || !consent) { setFormError('Add a name, upload audio and confirm you have permission to use it.'); return; }
    try {
      const audioBase64 = await fileToBase64(cloneFile);
      const extension = cloneFile.name.toLowerCase().split('.').pop();
      const detectedType = cloneFile.type || (extension === 'mp3' ? 'audio/mpeg' : extension === 'wav' ? 'audio/wav' : extension === 'm4a' ? 'audio/mp4' : extension === 'webm' ? 'audio/webm' : '');
      if (!['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/webm'].includes(detectedType)) { setFormError('Choose an MP3, WAV, MP4 or WebM audio file.'); return; }
      if (audioBase64.length < 1000 || audioBase64.length > 14680064) { setFormError('This audio sample is too small or too large. Choose a sample that fits the 14 MB upload limit.'); return; }
      clone.mutate({ data: { name: cloneName.trim(), description: cloneDescription.trim(), fileName: cloneFile.name, mimeType: detectedType as 'audio/mpeg' | 'audio/wav' | 'audio/x-wav' | 'audio/mp4' | 'audio/webm', audioBase64, consentAcknowledged: true } }, {
        onSuccess: (newVoice) => { cache.invalidateQueries({ queryKey: getListVoicesQueryKey() }); setVoiceId(newVoice.voiceId); setShowClone(false); setCloneName(''); setCloneDescription(''); setCloneFile(null); setConsent(false); },
        onError: (error) => setFormError(apiErrorMessage(error, 'Voice sample could not be added. Confirm the file is a supported audio format.')),
      });
    } catch { setFormError('The audio file could not be read. Please select it again.'); }
  };
  const removeClone = (voice: Voice) => {
    if (!voice.isAppClone) return;
    if (!window.confirm(`Delete “${voice.name}”? This permanently removes the cloned voice from ElevenLabs, so workspace members who use it will lose access.`)) return;
    setFormError('');
    deleteVoice.mutate({ voiceId: voice.voiceId }, {
      onSuccess: () => {
        cache.invalidateQueries({ queryKey: getListVoicesQueryKey() });
        if (voiceId === voice.voiceId) setVoiceId('');
        setPreviewAudio('');
      },
      onError: (error) => setFormError(apiErrorMessage(error, 'The cloned voice could not be deleted.')),
    });
  };
  const isAdmin = account.data?.role === 'admin';
  return <AppShell><SectionHeading overline="Your creative workspace" title="Voice studio" detail="Find a voice, make the read yours, and leave with a finished file." action={<div className="flex items-center gap-2 rounded-full border border-[#ddd9cf] bg-[#fbf9f3] px-4 py-2.5 text-xs"><span className="h-2 w-2 rounded-full bg-[#74a187]" /><span className="text-[#71807a]">Available</span><strong className="font-mono-ui">{isAdmin ? 'Unlimited' : `${(account.data?.tokenBalance ?? 0).toLocaleString()} tokens`}</strong></div>} />
    <TokenPackagesPanel />
    {formError && <div role="alert" className="mb-6 flex items-start justify-between rounded-xl border border-[#e2c9bc] bg-[#f8eee7] px-4 py-3 text-sm text-[#89533e]" data-testid="status-studio-error"><span>{formError}</span><button onClick={() => setFormError('')} aria-label="Dismiss" data-testid="button-dismiss-error"><X size={16} /></button></div>}
    <div className="grid gap-6 xl:grid-cols-[1fr_390px]">
      <div className="space-y-6">
        <section className="rounded-[22px] border border-[#dfdcd2] bg-[#fbf9f3] p-5 sm:p-7">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><div className="flex items-center gap-2"><span className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[#bc7653]">01 / Select a voice</span><span className="rounded-full bg-[#e9eee7] px-2 py-1 text-[9px] font-semibold text-[#618071]">{voiceList.length} voices</span></div><h2 className="brand-display mt-2 text-xl font-bold">Who’s speaking?</h2></div><button onClick={() => { setShowClone(!showClone); setFormError(''); }} className="inline-flex items-center justify-center gap-2 rounded-full bg-[#20383c] px-5 py-3 text-xs font-bold text-[#f8f4e9] shadow-sm transition hover:bg-[#365451]" data-testid="button-toggle-clone"><Plus size={15} /> Add or clone a voice</button></div>
          {showClone && <div className="mt-5 rounded-[18px] border border-[#d6dfd5] bg-[#f1f4ec] p-5">
            <div className="flex items-start justify-between"><div><h3 className="text-sm font-bold">Create a cloned voice</h3><p className="mt-1 text-xs text-[#74827a]">Use an authorized recording · MP3, WAV, MP4 or WebM · up to 14 MB</p></div><button onClick={() => setShowClone(false)} aria-label="Close voice creation" className="rounded-lg p-1 text-[#71807a]" data-testid="button-close-clone"><X size={17} /></button></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold">Voice name<input value={cloneName} onChange={(e) => setCloneName(e.target.value)} maxLength={80} className="mt-1.5 w-full rounded-xl border border-[#d9d9cf] bg-[#fbfaf5] px-3 py-2.5 text-sm outline-none focus:border-[#bd7551]" placeholder="Name this voice" data-testid="input-clone-name" /></label><label className="text-xs font-semibold">Description <span className="font-normal text-[#839089]">optional</span><input value={cloneDescription} onChange={(e) => setCloneDescription(e.target.value)} maxLength={500} className="mt-1.5 w-full rounded-xl border border-[#d9d9cf] bg-[#fbfaf5] px-3 py-2.5 text-sm outline-none focus:border-[#bd7551]" placeholder="A few words about the voice" data-testid="input-clone-description" /></label></div>
            <label className="mt-3 block text-xs font-semibold">Authorized voice sample<input type="file" accept="audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/webm,.mp3,.wav,.m4a,.webm" onChange={(e) => setCloneFile(e.target.files?.[0] ?? null)} className="mt-1.5 block w-full cursor-pointer rounded-xl border border-dashed border-[#bbc9bc] bg-[#fbfaf5] px-3 py-3 text-xs text-[#73817b] file:mr-3 file:rounded-full file:border-0 file:bg-[#e5ede5] file:px-3 file:py-1.5 file:text-[11px] file:font-bold file:text-[#46685d]" data-testid="input-clone-audio" /></label>
            {cloneFile && <p className="mt-2 text-xs text-[#54796d]" data-testid="text-clone-filename">{cloneFile.name} · {(cloneFile.size / 1024 / 1024).toFixed(1)} MB</p>}
            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-[#e1ddd2] bg-[#fbfaf5] p-3 text-xs leading-5 text-[#63736d]"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 accent-[#527f70]" data-testid="input-clone-consent" /><span>I confirm that I have the rights and permission to create and use a voice model from this recording.</span></label>
            <button onClick={doClone} disabled={clone.isPending} className="mt-4 rounded-full bg-[#20383c] px-5 py-2.5 text-xs font-bold text-white disabled:opacity-50" data-testid="button-create-clone">{clone.isPending ? 'Creating clone…' : 'Create clone'}</button>
          </div>}
          <div className="mt-5">{voices.isLoading ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[1,2,3].map((n) => <div key={n} className="h-[190px] animate-pulse rounded-2xl bg-[#eeece4]" />)}</div> : voices.isError ? <ErrorNotice retry={() => voices.refetch()} /> : voiceList.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{voiceList.map((voice) => <VoiceCard key={voice.voiceId} voice={voice} selected={voice.voiceId === voiceId} onSelect={() => setVoiceId(voice.voiceId)} onPreview={setPreviewAudio} onDelete={() => removeClone(voice)} deleting={deleteVoice.isPending} />)}</div> : <div className="rounded-2xl border border-dashed border-[#d8d7cd] px-5 py-8 text-center"><Headphones className="mx-auto text-[#91a198]" size={22} /><p className="mt-3 text-sm font-semibold">Your voice library is waiting</p><p className="mt-1 text-xs text-[#819089]">Add an authorized voice sample to get started.</p></div>}</div>
        </section>
        <section className="rounded-[22px] border border-[#dfdcd2] bg-[#fbf9f3] p-5 sm:p-7">
          <div className="flex items-center gap-2"><span className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[#bc7653]">02 / Write your script</span><span className="ml-auto font-mono-ui text-[10px] text-[#83908a]">{text.length.toLocaleString()} / 5,000</span></div><h2 className="brand-display mt-2 text-xl font-bold">What should they say?</h2>
          <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 5000))} placeholder="Paste or write your script here. A little punctuation gives the voice room to breathe…" rows={6} className="mt-4 w-full resize-y rounded-2xl border border-[#dddad0] bg-[#f8f6ef] p-4 text-sm leading-7 text-[#2c4244] outline-none placeholder:text-[#9aa39c] focus:border-[#bd7551] focus:ring-2 focus:ring-[#bd7551]/10" data-testid="input-script" />
          <div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-xs font-semibold text-[#60716b]">Voice model<select value={modelId} onChange={(e) => setModelId(e.target.value)} className="mt-1.5 w-full rounded-xl border border-[#dddad0] bg-[#f8f6ef] px-3 py-3 text-sm text-[#20383c] outline-none focus:border-[#bd7551]" data-testid="select-model"><option value="">Select a model</option>{modelList.map((m) => <option key={m.modelId} value={m.modelId}>{m.name}</option>)}</select></label><div className="flex items-end text-xs leading-5 text-[#828d87]">{models.isLoading ? 'Loading voice models…' : models.isError ? <div className="text-[#a45745]" role="alert" data-testid="status-model-error"><p>{apiErrorMessage(models.error, 'The voice model list could not be loaded.')}</p><button className="mt-1 underline" onClick={() => models.refetch()} data-testid="button-retry-models">Retry model list</button></div> : modelList.find((m) => m.modelId === modelId)?.description || 'Choose a model suited to your delivery.'}</div></div>
        </section>
      </div>
      <aside className="space-y-5">
        <section className="rounded-[22px] border border-[#dfdcd2] bg-[#fbf9f3] p-5 sm:p-6"><div className="flex items-center gap-2"><Settings2 size={16} className="text-[#b97552]" /><span className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[#bc7653]">03 / Fine tune</span></div><h2 className="brand-display mt-2 text-xl font-bold">Make it sound right.</h2><div className="mt-5 space-y-5">
          {[{ label: 'Stability', value: stability, set: setStability, hint: 'Expressive', low: 'More variation', high: 'More consistent' }, { label: 'Similarity', value: similarity, set: setSimilarity, hint: 'Strong likeness', low: 'Natural range', high: 'Close match' }, { label: 'Style', value: style, set: setStyle, hint: 'Subtle', low: 'Less stylized', high: 'More stylized' }].map((control) => <label key={control.label} className="block"><span className="flex items-center justify-between text-xs font-semibold"><span>{control.label}</span><span className="font-mono-ui text-[10px] text-[#77867f]">{control.hint} · {Math.round(control.value * 100)}</span></span><input type="range" min="0" max="1" step=".01" value={control.value} onChange={(e) => control.set(Number(e.target.value))} className="mt-3 w-full accent-[#bf7753]" data-testid={`range-${control.label.toLowerCase()}`} /><span className="mt-1 flex justify-between text-[9px] text-[#8a9690]"><span>{control.low}</span><span>{control.high}</span></span></label>)}
          <label className="flex items-center justify-between border-t border-[#e5e2d9] pt-4 text-xs font-semibold"><span className="flex items-center gap-2"><Volume2 size={15} className="text-[#648478]" /> Speaker boost</span><input type="checkbox" checked={speakerBoost} onChange={(e) => setSpeakerBoost(e.target.checked)} className="h-4 w-4 accent-[#527f70]" data-testid="input-speaker-boost" /></label>
        </div><button onClick={doGenerate} disabled={generation.isPending || voices.isLoading || models.isLoading} className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-[#20383c] px-5 py-3.5 text-sm font-bold text-[#f8f4e9] transition hover:bg-[#355653] disabled:cursor-not-allowed disabled:opacity-55" data-testid="button-generate-speech">{generation.isPending ? <><span className="h-4 w-4 animate-pulse rounded-full bg-[#d88a63]" /> Preparing your take…</> : <><Sparkles size={16} /> Generate speech <ArrowRight size={15} className="ml-1" /></>}</button><p className="mt-3 text-center text-[10px] text-[#87918b]">{isAdmin ? 'Administrator access is unlimited; tokens are not deducted.' : 'Billed by generated audio duration at 10 tokens per minute, prorated and rounded up.'}</p></section>
        <section className="overflow-hidden rounded-[22px] border border-[#344f50] bg-[#20383c] p-5 text-[#f7f1e4] sm:p-6"><div className="flex items-center justify-between"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[#d69a78]">Your latest take</p><h2 className="brand-display mt-2 text-xl font-bold">{generated ? 'Ready to listen.' : 'Your output, here.'}</h2></div><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#345552] text-[#e0a47e]"><FileAudio2 size={17} /></span></div>
          {generated ? <div className="mt-5" data-testid="panel-generated-audio"><div className="flex items-center gap-3"><button onClick={() => { const audio = document.getElementById('generated-audio') as HTMLAudioElement | null; if (audio) audio.paused ? audio.play() : audio.pause(); }} className="flex h-10 w-10 items-center justify-center rounded-full bg-[#d88a63] text-[#20383c]" aria-label="Play generated audio" data-testid="button-play-generated"><Play size={16} fill="currentColor" /></button><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{generated.fileName}</p><p className="mt-1 font-mono-ui text-[10px] text-[#a9b9b0]">{generated.charactersUsed.toLocaleString()} chars · {generated.durationSeconds.toFixed(1)} sec · {generated.remainingTokens === null ? 'Administrator · unlimited tokens' : `${generated.tokensUsed.toLocaleString()} tokens used · ${generated.remainingTokens.toLocaleString()} tokens left`}</p></div></div><audio id="generated-audio" controls src={outputUrl} className="mt-4 h-9 w-full" data-testid="audio-generated" /><a href={outputUrl} download={generated.fileName} className="mt-4 flex items-center justify-center gap-2 rounded-full border border-[#5a7169] px-4 py-2.5 text-xs font-bold text-[#f7f1e4] hover:bg-[#345552]" data-testid="link-download-audio"><ArrowDownToLine size={15} /> Download {generated.fileName}</a></div> : <div className="mt-5 rounded-xl border border-dashed border-[#4d6660] px-4 py-7 text-center"><AudioLines className="mx-auto text-[#789088]" size={21} /><p className="mt-3 text-xs font-semibold text-[#e9e7dc]">A little room for the sound</p><p className="mt-1 text-[10px] leading-5 text-[#a8b6ad]">Generate speech and your player<br />and download will appear here.</p></div>}
        </section>
      </aside>
    </div>
    {previewAudio && <div className="fixed bottom-4 left-4 right-4 z-30 rounded-2xl border border-[#d8d5ca] bg-[#fbf9f3] p-4 shadow-xl md:left-auto md:w-[380px]" data-testid="panel-voice-preview"><div className="mb-2 flex items-center justify-between text-xs font-semibold"><span>Voice preview</span><button onClick={() => setPreviewAudio('')} aria-label="Close preview" data-testid="button-close-preview"><X size={15} /></button></div><audio controls autoPlay src={previewAudio} className="h-9 w-full" data-testid="audio-voice-preview" /></div>}
  </AppShell>;
}

function AdminPage() {
  const summary = useGetAdminSummary();
  const [search, setSearch] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [initialTokens, setInitialTokens] = useState('1200');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const params = useMemo(() => ({ search: search.trim() || undefined }), [search]);
  const users = useListAdminUsers(params);
  const cache = useQueryClient();
  const invite = useInviteAdminUser();
  const tokens = useSetAdminUserTokens();
  const remove = useRemoveAdminUser();
  const refreshUsers = () => cache.invalidateQueries({ queryKey: getListAdminUsersQueryKey() });
  const submitInvite = () => {
    setError(''); setNotice('');
    if (!email.trim() || !displayName.trim()) { setError('Add an email address and display name.'); return; }
    invite.mutate({ data: { email: email.trim(), displayName: displayName.trim(), initialTokens: Number(initialTokens) || 0 } }, {
      onSuccess: () => { refreshUsers(); cache.invalidateQueries({ queryKey: getGetAdminSummaryQueryKey() }); setInviteOpen(false); setEmail(''); setDisplayName(''); setNotice('Invitation created.'); },
      onError: () => setError('Could not create the invitation. Check the email and try again.'),
    });
  };
  const editTokens = (id: string, current: number) => {
    const next = window.prompt('Set this account’s exact token balance:', String(current));
    if (next === null) return;
    const balance = Number(next);
    if (!Number.isInteger(balance) || balance < 0 || balance > 1_000_000_000) { setError('Enter a whole number between 0 and 1,000,000,000.'); return; }
    tokens.mutate({ id, data: { balance } }, { onSuccess: () => { refreshUsers(); cache.invalidateQueries({ queryKey: getGetAdminSummaryQueryKey() }); cache.invalidateQueries({ queryKey: getGetAccountQueryKey() }); setNotice('Token balance updated.'); }, onError: () => setError('Could not update this balance.') });
  };
  const deleteUser = (id: string, name: string) => {
    if (!window.confirm(`Remove ${name} from this workspace? This cannot be undone.`)) return;
    remove.mutate({ id }, { onSuccess: () => { refreshUsers(); cache.invalidateQueries({ queryKey: getGetAdminSummaryQueryKey() }); cache.invalidateQueries({ queryKey: getGetAccountQueryKey() }); setNotice('Account removed.'); }, onError: () => setError('Could not remove this account.') });
  };
  const summaryValues = summary.data ? [
    { label: 'Total accounts', value: summary.data.usersTotal.toLocaleString(), note: `${summary.data.activeUsers.toLocaleString()} active`, icon: <Users size={17} />, tint: 'bg-[#e4ede5] text-[#517967]' },
    { label: 'Invitations', value: summary.data.pendingInvites.toLocaleString(), note: 'Awaiting activation', icon: <Clock3 size={17} />, tint: 'bg-[#f2e6d9] text-[#b7754f]' },
    { label: 'Tokens in circulation', value: summary.data.totalTokens.toLocaleString(), note: 'Across all accounts', icon: <Zap size={17} />, tint: 'bg-[#e7e9ee] text-[#65768a]' },
    { label: 'Audio generated', value: summary.data.generatedAudio.toLocaleString(), note: 'Total generations', icon: <AudioLines size={17} />, tint: 'bg-[#e8e5ef] text-[#7b6d91]' },
  ] : [];
  return <AppShell admin><SectionHeading overline="Workspace operations" title="Administration" detail="Manage invitations, account access and token allocations." action={<button onClick={() => { setInviteOpen(!inviteOpen); setError(''); }} className="flex items-center justify-center gap-2 rounded-full bg-[#20383c] px-5 py-3 text-xs font-bold text-white hover:bg-[#365451]" data-testid="button-open-invite"><Plus size={15} /> Invite account</button>} />
    {error && <div role="alert" className="mb-4 flex justify-between rounded-xl border border-[#e1c9bd] bg-[#f8eee7] px-4 py-3 text-sm text-[#89533e]" data-testid="status-admin-error">{error}<button onClick={() => setError('')} aria-label="Dismiss message" data-testid="button-dismiss-admin-error"><X size={15} /></button></div>}
    {notice && <div role="status" className="mb-4 flex justify-between rounded-xl border border-[#ccddd0] bg-[#eaf1e9] px-4 py-3 text-sm text-[#4d7465]" data-testid="status-admin-success">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss message" data-testid="button-dismiss-admin-success"><X size={15} /></button></div>}
    {inviteOpen && <section className="mb-6 rounded-[22px] border border-[#d8ddd2] bg-[#fbf9f3] p-5 sm:p-6" data-testid="panel-invite-account"><div className="flex items-start justify-between"><div><h2 className="brand-display text-xl font-bold">Invite to your workspace</h2><p className="mt-1 text-xs text-[#7b8982]">Set a name and starting token balance.</p></div><button onClick={() => setInviteOpen(false)} aria-label="Close invitation form" data-testid="button-close-invite"><X size={17} /></button></div><div className="mt-4 grid gap-3 sm:grid-cols-3"><label className="text-xs font-semibold">Display name<input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={120} className="mt-1.5 w-full rounded-xl border border-[#dddad0] bg-[#f8f6ef] px-3 py-2.5 text-sm outline-none focus:border-[#bd7551]" placeholder="Name" data-testid="input-invite-name" /></label><label className="text-xs font-semibold">Email address<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5 w-full rounded-xl border border-[#dddad0] bg-[#f8f6ef] px-3 py-2.5 text-sm outline-none focus:border-[#bd7551]" placeholder="name@example.com" data-testid="input-invite-email" /></label><label className="text-xs font-semibold">Starting tokens<input type="number" min="0" max="1000000000" value={initialTokens} onChange={(e) => setInitialTokens(e.target.value)} className="mt-1.5 w-full rounded-xl border border-[#dddad0] bg-[#f8f6ef] px-3 py-2.5 text-sm outline-none focus:border-[#bd7551]" data-testid="input-invite-tokens" /></label></div><button onClick={submitInvite} disabled={invite.isPending} className="mt-4 rounded-full bg-[#20383c] px-5 py-2.5 text-xs font-bold text-white disabled:opacity-50" data-testid="button-submit-invite">{invite.isPending ? 'Sending invitation…' : 'Create invitation'}</button></section>}
    <section className="mb-7">{summary.isLoading ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[1,2,3,4].map((n) => <div key={n} className="h-[126px] animate-pulse rounded-2xl bg-[#eae8df]" />)}</div> : summary.isError ? <ErrorNotice retry={() => summary.refetch()} /> : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{summaryValues.map((item) => <article key={item.label} className="rounded-2xl border border-[#dfdcd2] bg-[#fbf9f3] p-5" data-testid={`card-summary-${item.label.toLowerCase().replaceAll(' ', '-')}`}><div className="flex items-start justify-between"><p className="text-xs font-medium text-[#77847e]">{item.label}</p><span className={`flex h-8 w-8 items-center justify-center rounded-xl ${item.tint}`}>{item.icon}</span></div><p className="mt-3 font-mono-ui text-[25px] leading-none tracking-tight" data-testid={`text-summary-${item.label.toLowerCase().replaceAll(' ', '-')}`}>{item.value}</p><p className="mt-2 text-[10px] text-[#909991]">{item.note}</p></article>)}</div>}</section>
    <section className="grid gap-6 xl:grid-cols-[1fr_330px]">
      <div className="overflow-hidden rounded-[22px] border border-[#dfdcd2] bg-[#fbf9f3]"><div className="flex flex-col gap-4 border-b border-[#e3e0d6] p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div><h2 className="brand-display text-xl font-bold">Accounts</h2><p className="mt-1 text-xs text-[#7c8983]">Workspace members and outstanding invitations</p></div><label className="relative block sm:w-[250px]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#95a098]" size={15} /><input value={search} onChange={(e) => setSearch(e.target.value)} type="search" placeholder="Search accounts" className="w-full rounded-full border border-[#dfdcd2] bg-[#f8f6ef] py-2.5 pl-9 pr-4 text-xs outline-none focus:border-[#bd7551]" data-testid="input-search-users" /></label></div>
        {users.isLoading ? <div className="space-y-3 p-5">{[1,2,3].map((n) => <div key={n} className="h-14 animate-pulse rounded-xl bg-[#eeece4]" />)}</div> : users.isError ? <div className="p-5"><ErrorNotice retry={() => users.refetch()} /></div> : !users.data?.length ? <div className="px-5 py-12 text-center"><Users className="mx-auto text-[#93a198]" size={24} /><p className="mt-3 text-sm font-semibold">{search ? 'No matching accounts' : 'No accounts yet'}</p><p className="mt-1 text-xs text-[#839089]">{search ? 'Try another search term.' : 'Invite someone to join this workspace.'}</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[660px] text-left"><thead className="bg-[#f4f2eb] text-[10px] font-semibold uppercase tracking-[.1em] text-[#87928b]"><tr><th className="px-6 py-3">Account</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Tokens</th><th className="px-4 py-3">Added</th><th className="px-4 py-3 text-right">Manage</th></tr></thead><tbody className="divide-y divide-[#ece9e0]">{users.data.map((user) => <tr key={user.id} className="transition hover:bg-[#f8f6ef]" data-testid={`row-admin-user-${user.id}`}><td className="px-6 py-4"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e6ede5] text-xs font-bold text-[#567b6e]">{user.displayName.slice(0,1).toUpperCase()}</span><span className="min-w-0"><span className="block truncate text-xs font-bold">{user.displayName}</span><span className="mt-1 block truncate text-[10px] text-[#8b9690]">{user.email}</span></span></div></td><td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${user.status === 'active' ? 'bg-[#e5eee6] text-[#557d6a]' : 'bg-[#f2e8d9] text-[#a87044]'}`} data-testid={`status-user-${user.id}`}>{user.status === 'active' ? 'Active' : 'Pending'}</span></td><td className="px-4 py-4 font-mono-ui text-xs">{user.tokenBalance.toLocaleString()}</td><td className="px-4 py-4 text-xs text-[#78857e]">{new Date(user.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</td><td className="px-4 py-4"><div className="flex justify-end gap-1"><button onClick={() => editTokens(user.id, user.tokenBalance)} aria-label={`Set tokens for ${user.displayName}`} className="rounded-lg border border-[#dedbd1] p-2 text-[#58726a] hover:bg-[#eaf0e9]" data-testid={`button-edit-tokens-${user.id}`}><CreditCard size={15} /></button><button onClick={() => deleteUser(user.id, user.displayName)} aria-label={`Remove ${user.displayName}`} className="rounded-lg border border-[#ead7ce] p-2 text-[#ae6956] hover:bg-[#f5e8e2]" data-testid={`button-remove-user-${user.id}`}><Trash2 size={15} /></button></div></td></tr>)}</tbody></table></div>}
      </div>
      <aside className="space-y-5"><section className="rounded-[22px] border border-[#dfdcd2] bg-[#fbf9f3] p-5"><div className="flex items-center gap-2"><Activity size={16} className="text-[#b97552]" /><h2 className="brand-display text-lg font-bold">Recent activity</h2></div><p className="mt-1 text-[10px] text-[#89938d]">Latest workspace events</p>{summary.isLoading ? <div className="mt-5 space-y-4">{[1,2,3].map((n) => <div key={n} className="h-10 animate-pulse rounded-lg bg-[#eeece4]" />)}</div> : summary.isError ? <div className="mt-4"><ErrorNotice retry={() => summary.refetch()} /></div> : summary.data?.recentActivity?.length ? <ul className="mt-5 space-y-0">{summary.data.recentActivity.map((activity) => <li key={activity.id} className="flex gap-3 border-b border-[#ece9e0] py-3 last:border-0" data-testid={`activity-${activity.id}`}><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#b77856]" /><span className="min-w-0"><span className="block text-xs leading-5 text-[#4d605b]">{activity.description}</span><time className="mt-1 block text-[10px] text-[#929c94]" dateTime={activity.createdAt}>{new Date(activity.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time></span></li>)}</ul> : <div className="py-10 text-center"><Activity className="mx-auto text-[#9ca79f]" size={21} /><p className="mt-3 text-xs font-semibold">Nothing new just yet</p><p className="mt-1 text-[10px] text-[#87938c]">Account changes will appear here.</p></div>}</section><div className="rounded-[22px] bg-[#e9eee6] p-5"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#d6e3d8] text-[#507666]"><CircleHelp size={17} /></div><h3 className="mt-4 text-sm font-bold">Keep the room considered</h3><p className="mt-2 text-xs leading-5 text-[#6f8076]">Use the account tools to manage access and maintain the right balance for each creator.</p></div></aside>
    </section>
  </AppShell>;
}

function HomeRoute() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <LoadingScreen />;
  return isSignedIn ? <Redirect to="/studio" /> : <PublicHome />;
}
function ProtectedStudio() { return <Guard><StudioPage /></Guard>; }
function ProtectedAdmin() { return <Guard admin><AdminPage /></Guard>; }

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in environment.');
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={appearance} signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} localization={{ signIn: { start: { title: 'Welcome back', subtitle: 'Sign in to return to your voice workspace.' } }, signUp: { start: { title: 'Create your workspace', subtitle: 'A thoughtful place to make beautiful audio.' } } }} routerPush={(to) => setLocation(stripBase(to))} routerReplace={(to) => setLocation(stripBase(to), { replace: true })}>
    <QueryClientProvider client={queryClient}><TooltipProvider><ClerkCacheSync /><Switch>
      <Route path="/" component={HomeRoute} />
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route path="/studio" component={ProtectedStudio} />
      <Route path="/admin" component={ProtectedAdmin} />
      <Route component={NotFound} />
    </Switch><Toaster /></TooltipProvider></QueryClientProvider>
  </ClerkProvider>;
}

function App() {
  return <WouterRouter base={basePath}><ClerkProviderWithRoutes /></WouterRouter>;
}

export default App;