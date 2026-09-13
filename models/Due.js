import mongoose from 'mongoose'

const dueSchema = new mongoose.Schema(
  {
    personName: {
      type: String,
      required: [true, 'Person or lender name is required'],
      trim: true
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0, 'Amount cannot be negative']
    },
    paidAmount: {
      type: Number,
      default: 0,
      min: [0, 'Paid amount cannot be negative']
    },
    date: {
      type: Date,
      required: [true, 'Date is required'],
      default: Date.now,
      index: true
    },
    dueDate: {
      type: Date,
      default: null
    },
    status: {
      type: String,
      enum: {
        values: ['unpaid', 'partially_paid', 'paid'],
        message: '{VALUE} is not a valid status'
      },
      default: 'unpaid',
      index: true
    },
    phone: {
      type: String,
      default: '',
      trim: true
    },
    receivedVia: {
      type: String,
      default: 'cash',
      trim: true
    },
    notes: {
      type: String,
      default: '',
      trim: true
    }
  },
  { timestamps: true }
)

// Pre-save hook to ensure status matches amount vs paidAmount accurately
dueSchema.pre('save', function (next) {
  const total = Number(this.amount || 0)
  const paid = Number(this.paidAmount || 0)

  if (paid >= total && total > 0) {
    this.status = 'paid'
  } else if (paid > 0 && paid < total) {
    this.status = 'partially_paid'
  } else {
    this.status = 'unpaid'
  }
  next()
})

const Due = mongoose.model('Due', dueSchema)

export default Due
