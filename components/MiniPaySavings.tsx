"use client";

import { useState, useEffect, useCallback } from "react";
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

// ─── Spinner ──────────────────────────────────────────────────────────────────
const Spinner = () => (
  <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="40" strokeLinecap="round" opacity="0.3"/>
    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
  </svg>
);

// ─── Main Component ───────────────────────────────────────────────────────────
export default function MiniPaySavings() {
  const [address, setAddress] = useState<string | null>(null);
  const [cUSDBalance, setCUSDBalance] = useState("0.00");
  const [savingsBalance, setSavingsBalance] = useState("0.00");
  const [amount, setAmount] = useState("");
  const [tab, setTab] = useState<"deposit" | "withdraw">("deposit");
  const [txStatus, setTxStatus] = useState<TxStatus>("idle");
  const [txMessage, setTxMessage] = useState("");
  const [lastTxHash, setLastTxHash] = useState("");
  const [history, setHistory] = useState<SavingsTx[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [connectError, setConnectError] = useState("");

  const refreshBalances = useCallback(async (addr: string) => {
    try {
      const [cusd, savings] = await Promise.all([
        getCUSDBalance(addr),
        getSavingsBalance(addr),
      ]);
      setCUSDBalance(parseFloat(cusd).toFixed(4));
      setSavingsBalance(parseFloat(savings).toFixed(4));
    } catch (e) {
      console.error("Balance refresh error:", e);
    }
  }, []);

  const handleConnect = async () => {
    setIsLoading(true);
    setConnectError("");
    try {
      await ensureCeloNetwork();
      const addr = await connectWallet();
      setAddress(addr);
      await refreshBalances(addr);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Connection failed";
      setConnectError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Auto-connect if MiniPay is detected
    if (isMiniPayEnvironment()) handleConnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDeposit = async () => {
    if (!address || !amount || parseFloat(amount) <= 0) return;
    setTxStatus("approving");
    setTxMessage("Approving cUSD spend…");
    try {
      const hash = await depositSavings(
        amount,
        () => { setTxStatus("approving"); setTxMessage("Approving cUSD spend…"); },
        () => { setTxStatus("depositing"); setTxMessage("Depositing to savings…"); }
      );
      setLastTxHash(hash);
      setTxStatus("success");
      setTxMessage("Deposit successful!");
      const newTx: SavingsTx = { type: "deposit", amount, hash, timestamp: Date.now() };
      setHistory((prev) => [newTx, ...prev].slice(0, 10));
      setAmount("");
      await refreshBalances(address);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Transaction failed";
      setTxStatus("error");
      setTxMessage(msg.length > 80 ? msg.slice(0, 80) + "…" : msg);
    }
  };

  const handleWithdraw = async () => {
    if (!address || !amount || parseFloat(amount) <= 0) return;
    setTxStatus("withdrawing");
    setTxMessage("Withdrawing from savings…");
    try {
      const hash = await withdrawSavings(amount);
      setLastTxHash(hash);
      setTxStatus("success");
      setTxMessage("Withdrawal successful!");
      const newTx: SavingsTx = { type: "withdraw", amount, hash, timestamp: Date.now() };
      setHistory((prev) => [newTx, ...prev].slice(0, 10));
      setAmount("");
      await refreshBalances(address);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Transaction failed";
      setTxStatus("error");
      setTxMessage(msg.length > 80 ? msg.slice(0, 80) + "…" : msg);
    }
  };

  const handleWithdrawAll = async () => {
    if (!address) return;
    setTxStatus("withdrawing");
    setTxMessage("Withdrawing all savings…");
    try {
      const hash = await withdrawAllSavings();
      setLastTxHash(hash);
      setTxStatus("success");
      setTxMessage("All savings withdrawn!");
      setHistory((prev) => [
        { type: "withdraw" as const, amount: savingsBalance, hash, timestamp: Date.now() },
        ...prev,
      ].slice(0, 10));
      await refreshBalances(address);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Transaction failed";
      setTxStatus("error");
      setTxMessage(msg.length > 80 ? msg.slice(0, 80) + "…" : msg);
    }
  };

  const resetTx = () => {
    setTxStatus("idle");
    setTxMessage("");
  };

  const isBusy = ["approving", "depositing", "withdrawing"].includes(txStatus);

  // ─── NOT CONNECTED ──────────────────────────────────────────────────────────
  if (!address) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 relative z-10">
        {/* BG glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full"
            style={{ background: "radial-gradient(circle, rgba(53,208,127,0.08) 0%, transparent 70%)" }} />
        </div>

        {/* Logo */}
        <div className="float mb-8 relative">
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center relative pulse-ring"
            style={{ background: "linear-gradient(135deg, #35D07F22, #FBCC5C22)", border: "1px solid rgba(53,208,127,0.3)" }}>
            <span className="text-3xl">💰</span>
          </div>
        </div>

        <h1 className="font-display text-4xl font-800 text-center mb-2 tracking-tight"
          style={{ fontWeight: 800 }}>
          Save<span style={{ color: "#35D07F" }}>Celo</span>
        </h1>
        <p className="text-center text-sm mb-1" style={{ color: "rgba(255,255,255,0.4)", fontFamily: "DM Sans" }}>
          Save cUSD on Celo · Zero fees · Instant access
        </p>

        {/* Feature pills */}
        <div className="flex gap-2 mt-4 mb-10 flex-wrap justify-center">
          {["🔒 Secure", "⚡ Instant", "🌍 Celo"].map((f) => (
            <span key={f} className="text-xs px-3 py-1 rounded-full"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.08)" }}>
              {f}
            </span>
          ))}
        </div>

        <button
          onClick={handleConnect}
          disabled={isLoading}
          className="w-full max-w-xs py-4 rounded-2xl font-display font-semibold text-base flex items-center justify-center gap-2 transition-all active:scale-95"
          style={{
            background: isLoading ? "rgba(53,208,127,0.3)" : "linear-gradient(135deg, #35D07F, #2bb870)",
            color: "#0a0a0f",
            boxShadow: isLoading ? "none" : "0 0 30px rgba(53,208,127,0.3)",
          }}
        >
          {isLoading ? <Spinner /> : <IconWallet />}
          {isLoading ? "Connecting…" : "Connect MiniPay"}
        </button>

        {connectError && (
          <p className="mt-4 text-xs text-center px-4" style={{ color: "#ff6b6b" }}>
            {connectError}
          </p>
        )}

        <p className="mt-6 text-xs text-center" style={{ color: "rgba(255,255,255,0.2)" }}>
          Optimised for Opera MiniPay
        </p>
      </div>
    );
  }

  // ─── MAIN APP ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col relative z-10">
      {/* BG glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(53,208,127,0.06) 0%, transparent 70%)" }} />
      </div>

      {/* ── Header ── */}
      <header className="px-5 pt-10 pb-4 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight" style={{ fontWeight: 800 }}>
            Save<span style={{ color: "#35D07F" }}>Celo</span>
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
            {shortenAddress(address)}
          </p>
        </div>
        <button
          onClick={() => refreshBalances(address)}
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-90"
          style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}
        >
          <IconRefresh />
        </button>
      </header>

      {/* ── Balance Cards ── */}
      <div className="px-5 pb-6 space-y-3">
        {/* Savings Card */}
        <div className="rounded-3xl p-5 relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, rgba(53,208,127,0.15), rgba(53,208,127,0.05))", border: "1px solid rgba(53,208,127,0.2)" }}>
          <div className="shimmer absolute inset-0 rounded-3xl pointer-events-none" />
          <p className="text-xs uppercase tracking-widest mb-2 font-mono" style={{ color: "rgba(53,208,127,0.7)" }}>
            Total Saved
          </p>
          <div className="flex items-end gap-2">
            <span className="font-display text-4xl font-bold" style={{ fontWeight: 800, color: "#35D07F" }}>
              ${formatUSD(savingsBalance)}
            </span>
            <span className="text-sm mb-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>cUSD</span>
          </div>
        </div>

        {/* Wallet Balance */}
        <div className="rounded-2xl px-5 py-4 flex items-center justify-between"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <div>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>Wallet Balance</p>
            <p className="font-mono text-lg font-medium mt-0.5">${formatUSD(cUSDBalance)} <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>cUSD</span></p>
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

        {/* TX status overlay */}
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
                <a
                  href={`https://celoscan.io/tx/${lastTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 mt-1 text-xs"
                  style={{ color: "#35D07F" }}>
                  View on CeloScan <IconLink />
                </a>
              )}
            </div>
            {!isBusy && (
              <button onClick={resetTx} className="shrink-0 text-xs px-2 py-1 rounded-lg"
                style={{ background: "rgba(255,255,255,0.08)" }}>
                ✕
              </button>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="flex rounded-2xl p-1 mb-5"
          style={{ background: "rgba(255,255,255,0.04)" }}>
          {(["deposit", "withdraw"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); resetTx(); setAmount(""); }}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all capitalize flex items-center justify-center gap-1.5"
              style={{
                background: tab === t ? (t === "deposit" ? "#35D07F" : "#FBCC5C") : "transparent",
                color: tab === t ? "#0a0a0f" : "rgba(255,255,255,0.4)",
              }}>
              {t === "deposit" ? <IconArrowDown /> : <IconArrowUp />}
              {t}
            </button>
          ))}
        </div>

        {/* Amount Input */}
        <div className="mb-4">
          <label className="text-xs mb-2 block" style={{ color: "rgba(255,255,255,0.4)" }}>
            {tab === "deposit" ? "Amount to save" : "Amount to withdraw"}
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono text-lg"
              style={{ color: "rgba(255,255,255,0.3)" }}>$</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              disabled={isBusy}
              className="w-full pl-8 pr-20 py-4 rounded-2xl font-mono text-xl bg-transparent outline-none"
              style={{
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#fff",
                background: "rgba(255,255,255,0.04)",
              }}
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
          </p>
        </div>

        {/* Action Button */}
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
            boxShadow: isBusy || !amount ? "none" : tab === "deposit" ? "0 0 25px rgba(53,208,127,0.25)" : "0 0 25px rgba(251,204,92,0.2)",
          }}
        >
          {isBusy ? <Spinner /> : tab === "deposit" ? <IconArrowDown /> : <IconArrowUp />}
          {isBusy
            ? txStatus === "approving" ? "Approving…" : tab === "deposit" ? "Depositing…" : "Withdrawing…"
            : tab === "deposit" ? "Save Now" : "Withdraw"}
        </button>

        {/* Withdraw All */}
        {tab === "withdraw" && parseFloat(savingsBalance) > 0 && (
          <button
            onClick={handleWithdrawAll}
            disabled={isBusy}
            className="w-full py-3 rounded-2xl text-sm transition-all active:scale-95"
            style={{ background: "rgba(255,107,107,0.08)", color: "#ff6b6b", border: "1px solid rgba(255,107,107,0.15)" }}>
            Withdraw All (${formatUSD(savingsBalance)})
          </button>
        )}
      </div>

      {/* ── Transaction History ── */}
      {history.length > 0 && (
        <div className="mx-4 mt-4 mb-8">
          <p className="text-xs uppercase tracking-widest mb-3 px-1 font-mono"
            style={{ color: "rgba(255,255,255,0.25)" }}>
            Recent Activity
          </p>
          <div className="space-y-2">
            {history.map((tx, i) => (
              <div key={i}
                className="flex items-center justify-between px-4 py-3 rounded-2xl"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{
                      background: tx.type === "deposit" ? "rgba(53,208,127,0.12)" : "rgba(251,204,92,0.12)",
                    }}>
                    <span style={{ color: tx.type === "deposit" ? "#35D07F" : "#FBCC5C" }}>
                      {tx.type === "deposit" ? "↓" : "↑"}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-medium capitalize">{tx.type}</p>
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                      {new Date(tx.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm font-medium"
                    style={{ color: tx.type === "deposit" ? "#35D07F" : "#FBCC5C" }}>
                    {tx.type === "deposit" ? "+" : "−"}${formatUSD(tx.amount)}
                  </p>
                  <a href={`https://celoscan.io/tx/${tx.hash}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs justify-end"
                    style={{ color: "rgba(255,255,255,0.2)" }}>
                    tx <IconLink />
                  </a>
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