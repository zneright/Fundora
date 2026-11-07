import React, { useEffect, useState } from 'react';
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCw,
  RotateCcw,
  Maximize2,
  Minimize2,
  FileText,
} from 'lucide-react';

interface KycDocumentLightboxProps {
  isOpen: boolean;
  imageUrl: string;
  documentTitle: string;
  residentName?: string;
  onClose: () => void;
}

export const KycDocumentLightbox: React.FC<KycDocumentLightboxProps> = ({
  isOpen,
  imageUrl,
  documentTitle,
  residentName,
  onClose,
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Reset transforms when image opens or changes
  useEffect(() => {
    if (isOpen) {
      setZoomLevel(1);
      setRotation(0);
      setIsFullscreen(false);
    }
  }, [isOpen, imageUrl]);

  if (!isOpen) return null;

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.25, 3.5));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.25, 0.5));
  const handleRotateCw = () => setRotation((prev) => (prev + 90) % 360);
  const handleRotateCcw = () => setRotation((prev) => (prev - 90 + 360) % 360);
  const handleReset = () => {
    setZoomLevel(1);
    setRotation(0);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="KYC Document Inspection Lightbox"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(3, 7, 18, 0.94)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Top Controls Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.85rem 1.5rem',
          background: 'rgba(15, 23, 42, 0.85)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
          color: '#ffffff',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <FileText size={18} style={{ color: 'var(--accent-green)' }} />
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{documentTitle}</div>
            {residentName && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Resident: <strong>{residentName}</strong>
              </div>
            )}
          </div>
        </div>

        {/* Action Toolbars */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-sm btn-outline"
            onClick={handleZoomIn}
            title="Zoom In"
            aria-label="Zoom in"
          >
            <ZoomIn size={15} /> <span>Zoom In</span>
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline"
            onClick={handleZoomOut}
            title="Zoom Out"
            aria-label="Zoom out"
          >
            <ZoomOut size={15} /> <span>Zoom Out</span>
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline"
            onClick={handleRotateCw}
            title="Rotate Clockwise (90°)"
            aria-label="Rotate clockwise"
          >
            <RotateCw size={15} /> <span>Rotate</span>
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline"
            onClick={handleReset}
            title="Reset Zoom & Rotation"
          >
            <span>Reset ({Math.round(zoomLevel * 100)}%)</span>
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title="Toggle View Mode"
          >
            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-danger"
            onClick={onClose}
            aria-label="Close lightbox"
            style={{ marginLeft: '0.5rem' }}
          >
            <X size={16} /> Close
          </button>
        </div>
      </div>

      {/* Main Viewport */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          padding: isFullscreen ? 0 : '1.5rem',
          position: 'relative',
          cursor: zoomLevel > 1 ? 'grab' : 'default',
        }}
        onClick={(e) => {
          // If clicked on backdrop, close
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        <div
          style={{
            transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
            transition: 'transform 0.18s ease-out',
            maxWidth: isFullscreen ? '100%' : '90vw',
            maxHeight: isFullscreen ? '100%' : '80vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)',
            borderRadius: isFullscreen ? 0 : 12,
            overflow: 'hidden',
            background: '#0a0f1d',
          }}
        >
          <img
            src={imageUrl}
            alt={documentTitle}
            style={{
              maxWidth: '100%',
              maxHeight: '80vh',
              objectFit: 'contain',
              userSelect: 'none',
              pointerEvents: 'auto',
            }}
          />
        </div>
      </div>

      {/* Footer Info Strip */}
      <div
        style={{
          padding: '0.5rem 1.5rem',
          background: 'rgba(15, 23, 42, 0.9)',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>Press ESC to exit • Use rotate controls for sideways or upside-down mobile photos</span>
        <span>Inspection Vault Mode</span>
      </div>
    </div>
  );
};
