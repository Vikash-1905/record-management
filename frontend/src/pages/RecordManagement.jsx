import { useEffect, useRef, useState } from "react";
import axios from "axios";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { debounce } from "lodash";
import { FaDownload, FaPlus, FaEdit, FaTrash, FaSearch } from "react-icons/fa";

function RecordManagement() {
  const [form, setForm] = useState({
    name: "",
    address: "",
    rupees: "",
  });

  const [users, setUsers] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("latest");
  const [reportTitle, setReportTitle] = useState("Record Management Report");
  const [selectedDate, setSelectedDate] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);

  const API = import.meta.env.VITE_API_URL;
  const recordsPerPage = 5;

  const debouncedSearch = useRef(
    debounce((value) => {
      setSearch(value);
    }, 300)
  ).current;

  useEffect(() => () => debouncedSearch.cancel(), [debouncedSearch]);

  const fetchAllUsersForExport = async () => {
    const exportResponse = await axios.get(API, {
      params: {
        page: 1,
        limit: totalRecords || 1000,
        search,
        filter,
        date: selectedDate,
        minAmount,
        maxAmount,
      },
    });

    return exportResponse.data.users || [];
  };

  // Fetch Data
  const fetchUsers = async (page = 1) => {
    try {
      setLoading(true);
      const res = await axios.get(API, {
        params: {
          page,
          limit: recordsPerPage,
          search,
          filter,
          date: selectedDate,
          minAmount,
          maxAmount,
        },
      });
      setUsers(res.data.users);
      setTotalPages(res.data.totalPages);
      setCurrentPage(page);
      setTotalRecords(res.data.totalRecords);
      setTotalAmount(res.data.totalAmount || 0);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  // Reset to page 1 on search/filter change
  useEffect(() => {
    setCurrentPage(1);
    fetchUsers(1);
  }, [search, filter, selectedDate, minAmount, maxAmount]);

  // Add or Update
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.name || !form.address || !form.rupees) {
      alert("Please fill all fields");
      return;
    }

    try {
      setLoading(true);

      if (editingId) {
        await axios.put(`${API}/${editingId}`, form);
        setEditingId(null);
      } else {
        await axios.post(API, form);
      }

      setForm({
        name: "",
        address: "",
        rupees: "",
      });

      fetchUsers(currentPage);
    } catch (error) {
      console.error("Error saving:", error);
      alert("Error saving data");
    } finally {
      setLoading(false);
    }
  };

  // Delete
  const deleteUser = async (id) => {
    if (window.confirm("Are you sure you want to delete this record?")) {
      try {
        setLoading(true);
        await axios.delete(`${API}/${id}`);
        fetchUsers(currentPage);
      } catch (error) {
        console.error("Error deleting:", error);
        alert("Error deleting data");
      } finally {
        setLoading(false);
      }
    }
  };

  // Edit
  const editUser = (user) => {
    setForm({
      name: user.name,
      address: user.address,
      rupees: user.rupees,
    });
    setEditingId(user._id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const visibleUsers = users;

  const clearFilters = () => {
    debouncedSearch.cancel();
    setSearchInput("");
    setSearch("");
    setFilter("latest");
    setSelectedDate("");
    setMinAmount("");
    setMaxAmount("");
    setCurrentPage(1);
    fetchUsers(1);
  };

  const renderHighlightedText = (value) => {
    const text = String(value ?? "");
    const query = searchInput.trim();

    if (!query) {
      return text;
    }

    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();

    if (!lowerText.includes(lowerQuery)) {
      return text;
    }

    const parts = [];
    let cursor = 0;
    let matchIndex = lowerText.indexOf(lowerQuery);

    while (matchIndex !== -1) {
      if (matchIndex > cursor) {
        parts.push(text.slice(cursor, matchIndex));
      }

      parts.push(
        <span key={`${matchIndex}-${cursor}`} className="bg-yellow-200 px-1 rounded">
          {text.slice(matchIndex, matchIndex + query.length)}
        </span>
      );

      cursor = matchIndex + query.length;
      matchIndex = lowerText.indexOf(lowerQuery, cursor);
    }

    if (cursor < text.length) {
      parts.push(text.slice(cursor));
    }

    return parts;
  };

  // PDF Download
  const downloadPDF = async () => {
    const doc = new jsPDF("l", "mm", "a4");
    const formatAmount = (value) => `Rs. ${Number(value).toLocaleString("en-IN")}`;
    const safeFileName = reportTitle.trim().replace(/[\\/:*?"<>|]+/g, "-") || "Report";

    const allUsers = await fetchAllUsersForExport();
    const total = allUsers.reduce((sum, item) => sum + Number(item.rupees), 0);

    doc.setFontSize(22);
    doc.setTextColor(40, 40, 40);
    doc.text(reportTitle, 14, 20);

    doc.setFontSize(11);
    doc.setTextColor(60, 60, 60);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);

    doc.setFontSize(13);
    doc.setTextColor(40, 40, 40);
    doc.text(`Total Records: ${allUsers.length}`, 14, 38);
    doc.text(`Total Amount: ${formatAmount(total)}`, 140, 38);

    const tableData = allUsers.map((user, index) => [
      index + 1,
      user.name,
      user.address,
      formatAmount(user.rupees),
      new Date(user.createdAt).toLocaleString(),
    ]);

    autoTable(doc, {
      startY: 45,
      head: [["S.No", "Name", "Address", "Amount", "Date & Time"]],
      body: tableData,
      theme: "grid",
      headStyles: {
        fillColor: [41, 98, 255],
        textColor: 255,
        fontSize: 12,
        halign: "center",
      },
      bodyStyles: {
        fontSize: 11,
        textColor: 50,
        valign: "middle",
      },
      alternateRowStyles: {
        fillColor: [245, 247, 250],
      },
      styles: {
        cellPadding: 4,
      },
      columnStyles: {
        0: {
          halign: "center",
          cellWidth: 18,
        },
        1: {
          cellWidth: 35,
        },
        2: {
          cellWidth: 55,
        },
        3: {
          halign: "right",
          cellWidth: 35,
        },
        4: {
          cellWidth: 55,
        },
      },
    });

    const pageCount = doc.internal.getNumberOfPages();

    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(
        `Page ${i} of ${pageCount}`,
        doc.internal.pageSize.getWidth() - 18,
        doc.internal.pageSize.getHeight() - 10,
        { align: "right" }
      );
      doc.text("Created By Record Management", 14, doc.internal.pageSize.getHeight() - 10);
    }

    doc.save(`${safeFileName}.pdf`);
  };

  // Excel Download
  const downloadExcel = async () => {
    const allUsers = await fetchAllUsersForExport();
    const total = allUsers.reduce((sum, item) => sum + Number(item.rupees), 0);
    const safeFileName = reportTitle.trim().replace(/[\\/:*?"<>|]+/g, "-") || "Report";

    const excelData = allUsers.map((user, index) => ({
      "S.No": index + 1,
      Name: user.name,
      Address: user.address,
      Amount: Number(user.rupees),
      "Date & Time": new Date(user.createdAt).toLocaleString(),
    }));

    const worksheet = XLSX.utils.json_to_sheet([]);
    XLSX.utils.sheet_add_aoa(worksheet, [[reportTitle]], { origin: "A1" });
    XLSX.utils.sheet_add_aoa(
      worksheet,
      [[`Generated: ${new Date().toLocaleString()}`]],
      { origin: "A2" }
    );
    XLSX.utils.sheet_add_aoa(
      worksheet,
      [[`Total Records: ${allUsers.length}`, `Total Amount: Rs. ${total.toLocaleString("en-IN")}`]],
      { origin: "A3" }
    );
    XLSX.utils.sheet_add_json(worksheet, excelData, { origin: "A5", skipHeader: false });

    worksheet["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 1 } },
    ];

    worksheet["!cols"] = [
      { wch: 8 },
      { wch: 20 },
      { wch: 35 },
      { wch: 15 },
      { wch: 26 },
    ];

    const setCellStyle = (cellRef, style) => {
      if (!worksheet[cellRef]) return;
      worksheet[cellRef].s = style;
    };

    const titleStyle = {
      font: { bold: true, color: { rgb: "FFFFFF" }, sz: 16 },
      fill: { patternType: "solid", fgColor: { rgb: "2563EB" } },
      alignment: { horizontal: "center", vertical: "center" },
    };

    const summaryStyle = {
      font: { bold: true, color: { rgb: "1F2937" }, sz: 11 },
      fill: { patternType: "solid", fgColor: { rgb: "DBEAFE" } },
      alignment: { horizontal: "left", vertical: "center" },
    };

    const headerStyle = {
      font: { bold: true, color: { rgb: "FFFFFF" } },
      fill: { patternType: "solid", fgColor: { rgb: "2563EB" } },
      alignment: { horizontal: "center", vertical: "center" },
      border: {
        top: { style: "thin", color: { rgb: "FFFFFF" } },
        bottom: { style: "thin", color: { rgb: "FFFFFF" } },
        left: { style: "thin", color: { rgb: "FFFFFF" } },
        right: { style: "thin", color: { rgb: "FFFFFF" } },
      },
    };

    const bodyStyle = {
      font: { color: { rgb: "111827" } },
      alignment: { vertical: "center" },
      border: {
        top: { style: "thin", color: { rgb: "D1D5DB" } },
        bottom: { style: "thin", color: { rgb: "D1D5DB" } },
        left: { style: "thin", color: { rgb: "D1D5DB" } },
        right: { style: "thin", color: { rgb: "D1D5DB" } },
      },
    };

    setCellStyle("A1", titleStyle);
    setCellStyle("A2", {
      font: { italic: true, color: { rgb: "4B5563" } },
      alignment: { horizontal: "left", vertical: "center" },
    });
    setCellStyle("A3", summaryStyle);
    setCellStyle("B3", summaryStyle);
    setCellStyle("C3", summaryStyle);
    setCellStyle("D3", summaryStyle);
    setCellStyle("E3", summaryStyle);

    ["A5", "B5", "C5", "D5", "E5"].forEach((cellRef) => {
      setCellStyle(cellRef, headerStyle);
    });

    for (let rowIndex = 6; rowIndex < 6 + excelData.length; rowIndex++) {
      ["A", "B", "C", "D", "E"].forEach((column) => {
        const cellRef = `${column}${rowIndex}`;
        setCellStyle(cellRef, bodyStyle);
      });
      if (worksheet[`D${rowIndex}`]) {
        worksheet[`D${rowIndex}`].z = '"Rs." #,##0';
      }
    }

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Report");

    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });

    const data = new Blob([excelBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8",
    });

    saveAs(data, `${safeFileName}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 via-white to-green-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold bg-linear-to-r from-blue-600 to-green-600 bg-clip-text text-transparent mb-2">
            💰 Record Management
          </h1>
          <p className="text-gray-600">Professional Financial Management System</p>
        </div>

        {/* Main Card */}
        <div className="bg-white/70 backdrop-blur-lg rounded-3xl shadow-2xl p-6 md:p-8 border border-white/20">

          {/* Dashboard Stats */}
          <div className="grid md:grid-cols-3 gap-4 mb-8">
            <div className="bg-linear-to-br from-blue-500 to-blue-600 text-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition-shadow">
              <h3 className="text-sm font-semibold opacity-90">Total Records</h3>
              <h2 className="text-3xl font-bold mt-2">{totalRecords}</h2>
            </div>

            <div className="bg-linear-to-br from-green-500 to-green-600 text-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition-shadow">
              <h3 className="text-sm font-semibold opacity-90">Total Amount</h3>
              <h2 className="text-3xl font-bold mt-2">₹ {Number(totalAmount).toLocaleString()}</h2>
            </div>

            <div className="bg-linear-to-br from-purple-500 to-purple-600 text-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition-shadow">
              <h3 className="text-sm font-semibold opacity-90">Current Page</h3>
              <h2 className="text-3xl font-bold mt-2">{currentPage}</h2>
            </div>
          </div>

          {/* Form Section */}
          <form onSubmit={handleSubmit} className="grid md:grid-cols-4 gap-3 mb-6 p-6 bg-gray-50 rounded-2xl">
            <input
              type="text"
              placeholder="Name"
              className="border-2 border-gray-300 p-3 rounded-lg focus:border-blue-500 focus:outline-none transition"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />

            <input
              type="text"
              placeholder="Address"
              className="border-2 border-gray-300 p-3 rounded-lg focus:border-blue-500 focus:outline-none transition"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              required
            />

            <input
              type="number"
              placeholder="Rupees"
              className="border-2 border-gray-300 p-3 rounded-lg focus:border-blue-500 focus:outline-none transition"
              value={form.rupees}
              onChange={(e) => setForm({ ...form, rupees: e.target.value })}
              required
            />

            <button
              type="submit"
              disabled={loading}
              className="bg-linear-to-r from-blue-500 to-indigo-600 text-white px-5 py-3 rounded-lg hover:scale-105 transition-all duration-300 font-semibold shadow-lg disabled:opacity-50"
            >
              <FaPlus className="inline mr-2" />
              {loading ? "Saving..." : editingId ? "Update" : "Add"}
            </button>
          </form>

          {/* Search and Filter */}
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <div className="relative">
              <FaSearch className="absolute left-3 top-3 text-gray-400 text-lg" />
              <input
                type="text"
                placeholder="Search name, address, or amount..."
                className="border-2 border-gray-300 p-3 pl-10 rounded-lg w-full focus:border-blue-500 focus:outline-none transition"
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  debouncedSearch(e.target.value);
                }}
              />
            </div>

            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="border-2 border-gray-300 p-3 rounded-lg focus:border-blue-500 focus:outline-none transition bg-white"
            >
              <option value="latest">📅 Latest First</option>
              <option value="oldest">📅 Oldest First</option>
              <option value="high">💹 High Amount</option>
              <option value="low">📉 Low Amount</option>
            </select>
          </div>

          <div className="grid md:grid-cols-3 gap-4 mb-4">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border-2 border-gray-300 p-3 rounded-lg focus:border-blue-500 focus:outline-none transition bg-white"
            />

            <input
              type="number"
              placeholder="Min Amount"
              value={minAmount}
              onChange={(e) => setMinAmount(e.target.value)}
              className="border-2 border-gray-300 p-3 rounded-lg focus:border-blue-500 focus:outline-none transition"
            />

            <input
              type="number"
              placeholder="Max Amount"
              value={maxAmount}
              onChange={(e) => setMaxAmount(e.target.value)}
              className="border-2 border-gray-300 p-3 rounded-lg focus:border-blue-500 focus:outline-none transition"
            />
          </div>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
            <p className="text-gray-600">
              Found <span className="font-semibold text-blue-600">{totalRecords}</span> records
            </p>

            <button
              type="button"
              onClick={clearFilters}
              className="bg-red-500 text-white px-5 py-3 rounded-xl hover:scale-105 transition-all duration-300 font-semibold shadow-lg"
            >
              Clear Filters
            </button>
          </div>

          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <input
              type="text"
              placeholder="Enter Report Heading"
              value={reportTitle}
              onChange={(e) => setReportTitle(e.target.value)}
              className="border-2 border-gray-300 p-3 rounded-lg w-full focus:border-blue-500 focus:outline-none transition"
            />
          </div>

          {/* Download PDF Button */}
          <div className="flex flex-wrap gap-4 mt-4 mb-6">
            <button
              onClick={downloadPDF}
              disabled={totalRecords === 0 || loading}
              className="bg-red-500 text-white px-5 py-3 rounded-xl hover:scale-105 transition-all duration-300 font-semibold shadow-lg disabled:opacity-50"
            >
              <FaDownload className="inline mr-2" />
              Download PDF Report
            </button>

            <button
              onClick={downloadExcel}
              disabled={totalRecords === 0 || loading}
              className="bg-green-600 text-white px-5 py-3 rounded-xl hover:scale-105 transition-all duration-300 font-semibold shadow-lg disabled:opacity-50"
            >
              <FaDownload className="inline mr-2" />
              Download Excel
            </button>
          </div>

          {/* Records Display */}
          <div>
            {loading && visibleUsers.length === 0 ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                <p className="text-gray-600 mt-4">Loading...</p>
              </div>
            ) : visibleUsers.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-2xl">
                <h2 className="text-2xl font-bold text-gray-800">No Records Found</h2>
                <p className="text-gray-500 mt-2">Try different search or filters</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {visibleUsers.map((user) => (
                  <div
                    key={user._id}
                    className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-2xl transition-all duration-300 border-l-4 border-blue-500"
                  >
                    <div className="grid md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-gray-800">
                          {renderHighlightedText(user.name)}
                        </h3>
                        <p className="text-gray-600 mt-1">{renderHighlightedText(user.address)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-2xl text-green-600">
                          {renderHighlightedText(`₹ ${Number(user.rupees).toLocaleString()}`)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(user.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => editUser(user)}
                        className="bg-linear-to-r from-yellow-400 to-yellow-500 text-white px-4 py-2 rounded-lg hover:scale-110 transition-all duration-300 font-semibold shadow-md"
                      >
                        <FaEdit className="inline mr-2" />
                        Edit
                      </button>

                      <button
                        onClick={() => deleteUser(user._id)}
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

            {/* Pagination Buttons */}
            {totalRecords > 0 && totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-8 flex-wrap">
                <button
                  onClick={() => fetchUsers(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="bg-linear-to-r from-blue-500 to-blue-600 text-white px-4 py-2 rounded-lg hover:scale-105 transition-all duration-300 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ← Prev
                </button>

                {[...Array(totalPages)].map((_, index) => (
                  <button
                    key={index}
                    onClick={() => fetchUsers(index + 1)}
                    className={`px-4 py-2 rounded-lg font-semibold transition-all duration-300 ${
                      currentPage === index + 1
                        ? "bg-linear-to-r from-blue-600 to-indigo-600 text-white shadow-lg"
                        : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                    }`}
                  >
                    {index + 1}
                  </button>
                ))}

                <button
                  onClick={() => fetchUsers(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="bg-linear-to-r from-blue-500 to-blue-600 text-white px-4 py-2 rounded-lg hover:scale-105 transition-all duration-300 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next →
                </button>
              </div>
            )}

            {/* Pagination Info */}
            {totalRecords > 0 && (
              <div className="text-center mt-6 text-gray-600">
                <p>Page <span className="font-bold text-blue-600">{currentPage}</span> of <span className="font-bold text-blue-600">{totalPages}</span> | Total Records: <span className="font-bold text-green-600">{totalRecords}</span></p>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}

export default RecordManagement;
