import express from 'express'
import {
  getDues,
  getDueById,
  createDue,
  updateDue,
  deleteDue
} from '../controllers/dueController.js'

const router = express.Router()

router.get('/', getDues)
router.get('/:id', getDueById)
router.post('/', createDue)
router.put('/:id', updateDue)
router.delete('/:id', deleteDue)

export default router
