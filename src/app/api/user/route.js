
// REFERENCE: This file is provided as a user registration example.
// Students must implement authentication and role-based logic as required in the exam.
import { DB_NAME, ROLES, USER_COLLECTION } from "@/lib/auth";
import corsHeaders from "@/lib/cors";
import { getClientPromise } from "@/lib/mongodb";
import bcrypt from "bcrypt";
import { NextResponse } from "next/server";

export async function OPTIONS(req) {
  return new Response(null, {
    status: 200,
    headers: corsHeaders,
  });
}

export async function  POST (req) {
  let data;
  try {
    data = await req.json();
  } catch {
    return NextResponse.json(
      { message: "Invalid request body" },
      {
        status: 400,
        headers: corsHeaders,
      }
    );
  }

  const username = String(data.username || "").trim();
  const email = String(data.email || "").trim().toLowerCase();
  const password = String(data.password || "");
  const firstname = String(data.firstname || "").trim();
  const lastname = String(data.lastname || "").trim();
  const role = ROLES.USER;

  if (!username || !email || !password) {
    return NextResponse.json(
      {
        message: "Missing mandatory data",
      },
      {
        status: 400,
        headers: corsHeaders,
      }
    );
  }

  try {
    const client = await getClientPromise();
    const db = client.db(DB_NAME);
    const result = await db.collection(USER_COLLECTION).insertOne({
      username: username,
      email: email,
      password: await bcrypt.hash(password, 10),
      firstname: firstname,
      lastname: lastname,
      role,
      status: "ACTIVE",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return NextResponse.json(
      {
        id: result.insertedId.toString(),
      },
      {
        status: 200,
        headers: corsHeaders,
      }
    );
  }
  catch (error) {
    const errorMsg = error.toString();
    let displayErrorMsg = "";
    if (errorMsg.includes("duplicate")) {
      if (errorMsg.includes("username")) {
        displayErrorMsg = "Duplicate Username!!";
      } else if (errorMsg.includes("email")) {
        displayErrorMsg = "Duplicate Email!!";
      }
    }
    return NextResponse.json(
      {
        message: displayErrorMsg || "Unable to create user",
      },
      {
        status: 400,
        headers: corsHeaders,
      }
    );
  }

}
