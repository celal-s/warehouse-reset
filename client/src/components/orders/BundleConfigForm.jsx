import { useState, useEffect } from 'react';

export default function BundleConfigForm({
  purchaseBundleCount = 1,
  sellingBundleCount = 1,
  quantity = 0,
  onChange
}) {
  const [values, setValues] = useState({
    purchase_bundle_count: purchaseBundleCount,
    selling_bundle_count: sellingBundleCount,
    purchase_order_quantity: quantity
  });

  useEffect(() => {
    setValues({
      purchase_bundle_count: purchaseBundleCount,
      selling_bundle_count: sellingBundleCount,
      purchase_order_quantity: quantity
    });
  }, [purchaseBundleCount, sellingBundleCount, quantity]);

  const handleChange = (field, value) => {
    const newValues = { ...values, [field]: parseInt(value) || 0 };
    setValues(newValues);

    // Calculate derived values
    const expectedSingleUnits = newValues.purchase_bundle_count * newValues.purchase_order_quantity;
    const expectedSellableUnits = Math.floor(expectedSingleUnits / newValues.selling_bundle_count);

    onChange?.({
      ...newValues,
      expected_single_units: expectedSingleUnits,
      expected_sellable_units: expectedSellableUnits
    });
  };

  const expectedSingleUnits = values.purchase_bundle_count * values.purchase_order_quantity;
  const expectedSellableUnits = Math.floor(expectedSingleUnits / values.selling_bundle_count);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Purchase Bundle Count
          </label>
          <input
            type="number"
            min="1"
            value={values.purchase_bundle_count}
            onChange={(e) => handleChange('purchase_bundle_count', e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">Units per purchase pack</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            PO Quantity
          </label>
          <input
            type="number"
            min="0"
            value={values.purchase_order_quantity}
            onChange={(e) => handleChange('purchase_order_quantity', e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">Packs ordered</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Selling Bundle Count
          </label>
          <input
            type="number"
            min="1"
            value={values.selling_bundle_count}
            onChange={(e) => handleChange('selling_bundle_count', e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">Units per selling pack</p>
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-4">
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-gray-900">{expectedSingleUnits}</div>
            <div className="text-sm text-gray-500">Expected Single Units</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-600">{expectedSellableUnits}</div>
            <div className="text-sm text-gray-500">Expected Sellable Units</div>
          </div>
        </div>
      </div>
    </div>
  );
}
