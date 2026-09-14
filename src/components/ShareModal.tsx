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
            <button
              type="button"
              onClick={() => {
                // Discord doesn't support a universal pre-filled message URL scheme across web/desktop apps,
                // so copying recap text to clipboard and opening Discord provides the smoothest flow.
                handleCopy();
                window.open('https://discord.com/channels/@me', '_blank', 'noopener,noreferrer');
              }}
              className="flex flex-col items-center gap-1.5 transition-transform hover:scale-105 active:scale-95 group focus:outline-none"
              title="Copy recap and open Discord"
            >
              <div className="flex h-[44px] w-[44px] items-center justify-center rounded-full bg-[#5865F2] shadow-sm transition-opacity group-hover:opacity-90">
                <svg viewBox="0 0 24 24" className="h-6 w-6 fill-white" aria-hidden="true">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.893.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                </svg>
              </div>
              <span className="text-[11px] font-medium text-neutral-300">Discord</span>
            </button>
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
