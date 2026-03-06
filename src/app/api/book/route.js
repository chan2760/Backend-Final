// TODO: Students must implement CRUD for Book here, similar to Item.
// Example: GET (list all books), POST (create book)

// import necessary modules and setup as in Item
import {
  BOOK_COLLECTION,
  BOOK_STATUS,
  DB_NAME,
  ROLES,
  requireAuth,
  responseJson,
  responseMessage,
} from "@/lib/auth";
import corsHeaders from "@/lib/cors";
import { getClientPromise } from "@/lib/mongodb";

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function OPTIONS(req) {
  return new Response(null, {
    status: 200,
    headers: corsHeaders,
  });
}

export async function GET(req) {
  const { user, error } = requireAuth(req, [ROLES.ADMIN, ROLES.USER]);
  if (error) {
    return error;
  }

  try {
    const client = await getClientPromise();
    const db = client.db(DB_NAME);

    const { searchParams } = new URL(req.url);
    const title = String(searchParams.get("title") || "").trim();
    const author = String(searchParams.get("author") || "").trim();
    const includeDeleted = searchParams.get("includeDeleted") === "true";

    const query = {};

    if (title) {
      query.title = { $regex: escapeRegex(title), $options: "i" };
    }

    if (author) {
      query.author = { $regex: escapeRegex(author), $options: "i" };
    }

    if (user.role !== ROLES.ADMIN || !includeDeleted) {
      query.status = BOOK_STATUS.ACTIVE;
    }

    const books = await db
      .collection(BOOK_COLLECTION)
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    return responseJson(
      {
        books: books.map((book) => ({
          id: book._id.toString(),
          title: book.title,
          author: book.author,
          quantity: book.quantity,
          location: book.location,
          status: book.status || BOOK_STATUS.ACTIVE,
          createdAt: book.createdAt || null,
          updatedAt: book.updatedAt || null,
        })),
      },
      { status: 200 }
    );
  } catch {
    return responseMessage("Internal server error", 500);
  }
}

export async function POST(req) {
  const { error } = requireAuth(req, [ROLES.ADMIN]);
  if (error) {
    return error;
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return responseMessage("Invalid request body", 400);
  }

  const title = String(body.title || "").trim();
  const author = String(body.author || "").trim();
  const location = String(body.location || "").trim();
  const quantity = Number(body.quantity);

  if (!title || !author || !location || !Number.isInteger(quantity) || quantity < 0) {
    return responseMessage("Invalid book payload", 400);
  }

  try {
    const client = await getClientPromise();
    const db = client.db(DB_NAME);

    const now = new Date();
    const insertResult = await db.collection(BOOK_COLLECTION).insertOne({
      title,
      author,
      quantity,
      location,
      status: BOOK_STATUS.ACTIVE,
      createdAt: now,
      updatedAt: now,
    });

    return responseJson(
      {
        id: insertResult.insertedId.toString(),
        message: "Book created",
      },
      { status: 201 }
    );
  } catch {
    return responseMessage("Internal server error", 500);
  }
}
