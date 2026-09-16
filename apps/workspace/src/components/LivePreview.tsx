import React from "react";

interface LivePreviewProps {
  htmlContent: string;
}

export const LivePreview: React.FC<
  LivePreviewProps
> = ({ htmlContent }) => {
  if (!htmlContent) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 bg-slate-950">
        بانتظار توليد الواجهة من الوكيل...
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-white overflow-hidden border border-slate-800">
      <iframe
        title="Celia Agent Live Preview"
        srcDoc={htmlContent}
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
        className="w-full h-full border-none"
      />
    </div>
  );
};
