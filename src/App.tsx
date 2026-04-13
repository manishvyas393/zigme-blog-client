import { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { HomePage } from "./pages/HomePage.js";
import { ReviewPage } from "./pages/ReviewPage.js";

export default function App(): JSX.Element {
  const location = useLocation();

  useEffect(() => {
    const revealTargets = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));

    if (!revealTargets.length) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-revealed");
            observer.unobserve(entry.target);
          }
        }
      },
      {
        threshold: 0.12,
        rootMargin: "0px 0px -8% 0px"
      }
    );

    for (const target of revealTargets) {
      observer.observe(target);
    }

    return () => {
      observer.disconnect();
    };
  });

  return (
    <Routes location={location} key={location.pathname}>
      <Route path="/" element={<HomePage />} />
      <Route path="/review/:id" element={<ReviewPage />} />
    </Routes>
  );
}
