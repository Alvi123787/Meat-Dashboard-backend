import Due from '../models/Due.js'

const buildQueryFilter = (query) => {
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

  if (query.status && query.status !== 'all') {
    filter.status = query.status.toLowerCase()
  }

  if (query.search && query.search.trim()) {
    const term = query.search.trim()
    filter.$or = [
      { personName: { $regex: term, $options: 'i' } },
      { notes: { $regex: term, $options: 'i' } },
      { phone: { $regex: term, $options: 'i' } }
    ]
  }

  return filter
}

// GET /api/dues - List all dues with optional filters
export const getDues = async (req, res) => {
  try {
    const filter = buildQueryFilter(req.query)
    const dues = await Due.find(filter).sort({ date: -1, createdAt: -1 })
    res.status(200).json({ success: true, count: dues.length, data: dues })
  } catch (error) {
    console.error('Error fetching dues:', error.message)
    res.status(500).json({ success: false, message: 'Failed to fetch dues records' })
  }
}

// GET /api/dues/:id - Fetch single due record
export const getDueById = async (req, res) => {
  try {
    const due = await Due.findById(req.params.id)
    if (!due) {
      return res.status(404).json({ success: false, message: 'Due record not found' })
    }
    res.status(200).json({ success: true, data: due })
  } catch (error) {
    console.error('Error fetching due record:', error.message)
    res.status(500).json({ success: false, message: 'Failed to fetch due record' })
  }
}

// POST /api/dues - Record new borrowed due
export const createDue = async (req, res) => {
  try {
    const { personName, amount, paidAmount, date, dueDate, phone, receivedVia, notes } = req.body

    if (!personName || !personName.trim()) {
      return res.status(400).json({ success: false, message: 'Person or lender name is required' })
    }

    if (amount === undefined || amount === null || isNaN(Number(amount)) || Number(amount) < 0) {
      return res.status(400).json({ success: false, message: 'A valid non-negative amount is required' })
    }

    const due = new Due({
      personName: personName.trim(),
      amount: Number(amount),
      paidAmount: paidAmount !== undefined && !isNaN(Number(paidAmount)) ? Number(paidAmount) : 0,
      date: date ? new Date(date) : new Date(),
      dueDate: dueDate ? new Date(dueDate) : null,
      phone: phone ? phone.trim() : '',
      receivedVia: receivedVia || 'cash',
      notes: notes ? notes.trim() : ''
    })

    const saved = await due.save()
    res.status(201).json({ success: true, message: 'Due record created successfully', data: saved })
  } catch (error) {
    console.error('Error creating due:', error.message)
    res.status(500).json({ success: false, message: error.message || 'Failed to record due' })
  }
}

// PUT /api/dues/:id - Update existing due record (e.g. record repayment or edit details)
export const updateDue = async (req, res) => {
  try {
    const { personName, amount, paidAmount, date, dueDate, phone, receivedVia, notes, status } = req.body
    const due = await Due.findById(req.params.id)

    if (!due) {
      return res.status(404).json({ success: false, message: 'Due record not found' })
    }

    if (personName !== undefined) due.personName = personName.trim()
    if (amount !== undefined) due.amount = Number(amount)
    if (paidAmount !== undefined) due.paidAmount = Number(paidAmount)
    if (date !== undefined) due.date = new Date(date)
    if (dueDate !== undefined) due.dueDate = dueDate ? new Date(dueDate) : null
    if (phone !== undefined) due.phone = phone.trim()
    if (receivedVia !== undefined) due.receivedVia = receivedVia
    if (notes !== undefined) due.notes = notes.trim()

    // Status will be recomputed by the pre-save hook based on amount vs paidAmount,
    // or explicit status override if passed
    if (status !== undefined && ['unpaid', 'partially_paid', 'paid'].includes(status)) {
      due.status = status
    }

    const updated = await due.save()
    res.status(200).json({ success: true, message: 'Due record updated successfully', data: updated })
  } catch (error) {
    console.error('Error updating due:', error.message)
    res.status(500).json({ success: false, message: error.message || 'Failed to update due' })
  }
}

// DELETE /api/dues/:id - Delete due record
export const deleteDue = async (req, res) => {
  try {
    const deleted = await Due.findByIdAndDelete(req.params.id)
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Due record not found' })
    }
    res.status(200).json({ success: true, message: 'Due record deleted successfully' })
  } catch (error) {
    console.error('Error deleting due:', error.message)
    res.status(500).json({ success: false, message: 'Failed to delete due record' })
  }
}
