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
    <div className="space-y-6 max-w-5xl">
      
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Calculadora de Rentabilidad & Comisiones ML</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Calcula con precisión tus márgenes de ganancia reales, comisiones de Mercado Libre y costos de envío.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Form: Inputs */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
          <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-2 pb-3 border-b border-slate-100">
            <Calculator className="w-4 h-4 text-yellow-600" />
            <span>Parámetros de Costo y Venta</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Costo de Compra / Fabricación ($)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                <input
                  type="number"
                  min="0"
                  value={costPrice}
                  onChange={(e) => setCostPrice(parseFloat(e.target.value) || 0)}
                  className="w-full pl-7 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-yellow-400 focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Precio de Venta al Público ($)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                <input
                  type="number"
                  min="0"
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(parseFloat(e.target.value) || 0)}
                  className="w-full pl-7 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-yellow-400 focus:bg-white"
                />
              </div>
            </div>

          </div>

          {/* Listing type selector */}
          <div className="space-y-2 text-xs">
            <label className="block font-bold text-slate-700">Tipo de Publicación Mercado Libre:</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setListingType('gold_special')}
                className={`p-3 rounded-xl border text-left transition ${
                  listingType === 'gold_special'
                    ? 'border-yellow-400 bg-yellow-50 text-slate-900 font-bold'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span>Clásica (14%)</span>
                  {listingType === 'gold_special' && <CheckCircle2 className="w-4 h-4 text-yellow-600" />}
                </div>
                <p className="text-[10px] text-slate-500 font-normal mt-0.5">Exposición media/alta</p>
              </button>

              <button
                type="button"
                onClick={() => setListingType('gold_pro')}
                className={`p-3 rounded-xl border text-left transition ${
                  listingType === 'gold_pro'
                    ? 'border-yellow-400 bg-yellow-50 text-slate-900 font-bold'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span>Premium (28%)</span>
                  {listingType === 'gold_pro' && <CheckCircle2 className="w-4 h-4 text-yellow-600" />}
                </div>
                <p className="text-[10px] text-slate-500 font-normal mt-0.5">Máxima exposición + cuotas</p>
              </button>
            </div>
          </div>

          {/* Shipping checkbox */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5 text-xs">
            <label className="flex items-center space-x-2 font-bold text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={includeShippingCost}
                onChange={(e) => setIncludeShippingCost(e.target.checked)}
                className="w-4 h-4 text-yellow-500 rounded focus:ring-yellow-400"
              />
              <span>Ofrezco Envío Gratis a mi cargo</span>
            </label>

            {includeShippingCost && (
              <div className="pt-2 flex items-center space-x-3">
                <span className="text-slate-600 font-medium">Costo de Envío:</span>
                <div className="relative w-32">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                  <input
                    type="number"
                    value={shippingCost}
                    onChange={(e) => setShippingCost(parseFloat(e.target.value) || 0)}
                    className="w-full pl-6 pr-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Target Margin Helper */}
          <div className="pt-2 border-t border-slate-100 text-xs">
            <label className="block font-bold text-slate-700 mb-1">
              Quiero ganar un margen deseado de:
            </label>
            <div className="flex items-center space-x-3">
              <input
                type="range"
                min="5"
                max="70"
                value={targetMarginPct}
                onChange={(e) => setTargetMarginPct(parseInt(e.target.value, 10))}
                className="flex-1 accent-yellow-400"
              />
              <span className="font-extrabold text-sm text-slate-900 w-12 text-right">
                {targetMarginPct}%
              </span>
            </div>
            {suggestedPrice > 0 && (
              <div className="mt-2 p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 flex items-center justify-between">
                <span>Precio de venta sugerido para lograr {targetMarginPct}%:</span>
                <b className="font-extrabold text-sm">{formatMoney(suggestedPrice)}</b>
              </div>
            )}
          </div>

        </div>

        {/* Right Card: Financial Breakdown Results */}
        <div className="lg:col-span-5 bg-gradient-to-b from-slate-900 to-slate-950 text-white rounded-2xl shadow-xl p-6 flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-bold text-yellow-400 uppercase tracking-wider">
              Resumen de Liquidación
            </span>
            <h3 className="text-3xl font-black mt-1 text-white tracking-tight">
              {formatMoney(grossProfit)}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5 font-medium">
              Ganancia limpia de bolsillo por unidad
            </p>

            <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-800">
              <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
                <span className="text-[10px] text-slate-400 font-semibold uppercase">Margen s/ Venta</span>
                <h4 className={`text-lg font-black mt-0.5 ${marginPercentage >= 20 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {marginPercentage.toFixed(1)}%
                </h4>
              </div>

              <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
                <span className="text-[10px] text-slate-400 font-semibold uppercase">Retorno ROI</span>
                <h4 className="text-lg font-black mt-0.5 text-blue-400">
                  {roiPercentage.toFixed(1)}%
                </h4>
              </div>
            </div>

            <div className="mt-6 space-y-2.5 text-xs text-slate-300">
              <div className="flex justify-between">
                <span>Precio de venta bruto:</span>
                <span className="font-bold text-white">{formatMoney(sellingPrice)}</span>
              </div>
              <div className="flex justify-between text-rose-400">
                <span>Comisión Mercado Libre ({commissionRate}%):</span>
                <span>-{formatMoney(mlCommissionAmount)}</span>
              </div>
              {includeShippingCost && (
                <div className="flex justify-between text-rose-400">
                  <span>Costo de envío bonificado:</span>
                  <span>-{formatMoney(shippingCost)}</span>
                </div>
              )}
              <div className="pt-2 border-t border-slate-800 flex justify-between text-slate-300">
                <span>Dinero neto acreditado:</span>
                <span className="font-bold text-emerald-400">{formatMoney(netReceived)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Costo del producto:</span>
                <span>-{formatMoney(costPrice)}</span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center space-x-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
            <span>Calculado con las tarifas oficiales de Mercado Libre Argentina.</span>
          </div>
        </div>

      </div>

    </div>
  );
}
