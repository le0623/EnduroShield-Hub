"use client";

import { useState } from "react";
import Image from "next/image";
import GeneralTab from "./components/setting-general";
import SecurityTab from "./components/setting-security";
import NotificationTab from "./components/setting-notifications";
import IntegrationsTab from "./components/setting-integration";
import AdvancedTab from "./components/setting-advance";

export default function Settings() {
  const [activeTab, setActiveTab] = useState("general");

  const renderTabContent = () => {
    switch (activeTab) {
      case "general":
        return <GeneralTab />;
      case "security":
        return <SecurityTab />;
      case "notifications":
        return <NotificationTab />;
      case "integrations":
        return <IntegrationsTab />;
      case "advanced":
        return <AdvancedTab />;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <div className="flex flex-wrap gap-y-4">
        <div className="w-full">
          <div className="h-full p-5 lg:pb-0 relative">
            {/* Background Blobs */}
            <div className="rounded-xl absolute inset-0 bg-[#e4e4e4] overflow-hidden">
              <div className="w-[27vw] h-[11vw] rounded-[50%] bg-[#0198FF] blur-[100px] absolute top-[10vw] right-[10vw] rotate-[37deg] opacity-80"></div>
              <div className="w-[40vw] h-[18vw] rounded-[50%] bg-[#FEDCB6] blur-[130px] absolute top-[6vw] -right-[15vw] rotate-[50deg]"></div>
              <div className="w-[17vw] h-[11vw] rounded-[50%] bg-[#0198FF] blur-[70px] absolute top-[20vw] -right-[10vw] -rotate-[37deg] opacity-80"></div>
            </div>

            {/* Foreground Content */}
            <div className="relative">
              <div className="flex flex-wrap gap-y-5">
                {/* Image Section */}
                <div className="lg:-mt-9 md:w-1/2 md:order-last text-center">
                  <Image
                    src="/images/settings-3d.png"
                    alt="Settings"
                    width={500}
                    height={400}
                    className="max-w-full inline-block"
                  />
                </div>

                {/* Text Section */}
                <div className="flex flex-col items-start justify-center space-y-5 md:w-1/2 md:order-first [&_strong]:text-primary-500">
                  <div>
                    <h2 className="xl:text-4xl lg:text-3xl md:text-2xl text-xl font-extrabold leading-[1.2]">
                      System Settings
                    </h2>
                    <p>Configure your document management system</p>
                  </div>
                  <button className="btn btn-secondary !inline-flex gap-1 !justify-start">
                    <Image
                      src="/images/icons/save.svg"
                      alt="Save"
                      width={20}
                      height={20}
                    />
                    Save All Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs Section */}
        <div className="w-full">
          <div className="rounded-xl border light-border bg-white h-full">
            {/* Tabs */}
            <ul className="mb-3 nav nav-tabs flex border-b light-border [&>*]:flex-1 [&>*]:nav-item [&>*]:inline-flex [&>*]:justify-center [&>*]:items-center [&>*]:gap-1">
              {["general", "security", "notifications", "integrations", "advanced"].map((tab) => (
                <li
                  key={tab}
                  className={`nav-item cursor-pointer py-2 ${activeTab === tab
                    ? "border-b-3 border-primary"
                    : ""
                    }`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </li>
              ))}
            </ul>

            {/* Tab Content */}
            <div className="p-4">{renderTabContent()}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
