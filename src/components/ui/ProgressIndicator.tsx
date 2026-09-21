/**
 * Question progress.
 *
 * The numbers come from the active branch, not a hard-coded total, so the bar
 * stays honest if a branch ever adds or skips a question.
 */
export function ProgressIndicator({
  current,
  total,
  percent,
  label,
}: {
  current: number;
  total: number;
  percent: number;
  label: string;
}) {
  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-between gap-3 text-[0.78rem] font-medium tracking-wide text-charcoal-500">
        <span className="uppercase tracking-[0.16em]">{label}</span>
        <span aria-hidden="true">
          {current} / {total}
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={current}
        aria-valuetext={`Question ${current} of ${total}`}
        className="h-1.5 w-full overflow-hidden rounded-full bg-paper-300"
      >
        <div
          className="h-full rounded-full bg-electric-500 transition-[width] duration-300 ease-out motion-reduce:transition-none"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
