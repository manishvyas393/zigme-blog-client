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
  status: "draft" | "pending_approval" | "approved" | "rejected";
  approved_flag: boolean;
  rejected_flag: boolean;
  review_token: string;
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
  selected_news: SelectedNews | null;
  source_results: SearchResult[];
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
  approved?: boolean;
  rejected?: boolean;
  status?: "draft" | "pending" | "approved" | "rejected";
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

export const api = {
  getBlogs(params: GetBlogsParams = {}) {
    const searchParams = new URLSearchParams();

    if (typeof params.approved === "boolean") {
      searchParams.set("filter[approved]", String(params.approved));
    }

    if (typeof params.rejected === "boolean") {
      searchParams.set("filter[rejected]", String(params.rejected));
    }

    if (params.status) {
      searchParams.set("filter[status]", params.status);
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
    });
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
  getReview(token: string) {
    return request<Blog>(`/blogs/review/${token}`);
  },
  approve(token: string) {
    return request<Blog>(`/blogs/review/${token}/approve`, {
      method: "POST"
    });
  },
  reject(token: string) {
    return request<RejectResponse>(`/blogs/review/${token}/reject`, {
      method: "POST"
    });
  }
};
