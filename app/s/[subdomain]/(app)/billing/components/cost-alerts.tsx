"use client";

import { useBalance, useBillingOverview } from "@/lib/hooks/useQueries";

type AlertStatus = "active" | "inactive" | "triggered" | "warning";

interface Alert {
  id: string;
  name: string;
  description: string;
  threshold: number;
  type: "balance" | "spending" | "usage";
  status: AlertStatus;
}

// Helper function to get class by status
const getStatusClass = (status: AlertStatus) => {
  switch (status) {
    case "active":
      return "bg-green-500 border-green-600 text-white";
    case "inactive":
      return "bg-gray-400 border-gray-500 text-white";
    case "triggered":
      return "bg-red-500 border-red-600 text-white";
    case "warning":
      return "bg-yellow-400 border-yellow-500 text-white";
    default:
      return "bg-gray-200 border-gray-300 text-black";
  }
};

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export default function CostAlerts() {
  const { data: balanceData, isLoading: balanceLoading } = useBalance();
  const { data: billingData, isLoading: billingLoading } = useBillingOverview();

  const isLoading = balanceLoading || billingLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  const balance = balanceData?.balance || 0;
  const currentMonthCost = billingData?.currentMonth?.cost || 0;
  const estimatedMonthEnd = billingData?.currentMonth?.estimatedMonthEnd || 0;
  const totalRequests = billingData?.currentMonth?.requests || 0;

  // Generate dynamic alerts based on actual data
  const alerts: Alert[] = [];

  // Low balance alert
  if (balance <= 0) {
    alerts.push({
      id: "balance-depleted",
      name: "Balance Depleted",
      description: `Your balance is ${formatCurrency(balance)}. Services are disabled.`,
      threshold: 0,
      type: "balance",
      status: "triggered",
    });
  } else if (balance < 5) {
    alerts.push({
      id: "low-balance",
      name: "Low Balance Warning",
      description: `Balance below $5.00 (Current: ${formatCurrency(balance)})`,
      threshold: 5,
      type: "balance",
      status: "warning",
    });
  } else if (balance < 10) {
    alerts.push({
      id: "balance-notice",
      name: "Balance Notice",
      description: `Balance below $10.00 (Current: ${formatCurrency(balance)})`,
      threshold: 10,
      type: "balance",
      status: "active",
    });
  }

  // Spending alerts
  if (currentMonthCost > 0) {
    if (estimatedMonthEnd > balance) {
      alerts.push({
        id: "projected-exceed",
        name: "Projected Balance Exceed",
        description: `Estimated month-end cost (${formatCurrency(estimatedMonthEnd)}) exceeds balance`,
        threshold: balance,
        type: "spending",
        status: "warning",
      });
    }

    // 80% budget alert (assuming initial $10 balance as reference)
    const budgetThreshold = 8; // 80% of $10
    if (currentMonthCost >= budgetThreshold) {
      alerts.push({
        id: "budget-80",
        name: "80% Budget Alert",
        description: `Spending at ${formatCurrency(currentMonthCost)} this month`,
        threshold: budgetThreshold,
        type: "spending",
        status: currentMonthCost >= 10 ? "triggered" : "warning",
      });
    }
  }

  // Usage alerts
  if (totalRequests >= 1000) {
    alerts.push({
      id: "high-usage",
      name: "High API Usage",
      description: `${totalRequests.toLocaleString()} API calls this month`,
      threshold: 1000,
      type: "usage",
      status: totalRequests >= 5000 ? "warning" : "active",
    });
  }

  // Default alerts if no issues
  if (alerts.length === 0) {
    alerts.push({
      id: "all-good",
      name: "All Systems Normal",
      description: `Balance: ${formatCurrency(balance)} • No alerts triggered`,
      threshold: 0,
      type: "balance",
      status: "active",
    });
  }

  return (
    <div className="space-y-5">
      {/* Balance Status Card */}
      <div className={`p-4 rounded-lg border ${balance <= 0 ? 'bg-red-50 border-red-200' : balance < 5 ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'}`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg">Account Balance</h3>
            <p className="text-sm text-gray-600">
              {balance <= 0 
                ? "Add credits to continue using AI services" 
                : balance < 5 
                ? "Consider adding more credits soon"
                : "Your account is in good standing"}
            </p>
          </div>
          <div className={`text-3xl font-bold ${balance <= 0 ? 'text-red-600' : balance < 5 ? 'text-yellow-600' : 'text-green-600'}`}>
            {formatCurrency(balance)}
          </div>
        </div>
      </div>

      {/* Active Alerts */}
      <div className="space-y-4">
        <div>
          <h3 className="xl:text-xl text-lg font-bold text-secondary-700">
            Cost Alerts
          </h3>
          <p className="text-sm font-medium text-gray-500">
            Notifications for usage and spending limits
          </p>
        </div>

        <div className="flex flex-wrap divide-y divide-gray-200">
          {alerts.map((alert) => (
            <div key={alert.id} className="w-full">
              <div className="py-4 flex flex-wrap justify-between items-center gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold">{alert.name}</h4>
                  </div>
                  <span className="text-xs font-medium text-gray-400">
                    {alert.description}
                  </span>
                </div>

                <div className="inline-flex gap-1">
                  <span
                    className={`px-3 py-1 inline-flex items-center gap-1 text-xs font-semibold rounded-full border text-nowrap ${getStatusClass(
                      alert.status
                    )}`}
                  >
                    {alert.status === "triggered" ? "⚠️ " : alert.status === "warning" ? "⚡ " : "✓ "}
                    {alert.status.charAt(0).toUpperCase() + alert.status.slice(1)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tips Section */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="font-bold text-blue-800 mb-2">💡 Tips to Optimize Costs</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Use GPT-4o-mini for faster and more affordable queries</li>
          <li>• Keep conversation history short to reduce token usage</li>
          <li>• Monitor your usage regularly to avoid unexpected charges</li>
          <li>• Set up alerts to get notified before running out of credits</li>
        </ul>
      </div>
    </div>
  );
}
