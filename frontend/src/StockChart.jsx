import React, { useEffect, useRef } from "react";

// TradingView widget embed for interactive chart
export default function StockChart({ symbol }) {
  const ref = useRef();

  useEffect(() => {
    if (!symbol || !ref.current) return;
    // Remove previous widget if any
    ref.current.innerHTML = "";
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/tv.js";
    script.async = true;
    script.onload = () => {
      // global TradingView object
      if (window.TradingView) {
        new window.TradingView.widget({
          autosize: true,
          symbol: symbol,
          interval: "D",
          timezone: "Etc/UTC",
          theme: "light",
          style: "1",
          locale: "en",
          toolbar_bg: "#f1f3f6",
          enable_publishing: false,
          hide_top_toolbar: false,
          hide_legend: false,
          container_id: ref.current.id,
        });
      }
    };
    document.body.appendChild(script);
    return () => {
      // Clean up
      if (ref.current) ref.current.innerHTML = "";
    };
  }, [symbol]);

  return (
    <div className="w-full h-96 mt-4 rounded-2xl overflow-hidden border border-slate-200 bg-white" ref={ref} id={`tv-chart-${symbol}`}></div>
  );
}
