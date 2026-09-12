import Entry from '../models/Entry.js'
import Expense from '../models/Expense.js'

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

    const [entries, standaloneExpenses] = await Promise.all([
      Entry.find(filter).sort({ date: 1 }),
      Expense.find(filter).sort({ date: 1 })
    ])

    const totals = entries.reduce(
      (acc, e) => {
        acc.totalOrders += Number(e.orders || 0)
        acc.totalRevenue += Number(e.revenue || 0)
        acc.grossProfit += Number(e.grossProfit || 0)
        acc.legacyDeliveryCost += Number(e.totalDeliveryCost || 0)
        acc.legacyPackagingCost += Number(e.totalPackagingCost || 0)
        acc.legacyAdsExpense += Number(e.adsExpense || 0)
        acc.legacyOtherExpenses += Number(e.otherExpenses || 0)
        acc.legacyTotalExpenses += Number(e.totalExpenses || 0)
        return acc
      },
      {
        totalOrders: 0,
        totalRevenue: 0,
        grossProfit: 0,
        legacyDeliveryCost: 0,
        legacyPackagingCost: 0,
        legacyAdsExpense: 0,
        legacyOtherExpenses: 0,
        legacyTotalExpenses: 0
      }
    )

    // Aggregate standalone expenses by category
    const categoryTotals = {
      ads: totals.legacyAdsExpense,
      packaging: totals.legacyPackagingCost,
      delivery: totals.legacyDeliveryCost,
      supplies: 0,
      utilities: 0,
      salaries: 0,
      other: totals.legacyOtherExpenses
    }

    let standaloneTotal = 0
    standaloneExpenses.forEach((exp) => {
      const cat = (exp.category || 'other').toLowerCase()
      const amt = Number(exp.amount || 0)
      standaloneTotal += amt
      if (categoryTotals[cat] !== undefined) {
        categoryTotals[cat] += amt
      } else {
        categoryTotals.other += amt
      }
    })

    const totalExpenses = totals.legacyTotalExpenses + standaloneTotal
    const netProfitLoss = totals.grossProfit - totalExpenses

    const daysCount = entries.length
    const avgOrderValue = totals.totalOrders > 0 ? totals.totalRevenue / totals.totalOrders : 0
    const avgDailyProfit = daysCount > 0 ? netProfitLoss / daysCount : 0

    // Day-by-day expense map for combining into series
    const expensesByDay = {}
    standaloneExpenses.forEach((exp) => {
      const dayKey = new Date(exp.date).toISOString().slice(0, 10)
      expensesByDay[dayKey] = (expensesByDay[dayKey] || 0) + Number(exp.amount || 0)
    })

    // Day-by-day series for the trend chart
    const series = entries.map((e) => {
      const dayKey = new Date(e.date).toISOString().slice(0, 10)
      const dayStandaloneExpense = expensesByDay[dayKey] || 0
      const dayTotalExpenses = Number(e.totalExpenses || 0) + dayStandaloneExpense
      const dayNetProfit = Number(e.grossProfit || 0) - dayTotalExpenses

      return {
        date: e.date,
        orders: e.orders,
        revenue: e.revenue,
        grossProfit: e.grossProfit,
        totalExpenses: dayTotalExpenses,
        netProfitLoss: dayNetProfit
      }
    })

    const profitableDays = series.filter((e) => e.netProfitLoss > 0).length
    const lossDays = series.filter((e) => e.netProfitLoss < 0).length

    // Expense breakdown for the donut/pie chart
    const expenseBreakdown = [
      { name: 'Ads', value: categoryTotals.ads },
      { name: 'Packaging', value: categoryTotals.packaging },
      { name: 'Delivery', value: categoryTotals.delivery },
      { name: 'Supplies', value: categoryTotals.supplies },
      { name: 'Utilities', value: categoryTotals.utilities },
      { name: 'Salaries', value: categoryTotals.salaries },
      { name: 'Other', value: categoryTotals.other }
    ].filter((item) => item.value > 0)

    res.status(200).json({
      success: true,
      data: {
        totalOrders: totals.totalOrders,
        totalRevenue: totals.totalRevenue,
        grossProfit: totals.grossProfit,
        totalExpenses,
        totalAdsExpense: categoryTotals.ads,
        totalPackagingCost: categoryTotals.packaging,
        totalDeliveryCost: categoryTotals.delivery,
        netProfitLoss,
        daysCount,
        avgOrderValue,
        avgDailyProfit,
        profitableDays,
        lossDays,
        series,
        expenseBreakdown: expenseBreakdown.length > 0 ? expenseBreakdown : [{ name: 'No Expenses', value: 0 }]
      }
    })
  } catch (error) {
    console.error('Error building summary:', error.message)
    res.status(500).json({ success: false, message: 'Failed to build summary' })
  }
}
