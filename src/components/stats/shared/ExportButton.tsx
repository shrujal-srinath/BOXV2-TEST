// src/components/stats/shared/ExportButton.tsx
// Dropdown menu for exporting stats in various formats

import { useState } from 'react';

interface ExportButtonProps {
  onExportCSV: () => void;
  onExportJSON: () => void;
  onExportPDF: () => Promise<void>;
  disabled?: boolean;
  variant?: 'default' | 'compact';
}

export const ExportButton = ({
  onExportCSV,
  onExportJSON,
  onExportPDF,
  disabled = false,
  variant = 'default',
}: ExportButtonProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handlePDFExport = async () => {
    setIsLoading(true);
    try {
      await onExportPDF();
    } finally {
      setIsLoading(false);
      setIsOpen(false);
    }
  };

  const handleCSVExport = () => {
    onExportCSV();
    setIsOpen(false);
  };

  const handleJSONExport = () => {
    onExportJSON();
    setIsOpen(false);
  };

  if (variant === 'compact') {
    return (
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          disabled={disabled}
          className="px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-colors"
        >
          Export
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-2 w-40 bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg z-10">
            <button
              onClick={handleCSVExport}
              className="w-full text-left px-4 py-2 text-xs text-zinc-200 hover:bg-zinc-700 transition-colors"
            >
              📊 Export as CSV
            </button>
            <button
              onClick={handleJSONExport}
              className="w-full text-left px-4 py-2 text-xs text-zinc-200 hover:bg-zinc-700 transition-colors"
            >
              { } Export as JSON
            </button>
            <button
              onClick={handlePDFExport}
              disabled={isLoading}
              className="w-full text-left px-4 py-2 text-xs text-zinc-200 hover:bg-zinc-700 disabled:opacity-50 transition-colors"
            >
              📄 Export as PDF {isLoading && '...'}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-bold rounded-lg transition-colors"
      >
        <span>📥 Export</span>
        <span className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-10">
          <button
            onClick={handleCSVExport}
            className="w-full text-left px-4 py-3 text-sm text-zinc-200 hover:bg-zinc-700 border-b border-zinc-700 transition-colors flex items-center gap-2"
          >
            <span>📊</span>
            <div>
              <div className="font-semibold">Export as CSV</div>
              <div className="text-xs text-zinc-400">For Excel/Sheets</div>
            </div>
          </button>
          <button
            onClick={handleJSONExport}
            className="w-full text-left px-4 py-3 text-sm text-zinc-200 hover:bg-zinc-700 border-b border-zinc-700 transition-colors flex items-center gap-2"
          >
            <span>{ }</span>
            <div>
              <div className="font-semibold">Export as JSON</div>
              <div className="text-xs text-zinc-400">Full data object</div>
            </div>
          </button>
          <button
            onClick={handlePDFExport}
            disabled={isLoading}
            className="w-full text-left px-4 py-3 text-sm text-zinc-200 hover:bg-zinc-700 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            <span>📄</span>
            <div>
              <div className="font-semibold">Export as PDF</div>
              <div className="text-xs text-zinc-400">
                {isLoading ? 'Generating...' : 'Printable report'}
              </div>
            </div>
          </button>
        </div>
      )}

      {/* Backdrop to close menu */}
      {isOpen && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};
