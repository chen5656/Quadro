import { useEffect, useState } from 'react';
import {
  FacebookIcon,
  FacebookShareButton,
  RedditIcon,
  RedditShareButton,
  TelegramIcon,
  TelegramShareButton,
  WhatsappIcon,
  WhatsappShareButton,
  XIcon,
  TwitterShareButton,
} from 'react-share';


export interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  url: string;
  text: string;
  title?: string;
}

export function ShareModal({
  isOpen,
  onClose,
  url,
  text,
  title = `Share with friends`,
}: ShareModalProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setCopied(false);
      return;
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    if (!navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-neutral-700/80 bg-neutral-900/95 p-5 sm:p-6 shadow-2xl text-neutral-100 backdrop-blur-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <span>📢</span>
            <span>{title}</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-white transition"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 stroke-current fill-none" strokeWidth="2">
              <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Social Buttons Row */}
        <div className="py-5">
          <p className="text-xs font-medium text-neutral-400 mb-3 text-center sm:text-left">
            Choose a platform to share:
          </p>
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 sm:gap-4">
            <TwitterShareButton
              url={url}
              title={text}
              className="flex flex-col items-center gap-1.5 transition-transform hover:scale-105 active:scale-95"
            >
              <XIcon size={44} round />
              <span className="text-[11px] font-medium text-neutral-300">X</span>
            </TwitterShareButton>

            <FacebookShareButton
              url={url}
              className="flex flex-col items-center gap-1.5 transition-transform hover:scale-105 active:scale-95"
            >
              <FacebookIcon size={44} round />
              <span className="text-[11px] font-medium text-neutral-300">Facebook</span>
            </FacebookShareButton>

            <RedditShareButton
              url={url}
              title={text}
              className="flex flex-col items-center gap-1.5 transition-transform hover:scale-105 active:scale-95"
            >
              <RedditIcon size={44} round />
              <span className="text-[11px] font-medium text-neutral-300">Reddit</span>
            </RedditShareButton>

            <WhatsappShareButton
              url={url}
              title={text}
              separator=" "
              className="flex flex-col items-center gap-1.5 transition-transform hover:scale-105 active:scale-95"
            >
              <WhatsappIcon size={44} round />
              <span className="text-[11px] font-medium text-neutral-300">WhatsApp</span>
            </WhatsappShareButton>

            <TelegramShareButton
              url={url}
              title={text}
              className="flex flex-col items-center gap-1.5 transition-transform hover:scale-105 active:scale-95"
            >
              <TelegramIcon size={44} round />
              <span className="text-[11px] font-medium text-neutral-300">Telegram</span>
            </TelegramShareButton>
          </div>
        </div>

        {/* Content Preview & Copy Button */}
        <div className="space-y-2.5 pt-2 border-t border-neutral-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-400">Battle Recap Preview</span>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 rounded-md border border-neutral-700 bg-neutral-800 px-2.5 py-1 text-xs font-medium text-neutral-200 transition hover:bg-neutral-700 hover:text-white"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 stroke-current fill-none" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>{copied ? 'Copied!' : 'Copy Text'}</span>
            </button>
          </div>

          <div className="max-h-48 overflow-y-auto rounded-xl border border-neutral-800 bg-neutral-950/70 p-3 font-mono text-xs text-neutral-300 whitespace-pre-wrap select-all leading-relaxed">
            {text}
            {'\n'}
            <span className="text-sky-400 break-all">{url}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
