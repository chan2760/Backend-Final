
// REFERENCE: This file is provided as an example for creating indexes.
// Students must add a similar index for the Book collection as required in the exam.
import {
  BOOK_COLLECTION,
  BOOK_STATUS,
  BORROW_COLLECTION,
  DB_NAME,
  ROLES,
  USER_COLLECTION,
} from "@/lib/auth";
import { getClientPromise } from "@/lib/mongodb";
import bcrypt from "bcrypt";

const REQUIRED_USERS = [
  {
    email: "admin@test.com",
    username: "admin",
    password: "admin123",
    role: ROLES.ADMIN,
  },
  {
    email: "user@test.com",
    username: "user",
    password: "user123",
    role: ROLES.USER,
  },
];

async function ensureRequiredUsers(userCollection) {
  for (const requiredUser of REQUIRED_USERS) {
    const password = await bcrypt.hash(requiredUser.password, 10);
    await userCollection.updateOne(
      { email: requiredUser.email },
      {
        $set: {
          username: requiredUser.username,
          email: requiredUser.email,
          password,
          role: requiredUser.role,
          status: "ACTIVE",
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );
  }
}

export async function ensureIndexes() {
  const client = await getClientPromise();
  const db = client.db(DB_NAME);
  const userCollection = db.collection(USER_COLLECTION);
  const bookCollection = db.collection(BOOK_COLLECTION);
  const borrowCollection = db.collection(BORROW_COLLECTION);

  await userCollection.createIndex({ username: 1 }, { unique: true });
  await userCollection.createIndex({ email: 1 }, { unique: true });

  await bookCollection.createIndex({ title: 1 });
  await bookCollection.createIndex({ author: 1 });
  await bookCollection.createIndex({ status: 1 });

  await borrowCollection.createIndex({ userId: 1 });
  await borrowCollection.createIndex({ requestStatus: 1 });
  await borrowCollection.createIndex({ createdAt: -1 });

  await bookCollection.updateMany(
    { status: { $exists: false } },
    { $set: { status: BOOK_STATUS.ACTIVE } }
  );

  await ensureRequiredUsers(userCollection);
}
