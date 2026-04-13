import { Route, Routes, useLocation } from "react-router-dom";
import { HomePage } from "./pages/HomePage.js";
import { ReviewPage } from "./pages/ReviewPage.js";

export default function App(): JSX.Element {
  const location = useLocation();

  return (
    <Routes location={location} key={location.pathname}>
      <Route path="/" element={<HomePage />} />
      <Route path="/review/:id" element={<ReviewPage />} />
    </Routes>
  );
}
