import React, { useState } from 'react';
import { 
  Calculator, 
  DollarSign, 
  Percent, 
  TrendingUp, 
  HelpCircle, 
  CheckCircle2, 
  AlertCircle,
  ArrowRight
} from 'lucide-react';

export default function FeeCalculator() {
  const [costPrice, setCostPrice] = useState(15000);
  const [sellingPrice, setSellingPrice] = useState(29990);
  const [listingType, setListingType] = useState('gold_special'); // gold_special (Clásica 13%), gold_pro (Premium 28%)
  const [customCommissionRate, setCustomCommissionRate] = useState(14);
  const [includeShippingCost, setIncludeShippingCost] = useState(false);
  const [shippingCost, setShippingCost] = useState(3800);
  const [targetMarginPct, setTargetMarginPct] = useState(30);

  // Calculations
  const commissionRate = listingType === 'gold_special' ? 14 : listingType === 'gold_pro' ? 28 : customCommissionRate;
  const mlCommissionAmount = sellingPrice * (commissionRate / 100);
  const totalDeductions = mlCommissionAmount + (includeShippingCost ? shippingCost : 0);
  const netReceived = sellingPrice - totalDeductions;
  const grossProfit = netReceived - costPrice;
  const marginPercentage = sellingPrice > 0 ? (grossProfit / sellingPrice) * 100 : 0;
  const roiPercentage = costPrice > 0 ? (grossProfit / costPrice) * 100 : 0;

  // Suggested price based on target margin
  // Target: Net Profit / Price = Target Margin Pct
  // (Price * (1 - commissionRate/100) - Shipping - Cost) / Price = TargetMargin
  // Price = (Cost + Shipping) / (1 - commissionRate/100 - targetMargin/100)
  const denominator = 1 - (commissionRate / 100) - (targetMarginPct / 100);
  const suggestedPrice = denominator > 0
    ? Math.round((costPrice + (includeShippingCost ? shippingCost : 0)) / denominator)
    : 0;

  const formatMoney = (amount) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  return (
    <div className="page max-w-5xl">

      {/* Header */}
      <div className="page-head">
        <div>
          <h1 className="page-title text-balance">Calculadora de Rentabilidad & Comisiones ML</h1>
          <p className="page-sub text-pretty">
            Calcula con precisión tus márgenes de ganancia reales, comisiones de Mercado Libre y costos de envío.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]">

        {/* Left Form: Inputs */}
        <div className="card">
          <div className="card-head">
            <div>
              <h2 className="card-title">
                <Calculator className="w-4 h-4 text-brand-600" />
                <span>Parámetros de Costo y Venta</span>
              </h2>
              <p className="card-sub mt-0.5">El resultado se recalcula al instante con cada cambio.</p>
            </div>
            <span className="badge badge-neutral">
              Comisión <span className="tabular">{commissionRate}%</span>
            </span>
          </div>

          <div className="card-body space-y-5">

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

              <div className="field">
                <label className="label">Costo de Compra / Fabricación ($)</label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-ink-subtle">$</span>
                  <input
                    type="number"
                    min="0"
                    value={costPrice}
                    onChange={(e) => setCostPrice(parseFloat(e.target.value) || 0)}
                    className="input tabular pl-7 font-bold"
                  />
                </div>
              </div>

              <div className="field">
                <label className="label">Precio de Venta al Público ($)</label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-ink-subtle">$</span>
                  <input
                    type="number"
                    min="0"
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(parseFloat(e.target.value) || 0)}
                    className="input tabular pl-7 font-bold"
                  />
                </div>
              </div>

            </div>

            {/* Listing type selector */}
            <div className="field">
              <span className="label">Tipo de Publicación Mercado Libre</span>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setListingType('gold_special')}
                  aria-pressed={listingType === 'gold_special'}
                  className={`rounded-2xl border p-3.5 text-left transition-all duration-200 ease-spring ${
                    listingType === 'gold_special'
                      ? 'border-brand/60 bg-brand-soft shadow-xs'
                      : 'border-line bg-muted hover:border-line-strong hover:bg-card'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display text-xs font-extrabold text-ink">Clásica (14%)</span>
                    {listingType === 'gold_special' && <CheckCircle2 className="w-4 h-4 text-success" />}
                  </div>
                  <p className="help mt-1">Exposición media/alta</p>
                </button>

                <button
                  type="button"
                  onClick={() => setListingType('gold_pro')}
                  aria-pressed={listingType === 'gold_pro'}
                  className={`rounded-2xl border p-3.5 text-left transition-all duration-200 ease-spring ${
                    listingType === 'gold_pro'
                      ? 'border-brand/60 bg-brand-soft shadow-xs'
                      : 'border-line bg-muted hover:border-line-strong hover:bg-card'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display text-xs font-extrabold text-ink">Premium (28%)</span>
                    {listingType === 'gold_pro' && <CheckCircle2 className="w-4 h-4 text-success" />}
                  </div>
                  <p className="help mt-1">Máxima exposición + cuotas</p>
                </button>
              </div>
            </div>

            {/* Shipping checkbox */}
            <div className="space-y-3 rounded-2xl border border-line bg-muted p-4">
              <label className="flex cursor-pointer items-center gap-2.5 text-xs font-bold text-ink">
                <input
                  type="checkbox"
                  checked={includeShippingCost}
                  onChange={(e) => setIncludeShippingCost(e.target.checked)}
                  className="check"
                />
                <span>Ofrezco Envío Gratis a mi cargo</span>
              </label>

              {includeShippingCost && (
                <div className="flex flex-wrap items-center gap-3 border-t border-line pt-3">
                  <span className="text-xs font-bold text-ink-muted">Costo de Envío:</span>
                  <div className="relative w-36">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-ink-subtle">$</span>
                    <input
                      type="number"
                      value={shippingCost}
                      onChange={(e) => setShippingCost(parseFloat(e.target.value) || 0)}
                      className="input input-sm tabular pl-6 font-bold"
                    />
                  </div>
                  <span className="help">Se descuenta de tu liquidación.</span>
                </div>
              )}
            </div>

            {/* Target Margin Helper */}
            <div className="field border-t border-line pt-4">
              <span className="label">Quiero ganar un margen deseado de</span>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="5"
                  max="70"
                  value={targetMarginPct}
                  onChange={(e) => setTargetMarginPct(parseInt(e.target.value, 10))}
                  className="flex-1 accent-brand"
                />
                <span className="tabular w-12 text-right font-display text-sm font-extrabold text-ink">
                  {targetMarginPct}%
                </span>
              </div>

              {suggestedPrice > 0 && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-accent/30 bg-accent-soft px-3.5 py-2.5 text-xs text-accent">
                  <span className="flex items-center gap-1.5 font-bold">
                    <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                    <span>Precio de venta sugerido para lograr {targetMarginPct}%:</span>
                  </span>
                  <b className="tabular font-display text-sm font-extrabold">{formatMoney(suggestedPrice)}</b>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Right Card: Financial Breakdown Results */}
        <div className="card card-accent flex flex-col overflow-hidden">
          <div className="card-body flex-1 space-y-5">

            {/* Hero: net profit */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="kpi-label">Resumen de Liquidación</span>
                <p className="kpi-value tabular text-3xl">{formatMoney(grossProfit)}</p>
                <p className="mt-2 text-xs text-ink-muted">Ganancia limpia de bolsillo por unidad</p>
              </div>
              <div className="kpi-icon kpi-icon-success shrink-0">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>

            {/* Verdict + ROI */}
            <div className="flex flex-wrap items-center gap-2">
              <span className={`badge ${marginPercentage >= 20 ? 'badge-success' : marginPercentage >= 0 ? 'badge-warning' : 'badge-danger'}`}>
                {marginPercentage >= 20 ? (
                  <CheckCircle2 className="w-3 h-3" />
                ) : (
                  <AlertCircle className="w-3 h-3" />
                )}
                {marginPercentage >= 20 ? 'Rentable' : marginPercentage >= 0 ? 'Margen ajustado' : 'A pérdida'}
              </span>
              <span className="chip">
                <TrendingUp className="w-3.5 h-3.5" />
                ROI <b className="tabular">{roiPercentage.toFixed(1)}%</b>
              </span>
            </div>

            {/* Margin bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3 text-[11px] font-extrabold uppercase tracking-wider text-ink-subtle">
                <span className="flex items-center gap-1.5">
                  <Percent className="w-3 h-3" />
                  <span>Margen sobre la venta</span>
                </span>
                <span className={`tabular ${marginPercentage >= 20 ? 'text-success' : 'text-warning'}`}>
                  {marginPercentage.toFixed(1)}%
                </span>
              </div>
              <div className="progress">
                <div
                  className="progress-bar"
                  style={{ width: `${Math.max(0, Math.min(100, marginPercentage))}%` }}
                />
              </div>
            </div>

            {/* Breakdown rows */}
            <div className="text-xs">
              <div className="flex items-center justify-between border-b border-line py-2.5">
                <span className="text-ink-muted">Precio de venta bruto:</span>
                <span className="tabular font-bold text-ink">{formatMoney(sellingPrice)}</span>
              </div>

              <div className="flex items-center justify-between border-b border-line py-2.5">
                <span className="text-ink-muted">Comisión Mercado Libre ({commissionRate}%):</span>
                <span className="tabular font-bold text-danger">-{formatMoney(mlCommissionAmount)}</span>
              </div>

              {includeShippingCost && (
                <div className="flex items-center justify-between border-b border-line py-2.5">
                  <span className="text-ink-muted">Costo de envío bonificado:</span>
                  <span className="tabular font-bold text-danger">-{formatMoney(shippingCost)}</span>
                </div>
              )}

              <div className="flex items-center justify-between border-b border-line py-2.5">
                <span className="text-ink-muted">Dinero neto acreditado:</span>
                <span className="tabular font-bold text-success">{formatMoney(netReceived)}</span>
              </div>

              <div className="flex items-center justify-between border-b border-line py-2.5">
                <span className="text-ink-muted">Costo del producto:</span>
                <span className="tabular font-bold text-ink">-{formatMoney(costPrice)}</span>
              </div>

              <div className="flex items-center justify-between border-b border-line py-2.5">
                <span className="text-ink-muted">Margen s/ Venta:</span>
                <span className={`tabular font-bold ${marginPercentage >= 20 ? 'text-success' : 'text-warning'}`}>
                  {marginPercentage.toFixed(1)}%
                </span>
              </div>

              {/* Highlighted total row */}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line-strong bg-muted px-3.5 py-3">
                <span className="font-display text-xs font-extrabold text-ink">Utilidad neta por unidad</span>
                <span className="tabular font-display text-base font-extrabold text-ink">
                  {formatMoney(grossProfit)}
                </span>
              </div>
            </div>

          </div>

          <div className="card-foot text-[11px] text-ink-subtle">
            <span className="flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 shrink-0 text-brand-600" />
              <span>Calculado con las tarifas oficiales de Mercado Libre Argentina.</span>
            </span>
          </div>
        </div>

      </div>

    </div>
  );
}
