import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  X,
  ZoomIn,
  ZoomOut,
  Image as ImageIcon,
} from 'lucide-react';

interface ImageCarouselProps {
  images?: string[];
  alt?: string;
  height?: string | number;
  rounded?: string;
  showLightboxOnClick?: boolean;
}

export const ImageCarousel: React.FC<ImageCarouselProps> = ({
  images = [],
  alt = 'Milestone proof photo',
  height = '180px',
  rounded = '12px',
  showLightboxOnClick = true,
}) => {
  const validImages = images.filter((img) => typeof img === 'string' && img.trim().length > 0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxZoom, setLightboxZoom] = useState(1);

  if (validImages.length === 0) {
    return (
      <div
        style={{
          width: '100%',
          height,
          borderRadius: rounded,
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.4rem',
          color: 'var(--text-muted)',
        }}
      >
        <ImageIcon size={24} style={{ opacity: 0.4 }} />
        <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>No photos submitted</span>
      </div>
    );
  }

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === 0 ? validImages.length - 1 : prev - 1));
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === validImages.length - 1 ? 0 : prev + 1));
  };

  const handleOpenLightbox = () => {
    if (showLightboxOnClick) {
      setLightboxOpen(true);
      setLightboxZoom(1);
    }
  };

  return (
    <>
      <div
        style={{
          position: 'relative',
          width: '100%',
          height,
          borderRadius: rounded,
          overflow: 'hidden',
          background: '#070a12',
          border: '1px solid var(--border-primary)',
          cursor: showLightboxOnClick ? 'pointer' : 'default',
          userSelect: 'none',
        }}
        onClick={handleOpenLightbox}
      >
        <img
          src={validImages[currentIndex]}
          alt={`${alt} (${currentIndex + 1}/${validImages.length})`}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />

        {validImages.length > 1 && (
          <>
            <button
              type="button"
              onClick={handlePrev}
              style={{
                position: 'absolute',
                left: '6px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'rgba(0, 0, 0, 0.65)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '50%',
                width: 28,
                height: 28,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
              aria-label="Previous image"
            >
              <ChevronLeft size={16} />
            </button>

            <button
              type="button"
              onClick={handleNext}
              style={{
                position: 'absolute',
                right: '6px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'rgba(0, 0, 0, 0.65)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '50%',
                width: 28,
                height: 28,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
              aria-label="Next image"
            >
              <ChevronRight size={16} />
            </button>

            <div
              style={{
                position: 'absolute',
                bottom: '6px',
                right: '8px',
                background: 'rgba(0, 0, 0, 0.75)',
                color: '#ffffff',
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '0.15rem 0.45rem',
                borderRadius: '6px',
              }}
            >
              {currentIndex + 1} / {validImages.length}
            </div>
          </>
        )}
      </div>

      {lightboxOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(3, 7, 18, 0.94)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            flexDirection: 'column',
          }}
          onClick={() => setLightboxOpen(false)}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '0.75rem 1.5rem',
              background: 'rgba(15, 23, 42, 0.85)',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#ffffff',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>
              {alt} ({currentIndex + 1} of {validImages.length})
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={() => setLightboxZoom((prev) => Math.min(prev + 0.3, 3))}
              >
                <ZoomIn size={14} /> Zoom In
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={() => setLightboxZoom((prev) => Math.max(prev - 0.3, 0.6))}
              >
                <ZoomOut size={14} /> Zoom Out
              </button>
              <button
                type="button"
                className="btn btn-sm btn-danger"
                onClick={() => setLightboxOpen(false)}
              >
                <X size={15} /> Close
              </button>
            </div>
          </div>

          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1.5rem',
              overflow: 'hidden',
            }}
          >
            <img
              src={validImages[currentIndex]}
              alt={alt}
              style={{
                transform: `scale(${lightboxZoom})`,
                transition: 'transform 0.15s ease',
                maxWidth: '90vw',
                maxHeight: '80vh',
                objectFit: 'contain',
                borderRadius: 8,
              }}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </>
  );
};
