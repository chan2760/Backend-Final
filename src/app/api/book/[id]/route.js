// TODO: Students must implement CRUD for Book here, similar to Item.
// Example: GET (get book by id), PATCH (update), DELETE (remove)

// import necessary modules and setup as in Item
import {
  BOOK_COLLECTION,
  BOOK_STATUS,
  DB_NAME,
  ROLES,
  requireAuth,
  responseJson,
  responseMessage,
  toObjectId,
} from "@/lib/auth";
import corsHeaders from "@/lib/cors";
import { getClientPromise } from "@/lib/mongodb";

function resolveBookId(params) {
  const rawId = String(params?.id ?? "").trim();
  const normalized = rawId.toLowerCase();

  // MODIFIED: guard placeholder/invalid dynamic route values like [id] or undefined.
  const isPlaceholder =
    !rawId ||
    rawId === "[id]" ||
    rawId === ":id" ||
    normalized === "undefined" ||
    normalized === "null";

  if (isPlaceholder) {
    return { bookId: null, isPlaceholder: true };
  }

  return {
    bookId: toObjectId(rawId),
    isPlaceholder: false,
  };
}

export async function OPTIONS(req) {
  return new Response(null, {
    status: 200,
    headers: corsHeaders,
  });
}

export async function GET(req, { params }) {
  const routeParams = await params;
  const { error } = requireAuth(req, [ROLES.ADMIN, ROLES.USER]);
  if (error) {
    return error;
  }

  const { bookId, isPlaceholder } = resolveBookId(routeParams);
  if (isPlaceholder) {
    return responseJson(
      {
        message: "Replace [id] with a real book id",
        example: "/api/book/PUT_REAL_BOOK_ID_HERE",
      },
      { status: 200 }
    );
  }

  if (!bookId) {
    return responseMessage("Invalid book id", 400);
  }

  try {
    const client = await getClientPromise();
    const db = client.db(DB_NAME);

    const book = await db.collection(BOOK_COLLECTION).findOne({ _id: bookId });
    if (!book) {
      return responseMessage("Book not found", 404);
    }

    // MODIFIED: hide soft-deleted books from detail API for all roles.
    if (book.status === BOOK_STATUS.DELETED) {
      return responseMessage("Book not found", 404);
    }

    return responseJson(
      {
        id: book._id.toString(),
        title: book.title,
        author: book.author,
        quantity: book.quantity,
        location: book.location,
        status: book.status || BOOK_STATUS.ACTIVE,
        createdAt: book.createdAt || null,
        updatedAt: book.updatedAt || null,
      },
      { status: 200 }
    );
  } catch {
    return responseMessage("Internal server error", 500);
  }
}

export async function PATCH(req, { params }) {
  const routeParams = await params;
  const { error } = requireAuth(req, [ROLES.ADMIN]);
  if (error) {
    return error;
  }

  const { bookId, isPlaceholder } = resolveBookId(routeParams);
  if (isPlaceholder) {
    return responseMessage("Replace [id] with a real book id", 400);
  }

  if (!bookId) {
    return responseMessage("Invalid book id", 400);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return responseMessage("Invalid request body", 400);
  }

  const updatePayload = {
    updatedAt: new Date(),
  };

  if (body.title !== undefined) {
    const title = String(body.title).trim();
    if (!title) {
      return responseMessage("Invalid title", 400);
    }
    updatePayload.title = title;
  }

  if (body.author !== undefined) {
    const author = String(body.author).trim();
    if (!author) {
      return responseMessage("Invalid author", 400);
    }
    updatePayload.author = author;
  }

  if (body.location !== undefined) {
    const location = String(body.location).trim();
    if (!location) {
      return responseMessage("Invalid location", 400);
    }
    updatePayload.location = location;
  }

  if (body.quantity !== undefined) {
    const quantity = Number(body.quantity);
    if (!Number.isInteger(quantity) || quantity < 0) {
      return responseMessage("Invalid quantity", 400);
    }
    updatePayload.quantity = quantity;
  }

  if (body.status !== undefined) {
    const status = String(body.status);
    if (![BOOK_STATUS.ACTIVE, BOOK_STATUS.DELETED].includes(status)) {
      return responseMessage("Invalid status", 400);
    }
    updatePayload.status = status;
  }

  if (Object.keys(updatePayload).length === 1) {
    return responseMessage("No valid field to update", 400);
  }

  try {
    const client = await getClientPromise();
    const db = client.db(DB_NAME);

    const result = await db.collection(BOOK_COLLECTION).updateOne(
      { _id: bookId },
      {
        $set: updatePayload,
      }
    );

    if (result.matchedCount === 0) {
      return responseMessage("Book not found", 404);
    }

    const updated = await db.collection(BOOK_COLLECTION).findOne({ _id: bookId });

    return responseJson(
      {
        id: updated._id.toString(),
        title: updated.title,
        author: updated.author,
        quantity: updated.quantity,
        location: updated.location,
        status: updated.status,
        createdAt: updated.createdAt || null,
        updatedAt: updated.updatedAt || null,
      },
      { status: 200 }
    );
  } catch {
    return responseMessage("Internal server error", 500);
  }
}

export async function DELETE(req, { params }) {
  const routeParams = await params;
  const { error } = requireAuth(req, [ROLES.ADMIN]);
  if (error) {
    return error;
  }

  const { bookId, isPlaceholder } = resolveBookId(routeParams);
  if (isPlaceholder) {
    return responseMessage("Replace [id] with a real book id", 400);
  }

  if (!bookId) {
    return responseMessage("Invalid book id", 400);
  }

  try {
    const client = await getClientPromise();
    const db = client.db(DB_NAME);

    const result = await db.collection(BOOK_COLLECTION).updateOne(
      { _id: bookId },
      {
        $set: {
          status: BOOK_STATUS.DELETED,
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return responseMessage("Book not found", 404);
    }

    return responseJson({ message: "Book deleted" }, { status: 200 });
  } catch {
    return responseMessage("Internal server error", 500);
  }
}
