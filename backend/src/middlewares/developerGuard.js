const requireDeveloper = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Не авторизован' });
    }
    if (req.user.role !== 'developer') {
        return res.status(403).json({ error: 'Доступ только для разработчика' });
    }
    next();
};

module.exports = { requireDeveloper };