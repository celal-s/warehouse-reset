export default function ReceivingHistoryTable({ entries }) {
  if (!entries || entries.length === 0) {
    return (
      <div className="text-center py-6 text-gray-500">
        No receiving history yet
      </div>
    );
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Good</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Damaged</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sellable</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Receiver</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {entries.map((entry) => (
            <tr key={entry.id || entry.receiving_id}>
              <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-gray-600">
                {entry.receiving_id}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                {formatDate(entry.receiving_date)}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-green-600 font-medium">
                {entry.received_good_units}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-red-600">
                {entry.received_damaged_units || 0}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                {entry.sellable_units}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                {entry.receiver_name || '-'}
              </td>
              <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">
                {entry.notes || '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
