import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import Layout from '../../../components/Layout'
import { Button, Alert, Card, Input, Select } from '../../../components/ui'
import { BundleConfigForm } from '../../../components/orders'
import { createClientOrder } from '../../../api'
import { useClientNavigation } from '../../../hooks/useClientNavigation'

const STEPS = [
  { id: 'product', title: 'Product Info', description: 'Identify the product' },
  { id: 'bundling', title: 'Bundling', description: 'Configure bundle quantities' },
  { id: 'cost', title: 'Cost & Details', description: 'Add cost and order info' },
  { id: 'review', title: 'Review', description: 'Confirm and submit' }
]

const MARKETPLACES = [
  { value: 'us', label: 'Amazon US' },
  { value: 'ca', label: 'Amazon CA' },
  { value: 'mx', label: 'Amazon MX' },
  { value: 'uk', label: 'Amazon UK' },
  { value: 'de', label: 'Amazon DE' },
  { value: 'fr', label: 'Amazon FR' },
  { value: 'it', label: 'Amazon IT' },
  { value: 'es', label: 'Amazon ES' }
]

export default function WarehouseOrderNew() {
  const { clientCode } = useParams()
  const navigate = useNavigate()
  const { navItems, isStaffViewing } = useClientNavigation()

  const [currentStep, setCurrentStep] = useState(0)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    // Product info
    marketplace: 'us',
    sku: '',
    asin: '',
    fnsku: '',
    upc: '',
    product_title: '',
    // Bundling
    purchase_bundle_count: 1,
    selling_bundle_count: 1,
    purchase_order_quantity: 0,
    expected_single_units: 0,
    expected_sellable_units: 0,
    // Cost & details
    total_cost: '',
    unit_cost: '',
    vendor: '',
    purchase_order_no: '',
    notes: ''
  })

  const updateFormData = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setError(null)
  }

  const handleBundleChange = (bundleData) => {
    setFormData(prev => ({
      ...prev,
      ...bundleData
    }))
  }

  const validateStep = (stepIndex) => {
    switch (stepIndex) {
      case 0: // Product info
        if (!formData.product_title.trim()) {
          setError('Product title is required')
          return false
        }
        if (!formData.sku.trim() && !formData.asin.trim()) {
          setError('Please provide at least SKU or ASIN')
          return false
        }
        return true
      case 1: // Bundling
        if (formData.purchase_order_quantity <= 0) {
          setError('PO quantity must be greater than 0')
          return false
        }
        if (formData.purchase_bundle_count <= 0) {
          setError('Purchase bundle count must be at least 1')
          return false
        }
        if (formData.selling_bundle_count <= 0) {
          setError('Selling bundle count must be at least 1')
          return false
        }
        return true
      case 2: // Cost
        // All optional
        return true
      default:
        return true
    }
  }

  const nextStep = () => {
    if (!validateStep(currentStep)) return
    setCurrentStep(prev => Math.min(prev + 1, STEPS.length - 1))
  }

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0))
    setError(null)
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const payload = {
        marketplace: formData.marketplace,
        sku: formData.sku || null,
        asin: formData.asin || null,
        fnsku: formData.fnsku || null,
        upc: formData.upc || null,
        product_title: formData.product_title,
        purchase_bundle_count: formData.purchase_bundle_count,
        selling_bundle_count: formData.selling_bundle_count,
        purchase_order_quantity: formData.purchase_order_quantity,
        expected_single_units: formData.expected_single_units,
        expected_sellable_units: formData.expected_sellable_units,
        total_cost: formData.total_cost ? parseFloat(formData.total_cost) : null,
        unit_cost: formData.unit_cost ? parseFloat(formData.unit_cost) : null,
        vendor: formData.vendor || null,
        purchase_order_no: formData.purchase_order_no || null,
        notes: formData.notes || null
      }

      const result = await createClientOrder(clientCode, payload)
      navigate(`/client/${clientCode}/orders/${result.id}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const formatCurrency = (value) => {
    if (!value) return '-'
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value)
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // Product Info
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Marketplace *
              </label>
              <Select
                value={formData.marketplace}
                onChange={(e) => updateFormData('marketplace', e.target.value)}
                options={MARKETPLACES}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Product Title *
              </label>
              <Input
                value={formData.product_title}
                onChange={(e) => updateFormData('product_title', e.target.value)}
                placeholder="Enter product title"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SKU
                </label>
                <Input
                  value={formData.sku}
                  onChange={(e) => updateFormData('sku', e.target.value)}
                  placeholder="Enter SKU"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ASIN
                </label>
                <Input
                  value={formData.asin}
                  onChange={(e) => updateFormData('asin', e.target.value)}
                  placeholder="Enter ASIN"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  FNSKU
                </label>
                <Input
                  value={formData.fnsku}
                  onChange={(e) => updateFormData('fnsku', e.target.value)}
                  placeholder="Enter FNSKU"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  UPC
                </label>
                <Input
                  value={formData.upc}
                  onChange={(e) => updateFormData('upc', e.target.value)}
                  placeholder="Enter UPC"
                />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              * At least SKU or ASIN is required
            </p>
          </div>
        )

      case 1: // Bundling
        return (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 mb-4">
              Configure how products are bundled for purchase and selling. This helps calculate expected units.
            </p>
            <BundleConfigForm
              purchaseBundleCount={formData.purchase_bundle_count}
              sellingBundleCount={formData.selling_bundle_count}
              quantity={formData.purchase_order_quantity}
              onChange={handleBundleChange}
            />
          </div>
        )

      case 2: // Cost & Details
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total Cost
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.total_cost}
                    onChange={(e) => updateFormData('total_cost', e.target.value)}
                    placeholder="0.00"
                    className="pl-7"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Unit Cost
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.unit_cost}
                    onChange={(e) => updateFormData('unit_cost', e.target.value)}
                    placeholder="0.00"
                    className="pl-7"
                  />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vendor
                </label>
                <Input
                  value={formData.vendor}
                  onChange={(e) => updateFormData('vendor', e.target.value)}
                  placeholder="Vendor name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Purchase Order #
                </label>
                <Input
                  value={formData.purchase_order_no}
                  onChange={(e) => updateFormData('purchase_order_no', e.target.value)}
                  placeholder="PO number"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => updateFormData('notes', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Add any additional notes..."
              />
            </div>
          </div>
        )

      case 3: // Review
        return (
          <div className="space-y-6">
            {/* Product Summary */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Product Information</h4>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Title</span>
                  <span className="text-sm font-medium text-gray-900">{formData.product_title}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Marketplace</span>
                  <span className="text-sm text-gray-900 uppercase">{formData.marketplace}</span>
                </div>
                {formData.sku && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">SKU</span>
                    <span className="text-sm font-mono text-gray-900">{formData.sku}</span>
                  </div>
                )}
                {formData.asin && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">ASIN</span>
                    <span className="text-sm font-mono text-gray-900">{formData.asin}</span>
                  </div>
                )}
                {formData.fnsku && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">FNSKU</span>
                    <span className="text-sm font-mono text-gray-900">{formData.fnsku}</span>
                  </div>
                )}
                {formData.upc && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">UPC</span>
                    <span className="text-sm font-mono text-gray-900">{formData.upc}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Bundling Summary */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Bundle Configuration</h4>
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4 text-center mb-4">
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{formData.expected_single_units}</div>
                    <div className="text-sm text-gray-500">Expected Single Units</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-blue-600">{formData.expected_sellable_units}</div>
                    <div className="text-sm text-gray-500">Expected Sellable Units</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs text-gray-500">
                  <div>{formData.purchase_bundle_count} units/purchase pack</div>
                  <div>{formData.purchase_order_quantity} packs ordered</div>
                  <div>{formData.selling_bundle_count} units/selling pack</div>
                </div>
              </div>
            </div>

            {/* Cost Summary */}
            {(formData.total_cost || formData.unit_cost || formData.vendor || formData.purchase_order_no) && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Cost & Order Details</h4>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  {formData.total_cost && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Total Cost</span>
                      <span className="text-sm font-medium text-gray-900">{formatCurrency(formData.total_cost)}</span>
                    </div>
                  )}
                  {formData.unit_cost && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Unit Cost</span>
                      <span className="text-sm font-medium text-gray-900">{formatCurrency(formData.unit_cost)}</span>
                    </div>
                  )}
                  {formData.vendor && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Vendor</span>
                      <span className="text-sm text-gray-900">{formData.vendor}</span>
                    </div>
                  )}
                  {formData.purchase_order_no && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">PO #</span>
                      <span className="text-sm text-gray-900">{formData.purchase_order_no}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Notes */}
            {formData.notes && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Notes</h4>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-700">{formData.notes}</p>
                </div>
              </div>
            )}
          </div>
        )

      default:
        return null
    }
  }

  return (
    <Layout
      title="New Warehouse Order"
      navItems={navItems}
      managerViewingClient={isStaffViewing ? clientCode : null}
    >
      {/* Step Indicator */}
      <nav aria-label="Progress" className="mb-8">
        <ol className="flex items-center">
          {STEPS.map((step, index) => (
            <li key={step.id} className={`flex-1 ${index !== STEPS.length - 1 ? 'pr-4' : ''}`}>
              <div className="flex items-center">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                    index < currentStep
                      ? 'bg-blue-600 text-white'
                      : index === currentStep
                      ? 'border-2 border-blue-600 text-blue-600'
                      : 'border-2 border-gray-300 text-gray-500'
                  }`}
                >
                  {index < currentStep ? (
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </span>
                {index !== STEPS.length - 1 && (
                  <div className={`ml-4 flex-1 h-0.5 ${index < currentStep ? 'bg-blue-600' : 'bg-gray-200'}`} />
                )}
              </div>
              <div className="mt-2">
                <span className={`text-xs font-medium ${index <= currentStep ? 'text-blue-600' : 'text-gray-500'}`}>
                  {step.title}
                </span>
              </div>
            </li>
          ))}
        </ol>
      </nav>

      {error && <Alert variant="error" className="mb-6">{error}</Alert>}

      {/* Form Card */}
      <Card
        title={STEPS[currentStep].title}
        description={STEPS[currentStep].description}
      >
        {renderStepContent()}

        {/* Navigation Buttons */}
        <div className="flex justify-between items-center mt-8 pt-6 border-t">
          <div>
            {currentStep === 0 ? (
              <Link to={`/client/${clientCode}/orders`}>
                <Button variant="ghost">Cancel</Button>
              </Link>
            ) : (
              <Button variant="ghost" onClick={prevStep}>
                Back
              </Button>
            )}
          </div>
          <div>
            {currentStep < STEPS.length - 1 ? (
              <Button onClick={nextStep}>
                Continue
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Creating Order...' : 'Create Order'}
              </Button>
            )}
          </div>
        </div>
      </Card>
    </Layout>
  )
}
