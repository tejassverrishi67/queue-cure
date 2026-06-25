import { Request, Response, NextFunction } from "express";

export interface CustomError extends Error {
  status?: number;
  code?: number;
}

export const errorHandler = (
  err: CustomError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void => {
  // Log full error details server-side
  if (process.env.NODE_ENV !== "production") {
    console.error("[ErrorHandler] Unhandled error:", err);
  } else {
    console.error("[ErrorHandler]", err.message);
  }

  // Handle MongoDB duplicate key errors
  if (err.code === 11000) {
    res.status(409).json({
      success: false,
      error: "A duplicate record already exists."
    });
    return;
  }

  // Handle Mongoose validation errors
  if (err.name === "ValidationError") {
    res.status(400).json({
      success: false,
      error: err.message
    });
    return;
  }

  const status = err.status || 500;
  const message = process.env.NODE_ENV === "production"
    ? "Internal Server Error"
    : err.message || "Internal Server Error";

  res.status(status).json({
    success: false,
    error: message
  });
};
