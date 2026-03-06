// REFERENCE: This file is provided as a user registration example.
// Students must implement authentication and role-based logic as required in the exam.
import {
  DB_NAME,
  USER_COLLECTION,
  normalizeRole,
  requireAuth,
  responseJson,
  responseMessage,
  toObjectId,
} from "@/lib/auth";
import corsHeaders from "@/lib/cors";
import { getClientPromise } from "@/lib/mongodb";

export async function OPTIONS(req) {
  return new Response(null, {
    status: 200,
    headers: corsHeaders,
  });
}

export async function GET (req) {
  const { user, error } = requireAuth(req);
  if (error) {
    return error;
  }

  try {
    const client = await getClientPromise();
    const db = client.db(DB_NAME);
    const userId = toObjectId(user.id);
    if (!userId) {
      return responseMessage("Unauthorized", 401);
    }

    const profile = await db.collection(USER_COLLECTION).findOne(
      { _id: userId },
      {
        projection: {
          password: 0,
        },
      }
    );

    if (!profile) {
      return responseMessage("Unauthorized", 401);
    }

    return responseJson(
      {
        id: profile._id.toString(),
        username: profile.username || "",
        email: profile.email,
        firstname: profile.firstname || "",
        lastname: profile.lastname || "",
        role: normalizeRole(profile.role),
      },
      { status: 200 }
    );
  }
  catch {
    return responseMessage("Internal server error", 500);
  }
}
