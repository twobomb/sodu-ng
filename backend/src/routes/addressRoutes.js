const express = require('express');
const router = express.Router();
const {authenticate} = require('../middlewares/auth');
const {requirePermission} = require('../middlewares/permissionGuard');
const {autocomplete} = require('../controllers/addressController');

// Автодополнение адреса из справочника ФИАС (SQLite).
// Используется при заполнении поля «Адрес» в карточке вызова, поэтому доступ
// ограничиваем теми, кто может просматривать вызовы.
router.get('/autocomplete', authenticate, requirePermission('calls.view'), autocomplete);

module.exports = router;