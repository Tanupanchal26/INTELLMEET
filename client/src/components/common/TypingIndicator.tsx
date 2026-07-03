interface Props {
  names: string[];
}

export const TypingIndicator = ({ names }: Props) => {
  if (!names.length) return null;
  const label =
    names.length === 1
      ? `${names[0]} is typing…`
      : names.length === 2
      ? `${names[0]} and ${names[1]} are typing…`
      : 'Several people are typing…';

  return (
    <div className="px-6 py-1.5 text-[11px] text-[var(--color-text-muted)] italic flex items-center gap-1.5">
      <span className="flex gap-0.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1 h-1 rounded-full bg-[var(--color-text-dim)] animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </span>
      {label}
    </div>
  );
};
