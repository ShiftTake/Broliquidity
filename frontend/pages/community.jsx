import React, { useEffect, useState } from "react";

export default function Community() {
  const [content, setContent] = useState("<div class='text-center p-10 text-slate-500'>No community specified.</div>");

  useEffect(() => {
    // Placeholder: In a real app, fetch community data from API or context
    // For now, just show the static fallback
  }, []);

  return (
    <div className="font-sans antialiased bg-slate-50 min-h-screen">
      <div dangerouslySetInnerHTML={{ __html: content }} />
    </div>
  );
}
