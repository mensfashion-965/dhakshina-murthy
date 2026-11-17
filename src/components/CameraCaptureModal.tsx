import { useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, Upload, X } from 'lucide-react';

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (dataUrl: string) => void;
  onFallbackGallery: () => void;
}

export function CameraCaptureModal({
  isOpen,
  onClose,
  onCapture,
  onFallbackGallery,
}: CameraCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let cancelled = false;
    setError(null);
    setIsReady(false);

    async function startCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Live camera preview is unavailable in this browser. Please upload a bill photo from your gallery.');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setIsReady(true);
        }
      } catch (err) {
        if (!cancelled) {
          const msg =
            err instanceof Error && err.name === 'NotAllowedError'
              ? 'Camera permission was denied. Allow camera access or upload a photo from your gallery.'
              : 'Could not access the camera on this device. You can upload a receipt from your gallery instead.';
          setError(msg);
        }
      }
    }

    void startCamera();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [isOpen, facingMode]);

  if (!isOpen) {
    return null;
  }

  function handleSnap() {
    const video = videoRef.current;
    if (!video || !isReady) return;

    const canvas = document.createElement('canvas');
    const vw = video.videoWidth || 1280;
    const vh = video.videoHeight || 720;
    const maxDim = 1600;
    const scale = Math.min(1, maxDim / Math.max(vw, vh));
    canvas.width = Math.round(vw * scale);
    canvas.height = Math.round(vh * scale);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    onCapture(dataUrl);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#180B2E]/75 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="camera-modal-title"
    >
      <div className="w-full max-w-xl overflow-hidden rounded-xl border border-[#D8CEF0] bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#EDE8F8] px-5 py-4">
          <div>
            <h2 id="camera-modal-title" className="text-base font-semibold text-[#1E1035]">
              Capture Bill Photo
            </h2>
            <p className="text-xs text-[#5B526E]">
              Hold the receipt flat and well-lit so shop name, date, and total are sharp.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-[#5B526E] transition-colors hover:bg-[#F5F2FC] hover:text-[#1E1035] focus-visible:outline-2 focus-visible:outline-[#5B21B6]"
            aria-label="Close camera"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="bg-[#140928] p-4">
          {error ? (
            <div className="flex min-h-[280px] flex-col items-center justify-center gap-4 rounded-lg border border-[#3E2470] bg-[#1E1035] p-6 text-center">
              <Camera className="h-10 w-10 text-[#FACC15]" />
              <p className="max-w-sm text-sm text-[#EDE8F8]">{error}</p>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onFallbackGallery();
                }}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-[#FACC15] px-4 py-2 text-sm font-semibold text-[#22103F] transition-colors hover:bg-[#EAB308] whitespace-nowrap shrink-0"
              >
                <Upload className="h-4 w-4" />
                Choose from Gallery
              </button>
            </div>
          ) : (
            <div className="relative overflow-hidden rounded-lg bg-black">
              <video
                ref={videoRef}
                playsInline
                muted
                className="aspect-4/3 w-full object-cover"
              />
              {!isReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#180B2E]/80 text-sm text-[#EDE8F8]">
                  Starting camera...
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EDE8F8] px-5 py-4">
          <button
            type="button"
            onClick={() => setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-[#D8CEF0] px-4 py-2 text-sm font-medium text-[#3B2863] transition-colors hover:bg-[#F5F2FC] whitespace-nowrap shrink-0"
          >
            <RefreshCw className="h-4 w-4" />
            Switch Camera
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-[40px] items-center rounded-lg px-4 py-2 text-sm font-medium text-[#5B526E] transition-colors hover:bg-[#F5F2FC] hover:text-[#1E1035] whitespace-nowrap shrink-0"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSnap}
              disabled={!isReady || Boolean(error)}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-[#5B21B6] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#4C1D95] disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <Camera className="h-4 w-4 text-[#FACC15]" />
              Capture & Scan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
