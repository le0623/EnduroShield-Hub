"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";

interface Tenant {
  id: string;
  name: string;
  subdomain: string;
  isOwner: boolean;
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
  const [availableTenants, setAvailableTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);

  const { data: session } = useSession();
  const params = useParams();
  const subdomain = params?.subdomain as string;

  // Fetch tenant data
  useEffect(() => {
    const fetchTenantData = async () => {
      try {
        const response = await fetch('/api/tenant/list');
        if (response.ok) {
          const data = await response.json();
          setAvailableTenants(data.tenants || []);

          // Find current tenant by subdomain
          const current = data.tenants?.find((tenant: Tenant) =>
            tenant.subdomain === subdomain
          );
          setCurrentTenant(current || null);
        }
      } catch (error) {
        console.error('Failed to fetch tenant data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (session) {
      fetchTenantData();
    }
  }, [session, subdomain]);

  // Load widget script dynamically
  useEffect(() => {
    const loadWidget = async () => {
      try {
        // Remove any existing widget first
        const existingContainer = document.getElementById('enduroshieldhub-widget-container');
        if (existingContainer) {
          existingContainer.remove();
        }
        
        // Remove existing script if any
        const existingScript = document.querySelector('script[src*="/api/widget/"]');
        if (existingScript) {
          existingScript.remove();
        }

        // Reset widget flag
        if ((window as any).EnduroShieldHubWidget) {
          delete (window as any).EnduroShieldHubWidget;
        }

        // Fetch widget configuration for current tenant
        const response = await fetch('/api/widget');
        if (response.ok) {
          const data = await response.json();
          if (data.widget && data.widget.enabled && data.widget.widgetId) {
            // Get base URL
            const baseUrl = window.location.origin.includes('/s/')
              ? window.location.origin.split('/s/')[0]
              : window.location.origin;

            // Add cache-busting parameter using updatedAt timestamp
            const cacheBuster = data.widget.updatedAt 
              ? `?v=${new Date(data.widget.updatedAt).getTime()}` 
              : `?v=${Date.now()}`;

            // Create and load script
            const script = document.createElement('script');
            script.src = `${baseUrl}/api/widget/${data.widget.widgetId}/embed.js${cacheBuster}`;
            script.async = true;
            script.onerror = () => {
              console.error('Failed to load widget script');
            };
            document.head.appendChild(script);
          }
        }
      } catch (error) {
        console.error('Error loading widget:', error);
      }
    };

    if (session && currentTenant && !loading) {
      loadWidget();
    }
  }, [session, currentTenant, loading]);

  const user = session?.user ? {
    name: session.user.name || 'User',
    email: session.user.email || '',
    avatar: session.user.image || '/images/avatar.jpg'
  } : undefined;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <svg className="pl" viewBox="0 0 128 128" width="128px" height="128px" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="pl-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(193,90%,55%)"></stop>
              <stop offset="100%" stopColor="hsl(223,90%,55%)"></stop>
            </linearGradient>
          </defs>
          <circle className="pl__ring" r="56" cx="64" cy="64" fill="none" stroke="hsla(0,10%,10%,0.1)" strokeWidth="16" strokeLinecap="round"></circle>
          <path className="pl__worm" d="M92,15.492S78.194,4.967,66.743,16.887c-17.231,17.938-28.26,96.974-28.26,96.974L119.85,59.892l-99-31.588,57.528,89.832L97.8,19.349,13.636,88.51l89.012,16.015S81.908,38.332,66.1,22.337C50.114,6.156,36,15.492,36,15.492a56,56,0,1,0,56,0Z" fill="none" stroke="url(#pl-grad)" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="44 1111" strokeDashoffset="10"></path>
        </svg>
      </div>
    );
  }

  return (
    <div className={`h-screen bg-base-100 p-4 lg:p-8`}>
      <div className="flex h-full gap-0 lg:gap-6">
        {/* Sidebar */}
        <Sidebar isOpen={isOpen} onClose={() => setIsOpen(false)} />

        <main className="h-full w-full flex flex-col">
          <Navbar
            user={user}
            onToggleSidebar={() => setIsOpen(!isOpen)}
            currentTenant={currentTenant}
            availableTenants={availableTenants}
          />
          <div className="flex-1 overflow-hidden flex flex-col">
            <main className="relative pt-6 flex-1 flex flex-col min-h-0 overflow-y-auto">
              {children}
            </main>
          </div>
        </main>
      </div>
    </div>
  );
}