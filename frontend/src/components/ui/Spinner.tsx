interface SpinnerProps {
  size?: number;
  large?: boolean;
}

export function Spinner({ size, large = false }: SpinnerProps) {
  const style = size
    ? { width: size, height: size, borderWidth: Math.max(2, Math.round(size / 8)) }
    : undefined;
  return <div className={`spinner ${large ? 'spinner-lg' : ''}`.trim()} style={style} />;
}

/** Bloc de chargement centré (à utiliser pendant le fetch d'une page/section) */
export function LoadingBlock() {
  return (
    <div className="loading-block">
      <Spinner large />
    </div>
  );
}
