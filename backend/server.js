const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const User = require("./models/User");
const Expense = require("./models/Expense");

const app = express();

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const PORT = process.env.PORT || 5000;
const allowedOrigins = (process.env.CLIENT_ORIGINS || process.env.FRONTEND_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors(
    allowedOrigins.length
      ? {
          origin(origin, callback) {
            if (!origin || allowedOrigins.includes(origin)) {
              callback(null, true);
              return;
            }

            callback(new Error("Not allowed by CORS"));
          },
          credentials: true,
        }
      : undefined
  )
);
app.use(express.json());

if (!process.env.MONGO_URI) {
  console.error("MONGO_URI is missing. Add it to your environment variables.");
} else {
  mongoose
    .connect(process.env.MONGO_URI)
    .then(() => console.log("MongoDB Connected"))
    .catch((err) => console.log(err));
}

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// CREATE
app.post("/api/users", async (req, res) => {
  try {
    const newUser = new User(req.body);
    const savedUser = await newUser.save();
    res.json(savedUser);
  } catch (error) {
    res.status(500).json(error);
  }
});


// READ with Search, Filters, and Pagination
app.get("/api/users", async (req, res) => {
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
    res.status(500).json(error);
  }
});

// UPDATE
app.put("/api/users/:id", async (req, res) => {
  try {
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    res.json(updatedUser);
  } catch (error) {
    res.status(500).json(error);
  }
});

// DELETE
app.delete("/api/users/:id", async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);

    res.json({
      message: "Data deleted successfully",
    });
  } catch (error) {
    res.status(500).json(error);
  }
});

// ======= EXPENSE APIS =======

// CREATE EXPENSE
app.post("/api/expenses", async (req, res) => {
  try {
    const expense = new Expense(req.body);
    const savedExpense = await expense.save();
    res.json(savedExpense);
  } catch (error) {
    res.status(500).json(error);
  }
});

// GET ALL EXPENSES
app.get("/api/expenses", async (req, res) => {
  try {
    const expenses = await Expense.find().sort({ createdAt: -1 });
    res.json(expenses);
  } catch (error) {
    res.status(500).json(error);
  }
});

// UPDATE EXPENSE
app.put("/api/expenses/:id", async (req, res) => {
  try {
    const updatedExpense = await Expense.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(updatedExpense);
  } catch (error) {
    res.status(500).json(error);
  }
});

// DELETE EXPENSE
app.delete("/api/expenses/:id", async (req, res) => {
  try {
    await Expense.findByIdAndDelete(req.params.id);
    res.json({
      message: "Expense deleted successfully",
    });
  } catch (error) {
    res.status(500).json(error);
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
