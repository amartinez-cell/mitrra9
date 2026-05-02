/**
 * Pricing engine for the promo calendar.
 *
 * Two main responsibilities:
 *   - lookupPricing(): given a product family, customer class, and case count,
 *     return the right pricing tier
 *   - computePromoTotals(): roll up SKU lines + trade-spend lines into the
 *     gross/net/contribution profit calc chain
 *
 * Math chain (per business definition):
 *   gross_revenue        = sum(line.cases * line.price_per_case)
 *   net_revenue          = gross_revenue - discount  (billbacks-as-trade-spend stay in trade_spend)
 *   total_cogs           = sum(line.cases * line.cogs_per_case)
 *   gross_profit         = net_revenue - total_cogs
 *   contribution_profit  = gross_profit - total_trade_spend
 *   trade_spend_pct      = total_trade_spend / gross_revenue
 */

/**
 * Map a sales channel to its default customer classification for pricing.
 * Used when the user picks a channel and we want to suggest the right pricing
 * tier set without making them think about it.
 */
export function defaultCustomerClassForChannel(channel) {
  switch (channel) {
    case 'Conventional':
    case 'Inbound':
    case 'New Distribution':
    case 'Wholesale':
      return 'Distributor'
    case 'Chains':
      return 'Retail Direct Everyday'   // chains usually buy at retail-direct pricing
    case 'eCommerce':
      return 'eComm Everyday'
    case 'Retail Direct':
      return 'Retail Direct Everyday'
    case 'Retailer':
      return 'Retailer'
    default:
      return 'Distributor'
  }
}

/**
 * Look up the pricing tier for a given (product_family, customer_class, cases).
 * For tiers with order-size brackets (Retailer 1-3 / 4-11 / etc.), this picks
 * the bracket the case count falls into.
 */
export function lookupPricing(pricingTiers, { product_family, customer_class, cases }) {
  const candidates = pricingTiers.filter(
    (t) => t.active !== false
      && t.product_family === product_family
      && t.customer_class === customer_class
  )
  if (candidates.length === 0) return null

  // Find the tier whose order-size bracket contains `cases`
  const c = Math.max(1, Math.round(Number(cases) || 0))
  for (const tier of candidates) {
    const min = tier.order_min || 1
    const max = tier.order_max == null ? Infinity : tier.order_max
    if (c >= min && c <= max) return tier
  }
  // Fallback: pick the highest tier (most cases). This handles the case where
  // someone enters very few cases but the tier set has only larger brackets.
  return candidates.sort((a, b) => (b.order_min || 0) - (a.order_min || 0))[0]
}

/**
 * Compute totals for a promo given its SKU lines + trade-spend lines.
 */
export function computePromoTotals(promo, skuLines, spendLines) {
  let total_cases = 0
  let gross_revenue = 0
  let total_cogs = 0

  for (const line of skuLines) {
    const cases = Number(line.cases) || 0
    const price = Number(line.price_per_case) || 0
    const cogs = Number(line.cogs_per_case) || 0
    total_cases += cases
    gross_revenue += cases * price
    total_cogs += cases * cogs
  }

  // Discount applies to the whole promo
  let total_discount = 0
  if (promo.discount_type === 'percent_off') {
    total_discount = gross_revenue * Number(promo.discount_value || 0)
  } else if (promo.discount_type === 'dollar_off_per_case') {
    total_discount = total_cases * Number(promo.discount_value || 0)
  } else if (promo.discount_type === 'billback_per_case') {
    // Billback: not deducted from gross revenue; instead added to trade spend below
    total_discount = 0
  }

  const net_revenue = gross_revenue - total_discount
  const gross_profit = net_revenue - total_cogs

  let total_trade_spend = 0
  for (const line of spendLines) {
    if (line.category === 'POS' && line.quantity != null && line.cost_per_unit != null) {
      total_trade_spend += Number(line.quantity) * Number(line.cost_per_unit)
    } else {
      total_trade_spend += Number(line.amount) || 0
    }
  }
  // Add billback to trade spend
  if (promo.discount_type === 'billback_per_case') {
    total_trade_spend += total_cases * Number(promo.discount_value || 0)
  }

  const contribution_profit = gross_profit - total_trade_spend
  const trade_spend_pct = gross_revenue > 0 ? total_trade_spend / gross_revenue : null

  return {
    total_cases,
    gross_revenue,
    total_discount,
    net_revenue,
    total_cogs,
    gross_profit,
    total_trade_spend,
    contribution_profit,
    trade_spend_pct,
  }
}

/**
 * List the customer classes available for a channel. Used to populate
 * the pricing-tier dropdown on the promo form.
 */
export function customerClassesForChannel(channel, pricingTiers) {
  // Get all unique customer classes that have at least one tier defined
  const all = [...new Set(pricingTiers.map((t) => t.customer_class))]
  switch (channel) {
    case 'Conventional':
    case 'Inbound':
    case 'New Distribution':
    case 'Wholesale':
      return all.filter((c) => ['Distributor', 'Wholesaler'].includes(c))
    case 'Chains':
      return all.filter((c) => c.startsWith('Retail Direct'))
    case 'eCommerce':
      return all.filter((c) => c.startsWith('eComm'))
    case 'Retail Direct':
      return all.filter((c) => c.startsWith('Retail Direct'))
    default:
      return all
  }
}

/**
 * List product families available — derived from pricing tiers
 */
export function listProductFamilies(pricingTiers) {
  return [...new Set(pricingTiers.map((t) => t.product_family))].sort()
}
