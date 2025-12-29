'use client';
import { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Loader2, Package } from 'lucide-react';

type OrderReadiness = {
  hasPdf: boolean;
  hasPayment: boolean;
  hasCovers: boolean;
  isReady: boolean;
  missingItems: string[];
};

type ShippingAddress = {
  firstName: string;
  lastName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state?: string;
  postCode: string;
  countryIsoCode: string;
  email: string;
  phone?: string;
};

// Minimal, safe starter list (add more as you like)
// You can later replace this with a Gelato-supported-countries endpoint.
const COUNTRY_OPTIONS: Array<{ code: string; name: string }> = [
  { code: 'GB', name: 'United Kingdom' },
  { code: 'IE', name: 'Ireland' },
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'ES', name: 'Spain' },
  { code: 'IT', name: 'Italy' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'SE', name: 'Sweden' },
  { code: 'NO', name: 'Norway' },
  { code: 'DK', name: 'Denmark' },
];

export default function OrderFlow({
  storyId,
  userId,
}: {
  storyId: string;
  userId: string;
}) {
  const [readiness, setReadiness] = useState<OrderReadiness | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);

  // Default to GB (since you’re UK-based), but user can change
  const [shippingAddress, setShippingAddress] = useState<ShippingAddress>({
    firstName: '',
    lastName: '',
    addressLine1: '',
    city: '',
    postCode: '',
    countryIsoCode: 'GB',
    email: '',
    phone: '',
    state: '',
    addressLine2: '',
  });

  useEffect(() => {
    async function checkReadiness() {
      const res = await fetch(`/api/orders/check-ready?storyId=${storyId}`);
      const data = await res.json();
      setReadiness(data);
    }
    checkReadiness();
  }, [storyId]);

  async function handleSubmitOrder() {
    if (!readiness?.isReady) return;

    // Basic required validation
    if (
      !shippingAddress.firstName ||
      !shippingAddress.lastName ||
      !shippingAddress.addressLine1 ||
      !shippingAddress.city ||
      !shippingAddress.postCode ||
      !shippingAddress.email ||
      !shippingAddress.countryIsoCode
    ) {
      alert('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storyId,
          userId,
          shippingAddress,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Failed to submit order');
        return;
      }

      setOrderId(data.orderId);
      alert('Order submitted successfully! 🎉');
    } catch (err) {
      console.error('Order submission failed:', err);
      alert('Failed to submit order');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!readiness) {
    return (
      <div className="flex items-center gap-2">
        <Loader2 className="w-5 h-5 animate-spin" /> Checking order status...
      </div>
    );
  }

  if (orderId) {
    return (
      <div className="p-6 bg-green-50 rounded-lg border border-green-200">
        <div className="flex items-center gap-3 mb-4">
          <CheckCircle2 className="w-6 h-6 text-green-600" />
          <h3 className="text-lg font-bold text-green-900">Order Submitted!</h3>
        </div>
        <p className="text-green-700 mb-2">Your book has been sent to printing.</p>
        <p className="text-sm text-green-600">Order ID: {orderId}</p>
      </div>
    );
  }

  const needsState =
    shippingAddress.countryIsoCode === 'US' || shippingAddress.countryIsoCode === 'CA';

  return (
    <div className="space-y-6">
      {/* Readiness Checklist */}
      <div className="p-6 bg-white rounded-lg border">
        <h3 className="text-lg font-bold mb-4">Order Checklist</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            {readiness.hasPdf ? (
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            ) : (
              <AlertCircle className="w-5 h-5 text-orange-500" />
            )}
            <span>PDF Generated</span>
          </div>
          <div className="flex items-center gap-3">
            {readiness.hasCovers ? (
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            ) : (
              <AlertCircle className="w-5 h-5 text-orange-500" />
            )}
            <span>Covers Generated</span>
          </div>
          <div className="flex items-center gap-3">
            {readiness.hasPayment ? (
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            ) : (
              <AlertCircle className="w-5 h-5 text-orange-500" />
            )}
            <span>Payment Confirmed</span>
          </div>
        </div>

        {readiness.missingItems.length > 0 && (
          <div className="mt-4 p-4 bg-orange-50 rounded border border-orange-200">
            <p className="text-sm font-semibold text-orange-900 mb-2">Missing items:</p>
            <ul className="text-sm text-orange-700 space-y-1">
              {readiness.missingItems.map((item, i) => (
                <li key={i}>• {item}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Shipping Form */}
      {readiness.isReady && (
        <div className="p-6 bg-white rounded-lg border">
          <h3 className="text-lg font-bold mb-4">Shipping Address</h3>

          <div className="space-y-4">
            {/* Country */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Country *
              </label>
              <select
                value={shippingAddress.countryIsoCode}
                onChange={(e) =>
                  setShippingAddress((prev) => ({
                    ...prev,
                    countryIsoCode: e.target.value,
                    // clear state when switching country
                    state: '',
                  }))
                }
                className="border rounded px-3 py-2 w-full"
              >
                {COUNTRY_OPTIONS.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                If your country isn’t listed, we’ll add full Gelato coverage next.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="First Name *"
                value={shippingAddress.firstName}
                onChange={(e) =>
                  setShippingAddress({ ...shippingAddress, firstName: e.target.value })
                }
                className="border rounded px-3 py-2"
              />
              <input
                type="text"
                placeholder="Last Name *"
                value={shippingAddress.lastName}
                onChange={(e) =>
                  setShippingAddress({ ...shippingAddress, lastName: e.target.value })
                }
                className="border rounded px-3 py-2"
              />
            </div>

            <input
              type="text"
              placeholder="Address Line 1 *"
              value={shippingAddress.addressLine1}
              onChange={(e) =>
                setShippingAddress({ ...shippingAddress, addressLine1: e.target.value })
              }
              className="border rounded px-3 py-2 w-full"
            />

            <input
              type="text"
              placeholder="Address Line 2 (optional)"
              value={shippingAddress.addressLine2 ?? ''}
              onChange={(e) =>
                setShippingAddress({ ...shippingAddress, addressLine2: e.target.value })
              }
              className="border rounded px-3 py-2 w-full"
            />

            <div className="grid grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="City *"
                value={shippingAddress.city}
                onChange={(e) =>
                  setShippingAddress({ ...shippingAddress, city: e.target.value })
                }
                className="border rounded px-3 py-2"
              />

              <input
                type="text"
                placeholder="Post/Zip Code *"
                value={shippingAddress.postCode}
                onChange={(e) =>
                  setShippingAddress({ ...shippingAddress, postCode: e.target.value })
                }
                className="border rounded px-3 py-2"
              />
            </div>

            {needsState && (
              <input
                type="text"
                placeholder="State/Province (required for US/CA) *"
                value={shippingAddress.state ?? ''}
                onChange={(e) =>
                  setShippingAddress({ ...shippingAddress, state: e.target.value })
                }
                className="border rounded px-3 py-2 w-full"
              />
            )}

            <input
              type="email"
              placeholder="Email *"
              value={shippingAddress.email}
              onChange={(e) =>
                setShippingAddress({ ...shippingAddress, email: e.target.value })
              }
              className="border rounded px-3 py-2 w-full"
            />

            <input
              type="tel"
              placeholder="Phone (optional)"
              value={shippingAddress.phone ?? ''}
              onChange={(e) =>
                setShippingAddress({ ...shippingAddress, phone: e.target.value })
              }
              className="border rounded px-3 py-2 w-full"
            />
          </div>

          <button
            onClick={handleSubmitOrder}
            disabled={
              isSubmitting ||
              !shippingAddress.firstName ||
              !shippingAddress.lastName ||
              !shippingAddress.addressLine1 ||
              !shippingAddress.city ||
              !shippingAddress.postCode ||
              !shippingAddress.email ||
              !shippingAddress.countryIsoCode ||
              (needsState && !shippingAddress.state)
            }
            className="mt-6 w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Submitting Order...
              </>
            ) : (
              <>
                <Package className="w-5 h-5" />
                Submit Order to Gelato
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
