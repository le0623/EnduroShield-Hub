"use client";

import { useState } from "react";
import UsageDetails from "./components/usage-details";
import BillingHistory from "./components/billing-history";
import CostAlerts from "./components/cost-alerts";
import { useBillingOverview, useBalance } from "@/lib/hooks/useQueries";

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
  return `$${amount.toFixed(2)}`;
}

export default function Billing() {
  const [activeTab, setActiveTab] = useState("usage");
  const { data: billingData, isLoading, error } = useBillingOverview();
  const { data: balanceData } = useBalance();

  const tabs = [
    { id: "usage", label: "Usage Details" },
    { id: "history", label: "Billing History" },
    { id: "alerts", label: "Cost Alerts" },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case "usage":
        return <UsageDetails />;
      case "history":
        return <BillingHistory />;
      case "alerts":
        return <CostAlerts />;
      default:
        return null;
    }
  };

  const hasInsufficientBalance = balanceData?.hasInsufficientBalance || false;
  const currentMonthCost = billingData?.currentMonth?.cost || 0;
  const totalRequests = billingData?.currentMonth?.requests || 0;
  const totalTokens = billingData?.currentMonth?.tokens || 0;
  const estimatedMonthEnd = billingData?.currentMonth?.estimatedMonthEnd || 0;
  const costChange = billingData?.currentMonth?.costChange || 0;
  const requestChange = billingData?.currentMonth?.requestChange || 0;
  const tokenChange = billingData?.currentMonth?.tokenChange || 0;

  return (
    <div className="flex flex-col">
      {/* Insufficient Balance Warning */}
      {hasInsufficientBalance && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h3 className="text-red-800 font-bold">Insufficient Balance</h3>
              <p className="text-red-700 text-sm">
                Your account balance is depleted. AI search services are temporarily disabled. 
                Please add credits to continue using the service.
              </p>
            </div>
            <div className="ml-auto">
              <span className="text-2xl font-bold text-red-600">
                {formatCurrency(balanceData?.balance || 0)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Top Section */}
      <div className="flex flex-wrap gap-y-4 -mx-3">
        <div className="lg:w-3/5 w-full px-3">
          <div className="h-full p-5 lg:pb-0 relative">
            <div className="rounded-xl absolute inset-0 bg-[#e4e4e4] overflow-hidden">
              <div className="w-[27vw] h-[11vw] rounded-[50%] bg-[#0198FF] blur-[100px] absolute top-[10vw] right-[10vw] rotate-[37deg] opacity-80"></div>
              <div className="w-[40vw] h-[18vw] rounded-[50%] bg-[#FEDCB6] blur-[130px] absolute top-[6vw] -right-[15vw] rotate-[50deg]"></div>
              <div className="w-[17vw] h-[11vw] rounded-[50%] bg-[#0198FF] blur-[70px] absolute top-[20vw] -right-[10vw] -rotate-[37deg] opacity-80"></div>
            </div>
            <div className="relative">
              <div className="flex flex-wrap gap-y-5">
                <div className="lg:-mt-9 md:w-1/2 md:order-last text-center">
                  <img
                    src="/images/billing-3d.png"
                    alt=""
                    className="max-w-full inline-block"
                  />
                </div>
                <div className="flex flex-col items-start justify-center [&_h1_strong]:text-primary-500 space-y-5 md:w-1/2 md:order-first [&_strong]:text-primary-500">
                  <div>
                    <h2 className="xl:text-4xl lg:text-3xl md:text-2xl text-xl font-extrabold leading-[1.2]">
                      Billing & Usage
                    </h2>
                    <p>Monitor your AI service costs and usage</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="bg-white/90 backdrop-blur px-4 py-2 rounded-lg">
                      <span className="text-sm text-gray-600">Balance</span>
                      <p className={`text-xl font-bold ${hasInsufficientBalance ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(balanceData?.balance || 0)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Section */}
        <div className="lg:w-2/5 w-full px-3">
          <div className="rounded-xl border light-border bg-white h-full p-4">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-full text-red-500">
                Failed to load billing data
              </div>
            ) : (
              <ul className="flex flex-wrap justify-between items-center sm:[&>*:nth-of-type(2n+1)]:border-r sm:[&>*:not(:nth-last-child(-n+2))]:border-b [&>*]:border-gray-200">
                <li className="sm:w-1/2 w-full px-6 py-5 flex flex-col items-start">
                  <span className="text-gray-500 text-sm font-medium">
                    Current Month
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="xl:text-3xl lg:text-2xl text-xl font-extrabold text-gray-900">
                      {formatCurrency(currentMonthCost)}
                    </span>
                    {costChange !== 0 && (
                      <span className={`text-sm font-bold flex ${costChange > 0 ? 'text-green-600 [&_img]:icon-theme-green-500' : 'text-red-600 [&_img]:icon-red-500'}`}>
                        <img
                          src={costChange > 0 ? "/images/icons/arrow-upward.svg" : "/images/icons/arrow-downward.svg"}
                          alt={costChange > 0 ? "Up" : "Down"}
                          width="16"
                        />{" "}
                        {Math.abs(costChange)}%
                      </span>
                    )}
                  </div>
                </li>

                <li className="sm:w-1/2 w-full px-6 py-5 flex flex-col items-start">
                  <span className="text-gray-500 text-sm font-medium">
                    API Calls
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="xl:text-3xl lg:text-2xl text-xl font-extrabold text-gray-900">
                      {formatNumber(totalRequests)}
                    </span>
                    {requestChange !== 0 && (
                      <span className={`text-sm font-bold flex ${requestChange > 0 ? 'text-green-600 [&_img]:icon-theme-green-500' : 'text-red-600 [&_img]:icon-red-500'}`}>
                        <img
                          src={requestChange > 0 ? "/images/icons/arrow-upward.svg" : "/images/icons/arrow-downward.svg"}
                          alt={requestChange > 0 ? "Up" : "Down"}
                          width="16"
                        />{" "}
                        {Math.abs(requestChange)}%
                      </span>
                    )}
                  </div>
                </li>

                <li className="sm:w-1/2 w-full px-6 py-5 flex flex-col items-start">
                  <span className="text-gray-500 text-sm font-medium">
                    Tokens Used
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="xl:text-3xl lg:text-2xl text-xl font-extrabold text-gray-900">
                      {formatNumber(totalTokens)}
                    </span>
                    {tokenChange !== 0 && (
                      <span className={`text-sm font-bold flex ${tokenChange > 0 ? 'text-green-600 [&_img]:icon-theme-green-500' : 'text-red-600 [&_img]:icon-red-500'}`}>
                        <img
                          src={tokenChange > 0 ? "/images/icons/arrow-upward.svg" : "/images/icons/arrow-downward.svg"}
                          alt={tokenChange > 0 ? "Up" : "Down"}
                          width="16"
                        />{" "}
                        {Math.abs(tokenChange)}%
                      </span>
                    )}
                  </div>
                </li>

                <li className="sm:w-1/2 w-full px-6 py-5 flex flex-col items-start">
                  <span className="text-gray-500 text-sm font-medium">
                    Est. Month End
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="xl:text-3xl lg:text-2xl text-xl font-extrabold text-gray-900">
                      {formatCurrency(estimatedMonthEnd)}
                    </span>
                  </div>
                </li>
              </ul>
            )}
          </div>
        </div>

        {/* Tabs Section */}
        <div className="w-full px-3 mt-4">
          <div className="rounded-xl border light-border bg-white h-full p-4">
            {/* Tabs */}
            <ul className="mb-3 nav nav-tabs flex border-b light-border [&>*]:flex-1 [&>*]:nav-item [&>*]:inline-flex [&>*]:justify-center [&>*]:items-center [&>*]:gap-1">
              {tabs.map((tab) => (
                <li key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`nav-item cursor-pointer ${activeTab === tab.id
                    ? "active"
                    : ""
                    }`}
                >
                  {tab.label}
                </li>
              ))}
            </ul>

            {/* Tab Content */}
            <div>{renderTabContent()}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
