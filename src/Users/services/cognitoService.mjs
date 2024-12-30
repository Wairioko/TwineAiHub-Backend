import { OAuth2Client } from 'google-auth-library';
import AmazonCognitoIdentity from 'amazon-cognito-identity-js';


const poolData = {
    UserPoolId: process.env.COGNITO_USER_POOL_ID,
    ClientId: process.env.COGNITO_CLIENT_ID,
};
const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);

// Sign up user with email and password
export const signUpWithEmail = (email, password) => {
    return new Promise((resolve, reject) => {
        const emailAttribute = new AmazonCognitoIdentity.CognitoUserAttribute({
            Name: 'email',
            Value: email,
        });

        userPool.signUp(email, password, [emailAttribute], null, (err, result) => {
            if (err) return reject(err);
            resolve(result.user);
        });
    });
};

// Login user with email and password
export const loginWithEmail = (email, password) => {
    return new Promise((resolve, reject) => {
        const authDetails = new AmazonCognitoIdentity.AuthenticationDetails({
            Username: email,
            Password: password,
        });

        const userData = { Username: email, Pool: userPool };
        const cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);

        cognitoUser.authenticateUser(authDetails, {
            onSuccess: (result) => {
                resolve(result.getIdToken().getJwtToken());
            },
            onFailure: (err) => {
                reject(err);
            },
        });
    });
};

// Login with Google OAuth token
export const loginWithGoogle = async (tokenId) => {
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

    try {
        const ticket = await client.verifyIdToken({
            idToken: tokenId,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        const email = payload.email;

        // Optionally, check if the email exists in your Cognito user pool.
        return email; // Replace with Cognito token creation for returning users.
    } catch (error) {
        throw new Error('Invalid Google token');
    }
};
