"use client";

import { useBillingOverview } from "@/lib/hooks/useQueries";

// Provider icons mapping
const PROVIDER_ICONS: Record<string, string> = {
  OpenAI: "/images/icons/chatgpt.png",
  Google: "/images/icons/gemini.png",
  Anthropic: "/images/icons/anthropic.png",
};

// Model descriptions
const MODEL_DESCRIPTIONS: Record<string, string> = {
  "gpt-4o": "GPT-4 Omni - Latest multimodal model",
  "gpt-4o-mini": "GPT-4 Omni Mini - Fast and affordable",
  "gpt-4-turbo": "GPT-4 Turbo - High performance",
  "gpt-4": "GPT-4 - Advanced reasoning",
  "gpt-3.5-turbo": "GPT-3.5 Turbo - Fast and efficient",
  "text-embedding-3-small": "Embeddings - Small model",
  "text-embedding-3-large": "Embeddings - Large model",
};

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toLocaleString();
}

function formatCurrency(amount: number): string {
  if (amount >= 1) {
    return `$${amount.toFixed(2)}`;
  }
  if (amount >= 0.01) {
    return `$${amount.toFixed(3)}`;
  }
  return `$${amount.toFixed(4)}`;
}

export default function UsageDetails() {
  const { data: billingData, isLoading, error } = useBillingOverview();

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
        Failed to load usage data
      </div>
    );
  }

  const providers = billingData?.usageByProvider || [];
  const models = billingData?.usageByModel || [];
  const totalCost = billingData?.currentMonth?.cost || 0;

  // If no data yet, show empty state
  if (providers.length === 0 && models.length === 0) {
    return (
      <div className="text-center py-12">
        <img
          src="/images/icons/chart-empty.svg"
          alt="No data"
          className="w-16 h-16 mx-auto mb-4 opacity-50"
        />
        <h3 className="text-lg font-semibold text-gray-600">No usage data yet</h3>
        <p className="text-sm text-gray-500 mt-1">
          Usage data will appear here once you start using the AI services
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Usage by Provider */}
      <div className="space-y-4">
        <div>
          <h3 className="xl:text-xl text-lg font-bold text-secondary-700">
            Usage by Provider
          </h3>
          <p className="text-sm font-medium text-gray-500">
            Current month breakdown by AI service
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-y-4 -mx-2">
            {providers.map((provider) => {
              const progressPercentage = totalCost > 0 
                ? Math.round((provider.cost / totalCost) * 100)
                : 0;
              // Calculate stroke-dashoffset (100 - percentage)
              const strokeDashoffset = 100 - progressPercentage;
              
              return (
                <div key={provider.provider} className="w-full px-2">
                  <div className="p-4 rounded-lg border border-gray-200 flex flex-wrap justify-between items-center gap-3">
                    <div className="flex gap-2">
                      <div className="size-12 flex-none flex justify-center items-center rounded-lg bg-gray-100">
                        <img
                          src={PROVIDER_ICONS[provider.provider] || "/images/icons/ai-provider.svg"}
                          alt={provider.provider}
                          width="30"
                        />
                      </div>
                      <div>
                        <h4 className="font-bold">{provider.provider}</h4>
                        <span className="text-sm font-medium text-gray-500">
                          {provider.models.join(", ")}
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center gap-4">
                      <div className="text-right">
                        <p className="text-xl font-bold">{formatCurrency(provider.cost)}</p>
                        <p className="text-gray-500 text-sm">
                          {formatNumber(provider.requestCount)} calls
                        </p>
                      </div>

                      <div className="relative size-12">
                        <svg
                          className="w-full h-full transform -rotate-90"
                          viewBox="0 0 40 40"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <circle
                            className="text-gray-200"
                            stroke="currentColor"
                            strokeWidth="4"
                            fill="none"
                            cx="20"
                            cy="20"
                            r="16"
                          ></circle>

                          <circle
                            className="text-blue-500"
                            stroke="currentColor"
                            strokeWidth="5"
                            strokeLinecap="round"
                            fill="none"
                            cx="20"
                            cy="20"
                            r="16"
                            strokeDasharray="100"
                            strokeDashoffset={strokeDashoffset}
                          ></circle>
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
                          {progressPercentage}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Usage by Model */}
      <div className="space-y-4">
        <div>
          <h3 className="xl:text-xl text-lg font-bold text-secondary-700">
            Usage by Model
          </h3>
          <p className="text-sm font-medium text-gray-500">
            Detailed breakdown by AI model
          </p>
        </div>

        <div className="flex flex-wrap divide-y divide-gray-200">
          {models.map((model) => (
            <div key={model.model} className="w-full">
              <div className="py-4 flex flex-wrap justify-between items-center gap-3">
                <div className="flex gap-2">
                  <div>
                    <h4 className="font-bold">
                      {model.model}{" "}
                      <span className="px-3 py-1 text-xs font-semibold text-gray-400 rounded-full border border-gray-200 bg-gray-50 text-nowrap">
                        {formatNumber(model.requestCount)} calls
                      </span>
                    </h4>
                    <p className="text-xs text-gray-500 mt-1">
                      {MODEL_DESCRIPTIONS[model.model] || model.provider}
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatNumber(model.promptTokens)} prompt + {formatNumber(model.completionTokens)} completion tokens
                    </p>
                  </div>
                </div>

                <div className="inline-flex gap-1">
                  <p className="text-xl font-bold">{formatCurrency(model.cost)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
