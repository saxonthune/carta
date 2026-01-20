export default function Footer() {
  return (
    <div className="h-6 bg-surface-alt border-t flex items-center justify-between px-2 shrink-0">
      <span className="text-[11px] text-content-muted">Carta 0.1.0. © 2026 Saxon Thune</span>
      <div className="flex items-center gap-3">
        <a
          href="https://github.com/saxonthune/carta"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] text-content-muted hover:text-content transition-colors no-underline"
        >
          GitHub
        </a>
        <button className="text-[11px] text-content-muted hover:text-content transition-colors cursor-pointer border-none bg-transparent p-0">
          Help
        </button>
      </div>
    </div>
  );
}
