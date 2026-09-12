import Entry from '../models/Entry.js'

const normalizeNumber = (value) => {
  if (value === '' || value === null || value === undefined) return 0
  const numericValue = Number(value)
  return Number.isNaN(numericValue) ? 0 : numericValue
}

// ── Helper: build a Mongo date-range filter from optional ?from=&to= query params ──
const buildDateFilter = (query) => {
  const filter = {}
  if (query.from || query.to) {
    filter.date = {}
    if (query.from) filter.date.$gte = new Date(query.from)
    if (query.to) {
      // include the whole "to" day
      const to = new Date(query.to)
      to.setHours(23, 59, 59, 999)
      filter.date.$lte = to
    }
  }
  return filter
}

// GET /api/entries  — list entries, most recent first, optional ?from=&to= range
export const getEntries = async (req, res) => {
  try {
    const filter = buildDateFilter(req.query)
    const entries = await Entry.find(filter).sort({ date: -1 })
    res.status(200).json({ success: true, count: entries.length, data: entries })
  } catch (error) {
    console.error('Error fetching entries:', error.message)
    res.status(500).json({ success: false, message: 'Failed to fetch entries' })
  }
}

// GET /api/entries/:id
export const getEntryById = async (req, res) => {
  try {
    const entry = await Entry.findById(req.params.id)
    if (!entry) {
      return res.status(404).json({ success: false, message: 'Entry not found' })
    }
    res.status(200).json({ success: true, data: entry })
  } catch (error) {
    console.error('Error fetching entry:', error.message)
    res.status(500).json({ success: false, message: 'Failed to fetch entry' })
  }
}

// POST /api/entries — create a new daily entry
export const createEntry = async (req, res) => {
  try {
    const {
      date,
      orders,
      revenue,
      grossProfit,
      totalDeliveryCost,
      totalPackagingCost,
      adsExpense,
      otherExpenses,
      notes
    } = req.body

    if (date === undefined || orders === undefined || revenue === undefined || grossProfit === undefined) {
      return res.status(400).json({
        success: false,
        message: 'date, orders, revenue and grossProfit are required'
      })
    }

    const entry = new Entry({
      date,
      orders: normalizeNumber(orders),
      revenue: normalizeNumber(revenue),
      grossProfit: normalizeNumber(grossProfit),
      totalDeliveryCost: normalizeNumber(totalDeliveryCost),
      totalPackagingCost: normalizeNumber(totalPackagingCost),
      adsExpense: normalizeNumber(adsExpense),
      otherExpenses: normalizeNumber(otherExpenses),
      notes: notes || ''
    })

    const saved = await entry.save()
    res.status(201).json({ success: true, message: 'Entry added successfully', data: saved })
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'An entry for this date already exists. Edit it instead of creating a duplicate.'
      })
    }
    console.error('Error creating entry:', error.message)
    res.status(500).json({ success: false, message: error.message || 'Failed to create entry' })
  }
}

// PUT /api/entries/:id — update an existing entry
export const updateEntry = async (req, res) => {
  try {
    const payload = { ...req.body }

    for (const field of ['orders', 'revenue', 'grossProfit', 'totalDeliveryCost', 'totalPackagingCost', 'adsExpense', 'otherExpenses']) {
      if (Object.prototype.hasOwnProperty.call(payload, field)) {
        payload[field] = normalizeNumber(payload[field])
      }
    }

    const updated = await Entry.findOneAndUpdate(
      { _id: req.params.id },
      { $set: payload },
      { new: true, runValidators: true }
    )

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Entry not found' })
    }

    res.status(200).json({ success: true, message: 'Entry updated successfully', data: updated })
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'An entry for this date already exists.'
      })
    }

    console.error('Error updating entry:', error.message)
    res.status(500).json({ success: false, message: error.message || 'Failed to update entry' })
  }
}

// DELETE /api/entries/:id
export const deleteEntry = async (req, res) => {
  try {
    const deleted = await Entry.findByIdAndDelete(req.params.id)
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Entry not found' })
    }
    res.status(200).json({ success: true, message: 'Entry deleted successfully' })
  } catch (error) {
    console.error('Error deleting entry:', error.message)
    res.status(500).json({ success: false, message: 'Failed to delete entry' })
  }
}

// GET /api/entries/summary — dashboard data: overall totals + a day-by-day series for charts
// Optional ?from=&to= to scope the summary to a date range (defaults to all-time).
export const getSummary = async (req, res) => {
  try {
    const filter = buildDateFilter(req.query)

    const entries = await Entry.find(filter).sort({ date: 1 })

    const totals = entries.reduce(
      (acc, e) => {
        acc.totalOrders += e.orders
        acc.totalRevenue += e.revenue
        acc.grossProfit += e.grossProfit
        acc.totalDeliveryCost += e.totalDeliveryCost
        acc.totalPackagingCost += e.totalPackagingCost
        acc.totalAdsExpense += e.adsExpense
        acc.totalOtherExpenses += e.otherExpenses
        acc.totalExpenses += e.totalExpenses
        acc.netProfitLoss += e.netProfitLoss
        return acc
      },
      {
        totalOrders: 0,
        totalRevenue: 0,
        grossProfit: 0,
        totalDeliveryCost: 0,
        totalPackagingCost: 0,
        totalAdsExpense: 0,
        totalOtherExpenses: 0,
        totalExpenses: 0,
        netProfitLoss: 0
      }
    )

    const daysCount = entries.length
    const avgOrderValue = totals.totalOrders > 0 ? totals.totalRevenue / totals.totalOrders : 0
    const avgDailyProfit = daysCount > 0 ? totals.netProfitLoss / daysCount : 0
    const profitableDays = entries.filter((e) => e.netProfitLoss > 0).length
    const lossDays = entries.filter((e) => e.netProfitLoss < 0).length

    // Day-by-day series for the trend chart (already sorted ascending by date)
    const series = entries.map((e) => ({
      date: e.date,
      orders: e.orders,
      revenue: e.revenue,
      totalExpenses: e.totalExpenses,
      netProfitLoss: e.netProfitLoss
    }))

    // Expense breakdown for the pie/bar chart
    const expenseBreakdown = [
      { name: 'Delivery', value: totals.totalDeliveryCost },
      { name: 'Packaging', value: totals.totalPackagingCost },
      { name: 'Ads', value: totals.totalAdsExpense },
      { name: 'Other', value: totals.totalOtherExpenses }
    ]

    res.status(200).json({
      success: true,
      data: {
        ...totals,
        daysCount,
        avgOrderValue,
        avgDailyProfit,
        profitableDays,
        lossDays,
        series,
        expenseBreakdown
      }
    })
  } catch (error) {
    console.error('Error building summary:', error.message)
    res.status(500).json({ success: false, message: 'Failed to build summary' })
  }
}
