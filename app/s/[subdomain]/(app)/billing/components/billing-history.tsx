"use client";

import { useBillingHistory } from "@/lib/hooks/useQueries";

type TransactionStatus = "COMPLETED" | "PENDING" | "FAILED";
type TransactionType = "TOP_UP" | "CHARGE" | "REFUND" | "ADJUSTMENT";

// Helper: return Tailwind color classes + icon path based on status
const getStatusStyle = (status: TransactionStatus) => {
  switch (status) {
    case "COMPLETED":
      return {
        color: "bg-green-500 border-green-600 text-white [&_img]:icon-white",
        icon: "/images/icons/check-circle.svg",
        label: "Completed",
      };
    case "PENDING":
      return {
        color: "bg-yellow-400 border-yellow-500 text-white [&_img]:icon-white",
        icon: "/images/icons/clock.svg",
        label: "Pending",
      };
    case "FAILED":
      return {
        color: "bg-red-500 border-red-600 text-white [&_img]:icon-white",
        icon: "/images/icons/close.svg",
        label: "Failed",
      };
    default:
      return {
        color: "bg-gray-400 border-gray-400 text-white [&_img]:icon-white",
        icon: "/images/icons/clock.svg",
        label: status,
      };
  }
};

// Helper: get icon and color for transaction type
const getTypeStyle = (type: TransactionType) => {
  switch (type) {
    case "TOP_UP":
      return { prefix: "+", color: "text-green-600" };
    case "CHARGE":
      return { prefix: "-", color: "text-red-600" };
    case "REFUND":
      return { prefix: "+", color: "text-blue-600" };
    case "ADJUSTMENT":
      return { prefix: "", color: "text-gray-600" };
    default:
      return { prefix: "", color: "text-gray-600" };
  }
};

function formatCurrency(amount: number): string {
  return `$${Math.abs(amount).toFixed(2)}`;
}

export default function BillingHistory() {
  const { data: historyData, isLoading, error } = useBillingHistory();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-red-500">
        Failed to load billing history
      </div>
    );
  }

  const transactions = historyData?.transactions || [];
  const monthlyUsage = historyData?.monthlyUsage || [];

  // If no data yet, show empty state
  if (transactions.length === 0 && monthlyUsage.length === 0) {
    return (
      <div className="text-center py-12">
        <img
          src="/images/icons/receipt-empty.svg"
          alt="No history"
          className="w-16 h-16 mx-auto mb-4 opacity-50"
        />
        <h3 className="text-lg font-semibold text-gray-600">No billing history yet</h3>
        <p className="text-sm text-gray-500 mt-1">
          Transactions will appear here once you start using the service or add credits
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Monthly Usage Summary */}
      {monthlyUsage.length > 0 && (
        <div className="space-y-4">
          <div>
            <h3 className="xl:text-xl text-lg font-bold text-secondary-700">
              Monthly Usage Summary
            </h3>
            <p className="text-sm font-medium text-gray-500">
              Usage breakdown by month
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {monthlyUsage.slice(0, 6).map((month) => (
              <div key={month.month} className="p-4 rounded-lg border border-gray-200 bg-gray-50">
                <h4 className="font-bold text-gray-700">{month.month}</h4>
                <div className="mt-2 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Cost:</span>
                    <span className="font-semibold">{formatCurrency(month.cost)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Requests:</span>
                    <span className="font-semibold">{month.requests.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Tokens:</span>
                    <span className="font-semibold">{month.tokens.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transaction History */}
      <div className="space-y-4">
        <div>
          <h3 className="xl:text-xl text-lg font-bold text-secondary-700">
            Transaction History
          </h3>
          <p className="text-sm font-medium text-gray-500">
            Recent credits and charges
          </p>
        </div>

        {transactions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No transactions yet
          </div>
        ) : (
          <div className="flex flex-wrap divide-y divide-gray-200">
            {transactions.map((transaction) => {
              const { color, icon, label } = getStatusStyle(transaction.status as TransactionStatus);
              const { prefix, color: amountColor } = getTypeStyle(transaction.type as TransactionType);
              
              return (
                <div key={transaction.id} className="w-full">
                  <div className="py-4 flex flex-wrap justify-between items-center gap-3">
                    {/* Left side */}
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold">{transaction.name}</h4>
                        <span
                          className={`pl-1 py-1 pr-2 inline-flex items-center gap-1 text-xs font-semibold rounded-full border text-nowrap ${color}`}
                        >
                          <img src={icon} alt={label} width={16} height={16} />
                          {label}
                        </span>
                      </div>
                      <span className="text-xs font-medium text-gray-400">
                        {transaction.formattedDate}
                        {transaction.description && ` • ${transaction.description}`}
                      </span>
                    </div>

                    {/* Right side */}
                    <div className="inline-flex gap-1">
                      <p className={`text-xl font-bold ${amountColor}`}>
                        {prefix}{formatCurrency(transaction.amount)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
