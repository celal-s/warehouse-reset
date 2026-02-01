import { useState, useEffect } from 'react';
import { getReceivingPhotos } from '../../api';

function PhotoThumbnails({ receivingId }) {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  useEffect(() => {
    const loadPhotos = async () => {
      try {
        const data = await getReceivingPhotos(receivingId);
        setPhotos(data.photos || []);
      } catch (err) {
        console.error('Failed to load photos:', err);
      } finally {
        setLoading(false);
      }
    };
    loadPhotos();
  }, [receivingId]);

  if (loading) {
    return <span className="text-xs text-gray-400">...</span>;
  }

  if (photos.length === 0) {
    return <span className="text-xs text-gray-400">-</span>;
  }

  const openPhoto = (photo) => {
    setSelectedPhoto(photo);
    setShowModal(true);
  };

  return (
    <>
      <div className="flex gap-1">
        {photos.slice(0, 3).map((photo, index) => (
          <button
            key={photo.id || index}
            onClick={() => openPhoto(photo)}
            className="w-8 h-8 rounded overflow-hidden border border-gray-200 hover:border-blue-500 transition-colors"
          >
            <img
              src={photo.photo_url}
              alt={`Photo ${index + 1}`}
              className="w-full h-full object-cover"
            />
          </button>
        ))}
        {photos.length > 3 && (
          <span className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center text-xs text-gray-500">
            +{photos.length - 3}
          </span>
        )}
      </div>

      {/* Photo Modal */}
      {showModal && selectedPhoto && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"
          onClick={() => setShowModal(false)}
        >
          <div className="max-w-4xl max-h-[90vh] p-4" onClick={e => e.stopPropagation()}>
            <img
              src={selectedPhoto.photo_url}
              alt="Receiving photo"
              className="max-w-full max-h-[80vh] object-contain rounded-lg"
            />
            <div className="mt-2 flex justify-between items-center text-white text-sm">
              <span>{photos.indexOf(selectedPhoto) + 1} of {photos.length}</span>
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-1 bg-white/20 rounded hover:bg-white/30 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

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
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Photos</th>
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
              <td className="px-4 py-3 whitespace-nowrap">
                <PhotoThumbnails receivingId={entry.receiving_id} />
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
