"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function KnowledgeBasePage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to unified search page with KB mode
    router.replace('/search');
  }, [router]);

  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );
}
