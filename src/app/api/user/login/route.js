
// REFERENCE: This file is provided as a user login example.
// Students must implement authentication and role-based logic as required in the exam.
import {
  DB_NAME,
  JWT_SECRET,
  USER_COLLECTION,
  normalizeRole,
  responseJson,
  responseMessage,
} from "@/lib/auth";
import corsHeaders from "@/lib/cors";
import { ensureIndexes } from "@/lib/ensureIndexes";
import { getClientPromise } from "@/lib/mongodb";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

export async function OPTIONS(req) {
  return new Response(null, {
    status: 200,
    headers: corsHeaders,
  });
}

export async function POST(req) {
  let data;
  try {
    data = await req.json();
  } catch {
    return responseMessage("Invalid request body", 400);
  }

  const email = String(data.email || "").trim().toLowerCase();
  const password = String(data.password || "");

  if (!email || !password) {
    return responseMessage("Missing email or password", 400);
  }

  try {
    await ensureIndexes();

    const client = await getClientPromise();
    const db = client.db(DB_NAME);
    const user = await db.collection(USER_COLLECTION).findOne({ email });

    if (!user) {
      return responseMessage("Invalid email or password", 401);
    }

    if (user.status === "DELETED") {
      return responseMessage("Invalid email or password", 401);
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return responseMessage("Invalid email or password", 401);
    }

    const role = normalizeRole(user.role);

    // Generate JWT
    const token = jwt.sign(
      {
        id: user._id.toString(),
        email: user.email,
        username: user.username || "",
        role,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Set JWT as HTTP-only cookie
    const response = responseJson(
      {
        message: "Login successful",
        user: {
          id: user._id.toString(),
          email: user.email,
          username: user.username || "",
          role,
        },
      },
      { status: 200 }
    );

    response.cookies.set("token", token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      secure: process.env.NODE_ENV === "production"
    });

    return response;
  } catch {
    return responseMessage("Internal server error", 500);
  }
}
