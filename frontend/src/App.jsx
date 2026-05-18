import { BrowserRouter, Routes, Route } from "react-router-dom";

import Navbar from "./components/Navbar";
import RecordManagement from "./pages/RecordManagement";
import DailyExpenses from "./pages/DailyExpenses";

function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<RecordManagement />} />
        <Route path="/expenses" element={<DailyExpenses />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
