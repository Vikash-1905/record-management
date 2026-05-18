const mongoose = require("mongoose");

const recordSchema = new mongoose.Schema(
  {
    address: {
      type: String,
      required: true,
    },

    records: [
      {
        name: String,
        rupees: Number,
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Record", recordSchema);
