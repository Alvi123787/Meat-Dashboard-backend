import express from 'express'
import {
  getEntries,
  getEntryById,
  createEntry,
  updateEntry,
  deleteEntry,
  getSummary
} from '../controllers/entryController.js'

const router = express.Router()

// NOTE: /summary must be declared before /:id so Express doesn't treat "summary" as an :id
router.get('/summary', getSummary)

router.get('/', getEntries)
router.post('/', createEntry)
router.get('/:id', getEntryById)
router.put('/:id', updateEntry)
router.delete('/:id', deleteEntry)

export default router
