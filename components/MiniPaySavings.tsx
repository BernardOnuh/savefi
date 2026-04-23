"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  connectWallet,
  ensureCeloNetwork,
  getCUSDBalance,
  getSavingsBalance,
  depositSavings,
  withdrawSavings,
  withdrawAllSavings,
  shortenAddress,
  formatUSD,
  isMiniPayEnvironment,
} from "@/lib/minipay";
import { SavingsTx, TxStatus } from "@/lib/config";

// ─── Types ────────────────────────────────────────────────────────────────────
type AppMode = "demo" | "mainnet";

// ─── Constants ────────────────────────────────────────────────────────────────
const DEMO_INITIAL_WALLET  = 500;
const DEMO_INITIAL_SAVINGS = 0;
const DEMO_ADDRESS         = "0xDEMO...1234";

const APY_TIERS = [
  { label: "Base",    apy: 10, minDays: 0,   color: "#0cfa7fef", desc: "0–90 days"    },
  { label: "Silver",  apy: 18, minDays: 90,  color: "#e6e6e4", desc: "91–180 days"  },
  { label: "Gold",    apy: 25, minDays: 180, color: "#FBCC5C", desc: "181–365 days" },
  { label: "Diamond", apy: 30, minDays: 365, color: "#05bfd0", desc: "365+ days"    },
];

function getActiveTier(days: number) {
  return [...APY_TIERS].reverse().find((t) => days >= t.minDays) ?? APY_TIERS[0];
}
function calcProjected(principal: number, apy: number, days: number) {
  return principal * (apy / 100) * (days / 365);
}
function fakeTxHash() {
  return "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
}
function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Icons ────────────────────────────────────────────────────────────────────
const IconWallet = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
  </svg>
);
const IconArrowDown = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>
  </svg>
);
const IconArrowUp = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
  </svg>
);
const IconRefresh = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
  </svg>
);
const IconCheck = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const IconLink = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
  </svg>
);
const IconStar = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
);
const IconShield = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);
const IconX = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const Spinner = () => (
  <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeLinecap="round" opacity="0.3"/>
    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
  </svg>
);

// ─── Mode Switch Modal ────────────────────────────────────────────────────────
interface ModeSwitchModalProps {
  currentMode: AppMode;
  onClose: () => void;
  onSwitchToMainnet: () => Promise<void>;
  onSwitchToDemo: () => void;
  isConnecting: boolean;
  connectError: string;
}

function ModeSwitchModal({
  currentMode,
  onClose,
  onSwitchToMainnet,
  onSwitchToDemo,
  isConnecting,
  connectError,
}: ModeSwitchModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === overlayRef.current) onClose();
  };

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      style={{ background: "rgba(12, 12, 12, 0.75)", backdropFilter: "blur(8px)" }}
    >
      <div
        className="w-full max-w-sm mx-4 mb-4 sm:mb-0 rounded-3xl p-6 relative"
        style={{ background: "#14141a", border: "1px solid rgba(255,255,255,0.1)" }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-xl"
          style={{ background: "rgba(255, 255, 255, 0.14)", color: "rgba(255,255,255,0.5)" }}
        >
          <IconX />
        </button>

        {/* Header */}
        <div className="mb-5">
          <h2 className="text-lg font-bold mb-1" style={{ fontWeight: 800 }}>Switch Mode</h2>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
            Currently on{" "}
            <span style={{ color: currentMode === "demo" ? "#FBCC5C" : "#35D07F", fontWeight: 600 }}>
              {currentMode === "demo" ? "Demo" : "Mainnet"}
            </span>{" "}
            mode
          </p>
        </div>

        {/* Mode Cards */}
        <div className="space-y-3 mb-5">

          {/* Demo card */}
          <div
            onClick={currentMode !== "demo" ? onSwitchToDemo : undefined}
            className="rounded-2xl p-4 relative transition-all"
            style={{
              background: currentMode === "demo" ? "rgba(251,204,92,0.08)" : "rgba(255,255,255,0.03)",
              border:     currentMode === "demo" ? "1px solid rgba(251,204,92,0.35)" : "1px solid rgba(255,255,255,0.07)",
              cursor:     currentMode !== "demo" ? "pointer" : "default",
            }}
          >
            {currentMode === "demo" && (
              <span
                className="absolute top-3 right-3 text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: "rgba(251,204,92,0.2)", color: "#FBCC5C" }}
              >
                Active
              </span>
            )}
            <div className="flex items-start gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 text-base"
                style={{ background: "rgba(251,204,92,0.12)" }}
              >
                🧪
              </div>
              <div>
                <p className="text-sm font-semibold mb-1" style={{ color: "#FBCC5C" }}>Demo Mode</p>
                <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.4)" }}>
                  Simulated $500 cUSD wallet. No real funds, no wallet required. Explore safely.
                </p>
                <div className="flex gap-2 mt-2 flex-wrap">
                  {["No wallet needed", "Risk-free", "Instant"].map((f) => (
                    <span key={f} className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: "rgba(251,204,92,0.1)", color: "rgba(251,204,92,0.7)" }}>
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Mainnet card */}
          <div
            className="rounded-2xl p-4 relative"
            style={{
              background: currentMode === "mainnet" ? "rgba(53,208,127,0.08)" : "rgba(255,255,255,0.03)",
              border:     currentMode === "mainnet" ? "1px solid rgba(53,208,127,0.35)" : "1px solid rgba(255,255,255,0.07)",
            }}
          >
            {currentMode === "mainnet" && (
              <span
                className="absolute top-3 right-3 text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: "rgba(53,208,127,0.2)", color: "#35D07F" }}
              >
                Active
              </span>
            )}
            <div className="flex items-start gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: "rgba(53,208,127,0.12)", color: "#35D07F" }}
              >
                <IconShield />
              </div>
              <div>
                <p className="text-sm font-semibold mb-1" style={{ color: "#35D07F" }}>Mainnet Mode</p>
                <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.4)" }}>
                  Connect your real MiniPay wallet to save actual cUSD on Celo and earn real rewards.
                </p>
                <div className="flex gap-2 mt-2 flex-wrap">
                  {["Real cUSD", "On-chain", "MiniPay required"].map((f) => (
                    <span key={f} className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: "rgba(53,208,127,0.1)", color: "rgba(53,208,127,0.7)" }}>
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Warning when switching to mainnet */}
        {currentMode === "demo" && (
          <div
            className="rounded-2xl p-3 mb-4 flex items-start gap-2"
            style={{ background: "rgba(255,107,107,0.07)", border: "1px solid rgba(255,107,107,0.15)" }}
          >
            <span style={{ color: "#ff6b6b", fontSize: 14, lineHeight: 1.5 }}>⚠</span>
            <p className="text-xs leading-relaxed" style={{ color: "rgba(255,107,107,0.8)" }}>
              Switching to mainnet connects your real wallet. Demo progress will not carry over.
            </p>
          </div>
        )}

        {connectError && (
          <p className="text-xs mb-4 text-center" style={{ color: "#ff6b6b" }}>{connectError}</p>
        )}

        {/* CTA button */}
        {currentMode === "demo" ? (
          <button
            onClick={onSwitchToMainnet}
            disabled={isConnecting}
            className="w-full py-3.5 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-95"
            style={{
              background: isConnecting ? "rgba(53,208,127,0.3)" : "linear-gradient(135deg, #35D07F, #2bb870)",
              color: "#030305",
              boxShadow: isConnecting ? "none" : "0 0 25px rgba(53,208,127,0.25)",
            }}
          >
            {isConnecting ? <Spinner /> : <IconWallet />}
            {isConnecting ? "Connecting…" : "Connect MiniPay Wallet"}
          </button>
        ) : (
          <button
            onClick={onSwitchToDemo}
            className="w-full py-3.5 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-95"
            style={{ background: "rgba(251,204,92,0.12)", color: "#FBCC5C", border: "1px solid rgba(251,204,92,0.25)" }}
          >
            🧪 Switch to Demo Mode
          </button>
        )}

        <p className="text-center text-xs mt-3" style={{ color: "rgba(255,255,255,0.2)" }}>
          You can switch modes any time from the header
        </p>
      </div>
    </div>
  );
}

// ─── APY Projection Card ──────────────────────────────────────────────────────
function ProjectionCard({ principal }: { principal: number }) {
  const [days, setDays] = useState(30);
  const tier   = getActiveTier(days);
  const earned = calcProjected(principal, tier.apy, days);
  const total  = principal + earned;

  const presets = [
    { label: "1M", days: 30  },
    { label: "3M", days: 90  },
    { label: "6M", days: 180 },
    { label: "1Y", days: 365 },
  ];

  return (
    <div className="rounded-3xl p-5 mb-4"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>

      <div className="flex items-center justify-between mb-4">
        <p className="text-xs uppercase tracking-widest font-mono" style={{ color: "rgba(255,255,255,0.35)" }}>
          Projected Earnings
        </p>
        <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
          style={{ background: `${tier.color}18`, color: tier.color, border: `1px solid ${tier.color}33` }}>
          <IconStar /> {tier.label} · {tier.apy}% APY
        </span>
      </div>

      <div className="flex gap-2 mb-4">
        {presets.map((p) => (
          <button key={p.label} onClick={() => setDays(p.days)}
            className="flex-1 py-1.5 rounded-xl text-xs font-semibold transition-all"
            style={{
              background: days === p.days ? tier.color : "rgba(255,255,255,0.05)",
              color:      days === p.days ? "#0a0a0f"  : "rgba(255,255,255,0.4)",
            }}>
            {p.label}
          </button>
        ))}
      </div>

      <input type="range" min={1} max={365} value={days}
        onChange={(e) => setDays(Number(e.target.value))}
        className="w-full mb-4" style={{ accentColor: tier.color }} />

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl py-3 px-2" style={{ background: "rgba(255,255,255,0.04)" }}>
          <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.3)" }}>Period</p>
          <p className="font-mono text-sm font-medium">{days}d</p>
        </div>
        <div className="rounded-2xl py-3 px-2" style={{ background: `${tier.color}12`, border: `1px solid ${tier.color}25` }}>
          <p className="text-xs mb-1" style={{ color: `${tier.color}99` }}>Earned</p>
          <p className="font-mono text-sm font-medium" style={{ color: tier.color }}>+${earned.toFixed(4)}</p>
        </div>
        <div className="rounded-2xl py-3 px-2" style={{ background: "rgba(255,255,255,0.04)" }}>
          <p className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.3)" }}>Total</p>
          <p className="font-mono text-sm font-medium">${total.toFixed(2)}</p>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex justify-between text-xs mb-1.5" style={{ color: "rgba(255,255,255,0.25)" }}>
          <span>Save longer → higher APY</span>
          <span style={{ color: tier.color }}>{tier.desc}</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
          <div className="h-full rounded-full transition-all duration-300"
            style={{ width: `${Math.min((days / 365) * 100, 100)}%`, background: `linear-gradient(90deg, #35D07F, ${tier.color})` }} />
        </div>
        <div className="flex justify-between mt-1.5">
          {APY_TIERS.map((t) => (
            <span key={t.label} className="text-xs" style={{ color: days >= t.minDays ? t.color : "rgba(255,255,255,0.2)" }}>
              {t.apy}%
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function MiniPaySavings() {
  // ── Mode ─────────────────────────────────────────────────────────────────────
  const [mode, setMode]                       = useState<AppMode>("demo");
  const [showModal, setShowModal]             = useState(false);
  const [modalConnecting, setModalConnecting] = useState(false);
  const [modalError, setModalError]           = useState("");

  // ── Shared UI ─────────────────────────────────────────────────────────────────
  const [address, setAddress]               = useState<string | null>(null);
  const [cUSDBalance, setCUSDBalance]       = useState("0.00");
  const [savingsBalance, setSavingsBalance] = useState("0.00");
  const [amount, setAmount]                 = useState("");
  const [tab, setTab]                       = useState<"deposit" | "withdraw" | "rewards">("deposit");
  const [txStatus, setTxStatus]             = useState<TxStatus>("idle");
  const [txMessage, setTxMessage]           = useState("");
  const [lastTxHash, setLastTxHash]         = useState("");
  const [history, setHistory]               = useState<SavingsTx[]>([]);

  // ── Demo balances ─────────────────────────────────────────────────────────────
  const [demoWallet,  setDemoWallet]  = useState(DEMO_INITIAL_WALLET);
  const [demoSavings, setDemoSavings] = useState(DEMO_INITIAL_SAVINGS);

  // Boot into demo immediately
  useEffect(() => {
    setAddress(DEMO_ADDRESS);
    setCUSDBalance(DEMO_INITIAL_WALLET.toFixed(4));
    setSavingsBalance(DEMO_INITIAL_SAVINGS.toFixed(4));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep display in sync with demo state
  useEffect(() => {
    if (mode !== "demo") return;
    setCUSDBalance(demoWallet.toFixed(4));
    setSavingsBalance(demoSavings.toFixed(4));
  }, [mode, demoWallet, demoSavings]);

  // ── Mainnet balance refresh ───────────────────────────────────────────────────
  const refreshBalances = useCallback(async (addr: string) => {
    if (mode === "demo") return;
    try {
      const [cusd, savings] = await Promise.all([getCUSDBalance(addr), getSavingsBalance(addr)]);
      setCUSDBalance(parseFloat(cusd).toFixed(4));
      setSavingsBalance(parseFloat(savings).toFixed(4));
    } catch (e) { console.error("Balance refresh error:", e); }
  }, [mode]);

  // ── Switch to Mainnet ─────────────────────────────────────────────────────────
  const handleSwitchToMainnet = async () => {
    setModalConnecting(true);
    setModalError("");
    try {
      await ensureCeloNetwork();
      const addr = await connectWallet();
      setAddress(addr);
      setMode("mainnet");
      setHistory([]);
      setAmount("");
      resetTx();
      await refreshBalances(addr);
      setShowModal(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Connection failed";
      setModalError(msg);
    } finally {
      setModalConnecting(false);
    }
  };

  // ── Switch to Demo ────────────────────────────────────────────────────────────
  const handleSwitchToDemo = () => {
    setMode("demo");
    setAddress(DEMO_ADDRESS);
    setDemoWallet(DEMO_INITIAL_WALLET);
    setDemoSavings(DEMO_INITIAL_SAVINGS);
    setHistory([]);
    setAmount("");
    resetTx();
    setShowModal(false);
    setModalError("");
  };

  // ── Deposit ───────────────────────────────────────────────────────────────────
  const handleDeposit = async () => {
    if (!address || !amount || parseFloat(amount) <= 0) return;

    if (mode === "demo") {
      const v = parseFloat(amount);
      if (v > demoWallet) { setTxStatus("error"); setTxMessage("Insufficient wallet balance."); return; }
      setTxStatus("approving");  setTxMessage("Approving cUSD spend…");
      await sleep(600);
      setTxStatus("depositing"); setTxMessage("Depositing to savings…");
      await sleep(700);
      const hash = fakeTxHash();
      setDemoWallet((w) => parseFloat((w - v).toFixed(6)));
      setDemoSavings((s) => parseFloat((s + v).toFixed(6)));
      setLastTxHash(hash);
      setTxStatus("success");
      setTxMessage("Deposit successful! (simulated)");
      setHistory((prev) => [{ type: "deposit" as const, amount, hash, timestamp: Date.now() }, ...prev].slice(0, 10));
      setAmount("");
      return;
    }

    setTxStatus("approving"); setTxMessage("Approving cUSD spend…");
    try {
      const hash = await depositSavings(
        amount,
        () => { setTxStatus("approving");  setTxMessage("Approving cUSD spend…"); },
        () => { setTxStatus("depositing"); setTxMessage("Depositing to savings…"); }
      );
      setLastTxHash(hash);
      setTxStatus("success");
      setTxMessage("Deposit successful!");
      setHistory((prev) => [{ type: "deposit" as const, amount, hash, timestamp: Date.now() }, ...prev].slice(0, 10));
      setAmount("");
      await refreshBalances(address);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Transaction failed";
      setTxStatus("error");
      setTxMessage(msg.length > 80 ? msg.slice(0, 80) + "…" : msg);
    }
  };

  // ── Withdraw ──────────────────────────────────────────────────────────────────
  const handleWithdraw = async () => {
    if (!address || !amount || parseFloat(amount) <= 0) return;

    if (mode === "demo") {
      const v = parseFloat(amount);
      if (v > demoSavings) { setTxStatus("error"); setTxMessage("Insufficient savings balance."); return; }
      setTxStatus("withdrawing"); setTxMessage("Withdrawing from savings…");
      await sleep(800);
      const hash = fakeTxHash();
      setDemoSavings((s) => parseFloat((s - v).toFixed(6)));
      setDemoWallet((w) => parseFloat((w + v).toFixed(6)));
      setLastTxHash(hash);
      setTxStatus("success");
      setTxMessage("Withdrawal successful! (simulated)");
      setHistory((prev) => [{ type: "withdraw" as const, amount, hash, timestamp: Date.now() }, ...prev].slice(0, 10));
      setAmount("");
      return;
    }

    setTxStatus("withdrawing"); setTxMessage("Withdrawing from savings…");
    try {
      const hash = await withdrawSavings(amount);
      setLastTxHash(hash);
      setTxStatus("success");
      setTxMessage("Withdrawal successful!");
      setHistory((prev) => [{ type: "withdraw" as const, amount, hash, timestamp: Date.now() }, ...prev].slice(0, 10));
      setAmount("");
      await refreshBalances(address);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Transaction failed";
      setTxStatus("error");
      setTxMessage(msg.length > 80 ? msg.slice(0, 80) + "…" : msg);
    }
  };

  // ── Withdraw All ──────────────────────────────────────────────────────────────
  const handleWithdrawAll = async () => {
    if (!address) return;

    if (mode === "demo") {
      const v = demoSavings;
      if (v <= 0) return;
      setTxStatus("withdrawing"); setTxMessage("Withdrawing all savings…");
      await sleep(800);
      const hash = fakeTxHash();
      setDemoWallet((w) => parseFloat((w + v).toFixed(6)));
      setDemoSavings(0);
      setLastTxHash(hash);
      setTxStatus("success");
      setTxMessage("All savings withdrawn! (simulated)");
      setHistory((prev) => [{ type: "withdraw" as const, amount: String(v), hash, timestamp: Date.now() }, ...prev].slice(0, 10));
      return;
    }

    setTxStatus("withdrawing"); setTxMessage("Withdrawing all savings…");
    try {
      const hash = await withdrawAllSavings();
      setLastTxHash(hash);
      setTxStatus("success");
      setTxMessage("All savings withdrawn!");
      setHistory((prev) => [{ type: "withdraw" as const, amount: savingsBalance, hash, timestamp: Date.now() }, ...prev].slice(0, 10));
      await refreshBalances(address);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Transaction failed";
      setTxStatus("error");
      setTxMessage(msg.length > 80 ? msg.slice(0, 80) + "…" : msg);
    }
  };

  const resetTx    = () => { setTxStatus("idle"); setTxMessage(""); };
  const isBusy     = ["approving", "depositing", "withdrawing"].includes(txStatus);
  const isDemo     = mode === "demo";
  const savingsNum = parseFloat(savingsBalance) || 0;

  if (!address) {
    return <div className="min-h-screen flex items-center justify-center"><Spinner /></div>;
  }

  // ─── MAIN APP ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col relative z-10">
      {/* Ambient glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full"
          style={{ background: `radial-gradient(circle, ${isDemo ? "rgba(251,204,92,0.05)" : "rgba(53,208,127,0.06)"} 0%, transparent 70%)` }} />
      </div>

      {/* Mode Switch Modal */}
      {showModal && (
        <ModeSwitchModal
          currentMode={mode}
          onClose={() => { setShowModal(false); setModalError(""); }}
          onSwitchToMainnet={handleSwitchToMainnet}
          onSwitchToDemo={handleSwitchToDemo}
          isConnecting={modalConnecting}
          connectError={modalError}
        />
      )}

      {/* ── Header ── */}
      <header className="px-5 pt-10 pb-4 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight" style={{ fontWeight: 800 }}>
            Save<span style={{ color: "#35D07F" }}>Celo</span>
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
            {isDemo ? DEMO_ADDRESS : shortenAddress(address)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Mode pill — opens modal */}
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95"
            style={{
              background: isDemo ? "rgba(251,204,92,0.12)" : "rgba(53,208,127,0.12)",
              color:      isDemo ? "#FBCC5C"               : "#35D07F",
              border:     isDemo ? "1px solid rgba(251,204,92,0.25)" : "1px solid rgba(53,208,127,0.25)",
            }}
          >
            <span>{isDemo ? "🧪" : "🔗"}</span>
            <span>{isDemo ? "Demo" : "Mainnet"}</span>
            <span style={{ opacity: 0.45 }}>↕</span>
          </button>

          {/* Refresh (mainnet only) */}
          {!isDemo && (
            <button
              onClick={() => refreshBalances(address)}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-90"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}
            >
              <IconRefresh />
            </button>
          )}
        </div>
      </header>

      {/* Demo strip */}
      {isDemo && (
        <div
          className="mx-5 mb-3 flex items-center justify-between py-2 px-4 rounded-2xl text-xs"
          style={{ background: "rgba(251,204,92,0.07)", border: "1px solid rgba(251,204,92,0.15)" }}
        >
          <span style={{ color: "rgba(251,204,92,0.7)" }}>🧪 Simulated funds · No real transactions</span>
          <button onClick={() => setShowModal(true)} className="font-semibold" style={{ color: "#FBCC5C" }}>
            Go Live →
          </button>
        </div>
      )}

      {/* ── Balance Cards ── */}
      <div className="px-5 pb-4 space-y-3">
        <div className="rounded-3xl p-5 relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, rgba(53,208,127,0.15), rgba(53,208,127,0.05))", border: "1px solid rgba(53,208,127,0.2)" }}>
          <div className="shimmer absolute inset-0 rounded-3xl pointer-events-none" />
          <p className="text-xs uppercase tracking-widest mb-2 font-mono" style={{ color: "rgba(53,208,127,0.7)" }}>
            Total Saved{isDemo && <span style={{ color: "rgba(251,204,92,0.5)" }}> · demo</span>}
          </p>
          <div className="flex items-end gap-2">
            <span className="font-display text-4xl font-bold" style={{ fontWeight: 800, color: "#35D07F" }}>
              ${formatUSD(savingsBalance)}
            </span>
            <span className="text-sm mb-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>cUSD</span>
          </div>
          {savingsNum > 0 && (
            <div className="mt-3 flex items-center gap-2">
              <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{ background: "rgba(53,208,127,0.15)", color: "#35D07F", border: "1px solid rgba(53,208,127,0.25)" }}>
                <IconStar /> {getActiveTier(0).apy}% APY · {isDemo ? "Simulated" : "Earning now"}
              </span>
            </div>
          )}
        </div>

        <div className="rounded-2xl px-5 py-4 flex items-center justify-between"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <div>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>Wallet Balance</p>
            <p className="font-mono text-lg font-medium mt-0.5">
              ${formatUSD(cUSDBalance)} <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>cUSD</span>
            </p>
          </div>
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(251,204,92,0.1)", border: "1px solid rgba(251,204,92,0.2)" }}>
            <span style={{ color: "#FBCC5C" }}>◈</span>
          </div>
        </div>
      </div>

      {/* ── Action Card ── */}
      <div className="flex-1 mx-4 rounded-3xl p-5"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>

        {/* TX Status */}
        {txStatus !== "idle" && (
          <div className="mb-5 rounded-2xl p-4 flex items-center gap-3"
            style={{
              background: txStatus === "success" ? "rgba(53,208,127,0.1)" : txStatus === "error" ? "rgba(255,107,107,0.1)" : "rgba(251,204,92,0.1)",
              border: `1px solid ${txStatus === "success" ? "rgba(53,208,127,0.3)" : txStatus === "error" ? "rgba(255,107,107,0.3)" : "rgba(251,204,92,0.3)"}`,
            }}>
            <div className="shrink-0">
              {isBusy ? <Spinner /> : txStatus === "success" ? <IconCheck /> : "⚠"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium">{txMessage}</p>
              {lastTxHash && txStatus === "success" && (
                isDemo ? (
                  <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>
                    Simulated tx · {lastTxHash.slice(0, 20)}…
                  </p>
                ) : (
                  <a href={`https://celoscan.io/tx/${lastTxHash}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 mt-1 text-xs" style={{ color: "#35D07F" }}>
                    View on CeloScan <IconLink />
                  </a>
                )
              )}
            </div>
            {!isBusy && (
              <button onClick={resetTx} className="shrink-0 text-xs px-2 py-1 rounded-lg"
                style={{ background: "rgba(255,255,255,0.08)" }}>✕</button>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="flex rounded-2xl p-1 mb-5" style={{ background: "rgba(255,255,255,0.04)" }}>
          {(["deposit", "withdraw", "rewards"] as const).map((t) => (
            <button key={t}
              onClick={() => { setTab(t); resetTx(); setAmount(""); }}
              className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all capitalize flex items-center justify-center gap-1"
              style={{
                background: tab === t ? (t === "deposit" ? "#35D07F" : t === "withdraw" ? "#FBCC5C" : "#a78bfa") : "transparent",
                color: tab === t ? "#0a0a0f" : "rgba(255,255,255,0.4)",
              }}>
              {t === "deposit" ? <IconArrowDown /> : t === "withdraw" ? <IconArrowUp /> : <IconStar />}
              {t}
            </button>
          ))}
        </div>

        {/* ── Rewards Tab ── */}
        {tab === "rewards" && (
          <div>
            <ProjectionCard principal={savingsNum > 0 ? savingsNum : 100} />
            <p className="text-xs uppercase tracking-widest mb-3 font-mono" style={{ color: "rgba(255,255,255,0.25)" }}>
              All reward tiers
            </p>
            <div className="space-y-2">
              {APY_TIERS.map((t) => (
                <div key={t.label} className="flex items-center justify-between px-4 py-3 rounded-2xl"
                  style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${t.color}22` }}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${t.color}15` }}>
                      <IconStar />
                    </div>
                    <div>
                      <p className="text-xs font-semibold" style={{ color: t.color }}>{t.label}</p>
                      <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>{t.desc}</p>
                    </div>
                  </div>
                  <span className="font-mono text-lg font-bold" style={{ color: t.color }}>{t.apy}%</span>
                </div>
              ))}
            </div>
            {savingsNum === 0 && (
              <p className="text-center text-xs mt-4" style={{ color: "rgba(255,255,255,0.25)" }}>
                Projection uses $100 as example · deposit to see your actual estimate
              </p>
            )}
          </div>
        )}

        {/* ── Deposit / Withdraw Tabs ── */}
        {tab !== "rewards" && (
          <>
            <div className="mb-4">
              <label className="text-xs mb-2 block" style={{ color: "rgba(255,255,255,0.4)" }}>
                {tab === "deposit" ? "Amount to save" : "Amount to withdraw"}
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono text-lg" style={{ color: "rgba(255,255,255,0.3)" }}>$</span>
                <input
                  type="number" value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00" disabled={isBusy}
                  className="w-full pl-8 pr-20 py-4 rounded-2xl font-mono text-xl bg-transparent outline-none"
                  style={{ border: "1px solid rgba(255,255,255,0.1)", color: "#fff", background: "rgba(255,255,255,0.04)" }}
                />
                <button
                  onClick={() => setAmount(tab === "deposit" ? cUSDBalance : savingsBalance)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs px-3 py-1.5 rounded-xl font-semibold"
                  style={{ background: "rgba(53,208,127,0.15)", color: "#35D07F" }}>
                  MAX
                </button>
              </div>
              <p className="text-xs mt-2" style={{ color: "rgba(255,255,255,0.25)" }}>
                Available: ${tab === "deposit" ? formatUSD(cUSDBalance) : formatUSD(savingsBalance)} cUSD
                {isDemo && <span style={{ color: "rgba(251,204,92,0.45)" }}> · simulated</span>}
              </p>
            </div>

            {/* Inline projection on deposit */}
            {tab === "deposit" && parseFloat(amount) > 0 && (
              <div className="mb-4 px-4 py-3 rounded-2xl"
                style={{ background: "rgba(53,208,127,0.06)", border: "1px solid rgba(53,208,127,0.15)" }}>
                <p className="text-xs mb-2" style={{ color: "rgba(53,208,127,0.7)" }}>Projected cashback on this deposit</p>
                <div className="flex gap-3 text-xs font-mono">
                  {[30, 180, 365].map((d) => {
                    const tier   = getActiveTier(d);
                    const earned = calcProjected(parseFloat(amount), tier.apy, d);
                    return (
                      <div key={d} className="flex-1 text-center">
                        <p style={{ color: "rgba(255,255,255,0.35)" }}>{d === 30 ? "1M" : d === 180 ? "6M" : "1Y"}</p>
                        <p className="font-semibold mt-0.5" style={{ color: tier.color }}>+${earned.toFixed(2)}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <button
              onClick={tab === "deposit" ? handleDeposit : handleWithdraw}
              disabled={isBusy || !amount || parseFloat(amount) <= 0}
              className="w-full py-4 rounded-2xl font-display font-semibold text-base flex items-center justify-center gap-2 transition-all active:scale-95 mb-3"
              style={{
                background: isBusy || !amount || parseFloat(amount) <= 0
                  ? "rgba(255,255,255,0.06)"
                  : tab === "deposit"
                    ? "linear-gradient(135deg, #35D07F, #2bb870)"
                    : "linear-gradient(135deg, #FBCC5C, #f0b732)",
                color: isBusy || !amount ? "rgba(255,255,255,0.3)" : "#0a0a0f",
                boxShadow: isBusy || !amount ? "none"
                  : tab === "deposit" ? "0 0 25px rgba(53,208,127,0.25)" : "0 0 25px rgba(251,204,92,0.2)",
              }}>
              {isBusy ? <Spinner /> : tab === "deposit" ? <IconArrowDown /> : <IconArrowUp />}
              {isBusy
                ? txStatus === "approving" ? "Approving…" : tab === "deposit" ? "Depositing…" : "Withdrawing…"
                : tab === "deposit" ? "Save Now" : "Withdraw"}
            </button>

            {tab === "withdraw" && parseFloat(savingsBalance) > 0 && (
              <button onClick={handleWithdrawAll} disabled={isBusy}
                className="w-full py-3 rounded-2xl text-sm transition-all active:scale-95"
                style={{ background: "rgba(255,107,107,0.08)", color: "#ff6b6b", border: "1px solid rgba(255,107,107,0.15)" }}>
                Withdraw All (${formatUSD(savingsBalance)})
              </button>
            )}
          </>
        )}
      </div>

      {/* ── Transaction History ── */}
      {history.length > 0 && (
        <div className="mx-4 mt-4 mb-8">
          <p className="text-xs uppercase tracking-widest mb-3 px-1 font-mono" style={{ color: "rgba(255,255,255,0.25)" }}>
            Recent Activity{isDemo && <span style={{ color: "rgba(251,204,92,0.4)" }}> · simulated</span>}
          </p>
          <div className="space-y-2">
            {history.map((tx, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3 rounded-2xl"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{ background: tx.type === "deposit" ? "rgba(53,208,127,0.12)" : "rgba(251,204,92,0.12)" }}>
                    <span style={{ color: tx.type === "deposit" ? "#35D07F" : "#FBCC5C" }}>
                      {tx.type === "deposit" ? "↓" : "↑"}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-medium capitalize">{tx.type}</p>
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>{new Date(tx.timestamp).toLocaleTimeString()}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm font-medium" style={{ color: tx.type === "deposit" ? "#35D07F" : "#FBCC5C" }}>
                    {tx.type === "deposit" ? "+" : "−"}${formatUSD(tx.amount)}
                  </p>
                  {isDemo ? (
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.15)" }}>simulated</p>
                  ) : (
                    <a href={`https://celoscan.io/tx/${tx.hash}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs justify-end" style={{ color: "rgba(255,255,255,0.2)" }}>
                      tx <IconLink />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="pb-8" />
    </div>
  );
}