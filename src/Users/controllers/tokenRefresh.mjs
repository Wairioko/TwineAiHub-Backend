import jwt from 'jsonwebtoken';


export const tokenRefresh = async (req, res) => {
    try {
        const { refreshToken } = req.cookies;

        if (!refreshToken) {
            return res.status(401).json({ message: 'No refresh token provided' });
        }


        // Verify the refresh token
        const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);


        // Generate a new authToken
        const newAuthToken = jwt.sign({ id: decoded.id }, process.env.JWT_SECRET, {
            expiresIn: '1h'
        });


        //gen new the refresh token too to boost my security
        const newRefreshToken = jwt.sign({ id: decoded.id }, process.env.REFRESH_TOKEN_SECRET, {
            expiresIn: '7d' 
        });


        // Set new cookies for both tokens
        res.cookie('authToken', newAuthToken, {
            httpOnly: true,
            secure: true,
            sameSite: 'None',
            maxAge: 60 * 60 * 1000 
        });


        res.cookie('refreshToken', newRefreshToken, {
            httpOnly: true,
            secure: true,
            sameSite: 'None',
            maxAge: 7 * 24 * 60 * 60 * 1000 
        });

        res.status(200).json({ message: 'Token refreshed' });
    } catch (error) {
        console.error('Error refreshing token:', error);
        return res.status(403).json({ message: 'Invalid refresh token' });
    }
}