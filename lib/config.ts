// Celo Mainnet
export const CELO_CHAIN_ID = 42220;
export const CELO_RPC = "https://forno.celo.org";

// cUSD token on Celo Mainnet
export const CUSD_ADDRESS = "0x765DE816845861e75A25fCA122bb6898B8B1282a";

// Replace with your deployed SaveCelo contract address
export const SAVINGS_CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_SAVINGS_CONTRACT ?? "0x0000000000000000000000000000000000000000";

export const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
];

export const SAVINGS_ABI = [
  "function deposit(uint256 amount) external",
  "function withdraw(uint256 amount) external",
  "function withdrawAll() external",
  "function getBalance(address user) external view returns (uint256)",
  "function totalDeposited(address user) external view returns (uint256)",
  "event Deposited(address indexed user, uint256 amount)",
  "event Withdrawn(address indexed user, uint256 amount)",
];

export type TxStatus = "idle" | "approving" | "depositing" | "withdrawing" | "success" | "error";

export interface SavingsTx {
  type: "deposit" | "withdraw";
  amount: string;
  hash: string;
  timestamp: number;
}