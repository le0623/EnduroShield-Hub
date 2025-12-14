"use client";

import Image from "next/image";
import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PlusIcon } from "lucide-react";

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  key?: string; // Only present when first created
  expirationDate: string | null;
  isEnabled: boolean;
  dailyLimit: number;
  monthlyLimit: number;
  lastUsedAt: string | null;
  createdAt: string;
  dailyCost: number;
  dailyRequests: number;
  monthlyCost: number;
  isExpired: boolean;
}

export default function ApiKeyManagement() {
  const params = useParams();
  const subdomain = params?.subdomain as string;

  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const [editingLimits, setEditingLimits] = useState<{ [key: string]: { dailyLimit: string; monthlyLimit: string } }>({});

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    expirationDuration: "1month" as "1month" | "3months" | "6months" | "1year" | "forever",
    dailyLimit: "",
    monthlyLimit: "",
  });

  // Fetch API keys
  useEffect(() => {
    fetchApiKeys();
  }, []);

  const fetchApiKeys = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/api-keys");
      if (response.ok) {
        const data = await response.json();
        setApiKeys(data.apiKeys || []);
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to fetch API keys");
      }
    } catch (err) {
      setError("Failed to fetch API keys");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          expirationDuration: formData.expirationDuration,
          dailyLimit: parseFloat(formData.dailyLimit) || 0,
          monthlyLimit: parseFloat(formData.monthlyLimit) || 0,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setNewKeyValue(data.apiKey.key);
        setSuccess("API key created successfully! Copy it now - you won't be able to see it again.");
        setShowCreateModal(false); // Close the create modal
        setFormData({
          name: "",
          expirationDuration: "1month",
          dailyLimit: "",
          monthlyLimit: "",
        });
        await fetchApiKeys();
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to create API key");
      }
    } catch (err) {
      setError("Failed to create API key");
    }
  };

  const handleUpdateApiKey = async (keyId: string, updates: Partial<ApiKey>) => {
    setError("");
    setSuccess("");

    // Optimistic update for enable/disable
    if (updates.isEnabled !== undefined) {
      setApiKeys(prev => prev.map(key =>
        key.id === keyId ? { ...key, isEnabled: updates.isEnabled! } : key
      ));
    }

    try {
      const response = await fetch(`/api/api-keys/${keyId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        // Only show success message for non-enable/disable updates
        if (updates.isEnabled === undefined) {
          setSuccess("API key updated successfully");
          // Refresh to get latest data for limit updates
          await fetchApiKeys();
        }
        // For enable/disable, we don't need to refresh since optimistic update already handled it
        // Clear editing state for this key
        setEditingLimits(prev => {
          const newState = { ...prev };
          delete newState[keyId];
          return newState;
        });
      } else {
        // Revert optimistic update on error
        if (updates.isEnabled !== undefined) {
          setApiKeys(prev => prev.map(key =>
            key.id === keyId ? { ...key, isEnabled: !updates.isEnabled! } : key
          ));
        }
        const errorData = await response.json();
        setError(errorData.error || "Failed to update API key");
      }
    } catch (err) {
      // Revert optimistic update on error
      if (updates.isEnabled !== undefined) {
        setApiKeys(prev => prev.map(key =>
          key.id === keyId ? { ...key, isEnabled: !updates.isEnabled! } : key
        ));
      }
      setError("Failed to update API key");
    }
  };

  const startEditingLimits = (keyId: string, dailyLimit: number, monthlyLimit: number) => {
    setEditingLimits(prev => ({
      ...prev,
      [keyId]: {
        dailyLimit: dailyLimit.toString(),
        monthlyLimit: monthlyLimit.toString(),
      }
    }));
  };

  const saveLimits = (keyId: string) => {
    const limits = editingLimits[keyId];
    if (!limits) return;

    handleUpdateApiKey(keyId, {
      dailyLimit: parseFloat(limits.dailyLimit) || 0,
      monthlyLimit: parseFloat(limits.monthlyLimit) || 0,
    });
  };

  const cancelEditingLimits = (keyId: string) => {
    setEditingLimits(prev => {
      const newState = { ...prev };
      delete newState[keyId];
      return newState;
    });
  };

  const handleDeleteApiKey = async (keyId: string) => {
    if (!confirm("Are you sure you want to delete this API key? This action cannot be undone.")) {
      return;
    }

    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/api-keys/${keyId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setSuccess("API key deleted successfully");
        await fetchApiKeys();
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to delete API key");
      }
    } catch (err) {
      setError("Failed to delete API key");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setSuccess("Copied to clipboard!");
    setTimeout(() => setSuccess(""), 3000);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleDateString();
  };

  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(2)}`;
  };

  const getApiEndpoint = () => {
    const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost:3000";
    const protocol = window.location.protocol === "https:" ? "https" : "http";
    return `${protocol}://${subdomain}.${rootDomain}/api/query`;
  };

  return (
    <div className="flex flex-col">
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
          {success}
        </div>
      )}

      <div className="flex flex-wrap gap-y-6">
        <div className="flex lg:flex-row flex-col gap-6 w-full">
          {/* Left Section */}
          <div className="lg:w-3/5 w-full">
            <div className="mb-4 p-5 relative">
              {/* Background Blobs */}
              <div className="rounded-xl absolute inset-0 bg-[#e4e4e4] overflow-hidden">
                <div className="w-[27vw] h-[11vw] rounded-[50%] bg-[#0198FF] blur-[100px] absolute top-[10vw] right-[10vw] rotate-[37deg] opacity-80"></div>
                <div className="w-[40vw] h-[18vw] rounded-[50%] bg-[#FEDCB6] blur-[130px] absolute top-[6vw] -right-[15vw] rotate-[50deg]"></div>
                <div className="w-[17vw] h-[11vw] rounded-[50%] bg-[#0198FF] blur-[70px] absolute top-[20vw] -right-[10vw] -rotate-[37deg] opacity-80"></div>
              </div>

              <div className="relative">
                <div className="flex flex-wrap gap-y-5">
                  <div className="lg:-mt-9 md:w-1/2 md:order-last text-center">
                    <Image
                      src="/images/apikey-3d.png"
                      alt="API Key"
                      width={300}
                      height={300}
                      className="max-w-full inline-block"
                    />
                  </div>

                  <div className="flex flex-col items-start justify-center space-y-5 md:w-1/2 md:order-first">
                    <div>
                      <h2 className="xl:text-4xl lg:text-3xl md:text-2xl text-xl font-extrabold leading-[1.2]">
                        API Key Management
                      </h2>
                      <p>Manage API keys for AI-powered search</p>
                    </div>
                    <Button
                      onClick={() => setShowCreateModal(true)}
                      className="flex items-center gap-1"
                    >
                      <PlusIcon className="size-4" />
                      <span>Create API Key</span>
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* API Keys List */}
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : apiKeys.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No API keys found. Create your first API key to get started.
              </div>
            ) : (
              <div className="space-y-4">
                {apiKeys.map((key) => (
                  <div
                    key={key.id}
                    className="p-4 rounded-lg border border-gray-200 space-y-4"
                  >
                    <div className="flex flex-wrap justify-between items-center gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-bold">{key.name}</h4>
                          <span
                            className={`px-3 py-1 inline-block text-xs font-semibold text-white rounded-full ${key.isExpired
                                ? "bg-red-500"
                                : !key.isEnabled
                                  ? "bg-gray-500"
                                  : "bg-emerald-500"
                              }`}
                          >
                            {key.isExpired
                              ? "Expired"
                              : !key.isEnabled
                                ? "Disabled"
                                : "Active"}
                          </span>
                        </div>
                        <div className="text-sm text-gray-500 font-mono">
                          {key.prefix}...
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-3">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={key.isEnabled}
                            onCheckedChange={(checked) => {
                              // Fire and forget - optimistic update handles UI
                              handleUpdateApiKey(key.id, {
                                isEnabled: checked,
                              });
                            }}
                            disabled={key.isExpired}
                          />
                        </div>
                        <button
                          onClick={() => handleDeleteApiKey(key.id)}
                          className="btn btn-light text-sm text-red-600"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    <div className="divide-y divide-gray-200">
                      <div className="pb-4 space-y-3">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Expires:</span>{" "}
                            <span className="font-medium">
                              {formatDate(key.expirationDate)}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Last Used:</span>{" "}
                            <span className="font-medium">
                              {key.lastUsedAt
                                ? formatDate(key.lastUsedAt)
                                : "Never"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="xl:text-lg text-base font-bold text-secondary-700">
                            Usage Limits
                          </h3>
                          {!editingLimits[key.id] && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => startEditingLimits(key.id, key.dailyLimit, key.monthlyLimit)}
                            >
                              Edit Limits
                            </Button>
                          )}
                        </div>
                        {editingLimits[key.id] ? (
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor={`daily-${key.id}`} className="text-sm">
                                Daily Limit ($)
                              </Label>
                              <Input
                                id={`daily-${key.id}`}
                                type="number"
                                step="0.01"
                                min="0"
                                value={editingLimits[key.id].dailyLimit}
                                onChange={(e) =>
                                  setEditingLimits(prev => ({
                                    ...prev,
                                    [key.id]: {
                                      ...prev[key.id],
                                      dailyLimit: e.target.value,
                                    }
                                  }))
                                }
                                placeholder="0 = unlimited"
                              />
                              <div className="text-xs text-gray-500">
                                Used: {formatCurrency(key.dailyCost)} ({key.dailyRequests} requests)
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`monthly-${key.id}`} className="text-sm">
                                Monthly Limit ($)
                              </Label>
                              <Input
                                id={`monthly-${key.id}`}
                                type="number"
                                step="0.01"
                                min="0"
                                value={editingLimits[key.id].monthlyLimit}
                                onChange={(e) =>
                                  setEditingLimits(prev => ({
                                    ...prev,
                                    [key.id]: {
                                      ...prev[key.id],
                                      monthlyLimit: e.target.value,
                                    }
                                  }))
                                }
                                placeholder="0 = unlimited"
                              />
                              <div className="text-xs text-gray-500">
                                Used: {formatCurrency(key.monthlyCost)}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-sm text-gray-500">
                                Daily Limit
                              </label>
                              <div className="text-lg font-semibold">
                                {key.dailyLimit > 0
                                  ? formatCurrency(key.dailyLimit)
                                  : "Unlimited"}
                              </div>
                              <div className="text-xs text-gray-500">
                                Used: {formatCurrency(key.dailyCost)} (
                                {key.dailyRequests} requests)
                              </div>
                            </div>
                            <div>
                              <label className="text-sm text-gray-500">
                                Monthly Limit
                              </label>
                              <div className="text-lg font-semibold">
                                {key.monthlyLimit > 0
                                  ? formatCurrency(key.monthlyLimit)
                                  : "Unlimited"}
                              </div>
                              <div className="text-xs text-gray-500">
                                Used: {formatCurrency(key.monthlyCost)}
                              </div>
                            </div>
                          </div>
                        )}
                        {editingLimits[key.id] && (
                          <div className="flex gap-2 pt-2">
                            <Button
                              size="sm"
                              onClick={() => saveLimits(key.id)}
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => cancelEditingLimits(key.id)}
                            >
                              Cancel
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Section - API Documentation */}
          <div className="lg:w-2/5 w-full">
            <div className="rounded-xl border light-border bg-white p-4 space-y-5">
              <div>
                <h3 className="xl:text-xl text-lg font-bold text-secondary-700">
                  API Documentation
                </h3>
                <p className="text-sm font-medium text-gray-500">
                  Use your API keys to access AI-powered search
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="font-bold mb-2">Endpoint</h4>
                  <code className="block p-2 bg-gray-100 rounded text-sm break-all">
                    {getApiEndpoint()}
                  </code>
                </div>

                <div>
                  <h4 className="font-bold mb-2">Authentication</h4>
                  <p className="text-sm text-gray-600 mb-2">
                    Include your API key in the Authorization header:
                  </p>
                  <code className="block p-2 bg-gray-100 rounded text-sm">
                    Authorization: Bearer {"<your_api_key>"}
                  </code>
                </div>

                <div>
                  <h4 className="font-bold mb-2">Request Example</h4>
                  <pre className="p-2 bg-gray-100 rounded text-xs overflow-x-auto">
                    {`POST /api/query
Content-Type: application/json
Authorization: Bearer eb_...

{
  "query": "What is the company policy?",
  "conversationHistory": []
}`}
                  </pre>
                </div>

                <div>
                  <h4 className="font-bold mb-2">Response Example</h4>
                  <pre className="p-2 bg-gray-100 rounded text-xs overflow-x-auto">
                    {`{
  "answer": "The company policy states...",
  "query": "What is the company policy?",
  "timestamp": "2024-01-01T00:00:00Z"
}`}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create API Key Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create New API Key</DialogTitle>
            <DialogDescription>
              Create a new API key to access the AI-powered search API. Configure expiration and usage limits.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateApiKey}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="api-key-name">Name</Label>
                <Input
                  id="api-key-name"
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                  placeholder="e.g., Production API Key"
                />
                <p className="text-xs text-muted-foreground">
                  A descriptive name to help you identify this API key
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="api-key-expiration">Expiration</Label>
                <select
                  id="api-key-expiration"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  value={formData.expirationDuration}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      expirationDuration: e.target.value as any,
                    })
                  }
                >
                  <option value="1month">1 Month</option>
                  <option value="3months">3 Months</option>
                  <option value="6months">6 Months</option>
                  <option value="1year">1 Year</option>
                  <option value="forever">Never Expires</option>
                </select>
                <p className="text-xs text-muted-foreground">
                  Choose when this API key should expire
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="api-key-daily-limit">Daily Limit ($)</Label>
                  <Input
                    id="api-key-daily-limit"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.dailyLimit}
                    onChange={(e) =>
                      setFormData({ ...formData, dailyLimit: e.target.value })
                    }
                    placeholder="0 = unlimited"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="api-key-monthly-limit">Monthly Limit ($)</Label>
                  <Input
                    id="api-key-monthly-limit"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.monthlyLimit}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        monthlyLimit: e.target.value,
                      })
                    }
                    placeholder="0 = unlimited"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Set usage limits in dollars. Leave as 0 for unlimited usage.
              </p>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowCreateModal(false);
                  setNewKeyValue(null);
                  setFormData({
                    name: "",
                    expirationDuration: "1month",
                    dailyLimit: "",
                    monthlyLimit: "",
                  });
                }}
              >
                Cancel
              </Button>
              <Button type="submit">Create API Key</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* New Key Display Modal */}
      <Dialog open={!!newKeyValue} onOpenChange={(open) => {
        if (!open) {
          setNewKeyValue(null);
          setShowCreateModal(false);
        }
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>API Key Created!</DialogTitle>
            <DialogDescription className="text-destructive">
              ⚠️ Copy this key now. You won't be able to see it again.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex gap-2">
              <code className="flex-1 p-3 bg-muted rounded-md text-sm break-all font-mono border">
                {newKeyValue}
              </code>
              <Button
                type="button"
                onClick={() => copyToClipboard(newKeyValue!)}
                variant="outline"
              >
                Copy
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                setNewKeyValue(null);
                setShowCreateModal(false);
              }}
              className="w-full"
            >
              I've Copied It
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
