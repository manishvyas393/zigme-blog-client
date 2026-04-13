import { useEffect, useRef, useState } from "react";
import { api, type Blog, type SelectedNews } from "../api.js";

type SiteOption = {
  value: "hiring.zigme.in" | "talent.zigme.in";
  label: string;
};

type FormState = {
  site: SiteOption["value"];
  prompt: string;
};

type NewsSection = "hiring" | "talent";

type NewsFeed = Record<NewsSection, SelectedNews[]>;

type SelectedNewsState = Record<NewsSection, number>;

type SiteValue = SiteOption["value"];

type NewsTarget = {
  section: NewsSection;
  index: number;
} | null;

const initialForm: FormState = {
  site: "hiring.zigme.in",
  prompt: ""
};

const siteOptions: SiteOption[] = [
  { value: "hiring.zigme.in", label: "hiring.zigme.in" },
  { value: "talent.zigme.in", label: "talent.zigme.in" }
];

const newsSectionSiteMap: Record<NewsSection, SiteValue> = {
  hiring: "hiring.zigme.in",
  talent: "talent.zigme.in"
};

function isValidSourceUrl(value: string | null | undefined): boolean {
  return /^https?:\/\//i.test(String(value || "").trim());
}

function formatPublishedDate(value: string | null | undefined): string {
  if (!value) {
    return "Latest";
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(parsedDate);
}

export function HomePage(): JSX.Element {
  const [form, setForm] = useState<FormState>(initialForm);
  const [blog, setBlog] = useState<Blog | null>(null);
  const [loading, setLoading] = useState(false);
  const [newsLoading, setNewsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [newsFeed, setNewsFeed] = useState<NewsFeed>({ hiring: [], talent: [] });
  const [selectedNewsIndex, setSelectedNewsIndex] = useState<SelectedNewsState>({
    hiring: -1,
    talent: -1
  });
  const [generatingNewsTarget, setGeneratingNewsTarget] = useState<NewsTarget>(null);
  const [isSiteMenuOpen, setIsSiteMenuOpen] = useState(false);
  const siteMenuRef = useRef<HTMLDivElement | null>(null);
  const previewRef = useRef<HTMLElement | null>(null);

  function scrollToPreview(): void {
    previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent): void {
      if (!siteMenuRef.current?.contains(event.target as Node)) {
        setIsSiteMenuOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        setIsSiteMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  async function handleGenerate(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const nextBlog = await api.generateBlog(form);
      setBlog(nextBlog);
      setMessage("Blog draft generated successfully.");
      window.setTimeout(scrollToPreview, 50);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate blog.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateFromNews(section: NewsSection, index: number): Promise<void> {
    const selectedNews = newsFeed[section][index];

    if (!selectedNews) {
      setError("Select one news item first.");
      setMessage("");
      return;
    }

    const targetSite = newsSectionSiteMap[section];

    setLoading(true);
    setError("");
    setMessage("");
    setGeneratingNewsTarget({ section, index });
    setSelectedNewsIndex((current) => ({
      ...current,
      [section]: index
    }));
    setForm((current) => ({ ...current, site: targetSite }));

    try {
      const nextBlog = await api.generateBlogFromNews({
        site: targetSite,
        prompt: form.prompt || selectedNews.title,
        selectedNews
      });
      setBlog(nextBlog);
      setMessage("Blog draft generated from selected news.");
      window.setTimeout(scrollToPreview, 50);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate blog from news.");
    } finally {
      setLoading(false);
      setGeneratingNewsTarget(null);
    }
  }

  async function handleRefreshNews(): Promise<void> {
    setNewsLoading(true);
    setError("");

    try {
      const response = await api.getLatestNews({ site: form.site });
      setNewsFeed({
        hiring: response.hiring || [],
        talent: response.talent || []
      });
      setSelectedNewsIndex({
        hiring: -1,
        talent: -1
      });
      setMessage("Latest news refreshed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh latest news.");
    } finally {
      setNewsLoading(false);
    }
  }

  async function handleSendForApproval(): Promise<void> {
    if (!blog?._id) {
      return;
    }

    setSubmitting(true);
    setError("");
    setMessage("");
    scrollToPreview();

    try {
      const response = await api.sendForApproval(blog._id);
      setBlog(response.blog);
      setMessage(response.mail_result.message || "Sent for approval.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send for approval.");
    } finally {
      setSubmitting(false);
    }
  }

  function renderNewsSection(section: NewsSection, title: string): JSX.Element {
    const items = newsFeed[section];
    const selectedIndex = selectedNewsIndex[section];
    const selectedNews = items[selectedIndex];

    return (
      <section className="news-section" aria-label={`${title} news`}>
        <div className="news-section-header">
          <div>
            <p className="news-section-title">{title}</p>
            <p className="news-section-count">{items.length} news</p>
          </div>
          {selectedNews ? <span className="news-section-selected">Selected</span> : null}
        </div>

        {items.length ? (
          <div className="news-list">
            {items.map((item, index) => (
              <article
                key={`${section}-${item.link}-${index}`}
                className={`news-card ${selectedIndex === index ? "is-selected" : ""}`}
              >
                <div className="news-card-topline">
                  <span>{item.source_name || "News source"}</span>
                  <span>{formatPublishedDate(item.published_at)}</span>
                </div>
                <strong>{item.title}</strong>
                <p>{item.snippet}</p>
                <div className="news-card-actions">
                  {isValidSourceUrl(item.link) ? (
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noreferrer"
                      className="news-source-link"
                      onClick={(event) => event.stopPropagation()}
                    >
                      View Source
                    </a>
                  ) : null}
                  <button
                    type="button"
                    className="news-generate-button"
                    onClick={(event) => {
                      event.stopPropagation();
                      void handleGenerateFromNews(section, index);
                    }}
                    disabled={loading}
                  >
                    {generatingNewsTarget?.section === section && generatingNewsTarget.index === index && loading
                      ? "Generating..."
                      : "Generate Blog"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-news-state">
            <p>No {title.toLowerCase()} news items available right now.</p>
          </div>
        )}
      </section>
    );
  }

  return (
    <div className="page-shell">
      <section className="creator-shell">
        <div className="creator-shell-header">
          <div className="brand-header">
            <p className="eyebrow">ZigMe Blog Creator</p>
          </div>
          <div>
            <p className="hero-copy">
              Choose the publishing site, optionally add a custom angle, and generate a
              blog from one of the latest news items.
            </p>
          </div>
        </div>

        <div className="creator-split">
          <section className="hero-card">
            <form className="blog-form" onSubmit={handleGenerate}>
              <label>
                Target site
                <div
                  className={`select-wrap custom-select ${isSiteMenuOpen ? "is-open" : ""}`}
                  ref={siteMenuRef}
                >
                  <button
                    type="button"
                    className="select-trigger"
                    aria-haspopup="listbox"
                    aria-expanded={isSiteMenuOpen}
                    onClick={() => setIsSiteMenuOpen((current) => !current)}
                  >
                    <span>{siteOptions.find((option) => option.value === form.site)?.label}</span>
                  </button>

                  {isSiteMenuOpen ? (
                    <div className="select-menu" role="listbox" aria-label="Target site options">
                      {siteOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          role="option"
                          className={`select-option ${
                            option.value === form.site ? "is-selected" : ""
                          }`}
                          aria-selected={option.value === form.site}
                          onClick={() => {
                            setForm((current) => ({ ...current, site: option.value }));
                            setIsSiteMenuOpen(false);
                          }}
                        >
                          <span>{option.label}</span>
                          {option.value === form.site ? (
                            <span className="option-check">Selected</span>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </label>

              <label>
                Blog topic
                <textarea
                  rows={5}
                  placeholder="Example: Write a blog about how AI is changing campus hiring and what it means for employers and students."
                  value={form.prompt}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, prompt: event.target.value }))
                  }
                />
              </label>

              <div className="actions">
                <button type="submit" disabled={loading}>
                  {loading ? "Generating..." : "Generate"}
                </button>
              </div>
            </form>

            {message ? <p className="message success">{message}</p> : null}
            {error ? <p className="message error">{error}</p> : null}
          </section>

          <section className="news-card-shell">
            <div className="news-panel-header">
              <div>
                <p className="eyebrow">Top 10 Latest News</p>
                <p className="news-hint">
                  Click Refresh to load the latest hiring and talent news for the selected
                  site. Choose one item and generate the blog from it.
                </p>
              </div>
              <button
                type="button"
                className="news-refresh-button"
                onClick={() => void handleRefreshNews()}
                disabled={newsLoading}
              >
                {newsLoading ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            {newsLoading ? (
              <div className="news-global-loader" aria-live="polite" aria-busy="true">
                <div className="news-spinner" />
                <div className="news-loading-copy">
                  <strong>Fetching latest news</strong>
                  <p>Loading hiring and talent news together.</p>
                </div>
              </div>
            ) : null}

            <div className="news-sections">
              {renderNewsSection("hiring", "Hiring")}
              {renderNewsSection("talent", "Talent")}
            </div>

            {newsLoading && (newsFeed.hiring.length > 0 || newsFeed.talent.length > 0) ? (
              <div className="news-refreshing-state" aria-live="polite">
                <span className="news-refreshing-dot" />
                Refreshing latest news...
              </div>
            ) : null}
          </section>
        </div>
      </section>

      {blog ? (
        <section className="preview-card" ref={previewRef}>
          <div className="preview-header">
            <div className="preview-copy">
              <p className="eyebrow">Generated Draft</p>
              <h2>{blog.title}</h2>
            </div>
            <span className="status-pill">{blog.status.replace(/_/g, " ")}</span>
          </div>

          <p className="summary">{blog.summary}</p>

          {blog.selected_news ? (
            <div className="selected-news-badge">
              <span>Based on news:</span>
                <strong>{blog.selected_news.title}</strong>
              <div className="selected-news-meta">
                <span>{blog.selected_news.source_name || "News source"}</span>
                {blog.selected_news.published_at ? (
                  <span>{formatPublishedDate(blog.selected_news.published_at)}</span>
                ) : null}
              </div>
              {isValidSourceUrl(blog.selected_news.link) ? (
                <a
                  href={blog.selected_news.link}
                  target="_blank"
                  rel="noreferrer"
                  className="news-source-link"
                >
                  View Source
                </a>
              ) : null}
            </div>
          ) : null}

          <div
            className="blog-body"
            dangerouslySetInnerHTML={{
              __html: blog.html_content
            }}
          />

          <div className="preview-actions">
            <button
              type="button"
              className="approval-button"
              disabled={submitting}
              onClick={() => void handleSendForApproval()}
            >
              {submitting ? "Sending..." : "Send for Approval"}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
