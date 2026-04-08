import { Route, Routes } from "react-router-dom";
import { HomePage } from "./pages/HomePage.js";
import { ReviewPage } from "./pages/ReviewPage.js";

export default function App(): JSX.Element {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/review/:token" element={<ReviewPage />} />
    </Routes>
  );
}

