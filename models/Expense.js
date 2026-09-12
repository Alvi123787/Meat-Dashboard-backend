import mongoose from 'mongoose'

const expenseSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: [true, 'Expense date is required'],
      default: Date.now,
      index: true
    },
    title: {
      type: String,
      required: [true, 'Expense title / description is required'],
      trim: true
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: {
        values: ['ads', 'packaging', 'delivery', 'supplies', 'utilities', 'salaries', 'other'],
        message: '{VALUE} is not a supported category'
      },
      default: 'other',
      index: true
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0, 'Amount cannot be negative']
    },
    paymentMethod: {
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

const Expense = mongoose.model('Expense', expenseSchema)

export default Expense
