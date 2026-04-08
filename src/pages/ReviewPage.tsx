import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, type Blog } from "../api.js";

export function ReviewPage(): JSX.Element {
  const { token } = useParams<{ token: string }>();
  const [blog, setBlog] = useState<Blog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busyAction, setBusyAction] = useState<"" | "approve" | "reject">("");

  useEffect(() => {
    async function load(): Promise<void> {
      if (!token) {
        setError("Review token is missing.");
        setLoading(false);
        return;
      }

      try {
        const response = await api.getReview(token);
        setBlog(response);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load review.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [token]);

  async function handleApprove(): Promise<void> {
    if (!token) {
      return;
    }

    setBusyAction("approve");
    setError("");
    setMessage("");

    try {
      const response = await api.approve(token);
      setBlog(response);
      setMessage("Blog approved successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve blog.");
    } finally {
      setBusyAction("");
    }
  }

  async function handleReject(): Promise<void> {
    if (!token) {
      return;
    }

    setBusyAction("reject");
    setError("");
    setMessage("");

    try {
      const response = await api.reject(token);
      setBlog(response.regenerated_blog);
      setMessage(response.mail_result.message || "Blog rejected and regenerated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject blog.");
    } finally {
      setBusyAction("");
    }
  }

  if (loading) {
    return <div className="review-shell">Loading review...</div>;
  }

  if (error && !blog) {
    return <div className="review-shell error-state">{error}</div>;
  }

  if (!blog) {
    return <div className="review-shell error-state">Review not found.</div>;
  }

  return (
    <div className="review-shell">
      <section className="review-card">
        <p className="eyebrow">Review Request</p>
        <h1>{blog.title}</h1>
        <p className="summary">{blog.summary}</p>

        <div className="meta-grid">
          <div>
            <span>Site</span>
            <strong>{blog.site}</strong>
          </div>
          <div>
            <span>Status</span>
            <strong>{blog.status.replace(/_/g, " ")}</strong>
          </div>
        </div>

        <div
          className="blog-body"
          dangerouslySetInnerHTML={{
            __html: blog.html_content
          }}
        />

        {message ? <p className="message success">{message}</p> : null}
        {error ? <p className="message error">{error}</p> : null}

        <div className="actions">
          <button onClick={() => void handleApprove()} disabled={busyAction !== ""}>
            {busyAction === "approve" ? "Approving..." : "Approve"}
          </button>
          <button
            className="danger"
            onClick={() => void handleReject()}
            disabled={busyAction !== ""}
          >
            {busyAction === "reject" ? "Reject & Regenerate..." : "Reject & Regenerate"}
          </button>
        </div>
      </section>
    </div>
  );
}
