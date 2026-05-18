const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const User = require("./models/User");
const Expense = require("./models/Expense");
const Record = require("./models/Record");

const app = express();

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const PORT = process.env.PORT || 5000;
const dbStateName = (state) =>
  ({
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
  }[state] || "unknown");

const getDatabaseStatus = () => ({
  state: mongoose.connection.readyState,
  status: dbStateName(mongoose.connection.readyState),
});

const requireDatabase = (req, res, next) => {
  if (mongoose.connection.readyState === 1) {
    next();
    return;
  }

  res.status(503).json({
    message:
      "Database is not connected. Check MONGO_URI in Render and MongoDB Atlas Network Access.",
    database: getDatabaseStatus(),
  });
};

const sendError = (res, error, fallbackMessage = "Server error") => {
  console.error(fallbackMessage, error);

  if (error.name === "ValidationError") {
    res.status(400).json({
      message: "Please check the form fields and try again.",
      error: error.message,
    });
    return;
  }

  if (error.name === "CastError") {
    res.status(400).json({
      message: "Invalid data format.",
      error: error.message,
    });
    return;
  }

  res.status(500).json({
    message: fallbackMessage,
    error: error.message,
  });
};

const normalizeAmount = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
};

const normalizeRequiredString = (value) => String(value ?? "").trim();
const normalizeOrigin = (origin) => {
  if (!origin || origin === "*") {
    return origin;
  }

  try {
    return new URL(origin).origin;
  } catch {
    return origin.replace(/\/+$/, "");
  }
};

const allowedOrigins = new Set(
  (process.env.CLIENT_ORIGINS || process.env.FRONTEND_URL || "")
    .split(/[,\s]+/)
    .map((origin) => normalizeOrigin(origin.trim()))
    .filter(Boolean)
);

const isAllowedOrigin = (origin) => {
  if (!origin || allowedOrigins.size === 0 || allowedOrigins.has("*")) {
    return true;
  }

  const normalizedOrigin = normalizeOrigin(origin);

  if (allowedOrigins.has(normalizedOrigin)) {
    return true;
  }

  try {
    const { hostname, protocol } = new URL(normalizedOrigin);
    const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
    const isVercelApp =
      process.env.ALLOW_VERCEL_PREVIEWS !== "false" &&
      protocol === "https:" &&
      hostname.endsWith(".vercel.app");

    return isLocalhost || isVercelApp;
  } catch {
    return false;
  }
};

const allowedOriginsForLog = [...allowedOrigins].join(", ") || "all origins";

console.log(`CORS allowed origins: ${allowedOriginsForLog}`);

const corsOptions = {
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }

    console.warn(
      `Blocked by CORS: ${origin}. Add this exact frontend origin to CLIENT_ORIGINS in Render.`
    );
    callback(null, false);
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

if (!process.env.MONGO_URI) {
  console.error("MONGO_URI is missing. Add it to your environment variables.");
} else {
  mongoose
    .connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
    })
    .then(() => console.log("MongoDB Connected"))
    .catch((err) => console.error("MongoDB connection error:", err));
}

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    database: getDatabaseStatus(),
  });
});

// CREATE
app.post("/api/users", requireDatabase, async (req, res) => {
  try {
    const name = normalizeRequiredString(req.body.name);
    const address = normalizeRequiredString(req.body.address);
    const rupees = normalizeAmount(req.body.rupees);

    if (!name || !address || rupees === null) {
      res.status(400).json({
        message: "Name, address, and a valid amount are required.",
      });
      return;
    }

    const newUser = new User({ name, address, rupees });
    const savedUser = await newUser.save();
    res.json(savedUser);
  } catch (error) {
    sendError(res, error, "Error saving record");
  }
});


// READ with Search, Filters, and Pagination
app.get("/api/users", requireDatabase, async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 5;
    const search = (req.query.search || "").trim();
    const filter = req.query.filter || "latest";
    const date = req.query.date;
    const minAmount = req.query.minAmount;
    const maxAmount = req.query.maxAmount;

    const skip = (page - 1) * limit;

    const query = {};

    if (search) {
      const numericSearch = Number(search);
      const searchConditions = [
        { name: { $regex: escapeRegex(search), $options: "i" } },
        { address: { $regex: escapeRegex(search), $options: "i" } },
      ];

      if (!Number.isNaN(numericSearch)) {
        searchConditions.push({ rupees: numericSearch });
      }

      query.$or = searchConditions;
    }

    if (date) {
      const selectedDate = new Date(date);
      selectedDate.setHours(0, 0, 0, 0);
      const nextDay = new Date(selectedDate);
      nextDay.setDate(nextDay.getDate() + 1);

      query.createdAt = {
        $gte: selectedDate,
        $lt: nextDay,
      };
    }

    if (minAmount || maxAmount) {
      query.rupees = {};

      if (minAmount) {
        query.rupees.$gte = Number(minAmount);
      }

      if (maxAmount) {
        query.rupees.$lte = Number(maxAmount);
      }
    }

    const sortOptions = {
      latest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      high: { rupees: -1 },
      low: { rupees: 1 },
    };

    const users = await User.find(query)
      .sort(sortOptions[filter] || { createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await User.countDocuments(query);
    const totalAmountResult = await User.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$rupees" },
        },
      },
    ]);

    res.json({
      users,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      totalRecords: total,
      totalAmount: totalAmountResult[0]?.totalAmount || 0,
    });
  } catch (error) {
    sendError(res, error, "Error fetching records");
  }
});

// UPDATE
app.put("/api/users/:id", requireDatabase, async (req, res) => {
  try {
    const name = normalizeRequiredString(req.body.name);
    const address = normalizeRequiredString(req.body.address);
    const rupees = normalizeAmount(req.body.rupees);

    if (!name || !address || rupees === null) {
      res.status(400).json({
        message: "Name, address, and a valid amount are required.",
      });
      return;
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { name, address, rupees },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      res.status(404).json({ message: "Record not found." });
      return;
    }

    res.json(updatedUser);
  } catch (error) {
    sendError(res, error, "Error updating record");
  }
});

// DELETE
app.delete("/api/users/:id", requireDatabase, async (req, res) => {
  try {
    const deletedUser = await User.findByIdAndDelete(req.params.id);

    if (!deletedUser) {
      res.status(404).json({ message: "Record not found." });
      return;
    }

    res.json({
      message: "Data deleted successfully",
    });
  } catch (error) {
    sendError(res, error, "Error deleting record");
  }
});

// ======= RECORD APIS (Grouped Records with Heading) =======

// CREATE RECORD (with multiple entries)
app.post("/api/records", requireDatabase, async (req, res) => {
  try {
    const address = normalizeRequiredString(req.body.address);
    const records = req.body.records || [];

    if (!address || records.length === 0) {
      res.status(400).json({
        message: "Address and at least one record are required.",
      });
      return;
    }

    // Validate each record
    const validRecords = records.map((record) => ({
      name: normalizeRequiredString(record.name),
      rupees: normalizeAmount(record.rupees),
    }));

    // Check if all records have required fields
    const hasInvalidRecords = validRecords.some(
      (r) => !r.name || r.rupees === null
    );

    if (hasInvalidRecords) {
      res.status(400).json({
        message: "All records must have name and valid amount.",
      });
      return;
    }

    const newRecord = new Record({ address, records: validRecords });
    const savedRecord = await newRecord.save();
    res.json(savedRecord);
  } catch (error) {
    sendError(res, error, "Error saving record");
  }
});

// READ RECORDS with Search, Filters, and Pagination
app.get("/api/records", requireDatabase, async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 5;
    const search = (req.query.search || "").trim();
    const filter = req.query.filter || "latest";
    const date = req.query.date;
    const minAmount = req.query.minAmount;
    const maxAmount = req.query.maxAmount;

    const skip = (page - 1) * limit;

    const query = {};

    if (search) {
      const numericSearch = Number(search);
      const searchConditions = [
        { address: { $regex: escapeRegex(search), $options: "i" } },
        { "records.name": { $regex: escapeRegex(search), $options: "i" } },
      ];

      if (!Number.isNaN(numericSearch)) {
        searchConditions.push({ "records.rupees": numericSearch });
      }

      query.$or = searchConditions;
    }

    if (date) {
      const selectedDate = new Date(date);
      selectedDate.setHours(0, 0, 0, 0);
      const nextDay = new Date(selectedDate);
      nextDay.setDate(nextDay.getDate() + 1);

      query.createdAt = {
        $gte: selectedDate,
        $lt: nextDay,
      };
    }

    const sortOptions = {
      latest: { createdAt: -1 },
      oldest: { createdAt: 1 },
    };

    const recordsList = await Record.find(query)
      .sort(sortOptions[filter] || { createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Record.countDocuments(query);

    // Calculate total amount considering amount filters
    let totalAmount = 0;
    if (minAmount || maxAmount) {
      const aggregateQuery = [{ $match: query }];

      if (minAmount || maxAmount) {
        aggregateQuery.push({
          $addFields: {
            totalPerRecord: {
              $sum: "$records.rupees",
            },
          },
        });
      }

      const result = await Record.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            totalAmount: {
              $sum: {
                $sum: "$records.rupees",
              },
            },
          },
        },
      ]);

      totalAmount = result[0]?.totalAmount || 0;

      // Apply min/max filters to results
      if (minAmount || maxAmount) {
        const min = minAmount ? Number(minAmount) : 0;
        const max = maxAmount ? Number(maxAmount) : Infinity;

        recordsList.forEach((record) => {
          record.records = record.records.filter(
            (r) => r.rupees >= min && r.rupees <= max
          );
        });

        total = recordsList.filter((r) => r.records.length > 0).length;
      }
    } else {
      const result = await Record.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            totalAmount: {
              $sum: {
                $sum: "$records.rupees",
              },
            },
          },
        },
      ]);

      totalAmount = result[0]?.totalAmount || 0;
    }

    res.json({
      records: recordsList,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      totalRecords: total,
      totalAmount,
    });
  } catch (error) {
    sendError(res, error, "Error fetching records");
  }
});

// UPDATE RECORD
app.put("/api/records/:id", requireDatabase, async (req, res) => {
  try {
    const address = normalizeRequiredString(req.body.address);
    const records = req.body.records || [];

    if (!address || records.length === 0) {
      res.status(400).json({
        message: "Address and at least one record are required.",
      });
      return;
    }

    // Validate each record
    const validRecords = records.map((record) => ({
      name: normalizeRequiredString(record.name),
      rupees: normalizeAmount(record.rupees),
    }));

    // Check if all records have required fields
    const hasInvalidRecords = validRecords.some(
      (r) => !r.name || r.rupees === null
    );

    if (hasInvalidRecords) {
      res.status(400).json({
        message: "All records must have name and valid amount.",
      });
      return;
    }

    const updatedRecord = await Record.findByIdAndUpdate(
      req.params.id,
      { address, records: validRecords },
      { new: true, runValidators: true }
    );

    if (!updatedRecord) {
      res.status(404).json({ message: "Record not found." });
      return;
    }

    res.json(updatedRecord);
  } catch (error) {
    sendError(res, error, "Error updating record");
  }
});

// DELETE RECORD
app.delete("/api/records/:id", requireDatabase, async (req, res) => {
  try {
    const deletedRecord = await Record.findByIdAndDelete(req.params.id);

    if (!deletedRecord) {
      res.status(404).json({ message: "Record not found." });
      return;
    }

    res.json({
      message: "Record deleted successfully",
    });
  } catch (error) {
    sendError(res, error, "Error deleting record");
  }
});

// ======= EXPENSE APIS =======

// CREATE EXPENSE
app.post("/api/expenses", requireDatabase, async (req, res) => {
  try {
    const title = normalizeRequiredString(req.body.title);
    const category = normalizeRequiredString(req.body.category);
    const amount = normalizeAmount(req.body.amount);

    if (!title || !category || amount === null) {
      res.status(400).json({
        message: "Title, category, and a valid amount are required.",
      });
      return;
    }

    const expense = new Expense({ title, amount, category });
    const savedExpense = await expense.save();
    res.json(savedExpense);
  } catch (error) {
    sendError(res, error, "Error saving expense");
  }
});

// GET ALL EXPENSES
app.get("/api/expenses", requireDatabase, async (req, res) => {
  try {
    const expenses = await Expense.find().sort({ createdAt: -1 });
    res.json(expenses);
  } catch (error) {
    sendError(res, error, "Error fetching expenses");
  }
});

// UPDATE EXPENSE
app.put("/api/expenses/:id", requireDatabase, async (req, res) => {
  try {
    const title = normalizeRequiredString(req.body.title);
    const category = normalizeRequiredString(req.body.category);
    const amount = normalizeAmount(req.body.amount);

    if (!title || !category || amount === null) {
      res.status(400).json({
        message: "Title, category, and a valid amount are required.",
      });
      return;
    }

    const updatedExpense = await Expense.findByIdAndUpdate(
      req.params.id,
      { title, amount, category },
      { new: true, runValidators: true }
    );

    if (!updatedExpense) {
      res.status(404).json({ message: "Expense not found." });
      return;
    }

    res.json(updatedExpense);
  } catch (error) {
    sendError(res, error, "Error updating expense");
  }
});

// DELETE EXPENSE
app.delete("/api/expenses/:id", requireDatabase, async (req, res) => {
  try {
    const deletedExpense = await Expense.findByIdAndDelete(req.params.id);

    if (!deletedExpense) {
      res.status(404).json({ message: "Expense not found." });
      return;
    }

    res.json({
      message: "Expense deleted successfully",
    });
  } catch (error) {
    sendError(res, error, "Error deleting expense");
  }
});

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = { app, server };
