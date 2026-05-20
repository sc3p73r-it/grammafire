import React, { useRef, useState } from "react";
import mammoth from "mammoth";
import { FileUp, FileDown, Copy, Check, Info } from "lucide-react";

interface ImportExportProps {
  onTextImported: (text: string, title: string) => void;
  correctedTextToExport: string;
  originalText: string;
  documentTitle: string;
}

export default function ImportExport({
  onTextImported,
  correctedTextToExport,
  originalText,
  documentTitle,
}: ImportExportProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const [parsingError, setParsingError] = useState<string | null>(null);

  // Read TXT or DOCX files
  const handleFile = async (file: File) => {
    setParsingError(null);
    const fileName = file.name;
    const extension = fileName.substring(fileName.lastIndexOf(".")).toLowerCase();
    const docTitle = fileName.replace(/\.[^/.]+$/, ""); // strip extension

    try {
      if (extension === ".txt") {
        const text = await file.text();
        onTextImported(text, docTitle);
      } else if (extension === ".docx") {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        if (result.value) {
          onTextImported(result.value, docTitle);
        } else {
          setParsingError("Word document content is empty or unparsable.");
        }
      } else {
        setParsingError("Unsupported file format. Please upload .txt or .docx sheets.");
      }
    } catch (e: any) {
      console.error(e);
      setParsingError(`Parsing error: ${e.message || "Failed to extract text from file."}`);
    }
  };

  // Drag and drop events
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleFile(e.dataTransfer.files[0]);
    }
  };

  const onFileSelectChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await handleFile(e.target.files[0]);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // Export functions
  const handleExportTxt = () => {
    const blob = new Blob([correctedTextToExport], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${documentTitle || "corrected-document"}_corrected.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportDocxReport = () => {
    // Generate simple Word-compatible HTML file that opens perfectly in MS Word
    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <title>GrammaFire Correction Report</title>
        <style>
          body { font-family: 'Arial', sans-serif; line-height: 1.6; padding: 20px; }
          h1 { color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; }
          .section { margin-bottom: 30px; }
          .original { background-color: #fef2f2; border-left: 4px solid #f87171; padding: 10px; margin: 10px 0; font-style: italic; color: #7f1d1d; }
          .corrected { background-color: #f0fdf4; border-left: 4px solid #4ade80; padding: 10px; margin: 10px 0; font-weight: bold; color: #14532d; }
          .footer { font-size: 12px; color: #94a3b8; margin-top: 50px; text-align: center; }
        </style>
      </head>
      <body>
        <h1>GrammaFire Corrected Document Report</h1>
        <p><strong>Document:</strong> ${documentTitle || "Untitled Draft"}</p>
        <p><strong>Date Corrected:</strong> ${new Date().toLocaleDateString()}</p>
        
        <div class="section">
          <h2>Corrected Output:</h2>
          <div class="corrected">${correctedTextToExport.replace(/\n/g, "<br>")}</div>
        </div>
        
        <div class="section">
          <h2>Original Input Comparison:</h2>
          <div class="original">${originalText.replace(/\n/g, "<br>")}</div>
        </div>
        
        <div class="footer">
          Generated automatically by GrammaFire Myanmar-English Grammar Engine
        </div>
      </body>
      </html>
    `;
    
    const blob = new Blob([htmlContent], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${documentTitle || "corrected-document"}_report.doc`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(correctedTextToExport);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy", err);
    }
  };

  return (
    <div id="import-export-section" className="bg-white border border-gray-100 rounded-xl p-4 shadow-xs space-y-4">
      {/* Document Import Area */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Import Document</h3>
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={triggerFileInput}
          className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-all duration-200 ${
            isDragging
              ? "border-emerald-500 bg-emerald-50/20 scale-[0.99]"
              : "border-gray-200 hover:border-gray-300 hover:bg-gray-50/50"
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={onFileSelectChange}
            accept=".txt,.docx"
            className="hidden"
          />
          <FileUp size={24} className="mx-auto text-gray-400 mb-2" />
          <p className="text-sm font-medium text-gray-700">Drag & drop or Click to upload</p>
          <p className="text-xs text-gray-400 mt-1">Supports Microsoft Word (.docx) or Text (.txt)</p>
        </div>
        {parsingError && (
          <div className="mt-2 text-xs bg-red-50 text-red-600 rounded-md p-2 flex items-start gap-1">
            <Info size={14} className="shrink-0 mt-0.5" />
            <span>{parsingError}</span>
          </div>
        )}
      </div>

      {/* Document Export Area */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Export & Save</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button
            onClick={handleCopyToClipboard}
            disabled={!correctedTextToExport}
            className="flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium rounded-lg border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={13} />}
            {copied ? "Copied!" : "Copy Output"}
          </button>

          <button
            onClick={handleExportTxt}
            disabled={!correctedTextToExport}
            className="flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium rounded-lg border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <FileDown size={14} />
            Export Raw TXT
          </button>

          <button
            onClick={handleExportDocxReport}
            disabled={!correctedTextToExport}
            className="flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium rounded-lg bg-slate-900 hover:bg-slate-800 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <FileDown size={14} />
            Export Word DOC
          </button>
        </div>
      </div>
    </div>
  );
}
