"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const TOP_UP_PRESETS = [10, 25, 50, 100, 250, 500] as const;
const MIN_TOP_UP_AMOUNT = 5;
const MAX_TOP_UP_AMOUNT = 10000;

interface TopUpDialogProps {
  children?: React.ReactNode;
  currentBalance?: number;
}

export default function TopUpDialog({ children, currentBalance = 0 }: TopUpDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveAmount = selectedAmount ?? (customAmount ? parseFloat(customAmount) : 0);
  const isValidAmount = effectiveAmount >= MIN_TOP_UP_AMOUNT && effectiveAmount <= MAX_TOP_UP_AMOUNT;

  const handlePresetSelect = (amount: number) => {
    setSelectedAmount(amount);
    setCustomAmount("");
    setError(null);
  };

  const handleCustomAmountChange = (value: string) => {
    // Allow only numbers and decimal point
    const sanitized = value.replace(/[^0-9.]/g, "");
    // Prevent multiple decimal points
    const parts = sanitized.split(".");
    const formatted = parts.length > 2 
      ? parts[0] + "." + parts.slice(1).join("")
      : sanitized;
    
    setCustomAmount(formatted);
    setSelectedAmount(null);
    setError(null);
  };

  const handleTopUp = async () => {
    if (!isValidAmount) {
      setError(`Amount must be between $${MIN_TOP_UP_AMOUNT} and $${MAX_TOP_UP_AMOUNT.toLocaleString()}`);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: effectiveAmount }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create checkout session");
      }

      // Redirect to Stripe checkout
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to process payment";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedAmount(null);
    setCustomAmount("");
    setError(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      setIsOpen(open);
      if (!open) resetForm();
    }}>
      <DialogTrigger asChild>
        {children || (
          <Button className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg hover:shadow-xl transition-all duration-200">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add Credits
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-100 to-teal-100">
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            Top Up Your Balance
          </DialogTitle>
          <DialogDescription>
            Add credits to your account to continue using AI services. Your current balance is{" "}
            <span className={`font-semibold ${currentBalance <= 0 ? "text-red-600" : "text-emerald-600"}`}>
              ${currentBalance.toFixed(2)}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Quick Amount Selection */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-3 block">
              Select Amount
            </label>
            <div className="grid grid-cols-3 gap-2">
              {TOP_UP_PRESETS.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => handlePresetSelect(amount)}
                  className={`relative px-4 py-3 rounded-xl border-2 font-semibold text-lg transition-all duration-200 ${
                    selectedAmount === amount
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-200"
                      : "border-gray-200 bg-white text-gray-700 hover:border-emerald-300 hover:bg-emerald-50/50"
                  }`}
                >
                  ${amount}
                  {selectedAmount === amount && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Amount Input */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Or enter custom amount
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium text-lg">
                $
              </span>
              <Input
                type="text"
                value={customAmount}
                onChange={(e) => handleCustomAmountChange(e.target.value)}
                placeholder="0.00"
                className={`pl-8 h-12 text-lg font-medium ${
                  customAmount && !selectedAmount ? "border-emerald-500 ring-2 ring-emerald-200" : ""
                }`}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Min: ${MIN_TOP_UP_AMOUNT} • Max: ${MAX_TOP_UP_AMOUNT.toLocaleString()}
            </p>
          </div>

          {/* Summary */}
          {effectiveAmount > 0 && (
            <div className="p-4 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Amount to add</span>
                <span className="text-2xl font-bold text-gray-900">
                  ${effectiveAmount.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-200">
                <span className="text-gray-600">New balance</span>
                <span className="text-lg font-semibold text-emerald-600">
                  ${(currentBalance + effectiveAmount).toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => setIsOpen(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleTopUp}
            disabled={!isValidAmount || isLoading}
            className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white min-w-[140px]"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Processing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                Pay ${effectiveAmount.toFixed(2)}
              </>
            )}
          </Button>
        </DialogFooter>

        {/* Stripe Badge */}
        <div className="flex items-center justify-center gap-2 pt-2 border-t border-gray-100">
          <svg className="h-5 w-auto text-gray-400" viewBox="0 0 60 25" fill="currentColor">
            <path d="M59.64 14.28h-8.06c.19 1.93 1.6 2.55 3.2 2.55 1.64 0 2.96-.37 4.05-.95v3.32a10.36 10.36 0 01-4.56.95c-4.01 0-6.83-2.5-6.83-7.28 0-4.19 2.39-7.34 6.29-7.34 3.87 0 5.91 2.96 5.91 7.12v1.63zm-5.89-5.77c-1.3 0-2.14.95-2.25 2.55h4.5c-.04-1.54-.75-2.55-2.25-2.55zM41.02 20.34V0h4.12v8.14h.06c.73-1.64 2.62-2.67 4.56-2.67 3.32 0 5.65 2.62 5.65 7.15 0 4.93-2.77 7.62-5.91 7.62-1.76 0-3.57-.92-4.47-2.67h-.07v2.27l-3.94.5zm4.12-7.34c0 2.24 1.2 3.57 2.8 3.57 1.67 0 2.68-1.45 2.68-3.76 0-2.18-.98-3.51-2.65-3.51-1.64 0-2.83 1.3-2.83 3.51v.19zM30.1 4.01h4.12v3.88h-4.12V4.01zm0 5.59h4.12v10.74H30.1V9.6zM19.7 5.79v3.81h3.07v3.16h-3.07v4.5c0 .92.47 1.3 1.3 1.3.57 0 1.2-.13 1.77-.38v3.32c-.79.34-1.73.5-2.65.5-2.55 0-4.54-1.42-4.54-4.25v-5h-2.18V9.6h.6c1.58 0 2.37-.95 2.37-2.27V5.79H19.7zM7.33 16.93c.41.51 1.2.85 1.98.85 1.08 0 1.61-.44 1.61-1.08 0-.7-.6-1.01-1.6-1.39l-1.3-.47c-1.7-.63-2.83-1.77-2.83-3.7 0-2.27 1.83-3.88 4.25-3.88 1.58 0 2.9.57 3.82 1.64l-1.86 2.15c-.44-.47-.98-.76-1.7-.76-.88 0-1.45.41-1.45 1.01 0 .67.51.92 1.42 1.26l1.23.44c1.99.76 3.1 1.86 3.1 3.85 0 2.37-1.93 4.07-4.5 4.07-1.67 0-3.38-.63-4.31-1.83l2.14-2.16z"/>
          </svg>
          <span className="text-xs text-gray-400">Secure payment</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

