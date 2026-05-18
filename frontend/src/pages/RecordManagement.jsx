import { useEffect, useRef, useState } from "react";
import axios from "axios";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { debounce } from "lodash";
import { FaDownload, FaPlus, FaEdit, FaTrash, FaSearch } from "react-icons/fa";
import { USERS_API } from "../config/api";

function RecordManagement() {
  // Form state for grouped records
  const [form, setForm] = useState({
    address: "",
    records: [
      {
        name: "",
        rupees: "",
      },
    ],
  });

  const [groupedRecords, setGroupedRecords] = useState([]);
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

  const API = `${USERS_API.replace("/api/users", "")}/api/records`;
  const recordsPerPage = 5;

  const debouncedSearch = useRef(
    debounce((value) => {
      setSearch(value);
    }, 300)
  ).current;

  useEffect(() => () => debouncedSearch.cancel(), [debouncedSearch]);

  // Handle change in record field
  const handleRecordChange = (index, field, value) => {
    const updatedRecords = [...form.records];
    updatedRecords[index][field] = value;
    setForm({ ...form, records: updatedRecords });
  };

  // Add new row
  const addRow = () => {
    setForm({
      ...form,
      records: [
        ...form.records,
        {
          name: "",
          rupees: "",
        },
      ],
    });
  };

  // Remove row
  const removeRow = (index) => {
    if (form.records.length === 1) {
      alert("You must have at least one record entry");
      return;
    }

    const updatedRecords = form.records.filter((_, i) => i !== index);
    setForm({ ...form, records: updatedRecords });
  };

  const fetchAllRecordsForExport = async () => {
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

    return exportResponse.data.records || [];
  };

  // Fetch Data
  const fetchRecords = async (page = 1) => {
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
      setGroupedRecords(res.data.records);
      setTotalPages(res.data.totalPages);
      setCurrentPage(page);
      setTotalRecords(res.data.totalRecords);
      setTotalAmount(res.data.totalAmount || 0);
    } catch (error) {
      console.error("Error fetching records:", error);
    } finally {
      setLoading(false);
    }
  };

  // Reset to page 1 on search/filter change
  useEffect(() => {
    setCurrentPage(1);
    fetchRecords(1);
  }, [search, filter, selectedDate, minAmount, maxAmount]);

  // Add or Update
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.address) {
      alert("Please enter an address");
      return;
    }

    if (form.records.length === 0) {
      alert("Please add at least one record");
      return;
    }

    // Validate all records
    const isValid = form.records.every(
      (record) => record.name && record.rupees
    );

    if (!isValid) {
      alert("Please fill all fields in all records");
      return;
    }

    try {
      setLoading(true);

      const payload = {
        address: form.address,
        records: form.records.map((r) => ({
          name: r.name,
          rupees: Number(r.rupees),
        })),
      };

      if (editingId) {
        await axios.put(`${API}/${editingId}`, payload);
        setEditingId(null);
      } else {
        await axios.post(API, payload);
      }

      setForm({
        address: "",
        records: [
          {
            name: "",
            rupees: "",
          },
        ],
      });

      fetchRecords(currentPage);
    } catch (error) {
      const message =
        error.response?.data?.message || error.response?.data?.error || "Error saving data";
      console.error("Error saving:", error.response?.data || error);
      alert(message);
    } finally {
      setLoading(false);
    }
  };

  // Delete
  const deleteRecord = async (id) => {
    if (window.confirm("Are you sure you want to delete this record group?")) {
      try {
        setLoading(true);
        await axios.delete(`${API}/${id}`);
        fetchRecords(currentPage);
      } catch (error) {
        console.error("Error deleting:", error);
        alert("Error deleting data");
      } finally {
        setLoading(false);
      }
    }
  };

  // Edit
  const editRecord = (record) => {
    setForm({
      address: record.address,
      records: record.records,
    });
    setEditingId(record._id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const clearFilters = () => {
    debouncedSearch.cancel();
    setSearchInput("");
    setSearch("");
    setFilter("latest");
    setSelectedDate("");
    setMinAmount("");
    setMaxAmount("");
    setCurrentPage(1);
    fetchRecords(1);
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

  // Calculate total for a single record group
  const calculateTotal = (records) => {
    return records.reduce((sum, record) => sum + Number(record.rupees || 0), 0);
  };

  // PDF Download
  const downloadPDF = async () => {
    const doc = new jsPDF("l", "mm", "a4");
    const formatAmount = (value) => `Rs. ${Number(value).toLocaleString("en-IN")}`;
    const safeFileName = reportTitle.trim().replace(/[\\/:*?"<>|]+/g, "-") || "Report";

    const allRecords = await fetchAllRecordsForExport();

    doc.setFontSize(22);
    doc.setTextColor(40, 40, 40);
    doc.text(reportTitle, 14, 20);

    doc.setFontSize(11);
    doc.setTextColor(60, 60, 60);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);

    doc.setFontSize(13);
    doc.setTextColor(40, 40, 40);
    doc.text(`Total Record Groups: ${allRecords.length}`, 14, 38);
    doc.text(`Total Amount: ${formatAmount(totalAmount)}`, 140, 38);

    let startY = 45;

    allRecords.forEach((recordGroup, groupIndex) => {
      // Check if we need a new page
      if (startY > 240) {
        doc.addPage();
        startY = 20;
      }

      // Add address
      doc.setFontSize(12);
      doc.setTextColor(41, 98, 255);
      doc.text(`${recordGroup.address} (${new Date(recordGroup.createdAt).toLocaleString()})`, 14, startY);
      startY += 8;

      // Add table for this group
      const tableData = recordGroup.records.map((record, index) => [
        index + 1,
        record.name,
        formatAmount(record.rupees),
      ]);

      const total = calculateTotal(recordGroup.records);

      autoTable(doc, {
        startY,
        head: [["S.No", "Name", "Amount"]],
        body: tableData,
        theme: "grid",
        headStyles: {
          fillColor: [41, 98, 255],
          textColor: 255,
          fontSize: 11,
          halign: "center",
        },
        bodyStyles: {
          fontSize: 10,
          textColor: 50,
          valign: "middle",
        },
        alternateRowStyles: {
          fillColor: [245, 247, 250],
        },
        columnStyles: {
          0: {
            halign: "center",
            cellWidth: 18,
          },
          1: {
            cellWidth: 45,
          },
          2: {
            halign: "right",
            cellWidth: 35,
          },
        },
      });

      // Add total for this group
      startY = doc.lastAutoTable.finalY + 5;
      doc.setFontSize(10);
      doc.setTextColor(40, 40, 40);
      doc.text(`Subtotal: ${formatAmount(total)}`, 200, startY, { align: "right" });
      startY += 10;
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
    const allRecords = await fetchAllRecordsForExport();
    const safeFileName = reportTitle.trim().replace(/[\\/:*?"<>|]+/g, "-") || "Report";

    const worksheet = XLSX.utils.json_to_sheet([]);
    XLSX.utils.sheet_add_aoa(worksheet, [[reportTitle]], { origin: "A1" });
    XLSX.utils.sheet_add_aoa(
      worksheet,
      [[`Generated: ${new Date().toLocaleString()}`]],
      { origin: "A2" }
    );
    XLSX.utils.sheet_add_aoa(
      worksheet,
      [[`Total Amount: Rs. ${totalAmount.toLocaleString("en-IN")}`]],
      { origin: "A3" }
    );

    let currentRow = 5;

    allRecords.forEach((recordGroup) => {
      // Add address
      XLSX.utils.sheet_add_aoa(
        worksheet,
        [[`Address: ${recordGroup.address}`, `Date: ${new Date(recordGroup.createdAt).toLocaleString()}`]],
        { origin: `A${currentRow}` }
      );
      currentRow += 1;

      // Add headers
      XLSX.utils.sheet_add_aoa(
        worksheet,
        [["S.No", "Name", "Amount"]],
        { origin: `A${currentRow}` }
      );
      currentRow += 1;

      // Add records
      const excelData = recordGroup.records.map((record, index) => [
        index + 1,
        record.name,
        Number(record.rupees),
      ]);

      XLSX.utils.sheet_add_aoa(worksheet, excelData, { origin: `A${currentRow}` });
      currentRow += excelData.length;

      // Add subtotal
      const total = calculateTotal(recordGroup.records);
      XLSX.utils.sheet_add_aoa(worksheet, [[`Subtotal:`, "", total]], { origin: `A${currentRow}` });
      currentRow += 2;
    });

    worksheet["!cols"] = [
      { wch: 8 },
      { wch: 20 },
      { wch: 15 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Records");

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
          <p className="text-gray-600">Professional Financial Management with Grouped Records</p>
        </div>

        {/* Main Card */}
        <div className="bg-white/70 backdrop-blur-lg rounded-3xl shadow-2xl p-6 md:p-8 border border-white/20">

          {/* Dashboard Stats */}
          <div className="grid md:grid-cols-3 gap-4 mb-8">
            <div className="bg-linear-to-br from-blue-500 to-blue-600 text-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition-shadow">
              <h3 className="text-sm font-semibold opacity-90">Total Groups</h3>
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
          <form onSubmit={handleSubmit} className="mb-6 p-6 bg-gray-50 rounded-2xl">
            {/* Address Input */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                📍 Address (e.g., Office, Delhi, Branch-2)
              </label>
              <input
                type="text"
                placeholder="Enter Address"
                className="border-2 border-gray-300 p-3 rounded-lg w-full focus:border-blue-500 focus:outline-none transition"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                required
              />
            </div>

            {/* Records List */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                📋 Records ({form.records.length})
              </label>

              <div className="space-y-3">
                {form.records.map((record, index) => (
                  <div
                    key={index}
                    className="grid md:grid-cols-3 gap-3 p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 transition"
                  >
                    <input
                      type="text"
                      placeholder="Name"
                      className="border-2 border-gray-300 p-3 rounded-lg focus:border-blue-500 focus:outline-none transition"
                      value={record.name}
                      onChange={(e) => handleRecordChange(index, "name", e.target.value)}
                      required
                    />

                    <input
                      type="number"
                      placeholder="Rupees"
                      className="border-2 border-gray-300 p-3 rounded-lg focus:border-blue-500 focus:outline-none transition"
                      value={record.rupees}
                      onChange={(e) => handleRecordChange(index, "rupees", e.target.value)}
                      required
                    />

                    <button
                      type="button"
                      onClick={() => removeRow(index)}
                      className="bg-red-500 text-white px-3 py-3 rounded-lg hover:bg-red-600 transition font-semibold"
                    >
                      <FaTrash className="inline" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={addRow}
                  className="bg-green-500 text-white px-5 py-3 rounded-lg hover:bg-green-600 transition font-semibold shadow-lg"
                >
                  <FaPlus className="inline mr-2" />
                  Add More Row
                </button>

              <button
                type="submit"
                disabled={loading}
                className="bg-linear-to-r from-blue-500 to-indigo-600 text-white px-5 py-3 rounded-lg hover:scale-105 transition-all duration-300 font-semibold shadow-lg disabled:opacity-50"
              >
                <FaPlus className="inline mr-2" />
                {loading ? "Saving..." : editingId ? "Update Group" : "Save Records"}
              </button>
            </div>
          </form>

          {/* Search and Filter */}
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <div className="relative">
              <FaSearch className="absolute left-3 top-3 text-gray-400 text-lg" />
              <input
                type="text"
                placeholder="Search address, name, or amount..."
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
              Found <span className="font-semibold text-blue-600">{totalRecords}</span> record groups
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

          {/* Download Buttons */}
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
            {loading && groupedRecords.length === 0 ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                <p className="text-gray-600 mt-4">Loading...</p>
              </div>
            ) : groupedRecords.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-2xl">
                <h2 className="text-2xl font-bold text-gray-800">No Records Found</h2>
                <p className="text-gray-500 mt-2">Create your first record group above</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {groupedRecords.map((recordGroup) => {
                  const groupTotal = calculateTotal(recordGroup.records);
                  return (
                    <div
                      key={recordGroup._id}
                      className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-2xl transition-all duration-300 border-l-4 border-blue-500"
                    >
                      {/* Group Header */}
                      <div className="mb-4 pb-4 border-b-2 border-gray-200">
                        <h3 className="text-2xl font-bold text-gray-800">
                          📍 {renderHighlightedText(recordGroup.address)}
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(recordGroup.createdAt).toLocaleString()}
                        </p>
                      </div>

                      {/* Records Table */}
                      <div className="mb-4 overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-100 border-b-2 border-gray-300">
                              <th className="p-2 text-left font-semibold">S.No</th>
                              <th className="p-2 text-left font-semibold">Name</th>
                              <th className="p-2 text-right font-semibold">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {recordGroup.records.map((record, idx) => (
                              <tr key={idx} className="border-b hover:bg-blue-50">
                                <td className="p-2 text-center">{idx + 1}</td>
                                <td className="p-2">{renderHighlightedText(record.name)}</td>
                                <td className="p-2 text-right font-semibold text-green-600">
                                  {renderHighlightedText(`₹ ${Number(record.rupees).toLocaleString()}`)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Group Total */}
                      <div className="mb-4 p-4 bg-green-50 rounded-lg border-l-4 border-green-500">
                        <p className="text-right text-lg font-bold text-green-700">
                          Total: ₹ {Number(groupTotal).toLocaleString()}
                        </p>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => editRecord(recordGroup)}
                          className="bg-linear-to-r from-yellow-400 to-yellow-500 text-white px-4 py-2 rounded-lg hover:scale-110 transition-all duration-300 font-semibold shadow-md"
                        >
                          <FaEdit className="inline mr-2" />
                          Edit
                        </button>

                        <button
                          onClick={() => deleteRecord(recordGroup._id)}
                          className="bg-linear-to-r from-red-500 to-red-600 text-white px-4 py-2 rounded-lg hover:scale-110 transition-all duration-300 font-semibold shadow-md"
                        >
                          <FaTrash className="inline mr-2" />
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination Buttons */}
            {totalRecords > 0 && totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-8 flex-wrap">
                <button
                  onClick={() => fetchRecords(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="bg-linear-to-r from-blue-500 to-blue-600 text-white px-4 py-2 rounded-lg hover:scale-105 transition-all duration-300 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ← Prev
                </button>

                {[...Array(totalPages)].map((_, index) => (
                  <button
                    key={index}
                    onClick={() => fetchRecords(index + 1)}
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
                  onClick={() => fetchRecords(currentPage + 1)}
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
                <p>Page <span className="font-bold text-blue-600">{currentPage}</span> of <span className="font-bold text-blue-600">{totalPages}</span> | Total Groups: <span className="font-bold text-green-600">{totalRecords}</span></p>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}

export default RecordManagement;
