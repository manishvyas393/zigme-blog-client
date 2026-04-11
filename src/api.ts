export interface SelectedNews {
  title: string;
  link: string;
  snippet: string;
  source_name: string;
  published_at: string;
}

export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
}

export interface Blog {
  _id: string;
  blog_group_id: string;
  revision: number;
  site: string;
  prompt: string;
  search_query: string;
  title: string;
  summary: string;
  html_content: string;
  status: "draft" | "pending" | "approved" | "rejected";
  selected_news: SelectedNews | null;
  source_results: SearchResult[];
  generation_notes: string;
  created_at: string;
  updated_at: string;
}

export interface BlogListItem {
  _id: string;
  site: string;
  prompt: string;
  title: string;
  summary: string;
  html_content: string;
  status: "draft" | "pending" | "approved" | "rejected";
  created_at: string;
  updated_at: string;
}

export interface BlogListResponse {
  data: BlogListItem[];
  total: number;
  page: number;
  pages: number;
  limit: number;
}

export interface MailResult {
  delivered: boolean;
  message: string;
}

export interface LatestNewsResponse {
  hiring: SelectedNews[];
  talent: SelectedNews[];
  items?: SelectedNews[];
}

export interface LatestNewsFeed {
  hiring: SelectedNews[];
  talent: SelectedNews[];
  items: SelectedNews[];
}

export interface SendForApprovalResponse {
  blog: Blog;
  mail_result: MailResult;
}

export interface RejectResponse {
  rejected_blog: Blog;
  regenerated_blog: Blog;
  mail_result: MailResult;
}

export interface GetBlogsParams {
  status?: "draft" | "pending" | "approved" | "rejected";
  platform?: "talent" | "hiring";
  page?: number;
  pageNo?: number;
  limit?: number;
  skip?: number;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const payload = (await response.json()) as { message?: string } & T;

  if (!response.ok) {
    throw new Error(payload.message || "Request failed");
  }

  return payload;
}

function normalizeLatestNews(items: SelectedNews[]): SelectedNews[] {
  const seen = new Set<string>();

  return items
    .filter((item) => {
      const link = String(item.link || "").trim();

      if (!link || seen.has(link)) {
        return false;
      }

      seen.add(link);
      return true;
    })
    .sort((left, right) => {
      const leftTime = Date.parse(left.published_at || "");
      const rightTime = Date.parse(right.published_at || "");

      return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime);
    })
    .slice(0, 10);
}

function collectLatestNews(response: LatestNewsResponse): SelectedNews[] {
  return normalizeLatestNews([
    ...(response.hiring || []),
    ...(response.talent || []),
    ...(response.items || [])
  ]);
}

export const api = {
  getBlogs(params: GetBlogsParams = {}) {
    const searchParams = new URLSearchParams();

    if (params.status) {
      searchParams.set("filter[status]", params.status);
    }

    if (params.platform) {
      searchParams.set("filter[platform]", params.platform);
    }

    if (typeof params.page === "number") {
      searchParams.set("page", String(params.page));
    }

    if (typeof params.pageNo === "number") {
      searchParams.set("pageNo", String(params.pageNo));
    }

    if (typeof params.limit === "number") {
      searchParams.set("limit", String(params.limit));
    }

    if (typeof params.skip === "number") {
      searchParams.set("skip", String(params.skip));
    }

    const query = searchParams.toString();

    return request<BlogListResponse>(`/blogs${query ? `?${query}` : ""}`);
  },
  getLatestNews(body: { site: string; topic?: string }) {
    return request<LatestNewsResponse>("/blogs/latest-news", {
      method: "POST",
      body: JSON.stringify(body)
    }).then((response) => {
      const items = collectLatestNews(response);

      return {
        ...response,
        items
      };
    }) as Promise<LatestNewsFeed>;
  },
  generateBlog(body: { site: string; prompt: string }) {
    return request<Blog>("/blogs/generate", {
      method: "POST",
      body: JSON.stringify(body)
    });
  },
  generateBlogFromNews(body: { site: string; prompt: string; selectedNews: SelectedNews }) {
    return request<Blog>("/blogs/generate-from-news", {
      method: "POST",
      body: JSON.stringify(body)
    });
  },
  sendForApproval(id: string) {
    return request<SendForApprovalResponse>(`/blogs/${id}/send-for-approval`, {
      method: "POST"
    });
  },
  getReview(id: string) {
    return request<Blog>(`/blogs/review/${id}`);
  },
  approve(id: string) {
    return request<Blog>(`/blogs/review/${id}/approve`, {
      method: "POST"
    });
  },
  reject(id: string) {
    return request<RejectResponse>(`/blogs/review/${id}/reject`, {
      method: "POST"
    });
  }
};
