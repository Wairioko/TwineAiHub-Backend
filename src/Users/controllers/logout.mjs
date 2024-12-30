import clearAuthCookies from "../../utils/helperFunctions.mjs";

export const userLogout = async (req, res) => {
    try {
        if (req.logout) {
            await new Promise((resolve, reject) => {
                req.logout((err) => {
                    if (err) reject(err);
                    resolve();
                });
            });
        }

        // Clear authentication cookies using the helper function
        clearAuthCookies(res);

        // Destroy the session
        req.session?.destroy((err) => {
            if (err) {
                console.error('Session destruction error:', err);
            }
        });

        // Send success response or redirect
        res.status(200).json({ message: 'Logged out successfully' });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Failed to logout' });
    }
};

