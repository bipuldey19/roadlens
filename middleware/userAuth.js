const userAuth = (req, res, next) => {
    if (req.session && req.session.userId) {
        next();
    } else {
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            res.status(401).json({ error: 'Unauthorized' });
        } else {
            res.redirect('/login');
        }
    }
};

module.exports = userAuth; 