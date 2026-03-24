const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ 
            success: false, 
            message: 'Access token is required' 
        });
    }
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
        if (err) {
            // Distinguish between expired and invalid tokens
            const message = err.name === 'TokenExpiredError' 
                ? 'Access token has expired' 
                : 'Invalid access token';
            return res.status(403).json({ success: false, message });
        }

        // Block refresh tokens from being used as access tokens
        if (user.tokenType !== 'access') {
            return res.status(403).json({ 
                success: false, 
                message: 'Invalid token type' 
            });
        }
        
        req.user = user;
        next();
    });
};

const generateTokens = (user) => {
    const accessToken = jwt.sign({ id: user.userId, email: user.email, tokenType: 'access' }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '24h' });
    const refreshToken = jwt.sign({ id: user.userId, tokenType: 'refresh' }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '30d' });
    return { accessToken, refreshToken };
};

module.exports = { authenticateToken, generateTokens };
