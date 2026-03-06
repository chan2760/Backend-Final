import corsHeaders from "@/lib/cors";
import { ObjectId } from "mongodb";
import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";

export const JWT_SECRET = process.env.JWT_SECRET || "myjwtsecret";

export const DB_NAME = process.env.MONGODB_DB || "wad_final";
export const USER_COLLECTION = process.env.MONGODB_USER_COLLECTION || "users";
export const BOOK_COLLECTION = process.env.MONGODB_BOOK_COLLECTION || "books";
export const BORROW_COLLECTION =
  process.env.MONGODB_BORROW_COLLECTION || "borrow_requests";

export const ROLES = {
  ADMIN: "ADMIN",
  USER: "USER",
};

export const BOOK_STATUS = {
  ACTIVE: "ACTIVE",
  DELETED: "DELETED",
};

export const BORROW_STATUS = {
  INIT: "INIT",
  CLOSE_NO_AVAILABLE_BOOK: "CLOSE-NO-AVAILABLE-BOOK",
  ACCEPTED: "ACCEPTED",
  CANCEL_ADMIN: "CANCEL-ADMIN",
  CANCEL_USER: "CANCEL-USER",
};

function getTokenFromRequest(req) {
  const cookieToken = req.cookies?.get("token")?.value;
  if (cookieToken) {
    return cookieToken;
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return null;
  }

  if (!authHeader.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.slice("Bearer ".length).trim();
}

export function normalizeRole(role) {
  return role === ROLES.ADMIN ? ROLES.ADMIN : ROLES.USER;
}

export function responseJson(payload, init = {}) {
  return NextResponse.json(payload, {
    headers: corsHeaders,
    ...init,
  });
}

export function responseMessage(message, status) {
  return responseJson({ message }, { status });
}

export function unauthorized(message = "Unauthorized") {
  return responseMessage(message, 401);
}

export function forbidden(message = "Forbidden") {
  return responseMessage(message, 403);
}

export function toObjectId(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (!normalized || !ObjectId.isValid(normalized)) {
    return null;
  }

  return new ObjectId(normalized);
}

export function getAuthUser(req) {
  const token = getTokenFromRequest(req);
  if (!token) {
    return null;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return {
      id: String(payload.id),
      email: String(payload.email || ""),
      username: String(payload.username || ""),
      role: normalizeRole(payload.role),
    };
  } catch {
    return null;
  }
}

export function requireAuth(req, allowedRoles = []) {
  const user = getAuthUser(req);

  if (!user) {
    return { error: unauthorized() };
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return { error: forbidden() };
  }

  return { user };
}
