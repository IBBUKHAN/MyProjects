import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  InitiateAuthCommand,
  GetUserCommand,
  ConfirmSignUpCommand,
  ResendConfirmationCodeCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import crypto from "crypto";

const region = process.env.AWS_REGION || "eu-north-1";
const userPoolId = process.env.COGNITO_USER_POOL_ID!;
const clientId = process.env.COGNITO_CLIENT_ID!;
const clientSecret = process.env.COGNITO_SECRET_ACCESS_KEY;

/**
 * Calculate SECRET_HASH required by Cognito when client secret is configured
 */
function calculateSecretHash(username: string): string {
  if (!clientSecret) {
    throw new Error("COGNITO_SECRET_ACCESS_KEY is not configured");
  }
  const message = username + clientId;
  const hmac = crypto.createHmac("sha256", clientSecret);
  hmac.update(message);
  return hmac.digest("base64");
}

// Initialize Cognito client
const cognitoClient = new CognitoIdentityProviderClient({ region });

export interface CognitoUser {
  username: string;
  email: string;
  name: string;
  sub: string; // Cognito User ID
}

/**
 * Register a new user with AWS Cognito
 */
export async function registerWithCognito(
  email: string,
  password: string,
  name: string
): Promise<{ userId: string; email: string; name: string }> {
  try {
    const secretHash = calculateSecretHash(email);

    const command = new SignUpCommand({
      ClientId: clientId,
      Username: email,
      Password: password,
      SecretHash: secretHash,
      UserAttributes: [
        { Name: "email", Value: email },
        { Name: "name", Value: name },
      ],
    });

    const response = await cognitoClient.send(command);
    const userId = response.UserSub!;

    // Cognito will automatically send verification email
    // User needs to verify before they can login

    return {
      userId,
      email,
      name,
    };
  } catch (error: any) {
    console.error("Cognito registration error:", error);

    if (error.name === "UsernameExistsException") {
      throw new Error("User already exists");
    }
    if (error.name === "InvalidPasswordException") {
      throw new Error("Password does not meet requirements");
    }
    throw new Error(error.message || "Registration failed");
  }
}

/**
 * Confirm user signup with email verification code
 */
export async function confirmSignUp(
  email: string,
  code: string
): Promise<void> {
  try {
    const secretHash = calculateSecretHash(email);

    const command = new ConfirmSignUpCommand({
      ClientId: clientId,
      Username: email,
      ConfirmationCode: code,
      SecretHash: secretHash,
    });

    await cognitoClient.send(command);
    console.log("User confirmed successfully:", email);
  } catch (error: any) {
    console.error("Confirm signup error:", error);

    if (error.name === "CodeMismatchException") {
      throw new Error("Invalid verification code");
    }
    if (error.name === "ExpiredCodeException") {
      throw new Error("Verification code has expired");
    }
    throw new Error(error.message || "Verification failed");
  }
}

/**
 * Resend confirmation code to user's email
 */
export async function resendConfirmationCode(email: string): Promise<void> {
  try {
    const secretHash = calculateSecretHash(email);

    const command = new ResendConfirmationCodeCommand({
      ClientId: clientId,
      Username: email,
      SecretHash: secretHash,
    });

    await cognitoClient.send(command);
    console.log("Confirmation code resent to:", email);
  } catch (error: any) {
    console.error("Resend code error:", error);
    throw new Error(error.message || "Failed to resend code");
  }
}

/**
 * Login user with AWS Cognito
 */
export async function loginWithCognito(
  email: string,
  password: string
): Promise<{ accessToken: string; idToken: string; refreshToken: string }> {
  try {
    const secretHash = calculateSecretHash(email);

    const command = new InitiateAuthCommand({
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: clientId,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
        SECRET_HASH: secretHash,
      },
    });

    const response = await cognitoClient.send(command);

    if (!response.AuthenticationResult) {
      throw new Error("Authentication failed");
    }

    return {
      accessToken: response.AuthenticationResult.AccessToken!,
      idToken: response.AuthenticationResult.IdToken!,
      refreshToken: response.AuthenticationResult.RefreshToken!,
    };
  } catch (error: any) {
    console.error("Cognito login error:", error);

    if (error.name === "NotAuthorizedException") {
      throw new Error("Incorrect email or password");
    }
    if (error.name === "UserNotFoundException") {
      // Re-throw with specific error type so we can handle fallback to DB
      const err: any = new Error("User not found in Cognito");
      err.code = "UserNotFoundException";
      throw err;
    }
    if (error.name === "UserNotConfirmedException") {
      throw new Error(
        "Please verify your email first. Check your inbox for the verification code."
      );
    }
    throw new Error(error.message || "Login failed");
  }
}

/**
 * Verify Cognito access token and get user info
 */
export async function verifyToken(accessToken: string): Promise<CognitoUser> {
  try {
    const command = new GetUserCommand({
      AccessToken: accessToken,
    });

    const response = await cognitoClient.send(command);

    // Extract user attributes
    const attributes = response.UserAttributes || [];
    const email = attributes.find((attr) => attr.Name === "email")?.Value || "";
    const name = attributes.find((attr) => attr.Name === "name")?.Value || "";
    const sub = attributes.find((attr) => attr.Name === "sub")?.Value || "";

    return {
      username: response.Username!,
      email,
      name,
      sub,
    };
  } catch (error: any) {
    console.error("Token verification error:", error);
    throw new Error("Invalid or expired token");
  }
}

/**
 * Decode JWT token to get user ID (without verification)
 * Used for quick user ID extraction
 */
export function decodeToken(token: string): { sub: string } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const payload = JSON.parse(Buffer.from(parts[1], "base64").toString());
    return { sub: payload.sub };
  } catch (error) {
    return null;
  }
}
