export function Stub({ title }: { title: string }) {
  return (
    <div className="max-w-[600px] mx-auto px-6 flex flex-col items-center text-center gap-2 mt-16">
      <h2 className="font-heading text-text-primary text-2xl font-bold">{title}</h2>
      <p className="text-text-secondary text-sm">Coming soon — depends on work in progress on another branch.</p>
    </div>
  );
}
