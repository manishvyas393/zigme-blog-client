import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Blog, type BlogImageAttachment, type BlogListItem, type SelectedNews } from "../api.js";

type SiteOption = {
  value: "hiring.zigme.in" | "talent.zigme.in";
  label: string;
};

type FormState = {
  site: SiteOption["value"];
  prompt: string;
  wordRange: Blog["word_range"];
};

type WordRangeOption = {
  value: Blog["word_range"];
  label: string;
};

type AttachedImageState = BlogImageAttachment | null;

type NewsSection = "hiring" | "talent";

type NewsFeed = Record<NewsSection, SelectedNews[]>;

type SelectedNewsState = Record<NewsSection, number>;

type SiteValue = SiteOption["value"];

type NewsTarget = {
  section: NewsSection;
  index: number;
} | null;

type LibraryFilters = {
  status: "all" | Blog["status"];
  platform: "all" | "hiring" | "talent";
};

type LibraryState = {
  items: BlogListItem[];
  total: number;
  page: number;
  pages: number;
  limit: number;
};

const libraryPageSize = 8;

const initialLibraryFilters: LibraryFilters = {
  status: "all",
  platform: "all"
};

const initialForm: FormState = {
  site: "hiring.zigme.in",
  prompt: "",
  wordRange: "1000-1500"
};

const siteOptions: SiteOption[] = [
  { value: "hiring.zigme.in", label: "hiring.zigme.in" },
  { value: "talent.zigme.in", label: "talent.zigme.in" }
];

const wordRangeOptions: WordRangeOption[] = [
  { value: "0-500", label: "0-500 words" },
  { value: "500-1000", label: "500-1000 words" },
  { value: "1000-1500", label: "1000-1500 words" },
  { value: "1500-2000", label: "1500-2000 words" }
];

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

const latestNewsSite: SiteValue = "hiring.zigme.in";

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

function formatFileSize(size: number): string {
  if (!size) {
    return "0 KB";
  }

  const megabytes = size / (1024 * 1024);

  if (megabytes >= 1) {
    return `${megabytes.toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

function formatWordRange(value: Blog["word_range"]): string {
  return `${value.replace("-", " - ")} words`;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function updatePreviewFeaturedImage(
  htmlContent: string,
  attachment: BlogImageAttachment | null
): string {
  if (!attachment?.data_url) {
    return htmlContent;
  }

  const imageMarkup = `
    <figure class="blog-feature-image">
      <img src="${attachment.data_url}" alt="${attachment.name || "Uploaded image"}" />
    </figure>
  `;

  const featuredImagePattern = /<figure class="blog-feature-image">[\s\S]*?<\/figure>/i;

  if (featuredImagePattern.test(htmlContent)) {
    return htmlContent.replace(featuredImagePattern, imageMarkup);
  }

  return `${imageMarkup}${htmlContent}`;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read the selected image."));
    reader.readAsDataURL(file);
  });
}

export function HomePage(): JSX.Element {
  const [form, setForm] = useState<FormState>(initialForm);
  const [blog, setBlog] = useState<Blog | null>(null);
  const [attachedImage, setAttachedImage] = useState<AttachedImageState>(null);
  const [loading, setLoading] = useState(false);
  const [newsLoading, setNewsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [newsFeed, setNewsFeed] = useState<NewsFeed>({ hiring: [], talent: [] });
  const [selectedNewsIndex, setSelectedNewsIndex] = useState<SelectedNewsState>({
    hiring: -1,
    talent: -1
  });
  const [activeNewsSection, setActiveNewsSection] = useState<NewsSection>("hiring");
  const [generatingNewsTarget, setGeneratingNewsTarget] = useState<NewsTarget>(null);
  const [libraryFilters, setLibraryFilters] = useState<LibraryFilters>(initialLibraryFilters);
  const [libraryPage, setLibraryPage] = useState(0);
  const [libraryState, setLibraryState] = useState<LibraryState>({
    items: [],
    total: 0,
    page: 0,
    pages: 1,
    limit: libraryPageSize
  });
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState("");
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [approvalEmailInput, setApprovalEmailInput] = useState("");
  const [approvalEmailError, setApprovalEmailError] = useState("");
  const [isSiteMenuOpen, setIsSiteMenuOpen] = useState(false);
  const siteMenuRef = useRef<HTMLDivElement | null>(null);
  const draftImageInputRef = useRef<HTMLInputElement | null>(null);
  const previewRef = useRef<HTMLElement | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  function scrollToPreview(): void {
    previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const previewHtmlContent =
    blog && attachedImage
      ? updatePreviewFeaturedImage(blog.html_content, attachedImage)
      : blog?.html_content || "";

  function clearAttachedImageInputs(): void {
    if (draftImageInputRef.current) {
      draftImageInputRef.current.value = "";
    }
  }

  function showToast(messageText: string): void {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }

    setToastMessage(messageText);
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage("");
      toastTimerRef.current = null;
    }, 3000);
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
        setApprovalDialogOpen(false);
        setApprovalEmailError("");
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    async function loadLatestNews(): Promise<void> {
      setNewsLoading(true);
      setError("");

      try {
        const response = await api.getLatestNews({ site: latestNewsSite });
        setNewsFeed({
          hiring: response.hiring || [],
          talent: response.talent || []
        });
        setSelectedNewsIndex({
          hiring: -1,
          talent: -1
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load latest news.");
      } finally {
        setNewsLoading(false);
      }
    }

    void loadLatestNews();
  }, []);

  useEffect(() => {
    async function loadLibrary(): Promise<void> {
      setLibraryLoading(true);
      setLibraryError("");

      try {
        const response = await api.getBlogs({
          status: libraryFilters.status === "all" ? undefined : libraryFilters.status,
          platform:
            libraryFilters.platform === "all"
              ? undefined
              : (libraryFilters.platform as "talent" | "hiring"),
          page: libraryPage,
          limit: libraryPageSize
        });

        setLibraryState({
          items: response.data || [],
          total: response.total || 0,
          page: response.page ?? 0,
          pages: response.pages ?? 1,
          limit: response.limit ?? libraryPageSize
        });
      } catch (err) {
        setLibraryError(err instanceof Error ? err.message : "Failed to load blog library.");
      } finally {
        setLibraryLoading(false);
      }
    }

    void loadLibrary();
  }, [libraryFilters.platform, libraryFilters.status, libraryPage]);

  async function handleImageChange(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0] || null;

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Please upload a valid image file.");
      setMessage("");
      event.target.value = "";
      return;
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setError("Attached image must be 5 MB or smaller.");
      setMessage("");
      event.target.value = "";
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setAttachedImage({
        name: file.name,
        type: file.type,
        size: file.size,
        data_url: dataUrl
      });
      setMessage("Image attached successfully.");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to attach image.");
      setMessage("");
    } finally {
      event.target.value = "";
    }
  }

  async function handleGenerate(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const nextBlog = await api.generateBlog({
        ...form,
        attachedImage
      });
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

    try {
      const nextBlog = await api.generateBlogFromNews({
        site: targetSite,
        prompt: form.prompt || selectedNews.title,
        wordRange: form.wordRange,
        attachedImage,
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
      const response = await api.getLatestNews({ site: latestNewsSite });
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

  function updateLibraryFilter<K extends keyof LibraryFilters>(key: K, value: LibraryFilters[K]): void {
    setLibraryFilters((current) => ({
      ...current,
      [key]: value
    }));
    setLibraryPage(0);
  }

  function changeLibraryPage(nextPage: number): void {
    const normalizedPage = Math.min(Math.max(0, nextPage), Math.max(0, libraryState.pages - 1));
    setLibraryPage(normalizedPage);
  }

  async function handleSendForApproval(): Promise<void> {
    if (!blog?._id) {
      return;
    }

    setApprovalEmailInput("");
    setApprovalEmailError("");
    setApprovalDialogOpen(true);
  }

  async function confirmSendForApproval(): Promise<void> {
    if (!blog?._id) {
      return;
    }

    const email = approvalEmailInput.trim();

    if (!email) {
      setApprovalEmailError("Approval email is required.");
      return;
    }

    if (!isValidEmail(email)) {
      setApprovalEmailError("Please enter a valid email address.");
      return;
    }

    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      const response = await api.sendForApproval(blog._id, email);
      setBlog(response.blog);
      setMessage(response.mail_result.message || "Sent for approval.");
      showToast("Blog sent for approval.");
      setApprovalDialogOpen(false);
      setApprovalEmailInput("");
      setApprovalEmailError("");
      scrollToPreview();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send for approval.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRegenerateDraft(): Promise<void> {
    if (!blog) {
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const sharedPayload = {
        site: blog.site as SiteValue,
        prompt: form.prompt || blog.prompt,
        wordRange: form.wordRange,
        attachedImage
      };

      const nextBlog = blog.selected_news
        ? await api.generateBlogFromNews({
            ...sharedPayload,
            selectedNews: {
              title: blog.selected_news.title,
              link: blog.selected_news.link,
              snippet: blog.selected_news.snippet,
              source_name: blog.selected_news.source_name,
              published_at: blog.selected_news.published_at
            }
          })
        : await api.generateBlog(sharedPayload);

      setBlog(nextBlog);
      setMessage("Blog regenerated successfully.");
      window.setTimeout(scrollToPreview, 50);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to regenerate blog.");
    } finally {
      setLoading(false);
    }
  }

  function renderNewsSection(section: NewsSection, title: string): JSX.Element {
    const items = newsFeed[section];
    const selectedIndex = selectedNewsIndex[section];
    const selectedNews = items[selectedIndex];
    const featuredNews = items[0];
    const sideStories = items.slice(1);

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
          <div className="news-layout">
            {featuredNews ? (
              <article
                key={`${section}-${featuredNews.link}-featured`}
                className={`news-card news-card--featured ${
                  featuredNews.image_url ? "has-feature-image" : ""
                } ${selectedIndex === 0 ? "is-selected" : ""}`}
              >
                {featuredNews.image_url ? (
                  <div className="news-card-feature-image news-card-feature-image--hero">
                    <img src={featuredNews.image_url} alt={featuredNews.title} />
                  </div>
                ) : null}
                <div className="news-card-feature-overlay">
                  <div className="news-card-topline">
                    <span>{featuredNews.source_name || "News source"}</span>
                    <span>{formatPublishedDate(featuredNews.published_at)}</span>
                  </div>
                  <div className="news-card-feature">
                    <span className="news-card-feature-badge">{title}</span>
                    <strong>{featuredNews.title}</strong>
                    <p>{featuredNews.snippet}</p>
                  </div>
                  <div className="news-card-actions">
                    {isValidSourceUrl(featuredNews.link) ? (
                      <a
                        href={featuredNews.link}
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
                        void handleGenerateFromNews(section, 0);
                      }}
                      disabled={loading}
                    >
                      {generatingNewsTarget?.section === section &&
                      generatingNewsTarget.index === 0 &&
                      loading
                        ? "Generating..."
                        : "Generate Blog"}
                    </button>
                  </div>
                </div>
              </article>
            ) : null}

            {sideStories.length ? (
              <div className="news-list">
                {sideStories.map((item, index) => {
                  const actualIndex = index + 1;

                  return (
                    <article
                      key={`${section}-${item.link}-${actualIndex}`}
                      className={`news-card ${selectedIndex === actualIndex ? "is-selected" : ""}`}
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
                            void handleGenerateFromNews(section, actualIndex);
                          }}
                          disabled={loading}
                        >
                          {generatingNewsTarget?.section === section &&
                          generatingNewsTarget.index === actualIndex &&
                          loading
                            ? "Generating..."
                            : "Generate Blog"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : null}
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
      {toastMessage ? (
        <div className="toast-notification" role="status" aria-live="polite">
          <span className="toast-dot" />
          <span>{toastMessage}</span>
        </div>
      ) : null}

      {approvalDialogOpen ? (
        <div
          className="approval-dialog-backdrop"
          role="presentation"
          onClick={() => {
            if (!submitting) {
              setApprovalDialogOpen(false);
              setApprovalEmailError("");
            }
          }}
        >
          <div
            className="approval-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="approval-dialog-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="approval-dialog-header">
              <div>
                <p className="eyebrow">Send for approval</p>
                <h3 id="approval-dialog-title">Enter approval email</h3>
              </div>
              <button
                type="button"
                className="secondary approval-dialog-close"
                onClick={() => {
                  if (!submitting) {
                    setApprovalDialogOpen(false);
                    setApprovalEmailError("");
                  }
                }}
                disabled={submitting}
              >
                Close
              </button>
            </div>

            <label>
              Approval email
              <input
                type="email"
                autoFocus
                required
                placeholder="name@company.com"
                value={approvalEmailInput}
                onChange={(event) => {
                  setApprovalEmailInput(event.target.value);
                  if (approvalEmailError) {
                    setApprovalEmailError("");
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void confirmSendForApproval();
                  }
                }}
              />
            </label>

            {approvalEmailError ? <p className="message error">{approvalEmailError}</p> : null}

            <div className="approval-dialog-actions">
              <button
                type="button"
                className="secondary"
                disabled={submitting}
                onClick={() => {
                  setApprovalDialogOpen(false);
                  setApprovalEmailError("");
                }}
              >
                Cancel
              </button>
              <button type="button" disabled={submitting} onClick={() => void confirmSendForApproval()}>
                {submitting ? "Sending..." : "Send"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <section className="tool-hero">
        <div className="tool-hero-copy">
          <div className="tool-hero-badge">ZigMe BLOG TOOL</div>
          <h1>Turn raw news into a polished editorial workspace</h1>
          <p>
            A more premium, modern interface for generating blog drafts, browsing latest news,
            uploading visuals, and sending content for approval.
          </p>

        </div>

        <div className="tool-hero-panel">
          <div className="hero-float hero-float-one" />
          <div className="hero-float hero-float-two" />
          <div className="hero-card-stack">
            <article className="hero-preview-card hero-preview-card--primary">
              <span className="hero-preview-label">Generate</span>
              <strong>Create a story in one click</strong>
              <p>Use the latest feed and your topic.</p>
            </article>
            <article className="hero-preview-card hero-preview-card--secondary">
              <span className="hero-preview-label">Approve</span>
              <strong>Send a draft for review</strong>
              <p>Everything stays inside a clean editorial flow.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="creator-shell">
        <div className="creator-shell-header">
          <div className="brand-header">
            <p className="eyebrow">ZigMe BLOG TOOL</p>
          </div>
        </div>

        <div className="creator-split">
          <section className="hero-card">
            <form className="blog-form" onSubmit={handleGenerate}>
              <div className="blog-form-row">
                <label className="blog-form-field blog-form-field--site">
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

                <label className="blog-form-field blog-form-field--prompt">
                  Blog topic
                  <input
                    type="text"
                    placeholder="Example: Write a blog about how AI is changing campus hiring and what it means for employers and students."
                    value={form.prompt}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, prompt: event.target.value }))
                    }
                  />
                </label>

                <div className="actions blog-form-actions">
                  <button type="submit" disabled={loading}>
                    {loading ? "Generating..." : "Generate"}
                  </button>
                </div>
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
                  Latest hiring and talent news loads on page open. Click Refresh to fetch
                  the newest set again, then choose one item and generate the blog from it.
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

            <div className="news-tabs" role="tablist" aria-label="Latest news sections">
              {(["hiring", "talent"] as const).map((section) => (
                <button
                  key={section}
                  type="button"
                  role="tab"
                  aria-selected={activeNewsSection === section}
                  className={`news-tab ${activeNewsSection === section ? "is-active" : ""}`}
                  onClick={() => setActiveNewsSection(section)}
                >
                  <span>{section === "hiring" ? "Hiring" : "Talent"}</span>
                  <span>{newsFeed[section].length}</span>
                </button>
              ))}
            </div>

            <div className="news-tab-panel">
              {renderNewsSection(
                activeNewsSection,
                activeNewsSection === "hiring" ? "Hiring" : "Talent"
              )}
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

      {/*
      <section className="blog-library-shell">
        <div className="section-heading blog-library-header">
          <div>
            <p className="eyebrow">Blog Library</p>
          </div>

          <div className="library-filter-row">
            <button
              type="button"
              className={libraryFilters.status === "all" ? "filter-pill is-active" : "filter-pill"}
              onClick={() => updateLibraryFilter("status", "all")}
            >
              All Statuses
            </button>
            {(["draft", "pending", "approved", "rejected"] as const).map((status) => (
              <button
                key={status}
                type="button"
                className={libraryFilters.status === status ? "filter-pill is-active" : "filter-pill"}
                onClick={() => updateLibraryFilter("status", status)}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        <div className="library-toolbar">
          <div className="library-filter-row">
            {(["all", "hiring", "talent"] as const).map((platform) => (
              <button
                key={platform}
                type="button"
                className={libraryFilters.platform === platform ? "filter-pill is-active" : "filter-pill"}
                onClick={() => updateLibraryFilter("platform", platform)}
              >
                {platform === "all" ? "All Platforms" : platform}
              </button>
            ))}
          </div>
          <div className="library-counts">
            <span>{libraryState.total} total</span>
            <span>Page {libraryState.page + 1} of {libraryState.pages}</span>
          </div>
        </div>

        {libraryLoading ? (
          <div className="news-global-loader library-loading" aria-live="polite" aria-busy="true">
            <div className="news-spinner" />
            <div className="news-loading-copy">
              <strong>Loading blog archive</strong>
              <p>Fetching previously generated blogs with your selected filters.</p>
            </div>
          </div>
        ) : null}

        {libraryError ? <p className="message error">{libraryError}</p> : null}

        {libraryState.items.length ? (
          <div className="library-grid">
            {libraryState.items.map((item) => (
              <Link key={item._id} to={`/review/${item._id}`} className="library-card-link">
                <article className="library-card">
                  <div className="library-card-header">
                    <span className={`status-pill status-pill--${item.status}`}>{item.status}</span>
                    <span className="library-site">{item.site}</span>
                  </div>
                  <h4>{item.title}</h4>
                  <p>{item.summary}</p>
                  <div className="library-card-footer">
                    <span>{formatPublishedDate(item.created_at)}</span>
                    <span className="library-card-action">Open review</span>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty-news-state">
            <p>No previous blogs match these filters yet.</p>
          </div>
        )}

        {libraryState.pages > 1 ? (
          <div className="library-pagination" aria-label="Blog library pagination">
            <button
              type="button"
              className="secondary"
              onClick={() => changeLibraryPage(libraryPage - 1)}
              disabled={libraryLoading || libraryPage <= 0}
            >
              Previous
            </button>

            <div className="library-pagination-status">
              <span>
                Page {libraryPage + 1} of {libraryState.pages}
              </span>
              <span>{libraryState.total} blogs total</span>
            </div>

            <button
              type="button"
              className="secondary"
              onClick={() => changeLibraryPage(libraryPage + 1)}
              disabled={libraryLoading || libraryPage >= Math.max(0, libraryState.pages - 1)}
            >
              Next
            </button>
          </div>
        ) : null}
      </section>
      */}

      {blog ? (
        <section className="preview-card" ref={previewRef}>
          <div className="draft-shell">
            <div className="draft-header">
              <div className="draft-header-copy">
                <p className="eyebrow">Generated Draft</p>
                <h2>{blog.title}</h2>
                <p className="summary draft-summary">{blog.summary}</p>
              </div>
              <div className="draft-status-stack">
                <span className="status-pill">{blog.status.replace(/_/g, " ")}</span>
                <div className="draft-status-note">
                  <span>Word length</span>
                  <strong>{formatWordRange(blog.word_range)}</strong>
                </div>
              </div>
            </div>

            <div className="draft-layout">
              <div className="draft-canvas">
                {blog.attached_image ? (
                  <div className="draft-hero-image">
                    <img
                      src={blog.attached_image.data_url}
                      alt={blog.attached_image.name || "Attached image"}
                    />
                  </div>
                ) : null}

                <div className="draft-body-shell">
                  <div className="draft-body-header">
                    <div>
                      <p className="draft-section-label">Article preview</p>
                      <strong>Creative preview canvas</strong>
                    </div>
                    <span className="draft-canvas-chip">Live HTML</span>
                  </div>

                  <div
                    className="blog-body"
                    dangerouslySetInnerHTML={{
                      __html: previewHtmlContent
                    }}
                  />
                </div>
              </div>

              <aside className="draft-rail">
                {blog.attached_image ? (
                  <div className="draft-info-card">
                    <p className="draft-section-label">Attached image</p>
                    <div className="draft-media-row">
                      <div className="draft-media-thumb">
                        <img
                          src={blog.attached_image.data_url}
                          alt={blog.attached_image.name || "Attached image"}
                        />
                      </div>
                      <div>
                        <strong>{blog.attached_image.name}</strong>
                        <div className="selected-image-meta">
                          <span>{blog.attached_image.type || "image"}</span>
                          <span>{formatFileSize(blog.attached_image.size)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                {blog.selected_news ? (
                  <div className="draft-info-card">
                    <p className="draft-section-label">Source story</p>
                    <strong className="draft-source-title">{blog.selected_news.title}</strong>
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

                <div className="draft-settings-card">
                  <div className="draft-settings-header">
                    <div>
                      <p className="draft-settings-title">Draft settings</p>
                      <p className="draft-settings-copy">
                        These values stay attached to the generated draft. Approval email is
                        collected when you send it for approval.
                      </p>
                    </div>
                  </div>

                  <div className="draft-settings-grid">
                    <label className="draft-length-field">
                      Blog length
                      <select
                        value={form.wordRange}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            wordRange: event.target.value as FormState["wordRange"]
                          }))
                        }
                      >
                        {wordRangeOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="upload-field upload-field--compact">
                      <div className="upload-field-header">
                        <div>
                          <span className="upload-field-label">Blog image</span>
                          <p className="upload-field-hint">Optional. Max file size 5 MB.</p>
                        </div>
                        <input
                          ref={draftImageInputRef}
                          type="file"
                          accept="image/*"
                          className="visually-hidden"
                          onChange={(event) => void handleImageChange(event)}
                        />
                        <button
                          type="button"
                          className="secondary upload-button"
                          onClick={() => draftImageInputRef.current?.click()}
                        >
                          {attachedImage ? "Replace Image" : "Upload Image"}
                        </button>
                      </div>

                      {attachedImage ? (
                        <div className="upload-preview">
                          <div className="upload-preview-thumb">
                            <img
                              src={attachedImage.data_url}
                              alt={attachedImage.name || "Uploaded image"}
                            />
                          </div>
                          <div className="upload-preview-meta">
                            <strong>{attachedImage.name}</strong>
                            <span>
                              {attachedImage.type || "image"} · {formatFileSize(attachedImage.size)}
                            </span>
                          </div>
                          <button
                            type="button"
                            className="secondary upload-remove-button"
                            onClick={() => {
                              setAttachedImage(null);
                              clearAttachedImageInputs();
                              setMessage("Attached image removed.");
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </aside>
            </div>

            <div className="preview-actions draft-actions">
              <button
                type="button"
                className="secondary"
                disabled={loading}
                onClick={() => void handleRegenerateDraft()}
              >
                {loading ? "Regenerating..." : "Regenerate Draft"}
              </button>
              <button
                type="button"
                className="approval-button"
                disabled={submitting}
                onClick={() => void handleSendForApproval()}
              >
                {submitting ? "Sending..." : "Send for Approval"}
              </button>
            </div>
          </div>
        </section>
      ) : null}

    </div>
  );
}











