import { useState, useEffect } from "react";
import axios from "axios";
import { FaPlus, FaTrash, FaEdit } from "react-icons/fa";

function DailyExpenses() {
  const [expense, setExpense] = useState({
    title: "",
    amount: "",
    category: "",
  });

  const [customCategory, setCustomCategory] = useState("");
  const [expenses, setExpenses] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [totalExpense, setTotalExpense] = useState(0);

  const API = import.meta.env.VITE_API_URL;
  const EXPENSE_API = API.replace("/api/users", "/api/expenses");

  // Fetch expenses
  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const res = await axios.get(EXPENSE_API);
      setExpenses(res.data);
      
      // Calculate total
      const total = res.data.reduce((sum, exp) => sum + Number(exp.amount), 0);
      setTotalExpense(total);
    } catch (error) {
      console.error("Error fetching expenses:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  // Add or Update
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!expense.title || !expense.amount || !expense.category) {
      alert("Please fill all fields");
      return;
    }

    if (expense.category === "Other" && !customCategory.trim()) {
      alert("Please enter a custom category");
      return;
    }

    try {
      setLoading(true);

      const finalCategory = expense.category === "Other" ? customCategory : expense.category;
      const expenseData = { ...expense, category: finalCategory };

      if (editingId) {
        await axios.put(`${EXPENSE_API}/${editingId}`, expenseData);
        setEditingId(null);
      } else {
        await axios.post(EXPENSE_API, expenseData);
      }

      setExpense({
        title: "",
        amount: "",
        category: "",
      });
      setCustomCategory("");

      fetchExpenses();
    } catch (error) {
      console.error("Error saving:", error);
      alert("Error saving expense");
    } finally {
      setLoading(false);
    }
  };

  // Delete
  const deleteExpense = async (id) => {
    if (window.confirm("Are you sure you want to delete this expense?")) {
      try {
        setLoading(true);
        await axios.delete(`${EXPENSE_API}/${id}`);
        fetchExpenses();
      } catch (error) {
        console.error("Error deleting:", error);
        alert("Error deleting expense");
      } finally {
        setLoading(false);
      }
    }
  };

  // Edit
  const editExpense = (exp) => {
    const predefinedCategories = ["Food", "Travel", "Shopping", "Bills", "Entertainment", "Health"];
    
    if (predefinedCategories.includes(exp.category)) {
      setExpense({
        title: exp.title,
        amount: exp.amount,
        category: exp.category,
      });
      setCustomCategory("");
    } else {
      setExpense({
        title: exp.title,
        amount: exp.amount,
        category: "Other",
      });
      setCustomCategory(exp.category);
    }
    
    setEditingId(exp._id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-green-50 via-white to-blue-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold bg-linear-to-r from-green-600 to-blue-600 bg-clip-text text-transparent mb-2">
            💰 Daily Expenses
          </h1>
          <p className="text-gray-600">Track your daily spending easily</p>
        </div>

        {/* Main Card */}
        <div className="bg-white/70 backdrop-blur-lg rounded-3xl shadow-2xl p-6 md:p-8 border border-white/20">

          {/* Dashboard Stats */}
          <div className="grid md:grid-cols-3 gap-4 mb-8">
            <div className="bg-linear-to-br from-green-500 to-green-600 text-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition-shadow">
              <h3 className="text-sm font-semibold opacity-90">Total Expenses</h3>
              <h2 className="text-3xl font-bold mt-2">₹ {Number(totalExpense).toLocaleString()}</h2>
            </div>

            <div className="bg-linear-to-br from-blue-500 to-blue-600 text-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition-shadow">
              <h3 className="text-sm font-semibold opacity-90">Total Records</h3>
              <h2 className="text-3xl font-bold mt-2">{expenses.length}</h2>
            </div>

            <div className="bg-linear-to-br from-purple-500 to-purple-600 text-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition-shadow">
              <h3 className="text-sm font-semibold opacity-90">Avg Expense</h3>
              <h2 className="text-3xl font-bold mt-2">
                ₹ {expenses.length > 0 ? Math.round(totalExpense / expenses.length) : 0}
              </h2>
            </div>
          </div>

          {/* Form Section */}
          <form onSubmit={handleSubmit} className="mb-6 p-6 bg-gray-50 rounded-2xl">
            <div className="grid md:grid-cols-4 gap-3 mb-3">
              <input
                type="text"
                placeholder="Expense Title"
                className="border-2 border-gray-300 p-3 rounded-lg focus:border-green-500 focus:outline-none transition"
                value={expense.title}
                onChange={(e) => setExpense({ ...expense, title: e.target.value })}
                required
              />

              <input
                type="number"
                placeholder="Amount"
                className="border-2 border-gray-300 p-3 rounded-lg focus:border-green-500 focus:outline-none transition"
                value={expense.amount}
                onChange={(e) => setExpense({ ...expense, amount: e.target.value })}
                required
              />

              <select
                value={expense.category}
                onChange={(e) => {
                  setExpense({ ...expense, category: e.target.value });
                  if (e.target.value !== "Other") {
                    setCustomCategory("");
                  }
                }}
                className="border-2 border-gray-300 p-3 rounded-lg focus:border-green-500 focus:outline-none transition bg-white"
              >
                <option value="">Select Category</option>
                <option value="Food">🍔 Food</option>
                <option value="Travel">🚗 Travel</option>
                <option value="Shopping">🛍️ Shopping</option>
                <option value="Bills">📋 Bills</option>
                <option value="Entertainment">🎬 Entertainment</option>
                <option value="Health">🏥 Health</option>
                <option value="Other">📌 Other</option>
              </select>

              <button
                type="submit"
                disabled={loading}
                className="bg-linear-to-r from-green-500 to-green-600 text-white px-5 py-3 rounded-lg hover:scale-105 transition-all duration-300 font-semibold shadow-lg disabled:opacity-50"
              >
                <FaPlus className="inline mr-2" />
                {loading ? "Saving..." : editingId ? "Update" : "Add"}
              </button>
            </div>

            {expense.category === "Other" && (
              <input
                type="text"
                placeholder="Enter custom category name"
                className="border-2 border-orange-300 p-3 rounded-lg w-full focus:border-orange-500 focus:outline-none transition bg-orange-50"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                required
              />
            )}
          </form>

          {/* Expenses Display */}
          <div>
            {loading && expenses.length === 0 ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
                <p className="text-gray-600 mt-4">Loading...</p>
              </div>
            ) : expenses.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-2xl">
                <h2 className="text-2xl font-bold text-gray-800">No Expenses Found</h2>
                <p className="text-gray-500 mt-2">Start adding expenses to track your spending</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {expenses.map((exp) => (
                  <div
                    key={exp._id}
                    className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-2xl transition-all duration-300 border-l-4 border-green-500"
                  >
                    <div className="grid md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-gray-800">
                          {exp.title}
                        </h3>
                        <p className="text-gray-600 mt-1 text-sm">
                          Category: <span className="font-semibold">{exp.category}</span>
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-2xl text-green-600">
                          ₹ {Number(exp.amount).toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(exp.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => editExpense(exp)}
                        className="bg-linear-to-r from-yellow-400 to-yellow-500 text-white px-4 py-2 rounded-lg hover:scale-110 transition-all duration-300 font-semibold shadow-md"
                      >
                        <FaEdit className="inline mr-2" />
                        Edit
                      </button>

                      <button
                        onClick={() => deleteExpense(exp._id)}
                        className="bg-linear-to-r from-red-500 to-red-600 text-white px-4 py-2 rounded-lg hover:scale-110 transition-all duration-300 font-semibold shadow-md"
                      >
                        <FaTrash className="inline mr-2" />
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}

export default DailyExpenses;
