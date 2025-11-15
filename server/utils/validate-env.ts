import { envSchema } from "../schemas/validation";
import { z } from "zod";

/**
 * Validates environment variables on server startup
 * Exits the process if validation fails
 */
export function validateEnv(): void {
  try {
    // Validate environment variables
    envSchema.parse(process.env);

    console.log("✅ Environment variables validated successfully");
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("❌ Environment validation failed:");
      console.error("");

      // Format validation errors
      error.errors.forEach((err) => {
        const field = err.path.join(".");
        console.error(`  • ${field}: ${err.message}`);
      });

      console.error("");
      console.error("Please check your .env file and ensure all required variables are set.");
      console.error("See .env.example for reference.");

      // Exit the process
      process.exit(1);
    } else {
      console.error("❌ Unknown error during environment validation:", error);
      process.exit(1);
    }
  }
}
