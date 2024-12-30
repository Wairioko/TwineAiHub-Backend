# TwineAIHub Backend

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [API Routes](#api-routes)
  - [Assistant Routes](#assistant-routes)
  - [Chat Routes](#chat-routes)
  - [Subscription Routes](#subscription-routes)
  - [Usage Routes](#usage-routes)
  - [Authentication Routes](#authentication-routes)
- [Middleware](#middleware)
- [Utilities](#utilities)
- [Contributing](#contributing)
- [License](#license)

## Overview

**TwineAIHub Backend** is a Node.js application built with Express to handle API requests for the TwineAIHub platform. It manages functionalities like user authentication, chat management, subscription handling, and more.

## Installation

1.  **Clone the repository:**

    ```bash
    git clone [https://github.com/your-repo/twineaihub-backend.git](https://github.com/your-repo/twineaihub-backend.git)
    ```
2.  **Navigate to the project directory:**

    ```bash
    cd twineaihub-backend
    ```
3.  **Install dependencies:**

    ```bash
    npm install
    ```
4.  **Start the server:**

    ```bash
    npm start
    ```

## API Routes

### Assistant Routes

#### Analyze Problem

-   **Endpoint:** `/api/assistant/analyze`
-   **Method:** `POST`
-   **Middleware:** `verifyToken`, `rateLimiter`, `s3Service.upload`, `authCorsMiddleware`
-   **Controller:** `problemController.analyzeProblem`
-   **Description:** Analyzes the provided problem from the uploaded file.

### Chat Routes

#### Solve Problem

-   **Endpoint:** `/api/chat/solve`
-   **Method:** `POST`
-   **Middleware:** `verifyToken`, `authCorsMiddleware`, `s3Service.upload`, `rateLimiter`
-   **Controller:** `handleSolveProblem`
-   **Description:** Solves the uploaded problem.

#### Get Chat Details

-   **Endpoint:** `/api/chat/:chatId`
-   **Method:** `GET`
-   **Middleware:** `verifyToken`, `authCorsMiddleware`
-   **Controller:** `getChatDetails`
-   **Description:** Fetches details of a specific chat by ID.

#### Find All Model Responses

-   **Endpoint:** `/api/chat/find/:id`
-   **Method:** `GET`
-   **Middleware:** `verifyToken`, `authCorsMiddleware`
-   **Controller:** `findAllModelResponses`
-   **Description:** Finds all responses for a specific model.

#### Provide Feedback

-   **Endpoint:** `/api/chat/feedback`
-   **Method:** `POST`
-   **Middleware:** `verifyToken`, `authCorsMiddleware`, `rateLimiter`
-   **Controller:** `RegenerateModelResponse`
-   **Description:** Allows feedback for model responses.

#### Get Chats History

-   **Endpoint:** `/api/user/history`
-   **Method:** `GET`
-   **Middleware:** `verifyToken`, `authCorsMiddleware`
-   **Controller:** `GetChatsHistory`
-   **Description:** Retrieves the user's chat history.

#### Get Chat by Name

-   **Endpoint:** `/api/chat/:chatid/:name`
-   **Method:** `GET`
-   **Middleware:** `verifyToken`, `authCorsMiddleware`, `rateLimiter`
-   **Controller:** `GetChatById`
-   **Description:** Fetches chat data by chat ID and name.

#### Delete Chat

-   **Endpoint:** `/api/chat/:chatid`
-   **Method:** `DELETE`
-   **Middleware:** `verifyToken`, `authCorsMiddleware`
-   **Controller:** `DeleteChat`
-   **Description:** Deletes a chat by its ID.

#### Edit User Message Response

-   **Endpoint:** `/api/chat/edit`
-   **Method:** `PUT`
-   **Middleware:** `verifyToken`, `authCorsMiddleware`, `rateLimiter`
-   **Controller:** `EditUserMessageResponse`
-   **Description:** Edits a user's message response.

### Subscription Routes

#### Webhook

-   **Endpoint:** `/webhook`
-   **Method:** `POST`
-   **Controller:** `SubscriptionController.handleWebhook`
-   **Description:** Handles webhook callbacks.

#### Get Subscription Details

-   **Endpoint:** `/api/subscription/details`
-   **Method:** `GET`
-   **Controller:** `SubscriptionController.getSubscriptionDetails`
-   **Description:** Fetches details of the user's subscription.

#### Cancel Subscription

-   **Endpoint:** `/api/subscription/cancel`
-   **Method:** `POST`
-   **Controller:** `SubscriptionController.cancelSubscription`
-   **Description:** Cancels the user's subscription.

### Usage Routes

#### Token Usage

-   **Endpoint:** `/api/usage`
-   **Method:** `GET`
-   **Middleware:** `verifyToken`
-   **Controller:** `TokenUsage`
-   **Description:** Retrieves token usage details.

### Authentication Routes

#### Login

-   **Endpoint:** `/api/auth/login`
-   **Method:** `POST`
-   **Controller:** `Login`
-   **Description:** Authenticates a user.

#### Signup

-   **Endpoint:** `/api/auth/signup`
-   **Method:** `POST`
-   **Controller:** `UserSignUp`
-   **Description:** Registers a new user.

#### Get User Profile

-   **Endpoint:** `/api/user/profile`
-   **Method:** `GET`
-   **Middleware:** `verifyToken`
-   **Controller:** `GetUserProfile`
-   **Description:** Retrieves the user's profile details.

#### Google Sign-In

-   **Endpoint:** `/auth/google`
-   **Method:** `POST`
-   **Controller:** `googleSignIn`
-   **Description:** Handles Google OAuth login.

#### Logout

-   **Endpoint:** `/auth/logout`
-   **Method:** `GET`
-   **Controller:** `userLogout`
-   **Description:** Logs out the user.

#### Token Refresh

-   **Endpoint:** `/auth/refresh-token`
-   **Method:** `POST`
-   **Controller:** `tokenRefresh`
-   **Description:** Refreshes the authentication token.

#### Check Auth Status

-   **Endpoint:** `/auth/status`
-   **Method:** `GET`
-   **Middleware:** `authCorsMiddleware`
-   **Controller:** `checkAuth`
-   **Description:** Verifies the user's authentication status.

## Middleware

-   **Verify Token:** Ensures the request is authenticated by validating the token.
-   **Rate Limiter:** Prevents abuse by limiting the rate of requests.
-   **CORS Middleware:** Handles CORS policy to allow requests from specific origins.

## Utilities

-   **S3 Service:** Manages file uploads to AWS S3.

## .env File Configuration

You will need to create a `.env` file in the root of your project directory to store sensitive configuration details. Here's a list of the required environment variables:

JWT_SECRET=
OPENAI_API_KEY=
Google_Gemini_KEY=
Claude_Key=
MONGODB_URL=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
REDIS_URL=
REDIS_PASSWORD=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
AWS_BUCKET_NAME=
REFRESH_TOKEN_SECRET=
ALLOW_ANONYMOUS=true
NODE_ENV=production
CLIENT_URL=
COOKIE_DOMAIN=
PADDLE_PUBLIC_KEY=
GOOGLE_CALLBACK_URL=
COGNITO_AWS_REGION=
COGNITO_CLIENT_ID=
COGNITO_USER_POOL_ID=
COGNITO_DOMAIN=


**Important:**

-   Replace the `=` with your actual keys and credentials for each service.
-   Do not commit your `.env` file to version control (add it to your `.gitignore`).
-   These variables are essential for the application to function correctly, as they handle authentication, database connections, API keys, and other critical configurations.
-   **ALLOW_ANONYMOUS** can be `true` or `false` based on your anonymous access logic.
-   **NODE_ENV** can be set to `development`, `production`, or `test`.
-   **CLIENT_URL** will be your front-end URL.

**Optional:**
You can have comments in your `.env` file too.



## Contributing

If you wish to contribute, please fork the repository and create a pull request with your changes.

## License

This project is licensed under the **MIT License**.

