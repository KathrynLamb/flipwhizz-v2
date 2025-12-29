import { useState } from "react";

// Frontend Button Component
export function ExportGelatoButton({ storyId }: { storyId: string }) {
    const [isExporting, setIsExporting] = useState(false);
    
    async function handleExport() {

    console.log('storyId', storyId)
    setIsExporting(true);
    try {
      const res = await fetch(`/api/stories/${storyId}/export-complete`, {
        method: "POST",
      });
    
      const data = await res.json();
    
      if (!res.ok) {
        alert(data.error || "Failed to export PDF");
        return;
      }
    
      // Download the PDF
      window.open(data.url, "_blank");
    } catch (err) {
      console.error("Export failed:", err);
      alert("Failed to export PDF");
    } finally {
      setIsExporting(false);
    }
    }
    
    return (
    <button
      onClick={handleExport}
      disabled={isExporting}
      className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
    >
      {isExporting ? "Exporting..." : "Download Gelato-Ready PDF"}
    </button>
    );
    }