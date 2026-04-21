export default function Spinner({ size = 20 }: { size?: number }) {
  return (
    <span
      className="inline-block animate-spin rounded-full border-2 border-slate-600 border-t-violet-400"
      style={{ width: size, height: size }}
    />
  )
}
