# CryptoVault — React + TypeScript port

A complete React 18 + TypeScript + Vite port of the CryptoVault platform, living
side-by-side with the original vanilla site at `../`. The shared `css/style.css`
is reused as-is (copied to `public/style.css`) — only minor additive overrides
live in `src/styles/react-overrides.css`.

## Stack

- **Vite 5** + React 18.3 + TypeScript 5.5
- **react-router-dom 6** for routing
- **chart.js 4** + **react-chartjs-2 5** for charts
- React Context for auth state · `localStorage` persistence (1:1 with vanilla site)

## Getting started

```bash
cd react-app
npm install
npm run dev        # http://localhost:5173
npm run build      # tsc -b && vite build → dist/
npm run preview    # serve dist/
npm run typecheck  # strict TS check
```

## Layout

```
src/
  main.tsx              · entry point
  App.tsx               · BrowserRouter + nested layouts
  types.ts              · all data models (Account, Trade, Position, BotEvent…)
  data/markets.ts       · MARKETS, ALL_INSTRUMENTS, FUNDAMENTALS, ASSET_META
  lib/
    format.ts           · fmtPrice, fmtMoney, fmtChg, tickPrice
    auth.ts             · localStorage user + seeded account
    AuthContext.tsx     · AuthProvider + useAuth hook
    useAccount.ts       · live account state + persisting setter
    algo.ts             · Indicators / Strategies / AlgoBot / MasterAI / backtest / tuneBot
  components/
    Navbar.tsx          · public top nav (auth-aware)
    Sidebar.tsx         · in-app sidebar (auth-aware)
    PayoutBar.tsx       · live withdrawals marquee
    AnimatedBackdrop.tsx · drifting glow blobs (z:-1)
    PublicLayout.tsx    · navbar + outlet + footer
    AppLayout.tsx       · RequireAuth + sidebar + payout bar + outlet
    Toast.tsx           · ToastProvider + useToast
    KPI.tsx             · KPI card helper
    charts.ts           · Chart.js component registration
  pages/
    Home.tsx            · full landing (hero/ticker/features/heatmap/payouts/calc/FAQ/CTA)
    Dashboard.tsx       · balance/KPIs/equity chart/allocation/holdings/quick trade/history
    Trading.tsx         · live Vault AI bot · equity curve · reasoning feed · backtest/tune
    Markets.tsx         · live instruments table · detail panel · news
    Login.tsx · Signup.tsx · Account.tsx
    Deposit.tsx · Withdraw.tsx · About.tsx
  styles/
    react-overrides.css · backdrop + toast stack + auth pages (additive only)
public/
  style.css             · the shared design system, copied verbatim from ../css/
```

## Routes

| Path        | Layout         | Page       |
|-------------|----------------|------------|
| `/`         | PublicLayout   | Home       |
| `/about`    | PublicLayout   | About      |
| `/login`    | PublicLayout   | Login      |
| `/signup`   | PublicLayout   | Signup     |
| `/dashboard`| AppLayout 🔒   | Dashboard  |
| `/markets`  | AppLayout 🔒   | Markets    |
| `/trading`  | AppLayout 🔒   | Trading    |
| `/deposit`  | AppLayout 🔒   | Deposit    |
| `/withdraw` | AppLayout 🔒   | Withdraw   |
| `/account`  | AppLayout 🔒   | Account    |

🔒 routes redirect to `/login` if no user is in `localStorage`.

## Notes

- This is a faithful port: the same demo seed account, same instruments, same
  algo engine, same UI affordances. Identical localStorage keys (`cv_user`,
  `cv_account`) so users migrate seamlessly.
- The vanilla site under `../` is untouched.
