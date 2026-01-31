export default function OrderStatusBadge({ status }) {
  const styles = {
    awaiting: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    partial: 'bg-blue-100 text-blue-800 border-blue-200',
    complete: 'bg-green-100 text-green-800 border-green-200',
    extra_units: 'bg-purple-100 text-purple-800 border-purple-200',
    cancelled: 'bg-gray-100 text-gray-500 border-gray-200'
  };

  const labels = {
    awaiting: 'Awaiting',
    partial: 'Partial',
    complete: 'Complete',
    extra_units: 'Extra Units',
    cancelled: 'Cancelled'
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[status] || styles.awaiting}`}>
      {labels[status] || status}
    </span>
  );
}
