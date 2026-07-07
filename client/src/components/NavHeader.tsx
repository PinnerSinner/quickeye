export interface NavHeaderProps {
  onHome: () => void;
}

export function NavHeader({ onHome }: NavHeaderProps) {
  return (
    <div className="nav-header">
      <button className="nav-logo" onClick={onHome} title="Return to home">
        Q
      </button>
    </div>
  );
}
