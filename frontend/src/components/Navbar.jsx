import { Link, useLocation } from "react-router-dom";

function Navbar() {
  const location = useLocation();

  return (
    <div className="bg-white shadow-md p-4 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto flex gap-4">
        <Link
          to="/"
          className={`px-5 py-2 rounded-xl font-semibold transition-all duration-300 ${
            location.pathname === "/"
              ? "bg-blue-500 text-white shadow-lg"
              : "bg-gray-200 text-gray-800 hover:bg-blue-100"
          }`}
        >
          📊 Record Management
        </Link>

        <Link
          to="/expenses"
          className={`px-5 py-2 rounded-xl font-semibold transition-all duration-300 ${
            location.pathname === "/expenses"
              ? "bg-green-500 text-white shadow-lg"
              : "bg-gray-200 text-gray-800 hover:bg-green-100"
          }`}
        >
          💰 Daily Expenses
        </Link>
      </div>
    </div>
  );
}

export default Navbar;
