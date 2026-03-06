import {
  BOOK_COLLECTION,
  BOOK_STATUS,
  BORROW_COLLECTION,
  BORROW_STATUS,
  DB_NAME,
  ROLES,
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

export async function GET(req) {
  const { user, error } = requireAuth(req, [ROLES.ADMIN, ROLES.USER]);
  if (error) {
    return error;
  }

  try {
    const client = await getClientPromise();
    const db = client.db(DB_NAME);
    const borrowCollection = db.collection(BORROW_COLLECTION);

    const { searchParams } = new URL(req.url);
    const status = String(searchParams.get("status") || "").trim();

    const query = {};
    if (user.role === ROLES.USER) {
      query.userId = user.id;
    }

    if (status) {
      query.requestStatus = status;
    }

    const requests = await borrowCollection
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    const bookIds = [
      ...new Set(
        requests
          .map((item) => item.bookId)
          .filter(Boolean)
          .map((item) => String(item))
      ),
    ];

    const booksById = new Map();
    if (bookIds.length > 0) {
      const mongoBookIds = bookIds.map((id) => toObjectId(id)).filter(Boolean);
      if (mongoBookIds.length > 0) {
        const books = await db
          .collection(BOOK_COLLECTION)
          .find({ _id: { $in: mongoBookIds } })
          .toArray();

        for (const book of books) {
          booksById.set(book._id.toString(), {
            id: book._id.toString(),
            title: book.title,
            author: book.author,
            location: book.location,
            quantity: book.quantity,
            status: book.status || BOOK_STATUS.ACTIVE,
          });
        }
      }
    }

    const mappedRequests = requests.map((item) => ({
      id: item._id.toString(),
      userId: item.userId,
      bookId: item.bookId || null,
      createdAt: item.createdAt || null,
      targetDate: item.targetDate || null,
      requestStatus: item.requestStatus,
      updatedAt: item.updatedAt || null,
      book: item.bookId ? booksById.get(String(item.bookId)) || null : null,
    }));

    // MODIFIED: hide borrow records linked to deleted books for all roles.
    const visibleRequests = mappedRequests.filter(
      (item) => item.book?.status !== BOOK_STATUS.DELETED
    );

    return responseJson(
      {
        requests: visibleRequests,
      },
      { status: 200 }
    );
  } catch {
    return responseMessage("Internal server error", 500);
  }
}

export async function POST(req) {
  const { user, error } = requireAuth(req, [ROLES.USER]);
  if (error) {
    return error;
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return responseMessage("Invalid request body", 400);
  }

  const bookId = String(body.bookId || "").trim();
  const targetDate = String(body.targetDate || "").trim();

  if (!bookId || !targetDate) {
    return responseMessage("bookId and targetDate are required", 400);
  }

  const parsedTargetDate = new Date(targetDate);
  if (Number.isNaN(parsedTargetDate.getTime())) {
    return responseMessage("Invalid targetDate", 400);
  }

  try {
    const client = await getClientPromise();
    const db = client.db(DB_NAME);
    const borrowCollection = db.collection(BORROW_COLLECTION);
    const bookCollection = db.collection(BOOK_COLLECTION);

    let requestStatus = BORROW_STATUS.INIT;
    const bookObjectId = toObjectId(bookId);
    const book = bookObjectId
      ? await bookCollection.findOne({ _id: bookObjectId })
      : null;

    if (
      !book ||
      book.status === BOOK_STATUS.DELETED ||
      !Number.isInteger(book.quantity) ||
      book.quantity <= 0
    ) {
      requestStatus = BORROW_STATUS.CLOSE_NO_AVAILABLE_BOOK;
    }

    const now = new Date();
    const insertResult = await borrowCollection.insertOne({
      userId: user.id,
      bookId,
      createdAt: now,
      targetDate: parsedTargetDate,
      requestStatus,
      updatedAt: now,
    });

    return responseJson(
      {
        id: insertResult.insertedId.toString(),
        requestStatus,
      },
      { status: 201 }
    );
  } catch {
    return responseMessage("Internal server error", 500);
  }
}

export async function PATCH(req) {
  const { user, error } = requireAuth(req, [ROLES.ADMIN, ROLES.USER]);
  if (error) {
    return error;
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return responseMessage("Invalid request body", 400);
  }

  const requestId = String(body.requestId || "").trim();
  const nextStatus = String(body.status || "").trim();

  if (!requestId || !nextStatus) {
    return responseMessage("requestId and status are required", 400);
  }

  const allowedStatuses = [
    BORROW_STATUS.INIT,
    BORROW_STATUS.CLOSE_NO_AVAILABLE_BOOK,
    BORROW_STATUS.ACCEPTED,
    BORROW_STATUS.CANCEL_ADMIN,
    BORROW_STATUS.CANCEL_USER,
  ];

  if (!allowedStatuses.includes(nextStatus)) {
    return responseMessage("Invalid status", 400);
  }

  const requestObjectId = toObjectId(requestId);
  if (!requestObjectId) {
    return responseMessage("Invalid request id", 400);
  }

  try {
    const client = await getClientPromise();
    const db = client.db(DB_NAME);
    const borrowCollection = db.collection(BORROW_COLLECTION);
    const bookCollection = db.collection(BOOK_COLLECTION);

    const existing = await borrowCollection.findOne({ _id: requestObjectId });
    if (!existing) {
      return responseMessage("Borrow request not found", 404);
    }

    if (user.role === ROLES.USER) {
      if (existing.userId !== user.id) {
        return responseMessage("Forbidden", 403);
      }
      if (nextStatus !== BORROW_STATUS.CANCEL_USER) {
        return responseMessage("Forbidden", 403);
      }
      if (
        ![BORROW_STATUS.INIT, BORROW_STATUS.ACCEPTED].includes(
          existing.requestStatus
        )
      ) {
        return responseMessage("Request cannot be canceled by user", 400);
      }
    }

    if (user.role === ROLES.ADMIN) {
      if (
        ![
          BORROW_STATUS.ACCEPTED,
          BORROW_STATUS.CLOSE_NO_AVAILABLE_BOOK,
          BORROW_STATUS.CANCEL_ADMIN,
        ].includes(nextStatus)
      ) {
        return responseMessage("Forbidden", 403);
      }
    }

    const terminalStatuses = [
      BORROW_STATUS.CANCEL_ADMIN,
      BORROW_STATUS.CANCEL_USER,
    ];

    if (
      terminalStatuses.includes(existing.requestStatus) &&
      existing.requestStatus !== nextStatus
    ) {
      return responseMessage("Request status is already final", 400);
    }

    let resolvedStatus = nextStatus;

    if (
      existing.requestStatus !== BORROW_STATUS.ACCEPTED &&
      nextStatus === BORROW_STATUS.ACCEPTED
    ) {
      const bookObjectId = toObjectId(existing.bookId);
      if (!bookObjectId) {
        resolvedStatus = BORROW_STATUS.CLOSE_NO_AVAILABLE_BOOK;
      } else {
        const decrement = await bookCollection.updateOne(
          {
            _id: bookObjectId,
            status: { $ne: BOOK_STATUS.DELETED },
            quantity: { $gt: 0 },
          },
          {
            $inc: { quantity: -1 },
            $set: { updatedAt: new Date() },
          }
        );

        if (decrement.modifiedCount === 0) {
          resolvedStatus = BORROW_STATUS.CLOSE_NO_AVAILABLE_BOOK;
        }
      }
    }

    if (
      existing.requestStatus === BORROW_STATUS.ACCEPTED &&
      [BORROW_STATUS.CANCEL_ADMIN, BORROW_STATUS.CANCEL_USER].includes(
        resolvedStatus
      )
    ) {
      const bookObjectId = toObjectId(existing.bookId);
      if (bookObjectId) {
        await bookCollection.updateOne(
          { _id: bookObjectId },
          {
            $inc: { quantity: 1 },
            $set: { updatedAt: new Date() },
          }
        );
      }
    }

    await borrowCollection.updateOne(
      { _id: requestObjectId },
      {
        $set: {
          requestStatus: resolvedStatus,
          updatedAt: new Date(),
        },
      }
    );

    const updated = await borrowCollection.findOne({ _id: requestObjectId });

    return responseJson(
      {
        id: updated._id.toString(),
        requestStatus: updated.requestStatus,
        userId: updated.userId,
        bookId: updated.bookId || null,
        createdAt: updated.createdAt || null,
        targetDate: updated.targetDate || null,
        updatedAt: updated.updatedAt || null,
      },
      { status: 200 }
    );
  } catch {
    return responseMessage("Internal server error", 500);
  }
}
