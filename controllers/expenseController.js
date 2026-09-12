import Expense from '../models/Expense.js'

const buildDateFilter = (query) => {
  const filter = {}
  if (query.from || query.to) {
    filter.date = {}
    if (query.from) filter.date.$gte = new Date(query.from)
    if (query.to) {
      const to = new Date(query.to)
      to.setHours(23, 59, 59, 999)
      filter.date.$lte = to
    }
  }
  if (query.category && query.category !== 'all') {
    filter.category = query.category.toLowerCase()
  }
  return filter
}

// GET /api/expenses - List all expenses with optional filtering
export const getExpenses = async (req, res) => {
  try {
    const filter = buildDateFilter(req.query)
    const expenses = await Expense.find(filter).sort({ date: -1, createdAt: -1 })
    res.status(200).json({ success: true, count: expenses.length, data: expenses })
  } catch (error) {
    console.error('Error fetching expenses:', error.message)
    res.status(500).json({ success: false, message: 'Failed to fetch expenses' })
  }
}

// GET /api/expenses/:id
export const getExpenseById = async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id)
    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense not found' })
    }
    res.status(200).json({ success: true, data: expense })
  } catch (error) {
    console.error('Error fetching expense:', error.message)
    res.status(500).json({ success: false, message: 'Failed to fetch expense' })
  }
}

// POST /api/expenses - Record a new business expense
export const createExpense = async (req, res) => {
  try {
    const { date, title, category, amount, paymentMethod, notes } = req.body

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Title / description is required' })
    }

    if (amount === undefined || amount === null || isNaN(Number(amount)) || Number(amount) < 0) {
      return res.status(400).json({ success: false, message: 'A valid non-negative amount is required' })
    }

    const expense = new Expense({
      date: date ? new Date(date) : new Date(),
      title: title.trim(),
      category: (category || 'other').toLowerCase(),
      amount: Number(amount),
      paymentMethod: paymentMethod || 'cash',
      notes: notes ? notes.trim() : ''
    })

    const saved = await expense.save()
    res.status(201).json({ success: true, message: 'Expense recorded successfully', data: saved })
  } catch (error) {
    console.error('Error creating expense:', error.message)
    res.status(500).json({ success: false, message: error.message || 'Failed to record expense' })
  }
}

// PUT /api/expenses/:id - Update an existing expense
export const updateExpense = async (req, res) => {
  try {
    const { date, title, category, amount, paymentMethod, notes } = req.body
    const payload = {}

    if (date !== undefined) payload.date = new Date(date)
    if (title !== undefined) payload.title = title.trim()
    if (category !== undefined) payload.category = category.toLowerCase()
    if (amount !== undefined) payload.amount = Number(amount)
    if (paymentMethod !== undefined) payload.paymentMethod = paymentMethod
    if (notes !== undefined) payload.notes = notes.trim()

    const updated = await Expense.findByIdAndUpdate(
      req.params.id,
      { $set: payload },
      { new: true, runValidators: true }
    )

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Expense not found' })
    }

    res.status(200).json({ success: true, message: 'Expense updated successfully', data: updated })
  } catch (error) {
    console.error('Error updating expense:', error.message)
    res.status(500).json({ success: false, message: error.message || 'Failed to update expense' })
  }
}

// DELETE /api/expenses/:id
export const deleteExpense = async (req, res) => {
  try {
    const deleted = await Expense.findByIdAndDelete(req.params.id)
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Expense not found' })
    }
    res.status(200).json({ success: true, message: 'Expense deleted successfully' })
  } catch (error) {
    console.error('Error deleting expense:', error.message)
    res.status(500).json({ success: false, message: 'Failed to delete expense' })
  }
}
