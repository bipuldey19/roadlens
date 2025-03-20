const auth = (req, res, next) => {
    if (req.session && req.session.adminId) {
        next();
    } else {
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            res.status(401).json({ error: 'Unauthorized' });
        } else {
            res.redirect('/admin/login');
        }
    }
};

module.exports = auth; 