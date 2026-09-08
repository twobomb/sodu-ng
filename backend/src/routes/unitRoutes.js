const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth');
const {
    getAllUnits,
    getUnitById,
    createUnit,
    updateUnit,
    deleteUnit,
} = require('../controllers/unitController');

router.use(authenticate);

router.get('/', getAllUnits);
router.get('/:id', getUnitById);
router.post('/', createUnit);
router.put('/:id', updateUnit);
router.delete('/:id', deleteUnit);

module.exports = router;