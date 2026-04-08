import { BrowserProvider, Contract, parseUnits, formatUnits } from "ethers";
import {
  CUSD_ADDRESS,
  SAVINGS_CONTRACT_ADDRESS,
  ERC20_ABI,
  SAVINGS_ABI,
  CELO_CHAIN_ID,
} from "./config";

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, cb: (...args: unknown[]) => void) => void;
      removeListener: (event: string, cb: (...args: unknown[]) => void) => void;
      isMiniPay?: boolean;
    };
  }
}

export function isMiniPayEnvironment(): boolean {
  return typeof window !== "undefined" && !!window.ethereum?.isMiniPay;
}

export async function getProvider(): Promise<BrowserProvider> {
  if (!window.ethereum) throw new Error("No wallet found. Please open in MiniPay.");
  return new BrowserProvider(window.ethereum);
}

export async function connectWallet(): Promise<string> {
  const provider = await getProvider();
  const accounts = await provider.send("eth_requestAccounts", []);
  return (accounts as string[])[0];
}

export async function ensureCeloNetwork(): Promise<void> {
  const provider = await getProvider();
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== CELO_CHAIN_ID) {
    await window.ethereum!.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: `0x${CELO_CHAIN_ID.toString(16)}` }],
    });
  }
}

export async function getCUSDBalance(address: string): Promise<string> {
  const provider = await getProvider();
  const cusd = new Contract(CUSD_ADDRESS, ERC20_ABI, provider);
  const [balance, decimals] = await Promise.all([
    cusd.balanceOf(address),
    cusd.decimals(),
  ]);
  return formatUnits(balance, decimals);
}

export async function getSavingsBalance(address: string): Promise<string> {
  if (SAVINGS_CONTRACT_ADDRESS === "0x0000000000000000000000000000000000000000") {
    return "0";
  }
  const provider = await getProvider();
  const savings = new Contract(SAVINGS_CONTRACT_ADDRESS, SAVINGS_ABI, provider);
  const balance = await savings.getBalance(address);
  return formatUnits(balance, 18);
}

export async function depositSavings(
  amount: string,
  onApproving: () => void,
  onDepositing: () => void
): Promise<string> {
  const provider = await getProvider();
  const signer = await provider.getSigner();
  const address = await signer.getAddress();

  const cusd = new Contract(CUSD_ADDRESS, ERC20_ABI, signer);
  const savings = new Contract(SAVINGS_CONTRACT_ADDRESS, SAVINGS_ABI, signer);
  const parsedAmount = parseUnits(amount, 18);

  // Step 1 — Approve
  onApproving();
  const allowance = await cusd.allowance(address, SAVINGS_CONTRACT_ADDRESS);
  if (allowance < parsedAmount) {
    const approveTx = await cusd.approve(SAVINGS_CONTRACT_ADDRESS, parsedAmount);
    await approveTx.wait();
  }

  // Step 2 — Deposit
  onDepositing();
  const depositTx = await savings.deposit(parsedAmount);
  const receipt = await depositTx.wait();
  return receipt.hash;
}

export async function withdrawSavings(amount: string): Promise<string> {
  const provider = await getProvider();
  const signer = await provider.getSigner();
  const savings = new Contract(SAVINGS_CONTRACT_ADDRESS, SAVINGS_ABI, signer);
  const parsedAmount = parseUnits(amount, 18);
  const tx = await savings.withdraw(parsedAmount);
  const receipt = await tx.wait();
  return receipt.hash;
}

export async function withdrawAllSavings(): Promise<string> {
  const provider = await getProvider();
  const signer = await provider.getSigner();
  const savings = new Contract(SAVINGS_CONTRACT_ADDRESS, SAVINGS_ABI, signer);
  const tx = await savings.withdrawAll();
  const receipt = await tx.wait();
  return receipt.hash;
}

export function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function formatUSD(value: string): string {
  const num = parseFloat(value);
  if (isNaN(num)) return "0.00";
  return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}