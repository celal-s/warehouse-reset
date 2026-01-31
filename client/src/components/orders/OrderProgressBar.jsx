export default function OrderProgressBar({ received, expected, damaged = 0 }) {
  const total = received + damaged;
  const goodPercent = expected > 0 ? Math.min((received / expected) * 100, 100) : 0;
  const damagedPercent = expected > 0 ? Math.min((damaged / expected) * 100, 100 - goodPercent) : 0;
  const isOver = total > expected;

  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-gray-600 mb-1">
        <span>{received} good{damaged > 0 ? `, ${damaged} damaged` : ''}</span>
        <span>of {expected} expected</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
        <div className="h-full flex">
          <div
            className={`${isOver ? 'bg-purple-500' : 'bg-green-500'} transition-all`}
            style={{ width: `${goodPercent}%` }}
          />
          {damaged > 0 && (
            <div
              className="bg-red-400 transition-all"
              style={{ width: `${damagedPercent}%` }}
            />
          )}
        </div>
      </div>
      {isOver && (
        <div className="text-xs text-purple-600 mt-1">
          +{total - expected} extra units received
        </div>
      )}
    </div>
  );
}
