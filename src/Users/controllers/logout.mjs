export const userLogout = async (req, res) => {
    try {
        // Handle req.logout if it exists
        if (req.logout) {
            await new Promise((resolve, reject) => {
                req.logout((err) => {
                    if (err) return reject(err);
                    resolve();
                });
            });
        }

        // Clear authentication cookies using the helper function
        const cookies = ['authToken', 'anonymousId', 'idToken', 'anonToken', 'refreshToken'];
        cookies.forEach((cookie) => {
            try {
                res.clearCookie(cookie, cookieOptions);
            } catch (error) {
                console.error(`Failed to clear cookie ${cookie}:`, error);
            }
        });

        // Destroy the session if it exists
        if (req.session) {
            await new Promise((resolve, reject) => {
                req.session.destroy((err) => {
                    if (err) {
                        console.error('Session destruction error:', err);
                        return reject(err);
                    }
                    resolve();
                });
            });
        }

        // Send success response
        res.status(200).json({ message: 'Logged out successfully' });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Failed to logout' });
    }
};
