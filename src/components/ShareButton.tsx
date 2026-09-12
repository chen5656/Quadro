import { useState } from 'react';

import { ShareModal } from './ShareModal';


export function ShareButton({
  url,
  text,
  label = 'Share',
  title = 'Share this game',
  className = 'inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-neutral-700 bg-neutral-900/80 px-3 py-1.5 text-xs font-medium text-neutral-200 transition hover:bg-neutral-800 hover:text-white',
}: {
  url: string;
  /** The recap line pasted next to the link. */
  text: string;
  label?: string;
  title?: string;
  className?: string;
}) {
  const [modalOpen, setModalOpen] = useState(false);

  const onClick = () => {
    setModalOpen(true);
  };


  return (
    <>
      <button type="button" onClick={() => void onClick()} title={title} className={className}>
        <svg
          viewBox="0 0 24 24"
          className="h-3.5 w-3.5 stroke-current"
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
        <span>{label}</span>
      </button>

      <ShareModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        url={url}
        text={text}
        title={title}
      />
    </>
  );
}

