export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="spinner w-12 h-12 mx-auto mb-4"></div>
        <p className="text-[color:var(--text-secondary)]">Cargando...</p>
      </div>
    </div>
  );
}

