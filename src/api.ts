export interface SelectedNews {
  title: string;
  link: string;
  snippet: string;
  sourceName: string;
  publishedAt: string;
}

export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
}

export interface Blog {
  _id: string;
  blogGroupId: string;
  revision: number;
  site: string;
  prompt: string;
  searchQuery: string;
  title: string;
  summary: string;
  htmlContent: string;
  status: "draft" | "pending_approval" | "approved" | "rejected";
  approvedFlag: boolean;
  rejectedFlag: boolean;
  reviewToken: string;
  selectedNews: SelectedNews | null;
  sourceResults: SearchResult[];
  generationNotes: string;
  createdAt: string;
  updatedAt: string;
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
  mailResult: MailResult;
}

export interface RejectResponse {
  rejectedBlog: Blog;
  regeneratedBlog: Blog;
  mailResult: MailResult;
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

