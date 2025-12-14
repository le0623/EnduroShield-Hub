"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface WidgetConfig {
  id?: string;
  enabled: boolean;
  widgetId: string;
  primaryColor: string;
  secondaryColor: string;
  position: string;
  title: string;
  updatedAt?: string;
  welcomeMessage: string;
  placeholder: string;
  showBranding: boolean;
  customCss?: string;
}

export default function WidgetPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCheckingPermission, setIsCheckingPermission] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [embedCode, setEmbedCode] = useState("");

  const [config, setConfig] = useState<WidgetConfig>({
    enabled: true,
    widgetId: "",
    primaryColor: "#3B82F6",
    secondaryColor: "#1E40AF",
    position: "bottom-right",
    title: "AI Assistant",
    welcomeMessage: "Hello! How can I help you today?",
    placeholder: "Type your message...",
    showBranding: true,
    customCss: "",
  });

  // Check admin permission
  useEffect(() => {
    const checkPermission = async () => {
      try {
        const response = await fetch("/api/user/membership");
        if (response.ok) {
          const data = await response.json();
          if (!data.isAdmin) {
            router.push("/dashboard");
            return;
          }
        } else {
          router.push("/dashboard");
          return;
        }
      } catch (error) {
        console.error("Failed to check permission:", error);
        router.push("/dashboard");
        return;
      } finally {
        setIsCheckingPermission(false);
      }
    };

    checkPermission();
  }, [router]);

  // Load widget configuration
  useEffect(() => {
    if (!isCheckingPermission) {
      loadWidgetConfig();
    }
  }, [isCheckingPermission]);

  const loadWidgetConfig = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/widget");
      if (response.ok) {
        const data = await response.json();
        if (data.widget) {
          setConfig(data.widget);
          generateEmbedCode(data.widget.widgetId, data.widget.updatedAt, false);
        } else {
          // Generate widget ID if not exists
          const newWidgetId = `widget_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          setConfig({ ...config, widgetId: newWidgetId });
        }
      } else {
        setError("Failed to load widget configuration");
      }
    } catch (error) {
      console.error("Error loading widget:", error);
      setError("Failed to load widget configuration");
    } finally {
      setIsLoading(false);
    }
  };

  const generateEmbedCode = (widgetId: string, updatedAt?: string, useIframe: boolean = false) => {
    // Get base URL (remove subdomain path)
    const currentUrl = window.location.origin;
    const baseUrl = currentUrl.includes('/s/')
      ? currentUrl.split('/s/')[0]
      : currentUrl;

    // Add cache-busting parameter
    const cacheBuster = updatedAt
      ? `?v=${new Date(updatedAt).getTime()}`
      : `?v=${Date.now()}`;

    let code: string;
    if (useIframe) {
      // Iframe embed code
      code = `<iframe 
  src="${baseUrl}/api/widget/${widgetId}/iframe${cacheBuster}"
  width="400"
  height="600"
  frameborder="0"
  style="border: none; border-radius: 12px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);"
  allow="microphone; camera"
></iframe>`;
    } else {
      // Script embed code
      code = `<script>
  (function() {
    var script = document.createElement('script');
    script.src = '${baseUrl}/api/widget/${widgetId}/embed.js${cacheBuster}';
    script.async = true;
    document.head.appendChild(script);
  })();
</script>`;
    }
    setEmbedCode(code);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError("");
      setSuccess("");

      if (!config.widgetId) {
        setError("Widget ID is required");
        return;
      }

      const response = await fetch("/api/widget", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(config),
      });

      if (response.ok) {
        const data = await response.json();
        setConfig(data.widget);
        generateEmbedCode(data.widget.widgetId, data.widget.updatedAt, false);
        setSuccess("Widget configuration saved successfully!");
        setTimeout(() => setSuccess(""), 3000);
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to save widget configuration");
      }
    } catch (error) {
      console.error("Error saving widget:", error);
      setError("Failed to save widget configuration");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyEmbedCode = () => {
    navigator.clipboard.writeText(embedCode);
    setSuccess("Embed code copied to clipboard!");
    setTimeout(() => setSuccess(""), 2000);
  };

  if (isCheckingPermission || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex flex-wrap gap-y-4">
        <div className="w-full">
          <div className="h-full p-5 relative">
            <div className="rounded-xl absolute inset-0 bg-[#e4e4e4] overflow-hidden">
              <div className="w-[27vw] h-[11vw] rounded-[50%] bg-[#0198FF] blur-[100px] absolute top-[10vw] right-[10vw] rotate-[37deg] opacity-80"></div>
              <div className="w-[40vw] h-[18vw] rounded-[50%] bg-[#FEDCB6] blur-[130px] absolute top-[6vw] -right-[15vw] rotate-[50deg]"></div>
            </div>

            <div className="relative">
              <div className="flex flex-wrap gap-y-5">
                <div className="w-full">
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">Widget Configuration</h1>
                  <p className="text-gray-600">Customize your AI assistant widget for third-party websites</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-wrap gap-y-4 mt-6">
        <div className="w-full">
          {/* Success/Error Messages */}
          {success && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
              {success}
            </div>
          )}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Configuration */}
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">Widget Settings</h2>

              {/* Enable/Disable */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Enable Widget
                </label>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.enabled}
                    onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  <span className="ml-3 text-sm text-gray-700">
                    {config.enabled ? "Enabled" : "Disabled"}
                  </span>
                </label>
              </div>

              {/* Widget ID */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Widget ID
                </label>
                <input
                  type="text"
                  value={config.widgetId}
                  onChange={(e) => setConfig({ ...config, widgetId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="widget_123456"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Unique identifier for your widget
                </p>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Widget Title
                </label>
                <input
                  type="text"
                  value={config.title}
                  onChange={(e) => setConfig({ ...config, title: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="AI Assistant"
                />
              </div>

              {/* Welcome Message */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Welcome Message
                </label>
                <textarea
                  value={config.welcomeMessage}
                  onChange={(e) => setConfig({ ...config, welcomeMessage: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="Hello! How can I help you today?"
                />
              </div>

              {/* Placeholder */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Input Placeholder
                </label>
                <input
                  type="text"
                  value={config.placeholder}
                  onChange={(e) => setConfig({ ...config, placeholder: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Type your message..."
                />
              </div>

              {/* Position */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Widget Position
                </label>
                <select
                  value={config.position}
                  onChange={(e) => setConfig({ ...config, position: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="bottom-right">Bottom Right</option>
                  <option value="bottom-left">Bottom Left</option>
                  <option value="top-right">Top Right</option>
                  <option value="top-left">Top Left</option>
                </select>
              </div>

              {/* Colors */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Primary Color
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={config.primaryColor}
                      onChange={(e) => setConfig({ ...config, primaryColor: e.target.value })}
                      className="h-10 w-20 border border-gray-300 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={config.primaryColor}
                      onChange={(e) => setConfig({ ...config, primaryColor: e.target.value })}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Secondary Color
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={config.secondaryColor}
                      onChange={(e) => setConfig({ ...config, secondaryColor: e.target.value })}
                      className="h-10 w-20 border border-gray-300 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={config.secondaryColor}
                      onChange={(e) => setConfig({ ...config, secondaryColor: e.target.value })}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Show Branding */}
              <div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.showBranding}
                    onChange={(e) => setConfig({ ...config, showBranding: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  <span className="ml-3 text-sm text-gray-700">Show Branding</span>
                </label>
              </div>

              {/* Save Button */}
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSaving ? "Saving..." : "Save Configuration"}
              </button>
            </div>

            {/* Right Column - Preview & Embed Code */}
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">Embed Code</h2>

              {/* Embed Mode Toggle */}
              <div className="flex gap-4 mb-4">
                <button
                  onClick={() => generateEmbedCode(config.widgetId, config.updatedAt, false)}
                  className={`px-4 py-2 rounded-lg font-medium ${embedCode.includes('embed.js')
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700'
                    }`}
                >
                  Script Mode
                </button>
                <button
                  onClick={() => generateEmbedCode(config.widgetId, config.updatedAt, true)}
                  className={`px-4 py-2 rounded-lg font-medium ${embedCode.includes('iframe')
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700'
                    }`}
                >
                  Iframe Mode
                </button>
              </div>

              {/* Embed Code */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Copy this code to embed the widget
                </label>
                <div className="relative">
                  <textarea
                    value={embedCode}
                    readOnly
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 font-mono text-sm"
                    rows={6}
                  />
                  <button
                    onClick={handleCopyEmbedCode}
                    className="absolute top-2 right-2 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                  >
                    Copy
                  </button>
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Paste this code before the closing &lt;/body&gt; tag on your website
                </p>
              </div>

              {/* Preview */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Preview
                </label>
                <div className="border border-gray-300 rounded-lg p-4 bg-gray-50 min-h-[400px] relative">
                  <div
                    className={`absolute ${config.position === "bottom-right" ? "bottom-4 right-4" : config.position === "bottom-left" ? "bottom-4 left-4" : config.position === "top-right" ? "top-4 right-4" : "top-4 left-4"} w-80 h-96 bg-white rounded-lg shadow-lg border border-gray-200 flex flex-col`}
                    style={{
                      borderTopColor: config.primaryColor,
                      borderTopWidth: "4px",
                    }}
                  >
                    {/* Header */}
                    <div
                      className="px-4 py-3 rounded-t-lg text-white font-semibold"
                      style={{ backgroundColor: config.primaryColor }}
                    >
                      {config.title}
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 p-4 overflow-y-auto bg-gray-50">
                      <div className="text-sm text-gray-600 mb-2">
                        {config.welcomeMessage}
                      </div>
                    </div>

                    {/* Input Area */}
                    <div className="px-4 py-3 border-t border-gray-200">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder={config.placeholder}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          style={{ borderColor: config.primaryColor }}
                          disabled
                        />
                        <button
                          className="px-4 py-2 rounded-lg text-white text-sm font-medium"
                          style={{ backgroundColor: config.primaryColor }}
                          disabled
                        >
                          Send
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* JavaScript SDK Section */}
              <div className="mt-8 pt-8 border-t border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">JavaScript SDK for AI-Powered Search</h2>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-blue-800 mb-2">
                    Use our JavaScript SDK to integrate AI-powered search directly into your application.
                  </p>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-blue-900 mb-1">1. Include the SDK:</p>
                      <code className="block text-xs bg-white p-2 rounded border border-blue-300 overflow-x-auto">
                        {(() => {
                          const currentUrl = typeof window !== 'undefined' ? window.location.origin : '';
                          const baseUrl = currentUrl.includes('/s/')
                            ? currentUrl.split('/s/')[0]
                            : currentUrl || 'https://your-subdomain.enduroshieldhub.com';
                          return `<script src="${baseUrl}/api/sdk/enduroshieldhub-sdk.js"></script>`;
                        })()}
                      </code>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-blue-900 mb-1">2. Initialize and use:</p>
                      <code className="block text-xs bg-white p-2 rounded border border-blue-300 whitespace-pre overflow-x-auto">
                        {`const sdk = new EnduroShieldHub({
  apiKey: 'your-api-key',
  subdomain: 'your-subdomain'
});

// Perform search
const result = await sdk.search('What is the company policy?');
console.log(result.answer);`}
                      </code>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-600">
                  Get your API key from the <a href="/integration" className="text-blue-600 hover:underline">API Key</a> page.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

