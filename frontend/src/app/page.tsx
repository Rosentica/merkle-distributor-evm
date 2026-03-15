"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseEther, formatEther } from "viem";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  DISTRIBUTOR_ADDRESS,
  DRAGON_ADDRESS,
  DISTRIBUTOR_ABI,
  ERC20_ABI,
  ADMIN_WALLETS,
} from "./config";

interface HolderDetail {
  address: string;
  allocated: string;
  claimed: string;
  unclaimed: string;
}

interface ClaimedState {
  timestamp: string;
  currentEpoch: string;
  merkleRoot: string;
  contractBalance: string;
  uniqueClaimers: number;
  totalAllocated: string;
  totalClaimed: string;
  totalUnclaimed: string;
  surplus: string;
  holders: {
    total: number;
    fullyClaimed: number;
    partiallyClaimed: number;
    neverClaimed: number;
  };
  holderDetails: HolderDetail[];
}

function fmt(wei: string | bigint | undefined): string {
  if (!wei) return "0";
  const val = typeof wei === "string" ? wei : wei.toString();
  return parseFloat(formatEther(BigInt(val))).toLocaleString("en-US", {
    maximumFractionDigits: 2,
  });
}

function fmtShort(value: bigint | undefined): string {
  if (!value) return "0";
  const num = parseFloat(formatEther(value));
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + "M";
  if (num >= 1_000) return (num / 1_000).toFixed(1) + "K";
  return num.toFixed(2);
}

function addr(a: string): string {
  return a.slice(0, 6) + "..." + a.slice(-4);
}

export default function Home() {
  const { address, isConnected } = useAccount();
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<"approve" | "deposit">("approve");
  const [logs, setLogs] = useState<
    { msg: string; type: "info" | "success" | "error"; txHash?: string }[]
  >([]);
  const [claimedState, setClaimedState] = useState<ClaimedState | null>(null);
  const [showAllHolders, setShowAllHolders] = useState(false);

  const addLog = (
    msg: string,
    type: "info" | "success" | "error",
    txHash?: string
  ) => setLogs((prev) => [{ msg, type, txHash }, ...prev]);

  // Load distribution data from backend API
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
  useEffect(() => {
    fetch(`${apiUrl}/api/distribution`)
      .then((r) => r.json())
      .then(setClaimedState)
      .catch(() => {});
  }, [apiUrl]);

  // Contract reads
  const { data: dragonBalance, refetch: refetchBalance } = useReadContract({
    address: DRAGON_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
  const { data: contractBalance, refetch: refetchContractBalance } =
    useReadContract({
      address: DRAGON_ADDRESS,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [DISTRIBUTOR_ADDRESS],
    });
  const { data: currentEpoch } = useReadContract({
    address: DISTRIBUTOR_ADDRESS,
    abi: DISTRIBUTOR_ABI,
    functionName: "currentEpoch",
  });
  const { data: contractOwner } = useReadContract({
    address: DISTRIBUTOR_ADDRESS,
    abi: DISTRIBUTOR_ABI,
    functionName: "owner",
  });
  const { data: isDepositorOnChain } = useReadContract({
    address: DISTRIBUTOR_ADDRESS,
    abi: DISTRIBUTOR_ABI,
    functionName: "isDepositor",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
  const { data: lastDistTime } = useReadContract({
    address: DISTRIBUTOR_ADDRESS,
    abi: DISTRIBUTOR_ABI,
    functionName: "lastDistributionTime",
  });
  const { data: isPaused } = useReadContract({
    address: DISTRIBUTOR_ADDRESS,
    abi: DISTRIBUTOR_ABI,
    functionName: "paused",
  });
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: DRAGON_ADDRESS,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address ? [address, DISTRIBUTOR_ADDRESS] : undefined,
    query: { enabled: !!address },
  });

  // Writes
  const {
    writeContract: writeApprove,
    data: approveTxHash,
    isPending: isApproving,
    reset: resetApprove,
  } = useWriteContract();
  const {
    writeContract: writeDeposit,
    data: depositTxHash,
    isPending: isDepositing,
    reset: resetDeposit,
  } = useWriteContract();
  const { isSuccess: approveConfirmed } = useWaitForTransactionReceipt({
    hash: approveTxHash,
  });
  const { isSuccess: depositConfirmed } = useWaitForTransactionReceipt({
    hash: depositTxHash,
  });

  useEffect(() => {
    if (approveConfirmed && approveTxHash) {
      addLog("Approved", "success", approveTxHash);
      setStep("deposit");
      refetchAllowance();
    }
  }, [approveConfirmed, approveTxHash, refetchAllowance]);

  useEffect(() => {
    if (depositConfirmed && depositTxHash) {
      addLog("Deposit & Burn complete", "success", depositTxHash);
      setAmount("");
      setStep("approve");
      resetApprove();
      resetDeposit();
      refetchBalance();
      refetchContractBalance();
      refetchAllowance();
    }
  }, [depositConfirmed, depositTxHash, refetchBalance, refetchContractBalance, refetchAllowance, resetApprove, resetDeposit]);

  useEffect(() => {
    if (allowance && amount) {
      try {
        setStep(allowance >= parseEther(amount) ? "deposit" : "approve");
      } catch { /* */ }
    }
  }, [allowance, amount]);

  const isOwner = address && contractOwner && address.toLowerCase() === (contractOwner as string).toLowerCase();
  const isAuthorized = isOwner || isDepositorOnChain || (address && ADMIN_WALLETS.some((w) => w.toLowerCase() === address.toLowerCase()));

  const parsedAmount = amount ? parseFloat(amount) : 0;
  const lastDistDate = lastDistTime ? new Date(Number(lastDistTime) * 1000).toLocaleString() : "—";

  // Sort holders by unclaimed desc
  const sortedHolders = claimedState?.holderDetails
    ?.slice()
    .sort((a, b) => (BigInt(b.unclaimed) > BigInt(a.unclaimed) ? 1 : -1)) ?? [];
  const displayedHolders = showAllHolders ? sortedHolders : sortedHolders.slice(0, 20);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-medium tracking-wide uppercase truncate">Dragon Reward Distributor</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Admin Panel</p>
          </div>
          <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false} />
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-4 sm:space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-3">
          {[
            { label: "Epoch", value: currentEpoch?.toString() ?? "—" },
            { label: "Contract Bal", value: fmtShort(contractBalance) },
            { label: "Total Allocated", value: claimedState ? fmtShort(BigInt(claimedState.totalAllocated)) : "—" },
            { label: "Total Claimed", value: claimedState ? fmtShort(BigInt(claimedState.totalClaimed)) : "—" },
            { label: "Unclaimed", value: claimedState ? fmtShort(BigInt(claimedState.totalUnclaimed)) : "—" },
          ].map((s) => (
            <Card key={s.label}>
              <CardHeader className="pb-1 pt-3 px-4">
                <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground font-normal">{s.label}</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <p className="text-xl sm:text-2xl font-light tabular-nums">{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Second row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
          <Card>
            <CardContent className="px-4 py-3 flex items-center justify-between">
              <span className="text-xs uppercase tracking-widest text-muted-foreground">Status</span>
              <Badge variant="secondary" className="text-xs font-normal">{isPaused ? "Paused" : "Active"}</Badge>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="px-4 py-3 flex items-center justify-between">
              <span className="text-xs uppercase tracking-widest text-muted-foreground">Holders</span>
              <span className="text-base font-light tabular-nums">{claimedState?.holders.total ?? "—"}</span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="px-4 py-3 flex items-center justify-between">
              <span className="text-xs uppercase tracking-widest text-muted-foreground">Claimers</span>
              <span className="text-base font-light tabular-nums">{claimedState?.uniqueClaimers ?? "—"}</span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="px-4 py-3 flex items-center justify-between">
              <span className="text-xs uppercase tracking-widest text-muted-foreground">Last Dist.</span>
              <span className="text-xs font-light text-muted-foreground">{lastDistDate}</span>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left: Deposit + Contract Info */}
          <div className="space-y-6">
            {/* Deposit */}
            {isConnected && (
              <Card className="border-primary/40">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm uppercase tracking-widest text-foreground font-medium">Deposit & Burn</CardTitle>
                    {isAuthorized ? (
                      <Badge className="text-xs font-normal bg-primary/20 text-primary border border-primary/30">{isOwner ? "Owner" : "Depositor"}</Badge>
                    ) : address ? (
                      <Badge variant="outline" className="text-xs font-normal text-muted-foreground">Not authorized</Badge>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Balance</span>
                    <span className="font-mono">{fmt(dragonBalance?.toString())}</span>
                  </div>
                  <div className="relative">
                    <Input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0"
                      className="pr-14 text-lg font-light h-11 font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button onClick={() => dragonBalance && setAmount(formatEther(dragonBalance))} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors">Max</button>
                  </div>
                  {parsedAmount > 0 && (
                    <div className="border border-border p-3 space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Burn 20%</span>
                        <span className="font-mono">{(parsedAmount * 0.2).toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Distribute 80%</span>
                        <span className="font-mono">{(parsedAmount * 0.8).toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <Button onClick={() => { addLog("Approving...", "info"); writeApprove({ address: DRAGON_ADDRESS, abi: ERC20_ABI, functionName: "approve", args: [DISTRIBUTOR_ADDRESS, parseEther(amount || "0")] }); }} disabled={!amount || parsedAmount <= 0 || isApproving || step === "deposit"} variant={step === "deposit" ? "secondary" : "default"} className="h-11 text-xs uppercase tracking-widest font-medium">
                      {isApproving ? "..." : step === "deposit" ? "Approved" : "1 — Approve"}
                    </Button>
                    <Button onClick={() => { addLog("Depositing...", "info"); writeDeposit({ address: DISTRIBUTOR_ADDRESS, abi: DISTRIBUTOR_ABI, functionName: "depositAndBurn", args: [parseEther(amount || "0")] }); }} disabled={!amount || parsedAmount <= 0 || isDepositing || step === "approve"} variant={step === "deposit" ? "default" : "secondary"} className="h-11 text-xs uppercase tracking-widest font-medium">
                      {isDepositing ? "..." : "2 — Deposit"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Contract */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground font-normal">Contract</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm font-mono text-muted-foreground">
                <div className="flex justify-between gap-2">
                  <span>Distributor</span>
                  <a href={`https://bscscan.com/address/${DISTRIBUTOR_ADDRESS}`} target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors truncate">{addr(DISTRIBUTOR_ADDRESS)}</a>
                </div>
                <Separator />
                <div className="flex justify-between gap-2">
                  <span>Token</span>
                  <a href={`https://bscscan.com/address/${DRAGON_ADDRESS}`} target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors truncate">{addr(DRAGON_ADDRESS)}</a>
                </div>
                <Separator />
                <div className="flex justify-between gap-2">
                  <span>Merkle Root</span>
                  <span className="truncate">{claimedState?.merkleRoot ? addr(claimedState.merkleRoot) : "—"}</span>
                </div>
              </CardContent>
            </Card>

            {/* Log */}
            {logs.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs uppercase tracking-widest text-muted-foreground font-normal">Log</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 max-h-40 overflow-y-auto">
                  {logs.map((log, i) => (
                    <div key={i} className="text-sm font-mono px-2 py-1.5 border-l border-border">
                      <span className="text-muted-foreground">{log.msg}</span>
                      {log.txHash && (
                        <a href={`https://bscscan.com/tx/${log.txHash}`} target="_blank" rel="noopener noreferrer" className="block text-foreground/50 hover:text-foreground transition-colors">{log.txHash.slice(0, 14)}...{log.txHash.slice(-8)}</a>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right: Distribution Table */}
          <div className="md:col-span-2">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <CardTitle className="text-sm uppercase tracking-widest text-muted-foreground font-normal">
                    Distribution — {claimedState?.holders.total ?? 0} holders
                  </CardTitle>
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    <span>{claimedState?.holders.fullyClaimed ?? 0} claimed</span>
                    <span>{claimedState?.holders.partiallyClaimed ?? 0} partial</span>
                    <span>{claimedState?.holders.neverClaimed ?? 0} unclaimed</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="text-left font-normal py-2 pr-4 uppercase tracking-widest text-xs">Address</th>
                        <th className="text-right font-normal py-2 px-2 uppercase tracking-widest text-xs">Allocated</th>
                        <th className="text-right font-normal py-2 px-2 uppercase tracking-widest text-xs">Claimed</th>
                        <th className="text-right font-normal py-2 pl-2 uppercase tracking-widest text-xs">Unclaimed</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono">
                      {displayedHolders.map((h) => (
                        <tr key={h.address} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                          <td className="py-1.5 pr-4">
                            <a href={`https://bscscan.com/address/${h.address}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">{addr(h.address)}</a>
                          </td>
                          <td className="text-right py-1.5 px-2 text-muted-foreground">{fmt(h.allocated)}</td>
                          <td className="text-right py-1.5 px-2 text-muted-foreground">{fmt(h.claimed)}</td>
                          <td className="text-right py-1.5 pl-2">
                            {BigInt(h.unclaimed) > BigInt(0) ? fmt(h.unclaimed) : <span className="text-muted-foreground/40">0</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {sortedHolders.length > 20 && (
                  <button onClick={() => setShowAllHolders(!showAllHolders)} className="mt-3 text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors">
                    {showAllHolders ? `Show less` : `Show all ${sortedHolders.length} holders`}
                  </button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
