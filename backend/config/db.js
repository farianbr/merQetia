const mongoose = require('mongoose');

// Notifications auto-expire via a TTL index on `createdAt`. MongoDB rejects a
// plain options change on an existing index, and Mongoose won't alter one in
// place, so if the live index's TTL differs from the schema we modify it with
// collMod. Once corrected, MongoDB purges anything past the window (~every 60s).
const NOTIFICATION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

const ensureNotificationTTL = async () => {
  try {
    const coll = mongoose.connection.db.collection('notifications');
    const indexes = await coll.indexes();
    const ttlIndex = indexes.find(
      (i) => i.key && i.key.createdAt === 1 && 'expireAfterSeconds' in i,
    );
    // Fresh collection: Mongoose autoIndex creates it from the schema (7 days).
    if (!ttlIndex || ttlIndex.expireAfterSeconds === NOTIFICATION_TTL_SECONDS) return;

    await mongoose.connection.db.command({
      collMod: 'notifications',
      index: { name: ttlIndex.name, expireAfterSeconds: NOTIFICATION_TTL_SECONDS },
    });
    console.log(`Notification TTL updated to ${NOTIFICATION_TTL_SECONDS}s (7 days).`);
  } catch (error) {
    // Non-fatal: don't block startup over index housekeeping.
    console.error(`Failed to reconcile Notification TTL index: ${error.message}`);
  }
};

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB connected: ${conn.connection.host}`);
    await ensureNotificationTTL();
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    process.exit(1); // Exit process on failure
  }
};

module.exports = connectDB;
