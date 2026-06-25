import { Request, Response, NextFunction } from "express";
import Admin from "../models/Admin";

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, error: "Username and password are required." });
    }

    // Query database for admin user matching credentials
    const adminUser = await Admin.findOne({
      username: username.toLowerCase().trim(),
      password: password
    });

    if (adminUser) {
      return res.json({
        success: true
      });
    }

    return res.status(401).json({
      success: false,
      error: "Invalid credentials."
    });
  } catch (error) {
    next(error);
  }
};
